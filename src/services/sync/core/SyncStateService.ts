/**
 * Sync State Service Implementation - Cross-provider synchronization state management
 *
 * @class SyncStateService
 * @implements {ISyncStateService}
 * @description Manages sync state tracking across sessions with persistent storage and file locking.
 * Provides thread-safe operations for synchronization state with automatic recovery mechanisms.
 */

import { injectable, inject } from "inversify";
import { TYPES } from "../../../infrastructure/di/types.js";
import { ILoggerService } from "../../../interfaces/core/ILoggerService";
import { ISyncStateService, ISyncState } from "../../../interfaces/sync/ISyncStateService";
import * as path from "node:path";
import * as fs from "node:fs/promises";

interface SyncStateFile {
  version: string;
  lastUpdated: number;
  states: Record<string, ISyncState>;
}

/**
 * Sync State Service implementation
 *
 * @class SyncStateService
 * @implements {ISyncStateService}
 * @description Handles persistent sync state management with file-based storage and distributed locking.
 */
@injectable()
export class SyncStateService implements ISyncStateService {
  private statePath: string;
  private lockPath: string;
  private static readonly VERSION = "1.0.0";
  private static readonly LOCK_TIMEOUT = 5000; // 5 seconds

  constructor(
    @inject(TYPES.LoggerService) private logger: ILoggerService,
    private projectRoot: string = process.cwd()
  ) {
    const nexusDir = path.join(this.projectRoot, ".nexus");
    this.statePath = path.join(nexusDir, "sync-state.json");
    this.lockPath = path.join(nexusDir, "sync-state.lock");
  }

  /**
   * Initialize sync state for a new session
   *
   * @param {string} sessionId - Unique session identifier
   * @returns {Promise<void>} Initialization completion promise
   * @description Creates initial sync state with default values and persists to storage.
   */
  async initializeState(sessionId: string): Promise<void> {
    const state: ISyncState = {
      sessionId,
      lastSyncTimestamp: new Date(),
      geminiVersion: "",
      claudeVersion: "",
      messageCount: 0,

      // Extended fields from SyncStateManager
      sessionTag: sessionId, // Use sessionId as sessionTag
      lastSyncTime: Date.now(),
      gemini: {
        backupPath: "",
        lastBackupTime: 0,
      },
      claude: {
        lastSessionId: "",
        currentSessionId: "",
        lastSyncTime: 0,
      },
    };

    await this.withLock(async () => {
      const stateFile = await this.readStateFile();
      stateFile.states[sessionId] = state;
      stateFile.lastUpdated = Date.now();
      await this.writeStateFile(stateFile);
    });

    this.logger.info(`Initialized sync state for session: ${sessionId}`);
  }

  /**
   * Retrieve sync state for a session
   *
   * @param {string} sessionId - Session identifier
   * @returns {Promise<ISyncState | null>} Sync state or null if not found
   * @description Loads sync state from persistent storage with error handling.
   */
  async getState(sessionId: string): Promise<ISyncState | null> {
    try {
      const stateFile = await this.readStateFile();
      return stateFile.states[sessionId] || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.warn(`Failed to load sync state for ${sessionId}: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Update sync state for a session
   *
   * @param {string} sessionId - Session identifier
   * @param {Partial<ISyncState>} updates - State updates to apply
   * @returns {Promise<void>} Update completion promise
   * @description Applies partial updates to sync state with timestamp tracking and locking.
   */
  async updateState(sessionId: string, updates: Partial<ISyncState>): Promise<void> {
    await this.withLock(async () => {
      const stateFile = await this.readStateFile();
      
      // Defensive check - ensure states object exists
      if (!stateFile.states) {
        this.logger.error("State file has no states object - should not happen after readStateFile fix");
        stateFile.states = {};
      }
      
      const currentState = stateFile.states[sessionId];

      if (!currentState) {
        throw new Error(`No sync state found for session: ${sessionId}`);
      }

      // Log sync state update for debugging
      this.logger.info(`[SYNC STATE] Updating state for ${sessionId}`, {
        messageCount: updates.messageCount || currentState.messageCount,
        caller: new Error().stack?.split("\n")[3]?.trim(), // Log caller for debugging
      });

      const updatedState: ISyncState = {
        ...currentState,
        ...updates,
        lastSyncTimestamp: new Date(),
        lastSyncTime: Date.now(),
      };

      // Defensive check before assignment
      if (!stateFile.states) {
        this.logger.error("State file has no states object before assignment - critical error");
        stateFile.states = {};
      }
      
      stateFile.states[sessionId] = updatedState;
      stateFile.lastUpdated = Date.now();
      await this.writeStateFile(stateFile);
    });

    this.logger.info(`Updated sync state for session: ${sessionId}`);
  }

  /**
   * List all sync states
   *
   * @returns {Promise<ISyncState[]>} Array of all sync states
   * @description Retrieves all stored sync states for monitoring and management.
   */
  async listStates(): Promise<ISyncState[]> {
    try {
      const stateFile = await this.readStateFile();
      return Object.values(stateFile.states);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.warn(`Failed to list sync states: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Remove sync state for a session
   *
   * @param {string} sessionId - Session identifier
   * @returns {Promise<void>} Removal completion promise
   * @description Deletes sync state from persistent storage with locking.
   */
  async removeState(sessionId: string): Promise<void> {
    await this.withLock(async () => {
      const stateFile = await this.readStateFile();
      delete stateFile.states[sessionId];
      stateFile.lastUpdated = Date.now();
      await this.writeStateFile(stateFile);
    });

    this.logger.info(`Removed sync state for session: ${sessionId}`);
  }

  /**
   * Check if sync state exists for a session
   *
   * @param {string} sessionId - Session identifier
   * @returns {Promise<boolean>} True if state exists
   * @description Validates sync state existence without loading full data.
   */
  async hasState(sessionId: string): Promise<boolean> {
    const state = await this.getState(sessionId);
    return state !== null;
  }

  /**
   * Get sync state with automatic creation if missing
   *
   * @param {string} sessionTag - Session tag identifier
   * @returns {Promise<ISyncState>} Sync state (created if not exists)
   * @description Extended method that ensures sync state always exists, creating default if needed.
   */
  async getSyncState(sessionTag: string): Promise<ISyncState> {
    const stateFile = await this.readStateFile();

    // Defensive check - ensure states object exists
    if (!stateFile.states) {
      this.logger.warn("State file has no states object in getSyncState - should not happen after readStateFile fix");
      stateFile.states = {};
    }

    const existingState = stateFile.states[sessionTag];
    if (existingState) {
      return existingState;
    }

    // Create new state if doesn't exist
    const newState: ISyncState = {
      sessionId: sessionTag,
      lastSyncTimestamp: new Date(),
      geminiVersion: "",
      claudeVersion: "",
      messageCount: 0,
      sessionTag,
      lastSyncTime: 0,
      gemini: {
        backupPath: "",
        lastBackupTime: 0,
      },
      claude: {
        lastSessionId: "",
        currentSessionId: "",
        lastSyncTime: 0,
      },
    };

    return newState;
  }

  /**
   * Update complete sync state
   *
   * @param {string} sessionTag - Session tag identifier
   * @param {ISyncState} state - Complete sync state to store
   * @returns {Promise<void>} Update completion promise
   * @description Replaces entire sync state with automatic timestamp updates.
   */
  async updateSyncState(sessionTag: string, state: ISyncState): Promise<void> {
    await this.withLock(async () => {
      const stateFile = await this.readStateFile();
      stateFile.states[sessionTag] = {
        ...state,
        lastSyncTime: Date.now(),
        lastSyncTimestamp: new Date(),
      };
      stateFile.lastUpdated = Date.now();
      await this.writeStateFile(stateFile);
    });
  }

  /**
   * Update Claude session tracking
   *
   * @param {string} sessionTag - Session tag identifier
   * @param {string} currentSessionId - Current Claude session ID
   * @returns {Promise<void>} Update completion promise
   * @description Manages Claude session transitions with last/current session tracking.
   */
  async updateClaudeSession(sessionTag: string, currentSessionId: string): Promise<void> {
    await this.withLock(async () => {
      const stateFile = await this.readStateFile();
      let state = stateFile.states[sessionTag];
      
      // Create new state inline if it doesn't exist (avoid recursive call)
      if (!state) {
        state = {
          sessionId: sessionTag,
          lastSyncTimestamp: new Date(),
          geminiVersion: "",
          claudeVersion: "",
          messageCount: 0,
          sessionTag,
          lastSyncTime: 0,
          gemini: {
            backupPath: "",
            lastBackupTime: 0,
          },
          claude: {
            lastSessionId: "",
            currentSessionId: "",
            lastSyncTime: 0,
          },
        };
      }

      this.logger.debug(
        `[SyncStateService] updateClaudeSession - Before: lastSessionId=${state.claude.lastSessionId}, currentSessionId=${state.claude.currentSessionId}`
      );

      // Move previous current to last
      if (state.claude.currentSessionId && state.claude.currentSessionId !== currentSessionId) {
        state.claude.lastSessionId = state.claude.currentSessionId;
        this.logger.debug(
          `[SyncStateService] Moving current to last: ${state.claude.currentSessionId} -> lastSessionId`
        );
      }

      state.claude.currentSessionId = currentSessionId;
      state.claude.lastSyncTime = Date.now();

      this.logger.debug(
        `[SyncStateService] updateClaudeSession - After: lastSessionId=${state.claude.lastSessionId}, currentSessionId=${state.claude.currentSessionId}`
      );

      stateFile.states[sessionTag] = state;
      stateFile.lastUpdated = Date.now();
      await this.writeStateFile(stateFile);
    });
  }

  /**
   * Initialize Claude session tracking
   *
   * @param {string} sessionTag - Session tag identifier
   * @param {string} sessionId - Initial Claude session ID
   * @returns {Promise<void>} Initialization completion promise
   * @description Sets up initial Claude session tracking for new sessions.
   */
  async initializeClaudeSession(sessionTag: string, sessionId: string): Promise<void> {
    const state = await this.getSyncState(sessionTag);

    // First time setup
    if (!state.claude.currentSessionId) {
      // For new sessions, set BOTH current and last session IDs to the same value
      // This ensures the first sync has a proper baseline for diff comparison
      state.claude.currentSessionId = sessionId;
      state.claude.lastSessionId = sessionId;
      await this.updateSyncState(sessionTag, state);
      this.logger.debug(`[SyncStateService] Initialized Claude session tracking: currentSessionId=${sessionId}, lastSessionId=${sessionId}`);
    }
  }

  /**
   * Mark synchronization as completed
   *
   * @param {string} sessionTag - Session tag identifier
   * @param {string} sessionId - Session ID that was synced
   * @returns {Promise<void>} Completion promise
   * @description Updates sync state to reflect completed synchronization operation.
   */
  async markSyncCompleted(sessionTag: string, sessionId: string): Promise<void> {
    await this.withLock(async () => {
      const stateFile = await this.readStateFile();
      let state = stateFile.states[sessionTag];
      
      // Create new state inline if it doesn't exist (avoid recursive call)
      if (!state) {
        state = {
          sessionId: sessionTag,
          lastSyncTimestamp: new Date(),
          geminiVersion: "",
          claudeVersion: "",
          messageCount: 0,
          sessionTag,
          lastSyncTime: 0,
          gemini: {
            backupPath: "",
            lastBackupTime: 0,
          },
          claude: {
            lastSessionId: "",
            currentSessionId: "",
            lastSyncTime: 0,
          },
        };
      }

      this.logger.debug(
        `[SyncStateService] markSyncCompleted - Before: lastSessionId=${state.claude.lastSessionId}, currentSessionId=${state.claude.currentSessionId}`
      );

      // Mark this session as synced by moving it to lastSessionId
      if (state.claude.currentSessionId === sessionId) {
        state.claude.lastSessionId = sessionId;
        this.logger.debug(`[SyncStateService] Sync completed - moved to lastSessionId: ${sessionId}`);
      }

      state.claude.lastSyncTime = Date.now();

      this.logger.debug(
        `[SyncStateService] markSyncCompleted - After: lastSessionId=${state.claude.lastSessionId}, currentSessionId=${state.claude.currentSessionId}`
      );

      stateFile.states[sessionTag] = state;
      stateFile.lastUpdated = Date.now();
      await this.writeStateFile(stateFile);
    });
  }

  /**
   * Update Gemini backup information
   *
   * @param {string} sessionTag - Session tag identifier
   * @param {string} backupPath - Path to Gemini backup file
   * @returns {Promise<void>} Update completion promise
   * @description Records Gemini backup location and timestamp for sync operations.
   */
  async updateGeminiBackup(sessionTag: string, backupPath: string): Promise<void> {
    await this.withLock(async () => {
      const stateFile = await this.readStateFile();
      let state = stateFile.states[sessionTag];
      
      // Create new state inline if it doesn't exist (avoid recursive call)
      if (!state) {
        state = {
          sessionId: sessionTag,
          lastSyncTimestamp: new Date(),
          geminiVersion: "",
          claudeVersion: "",
          messageCount: 0,
          sessionTag,
          lastSyncTime: 0,
          gemini: {
            backupPath: "",
            lastBackupTime: 0,
          },
          claude: {
            lastSessionId: "",
            currentSessionId: "",
            lastSyncTime: 0,
          },
        };
      }

      state.gemini.backupPath = backupPath;
      state.gemini.lastBackupTime = Date.now();

      stateFile.states[sessionTag] = state;
      stateFile.lastUpdated = Date.now();
      await this.writeStateFile(stateFile);
    });
  }

  /**
   * List all sync states (alias for listStates)
   *
   * @returns {Promise<ISyncState[]>} Array of all sync states
   * @description Convenience method for listing all sync states.
   */
  async listSyncStates(): Promise<ISyncState[]> {
    return this.listStates();
  }

  /**
   * Remove sync state (alias for removeState)
   *
   * @param {string} sessionTag - Session tag identifier
   * @returns {Promise<void>} Removal completion promise
   * @description Convenience method for removing sync state.
   */
  async removeSyncState(sessionTag: string): Promise<void> {
    return this.removeState(sessionTag);
  }

  /**
   * Read sync state file from storage
   *
   * @returns {Promise<SyncStateFile>} Parsed state file or empty structure
   * @description Loads and parses state file with automatic migration and error handling.
   * @private
   */
  private async readStateFile(): Promise<SyncStateFile> {
    try {
      const content = await fs.readFile(this.statePath, "utf-8");
      if (!content || content.trim() === "") {
        return this.createEmptyStateFile();
      }
      
      const stateFile = JSON.parse(content);

      // Validate structure and ensure states object exists
      if (!stateFile || typeof stateFile !== "object") {
        this.logger.warn("Invalid state file structure, creating new one");
        return this.createEmptyStateFile();
      }

      // Ensure states property exists and is an object
      if (!stateFile.states || typeof stateFile.states !== "object") {
        this.logger.warn("State file missing states object, initializing");
        stateFile.states = {};
      }

      // Ensure required properties exist
      if (!stateFile.version) {
        stateFile.version = SyncStateService.VERSION;
      }
      if (!stateFile.lastUpdated) {
        stateFile.lastUpdated = Date.now();
      }

      // Convert date strings back to Date objects for ISyncState
      Object.values(stateFile.states).forEach((state: any) => {
        if (state.lastSyncTimestamp && typeof state.lastSyncTimestamp === "string") {
          state.lastSyncTimestamp = new Date(state.lastSyncTimestamp);
        }
      });

      return stateFile;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return this.createEmptyStateFile();
      }
      
      // Handle JSON parse errors or other read errors
      if (error instanceof SyntaxError) {
        this.logger.warn("Corrupted state file detected, creating new one", { error: error.message });
        return this.createEmptyStateFile();
      }
      
      throw error;
    }
  }

  /**
   * Write sync state file to storage
   *
   * @param {SyncStateFile} stateFile - State file structure to write
   * @returns {Promise<void>} Write completion promise
   * @description Serializes and writes state file with directory creation.
   * @private
   */
  private async writeStateFile(stateFile: SyncStateFile): Promise<void> {
    const dir = path.dirname(this.statePath);
    await fs.mkdir(dir, { recursive: true });

    const content = JSON.stringify(stateFile, null, 2);
    await fs.writeFile(this.statePath, content, "utf-8");
  }

  /**
   * Create empty state file structure
   *
   * @returns {SyncStateFile} Empty state file with current version
   * @description Creates default state file structure for initialization.
   * @private
   */
  private createEmptyStateFile(): SyncStateFile {
    return {
      version: SyncStateService.VERSION,
      lastUpdated: Date.now(),
      states: {},
    };
  }

  /**
   * Execute operation with file locking
   *
   * @template T
   * @param {() => Promise<T>} operation - Operation to execute under lock
   * @returns {Promise<T>} Operation result
   * @description Provides thread-safe access to state file with timeout handling.
   * @private
   */
  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    const lockAcquired = await this.acquireLock();

    if (!lockAcquired) {
      throw new Error("Could not acquire sync state lock within timeout");
    }

    try {
      return await operation();
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Acquire file lock for state operations
   *
   * @returns {Promise<boolean>} True if lock acquired successfully
   * @description Implements distributed file locking with stale lock detection.
   * @private
   */
  private async acquireLock(): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < SyncStateService.LOCK_TIMEOUT) {
      try {
        await fs.writeFile(this.lockPath, process.pid.toString(), { flag: "wx" });
        return true;
      } catch (error: any) {
        if (error.code === "EEXIST") {
          // Check if existing lock is stale
          try {
            const lockContent = await fs.readFile(this.lockPath, "utf-8");
            const lockPid = parseInt(lockContent.trim());

            // Check if process is still running
            if (!this.isProcessRunning(lockPid)) {
              await fs.unlink(this.lockPath);
              continue;
            }
          } catch {
            // Remove lock file if can't read it
            await fs.unlink(this.lockPath);
            continue;
          }

          // Wait briefly before retry
          await new Promise((resolve) => setTimeout(resolve, 100));
        } else {
          throw error;
        }
      }
    }

    return false;
  }

  /**
   * Release file lock
   *
   * @returns {Promise<void>} Release completion promise
   * @description Removes lock file to allow other processes access.
   * @private
   */
  private async releaseLock(): Promise<void> {
    try {
      await fs.unlink(this.lockPath);
    } catch {
      // Ignore if lock file doesn't exist
    }
  }

  /**
   * Check if process is still running
   *
   * @param {number} pid - Process ID to check
   * @returns {boolean} True if process is running
   * @description Used for stale lock detection and cleanup.
   * @private
   */
  private isProcessRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }
}
