/**
 * Claude Session Service - Session lifecycle management for Claude provider
 * 
 * @class ClaudeSessionService
 * @extends {BaseProvider}
 * @description Handles Claude session management including creation, resumption, and session ID tracking.
 * Extracted from ClaudeProvider to reduce complexity and improve maintainability.
 */

import { injectable, inject } from "inversify";
import { TYPES } from "../../../../infrastructure/di/types.js";
import { ILoggerService } from "../../../../interfaces/core/ILoggerService.js";
import { ISyncStateService } from "../../../../interfaces/sync/ISyncStateService.js";
import { BaseProvider } from "../../shared/BaseProvider.js";
import { SessionRegistryManager } from "../../../sync/index.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

/**
 * Claude session information interface
 */
export interface ClaudeSessionInfo {
  sessionId: string;
  tag: string;
  createdAt: Date;
  lastActivity: Date;
  model: string | null;
  claudeActualSessionId: string | null;
}

/**
 * Claude session state interface
 */
export interface ClaudeSessionState {
  currentSessionId: string | null;
  sessionTag: string | null;
  currentSessionTag: string | null;
  claudeActualSessionId: string | null;
  currentModel: string | null;
  isCreatingSession: boolean;
  claudeProjectsDir: string;
}

/**
 * Claude Session Service implementation
 * 
 * @class ClaudeSessionService
 * @extends {BaseProvider}
 * @description Manages Claude session lifecycle, session ID tracking, and session registry integration.
 * Provides methods for creating, resuming, and managing Claude AI sessions.
 */
@injectable()
export class ClaudeSessionService extends BaseProvider {
  private sessionState: ClaudeSessionState;
  private registry: SessionRegistryManager | null = null;
  private syncStateService: ISyncStateService | null = null;

  constructor(
    @inject(TYPES.LoggerService) logger?: ILoggerService,
    @inject(TYPES.SyncStateService) syncStateService?: ISyncStateService
  ) {
    super();
    if (logger) {
      this.setLogger(logger);
    }
    if (syncStateService) {
      this.syncStateService = syncStateService;
    }

    this.sessionState = {
      currentSessionId: null,
      sessionTag: null,
      currentSessionTag: null,
      claudeActualSessionId: null,
      currentModel: null,
      isCreatingSession: false,
      claudeProjectsDir: path.join(os.homedir(), ".claude", "projects"),
    };
  }

  async initialize(): Promise<void> {
    this.setInitialized(true);
    this.logInfo("Claude Session Service initialized");
  }

  async cleanup(): Promise<void> {
    await this.resetSession();
    this.setInitialized(false);
    this.logInfo("Claude Session Service cleaned up");
  }

  /**
   * Set the current session tag
   */
  setSessionTag(sessionTag: string): void {
    this.sessionState.currentSessionTag = sessionTag;
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.sessionState.currentSessionId;
  }

  /**
   * Set current session ID (for testing purposes)
   */
  setCurrentSessionId(sessionId: string | null): void {
    this.sessionState.currentSessionId = sessionId;
  }

  /**
   * Save session tag (exposed for testing)
   */
  async saveSessionTag(tag: string, sessionId: string): Promise<void> {
    return this.saveSessionTagInternal(tag, sessionId);
  }

  /**
   * Find session by tag (exposed for testing)
   */
  async findSessionByTag(tag: string): Promise<string | null> {
    return this.findSessionByTagInternal(tag);
  }

  /**
   * Update registry with new session (exposed for testing)
   */
  async updateRegistryWithNewSession(sessionId: string, tag: string): Promise<void> {
    // Implementation for updating registry - basic version for testing
    if (this.registry) {
      // Registry update logic would go here
    }
  }

  /**
   * Get current session tag
   */
  getCurrentSessionTag(): string | null {
    return this.sessionState.currentSessionTag;
  }

  /**
   * Get Claude's actual session ID from stream
   */
  getClaudeActualSessionId(): string | null {
    return this.sessionState.claudeActualSessionId;
  }

  /**
   * Set Claude's actual session ID from stream
   */
  setClaudeActualSessionId(sessionId: string): void {
    const previousSessionId = this.sessionState.claudeActualSessionId;
    this.sessionState.claudeActualSessionId = sessionId;

    if (previousSessionId !== sessionId && sessionId) {
      this.logDebug(`Claude session changed: ${previousSessionId} → ${sessionId}`);
    }
  }

  /**
   * Update session ID from system or result messages
   */
  updateSessionId(sessionId: string, source: "system" | "result" = "system"): void {
    // Skip session ID updates when Claude is running in MCP mode
    if (process.env.CLAUDE_MCP_MODE === "1") {
      this.logDebug(`Skipping session ID update in MCP mode: ${sessionId}`);
      return;
    }

    if (sessionId && sessionId !== this.sessionState.currentSessionId) {
      const previousSessionId = this.sessionState.currentSessionId;
      this.sessionState.currentSessionId = sessionId;

      if (!previousSessionId || this.sessionState.isCreatingSession) {
        this.logInfo(`Claude session ID set: ${sessionId}`);
        
        // Initialize sync state for the first session
        if (this.syncStateService && this.sessionState.sessionTag) {
          this.syncStateService.initializeClaudeSession(this.sessionState.sessionTag, sessionId)
            .then(() => {
              this.logDebug(`Initialized sync state for session tag: ${this.sessionState.sessionTag}, session ID: ${sessionId}`);
            })
            .catch((error) => {
              this.logWarn(`Failed to initialize sync state for first session:`, error);
            });
        }
      } else {
        this.logInfo(`Claude session ID updated (conversation continuation): ${previousSessionId} → ${sessionId}`);
      }

      // Update ref file with the session ID for linked-list pattern
      if (this.sessionState.sessionTag && sessionId) {
        this.saveSessionTagInternal(this.sessionState.sessionTag, sessionId).catch((error) => {
          this.logWarn(`Failed to update claude-ref with ${source} session ID:`, error);
        });
      }
    }
  }

  /**
   * Set current model
   */
  setCurrentModel(model: string): void {
    this.sessionState.currentModel = model;
  }

  /**
   * Get current model
   */
  getCurrentModel(): string | null {
    return this.sessionState.currentModel;
  }

  /**
   * Check if currently creating a session
   */
  isCreatingSession(): boolean {
    return this.sessionState.isCreatingSession;
  }

  /**
   * Set session creation mode
   */
  setCreatingSession(creating: boolean): void {
    this.sessionState.isCreatingSession = creating;
  }

  /**
   * Load session ID if not already loaded
   */
  async loadSessionIfNeeded(): Promise<void> {
    if (!this.sessionState.currentSessionId && !this.sessionState.isCreatingSession) {
      try {
        // Try to find the session ID using claude-ref files (faster than registry lookup)
        if (this.sessionState.sessionTag) {
          const sessionId = await this.findSessionByTagInternal(this.sessionState.sessionTag);
          if (sessionId) {
            this.sessionState.currentSessionId = sessionId;
            this.logInfo(`Loaded session ID from claude-ref: ${this.sessionState.sessionTag} -> ${sessionId}`);
          }
        } else if (this.registry && this.sessionState.currentSessionTag) {
          // Fallback: get session from registry to find the tag, then look up ref file
          const session = await this.registry.getSession(this.sessionState.currentSessionTag);
          if (session && session.tag) {
            const sessionId = await this.findSessionByTagInternal(session.tag);
            if (sessionId) {
              this.sessionState.currentSessionId = sessionId;
              this.sessionState.sessionTag = session.tag;
              this.logInfo(`Loaded session ID via registry tag lookup: ${session.tag} -> ${sessionId}`);
            }
          }
        }
      } catch (error) {
        this.logWarn(`Failed to load session ID from claude-ref: ${error}`);
      }
    }
  }

  /**
   * Create new session (Session Creation Mode - fresh session files)
   */
  async createSession(tag: string): Promise<string> {
    this.ensureInitialized();
    this.validateSessionTag(tag);

    // ALWAYS CREATE FRESH SESSION - No smart detection
    this.resetSessionState();
    this.sessionState.sessionTag = tag;
    this.sessionState.isCreatingSession = true;

    this.logInfo(`Creating fresh Claude session: ${tag} (Session Creation Mode)`);
    return tag;
  }

  /**
   * Complete session creation with session ID
   */
  async completeSessionCreation(sessionId: string): Promise<void> {
    if (!this.sessionState.isCreatingSession || !this.sessionState.sessionTag) {
      throw new Error("No session creation in progress");
    }

    this.sessionState.currentSessionId = sessionId;
    await this.saveSessionTagInternal(this.sessionState.sessionTag, sessionId);

    this.logInfo(`Fresh Claude session created: ${this.sessionState.sessionTag} -> ${sessionId}`);
    this.sessionState.isCreatingSession = false;
  }

  /**
   * Resume session
   */
  async resumeSession(tag: string): Promise<void> {
    this.ensureInitialized();
    this.validateSessionTag(tag);

    try {
      const sessionId = await this.findSessionByTagInternal(tag);

      if (!sessionId) {
        throw new Error(`No session found with tag: ${tag}`);
      }

      this.sessionState.currentSessionId = sessionId;
      this.sessionState.sessionTag = tag;

      // Ensure ref file exists for future resumes
      await this.saveSessionTagInternal(tag, sessionId);

      // Verify Claude session file exists
      const memoryFile = this.getCurrentMemoryFile();
      if (memoryFile) {
        try {
          await fs.access(memoryFile);
          this.logInfo(`Claude session file verified: ${memoryFile}`);
        } catch {
          this.logWarn(`Claude session file not found: ${memoryFile}`);
        }
      }

      this.logInfo(`Ready to resume Claude streaming session: ${sessionId} (tag: ${tag})`);
    } catch (error) {
      throw new Error(`Failed to resume session: ${error}`);
    }
  }

  /**
   * Save current session
   */
  async saveSession(tag: string): Promise<void> {
    this.ensureInitialized();

    if (!this.sessionState.currentSessionId) {
      throw new Error("No active Claude session to save");
    }

    await this.saveSessionTagInternal(tag, this.sessionState.currentSessionId);
    this.logInfo(`Claude streaming session saved: ${tag} -> ${this.sessionState.currentSessionId}`);
  }

  /**
   * Get current memory file path
   */
  getCurrentMemoryFile(): string | null {
    if (!this.sessionState.currentSessionId) return null;

    const projectDir = this.getProjectDir();
    return path.join(projectDir, `${this.sessionState.currentSessionId}.jsonl`);
  }

  /**
   * Get session information
   */
  getSessionInfo(): ClaudeSessionInfo | null {
    if (!this.sessionState.currentSessionId || !this.sessionState.sessionTag) {
      return null;
    }

    return {
      sessionId: this.sessionState.currentSessionId,
      tag: this.sessionState.sessionTag,
      createdAt: new Date(), // Would need to track this properly
      lastActivity: new Date(),
      model: this.sessionState.currentModel,
      claudeActualSessionId: this.sessionState.claudeActualSessionId,
    };
  }

  /**
   * Reset session state
   */
  private resetSessionState(): void {
    this.sessionState.currentSessionId = null;
    this.sessionState.sessionTag = null;
    this.sessionState.claudeActualSessionId = null;
    this.sessionState.currentModel = null;
    this.sessionState.isCreatingSession = false;
  }

  /**
   * Reset session completely
   */
  async resetSession(): Promise<void> {
    this.resetSessionState();
    this.logDebug("Session state reset");
  }

  /**
   * Save session tag to ref file
   */
  private async saveSessionTagInternal(tag: string, sessionId: string): Promise<void> {
    try {
      const refDir = path.join(process.cwd(), ".nexus", "claude-ref");
      await fs.mkdir(refDir, { recursive: true });

      const taggedPath = path.join(refDir, `tagged-${tag}.ref`);
      await fs.writeFile(taggedPath, sessionId, "utf-8");
      this.logDebug(`Claude session ref file updated: ${tag} -> ${sessionId}`);
    } catch (error) {
      this.logWarn(`Failed to save session tag: ${error}`);
    }
  }

  /**
   * Find session by tag
   */
  private async findSessionByTagInternal(tag: string): Promise<string | null> {
    try {
      // Check ref file FIRST (contains latest session ID after each conversation)
      const refDir = path.join(process.cwd(), ".nexus", "claude-ref");
      const taggedPath = path.join(refDir, `tagged-${tag}.ref`);

      try {
        const sessionId = await fs.readFile(taggedPath, "utf-8");
        const cleanSessionId = sessionId.trim();
        this.logDebug(`Found Claude session ID from ref file (LATEST): ${cleanSessionId} (tag: ${tag})`);
        return cleanSessionId;
      } catch (refError) {
        this.logDebug(`No ref file found for tag: ${tag}, checking registry...`);
      }

      // Fallback: Check registry (may contain stale session ID)
      if (this.registry) {
        await this.registry.initialize();
        const session = await this.registry.getSession(tag);

        if (session && session.providers?.claude?.sessionId) {
          this.logDebug(
            `Found Claude session ID from registry (FALLBACK): ${session.providers.claude.sessionId} (tag: ${tag})`
          );
          return session.providers.claude.sessionId;
        }
      }

      return null;
    } catch (error) {
      this.logWarn(`Failed to find session by tag: ${tag}`, error);
      return null;
    }
  }

  /**
   * Get project directory
   */
  private getProjectDir(): string {
    const encodedPath = process.cwd().replace(/\//g, "-");
    return path.join(this.sessionState.claudeProjectsDir, encodedPath);
  }

  /**
   * Set registry (for dependency injection)
   */
  setRegistry(registry: SessionRegistryManager): void {
    this.registry = registry;
  }

  /**
   * Get current session state for debugging
   */
  getSessionState(): Readonly<ClaudeSessionState> {
    return { ...this.sessionState };
  }
}
