/**
 * Gemini Session Management Service
 * Handles session lifecycle management for Gemini provider
 * Extracted from GeminiProvider.ts to reduce complexity
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../../../infrastructure/di/types.js';
import { ILoggerService } from '../../../../interfaces/core/ILoggerService.js';
import { BaseProvider } from '../../shared/BaseProvider.js';
import { GeminiCheckpointWrapper } from '../../../../utils/GeminiCheckpointWrapper.js';
import { GeminiBackupService } from './GeminiBackupService.js';

@injectable()
export class GeminiSessionManagementService extends BaseProvider {
  private currentSessionTag: string | null = null;

  constructor(
    @inject(TYPES.LoggerService) logger: ILoggerService,
    @inject(TYPES.GeminiBackupService) private backupService: GeminiBackupService
  ) {
    super();
    this.setLogger(logger);
  }

  async initialize(): Promise<void> {
    if (this.isProviderInitialized()) {
      return;
    }

    try {
      this.logInfo('Initializing Gemini Session Management Service');
      this.setInitialized(true);
      this.logInfo('Gemini Session Management Service initialized successfully');
    } catch (error) {
      const err = this.wrapError(error);
      this.logError('Failed to initialize Gemini Session Management Service', err);
      throw err;
    }
  }

  async cleanup(): Promise<void> {
    try {
      this.logInfo('Cleaning up Gemini Session Management Service');
      this.currentSessionTag = null;
      this.setInitialized(false);
      this.logInfo('Gemini Session Management Service cleaned up successfully');
    } catch (error) {
      const err = this.wrapError(error);
      this.logError('Failed to cleanup Gemini Session Management Service', err);
    }
  }

  getCurrentSessionTag(): string | null {
    return this.currentSessionTag;
  }

  setSessionTag(tag: string): void {
    this.validateSessionTag(tag);
    this.currentSessionTag = tag;
    this.logInfo(`Session tag set: ${tag}`);
  }

  async createSession(tag: string, checkpointWrapper: GeminiCheckpointWrapper): Promise<void> {
    this.ensureInitialized();
    this.validateSessionTag(tag);
    
    if (!checkpointWrapper) {
      throw new Error('Checkpoint wrapper not initialized');
    }
    
    this.currentSessionTag = tag;
    
    // Smart session creation - check if checkpoint already exists
    const checkpointExists = checkpointWrapper.checkpointExists(tag);
    
    if (checkpointExists) {
      this.logInfo(`Checkpoint already exists for tag: ${tag}, resuming instead of creating fresh`);
      return this.resumeSession(tag, checkpointWrapper);
    }
    
    // Only create fresh if no checkpoint exists
    this.logDebug(`No existing checkpoint, creating fresh session for tag: ${tag}`);
    await checkpointWrapper.initializeCheckpoint(tag);
    
    // Backup is now created in ProviderSwitchService BEFORE session operations
  }

  async resumeSession(tag: string, checkpointWrapper: GeminiCheckpointWrapper): Promise<void> {
    this.ensureInitialized();
    this.validateSessionTag(tag);
    if (!checkpointWrapper) {
      throw new Error('Checkpoint wrapper not initialized');
    }
    
    this.logInfo(`Starting resume for tag: ${tag}`);
    
    // Check if checkpoint exists before attempting resume
    const checkpointExists = checkpointWrapper.checkpointExists(tag);
    this.logDebug(`Checkpoint exists: ${checkpointExists}`, { tag, checkpointExists });
    
    if (!checkpointExists) {
      this.logWarn(`No checkpoint found for tag: ${tag}`);
      throw new Error(`No Gemini checkpoint found for tag: ${tag}`);
    }
    
    this.currentSessionTag = tag;
    this.logDebug(`Set current session tag to: ${tag}`);
    
    try {
      await checkpointWrapper.resumeFromCheckpoint(tag);
      this.logInfo(`Successfully resumed session: ${tag}`);
      
      // History is automatically available through shared chat instance
      // No need to sync separately
      
      // Backup is now created in ProviderSwitchService BEFORE session operations
    } catch (error) {
      this.logError(`Failed to resume session:`, error);
      throw error;
    }
  }

  /**
   * Internal method for saving session - only called by ProviderSwitchService
   * @internal
   */
  async saveSessionInternal(tag: string, checkpointWrapper: GeminiCheckpointWrapper): Promise<void> {
    this.ensureInitialized();
    if (!checkpointWrapper) {
      throw new Error('Checkpoint wrapper not initialized');
    }
    return checkpointWrapper.saveCheckpoint(tag);
  }

}