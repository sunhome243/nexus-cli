/**
 * GeminiToUniversal Converter - Core Integration
 * Converts gemini-cli-core conversation data to Universal Message Format
 * Compatible with core Turn system and streaming events
 */

import { GeminiMessage, UniversalMessage, ConversionResult, UniversalContent, UniversalContentPart } from "../types.js";
import { ILoggerService } from '../../../interfaces/core/ILoggerService.js';
import { v4 as uuidv4 } from "uuid";
import { ProviderType } from '../../../abstractions/providers/index.js';

export class GeminiToUniversal {
  /**
   * Convert Gemini checkpoint array to Universal Message Format array
   */
  static convert(
    geminiMessages: GeminiMessage[],
    sessionId: string,
    baseTimestamp?: string,
    logger?: ILoggerService
  ): ConversionResult<UniversalMessage[]> {
    try {
      if (!Array.isArray(geminiMessages)) {
        return {
          success: false,
          error: "Input must be an array of Gemini messages",
        };
      }

      const universalMessages: UniversalMessage[] = [];
      const baseTime = baseTimestamp ? new Date(baseTimestamp) : new Date();
      let parentId: string | null = null;

      // Calculate proper timestamps preserving chronological order
      const timestamps = this.calculateChronologicalTimestamps(geminiMessages, baseTime, logger);

      for (let i = 0; i < geminiMessages.length; i++) {
        const geminiMsg = geminiMessages[i];

        // Validate Gemini message structure
        const validationError = this.validateGeminiMessage(geminiMsg);
        if (validationError) {
          return {
            success: false,
            error: `Message ${i}: ${validationError}`,
          };
        }

        // Convert based on message content type using proper timestamp
        const converted = this.convertSingleMessage(
          geminiMsg,
          sessionId,
          parentId,
          timestamps[i]
        );

        if (!converted.success) {
          return {
            success: false,
            error: `Message ${i}: ${converted.error}`,
          };
        }

        if (converted.data) {
          // Handle multiple messages from single Gemini message (e.g., tool calls)
          const messages = Array.isArray(converted.data) ? converted.data : [converted.data];

          for (const msg of messages) {
            msg.parentId = parentId;
            universalMessages.push(msg);
            parentId = msg.id; // Next message will be child of this one
          }
        }
      }

      return {
        success: true,
        data: universalMessages,
      };
    } catch (error) {
      return {
        success: false,
        error: `Conversion failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Convert a single Gemini message to Universal format
   */
  private static convertSingleMessage(
    geminiMsg: GeminiMessage,
    sessionId: string,
    parentId: string | null,
    timestamp: Date
  ): ConversionResult<UniversalMessage | UniversalMessage[]> {
    try {
      const role = geminiMsg.role === "model" ? "assistant" : "user";

      // Check if this is a complex message with multiple tool calls
      const toolCalls = geminiMsg.parts.filter((part) => part.functionCall);
      const toolResponses = geminiMsg.parts.filter((part) => part.functionResponse);
      const textParts = geminiMsg.parts.filter((part) => part.text && !part.functionCall && !part.functionResponse);

      // If message has multiple tool calls, split into separate messages
      if (toolCalls.length > 1) {
        return this.convertMultiToolMessage(geminiMsg, sessionId, parentId, timestamp);
      }

      // Single message conversion
      const universalMsg: UniversalMessage = {
        id: uuidv4(),
        parentId,
        sessionId,
        timestamp: timestamp.toISOString(),
        role,
        type: this.determineMessageType(geminiMsg),
        content: this.convertContent(geminiMsg),
        metadata: {
          provider: ProviderType.GEMINI,
          extra: {
            originalPartsCount: geminiMsg.parts.length,
            hasMultipleParts: geminiMsg.parts.length > 1,
          },
        },
      };

      return {
        success: true,
        data: universalMsg,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to convert message: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Convert Gemini message with multiple tool calls into separate Universal messages
   */
  private static convertMultiToolMessage(
    geminiMsg: GeminiMessage,
    sessionId: string,
    parentId: string | null,
    baseTimestamp: Date
  ): ConversionResult<UniversalMessage[]> {
    const messages: UniversalMessage[] = [];
    let currentParentId = parentId;
    let timeOffset = 0;

    // Create separate message for each tool call
    for (const part of geminiMsg.parts) {
      if (part.functionCall) {
        const toolMsg: UniversalMessage = {
          id: uuidv4(),
          parentId: currentParentId,
          sessionId,
          timestamp: new Date(baseTimestamp.getTime() + timeOffset).toISOString(),
          role: geminiMsg.role === "model" ? "assistant" : "user",
          type: "tool_use",
          content: {
            toolCall: {
              name: part.functionCall.name,
              args: part.functionCall.args || {},
            },
          },
          metadata: {
            provider: ProviderType.GEMINI,
            extra: {
              isMultiToolPart: true,
            },
          },
        };
        messages.push(toolMsg);
        currentParentId = toolMsg.id;
        timeOffset += 100; // 100ms apart
      }
    }

    // Handle any remaining text or function responses
    const remainingParts = geminiMsg.parts.filter((part) => !part.functionCall);
    if (remainingParts.length > 0) {
      const textMsg: UniversalMessage = {
        id: uuidv4(),
        parentId: currentParentId,
        sessionId,
        timestamp: new Date(baseTimestamp.getTime() + timeOffset).toISOString(),
        role: geminiMsg.role === "model" ? "assistant" : "user",
        type: "message",
        content: this.convertPartsToContent(remainingParts),
        metadata: {
          provider: ProviderType.GEMINI,
          extra: {
            isMultiToolPart: true,
            remainingPartsCount: remainingParts.length,
          },
        },
      };
      messages.push(textMsg);
    }

    return {
      success: true,
      data: messages,
    };
  }

  /**
   * Determine the message type based on content
   */
  private static determineMessageType(geminiMsg: GeminiMessage): "message" | "tool_use" | "tool_result" {
    const hasFunctionCall = geminiMsg.parts.some((part) => part.functionCall);
    const hasFunctionResponse = geminiMsg.parts.some((part) => part.functionResponse);

    if (hasFunctionCall) return "tool_use";
    if (hasFunctionResponse) return "tool_result";
    return "message";
  }

  /**
   * Convert Gemini parts to Universal content
   */
  private static convertContent(geminiMsg: GeminiMessage): UniversalContent {
    const parts = geminiMsg.parts;

    // Simple text message
    if (parts.length === 1 && parts[0].text && !parts[0].functionCall && !parts[0].functionResponse) {
      return {
        text: parts[0].text,
      };
    }

    // Single tool call
    if (parts.length === 1 && parts[0].functionCall) {
      return {
        toolCall: {
          name: parts[0].functionCall.name,
          args: parts[0].functionCall.args || {},
        },
      };
    }

    // Single tool response
    if (parts.length === 1 && parts[0].functionResponse) {
      return {
        toolResult: {
          id: parts[0].functionResponse.id,
          name: parts[0].functionResponse.name,
          result: parts[0].functionResponse.response.output,
        },
      };
    }

    // Complex message with multiple parts
    return {
      parts: this.convertPartsToUniversalParts(parts),
    };
  }

  /**
   * Convert Gemini parts to Universal content parts
   */
  private static convertPartsToContent(parts: unknown[]): UniversalContent {
    const typedParts = parts as any[];
    if (typedParts.length === 1 && typedParts[0].text) {
      return { text: typedParts[0].text };
    }

    return {
      parts: this.convertPartsToUniversalParts(parts),
    };
  }

  /**
   * Convert Gemini parts array to Universal content parts array
   */
  private static convertPartsToUniversalParts(parts: unknown[]): UniversalContentPart[] {
    return parts.map((part) => {
      const typedPart = part as any;
      if (typedPart.text && !typedPart.functionCall && !typedPart.functionResponse) {
        return {
          type: "text" as const,
          text: typedPart.text,
        };
      }

      if (typedPart.functionCall) {
        return {
          type: "tool_use" as const,
          toolCall: {
            name: typedPart.functionCall.name,
            args: typedPart.functionCall.args || {},
          },
        };
      }

      if (typedPart.functionResponse) {
        return {
          type: "tool_result" as const,
          toolResult: {
            id: typedPart.functionResponse.id,
            name: typedPart.functionResponse.name,
            result: typedPart.functionResponse.response.output,
          },
        };
      }

      // Fallback for unknown part types
      return {
        type: "text" as const,
        text: JSON.stringify(typedPart),
      };
    });
  }

  /**
   * Calculate chronological timestamps for Gemini messages
   * Preserves conversation flow with reasonable intervals
   */
  private static calculateChronologicalTimestamps(
    geminiMessages: GeminiMessage[],
    baseTime: Date,
    logger?: ILoggerService
  ): Date[] {
    const timestamps: Date[] = [];
    let currentTime = baseTime;

    for (let i = 0; i < geminiMessages.length; i++) {
      const message = geminiMessages[i];
      
      // Calculate interval based on message type and content
      let interval = 1000; // Default 1 second
      
      if (message.role === 'user') {
        // User messages: shorter interval (immediate responses)
        interval = i === 0 ? 0 : 2000; // 2 seconds between user inputs
      } else if (message.role === 'model') {
        // Model messages: longer interval (thinking time)
        const hasComplexContent = message.parts.some(part => 
          part.functionCall || part.functionResponse || 
          (part.text && part.text.length > 100)
        );
        interval = hasComplexContent ? 5000 : 3000; // 3-5 seconds for model responses
      }
      
      timestamps.push(new Date(currentTime));
      currentTime = new Date(currentTime.getTime() + interval);
      
      // Debug timestamp logging (only in debug mode)
      if (process.env.DEBUG_SYNC && logger) {
        logger.debug(`Timestamp for message ${i} (${message.role}): ${timestamps[i].toISOString()}`);
      }
    }

    return timestamps;
  }

  /**
   * Validate Gemini message structure
   */
  private static validateGeminiMessage(msg: unknown): string | null {
    if (!msg || typeof msg !== "object") {
      return "Message must be an object";
    }

    const typedMsg = msg as any;
    
    if (!typedMsg.role || (typedMsg.role !== "user" && typedMsg.role !== "model")) {
      return 'Message must have role "user" or "model"';
    }

    if (!Array.isArray(typedMsg.parts)) {
      return 'Message must have "parts" array';
    }

    if (typedMsg.parts.length === 0) {
      return "Message parts array cannot be empty";
    }

    // Validate each part
    for (let i = 0; i < typedMsg.parts.length; i++) {
      const part = typedMsg.parts[i];
      if (!part || typeof part !== "object") {
        return `Part ${i} must be an object`;
      }

      const hasText = part.text !== undefined;
      const hasFunctionCall = part.functionCall !== undefined;
      const hasFunctionResponse = part.functionResponse !== undefined;

      if (!hasText && !hasFunctionCall && !hasFunctionResponse) {
        return `Part ${i} must have text, functionCall, or functionResponse`;
      }
    }

    return null;
  }
}
