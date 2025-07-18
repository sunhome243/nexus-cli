/**
 * Gemini Session Service
 * Handles session initialization, management, and checkpointing
 * Extracted from GeminiCoreAdapter to reduce complexity
 */

import { injectable, inject } from "inversify";
import { TYPES } from "../../../../infrastructure/di/types.js";
import { ILoggerService } from "../../../../interfaces/core/ILoggerService.js";
import { BaseProvider } from "../../shared/BaseProvider.js";
import { Config, GeminiClient, Turn, GeminiChat } from "@google/gemini-cli-core";
import { SessionInfo, SessionState, GeminiSessionStats, GeminiConversationEntry } from "../../../../interfaces/providers/IGeminiSessionService.js";

@injectable()
export class GeminiSessionService extends BaseProvider {
  private sessionState: SessionState = {
    config: null,
    client: null,
    chat: null,
    currentTurn: null,
    sessionInfo: null,
    isActive: false
  };

  constructor(@inject(TYPES.LoggerService) logger: ILoggerService) {
    super();
    this.setLogger(logger);
  }

  async initialize(): Promise<void> {
    this.setInitialized(true);
    this.logInfo('Gemini Session Service initialized');
  }

  async cleanup(): Promise<void> {
    await this.endCurrentSession();
    this.setInitialized(false);
    this.logInfo('Gemini Session Service cleaned up');
  }

  /**
   * Initialize a new session with config, client and shared chat
   */
  async initializeSession(config: Config, client: GeminiClient, model: string, sharedChat?: unknown): Promise<void> {
    this.ensureInitialized();

    // End any existing session first
    await this.endCurrentSession();

    this.sessionState = {
      config,
      client,
      chat: (sharedChat !== undefined ? sharedChat as GeminiChat : null),
      currentTurn: null,
      sessionInfo: {
        sessionId: this.generateSessionId(),
        createdAt: new Date(),
        lastActivity: new Date(),
        turnCount: 0,
        model
      },
      isActive: true
    };

    this.logInfo(`Session initialized with model: ${model}`, {
      sessionId: this.sessionState.sessionInfo?.sessionId
    });
  }

  /**
   * Create a new turn for the session
   */
  async createTurn(message: string): Promise<Turn> {
    this.ensureInitialized();

    if (!this.sessionState.config || !this.sessionState.client || !this.sessionState.isActive) {
      throw new Error('Session not properly initialized');
    }

    try {
      // Create turn with message content
      if (!this.sessionState.client) {
        throw new Error('Client not initialized');
      }
      // Use shared chat instance if available, otherwise fall back to client's chat
      const chatToUse = this.sessionState.chat || this.sessionState.client.getChat();
      const prompt_id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const turn = new Turn(chatToUse, prompt_id);

      this.sessionState.currentTurn = turn;
      
      // Note: User message is automatically tracked by core chat.recordHistory() during Turn.run()
      // No need to manually track here - core handles this
      
      // Update session info
      if (this.sessionState.sessionInfo) {
        this.sessionState.sessionInfo.turnCount++;
        this.sessionState.sessionInfo.lastActivity = new Date();
      }

      this.logDebug('Turn created and user message tracked', {
        sessionId: this.sessionState.sessionInfo?.sessionId,
        turnCount: this.sessionState.sessionInfo?.turnCount,
        messageLength: message.length
      });

      return turn;

    } catch (error) {
      const wrappedError = this.wrapError(error);
      this.logError('Failed to create turn', wrappedError);
      throw wrappedError;
    }
  }

  /**
   * Get current session state
   */
  getSessionState(): Readonly<SessionState> {
    return { ...this.sessionState };
  }

  /**
   * Get current session info
   */
  getSessionInfo(): SessionInfo | null {
    return this.sessionState.sessionInfo ? { ...this.sessionState.sessionInfo } : null;
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this.sessionState.isActive && this.sessionState.config !== null;
  }

  /**
   * Get current turn
   */
  getCurrentTurn(): Turn | null {
    return this.sessionState.currentTurn;
  }

  /**
   * Get session config
   */
  getConfig(): Config | null {
    return this.sessionState.config;
  }

  /**
   * Get session client
   */
  getClient(): GeminiClient | null {
    return this.sessionState.client;
  }

  /**
   * Update session activity timestamp
   */
  updateActivity(): void {
    if (this.sessionState.sessionInfo) {
      this.sessionState.sessionInfo.lastActivity = new Date();
    }
  }

  /**
   * End current session
   */
  async endCurrentSession(): Promise<void> {
    if (this.sessionState.isActive) {
      this.logInfo('Ending current session', {
        sessionId: this.sessionState.sessionInfo?.sessionId,
        turnCount: this.sessionState.sessionInfo?.turnCount
      });

      // Clean up current turn
      this.sessionState.currentTurn = null;
      
      // Mark session as inactive
      this.sessionState.isActive = false;
      
      // Clear references but don't null immediately in case cleanup is needed
      setTimeout(() => {
        this.sessionState = {
          config: null,
          client: null,
          chat: null,
          currentTurn: null,
          sessionInfo: null,
          isActive: false
        };
      }, 1000);
    }
  }

  /**
   * Get session duration in milliseconds
   */
  getSessionDuration(): number {
    if (!this.sessionState.sessionInfo) {
      return 0;
    }

    return Date.now() - this.sessionState.sessionInfo.createdAt.getTime();
  }

  /**
   * Get formatted session duration
   */
  getFormattedSessionDuration(): string {
    const duration = this.getSessionDuration();
    const minutes = Math.floor(duration / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Validate session state
   */
  validateSessionState(): boolean {
    if (!this.sessionState.isActive) {
      return false;
    }

    if (!this.sessionState.config || !this.sessionState.client) {
      this.logWarn('Session marked as active but missing config or client');
      return false;
    }

    return true;
  }

  /**
   * Get session statistics
   */
  getSessionStats(): GeminiSessionStats {
    return {
      totalTurns: this.sessionState.sessionInfo?.turnCount || 0,
      totalTokens: 0, // TODO: Track tokens from turns
      averageResponseTime: 0, // TODO: Track response times
      errorCount: 0, // TODO: Track errors
      sessionDuration: this.getSessionDuration(),
      lastActivity: this.sessionState.sessionInfo?.lastActivity || new Date()
    };
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `gemini_session_${timestamp}_${random}`;
  }

  /**
   * Generate a unique prompt ID for Turn
   */
  private generatePromptId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `prompt_${timestamp}_${random}`;
  }

  /**
   * Get conversation history from shared chat
   */
  getConversationHistory(): GeminiConversationEntry[] {
    this.ensureInitialized();
    
    // Use shared chat's history directly
    if (this.sessionState.chat) {
      const history = this.sessionState.chat.getHistory();
      // Convert to GeminiConversationEntry format
      return history.map((item: any) => ({
        role: item.role || 'user',
        content: typeof item.parts === 'string' ? item.parts : 
                 Array.isArray(item.parts) ? item.parts.map((p: any) => p.text).join('') :
                 JSON.stringify(item.parts),
        timestamp: new Date(),
        turnId: item.id || undefined,
        tokenCount: undefined
      }));
    }
    return [];
  }


  /**
   * Reset session state (for testing)
   */
  resetSessionState(): void {
    this.sessionState = {
      config: null,
      client: null,
      chat: null,
      currentTurn: null,
      sessionInfo: null,
      isActive: false
    };
    this.logDebug('Session state reset');
  }
}