/**
 * Claude CLI Stream Parser
 * Parses stream-json output from Claude CLI in real-time
 */

import { EventEmitter } from 'events';
import { ClaudeStreamMessage, ClaudeContent, ClaudePermissionRequest } from '../types.js';
import { getToolTier, getToolDescription } from '../../shared/ToolPermissionManager.js';
import { ILoggerService } from '../../../../interfaces/core/ILoggerService.js';
import { IAppEventBusService } from '../../../../interfaces/events/IAppEventBusService.js';

export class ClaudeStreamParser extends EventEmitter {
  private buffer: string = '';
  private logger?: ILoggerService;
  private eventBus?: IAppEventBusService;
  private toolNameMap: Map<string, string> = new Map(); // Track tool names by tool use ID

  constructor(logger?: ILoggerService, eventBus?: IAppEventBusService) {
    super();
    this.logger = logger;
    this.eventBus = eventBus;
  }

  /**
   * Process incoming data chunks from Claude CLI stdout
   */
  processChunk(data: string): void {
    this.buffer += data;
    
    // Process complete JSON lines
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          if (this.logger) {
            this.logger.debug('🔍 Raw JSON:', { rawData: line.trim() });
          }
          const message: ClaudeStreamMessage = JSON.parse(line.trim());
          
          // Enhanced logging for MCP permission flow debugging
          if (this.logger) {
            // Log all messages to track complete flow
            this.logger.debug('🔍 Parsed Claude message:', { 
              type: message.type, 
              subtype: message.subtype,
              sessionId: message.session_id 
            });
            
            // Track MCP permission-related messages specifically
            if (message.message?.content) {
              const toolUses = message.message.content.filter(c => c.type === 'tool_use');
              const mcpTools = toolUses.filter(t => t.name?.startsWith('mcp__'));
              
              if (mcpTools.length > 0) {
                this.logger.info('🔧 MCP tool usage detected:', {
                  tools: mcpTools.map(t => ({ name: t.name, id: t.id, input: t.input }))
                });
              }
              
              // Specifically track mcp__permission__approval_prompt calls
              const permissionPrompts = toolUses.filter(t => t.name === 'mcp__permission__approval_prompt');
              if (permissionPrompts.length > 0) {
                this.logger.info('🔐 MCP Permission prompt detected:', {
                  permissions: permissionPrompts.map(p => ({
                    id: p.id,
                    input: p.input
                  }))
                });
              }
            }
          }
          
          this.handleMessage(message);
        } catch (error) {
          if (this.logger) {
            this.logger.warn('Failed to parse Claude stream JSON:', { line, error });
          }
          this.emit('error', `Failed to parse JSON: ${error}`);
        }
      }
    }
  }

  /**
   * Handle parsed Claude stream message
   */
  private handleMessage(message: ClaudeStreamMessage): void {
    // Only log non-routine messages to reduce spam
    if (message.type !== 'assistant' && message.type !== 'user') {
      if (this.logger) {
        this.logger.debug('📨 Claude stream message:', { type: message.type, subtype: message.subtype || '' });
      }
    }

    switch (message.type) {
      case 'system':
        this.handleSystemMessage(message);
        break;
      
      case 'assistant':
        this.handleAssistantMessage(message);
        break;
      
      case 'user':
        this.handleUserMessage(message);
        break;
      
      case 'result':
        this.handleResultMessage(message);
        break;
      
      case 'error':
        this.handleErrorMessage(message);
        break;
      
      default:
        if (this.logger) {
          this.logger.warn('Unknown Claude stream message type:', { messageType: message.type });
        }
        this.emit('unknown_message', message);
    }
  }

  /**
   * Handle system messages (init, session info)
   */
  private handleSystemMessage(message: ClaudeStreamMessage): void {
    this.emit('system', {
      subtype: message.subtype,
      sessionId: message.session_id,
      tools: message.tools,
      model: message.model,
      permissionMode: message.permissionMode
    });
  }

  /**
   * Handle assistant messages (streaming response)
   */
  private handleAssistantMessage(message: ClaudeStreamMessage): void {
    if (!message.message?.content) {
      return;
    }

    // Check for tool usage that requires permission
    const toolUseContent = message.message.content.filter(c => c.type === 'tool_use');
    
    if (toolUseContent.length > 0) {
      // LOG FULL RAW JSON FOR ALL TOOL_USE MESSAGES
      if (this.logger) {
        this.logger.info('🔍 === FULL RAW TOOL_USE JSON ===');
        this.logger.info(JSON.stringify(message, null, 2));
        this.logger.info('🔍 === END RAW TOOL_USE JSON ===');
        
        // Also log individual tool details
        for (const tool of toolUseContent) {
          this.logger.info(`🔧 Tool Details - Name: ${tool.name}, ID: ${tool.id}`);
          this.logger.info(`🔧 Tool Input: ${JSON.stringify(tool.input, null, 2)}`);
        }
      }
      
      // Handle tool permission requests and emit tool execution start
      for (const toolContent of toolUseContent) {
        // Store tool name mapping for later completion events
        if (toolContent.id && toolContent.name) {
          this.toolNameMap.set(toolContent.id, toolContent.name);
        }
        
        // Emit tool execution start event
        this.emit('tool_execution_start', {
          toolName: toolContent.name,
          args: toolContent.input,
          timestamp: new Date(),
          toolUseId: toolContent.id // Include tool use ID for proper matching
        });
        
        // DO NOT emit plan content as text_chunk - this causes plan to appear in messages
        // Plan content will be shown in permission window only
        
        // Emit permission request for built-in tools that need permission
        // MCP permission tool only handles MCP tools, not built-in tools
        const permissionRequest = this.createPermissionRequest(toolContent);
        if (permissionRequest) {
          // Only emit permission request for tools that are not safe
          const safeTools = ["Read", "LS", "Glob", "Grep", "NotebookRead", "TodoRead", "TodoWrite", "WebSearch", "exit_plan_mode"];
          if (!safeTools.includes(permissionRequest.tool)) {
            this.emit('permission_request', permissionRequest);
          }
        }
      }
    }
    
    // Check for tool results
    const toolResultContent = message.message.content.filter(c => c.type === 'tool_result');
    
    if (toolResultContent.length > 0) {
      // Handle tool results and emit tool execution complete
      for (const toolResult of toolResultContent) {
        // Log tool completion for debugging
        if (this.logger) {
          this.logger.debug(`🔧 Tool completed: ${toolResult.tool_use_id} ${toolResult.is_error ? '❌' : '✅'}`);
        }
        if (this.logger) {
          this.logger.debug(`📋 Tool result content:`, { content: toolResult.content });
        }
        
        if (toolResult.tool_use_id) {
          this.emit('tool_execution_complete', {
            toolUseId: toolResult.tool_use_id,
            toolName: this.toolNameMap.get(toolResult.tool_use_id), // Include tool name from mapping
            result: toolResult.content,
            isError: toolResult.is_error,
            success: !toolResult.is_error, // Convert isError to success flag
            timestamp: new Date()
          });
        }
        
        // Clean up tool name mapping to prevent memory leaks
        if (toolResult.tool_use_id) {
          this.toolNameMap.delete(toolResult.tool_use_id);
        }
      }
    }

    // Extract text content for streaming (Claude doesn't emit thinking content)
    const allTextContent = message.message.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .filter(text => text && text.trim().length > 0)
      .join('');

    // Emit all text content as regular messages (Claude doesn't use thinking)
    if (allTextContent) {
      this.emit('text_chunk', allTextContent);
    }

    // Emit full message for advanced handling
    this.emit('assistant_message', {
      id: message.message.id,
      content: message.message.content,
      model: message.message.model,
      stopReason: message.message.stop_reason,
      usage: message.message.usage
    });
  }

  /**
   * Handle user messages (echoed input)
   */
  private handleUserMessage(message: ClaudeStreamMessage): void {
    // Check for tool results in user messages
    const content = message.message?.content || [];
    
    // Look for all tool_result messages
    const toolResultContent = content.filter(c => c.type === 'tool_result');
    
    if (toolResultContent.length > 0) {
      for (const toolResult of toolResultContent) {
        if (toolResult.is_error) {
          // Handle tool failures
          if (this.logger) {
            this.logger.error(`❌ Tool failed: ${toolResult.tool_use_id}`, { content: toolResult.content });
          }
          
          this.emit('tool_failure', {
            toolUseId: toolResult.tool_use_id,
            error: toolResult.content,
            timestamp: new Date()
          });
          
          // Clean up tool name mapping
          if (toolResult.tool_use_id) {
            this.toolNameMap.delete(toolResult.tool_use_id);
          }
        } else {
          // Handle successful tool results - these indicate auto-approval by Claude CLI
          if (this.logger) {
            this.logger.debug(`✅ Tool auto-approved by Claude CLI: ${toolResult.tool_use_id}`);
          }
          
          // Emit both local and global events
          if (toolResult.tool_use_id) {
            this.emit('tool_auto_approved', {
              toolUseId: toolResult.tool_use_id,
              toolName: this.toolNameMap.get(toolResult.tool_use_id), // Include tool name
              content: toolResult.content,
              timestamp: new Date()
            });
          }
          
          // Clean up tool name mapping
          if (toolResult.tool_use_id) {
            this.toolNameMap.delete(toolResult.tool_use_id);
          }
          
          // Emit global event for PermissionContext to cancel UI
          if (toolResult.tool_use_id && this.eventBus) {
            this.eventBus.emitToolAutoApproval({
              toolUseId: toolResult.tool_use_id,
              content: toolResult.content || '',
              timestamp: new Date()
            });
          }
        }
      }
    }
    
    this.emit('user_message', {
      content: message.message?.content || []
    });
  }

  /**
   * Handle result messages (completion metadata)
   */
  private handleResultMessage(message: ClaudeStreamMessage): void {
    // DO NOT emit result content as text_chunk here - it's already emitted by handleAssistantMessage
    // The result content appears as assistant message text content first, then as result metadata
    // Emitting it here would create duplicates
    
    // Only emit result event for state cleanup and metadata (both success and error)
    this.emit('result', {
      subtype: message.subtype,
      result: message.result, // undefined for error results per schema
      durationMs: message.duration_ms,
      durationApiMs: message.duration_api_ms,
      totalCostUsd: message.total_cost_usd,
      sessionId: message.session_id
    });
  }

  /**
   * Handle error messages
   */
  private handleErrorMessage(message: ClaudeStreamMessage): void {
    this.emit('error', message.error || 'Unknown error from Claude CLI');
  }


  /**
   * Create permission request from tool use content
   * Note: This method is kept for potential future use, but permission requests
   * are now handled exclusively by ClaudeProcessService to prevent duplicates.
   */
  private createPermissionRequest(toolContent: ClaudeContent): ClaudePermissionRequest | null {
    if (!toolContent.name) {
      return null;
    }

    return {
      tool: toolContent.name,
      tier: getToolTier(toolContent.name),
      command: this.formatToolCommand(toolContent),
      description: getToolDescription(toolContent.name),
      arguments: toolContent.input,
      timestamp: new Date(),
      toolUseId: toolContent.id,
      plan: toolContent.input?.plan as string | undefined
    };
  }

  /**
   * Format tool usage for display
   */
  private formatToolCommand(toolContent: ClaudeContent): string {
    const toolName = toolContent.name || 'unknown';
    const args = toolContent.input;

    if (!args || Object.keys(args).length === 0) {
      return `${toolName}()`;
    }

    // Format common tool patterns
    switch (toolName) {
      case 'Read':
        return `Read: ${args.file_path || 'unknown file'}`;
      
      case 'Edit':
        return `Edit: ${args.file_path || 'unknown file'}`;
      
      case 'Write':
        return `Write: ${args.file_path || 'unknown file'}`;

      case 'MultiEdit':
        return `MultiEdit: ${args.file_path || 'unknown file'}`;

      case 'replacefile':
        return `Replace: ${args.file_path || args.path || 'unknown file'}`;
      
      case 'Bash':
        return `$ ${args.command || 'unknown command'}`;
      
      case 'LS':
        return `ls ${args.path || '.'}`;
      
      case 'Grep':
        return `grep "${args.pattern}" ${args.path || '.'}`;
      
      case 'exit_plan_mode':
        return `Execute exit_plan_mode`;
      
      default:
        // Generic formatting
        const argStr = Object.entries(args)
          .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
          .join(', ');
        return `${toolName}(${argStr})`;
    }
  }


  /**
   * Clear internal buffer (useful for cleanup)
   */
  clearBuffer(): void {
    this.buffer = '';
  }

  /**
   * Get current buffer state (for debugging)
   */
  getBufferState(): string {
    return this.buffer;
  }
}