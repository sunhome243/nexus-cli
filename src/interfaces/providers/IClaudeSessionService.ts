/**
 * Claude Session Service Interface
 * Defines the contract for Claude session management
 */

import { ISessionService } from '../core/IProviderService.js';

// Claude registry manager interface
export interface ClaudeRegistryManager {
  getSessionPath(sessionId: string): string;
  createSessionDirectory(sessionId: string): Promise<void>;
  deleteSessionDirectory(sessionId: string): Promise<void>;
  listSessions(): Promise<string[]>;
  getSessionMetadata(sessionId: string): Promise<Record<string, unknown> | null>;
  setSessionMetadata(sessionId: string, metadata: Record<string, unknown>): Promise<void>;
}

export interface ClaudeSessionInfo {
  sessionId: string;
  tag: string;
  createdAt: Date;
  lastActivity: Date;
  model: string | null;
  claudeActualSessionId: string | null;
  provider: string; // Required by SessionInfo
  isActive: boolean; // Required by SessionInfo
}

export interface ClaudeSessionState {
  currentSessionId: string | null;
  sessionTag: string | null;
  currentSessionTag: string | null;
  claudeActualSessionId: string | null;
  currentModel: string | null;
  isCreatingSession: boolean;
  claudeProjectsDir: string;
}

export interface IClaudeSessionService extends ISessionService {
  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null;

  /**
   * Set current session ID
   */
  setCurrentSessionId(sessionId: string | null): void;

  /**
   * Get current session tag
   */
  getCurrentSessionTag(): string | null;

  /**
   * Set session tag
   */
  setSessionTag(tag: string): void;

  /**
   * Get session state
   */
  getSessionState(): ClaudeSessionState;

  /**
   * Set registry manager
   */
  setRegistry(registry: ClaudeRegistryManager): void;

  /**
   * Get session info
   */
  getSessionInfo(): ClaudeSessionInfo | null;
}