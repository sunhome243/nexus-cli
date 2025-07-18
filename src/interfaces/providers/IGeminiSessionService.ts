/**
 * Gemini Session Service Interface
 * Defines the contract for Gemini session management
 */

import { IProviderService } from '../core/IProviderService.js';
import { Config, GeminiClient, Turn, GeminiChat } from "@google/gemini-cli-core";

export interface GeminiSessionStats {
  totalTurns: number;
  totalTokens: number;
  averageResponseTime: number;
  errorCount: number;
  sessionDuration: number;
  lastActivity: Date;
}

export interface GeminiConversationEntry {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  turnId?: string;
  tokenCount?: number;
}

export interface SessionInfo {
  sessionId: string;
  createdAt: Date;
  lastActivity: Date;
  turnCount: number;
  model: string;
}

export interface SessionState {
  config: Config | null;
  client: GeminiClient | null;
  chat: GeminiChat | null;
  currentTurn: Turn | null;
  sessionInfo: SessionInfo | null;
  isActive: boolean;
}

export interface IGeminiSessionService extends IProviderService {
  /**
   * Initialize session with config and client
   */
  initializeSession(config: Config, client: GeminiClient, model: string, sharedChat?: GeminiChat): Promise<void>;

  /**
   * Create a new turn
   */
  createTurn(message: string): Promise<Turn>;

  /**
   * Get session state
   */
  getSessionState(): Readonly<SessionState>;

  /**
   * Get session info
   */
  getSessionInfo(): SessionInfo | null;

  /**
   * Check if session is active
   */
  isSessionActive(): boolean;

  /**
   * Get current turn
   */
  getCurrentTurn(): Turn | null;

  /**
   * Get config
   */
  getConfig(): Config | null;

  /**
   * Get client
   */
  getClient(): GeminiClient | null;

  /**
   * Update activity
   */
  updateActivity(): void;

  /**
   * End current session
   */
  endCurrentSession(): Promise<void>;

  /**
   * Get session duration
   */
  getSessionDuration(): number;

  /**
   * Get formatted session duration
   */
  getFormattedSessionDuration(): string;

  /**
   * Validate session state
   */
  validateSessionState(): boolean;

  /**
   * Get session stats
   */
  getSessionStats(): GeminiSessionStats;

  /**
   * Get conversation history
   */
  getConversationHistory(): GeminiConversationEntry[];

  /**
   * Reset session state
   */
  resetSessionState(): void;
}