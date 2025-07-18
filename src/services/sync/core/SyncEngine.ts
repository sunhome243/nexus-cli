/**
 * Sync Engine Implementation - Cross-provider synchronization orchestrator
 * 
 * @class SyncEngine
 * @implements {ISyncEngine}
 * @description Orchestrates sync operations using focused service dependencies.
 * Provides bidirectional synchronization between Claude and Gemini providers.
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../../infrastructure/di/types.js';
import { ILoggerService } from '../../../interfaces/core/ILoggerService.js';
import { ISyncEngine, ISyncResult, ISyncOperation } from '../../../interfaces/core/ISyncEngine.js';
import { ISyncLockService } from '../../../interfaces/sync/ISyncLockService.js';
import { IDiffEngine } from '../../../interfaces/sync/IDiffEngine.js';
import { ISyncStateService } from '../../../interfaces/sync/ISyncStateService.js';
import { IProviderSyncHandler } from '../../../interfaces/sync/IProviderSyncHandler.js';

/**
 * Synchronization direction enumeration
 */
export enum SyncDirection {
  CLAUDE_TO_GEMINI = 'claude-to-gemini',
  GEMINI_TO_CLAUDE = 'gemini-to-claude',
  BIDIRECTIONAL = 'bidirectional'
}

/**
 * Sync Engine implementation
 * 
 * @class SyncEngine
 * @implements {ISyncEngine}
 * @description Manages cross-provider synchronization operations with locking, diffing, and state management.
 * Coordinates Claude and Gemini sync handlers for bidirectional conversation synchronization.
 */
@injectable()
export class SyncEngine implements ISyncEngine {
  private operations: ISyncOperation[] = [];

  constructor(
    @inject(TYPES.LoggerService) private logger: ILoggerService,
    @inject(TYPES.SyncLockService) private lockService: ISyncLockService,
    @inject(TYPES.DiffEngine) private diffEngine: IDiffEngine,
    @inject(TYPES.SyncStateService) private stateService: ISyncStateService,
    @inject(TYPES.GeminiSyncHandler) private geminiHandler: IProviderSyncHandler,
    @inject(TYPES.ClaudeSyncHandler) private claudeHandler: IProviderSyncHandler
  ) {}

  async hasChangesToSync(sessionId: string): Promise<boolean> {
    try {
      const state = await this.stateService.getState(sessionId);
      
      // If no state exists, we need to sync (first time)
      if (!state) {
        this.logger.debug(`No sync state found for ${sessionId}, sync needed`);
        return true;
      }
      
      // Use diff engine for accurate content-based comparison
      const hasContentChanges = await this.checkContentDifferencesWithDiff(sessionId);
      
      if (hasContentChanges) {
        this.logger.debug(`Content changes detected for ${sessionId}, sync needed`);
        return true;
      }
      
      this.logger.debug(`No content changes for ${sessionId}, sync not needed`);
      return false;
    } catch (error) {
      this.logger.warn('Failed to check sync state', { sessionId, error });
      return true; // Assume changes if we can't check
    }
  }
  
  /**
   * Use diff engine to check for content differences between providers
   * This is more accurate than simple message count comparison as it checks actual content
   */
  private async checkContentDifferencesWithDiff(sessionId: string): Promise<boolean> {
    try {
      // Compute diffs for both directions to check if any provider has changes
      const [claudeDiff, geminiDiff] = await Promise.all([
        this.computeClaudeDiff(sessionId),
        this.computeGeminiDiff(sessionId)
      ]);
      
      // If either provider has changes, we need to sync
      const hasChanges = claudeDiff.hasChanges || geminiDiff.hasChanges;
      
      if (hasChanges) {
        this.logger.debug(`Diff engine detected changes for ${sessionId}:`, {
          claudeChanges: claudeDiff.hasChanges,
          claudeOperations: claudeDiff.operations.length,
          geminiChanges: geminiDiff.hasChanges,
          geminiOperations: geminiDiff.operations.length
        });
      }
      
      return hasChanges;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Error checking content differences with diff engine for ${sessionId}: ${errorMessage}`);
      // Fall back to simple message count comparison if diff fails
      const state = await this.stateService.getState(sessionId);
      if (state) {
        return this.checkContentDifferences(sessionId, state);
      }
      return true; // Assume changes on error
    }
  }
  
  private async checkContentDifferences(sessionId: string, state: import('../../../interfaces/sync/ISyncStateService.js').ISyncState): Promise<boolean> {
    try {
      // Get backup path from state
      const backupPath = state.gemini?.backupPath;
      if (!backupPath) {
        this.logger.debug(`No backup path for ${sessionId}, assuming changes`);
        return true;
      }
      
      // Load backup content
      const fs = require('fs').promises;
      const path = require('path');
      
      try {
        const backupContent = await fs.readFile(backupPath, 'utf-8');
        const backup = JSON.parse(backupContent);
        const backupMessageCount = backup.messages?.length || 0;
        
        // Get current checkpoint path
        const checkpointDir = path.dirname(backupPath);
        const checkpointPath = path.join(checkpointDir, `checkpoint-${sessionId}.json`);
        
        // Load current content
        const currentContent = await fs.readFile(checkpointPath, 'utf-8');
        const current = JSON.parse(currentContent);
        const currentMessageCount = current.messages?.length || 0;
        
        // Compare message counts
        const hasChanges = currentMessageCount !== backupMessageCount;
        
        this.logger.debug(`Content comparison for ${sessionId}: backup=${backupMessageCount}, current=${currentMessageCount}, changes=${hasChanges}`);
        
        return hasChanges;
      } catch (fileError) {
        // If we can't read files, assume changes exist
        const errorMsg = fileError instanceof Error ? fileError.message : 'Unknown error';
        this.logger.debug(`Could not read files for comparison: ${errorMsg}`);
        return true;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Error in content comparison for ${sessionId}: ${errorMessage}`);
      return true; // Assume changes on error
    }
  }

  async instantSync(sessionId: string, direction: string): Promise<ISyncResult> {
    const syncDirection = direction as 'bidirectional' | 'claude-to-gemini' | 'gemini-to-claude';
    return this.syncSession(sessionId, syncDirection);
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Refactored Sync Engine');
    // Initialization logic if needed
  }

  async syncSession(
    sessionId: string,
    direction: 'bidirectional' | 'claude-to-gemini' | 'gemini-to-claude' = 'bidirectional'
  ): Promise<ISyncResult> {
    const startTime = Date.now();
    const operationId = `sync-${sessionId}-${Date.now()}`;
    
    try {
      this.logger.info(`Starting sync operation ${operationId} for session ${sessionId}, direction: ${direction}`);
      
      // Acquire lock to prevent concurrent sync
      await this.lockService.acquire(sessionId);
      
      try {
        // Initialize states if needed
        await this.initializeSessionIfNeeded(sessionId);
        
        // Update session tracking before computing diffs
        await this.claudeHandler.updateSessionTracking(sessionId);
        
        let syncedItems = 0;
        const errors: string[] = [];
        
        // Perform sync based on direction
        if (direction === 'bidirectional' || direction === 'gemini-to-claude') {
          const geminiResult = await this.syncGeminiToClaude(sessionId);
          syncedItems += geminiResult.items;
          errors.push(...geminiResult.errors);
        }
        
        if (direction === 'bidirectional' || direction === 'claude-to-gemini') {
          const claudeResult = await this.syncClaudeToGemini(sessionId);
          syncedItems += claudeResult.items;
          errors.push(...claudeResult.errors);
        }
        
        // Update states after successful sync
        await Promise.all([
          this.geminiHandler.updateAfterSync(sessionId),
          this.claudeHandler.updateAfterSync(sessionId)
        ]);
        
        // Update sync state
        await this.stateService.updateState(sessionId, {
          messageCount: syncedItems,
          lastSyncTimestamp: new Date()
        });
        
        const duration = Date.now() - startTime;
        
        const result: ISyncResult = {
          success: errors.length === 0,
          operationId,
          syncedItems,
          errors,
          duration
        };
        
        this.operations.push({
          id: operationId,
          type: 'sync',
          sourceProvider: 'mixed',
          targetProvider: 'mixed',
          timestamp: new Date(),
          status: result.success ? 'completed' : 'failed',
          error: errors.length > 0 ? errors.join('; ') : undefined
        } as ISyncOperation);
        
        this.logger.info(`Sync operation ${operationId} completed: ${result.success ? 'success' : 'failed'}, items: ${syncedItems}, duration: ${duration}ms`);
        
        return result;
        
      } finally {
        // Always release lock
        await this.lockService.release(sessionId);
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error(`Sync operation ${operationId} failed: ${errorMessage}`);
      
      return {
        success: false,
        operationId,
        syncedItems: 0,
        errors: [errorMessage],
        duration
      };
    }
  }

  async validateSyncState(sessionId: string): Promise<boolean> {
    try {
      // Check if session is currently syncing
      if (this.lockService.isLocked(sessionId)) {
        this.logger.info(`Session ${sessionId} is currently syncing`);
        return false;
      }
      
      // Check if there are changes that need syncing
      return await this.hasChangesToSync(sessionId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to validate sync state for ${sessionId}: ${errorMessage}`);
      return false;
    }
  }

  getOperationHistory(): ISyncOperation[] {
    return [...this.operations];
  }

  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up Refactored Sync Engine');
    this.lockService.cleanupStaleLocks();
    await Promise.all([
      this.geminiHandler.cleanup(),
      this.claudeHandler.cleanup()
    ]);
  }


  private async initializeSessionIfNeeded(sessionId: string): Promise<void> {
    const hasState = await this.stateService.hasState(sessionId);
    if (!hasState) {
      await this.stateService.initializeState(sessionId);
    }
    
    await Promise.all([
      this.geminiHandler.initializeState(sessionId),
      this.claudeHandler.initializeState(sessionId)
    ]);
  }

  private async syncGeminiToClaude(sessionId: string): Promise<{ items: number; errors: string[] }> {
    try {
      const diff = await this.computeGeminiDiff(sessionId);
      if (!diff.hasChanges) {
        return { items: 0, errors: [] };
      }
      
      // Read current Claude conversation
      const claudeFile = await this.claudeHandler.getAfterFile(sessionId);
      const claudeMessages = await this.claudeHandler.readConversation(claudeFile, sessionId);
      
      // Apply diff operations
      const updatedMessages = this.diffEngine.applyOperations(claudeMessages, diff.operations);
      
      // Write back to Claude
      await this.claudeHandler.writeConversation(claudeFile, updatedMessages, sessionId);
      
      // Verify write succeeded
      const verifyMessages = await this.claudeHandler.readConversation(claudeFile, sessionId);
      if (verifyMessages.length !== updatedMessages.length) {
        throw new Error(`Write verification failed: expected ${updatedMessages.length} messages, found ${verifyMessages.length}`);
      }
      
      const addedItems = diff.operations.filter(op => op.type === 'ADD').length;
      this.logger.info(`Applied ${addedItems} Gemini→Claude changes`);
      
      return { items: addedItems, errors: [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to sync Gemini→Claude: ${errorMessage}`);
      return { items: 0, errors: [errorMessage] };
    }
  }

  private async syncClaudeToGemini(sessionId: string): Promise<{ items: number; errors: string[] }> {
    try {
      const diff = await this.computeClaudeDiff(sessionId);
      if (!diff.hasChanges) {
        return { items: 0, errors: [] };
      }
      
      // Read current Gemini conversation
      const geminiFile = await this.geminiHandler.getAfterFile(sessionId);
      const geminiMessages = await this.geminiHandler.readConversation(geminiFile, sessionId);
      
      // Apply diff operations
      const updatedMessages = this.diffEngine.applyOperations(geminiMessages, diff.operations);
      
      // Write back to Gemini
      await this.geminiHandler.writeConversation(geminiFile, updatedMessages, sessionId);
      
      // Verify write succeeded
      const verifyMessages = await this.geminiHandler.readConversation(geminiFile, sessionId);
      if (verifyMessages.length !== updatedMessages.length) {
        throw new Error(`Write verification failed: expected ${updatedMessages.length} messages, found ${verifyMessages.length}`);
      }
      
      const addedItems = diff.operations.filter(op => op.type === 'ADD').length;
      this.logger.info(`Applied ${addedItems} Claude→Gemini changes`);
      
      return { items: addedItems, errors: [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to sync Claude→Gemini: ${errorMessage}`);
      return { items: 0, errors: [errorMessage] };
    }
  }

  private async computeGeminiDiff(sessionId: string) {
    try {
      const beforeFile = await this.geminiHandler.getBeforeFile(sessionId);
      const afterFile = await this.geminiHandler.getAfterFile(sessionId);
      
      const [beforeMessages, afterMessages] = await Promise.all([
        this.geminiHandler.readConversation(beforeFile, sessionId),
        this.geminiHandler.readConversation(afterFile, sessionId)
      ]);
      
      return this.diffEngine.computeDiff(beforeMessages, afterMessages);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to compute Gemini diff for ${sessionId}: ${errorMessage}`);
      return { operations: [], hasChanges: false };
    }
  }

  private async computeClaudeDiff(sessionId: string) {
    try {
      const beforeFile = await this.claudeHandler.getBeforeFile(sessionId);
      const afterFile = await this.claudeHandler.getAfterFile(sessionId);
      
      this.logger.info(`[SyncEngine] Claude diff files - Before: ${beforeFile}, After: ${afterFile}`);
      
      const [beforeMessages, afterMessages] = await Promise.all([
        this.claudeHandler.readConversation(beforeFile, sessionId),
        this.claudeHandler.readConversation(afterFile, sessionId)
      ]);
      
      this.logger.info(`[SyncEngine] Claude diff messages - Before: ${beforeMessages.length}, After: ${afterMessages.length}`);
      
      const diff = this.diffEngine.computeDiff(beforeMessages, afterMessages);
      this.logger.info(`[SyncEngine] Claude diff result - hasChanges: ${diff.hasChanges}, operations: ${diff.operations.length}`);
      
      return diff;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to compute Claude diff for ${sessionId}: ${errorMessage}`);
      return { operations: [], hasChanges: false };
    }
  }

}