/**
 * Gemini Backup Service
 * Handles backup and sync operations for Gemini provider
 * Extracted from GeminiProvider.ts to reduce complexity
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../../../infrastructure/di/types.js';
import { ILoggerService } from '../../../../interfaces/core/ILoggerService.js';
import { ISyncEngine } from '../../../../interfaces/core/ISyncEngine.js';
import { ISyncStateService } from '../../../../interfaces/sync/ISyncStateService.js';
import { IProviderSyncHandler } from '../../../../interfaces/sync/IProviderSyncHandler.js';
import { SyncMessage } from '../../../../interfaces/sync/IDiffEngine.js';
import { BaseProvider } from '../../shared/BaseProvider.js';
import { GeminiCheckpointWrapper } from '../../../../utils/GeminiCheckpointWrapper.js';

@injectable()
export class GeminiBackupService extends BaseProvider {
  constructor(
    @inject(TYPES.LoggerService) logger: ILoggerService,
    @inject(TYPES.SyncEngine) private syncEngine: ISyncEngine,
    @inject(TYPES.SyncStateService) private syncStateService: ISyncStateService
  ) {
    super();
    this.setLogger(logger);
  }

  async initialize(): Promise<void> {
    if (this.isProviderInitialized()) {
      return;
    }

    try {
      this.logInfo('Initializing Gemini Backup Service');
      this.setInitialized(true);
      this.logInfo('Gemini Backup Service initialized successfully');
    } catch (error) {
      const err = this.wrapError(error);
      this.logError('Failed to initialize Gemini Backup Service', err);
      throw err;
    }
  }

  async cleanup(): Promise<void> {
    try {
      this.logInfo('Cleaning up Gemini Backup Service');
      this.setInitialized(false);
      this.logInfo('Gemini Backup Service cleaned up successfully');
    } catch (error) {
      const err = this.wrapError(error);
      this.logError('Failed to cleanup Gemini Backup Service', err);
    }
  }

  /**
   * Perform backup-first save process
   */
  async performBackupFirstSave(tag: string, checkpointWrapper: GeminiCheckpointWrapper): Promise<void> {
    try {
      this.logInfo(`[BACKUP-FIRST] Starting backup-first save for ${tag}`);
      
      // First, create backup before making any changes
      await this.createBackupBeforeSave(tag);
      
      // Get conversation size before and after save to detect real changes  
      const beforeSaveHistory = checkpointWrapper.getConversationHistory();
      const beforeSaveCount = beforeSaveHistory.length;
      this.logInfo(`[BACKUP-FIRST] Before save: ${beforeSaveCount} messages in checkpoint wrapper`);
      
      await this.saveConversation(tag, checkpointWrapper);
      
      const afterSaveHistory = checkpointWrapper.getConversationHistory();
      const afterSaveCount = afterSaveHistory.length;
      this.logInfo(`[BACKUP-FIRST] After save: ${afterSaveCount} messages in checkpoint wrapper`);
      
      // Now compare backup with current checkpoint to detect real content changes
      const backupContent = await this.getBackupContent(tag);
      const currentContent = afterSaveHistory;
      
      const backupCount = backupContent.length;
      const currentCount = currentContent.length;
      const realChange = currentCount > backupCount;
      
      this.logInfo(`[BACKUP-FIRST] Content comparison: backup=${backupCount} messages, current=${currentCount} messages, realChange=${realChange}`);
      
      if (realChange) {
        this.logInfo(`[BACKUP-FIRST] Real content change detected: ${backupCount} -> ${currentCount} messages, forcing sync`);
        
        // Update message count in sync state
        try {
          await this.syncStateService.updateState(tag, { messageCount: currentCount });
          this.logInfo(`[BACKUP-FIRST] Updated message count for ${tag}`);
        } catch (error) {
          this.logError('Failed to update sync state', error);
        }
      } else {
        this.logInfo(`[BACKUP-FIRST] No real content change (backup=${backupCount} vs current=${currentCount})`);
      }
      
      // Force sync only if there are real content changes
      const shouldForceSync = realChange;
      this.logInfo(`[BACKUP-FIRST] Calling runDiffSync with forceSync=${shouldForceSync}`);
      await this.runDiffSync(tag, shouldForceSync);
    } catch (error) {
      this.logError('Failed backup-first save process:', error);
      throw error;
    }
  }

  /**
   * Create initial backup for proper sync diff tracking
   */
  async createInitialBackup(tag: string): Promise<void> {
    try {
      // Access the gemini handler's file handler through the sync engine
      const syncEngineWithHandlers = this.syncEngine as ISyncEngine & {
        geminiHandler: IProviderSyncHandler & {
          fileHandler?: {
            updateBackupFile: (tag: string) => Promise<void>;
          };
        };
      };
      
      const fileHandler = syncEngineWithHandlers.geminiHandler.fileHandler;
      if (fileHandler?.updateBackupFile) {
        await fileHandler.updateBackupFile(tag);
        this.logInfo(`[GEMINI BACKUP] Initial backup created for session: ${tag}`);
      } else {
        this.logWarn(`[GEMINI BACKUP] File handler updateBackupFile method not available`);
      }
    } catch (error) {
      this.logWarn(`[GEMINI BACKUP] Failed to create initial backup:`, error);
      // Don't throw - backup creation is not critical for session functionality
    }
  }

  /**
   * Create backup before save operation (backup-first approach)
   */
  private async createBackupBeforeSave(tag: string): Promise<void> {
    try {
      // Access the gemini handler's file handler through the sync engine
      const syncEngineWithHandlers = this.syncEngine as ISyncEngine & {
        geminiHandler: IProviderSyncHandler & {
          fileHandler?: {
            createBackupBeforeSave: (tag: string) => Promise<void>;
          };
        };
      };
      
      const fileHandler = syncEngineWithHandlers.geminiHandler.fileHandler;
      if (fileHandler?.createBackupBeforeSave) {
        await fileHandler.createBackupBeforeSave(tag);
        this.logInfo(`[BACKUP-FIRST] Backup created before save for session: ${tag}`);
      } else {
        this.logWarn(`[BACKUP-FIRST] File handler createBackupBeforeSave method not available`);
      }
    } catch (error) {
      this.logError(`[BACKUP-FIRST] Failed to create backup before save:`, error);
      throw error; // Propagate error since backup-first is critical
    }
  }

  /**
   * Save conversation using checkpoint wrapper
   */
  private async saveConversation(tag: string, checkpointWrapper: GeminiCheckpointWrapper): Promise<void> {
    try {
      const history = checkpointWrapper.getConversationHistory();
      this.logDebug(`About to save conversation: ${tag} (${history.length} items)`);
      
      // Use original core saveCheckpoint method (includes tool results and proper role names)
      await checkpointWrapper.saveCheckpoint(tag);
      
      // Verify the save actually worked
      const savedHistory = checkpointWrapper.getConversationHistory();
      this.logDebug(`After save verification: ${savedHistory.length} items, checkpoint exists: ${checkpointWrapper.checkpointExists(tag)}`);
      
      this.logInfo(`[BACKUP-FIRST] Conversation saved: ${tag} (${history.length} messages)`);
    } catch (error) {
      this.logError(`[BACKUP-FIRST] Failed to save conversation:`, error);
      throw error;
    }
  }

  /**
   * Get backup content for comparison
   */
  private async getBackupContent(tag: string): Promise<SyncMessage[]> {
    try {
      // Access the gemini handler through the sync engine
      // We know SyncEngine has geminiHandler property from its implementation
      const syncEngineWithHandlers = this.syncEngine as ISyncEngine & {
        geminiHandler: IProviderSyncHandler;
      };
      
      const backupFile = await syncEngineWithHandlers.geminiHandler.getBeforeFile(tag);
      const backupContent = await syncEngineWithHandlers.geminiHandler.readConversation(backupFile, tag);
      return backupContent;
    } catch (error) {
      this.logWarn(`[BACKUP-FIRST] Failed to read backup content:`, error);
      return [];
    }
  }

  /**
   * Run diff/sync after backup and save
   */
  private async runDiffSync(tag: string, forceSync: boolean = false): Promise<void> {
    try {
      this.logInfo(`[BACKUP-FIRST] runDiffSync called for ${tag} with forceSync=${forceSync}`);
      
      let shouldSync = false;
      let syncReason = '';
      
      if (forceSync) {
        shouldSync = true;
        syncReason = 'message count increased - forced sync';
        this.logInfo(`[BACKUP-FIRST] Force sync enabled for ${tag} - bypassing hasChangesToSync check`);
      } else {
        // Only check hasChangesToSync if not forcing sync
        try {
          shouldSync = await this.syncEngine.hasChangesToSync(tag);
          syncReason = shouldSync ? 'sync engine detected changes' : 'no changes detected by sync engine';
          this.logInfo(`[BACKUP-FIRST] hasChangesToSync result for ${tag}: ${shouldSync}`);
        } catch (error) {
          this.logError(`[BACKUP-FIRST] Failed to check hasChangesToSync for ${tag}`, error);
          // Assume sync needed if check fails
          shouldSync = true;
          syncReason = 'sync check failed - assuming sync needed';
        }
      }
      
      this.logInfo(`[BACKUP-FIRST] Sync decision for ${tag}: shouldSync=${shouldSync}, reason=${syncReason}`);
      
      if (shouldSync) {
        this.logInfo(`[BACKUP-FIRST] Executing sync for ${tag} (${syncReason})`);
        
        try {
          const syncResult = await this.syncEngine.syncSession(tag, 'gemini-to-claude');
          if (syncResult.success) {
            this.logInfo(`[BACKUP-FIRST] Sync completed successfully: ${tag} (${syncResult.syncedItems} items)`);
          } else {
            this.logWarn(`[BACKUP-FIRST] Sync completed with errors: ${tag}`, { 
              errors: syncResult.errors,
              syncedItems: syncResult.syncedItems 
            });
          }
        } catch (syncError) {
          this.logError(`[BACKUP-FIRST] Sync execution failed for session: ${tag}`, syncError);
          // Don't throw - sync failure shouldn't break the conversation save
        }
      } else {
        this.logInfo(`[BACKUP-FIRST] Skipping sync for ${tag}: ${syncReason}`);
      }
    } catch (error) {
      this.logError(`[BACKUP-FIRST] Unexpected error in runDiffSync for ${tag}:`, error);
      // Don't throw - sync checking is not critical for conversation functionality
    }
  }
}