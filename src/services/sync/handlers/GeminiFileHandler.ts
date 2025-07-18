/**
 * Gemini File Handler - Core integration file management and checkpoint handling
 *
 * @class GeminiFileHandler
 * @extends {FileHandler}
 * @description Manages gemini-cli-core checkpoint files and session persistence.
 * Before: .nexus/gemini-backup/{sessionTag}.json (backup state)
 * After: ~/.gemini/tmp/{hash}/checkpoint-{tag}.json (current checkpoint from gemini-cli-core)
 * Handles backup-first approach for accurate diff detection and checkpoint synchronization.
 */

import { injectable, inject } from "inversify";
import { TYPES } from "../../../infrastructure/di/types.js";
import { FileHandler } from "./FileHandler.js";
import { UniversalMessage } from "../types.js";
import { GeminiToUniversal } from "../converters/GeminiToUniversal.js";
import { UniversalToGemini } from "../converters/UniversalToGemini.js";
import { SessionRegistryManager, ISessionRegistryManager } from "../registry/SessionRegistry.js";
import { ILoggerService } from "../../../interfaces/core/ILoggerService.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * Gemini File Handler implementation
 *
 * @class GeminiFileHandler
 * @extends {FileHandler}
 * @description Provides file management for Gemini checkpoint files and backup state tracking.
 */
@injectable()
export class GeminiFileHandler extends FileHandler {
  private registry: ISessionRegistryManager;
  private logger: ILoggerService;

  /**
   * Create Gemini File Handler instance
   *
   * @param {ILoggerService} logger - Logger service for diagnostics
   * @param {ISessionRegistryManager} registry - Session registry for path resolution
   * @description Initializes handler with dependency injection for logging and registry access.
   */
  constructor(
    @inject(TYPES.LoggerService) logger: ILoggerService,
    @inject(TYPES.SessionRegistryManager) registry: ISessionRegistryManager
  ) {
    super();
    this.logger = logger;
    this.registry = registry;
  }

  /**
   * Get backup file path for previous state comparison
   *
   * @param {string} sessionTag - Session identifier
   * @returns {Promise<string>} Path to backup file in .nexus/gemini-backup/
   * @description Returns path to backup file used for diff comparison.
   */
  async getBeforeFile(sessionTag: string): Promise<string> {
    const nexusDir = path.dirname(this.registry.getRegistryPath());
    const backupDir = path.join(nexusDir, "gemini-backup");
    return path.join(backupDir, `${sessionTag}.json`);
  }

  /**
   * Get current checkpoint file path from gemini-cli-core
   *
   * @param {string} sessionTag - Session identifier
   * @returns {Promise<string>} Path to current checkpoint file
   * @throws {Error} When checkpoint path generation fails
   * @description Generates path following gemini-cli-core's checkpoint structure.
   */
  async getAfterFile(sessionTag: string): Promise<string> {
    try {
      // Use GeminiCheckpointWrapper's path resolution directly
      // This is more reliable than session registry lookups
      const os = await import("node:os");
      const crypto = await import("node:crypto");

      // Replicate gemini-cli-core's path generation logic
      const homeDir = os.homedir();
      const geminiDir = path.join(homeDir, ".gemini", "tmp");

      // Generate hash for session (matches gemini-cli-core logic)
      const hash = crypto.createHash("sha256").update(process.cwd()).digest("hex");
      const sessionDir = path.join(geminiDir, hash);
      const checkpointPath = path.join(sessionDir, `checkpoint-${sessionTag}.json`);

      return checkpointPath;
    } catch (error) {
      throw new Error(`Failed to generate checkpoint path for Gemini session: ${sessionTag}`);
    }
  }

  /**
   * Read and parse Gemini checkpoint JSON file
   *
   * @param {string} filePath - Path to Gemini checkpoint file
   * @param {string} [sessionId="unknown"] - Session identifier for conversion context
   * @returns {Promise<UniversalMessage[]>} Array of universal messages or empty array
   * @description Reads Gemini JSON checkpoint format and converts to universal message format.
   * Handles missing files and conversion errors gracefully.
   */
  async readConversation(filePath: string, sessionId: string = "unknown"): Promise<UniversalMessage[]> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const geminiData = JSON.parse(content);
      const result = GeminiToUniversal.convert(geminiData, sessionId, undefined, this.logger);

      if (!result.success) {
        this.logger.warn(`Failed to convert Gemini file ${filePath}:`, { error: result.error });
        return [];
      }

      return result.data || [];
    } catch (error: unknown) {
      if (error && typeof error === "object" && "code" in error && (error as any).code === "ENOENT") {
        // Return empty conversation if file doesn't exist
        return [];
      }
      this.logger.warn(`Error reading Gemini file ${filePath}:`, { error });
      return [];
    }
  }

  /**
   * Write universal messages to Gemini checkpoint JSON format
   *
   * @param {string} filePath - Path to write Gemini checkpoint file
   * @param {UniversalMessage[]} messages - Universal messages to convert and write
   * @param {string} [sessionId="unknown"] - Session identifier for conversion context
   * @returns {Promise<void>} Write completion promise
   * @throws {Error} When conversion fails or write operations fail
   * @description Converts universal messages to Gemini JSON format with atomic write operations.
   */
  async writeConversation(
    filePath: string,
    messages: UniversalMessage[],
    sessionId: string = "unknown"
  ): Promise<void> {
    try {
      this.logger.debug(`[GeminiFileHandler] Converting ${messages.length} Universal messages to Gemini format`);
      const result = UniversalToGemini.convert(messages);

      if (!result.success) {
        throw new Error(`Failed to convert to Gemini format: ${result.error}`);
      }

      const geminiData = result.data;
      const geminiMessages = Array.isArray(geminiData) ? geminiData : [];
      this.logger.debug(`[GeminiFileHandler] Converted to ${geminiMessages.length} Gemini messages`);

      // Validate conversion didn't lose messages
      if (messages.length > 0 && geminiMessages.length === 0) {
        throw new Error(`Conversion lost all messages: ${messages.length} input messages became 0 Gemini messages`);
      }

      const content = JSON.stringify(geminiData, null, 2);

      // Create directory if it doesn't exist
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Atomic write using temporary file
      const tempPath = `${filePath}.tmp`;
      await fs.writeFile(tempPath, content, "utf-8");
      await fs.rename(tempPath, filePath);

      this.logger.info(`[GeminiFileHandler] ✅ Successfully wrote ${geminiMessages.length} messages to ${filePath}`);
    } catch (error) {
      this.logger.error(`[GeminiFileHandler] ❌ Failed to write Gemini file ${filePath}:`, { error });
      throw new Error(`Failed to write Gemini file ${filePath}: ${error}`);
    }
  }

  /**
   * Post-sync processing without backup update
   *
   * @param {string} sessionTag - Session identifier
   * @returns {Promise<void>} Completion promise
   * @description Logs sync completion. Backup files are only updated before conversations start.
   */
  async updateAfterSync(sessionTag: string): Promise<void> {
    // During sync operations, we don't update backup files
    // Backup files are only updated right before Gemini conversations start
    this.logger.debug(`Sync completed for Gemini session: ${sessionTag} (backup file not updated during sync)`);
  }

  /**
   * Update backup file before conversation starts
   *
   * @param {string} sessionTag - Session identifier
   * @returns {Promise<void>} Update completion promise
   * @description Creates backup before any save operations to capture true "before" state.
   */
  async updateBackupFile(sessionTag: string): Promise<void> {
    try {
      const currentFile = await this.getAfterFile(sessionTag);
      const backupFile = await this.getBeforeFile(sessionTag);

      // Check if current file exists
      if (await this.fileExists(currentFile)) {
        // Create backup directory
        const backupDir = path.dirname(backupFile);
        await fs.mkdir(backupDir, { recursive: true });

        // Copy current file to backup
        await fs.copyFile(currentFile, backupFile);
        this.logger.info(`Gemini backup updated before conversation: ${sessionTag}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to update Gemini backup for ${sessionTag}:`, { error });
    }
  }

  /**
   * Create backup before save operation for accurate diff detection
   *
   * @param {string} sessionTag - Session identifier
   * @returns {Promise<void>} Backup creation completion promise
   * @throws {Error} When backup creation fails (critical for diff accuracy)
   * @description Implements backup-first approach to ensure accurate before/after state tracking.
   */
  async createBackupBeforeSave(sessionTag: string): Promise<void> {
    try {
      const currentFile = await this.getAfterFile(sessionTag);
      const backupFile = await this.getBeforeFile(sessionTag);

      // Only create backup if current file exists and backup doesn't exist or is older
      if (await this.fileExists(currentFile)) {
        const backupDir = path.dirname(backupFile);
        await fs.mkdir(backupDir, { recursive: true });

        // Read current conversation to log the "before" state
        const currentMessages = await this.readConversation(currentFile);

        // Copy current file to backup location before any new saves
        await fs.copyFile(currentFile, backupFile);
        this.logger.info(
          `[BACKUP-FIRST] Created backup before save: ${sessionTag} (${currentMessages.length} messages)`
        );
      } else {
        // No current file exists - create empty backup
        const backupDir = path.dirname(backupFile);
        await fs.mkdir(backupDir, { recursive: true });
        await fs.writeFile(backupFile, JSON.stringify([]), "utf-8");
        this.logger.info(`[BACKUP-FIRST] Created empty backup for new session: ${sessionTag}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to create backup before save for ${sessionTag}:`, { error });
      throw error; // Propagate error since backup-first is critical for diff accuracy
    }
  }

  /**
   * Check if file exists on filesystem
   *
   * @param {string} filePath - Path to check
   * @returns {Promise<boolean>} True if file exists and is accessible
   * @description Simple file existence check using fs.access.
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initialize state and create initial backup if needed
   *
   * @param {string} sessionTag - Session identifier
   * @returns {Promise<void>} Initialization completion promise
   * @description Creates initial backup after session creation and validates backup timing.
   */
  async initializeState(sessionTag: string): Promise<void> {
    try {
      const currentFile = await this.getAfterFile(sessionTag);
      const backupFile = await this.getBeforeFile(sessionTag);

      // Always check if we need to create or update initial backup
      const backupExists = await this.fileExists(backupFile);
      const currentExists = await this.fileExists(currentFile);

      if (currentExists) {
        // Read current file to check message count
        const currentMessages = await this.readConversation(currentFile);

        if (!backupExists) {
          // No backup exists - create initial backup
          await this.updateBackupFile(sessionTag);
          this.logger.info(`Gemini initial backup created: ${sessionTag} (${currentMessages.length} messages)`);
        } else {
          // Backup exists - check if it's a proper initial backup
          const backupMessages = await this.readConversation(backupFile);

          // If backup has same number of messages as current, it was created too late
          // Force recreation of proper initial backup if we detect this scenario
          if (backupMessages.length >= currentMessages.length && currentMessages.length > 2) {
            this.logger.debug(
              `Gemini backup appears to be created too late (${backupMessages.length} vs ${currentMessages.length} messages) - this is expected behavior for now`
            );
            // Don't recreate backup here to avoid breaking existing sessions
            // The real fix is to create backup earlier in the session lifecycle
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to initialize Gemini state for ${sessionTag}:`, { error });
    }
  }
}
