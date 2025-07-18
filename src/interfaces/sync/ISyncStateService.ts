/**
 * Sync State Service Interface
 * Manages sync state tracking across sessions
 */

export interface ISyncState {
  sessionId: string;
  lastSyncTimestamp: Date;
  geminiVersion: string;
  claudeVersion: string;
  messageCount: number;
  
  // Extended fields from SyncStateManager
  sessionTag: string;
  lastSyncTime: number;
  gemini: {
    backupPath: string;
    lastBackupTime: number;
  };
  claude: {
    lastSessionId: string;
    currentSessionId: string;
    lastSyncTime: number;
  };
}

export interface ISyncStateService {
  /**
   * Initialize sync state for a session
   */
  initializeState(sessionId: string): Promise<void>;
  
  /**
   * Get sync state for a session
   */
  getState(sessionId: string): Promise<ISyncState | null>;
  
  /**
   * Update sync state after sync operation
   */
  updateState(sessionId: string, updates: Partial<ISyncState>): Promise<void>;
  
  /**
   * List all active sync states
   */
  listStates(): Promise<ISyncState[]>;
  
  /**
   * Remove sync state for a session
   */
  removeState(sessionId: string): Promise<void>;
  
  /**
   * Check if sync state exists
   */
  hasState(sessionId: string): Promise<boolean>;
  
  // Extended methods from SyncStateManager
  /**
   * Get sync state for a session tag
   */
  getSyncState(sessionTag: string): Promise<ISyncState>;
  
  /**
   * Update sync state for a session tag
   */
  updateSyncState(sessionTag: string, state: ISyncState): Promise<void>;
  
  /**
   * Update Claude session ID tracking
   */
  updateClaudeSession(sessionTag: string, currentSessionId: string): Promise<void>;
  
  /**
   * Initialize Claude session tracking
   */
  initializeClaudeSession(sessionTag: string, sessionId: string): Promise<void>;
  
  /**
   * Mark sync as completed - move currentSessionId to lastSessionId
   */
  markSyncCompleted(sessionTag: string, sessionId: string): Promise<void>;
  
  /**
   * Update Gemini backup path
   */
  updateGeminiBackup(sessionTag: string, backupPath: string): Promise<void>;
  
  /**
   * List all sync states
   */
  listSyncStates(): Promise<ISyncState[]>;
  
  /**
   * Remove sync state
   */
  removeSyncState(sessionTag: string): Promise<void>;
}