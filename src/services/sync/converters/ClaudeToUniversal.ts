/**
 * ClaudeToUniversal Converter
 * Converts Claude JSONL session format to Universal Message Format
 */

import { 
  ClaudeMessage, 
  UniversalMessage, 
  ConversionResult, 
  UniversalContent,
  UniversalContentPart 
} from '../types.js';
import { ILoggerService } from '../../../interfaces/core/ILoggerService.js';
import { v4 as uuidv4 } from 'uuid';
import { ProviderType } from '../../../abstractions/providers/types.js';

export class ClaudeToUniversal {
  /**
   * Convert Claude JSONL session content to Universal Message Format array
   */
  static convert(
    claudeJSONL: string, 
    universalSessionId: string,
    logger?: ILoggerService
  ): ConversionResult<UniversalMessage[]> {
    try {
      if (typeof claudeJSONL !== 'string') {
        return {
          success: false,
          error: 'Input must be a JSONL string'
        };
      }

      // Parse JSONL (each line is a separate JSON object)
      const lines = claudeJSONL.trim().split('\n').filter(line => line.trim());
      const claudeMessages: ClaudeMessage[] = [];

      // Parse each line as JSON
      for (let i = 0; i < lines.length; i++) {
        try {
          const parsed = JSON.parse(lines[i]);
          
          // Skip summary entries and other non-message types
          if (this.shouldSkipEntry(parsed)) {
            if (logger) {
              logger.debug(`[ClaudeToUniversal] Skipping non-message entry at line ${i + 1}: ${this.getEntryDescription(parsed)}`);
            }
            continue;
          }
          
          // Validate and add to messages array
          const validationError = this.validateClaudeMessage(parsed);
          if (validationError) {
            return {
              success: false,
              error: `Line ${i + 1}: ${validationError}`
            };
          }
          
          claudeMessages.push(parsed);
        } catch (parseError) {
          return {
            success: false,
            error: `Line ${i + 1}: Invalid JSON - ${parseError instanceof Error ? parseError.message : String(parseError)}`
          };
        }
      }

      // Convert each Claude message to Universal format
      const universalMessages: UniversalMessage[] = [];
      const parentMap = new Map<string, string>(); // Claude UUID -> Universal ID mapping
      const toolNameMap = new Map<string, string>(); // Tool Use ID -> Tool Name mapping

      for (let i = 0; i < claudeMessages.length; i++) {
        const claudeMsg = claudeMessages[i];
        
        const converted = this.convertSingleMessage(claudeMsg, universalSessionId, parentMap, toolNameMap);
        
        if (!converted.success) {
          return {
            success: false,
            error: `Message ${i}: ${converted.error}`
          };
        }
        
        if (converted.data) {
          // Handle multiple messages from single Claude message (tool use + tool result)
          const messages = Array.isArray(converted.data) ? converted.data : [converted.data];
          
          for (const msg of messages) {
            universalMessages.push(msg);
            // Update parent mapping
            parentMap.set(claudeMsg.uuid, msg.id);
          }
        }
      }

      return {
        success: true,
        data: universalMessages
      };
    } catch (error) {
      return {
        success: false,
        error: `Conversion failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Convert a single Claude message to Universal format
   */
  private static convertSingleMessage(
    claudeMsg: ClaudeMessage,
    universalSessionId: string,
    parentMap: Map<string, string>,
    toolNameMap: Map<string, string>
  ): ConversionResult<UniversalMessage | UniversalMessage[]> {
    try {
      const role = claudeMsg.type === 'assistant' ? 'assistant' : 'user';
      
      // Determine parent ID from Claude's parentUuid
      let parentId: string | null = null;
      if (claudeMsg.parentUuid && parentMap.has(claudeMsg.parentUuid)) {
        parentId = parentMap.get(claudeMsg.parentUuid)!;
      }

      // Handle different message content types
      const messageContent = claudeMsg.message;
      
      // Check if this is a tool-related message
      if (Array.isArray(messageContent.content)) {
        const toolUseContent = messageContent.content.find(c => c.type === 'tool_use');
        const toolResultContent = messageContent.content.find(c => c.type === 'tool_result');
        
        if (toolUseContent) {
          return this.convertToolUseMessage(claudeMsg, universalSessionId, parentId, toolNameMap);
        }
        
        if (toolResultContent) {
          return this.convertToolResultMessage(claudeMsg, universalSessionId, parentId, toolNameMap);
        }
      }

      // Regular message conversion
      const universalMsg: UniversalMessage = {
        id: uuidv4(),
        parentId,
        sessionId: universalSessionId,
        timestamp: claudeMsg.timestamp,
        role,
        type: 'message',
        content: this.convertClaudeContent(messageContent),
        metadata: {
          provider: ProviderType.CLAUDE,
          originalId: claudeMsg.uuid,
          cwd: claudeMsg.cwd,
          version: claudeMsg.version,
          usage: this.extractUsageInfo(messageContent),
          extra: {
            isSidechain: claudeMsg.isSidechain,
            userType: claudeMsg.userType,
            requestId: claudeMsg.requestId,
            messageId: messageContent.id,
            model: messageContent.model,
            stopReason: messageContent.stop_reason,
            stopSequence: messageContent.stop_sequence
          }
        }
      };

      return {
        success: true,
        data: universalMsg
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert Claude message: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Convert Claude tool use message to Universal format
   */
  private static convertToolUseMessage(
    claudeMsg: ClaudeMessage,
    universalSessionId: string,
    parentId: string | null,
    toolNameMap: Map<string, string>
  ): ConversionResult<UniversalMessage[]> {
    try {
      const messages: UniversalMessage[] = [];
      const messageContent = claudeMsg.message;
      
      if (!Array.isArray(messageContent.content)) {
        return {
          success: false,
          error: 'Tool use message must have content array'
        };
      }

      // Find all tool use content parts
      const toolUseParts = messageContent.content.filter(c => c.type === 'tool_use');
      const textParts = messageContent.content.filter(c => c.type === 'text');
      
      let currentParentId = parentId;

      // Create text message if there are text parts
      if (textParts.length > 0) {
        const textMsg: UniversalMessage = {
          id: uuidv4(),
          parentId: currentParentId,
          sessionId: universalSessionId,
          timestamp: claudeMsg.timestamp,
          role: 'assistant',
          type: 'message',
          content: {
            parts: textParts.map(part => ({
              type: 'text' as const,
              text: this.extractTextContent(part.text)
            }))
          },
          metadata: {
            provider: ProviderType.CLAUDE,
            originalId: claudeMsg.uuid,
            cwd: claudeMsg.cwd,
            version: claudeMsg.version,
            usage: this.extractUsageInfo(messageContent),
            extra: {
              hasToolUse: true,
              toolUseCount: toolUseParts.length
            }
          }
        };
        messages.push(textMsg);
        currentParentId = textMsg.id;
      }

      // Create separate message for each tool use
      for (const toolPart of toolUseParts) {
        // Store tool name mapping for later tool result matching
        if (toolPart.id && toolPart.name) {
          toolNameMap.set(toolPart.id, toolPart.name);
        }

        const toolMsg: UniversalMessage = {
          id: uuidv4(),
          parentId: currentParentId,
          sessionId: universalSessionId,
          timestamp: claudeMsg.timestamp,
          role: 'assistant',
          type: 'tool_use',
          content: {
            toolCall: {
              id: toolPart.id,
              name: toolPart.name!,
              args: toolPart.input || {}
            }
          },
          metadata: {
            provider: ProviderType.CLAUDE,
            originalId: claudeMsg.uuid,
            cwd: claudeMsg.cwd,
            version: claudeMsg.version,
            extra: {
              toolUseId: toolPart.id
            }
          }
        };
        messages.push(toolMsg);
        currentParentId = toolMsg.id;
      }

      return {
        success: true,
        data: messages
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert tool use message: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Convert Claude tool result message to Universal format
   */
  private static convertToolResultMessage(
    claudeMsg: ClaudeMessage,
    universalSessionId: string,
    parentId: string | null,
    toolNameMap: Map<string, string>
  ): ConversionResult<UniversalMessage> {
    try {
      const messageContent = claudeMsg.message;
      
      if (!Array.isArray(messageContent.content)) {
        return {
          success: false,
          error: 'Tool result message must have content array'
        };
      }

      const toolResultPart = messageContent.content.find(c => c.type === 'tool_result');
      if (!toolResultPart) {
        return {
          success: false,
          error: 'No tool result found in message content'
        };
      }

      // Get tool name from mapping or fallback to 'unknown'
      const toolName = toolNameMap.get(toolResultPart.tool_use_id!) || 'unknown';

      const universalMsg: UniversalMessage = {
        id: uuidv4(),
        parentId,
        sessionId: universalSessionId,
        timestamp: claudeMsg.timestamp,
        role: 'user',
        type: 'tool_result',
        content: {
          toolResult: {
            id: toolResultPart.tool_use_id!,
            name: toolName,
            result: toolResultPart.content || '',
            isError: toolResultPart.is_error || false
          }
        },
        metadata: {
          provider: ProviderType.CLAUDE,
          originalId: claudeMsg.uuid,
          cwd: claudeMsg.cwd,
          version: claudeMsg.version,
          extra: {
            toolUseId: toolResultPart.tool_use_id,
            toolUseResult: claudeMsg.toolUseResult
          }
        }
      };

      return {
        success: true,
        data: universalMsg
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert tool result message: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Safely extract text content from potentially nested text objects
   */
  private static extractTextContent(textValue: unknown): string {
    if (typeof textValue === 'string') {
      return textValue;
    }
    
    // Handle double-nested text structure: { text: { text: "actual content" } }
    if (textValue && typeof textValue === 'object' && 'text' in textValue) {
      const nestedText = (textValue as any).text;
      if (typeof nestedText === 'string') {
        return nestedText;
      }
      // Handle triple nesting or further if needed
      if (nestedText && typeof nestedText === 'object' && 'text' in nestedText) {
        return String((nestedText as any).text || '');
      }
    }
    
    // Fallback to string conversion
    return String(textValue || '');
  }

  /**
   * Convert Claude message content to Universal content format
   */
  private static convertClaudeContent(messageContent: unknown): UniversalContent {
    const content = messageContent as any;
    // Handle simple string content
    if (typeof content.content === 'string') {
      return {
        text: content.content
      };
    }

    // Handle structured content array
    if (Array.isArray(content.content)) {
      // If it's just one text part, simplify it
      if (content.content.length === 1 && content.content[0].type === 'text') {
        return {
          text: this.extractTextContent(content.content[0].text)
        };
      }

      // Convert content parts
      const parts: UniversalContentPart[] = content.content.map((part: unknown) => {
        const typedPart = part as any;
        if (typedPart.type === 'text') {
          return {
            type: 'text' as const,
            text: this.extractTextContent(typedPart.text)
          };
        }
        
        if (typedPart.type === 'tool_use') {
          return {
            type: 'tool_use' as const,
            toolCall: {
              id: typedPart.id,
              name: typedPart.name,
              args: typedPart.input || {}
            }
          };
        }
        
        if (typedPart.type === 'tool_result') {
          return {
            type: 'tool_result' as const,
            toolResult: {
              id: typedPart.tool_use_id,
              name: 'unknown', // Note: This is in content conversion - tool name mapping not available here
              result: typedPart.content || '',
              isError: typedPart.is_error || false
            }
          };
        }
        
        // Unknown content type - try to extract text
        return {
          type: 'text' as const,
          text: typeof typedPart === 'string' ? typedPart : (typedPart.text || typedPart.content || JSON.stringify(typedPart))
        };
      });

      return { parts };
    }

    // Fallback for unknown content structure
    if (typeof content.content === 'string') {
      return { text: content.content };
    }
    
    // Try to extract text from object
    if (content.content && typeof content.content === 'object') {
      if (content.content.text) {
        return { text: content.content.text };
      }
      if (content.content.content) {
        return { text: content.content.content };
      }
    }
    
    // Last resort - stringify
    return {
      text: JSON.stringify(content.content)
    };
  }

  /**
   * Extract usage information from Claude message
   */
  private static extractUsageInfo(messageContent: Record<string, unknown> | unknown) {
    const content = messageContent as any;
    if (content.usage) {
      return {
        inputTokens: content.usage.input_tokens,
        outputTokens: content.usage.output_tokens,
        cacheCreationInputTokens: content.usage.cache_creation_input_tokens,
        cacheReadInputTokens: content.usage.cache_read_input_tokens,
        serviceTier: content.usage.service_tier
      };
    }
    return undefined;
  }

  /**
   * Validate Claude message structure
   */
  private static validateClaudeMessage(msg: unknown): string | null {
    if (!msg || typeof msg !== 'object') {
      return 'Message must be an object';
    }
    
    const typedMsg = msg as any;
    
    if (typedMsg.parentUuid !== null && typeof typedMsg.parentUuid !== 'string') {
      return 'parentUuid must be string or null';
    }
    
    if (typeof typedMsg.isSidechain !== 'boolean') {
      return 'isSidechain must be boolean';
    }
    
    if (!typedMsg.userType || typeof typedMsg.userType !== 'string') {
      return 'userType must be string';
    }
    
    if (!typedMsg.cwd || typeof typedMsg.cwd !== 'string') {
      return 'cwd must be string';
    }
    
    if (!typedMsg.sessionId || typeof typedMsg.sessionId !== 'string') {
      return 'sessionId must be string';
    }
    
    if (!typedMsg.version || typeof typedMsg.version !== 'string') {
      return 'version must be string';
    }
    
    if (!typedMsg.type || (typedMsg.type !== 'user' && typedMsg.type !== 'assistant')) {
      return 'type must be "user" or "assistant"';
    }
    
    if (!typedMsg.message || typeof typedMsg.message !== 'object') {
      return 'message must be object';
    }
    
    if (!typedMsg.uuid || typeof typedMsg.uuid !== 'string') {
      return 'uuid must be string';
    }
    
    if (!typedMsg.timestamp || typeof typedMsg.timestamp !== 'string') {
      return 'timestamp must be string';
    }
    
    // Validate message content
    const messageContent = typedMsg.message;
    if (!messageContent.role || (messageContent.role !== 'user' && messageContent.role !== 'assistant')) {
      return 'message.role must be "user" or "assistant"';
    }
    
    if (messageContent.content === undefined) {
      return 'message.content is required';
    }
    
    return null;
  }

  /**
   * Comprehensive entry skip determination
   * Filters out summary entries and other non-message items
   */

  private static shouldSkipEntry(parsed: Record<string, unknown> | unknown): boolean {
    const entry = parsed as any;
    // 1. Explicit summary type
    if (entry.type === 'summary') {
      return true;
    }

    // 2. Entries with summary field
    if (entry.summary && typeof entry.summary === 'string') {
      return true;
    }

    // 3. Entries with only leafUuid but no actual message
    if (entry.leafUuid && !entry.message && !entry.type) {
      return true;
    }

    // 4. Metadata-only entries
    if (entry.metadata && !entry.message && !entry.type) {
      return true;
    }

    // 5. Session info or config entries
    if (entry.sessionInfo || entry.config || entry.settings) {
      return true;
    }

    // 6. Empty messages or invalid structure
    if (!entry.message && !entry.type && Object.keys(entry).length < 3) {
      return true;
    }

    // 7. Internal system messages
    if (entry.type === 'system' || entry.type === 'internal' || entry.type === 'metadata') {
      return true;
    }

    // 8. Cases with only UUID and no actual content
    if (entry.uuid && Object.keys(entry).length === 1) {
      return true;
    }

    return false;
  }

  /**
   * Generate description for skipped entries (for logging)
   */

  private static getEntryDescription(parsed: Record<string, unknown> | unknown): string {
    const entry = parsed as any;
    if (entry.type === 'summary') {
      return `summary type (${entry.summary ? entry.summary.substring(0, 50) + '...' : 'no content'})`;
    }

    if (entry.summary) {
      return `summary field (${entry.summary.substring(0, 50)}...)`;
    }

    if (entry.leafUuid && !entry.message) {
      return `leaf UUID only (${entry.leafUuid})`;
    }

    if (entry.metadata && !entry.message) {
      return `metadata only`;
    }

    if (entry.sessionInfo || entry.config || entry.settings) {
      return `system configuration`;
    }

    if (entry.type === 'system' || entry.type === 'internal' || entry.type === 'metadata') {
      return `internal type (${entry.type})`;
    }

    if (entry.uuid && Object.keys(entry).length === 1) {
      return `UUID only (${entry.uuid})`;
    }

    return `unrecognized structure (${Object.keys(entry).join(', ')})`;
  }
}