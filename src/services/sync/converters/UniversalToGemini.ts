/**
 * UniversalToGemini Converter - Core Integration
 * Converts Universal Message Format to gemini-cli-core conversation format
 * Compatible with core Turn system and conversation history
 */

import { 
  UniversalMessage, 
  UniversalContentPart,
  GeminiMessage, 
  GeminiPart,
  ConversionResult 
} from '../types.js';
import { ProviderType } from '../../../abstractions/providers/types.js';

export class UniversalToGemini {
  /**
   * Convert Universal Message Format array to Gemini checkpoint format
   */
  static convert(universalMessages: UniversalMessage[]): ConversionResult<GeminiMessage[]> {
    try {
      if (!Array.isArray(universalMessages)) {
        return {
          success: false,
          error: 'Input must be an array of Universal messages'
        };
      }

      const geminiMessages: GeminiMessage[] = [];
      
      // Group messages that should be combined into single Gemini messages
      const messageGroups = this.groupMessages(universalMessages);
      
      for (const group of messageGroups) {
        const converted = this.convertMessageGroup(group);
        
        if (!converted.success) {
          return {
            success: false,
            error: converted.error
          };
        }
        
        if (converted.data) {
          geminiMessages.push(converted.data);
        }
      }

      return {
        success: true,
        data: geminiMessages
      };
    } catch (error) {
      return {
        success: false,
        error: `Conversion failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Group Universal messages that should be combined into single Gemini messages
   * This handles cases where multiple tool calls were split during Gemini->Universal conversion
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
      const shouldGroup = this.shouldGroupWithPrevious(msg, currentGroup, universalMessages[i - 1]);
      
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
   * Determine if a message should be grouped with the previous message(s)
   */
  private static shouldGroupWithPrevious(
    currentMsg: UniversalMessage,
    currentGroup: UniversalMessage[],
    previousMsg?: UniversalMessage
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
    
    
    // Only group if explicitly marked as multi-tool parts during original conversion
    const wasMultiToolPart = currentMsg.metadata.extra?.isMultiToolPart;
    if (wasMultiToolPart && previousMsg) {
      const prevWasMultiToolPart = previousMsg.metadata.extra?.isMultiToolPart;
      if (prevWasMultiToolPart === true) {
        // Additional check: must be close in time (within 1 second for multi-tool)
        const currentTime = new Date(currentMsg.timestamp).getTime();
        const groupTime = new Date(firstInGroup.timestamp).getTime();
        const timeDiff = Math.abs(currentTime - groupTime);
        
        return timeDiff <= 1000; // 1 second for multi-tool parts
      }
    }
    
    return false;
  }



  /**
   * Convert a group of Universal messages to a single Gemini message
   */
  private static convertMessageGroup(group: UniversalMessage[]): ConversionResult<GeminiMessage> {
    try {
      if (group.length === 0) {
        return {
          success: false,
          error: 'Cannot convert empty message group'
        };
      }

      const firstMsg = group[0];
      const role = firstMsg.role === 'assistant' ? 'model' : 'user';
      const parts: GeminiPart[] = [];

      // Convert each message in the group to Gemini parts with deduplication
      for (const msg of group) {
        if (msg.role !== firstMsg.role) {
          return {
            success: false,
            error: 'All messages in group must have same role'
          };
        }

        const messageParts = this.convertUniversalToGeminiParts(msg);
        if (!messageParts.success) {
          return {
            success: false,
            error: messageParts.error
          };
        }

        if (messageParts.data) {
          // Add parts
          parts.push(...messageParts.data);
        }
      }

      // Validate that we have at least one part
      if (parts.length === 0) {
        return {
          success: false,
          error: 'Converted message has no parts'
        };
      }

      const geminiMessage: GeminiMessage = {
        role,
        parts
      };

      return {
        success: true,
        data: geminiMessage
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert message group: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Convert a Universal message to Gemini parts
   */
  private static convertUniversalToGeminiParts(msg: UniversalMessage): ConversionResult<GeminiPart[]> {
    try {
      const parts: GeminiPart[] = [];

      // Handle different content types
      if (msg.content.text) {
        // Simple text message
        parts.push({
          text: this.extractTextValue(msg.content.text)
        });
      } else if (msg.content.toolCall) {
        // Tool call message
        parts.push({
          functionCall: {
            name: msg.content.toolCall.name,
            args: msg.content.toolCall.args
          }
        });
      } else if (msg.content.toolResult) {
        // Tool result message
        parts.push({
          functionResponse: {
            id: msg.content.toolResult.id,
            name: msg.content.toolResult.name,
            response: {
              output: this.formatToolResult(msg.content.toolResult.result)
            }
          }
        });
      } else if (msg.content.parts) {
        // Complex message with multiple parts
        for (const part of msg.content.parts) {
          const convertedPart = this.convertUniversalPartToGeminiPart(part);
          if (convertedPart) {
            parts.push(convertedPart);
          }
        }
      } else {
        // Fallback: create text part from message type
        parts.push({
          text: `[${msg.type} message]`
        });
      }

      return {
        success: true,
        data: parts
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert Universal message to Gemini parts: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Convert a Universal content part to Gemini part
   */
  private static convertUniversalPartToGeminiPart(part: UniversalContentPart | unknown): GeminiPart | null {
    const typedPart = part as UniversalContentPart;
    if (typedPart.type === 'text' && typedPart.text) {
      return {
        text: this.extractTextValue(typedPart.text)
      };
    }
    
    if (typedPart.type === 'tool_use' && typedPart.toolCall) {
      return {
        functionCall: {
          name: typedPart.toolCall.name,
          args: typedPart.toolCall.args || {}
        }
      };
    }
    
    if (typedPart.type === 'tool_result' && typedPart.toolResult) {
      return {
        functionResponse: {
          id: typedPart.toolResult.id,
          name: typedPart.toolResult.name,
          response: {
            output: this.formatToolResult(typedPart.toolResult.result)
          }
        }
      };
    }
    
    // Unknown part type - convert to text
    return {
      text: JSON.stringify(part)
    };
  }

  /**
   * Format tool result for Gemini format
   */
  private static formatToolResult(result: unknown): string {
    if (typeof result === 'string') {
      return result;
    }
    
    if (typeof result === 'object' && result !== null) {
      const typedResult = result as any;
      // If it's an object with an 'output' property, use that
      if (typedResult.output !== undefined) {
        return String(typedResult.output);
      }
      
      // Otherwise stringify the entire object
      return JSON.stringify(result, null, 2);
    }
    
    return String(result);
  }

  /**
   * Extract text value from potentially nested text objects
   * Handles cases where text might be { text: "value" } or { text: { text: "value" } }
   */
  private static extractTextValue(textValue: unknown): string {
    if (typeof textValue === 'string') {
      return textValue;
    }
    
    // Handle nested text structure: { text: "actual content" }
    if (textValue && typeof textValue === 'object' && 'text' in textValue) {
      const nestedText = (textValue as any).text;
      // Recursively extract in case of multiple levels of nesting
      return this.extractTextValue(nestedText);
    }
    
    // Fallback: convert to string
    return String(textValue || '');
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
    
    if (typedMsg.parentId !== null && typeof typedMsg.parentId !== 'string') {
      return 'Message parentId must be string or null';
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
    
    if (!typedMsg.type || !['message', 'tool_use', 'tool_result'].includes(typedMsg.type)) {
      return 'Message must have type "message", "tool_use", or "tool_result"';
    }
    
    if (!typedMsg.content || typeof typedMsg.content !== 'object') {
      return 'Message must have content object';
    }
    
    if (!typedMsg.metadata || typeof typedMsg.metadata !== 'object') {
      return 'Message must have metadata object';
    }
    
    if (!typedMsg.metadata.provider || ![ProviderType.GEMINI, ProviderType.CLAUDE].includes(typedMsg.metadata.provider)) {
      return 'Message metadata must have provider "gemini" or "claude"';
    }
    
    return null;
  }
}