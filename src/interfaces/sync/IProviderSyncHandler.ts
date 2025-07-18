/**
 * Provider Sync Handler Interface
 * Handles provider-specific sync operations
 */

import { SyncMessage } from './IDiffEngine.js';

export interface IProviderSyncHandler {
  /**
   * Get before file path for comparison
   */
  getBeforeFile(sessionId: string): Promise<string>;
  
  /**
   * Get after file path for comparison
   */
  getAfterFile(sessionId: string): Promise<string>;
  
  /**
   * Read conversation from file
   */
  readConversation(filePath: string, sessionId?: string): Promise<SyncMessage[]>;
  
  /**
   * Write conversation to file
   */
  writeConversation(filePath: string, messages: SyncMessage[], sessionId?: string): Promise<void>;
  
  /**
   * Initialize state for session
   */
  initializeState(sessionId: string): Promise<void>;
  
  /**
   * Update state after sync
   */
  updateAfterSync(sessionId: string): Promise<void>;
  
  /**
   * Update session tracking
   */
  updateSessionTracking(sessionId: string): Promise<void>;
  
  /**
   * Cleanup handler resources
   */
  cleanup(): Promise<void>;
}