/**
 * Sync Engine Interface
 * Defines the contract for cross-provider synchronization
 */

export interface ISyncOperation {
  id: string;
  type: 'sync' | 'conversion' | 'validation';
  sourceProvider: string;
  targetProvider: string;
  timestamp: Date;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}

export interface ISyncResult {
  success: boolean;
  operationId: string;
  syncedItems: number;
  errors: string[];
  duration: number;
  syncDirection?: 'bidirectional' | 'claude-to-gemini' | 'gemini-to-claude';
  messagesTransferred?: number;
}

export interface ISyncEngine {
  initialize(): Promise<void>;
  syncSession(sessionId: string, direction: 'bidirectional' | 'claude-to-gemini' | 'gemini-to-claude'): Promise<ISyncResult>;
  validateSyncState(sessionId: string): Promise<boolean>;
  getOperationHistory(): ISyncOperation[];
  cleanup(): Promise<void>;
  instantSync(sessionId: string, direction: string): Promise<ISyncResult>;
  hasChangesToSync(sessionId: string): Promise<boolean>;
}