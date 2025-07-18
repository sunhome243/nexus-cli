/**
 * MyersDiff - Implementation of Myers Algorithm for conversation diffing
 * Computes differences between two conversation arrays efficiently
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../../infrastructure/di/types.js';
import { IDiffEngine, IDiffOperation, IDiffResult, SyncMessage } from '../../../interfaces/sync/IDiffEngine.js';
import { ILoggerService } from '../../../interfaces/core/ILoggerService.js';
import { UniversalMessage, UniversalContent, UniversalContentPart } from "../types.js";
import { ProviderType } from '../../../abstractions/providers/types.js';

// Type definitions for tool comparison
interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  id?: string;
}

interface ToolResult {
  id: string;
  name: string;
  result: unknown;
  isError?: boolean;
}

export interface DiffOperation {
  type: "ADD" | "REMOVE";
  index: number;
  message?: UniversalMessage;
}

export interface DiffResult {
  operations: DiffOperation[];
  hasChanges: boolean;
}

@injectable()
export class MyersDiff implements IDiffEngine {
  constructor(@inject(TYPES.LoggerService) private logger: ILoggerService) {}
  /**
   * Compute diff between two conversation arrays using Myers Algorithm
   */
  computeDiff(oldMessages: SyncMessage[], newMessages: SyncMessage[]): IDiffResult {
    // Convert SyncMessage to UniversalMessage for internal processing
    const oldUniversal = this.convertToUniversalMessages(oldMessages);
    const newUniversal = this.convertToUniversalMessages(newMessages);
    // Use simplified approach for conversation diffing
    // Since conversations are append-only in most cases, we can optimize
    const result = this.computeAppendOnlyDiff(oldUniversal, newUniversal);

    // Count operation types for summary
    let added = 0;
    result.forEach(op => {
      if (op.type === 'ADD') added++;
    });

    return {
      operations: result as IDiffOperation[],
      hasChanges: result.length > 0,
      summary: {
        added,
        removed: 0, // Always 0 in append-only mode
        modified: 0  // Not supported in MyersDiff
      }
    };
  }

  /**
   * Get message preview for logging
   */
  getMessagePreview(message: SyncMessage): string {
    const content = message.content;
    if (content) {
      return content.substring(0, 100) + (content.length > 100 ? "..." : "");
    }
    return "[Empty message]";
  }

  /**
   * Convert UniversalMessage to SyncMessage for preview purposes
   */
  private convertUniversalToSyncMessage(message: UniversalMessage): SyncMessage {
    let contentString = '';
    
    if (message.content.text) {
      contentString = message.content.text;
    } else if (message.content.parts) {
      contentString = message.content.parts
        .map(part => {
          if (part.type === 'text' && part.text) {
            return part.text;
          } else if (part.type === 'tool_use' && part.toolCall) {
            return `[Tool: ${part.toolCall.name}]`;
          } else if (part.type === 'tool_result' && part.toolResult) {
            return `[Tool Result: ${part.toolResult.name}]`;
          }
          return '[Unknown content]';
        })
        .join(' ');
    } else if (message.content.toolCall) {
      contentString = `[Tool: ${message.content.toolCall.name}]`;
    } else if (message.content.toolResult) {
      contentString = `[Tool Result: ${message.content.toolResult.name}]`;
    }
    
    return {
      role: message.role,
      content: contentString,
      timestamp: new Date(message.timestamp),
      id: message.id,
      provider: message.metadata.provider,
      metadata: { ...message.metadata } as Record<string, unknown>
    } as SyncMessage;
  }

  /**
   * Apply diff operations to a message array
   * IMPORTANT: Only supports ADD operations to prevent conversation corruption
   */
  applyOperations(messages: SyncMessage[], operations: IDiffOperation[]): SyncMessage[] {
    const result = [...messages];
    
    // Filter to only ADD operations (ignore REMOVE/MODIFY to prevent corruption)
    const addOperations = operations
      .filter(op => op.type === 'ADD')
      .sort((a, b) => a.index - b.index);

    // Apply ADD operations
    for (const operation of addOperations) {
      if (operation.message) {
        // Check for duplicates before adding
        const isDuplicate = result.some(existing => 
          this.isMessageSimilar(existing, operation.message as SyncMessage)
        );
        
        if (!isDuplicate) {
          result.push(operation.message);
        }
      }
    }

    return result;
  }

  /**
   * Check if two messages are similar/duplicate
   * Delegates to messagesEqual for content-based comparison
   */
  isMessageSimilar(message1: SyncMessage, message2: SyncMessage): boolean {
    // Compare basic properties for similarity
    if (message1.role !== message2.role) return false;
    if (message1.content !== message2.content) return false;
    
    // Check timestamps (allow small differences)
    const timeDiff = Math.abs(message1.timestamp.getTime() - message2.timestamp.getTime());
    if (timeDiff > 5000) return false; // 5 second tolerance
    
    return true;
  }

  /**
   * Optimized diff for append-only conversations with timestamp awareness
   * Most conversation updates are just new messages at the end
   */
  private computeAppendOnlyDiff(oldMessages: UniversalMessage[], newMessages: UniversalMessage[]): DiffOperation[] {
    const operations: DiffOperation[] = [];

    // Handle empty cases
    if (oldMessages.length === 0) {
      // All messages are new - add them chronologically
      newMessages.forEach((message, index) => {
        operations.push({
          type: "ADD",
          index: oldMessages.length + index, // Append after existing messages
          message,
        });
      });
      this.logger.debug(`All ${newMessages.length} messages are new, adding chronologically`);
      return operations;
    }

    if (newMessages.length === 0) {
      // No new messages to add - return empty operations for pure append-only
      this.logger.debug("No new messages to sync");
      return operations;
    }

    // Use timestamp-aware comparison instead of simple prefix matching
    const { commonMessages, newOnlyMessages, oldOnlyMessages } = this.compareMessagesByTimestamp(
      oldMessages,
      newMessages
    );

    this.logger.debug(
      `Content comparison: ${commonMessages.length} common, ${newOnlyMessages.length} new (append-only mode)`
    );

    // PURE APPEND-ONLY: Never remove messages, only add new ones
    // Removed REMOVE operations to prevent file corruption
    // Messages should only be appended, never removed from conversation history

    // Add new messages (they will be sorted chronologically in applyDiffOperations)
    for (let i = 0; i < newOnlyMessages.length; i++) {
      const newMsg = newOnlyMessages[i];
      operations.push({
        type: "ADD",
        index: oldMessages.length + i, // Append after existing messages
        message: newMsg,
      });
    }

    return operations;
  }

  /**
   * Compare messages by content to find differences (ID-independent)
   * Returns common messages, new-only messages, and old-only messages
   * ENHANCED: Detailed logging to debug why messages aren't matching
   */
  private compareMessagesByTimestamp(
    oldMessages: UniversalMessage[],
    newMessages: UniversalMessage[]
  ): {
    commonMessages: UniversalMessage[];
    newOnlyMessages: UniversalMessage[];
    oldOnlyMessages: UniversalMessage[];
  } {
    const commonMessages: UniversalMessage[] = [];
    const newOnlyMessages: UniversalMessage[] = [...newMessages];
    const oldOnlyMessages: UniversalMessage[] = [];

    if (process.env.DEBUG_SYNC) {
      this.logger.debug(`📊 [MyersDiff] Starting content comparison:`, {
        oldMessagesCount: oldMessages.length,
        newMessagesCount: newMessages.length
      });
    }

    // For each old message, try to find a matching new message by content
    for (let oldIndex = 0; oldIndex < oldMessages.length; oldIndex++) {
      const oldMsg = oldMessages[oldIndex];
      let foundMatch = false;

      if (process.env.DEBUG_SYNC) {
        this.logger.debug(`🔍 [MyersDiff] Looking for match for old message ${oldIndex}:`, {
          content: this.getMessagePreview(this.convertUniversalToSyncMessage(oldMsg))
        });
      }

      for (let i = 0; i < newOnlyMessages.length; i++) {
        const newMsg = newOnlyMessages[i];

        if (this.messagesEqual(oldMsg, newMsg)) {
          // Found a content match - move from newOnly to common
          commonMessages.push(newMsg);
          newOnlyMessages.splice(i, 1);
          foundMatch = true;
          if (process.env.DEBUG_SYNC) {
            this.logger.debug(`✅ [MyersDiff] Found match at new message index ${i}`);
          }
          break;
        }
      }

      if (!foundMatch) {
        // Old message has no corresponding new message
        oldOnlyMessages.push(oldMsg);
        if (process.env.DEBUG_SYNC) {
          this.logger.debug(`❌ [MyersDiff] No match found for old message ${oldIndex}`);
        }
      }
    }

    if (process.env.DEBUG_SYNC) {
      this.logger.debug(`📈 [MyersDiff] Comparison results:`, {
        commonMessages: commonMessages.length,
        newOnlyMessages: newOnlyMessages.length,
        oldOnlyMessages: oldOnlyMessages.length
      });
    }

    return { commonMessages, newOnlyMessages, oldOnlyMessages };
  }

  /**
   * Find length of common prefix between two message arrays
   */
  private findCommonPrefix(oldMessages: UniversalMessage[], newMessages: UniversalMessage[]): number {
    const minLength = Math.min(oldMessages.length, newMessages.length);
    let commonLength = 0;

    for (let i = 0; i < minLength; i++) {
      if (this.messagesEqual(oldMessages[i], newMessages[i])) {
        commonLength++;
      } else {
        break;
      }
    }

    return commonLength;
  }

  /**
   * Check if two messages are equal (pure content-based comparison)
   * FIXED: Only compares role, type, and content - ignores all session metadata
   */
  private messagesEqual(msg1: UniversalMessage, msg2: UniversalMessage): boolean {
    if (process.env.DEBUG_SYNC) {
      this.logger.debug(`🔍 [MyersDiff] Comparing messages:`, {
        msg1: { role: msg1.role, type: msg1.type, sessionId: msg1.sessionId, preview: this.getMessagePreview(this.convertUniversalToSyncMessage(msg1)) },
        msg2: { role: msg2.role, type: msg2.type, sessionId: msg2.sessionId, preview: this.getMessagePreview(this.convertUniversalToSyncMessage(msg2)) }
      });
    }

    // Compare essential properties (role and type)
    if (msg1.role !== msg2.role) {
      if (process.env.DEBUG_SYNC) {
        this.logger.debug(`❌ Message role mismatch: ${msg1.role} vs ${msg2.role}`);
      }
      return false;
    }
    if (msg1.type !== msg2.type) {
      if (process.env.DEBUG_SYNC) {
        this.logger.debug(`❌ Message type mismatch: ${msg1.type} vs ${msg2.type}`);
      }
      return false;
    }

    // CRITICAL FIX: ONLY compare content - completely ignore:
    // - id (different between sessions)
    // - sessionId (different between sessions) 
    // - timestamp (may vary)
    // - parentId (session-specific)
    // - metadata (session-specific)
    // Same content = same message regardless of which session it came from
    const contentEqual = this.contentEqual(msg1.content, msg2.content);
    if (process.env.DEBUG_SYNC) {
      if (contentEqual) {
        this.logger.debug(`✅ Messages are equal (same content, ignoring session metadata)`);
      } else {
        this.logger.debug(`❌ Messages content differs`, {
          msg1Content: msg1.content,
          msg2Content: msg2.content
        });
      }
    }
    return contentEqual;
  }

  /**
   * Check if two content objects are equal
   */
  private contentEqual(content1: UniversalContent, content2: UniversalContent): boolean {
    // Compare text content
    if (content1.text !== content2.text) {
      if (process.env.DEBUG_SYNC) {
        this.logger.debug(`Content text mismatch: "${content1.text}" vs "${content2.text}"`);
      }
      return false;
    }

    // Compare tool call
    if (!this.toolCallEqual(content1.toolCall, content2.toolCall)) {
      if (process.env.DEBUG_SYNC) {
        this.logger.debug(`Content toolCall mismatch`, {
          toolCall1: content1.toolCall,
          toolCall2: content2.toolCall
        });
      }
      return false;
    }

    // Compare tool result
    if (!this.toolResultEqual(content1.toolResult, content2.toolResult)) {
      if (process.env.DEBUG_SYNC) {
        this.logger.debug(`Content toolResult mismatch`, {
          toolResult1: content1.toolResult,
          toolResult2: content2.toolResult
        });
      }
      return false;
    }

    // Compare parts array
    if (!this.partsEqual(content1.parts, content2.parts)) {
      if (process.env.DEBUG_SYNC) {
        this.logger.debug(`Content parts mismatch`, {
          parts1: content1.parts,
          parts2: content2.parts
        });
      }
      return false;
    }

    return true;
  }

  /**
   * Check if two tool calls are equal
   * FIXED: Don't compare tool call IDs as they may be session-specific
   */
  private toolCallEqual(call1: ToolCall | undefined, call2: ToolCall | undefined): boolean {
    if (!call1 && !call2) return true;
    if (!call1 || !call2) return false;

    // Compare name and args only - ignore id as it may be session-specific
    const nameEqual = call1.name === call2.name;
    const argsEqual = JSON.stringify(call1.args) === JSON.stringify(call2.args);
    
    if (process.env.DEBUG_SYNC && (!nameEqual || !argsEqual)) {
      this.logger.debug(`Tool call comparison:`, {
        nameEqual, argsEqual,
        call1: { name: call1.name, id: call1.id, args: call1.args },
        call2: { name: call2.name, id: call2.id, args: call2.args }
      });
    }

    return nameEqual && argsEqual;
  }

  /**
   * Check if two tool results are equal
   * FIXED: Don't compare tool result IDs as they may be session-specific
   */
  private toolResultEqual(result1: ToolResult | undefined, result2: ToolResult | undefined): boolean {
    if (!result1 && !result2) return true;
    if (!result1 || !result2) return false;

    // Compare name, error status, and result content only - ignore id
    const nameEqual = result1.name === result2.name;
    const errorEqual = result1.isError === result2.isError;
    const resultEqual = JSON.stringify(result1.result) === JSON.stringify(result2.result);

    if (process.env.DEBUG_SYNC && (!nameEqual || !errorEqual || !resultEqual)) {
      this.logger.debug(`Tool result comparison:`, {
        nameEqual, errorEqual, resultEqual,
        result1: { name: result1.name, id: result1.id, isError: result1.isError },
        result2: { name: result2.name, id: result2.id, isError: result2.isError }
      });
    }

    return nameEqual && errorEqual && resultEqual;
  }

  /**
   * Check if two parts arrays are equal
   */
  private partsEqual(parts1: UniversalContentPart[] | undefined, parts2: UniversalContentPart[] | undefined): boolean {
    if (!parts1 && !parts2) return true;
    if (!parts1 || !parts2) return false;
    if (parts1.length !== parts2.length) return false;

    for (let i = 0; i < parts1.length; i++) {
      const part1 = parts1[i];
      const part2 = parts2[i];

      if (part1.type !== part2.type) return false;
      if (part1.text !== part2.text) return false;

      if (!this.toolCallEqual(part1.toolCall, part2.toolCall)) return false;
      if (!this.toolResultEqual(part1.toolResult, part2.toolResult)) return false;
    }

    return true;
  }

  /**
   * Full Myers Algorithm implementation (for complex diffs if needed)
   * This is the standard O((M+N)D) implementation
   */
  private computeFullMyersDiff(oldMessages: UniversalMessage[], newMessages: UniversalMessage[]): DiffOperation[] {
    const M = oldMessages.length;
    const N = newMessages.length;
    const MAX = M + N;

    // V array for Myers algorithm
    const V: Record<number, number> = {};
    V[1] = 0;

    const trace: Array<Record<number, number>> = [];

    // Find shortest edit script
    for (let D = 0; D <= MAX; D++) {
      trace.push({ ...V });

      for (let k = -D; k <= D; k += 2) {
        let x: number;

        if (k === -D || (k !== D && V[k - 1] < V[k + 1])) {
          x = V[k + 1];
        } else {
          x = V[k - 1] + 1;
        }

        let y = x - k;

        // Follow diagonal
        while (x < M && y < N && this.messagesEqual(oldMessages[x], newMessages[y])) {
          x++;
          y++;
        }

        V[k] = x;

        if (x >= M && y >= N) {
          // Found the shortest path
          return this.backtrackOperations(trace, oldMessages, newMessages, x, y);
        }
      }
    }

    return [];
  }

  /**
   * Backtrack through the trace to generate operations
   */
  private backtrackOperations(
    trace: Array<Record<number, number>>,
    oldMessages: UniversalMessage[],
    newMessages: UniversalMessage[],
    x: number,
    y: number
  ): DiffOperation[] {
    const operations: DiffOperation[] = [];

    for (let d = trace.length - 1; d >= 0; d--) {
      const V = trace[d];
      const k = x - y;

      let prev_k: number;
      if (k === -d || (k !== d && V[k - 1] < V[k + 1])) {
        prev_k = k + 1;
      } else {
        prev_k = k - 1;
      }

      const prev_x = V[prev_k];
      const prev_y = prev_x - prev_k;

      // Follow diagonal backwards
      while (x > prev_x && y > prev_y) {
        x--;
        y--;
      }

      if (d > 0) {
        if (x === prev_x) {
          // Insertion
          operations.unshift({
            type: "ADD",
            index: y - 1,
            message: newMessages[y - 1],
          });
          y = prev_y;
        } else {
          // Deletion
          operations.unshift({
            type: "REMOVE",
            index: x - 1,
          });
          x = prev_x;
        }
      }
    }

    return operations;
  }

  /**
   * Convert SyncMessage array to UniversalMessage array for internal processing
   */
  private convertToUniversalMessages(messages: SyncMessage[]): UniversalMessage[] {
    return messages.map((msg, index) => ({
      id: msg.id || `sync_${index}`,
      parentId: null,
      sessionId: 'sync_session',
      timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : new Date(msg.timestamp).toISOString(),
      role: msg.role as 'user' | 'assistant',
      type: 'message' as const,
      content: {
        text: msg.content
      },
      metadata: {
        provider: msg.provider ? (msg.provider === 'gemini' ? ProviderType.GEMINI : ProviderType.CLAUDE) : ProviderType.CLAUDE,
        extra: {
          originalProvider: msg.provider || 'unknown',
          originalMetadata: msg.metadata || {}
        }
      }
    }));
  }

  /**
   * Convert UniversalMessage array back to SyncMessage array
   */
  private convertToSyncMessages(messages: UniversalMessage[]): SyncMessage[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content.text || '',
      timestamp: new Date(msg.timestamp),
      id: msg.id,
      provider: msg.metadata.provider,  // Direct assignment to preserve provider
      metadata: (msg.metadata.extra?.originalMetadata as Record<string, unknown>) || {}
    }));
  }
}
