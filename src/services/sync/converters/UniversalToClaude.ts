/**
 * UniversalToClaude Converter
 * Converts Universal Message Format to Claude JSONL session format
 */

import { 
  UniversalMessage, 
  UniversalContent,
  ClaudeMessage, 
  ClaudeContentPart,
  ConversionResult 
} from '../types.js';
import { v4 as uuidv4 } from 'uuid';
import { ModelConfigManager, ProviderType } from '../../../abstractions/providers/index.js';

export class UniversalToClaude {
  /**
   * Convert Universal Message Format array to Claude JSONL string
   */
  static convert(
    universalMessages: UniversalMessage[],
    claudeSessionId: string,
    cwd: string = process.cwd(),
    version: string = '1.0.33'
  ): ConversionResult<string> {
    try {
      if (!Array.isArray(universalMessages)) {
        return {
          success: false,
          error: 'Input must be an array of Universal messages'
        };
      }

      const claudeMessages: ClaudeMessage[] = [];
      const universalToClaudeMap = new Map<string, string>(); // Universal ID -> Claude UUID mapping
      
      // Group messages that should be combined into single Claude messages
      const messageGroups = this.groupMessages(universalMessages);

      for (const group of messageGroups) {
        const converted = this.convertMessageGroup(
          group, 
          claudeSessionId, 
          cwd, 
          version, 
          universalToClaudeMap
        );
        
        if (!converted.success) {
          return {
            success: false,
            error: converted.error
          };
        }
        
        if (converted.data) {
          const messages = Array.isArray(converted.data) ? converted.data : [converted.data];
          for (const msg of messages) {
            claudeMessages.push(msg);
            // Update mapping for parent resolution
            for (const universalMsg of group) {
              universalToClaudeMap.set(universalMsg.id, msg.uuid);
            }
          }
        }
      }

      // Convert to JSONL format (one JSON object per line)
      const jsonlLines = claudeMessages.map(msg => JSON.stringify(msg));
      const jsonlString = jsonlLines.join('\n');

      return {
        success: true,
        data: jsonlString
      };
    } catch (error) {
      return {
        success: false,
        error: `Conversion failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Group Universal messages that should be combined into single Claude messages
   * This handles cases where tool use/result pairs should be in the same Claude message
   */
  private static groupMessages(universalMessages: UniversalMessage[]): UniversalMessage[][] {
    const groups: UniversalMessage[][] = [];
    let currentGroup: UniversalMessage[] = [];
    
    for (let i = 0; i < universalMessages.length; i++) {
      const msg = universalMessages[i];
      
      // Validate Universal message
      const validationError = this.validateUniversalMessage(msg);
      if (validationError) {
        throw new Error(`Message ${i}: ${validationError}`);
      }
      
      // Check if this message should be grouped with previous ones
      const shouldGroup = this.shouldGroupWithPrevious(msg, currentGroup);
      
      if (!shouldGroup && currentGroup.length > 0) {
        // Start new group
        groups.push([...currentGroup]);
        currentGroup = [msg];
      } else {
        // Add to current group
        currentGroup.push(msg);
      }
    }
    
    // Add final group
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  }

  /**
   * Determine if a message should be grouped with previous message(s)
   */
  private static shouldGroupWithPrevious(
    currentMsg: UniversalMessage,
    currentGroup: UniversalMessage[]
  ): boolean {
    if (currentGroup.length === 0) {
      return true; // First message always starts a group
    }
    
    const firstInGroup = currentGroup[0];
    
    // Don't group messages with different roles
    if (currentMsg.role !== firstInGroup.role) {
      return false;
    }
    
    // Don't group messages from different providers
    if (currentMsg.metadata.provider !== firstInGroup.metadata.provider) {
      return false;
    }
    
    
    // Only group assistant messages that are tool use + text content and are very close in time
    if (currentMsg.role === 'assistant' && firstInGroup.role === 'assistant') {
      // Check if they're close in time (within 500ms) and same provider
      const currentTime = new Date(currentMsg.timestamp).getTime();
      const groupTime = new Date(firstInGroup.timestamp).getTime();
      const timeDiff = Math.abs(currentTime - groupTime);
      
      // Much stricter timing requirement to prevent incorrect grouping
      if (timeDiff <= 500) {
        // Only group if one is tool use and other is text, not both text
        const currentIsToolUse = currentMsg.type === 'tool_use';
        const firstIsToolUse = firstInGroup.type === 'tool_use';
        
        if (currentIsToolUse !== firstIsToolUse) {
          return true;
        }
      }
    }
    
    return false;
  }


  /**
   * Convert a group of Universal messages to Claude message(s)
   */
  private static convertMessageGroup(
    group: UniversalMessage[],
    claudeSessionId: string,
    cwd: string,
    version: string,
    universalToClaudeMap: Map<string, string>
  ): ConversionResult<ClaudeMessage | ClaudeMessage[]> {
    try {
      if (group.length === 0) {
        return {
          success: false,
          error: 'Cannot convert empty message group'
        };
      }

      // Check if this is a tool use/result pair that needs special handling
      const hasToolUse = group.some(msg => msg.type === 'tool_use');
      const hasToolResult = group.some(msg => msg.type === 'tool_result');
      
      if (hasToolUse || hasToolResult) {
        return this.convertToolMessages(group, claudeSessionId, cwd, version, universalToClaudeMap);
      }

      // Regular message conversion
      if (group.length === 1) {
        return this.convertSingleMessage(group[0], claudeSessionId, cwd, version, universalToClaudeMap);
      }

      // Multiple regular messages - combine into one Claude message
      return this.convertCombinedMessage(group, claudeSessionId, cwd, version, universalToClaudeMap);
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert message group: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Convert tool-related messages (special handling for tool use/result pairs)
   */
  private static convertToolMessages(
    group: UniversalMessage[],
    claudeSessionId: string,
    cwd: string,
    version: string,
    universalToClaudeMap: Map<string, string>
  ): ConversionResult<ClaudeMessage[]> {
    const claudeMessages: ClaudeMessage[] = [];
    
    // Separate tool use and tool result messages
    const toolUseMessages = group.filter(msg => msg.type === 'tool_use');
    const toolResultMessages = group.filter(msg => msg.type === 'tool_result');
    const regularMessages = group.filter(msg => msg.type === 'message');
    
    // Create assistant message with tool use
    if (toolUseMessages.length > 0 || regularMessages.some(msg => msg.role === 'assistant')) {
      const assistantContent: ClaudeContentPart[] = [];
      
      // Add text content from regular messages
      for (const msg of regularMessages) {
        if (msg.role === 'assistant') {
          if (msg.content.text) {
            assistantContent.push({
              type: 'text',
              text: msg.content.text
            });
          } else if (msg.content.parts) {
            for (const part of msg.content.parts) {
              if (part.type === 'text' && part.text) {
                assistantContent.push({
                  type: 'text',
                  text: part.text
                });
              }
            }
          }
        }
      }
      
      // Add tool use content
      for (const msg of toolUseMessages) {
        if (msg.content.toolCall) {
          assistantContent.push({
            type: 'tool_use',
            id: msg.content.toolCall.id || uuidv4(),
            name: msg.content.toolCall.name,
            input: msg.content.toolCall.args
          });
        }
      }
      
      if (assistantContent.length > 0) {
        const assistantMsg = this.createClaudeMessage(
          'assistant',
          assistantContent,
          group[0],
          claudeSessionId,
          cwd,
          version,
          universalToClaudeMap
        );
        claudeMessages.push(assistantMsg);
      }
    }
    
    // Create user message(s) with tool results
    for (const msg of toolResultMessages) {
      if (msg.content.toolResult) {
        const toolResultContent: ClaudeContentPart[] = [{
          type: 'tool_result',
          tool_use_id: msg.content.toolResult.id,
          content: this.formatToolResultContent(msg.content.toolResult.result),
          is_error: msg.content.toolResult.isError || false
        }];
        
        const userMsg = this.createClaudeMessage(
          'user',
          toolResultContent,
          msg,
          claudeSessionId,
          cwd,
          version,
          universalToClaudeMap,
          msg.metadata.extra?.toolUseResult
        );
        claudeMessages.push(userMsg);
      }
    }
    
    return {
      success: true,
      data: claudeMessages
    };
  }

  /**
   * Convert a single Universal message to Claude format
   */
  private static convertSingleMessage(
    universalMsg: UniversalMessage,
    claudeSessionId: string,
    cwd: string,
    version: string,
    universalToClaudeMap: Map<string, string>
  ): ConversionResult<ClaudeMessage> {
    try {
      const content = this.convertUniversalContent(universalMsg.content);
      
      const claudeMsg = this.createClaudeMessage(
        universalMsg.role === 'assistant' ? 'assistant' : 'user',
        content,
        universalMsg,
        claudeSessionId,
        cwd,
        version,
        universalToClaudeMap
      );

      return {
        success: true,
        data: claudeMsg
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert single message: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Convert multiple Universal messages into a single Claude message
   */
  private static convertCombinedMessage(
    group: UniversalMessage[],
    claudeSessionId: string,
    cwd: string,
    version: string,
    universalToClaudeMap: Map<string, string>
  ): ConversionResult<ClaudeMessage> {
    try {
      const firstMsg = group[0];
      const combinedContent: ClaudeContentPart[] = [];
      
      // Combine content from all messages in group with deduplication
      for (const msg of group) {
        if (msg.role !== firstMsg.role) {
          return {
            success: false,
            error: 'All messages in combined group must have same role'
          };
        }
        
        const content = this.convertUniversalContent(msg.content);
        
        // Add content parts
        combinedContent.push(...content);
      }
      
      const claudeMsg = this.createClaudeMessage(
        firstMsg.role === 'assistant' ? 'assistant' : 'user',
        combinedContent,
        firstMsg,
        claudeSessionId,
        cwd,
        version,
        universalToClaudeMap
      );

      return {
        success: true,
        data: claudeMsg
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert combined message: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }


  /**
   * Convert Universal content to Claude content parts
   */
  private static convertUniversalContent(content: UniversalContent | unknown): ClaudeContentPart[] {
    const parts: ClaudeContentPart[] = [];
    const typedContent = content as UniversalContent;
    
    if (typedContent.text) {
      parts.push({
        type: 'text',
        text: typedContent.text
      });
    } else if (typedContent.toolCall) {
      parts.push({
        type: 'tool_use',
        id: typedContent.toolCall.id || uuidv4(),
        name: typedContent.toolCall.name,
        input: typedContent.toolCall.args
      });
    } else if (typedContent.toolResult) {
      parts.push({
        type: 'tool_result',
        tool_use_id: typedContent.toolResult.id,
        content: this.formatToolResultContent(typedContent.toolResult.result),
        is_error: typedContent.toolResult.isError || false
      });
    } else if (typedContent.parts) {
      for (const part of typedContent.parts) {
        if (part.type === 'text' && part.text) {
          parts.push({
            type: 'text',
            text: part.text
          });
        } else if (part.type === 'tool_use' && part.toolCall) {
          parts.push({
            type: 'tool_use',
            id: part.toolCall.id || uuidv4(),
            name: part.toolCall.name,
            input: part.toolCall.args
          });
        } else if (part.type === 'tool_result' && part.toolResult) {
          parts.push({
            type: 'tool_result',
            tool_use_id: part.toolResult.id,
            content: this.formatToolResultContent(part.toolResult.result),
            is_error: part.toolResult.isError || false
          });
        }
      }
    }
    
    // Fallback: create text part if no content was converted
    if (parts.length === 0) {
      parts.push({
        type: 'text',
        text: JSON.stringify(content)
      });
    }
    
    return parts;
  }

  /**
   * Create a Claude message with proper structure
   */
  private static createClaudeMessage(
    type: 'user' | 'assistant',
    content: ClaudeContentPart[],
    universalMsg: UniversalMessage,
    claudeSessionId: string,
    cwd: string,
    version: string,
    universalToClaudeMap: Map<string, string>,
    toolUseResult?: unknown
  ): ClaudeMessage {
    // Determine parent UUID
    let parentUuid: string | null = null;
    if (universalMsg.parentId && universalToClaudeMap.has(universalMsg.parentId)) {
      parentUuid = universalToClaudeMap.get(universalMsg.parentId)!;
    }

    const claudeUuid = uuidv4();
    
    // Create message content based on type
    let messageContent: any;
    
    if (type === 'user') {
      if (content.length === 1 && content[0].type === 'text') {
        // Simple text message
        messageContent = {
          role: 'user',
          content: content[0].text
        };
      } else {
        // Complex content
        messageContent = {
          role: 'user',
          content: content
        };
      }
    } else {
      // Assistant message
      messageContent = {
        id: universalMsg.metadata.extra?.messageId || `msg_${uuidv4().replace(/-/g, '')}`,
        type: 'message',
        role: 'assistant',
        model: universalMsg.metadata.extra?.model || new ModelConfigManager().getDefaultModel(ProviderType.CLAUDE),
        content: content,
        stop_reason: universalMsg.metadata.extra?.stopReason || null,
        stop_sequence: universalMsg.metadata.extra?.stopSequence || null,
        usage: this.convertUsageInfo(universalMsg.metadata.usage)
      };
    }

    const claudeMsg: ClaudeMessage = {
      parentUuid: parentUuid,
      isSidechain: Boolean(universalMsg.metadata.extra?.isSidechain) || false,
      userType: String(universalMsg.metadata.extra?.userType || 'external'),
      cwd: universalMsg.metadata.cwd || cwd,
      sessionId: claudeSessionId,
      version: universalMsg.metadata.version || version,
      type: type,
      message: messageContent,
      uuid: claudeUuid,
      timestamp: universalMsg.timestamp
    };

    // Add optional fields
    if (type === 'assistant' && universalMsg.metadata.extra?.requestId) {
      claudeMsg.requestId = String(universalMsg.metadata.extra.requestId);
    }

    if (toolUseResult) {
      claudeMsg.toolUseResult = {
        stdout: String((toolUseResult as any)?.stdout || ''),
        stderr: String((toolUseResult as any)?.stderr || ''),
        interrupted: Boolean((toolUseResult as any)?.interrupted),
        isImage: Boolean((toolUseResult as any)?.isImage)
      };
    }

    return claudeMsg;
  }

  /**
   * Convert Universal usage info to Claude format
   */
  private static convertUsageInfo(usage?: Record<string, unknown>) {
    if (!usage) {
      return {
        input_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        output_tokens: 0,
        service_tier: 'standard'
      };
    }

    return {
      input_tokens: usage.inputTokens || 0,
      cache_creation_input_tokens: usage.cacheCreationInputTokens || 0,
      cache_read_input_tokens: usage.cacheReadInputTokens || 0,
      output_tokens: usage.outputTokens || 0,
      service_tier: usage.serviceTier || 'standard'
    };
  }

  /**
   * Format tool result content for Claude format
   */
  private static formatToolResultContent(result: unknown): string {
    if (typeof result === 'string') {
      return result;
    }
    
    if (typeof result === 'object' && result !== null) {
      return JSON.stringify(result, null, 2);
    }
    
    return String(result);
  }

  /**
   * Validate Universal message structure
   */
  private static validateUniversalMessage(msg: unknown): string | null {
    if (!msg || typeof msg !== 'object') {
      return 'Message must be an object';
    }
    
    const typedMsg = msg as any;
    
    if (!typedMsg.id || typeof typedMsg.id !== 'string') {
      return 'Message must have string id';
    }
    
    if (!typedMsg.sessionId || typeof typedMsg.sessionId !== 'string') {
      return 'Message must have string sessionId';
    }
    
    if (!typedMsg.timestamp || typeof typedMsg.timestamp !== 'string') {
      return 'Message must have string timestamp';
    }
    
    if (!typedMsg.role || (typedMsg.role !== 'user' && typedMsg.role !== 'assistant')) {
      return 'Message must have role "user" or "assistant"';
    }
    
    if (!typedMsg.content || typeof typedMsg.content !== 'object') {
      return 'Message must have content object';
    }
    
    if (!typedMsg.metadata || typeof typedMsg.metadata !== 'object') {
      return 'Message must have metadata object';
    }
    
    return null;
  }
}