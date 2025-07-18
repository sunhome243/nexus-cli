/**
 * Session Registry Manager - Atomic session registry management with process-aware tracking
 *
 * @class SessionRegistryManager
 * @implements {ISessionRegistryManager}
 * @description Manages session registry in .nexus/sessions.json with atomic file operations.
 * Supports multiple concurrent Nexus instances with process-aware session tracking,
 * file locking for race condition prevention, and provider-agnostic session management.
 * Features atomic operations, stale lock detection, and comprehensive session lifecycle management.
 */

import { injectable, inject } from "inversify";
import { TYPES } from "../../../infrastructure/di/types.js";
import { ILoggerService } from "../../../interfaces/core/ILoggerService.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Provider-specific session information structure
 *
 * @interface ProviderSessionInfo
 * @description Contains provider-specific session data for registry tracking.
 */
export interface ProviderSessionInfo {
  /** Provider-specific session ID */
  sessionId: string;
  /** Provider-specific session file paths */
  sessionPaths: Record<string, string>;
  /** Provider-specific metadata */
  metadata?: Record<string, any>;
}

/**
 * Session registry entry structure
 *
 * @interface SessionRegistryEntry
 * @description Complete session information stored in the registry.
 */
interface SessionRegistryEntry {
  /** Session tag (used as primary identifier) */
  tag: string;
  /** Process ID that created this session */
  pid: number;
  /** Timestamp when session was created */
  createdAt: number;
  /** Last activity timestamp */
  lastActivity: number;
  /** Provider-agnostic session information indexed by provider type */
  providers: Record<string, ProviderSessionInfo>;
  /** Session status */
  status: "active" | "archived";
}

/**
 * Session Registry Manager interface
 *
 * @interface ISessionRegistryManager
 * @description Defines the contract for session registry management operations.
 */
export interface ISessionRegistryManager {
  initialize(): Promise<void>;
  registerSession(tag: string, providers?: Record<string, ProviderSessionInfo>): Promise<void>;
  updateSessionProvider(tag: string, providerType: string, sessionInfo: ProviderSessionInfo): Promise<void>;
  getSession(tag: string): Promise<SessionRegistryEntry | null>;
  listActiveSessions(): Promise<SessionRegistryEntry[]>;
  listAllSessions(): Promise<SessionRegistryEntry[]>;
  getMostRecentActiveSession(): Promise<SessionRegistryEntry | null>;
  updateActivity(tag: string): Promise<void>;
  archiveSession(tag: string): Promise<void>;
  removeSession(tag: string): Promise<void>;
  isSessionOwner(tag: string): Promise<boolean>;
  getStats(): Promise<{
    total: number;
    active: number;
    archived: number;
    currentProcess: number;
  }>;
  getRegistryPath(): string;
}

/**
 * Session registry file structure
 *
 * @interface SessionRegistry
 * @description Root structure of the sessions.json registry file.
 */
interface SessionRegistry {
  /** Registry format version */
  version: string;
  /** When registry was created */
  createdAt: number;
  /** Last update timestamp */
  lastUpdated: number;
  /** All session entries indexed by session tag */
  sessions: Record<string, SessionRegistryEntry>;
}

/**
 * Session Registry Manager implementation
 *
 * @class SessionRegistryManager
 * @implements {ISessionRegistryManager}
 * @description Provides atomic session registry management with file locking and process tracking.
 */
@injectable()
export class SessionRegistryManager implements ISessionRegistryManager {
  private registryPath: string;
  private lockPath: string;
  private currentPid: number;
  private static readonly LOCK_TIMEOUT = 5000; // 5 seconds
  private static readonly REGISTRY_VERSION = "1.0.0";

  /**
   * Create Session Registry Manager instance
   *
   * @param {ILoggerService} logger - Logger service for diagnostics
   * @param {string} [projectRoot=process.cwd()] - Project root directory
   * @description Initializes paths and process tracking for session management.
   */
  constructor(@inject(TYPES.LoggerService) private logger: ILoggerService, projectRoot: string = process.cwd()) {
    const nexusDir = path.join(projectRoot, ".nexus");
    this.registryPath = path.join(nexusDir, "sessions.json");
    this.lockPath = path.join(nexusDir, "sessions.lock");
    this.currentPid = process.pid;
  }

  /**
   * Initialize the session registry system
   *
   * @returns {Promise<void>} Initialization completion promise
   * @throws {Error} When directory creation or registry initialization fails
   * @description Creates .nexus directory structure and initializes empty registry if needed.
   */
  async initialize(): Promise<void> {
    const nexusDir = path.dirname(this.registryPath);

    try {
      // Create all required directories for new users
      await fs.mkdir(nexusDir, { recursive: true });
      await fs.mkdir(path.join(nexusDir, "claude-ref"), { recursive: true });
      await fs.mkdir(path.join(nexusDir, "gemini-backup"), { recursive: true });

      // Create empty registry if it doesn't exist
      try {
        await fs.access(this.registryPath);
      } catch {
        await this.createEmptyRegistry();
      }
      // Removed cleanupOrphanedSessions() call
    } catch (error) {
      throw new Error(`Failed to initialize SessionRegistry: ${error}`);
    }
  }

  /**
   * Register a new session with atomic file operations
   *
   * @param {string} tag - Unique session identifier
   * @param {Record<string, ProviderSessionInfo>} [providers={}] - Provider-specific session data
   * @returns {Promise<void>} Registration completion promise
   * @throws {Error} When session registration fails or lock cannot be acquired
   * @description Atomically registers new session with current process PID and timestamp.
   */
  async registerSession(tag: string, providers: Record<string, ProviderSessionInfo> = {}): Promise<void> {
    const now = Date.now();

    const entry: SessionRegistryEntry = {
      tag,
      pid: this.currentPid,
      createdAt: now,
      lastActivity: now,
      providers,
      status: "active",
    };

    await this.withLock(async (registry) => {
      registry.sessions[tag] = entry;
      registry.lastUpdated = now;
      return registry;
    });
  }

  /**
   * Update provider information for existing session
   *
   * @param {string} tag - Session identifier
   * @param {string} provider - Provider type (claude, gemini, etc.)
   * @param {ProviderSessionInfo} providerInfo - Updated provider session information
   * @returns {Promise<void>} Update completion promise
   * @throws {Error} When session not found or update fails
   * @description Atomically updates provider-specific session data and activity timestamp.
   */
  async updateSessionProvider(tag: string, provider: string, providerInfo: ProviderSessionInfo): Promise<void> {
    await this.withLock(async (registry) => {
      const session = registry.sessions[tag];
      if (!session) {
        throw new Error(`Session not found: ${tag}`);
      }

      // Update provider information using generic interface
      session.providers[provider] = providerInfo;

      session.lastActivity = Date.now();
      registry.lastUpdated = Date.now();

      return registry;
    });
  }

  /**
   * Retrieve session entry by tag
   *
   * @param {string} tag - Session identifier
   * @returns {Promise<SessionRegistryEntry | null>} Session entry or null if not found
   * @description Reads session from registry without locking (read-only operation).
   */
  async getSession(tag: string): Promise<SessionRegistryEntry | null> {
    const registry = await this.readRegistry();
    return registry.sessions[tag] || null;
  }

  /**
   * List active sessions for current process
   *
   * @returns {Promise<SessionRegistryEntry[]>} Array of active sessions sorted by last activity
   * @description Returns only sessions owned by current process with active status.
   */
  async listActiveSessions(): Promise<SessionRegistryEntry[]> {
    const registry = await this.readRegistry();

    return Object.values(registry.sessions)
      .filter((s) => s.pid === this.currentPid && s.status === "active")
      .sort((a, b) => b.lastActivity - a.lastActivity);
  }

  /**
   * List all sessions from all processes
   *
   * @returns {Promise<SessionRegistryEntry[]>} Array of all sessions sorted by last activity
   * @description Returns sessions from all processes including archived ones.
   */
  async listAllSessions(): Promise<SessionRegistryEntry[]> {
    const registry = await this.readRegistry();

    return Object.values(registry.sessions).sort((a, b) => b.lastActivity - a.lastActivity);
  }

  /**
   * Get most recent active session across all processes
   *
   * @returns {Promise<SessionRegistryEntry | null>} Most recently active session or null
   * @description Used for session resumption across app restarts. Considers all processes.
   */
  async getMostRecentActiveSession(): Promise<SessionRegistryEntry | null> {
    const registry = await this.readRegistry();

    const activeSessions = Object.values(registry.sessions)
      .filter((s) => s.status === "active")
      .sort((a, b) => b.lastActivity - a.lastActivity);

    return activeSessions[0] || null;
  }

  /**
   * Update session activity timestamp
   *
   * @param {string} tag - Session identifier
   * @returns {Promise<void>} Update completion promise
   * @description Atomically updates lastActivity timestamp for session tracking.
   */
  async updateActivity(tag: string): Promise<void> {
    await this.withLock(async (registry) => {
      const session = registry.sessions[tag];
      if (session) {
        session.lastActivity = Date.now();
        registry.lastUpdated = Date.now();
      }
      return registry;
    });
  }

  /**
   * Archive session by marking as inactive
   *
   * @param {string} tag - Session identifier
   * @returns {Promise<void>} Archive completion promise
   * @description Atomically changes session status to archived and updates activity timestamp.
   */
  async archiveSession(tag: string): Promise<void> {
    await this.withLock(async (registry) => {
      const session = registry.sessions[tag];
      if (session) {
        session.status = "archived";
        session.lastActivity = Date.now();
        registry.lastUpdated = Date.now();
      }
      return registry;
    });
  }

  /**
   * Permanently remove session from registry
   *
   * @param {string} tag - Session identifier
   * @returns {Promise<void>} Removal completion promise
   * @description Atomically deletes session entry from registry.
   */
  async removeSession(tag: string): Promise<void> {
    await this.withLock(async (registry) => {
      delete registry.sessions[tag];
      registry.lastUpdated = Date.now();
      return registry;
    });
  }

  /**
   * Check if current process owns the session
   *
   * @param {string} tag - Session identifier
   * @returns {Promise<boolean>} True if current process owns the session
   * @description Verifies session ownership by comparing process IDs.
   */
  async isSessionOwner(tag: string): Promise<boolean> {
    const session = await this.getSession(tag);
    return session?.pid === this.currentPid;
  }

  /**
   * Get absolute path to registry file
   *
   * @returns {string} Absolute path to sessions.json
   * @description Returns the full path to the session registry file.
   */
  getRegistryPath(): string {
    return this.registryPath;
  }

  /**
   * Get comprehensive registry statistics
   *
   * @returns {Promise<{total: number, active: number, archived: number, currentProcess: number}>} Registry statistics
   * @description Provides session counts by status and process ownership.
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    archived: number;
    currentProcess: number;
  }> {
    const registry = await this.readRegistry();
    const sessions = Object.values(registry.sessions);

    return {
      total: sessions.length,
      active: sessions.filter((s) => s.status === "active").length,
      archived: sessions.filter((s) => s.status === "archived").length,
      currentProcess: sessions.filter((s) => s.pid === this.currentPid).length,
    };
  }

  /**
   * Execute operation with atomic file locking
   *
   * @template T
   * @param {(registry: SessionRegistry) => Promise<SessionRegistry>} operation - Operation to execute
   * @returns {Promise<T>} Operation result
   * @throws {Error} When lock cannot be acquired or operation fails
   * @description Provides atomic operations with file locking and automatic cleanup.
   * @private
   */
  private async withLock<T>(operation: (registry: SessionRegistry) => Promise<SessionRegistry>): Promise<T> {
    const lockAcquired = await this.acquireLock();

    if (!lockAcquired) {
      throw new Error("Could not acquire registry lock within timeout");
    }

    try {
      const registry = await this.readRegistry();
      const updatedRegistry = await operation(registry);
      await this.writeRegistry(updatedRegistry);
      return updatedRegistry as T;
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Acquire exclusive file lock with stale lock detection
   *
   * @returns {Promise<boolean>} True if lock acquired successfully
   * @description Attempts to acquire lock with timeout and automatic stale lock cleanup.
   * @private
   */
  private async acquireLock(): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < SessionRegistryManager.LOCK_TIMEOUT) {
      try {
        await fs.writeFile(this.lockPath, this.currentPid.toString(), { flag: "wx" });
        return true;
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && (error as any).code === "EEXIST") {
          // Lock exists, check if it's stale
          try {
            const lockContent = await fs.readFile(this.lockPath, "utf-8");
            const lockPid = parseInt(lockContent.trim());

            if (!(await this.isProcessRunning(lockPid))) {
              // Stale lock, remove it
              await fs.unlink(this.lockPath);
              continue;
            }
          } catch {
            // If we can't read the lock, assume it's stale and remove it
            await fs.unlink(this.lockPath);
            continue;
          }

          // Wait a bit before retrying
          await new Promise((resolve) => setTimeout(resolve, 100));
        } else {
          throw error;
        }
      }
    }

    return false;
  }

  /**
   * Release acquired file lock
   *
   * @returns {Promise<void>} Release completion promise
   * @description Removes lock file to allow other processes to proceed.
   * @private
   */
  private async releaseLock(): Promise<void> {
    try {
      await fs.unlink(this.lockPath);
    } catch {
      // Lock file might not exist, ignore
    }
  }

  /**
   * Read registry from disk with error handling
   *
   * @returns {Promise<SessionRegistry>} Registry data structure
   * @description Reads and parses registry file, creating empty registry if file missing or corrupted.
   * @private
   */
  private async readRegistry(): Promise<SessionRegistry> {
    try {
      const content = await fs.readFile(this.registryPath, "utf-8");
      if (!content || content.trim() === "") {
        return this.createEmptyRegistryObject();
      }
      
      const parsed = JSON.parse(content);
      
      // Handle malformed registry files (e.g., just {} without proper structure)
      if (!parsed.sessions || typeof parsed.sessions !== 'object') {
        this.logger?.warn('Registry file missing sessions property, creating new registry structure');
        return this.createEmptyRegistryObject();
      }
      
      return parsed;
    } catch (error: unknown) {
      if (
        (error && typeof error === "object" && "code" in error && (error as any).code === "ENOENT") ||
        error instanceof SyntaxError
      ) {
        return this.createEmptyRegistryObject();
      }
      throw error;
    }
  }

  /**
   * Write registry to disk
   *
   * @param {SessionRegistry} registry - Registry data to write
   * @returns {Promise<void>} Write completion promise
   * @description Atomically writes registry to disk with proper formatting.
   * @private
   */
  private async writeRegistry(registry: SessionRegistry): Promise<void> {
    const content = JSON.stringify(registry, null, 2);
    await fs.writeFile(this.registryPath, content, "utf-8");
  }

  /**
   * Create new empty registry file
   *
   * @returns {Promise<void>} Creation completion promise
   * @description Creates initial registry file with proper structure and version.
   * @private
   */
  private async createEmptyRegistry(): Promise<void> {
    const registry = this.createEmptyRegistryObject();
    await this.writeRegistry(registry);
  }

  /**
   * Create empty registry data structure
   *
   * @returns {SessionRegistry} Empty registry object with current timestamp
   * @description Creates properly formatted empty registry structure.
   * @private
   */
  private createEmptyRegistryObject(): SessionRegistry {
    const now = Date.now();
    return {
      version: SessionRegistryManager.REGISTRY_VERSION,
      createdAt: now,
      lastUpdated: now,
      sessions: {},
    };
  }

  /**
   * Check if process is still running by PID
   *
   * @param {number} pid - Process ID to check
   * @returns {Promise<boolean>} True if process is running
   * @description Uses process.kill(pid, 0) to test process existence without sending signal.
   * @private
   */
  private async isProcessRunning(pid: number): Promise<boolean> {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }
}
