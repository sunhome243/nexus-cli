/**
 * Diff Engine Interface
 * Handles message difference computation for sync operations
 */

// Universal message type for sync operations
export interface SyncMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  id?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
}

export interface IDiffOperation {
  type: 'ADD' | 'REMOVE' | 'MODIFY';
  index: number;
  message?: SyncMessage;
  oldMessage?: SyncMessage;
}

export interface IDiffResult {
  operations: IDiffOperation[];
  hasChanges: boolean;
  summary?: {
    added: number;
    removed: number;
    modified: number;
  };
}

export interface IDiffEngine {
  /**
   * Compute difference between two message arrays
   */
  computeDiff(before: SyncMessage[], after: SyncMessage[]): IDiffResult;
  
  /**
   * Apply diff operations to a message array
   */
  applyOperations(messages: SyncMessage[], operations: IDiffOperation[]): SyncMessage[];
  
  /**
   * Check if two messages are similar/duplicate
   */
  isMessageSimilar(message1: SyncMessage, message2: SyncMessage): boolean;
  
  /**
   * Get message preview for logging
   */
  getMessagePreview(message: SyncMessage): string;
}