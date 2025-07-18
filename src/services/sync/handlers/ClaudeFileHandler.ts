/**
 * Claude File Handler - Claude session file management and synchronization
 * 
 * @class ClaudeFileHandler
 * @extends {FileHandler}
 * @description Manages Claude JSONL session files using linked-list tracking approach.
 * Before: session-abc123.jsonl (previous session ID from sync state)
 * After: session-def456.jsonl (current session ID from session registry)
 * Provides direct access to Claude's native session files without intermediate backups.
 */

import { injectable, inject } from "inversify";
import { TYPES } from "../../../infrastructure/di/types.js";
import { FileHandler } from "./FileHandler.js";
import { UniversalMessage } from "../types.js";
import { ClaudeToUniversal } from "../converters/ClaudeToUniversal.js";
import { UniversalToClaude } from "../converters/UniversalToClaude.js";
import * as os from "os";
import { ISyncStateService } from "../../../interfaces/sync/ISyncStateService.js";
import { ILoggerService } from "../../../interfaces/core/ILoggerService.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * Claude File Handler implementation
 * 
 * @class ClaudeFileHandler
 * @extends {FileHandler}
 * @description Handles Claude JSONL session files with linked-list session tracking.
 */
@injectable()
export class ClaudeFileHandler extends FileHandler {
  private syncState: ISyncStateService;
  private logger: ILoggerService;

  /**
   * Create Claude File Handler instance
   * 
   * @param {ILoggerService} logger - Logger service for diagnostics
   * @param {ISyncStateService} syncStateService - Sync state management service
   * @description Initializes handler with dependency injection for logging and state management.
   */
  constructor(
    @inject(TYPES.LoggerService) logger: ILoggerService,
    @inject(TYPES.SyncStateService) syncStateService: ISyncStateService
  ) {
    super();
    this.logger = logger;
    this.syncState = syncStateService;
  }

  /**
   * Get previous session file path for diff comparison
   * 
   * @param {string} sessionTag - Session identifier
   * @returns {Promise<string>} Path to previous Claude session file or empty string for first sync
   * @description Uses actual Claude session files directly from sync state tracking.
   * Returns empty string for first sync when no previous session exists.
   */
  async getBeforeFile(sessionTag: string): Promise<string> {
    const syncState = await this.syncState.getSyncState(sessionTag);
    this.logger.debug(
      `[ClaudeFileHandler] Before file lookup for ${sessionTag}: lastSessionId=${syncState.claude.lastSessionId}`
    );

    if (!syncState.claude.lastSessionId) {
      // First sync - no previous session exists
      // Return empty string that readConversation will handle
      this.logger.debug(`[ClaudeFileHandler] First sync - no previous session`);
      return "";
    }

    // Use actual previous Claude session file
    const beforePath = this.getSessionPath(syncState.claude.lastSessionId);
    this.logger.debug(`[ClaudeFileHandler] Using previous Claude session as before: ${beforePath}`);
    return beforePath;
  }

  /**
   * Get current session file path for diff comparison
   * 
   * @param {string} sessionTag - Session identifier
   * @returns {Promise<string>} Path to current Claude session file
   * @throws {Error} When current session ID not found
   * @description Uses actual Claude session file based on current session ID from registry.
   */
  async getAfterFile(sessionTag: string): Promise<string> {
    try {
      const currentSessionId = await this.getCurrentSessionId(sessionTag);
      if (!currentSessionId) {
        throw new Error(`No current Claude session ID found for: ${sessionTag}`);
      }

      // Check if sync state needs updating
      const syncState = await this.syncState.getSyncState(sessionTag);
      if (syncState.claude.currentSessionId !== currentSessionId) {
        this.logger.info(
          `[ClaudeFileHandler] Sync state out of date - updating currentSessionId from ${syncState.claude.currentSessionId} to ${currentSessionId}`
        );
        // Update sync state to reflect the actual current session
        await this.syncState.updateClaudeSession(sessionTag, currentSessionId);
      }

      // Use actual Claude session file path based on current session ID
      const afterPath = this.getSessionPath(currentSessionId);
      this.logger.debug(`[ClaudeFileHandler] Using actual Claude session file as after: ${afterPath}`);
      return afterPath;
    } catch (error) {
      this.logger.error(`[ClaudeFileHandler] Failed to get after file for ${sessionTag}:`, { error });
      throw error;
    }
  }

  /**
   * Read and parse Claude JSONL session file
   * 
   * @param {string} filePath - Path to Claude JSONL file
   * @param {string} [sessionId="unknown"] - Session identifier for conversion context
   * @returns {Promise<UniversalMessage[]>} Array of universal messages or empty array
   * @description Reads Claude JSONL format and converts to universal message format.
   * Handles empty files, missing files, and conversion errors gracefully.
   */
  async readConversation(filePath: string, sessionId: string = "unknown"): Promise<UniversalMessage[]> {
    // Handle empty path for first sync
    if (!filePath) {
      this.logger.debug(`[ClaudeFileHandler] Empty path - returning empty conversation`);
      return [];
    }

    this.logger.debug(`[ClaudeFileHandler] Reading conversation from: ${filePath}`);
    try {
      // Check if file exists and has content
      const stats = await fs.stat(filePath);
      if (stats.size === 0) {
        this.logger.debug(`[ClaudeFileHandler] File is empty (0 bytes): ${filePath}`);
        return [];
      }

      const content = await fs.readFile(filePath, "utf-8");
      const result = ClaudeToUniversal.convert(content, sessionId, this.logger);

      if (!result.success) {
        this.logger.warn(`Failed to convert Claude file ${filePath}:`, { error: result.error });
        return [];
      }

      const messages = result.data || [];
      this.logger.debug(`[ClaudeFileHandler] Read ${messages.length} messages from ${filePath}`);
      return messages;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && (error as any).code === "ENOENT") {
        // Return empty conversation if file doesn't exist
        this.logger.debug(`[ClaudeFileHandler] File not found (empty conversation): ${filePath}`);
        return [];
      }
      this.logger.warn(`Error reading Claude file ${filePath}:`, { error });
      return [];
    }
  }

  /**
   * Write universal messages to Claude JSONL format
   * 
   * @param {string} filePath - Path to write Claude JSONL file
   * @param {UniversalMessage[]} messages - Universal messages to convert and write
   * @param {string} [sessionId="unknown"] - Session identifier for conversion context
   * @returns {Promise<void>} Write completion promise
   * @throws {Error} When conversion fails or write operations fail
   * @description Converts universal messages to Claude JSONL format with atomic write operations.
   */
  async writeConversation(
    filePath: string,
    messages: UniversalMessage[],
    sessionId: string = "unknown"
  ): Promise<void> {
    try {
      this.logger.debug(`[ClaudeFileHandler] Converting ${messages.length} Universal messages to Claude format`);
      const result = UniversalToClaude.convert(messages, sessionId);

      if (!result.success) {
        throw new Error(`Failed to convert to Claude format: ${result.error}`);
      }

      const content = result.data || "";
      const lines = content
        .trim()
        .split("\n")
        .filter((line) => line.trim());
      this.logger.debug(`[ClaudeFileHandler] Converted to ${lines.length} JSONL lines`);

      // Validate conversion didn't lose messages
      if (messages.length > 0 && lines.length === 0) {
        throw new Error(`Conversion lost all messages: ${messages.length} input messages became 0 JSONL lines`);
      }

      // Create directory if it doesn't exist
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Atomic write using temporary file
      const tempPath = `${filePath}.tmp`;
      await fs.writeFile(tempPath, content, "utf-8");
      await fs.rename(tempPath, filePath);

      this.logger.info(`[ClaudeFileHandler] ✅ Successfully wrote ${lines.length} lines to ${filePath}`);
    } catch (error) {
      this.logger.error(`[ClaudeFileHandler] ❌ Failed to write Claude file ${filePath}:`, { error });
      throw new Error(`Failed to write Claude file ${filePath}: ${error}`);
    }
  }

  /**
   * Update session tracking before sync for proper diff detection
   * 
   * @param {string} sessionTag - Session identifier
   * @returns {Promise<void>} Update completion promise
   * @description NO-OP: We should NOT update sync state before computing diffs.
   * The sync state should only be updated AFTER successful sync completion.
   */
  async updateSessionTracking(sessionTag: string): Promise<void> {
    // IMPORTANT: Do NOT update sync state here!
    // The whole point of having lastSessionId vs currentSessionId is to track
    // what was synced last time vs what we have now.
    // If we update currentSessionId here, the diff engine will compare the same file to itself!
    this.logger.debug(
      `[ClaudeFileHandler] updateSessionTracking called for ${sessionTag} - NO-OP (sync state update deferred until after sync)`
    );
  }

  /**
   * Mark sync completion and update session tracking
   * 
   * @param {string} sessionTag - Session identifier
   * @returns {Promise<void>} Update completion promise
   * @description Updates sync state after successful sync by properly tracking the current session ID.
   */
  async updateAfterSync(sessionTag: string): Promise<void> {
    try {
      const currentSessionId = await this.getCurrentSessionId(sessionTag);
      if (currentSessionId) {
        // NOW we update the sync state after successful sync
        // This ensures the next sync will compare this session vs any new changes
        await this.syncState.updateClaudeSession(sessionTag, currentSessionId);
        this.logger.info(
          `[ClaudeFileHandler] Sync completed - updated sync state: ${sessionTag} -> ${currentSessionId}`
        );
      }
    } catch (error) {
      this.logger.warn(`Failed to update sync completion state for ${sessionTag}:`, { error });
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
   * Initialize session tracking state
   * 
   * @param {string} sessionTag - Session identifier
   * @returns {Promise<void>} Initialization completion promise
   * @description Sets up empty session tracking state for new sessions.
   */
  async initializeState(sessionTag: string): Promise<void> {
    try {
      // Do not initialize with current session ID - let it be set naturally during sync
      // This ensures proper before/after tracking
      this.logger.debug(`Claude session tracking initialized for: ${sessionTag} (empty state)`);
    } catch (error) {
      this.logger.warn(`Failed to initialize Claude state for ${sessionTag}:`, { error });
    }
  }

  /**
   * Generate Claude session file path from session ID
   * 
   * @param {string} sessionId - Claude session identifier
   * @returns {string} Absolute path to Claude JSONL session file
   * @throws {Error} When sessionId is invalid
   * @description Generates path following Claude's native file structure in ~/.claude/projects/.
   * @private
   */
  private getSessionPath(sessionId: string): string {
    if (!sessionId || typeof sessionId !== "string") {
      throw new Error(`Invalid session ID: ${sessionId}`);
    }

    // Claude session files are stored in ~/.claude/projects/{encoded-path}/
    const encodedPath = process.cwd().replace(/\//g, "-");
    const claudeProjectsDir = path.join(os.homedir(), ".claude", "projects");
    const sessionPath = path.join(claudeProjectsDir, encodedPath, `${sessionId}.jsonl`);

    this.logger.debug(`[ClaudeFileHandler] Generated session path for ${sessionId}: ${sessionPath}`);
    return sessionPath;
  }

  /**
   * Get current Claude session ID from reference file
   * 
   * @param {string} sessionTag - Session identifier
   * @returns {Promise<string | null>} Current session ID or null if not found
   * @description Reads session ID from .nexus/claude-ref/tagged-{sessionTag}.ref file.
   * This is the authoritative source for current Claude session ID.
   * @private
   */
  private async getCurrentSessionId(sessionTag: string): Promise<string | null> {
    try {
      // Read directly from ref file - this is the source of truth
      const refDir = path.join(process.cwd(), ".nexus", "claude-ref");
      const taggedPath = path.join(refDir, `tagged-${sessionTag}.ref`);

      const sessionId = await fs.readFile(taggedPath, "utf-8");
      const cleanSessionId = sessionId.trim();

      this.logger.debug(`[ClaudeFileHandler] getCurrentSessionId from ref file for ${sessionTag}: ${cleanSessionId}`);
      return cleanSessionId;
    } catch (error) {
      this.logger.warn(`Failed to get current Claude session ID from ref file for ${sessionTag}:`, { error });
      return null;
    }
  }
}
