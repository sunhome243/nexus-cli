/**
 * Session Manager - Comprehensive session orchestration and lifecycle management
 * 
 * @class SessionManager
 * @implements {ISessionManager}
 * @description Orchestrates session management using dependency injection and single-responsibility services.
 * Provides unified interface for provider switching, session creation, and cross-provider synchronization.
 * Includes circuit breaker patterns for resilient session management.
 */

import { injectable, inject } from "inversify";
import { TYPES } from "../../infrastructure/di/types.js";
import { ILoggerService, ISessionManager, ISessionInfo, IStreamingCallbacks } from "../../interfaces/index.js";
import { IProgressTracker } from "../../interfaces/core/IProgressTracker.js";
import { IProviderManager, IProviderSwitchService } from "../../interfaces/session/index.js";
import { ISyncEngine, ISyncResult } from "../../interfaces/core/ISyncEngine.js";
import { SessionRegistryManager, ISessionRegistryManager } from "../sync/index.js";
import { ProviderType, TIMEOUTS, isValidProviderType } from "../../abstractions/providers/index.js";
import { IProviderRegistry } from "../../interfaces/core/IProviderRegistry.js";
import { IProvider, IProviderResponse, IProviderStreamingCallbacks, IPermissionRequest, IToolExecutionData } from "../../interfaces/core/IProvider.js";
import { ToolConfirmationOutcome } from "@google/gemini-cli-core";
import * as path from "node:path";

// Type definitions for better type safety
type SyncDirection = 'claude-to-gemini' | 'gemini-to-claude';

interface ProviderSessionInfo {
  sessionId: string;
  checkpointPath?: string;
  error?: Error;
  sessionPaths: Record<string, string>;
}

interface ConversationHistoryItem {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface ProviderWithSessionContent extends IProvider {
  hasSessionContent?: () => Promise<boolean>;
}

interface ProviderWithFinalSave extends IProvider {
  performFinalSave?: () => Promise<void>;
}

interface SyncEngineWithDirection extends ISyncEngine {
  instantSync(sessionTag: string, direction: SyncDirection): Promise<ISyncResult>;
}

/**
 * Session Manager implementation
 * 
 * @class SessionManager
 * @implements {ISessionManager}
 * @description Central orchestrator for session lifecycle, provider management, and synchronization.
 */
@injectable()
export class SessionManager implements ISessionManager {
  private providerManager: IProviderManager | null = null;
  private providerSwitchService: IProviderSwitchService | null = null;
  private syncEngine: ISyncEngine | null = null;
  private isInitialized = false;

  // Direct session management (moved from SessionLifecycleService)
  private currentSession: { tag: string; provider: ProviderType } | null = null;
  private registry: ISessionRegistryManager | null = null;
  private providerRegistry: IProviderRegistry;
  private availableProviders: Set<ProviderType> = new Set();
  private activeSessionCreations = new Set<string>();

  // Circuit breaker for session creation
  private sessionCreationAttempts = 0;
  private maxSessionCreationAttempts = 3;
  private lastSessionCreationFailure: number | null = null;
  private sessionCreationCooldownMs = TIMEOUTS.SESSION_COOLDOWN;

  constructor(
    @inject(TYPES.LoggerService) private logger: ILoggerService,
    @inject(TYPES.ProviderManager) private providerManagerInstance: IProviderManager,
    @inject(TYPES.ProviderRegistry) providerRegistry: IProviderRegistry,
    @inject(TYPES.ProviderSwitchService) private providerSwitchServiceInstance: IProviderSwitchService,
    @inject(TYPES.SyncEngine) private syncEngineInstance: ISyncEngine,
    @inject(TYPES.SessionRegistryManager) private sessionRegistryManager: ISessionRegistryManager
  ) {
    this.providerManager = providerManagerInstance;
    this.providerRegistry = providerRegistry;
    this.providerSwitchService = providerSwitchServiceInstance;
    this.syncEngine = syncEngineInstance;
  }

  /**
   * Initialize the session manager with all dependencies
   * 
   * @param {IProgressTracker} [progressTracker] - Optional progress tracking for UI updates
   * @returns {Promise<void>} Initialization completion promise
   * @description Initializes providers, session services, and creates initial session with circuit breaker protection.
   */
  async initialize(progressTracker?: IProgressTracker): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logger.info("Initializing Session Manager");

      await this.initializeServices(progressTracker);
      
      if (progressTracker) {
        progressTracker.startTask("provider.manager");
      }
      await this.initializeProviderManager(progressTracker);
      if (progressTracker) {
        progressTracker.completeTask("provider.manager");
      }
      
      if (progressTracker) {
        progressTracker.startTask("session.services");
      }
      await this.initializeSessionServices(progressTracker);
      if (progressTracker) {
        progressTracker.completeTask("session.services");
      }

      this.isInitialized = true;
      this.logger.info("Session Manager initialized successfully");

      // SIMPLIFIED SESSION INITIALIZATION: Always create session, let providers handle resume internally
      // Providers will automatically detect and resume existing sessions when appropriate

      // Check circuit breaker before attempting session creation
      if (this.isSessionCreationBlocked()) {
        this.logger.warn("Session creation blocked by circuit breaker", {
          attempts: this.sessionCreationAttempts,
          maxAttempts: this.maxSessionCreationAttempts,
          lastFailure: this.lastSessionCreationFailure,
          cooldownMs: this.sessionCreationCooldownMs,
        });
      } else {
        try {
          if (progressTracker) {
            progressTracker.startTask("session.creation");
          }

          const sessionTag = this.generateUniqueSessionTag();
          await this.createSession(sessionTag, progressTracker);
          
          if (progressTracker) {
            progressTracker.completeTask("session.creation");
          }
          // Reset circuit breaker on success
          this.resetSessionCreationCircuitBreaker();

          this.logger.info("🆕 Session initialized at startup", {
            tag: sessionTag,
            providers: this.getAvailableProviders(),
            note: "Session created - providers will resume existing conversations if found",
          });

          // Log successful initialization with current provider
          const currentProvider = this.providerSwitchService?.getCurrentProvider();
          this.logger.info(`✅ Session initialized with ${currentProvider} provider`, {
            currentProvider,
            availableProviders: this.getAvailableProviders(),
          });
        } catch (error) {
          // Trigger circuit breaker on failure
          this.triggerSessionCreationCircuitBreaker();

          const err = error instanceof Error ? error : new Error(String(error));
          this.logger.warn("Failed to initialize session during startup", {
            error: err.message,
            attempts: this.sessionCreationAttempts,
            blocked: this.isSessionCreationBlocked(),
          });

          if (progressTracker) {
            progressTracker.completeTask("session.creation");
          }

          // Continue with initialization even if session creation fails
          // Session will be created on-demand later if needed
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error("Failed to initialize Session Manager", {
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Switch to a different AI provider
   * 
   * @param {ProviderType | string} provider - Target provider to switch to
   * @returns {Promise<void>} Switch completion promise
   * @description Validates provider availability and orchestrates provider switching with session context.
   */
  async switchProvider(provider: ProviderType | string): Promise<void> {
    this.ensureInitialized();

    if (!this.providerManager || !this.providerSwitchService) {
      throw new Error("Required services not initialized");
    }

    // Convert string to ProviderType if needed
    const providerType = typeof provider === 'string' 
      ? (isValidProviderType(provider) ? provider as ProviderType : null)
      : provider;
    
    if (!providerType) {
      throw new Error(`Invalid provider type: ${provider}`);
    }
    
    // Check if provider is available
    if (!this.providerManager.isProviderAvailable(providerType)) {
      throw new Error(`${providerType} provider is not available`);
    }

    const currentProvider = this.providerSwitchService.getCurrentProvider();
    const sessionInfo = await this.getCurrentSessionInfo();

    await this.providerSwitchService.switchProvider(currentProvider, providerType, sessionInfo?.tag);

    // After switching to Gemini, check if we need to load checkpoint
    if (providerType === ProviderType.GEMINI && sessionInfo?.tag) {
      const geminiProvider = this.providerManager.getProvider(ProviderType.GEMINI);
      if (geminiProvider) {
        // Check if checkpoint exists
        const checkpointWrapper = (geminiProvider as any).checkpointWrapper;
        if (checkpointWrapper && checkpointWrapper.checkpointExists(sessionInfo.tag)) {
          this.logger.info("Loading Gemini checkpoint after provider switch", { tag: sessionInfo.tag });
          await (geminiProvider as any).resumeSession(sessionInfo.tag);
        }
      }
    }
  }

  // Removed: findExistingSessionToResume - simplified initialization to let providers handle resume internally

  /**
   * Create a new session across all available providers
   * 
   * @param {string} tag - Unique session tag
   * @param {IProgressTracker} [progressTracker] - Optional progress tracking
   * @returns {Promise<void>} Session creation completion promise
   * @description Creates sessions for all available providers with rollback support and duplicate prevention.
   */
  async createSession(tag: string, progressTracker?: IProgressTracker): Promise<void> {
    this.ensureInitialized();

    this.logger.info("SessionManager.createSession called", { tag });

    if (!this.providerSwitchService || !this.registry) {
      throw new Error("Required services not initialized");
    }

    // Prevent duplicate session creation attempts
    if (this.activeSessionCreations.has(tag)) {
      this.logger.warn(`🔒 Session creation already in progress for tag: ${tag}`);
      throw new Error(`Session creation already in progress for tag: ${tag}`);
    }

    this.activeSessionCreations.add(tag);

    try {
      const currentProvider = this.providerSwitchService.getCurrentProvider();
      this.logger.info("Creating new session directly", { tag, provider: currentProvider });

      // Set session tag for all providers BEFORE creating sessions
      // This ensures providers like Gemini can check for existing checkpoints
      if (this.providerManager) {
        this.providerManager.setSessionTag(tag);
        this.logger.info("Session tag set for all providers before creation", { tag });
      }

      const sessionProviders: Record<string, ProviderSessionInfo> = {};
      let hasSuccessfulCreation = false;

      // Create sessions for all available providers directly
      for (const providerType of this.availableProviders) {
        this.logger.info(`🔄 Creating ${providerType} session (tag: ${tag})`);
        
        // Track individual session creation progress
        if (progressTracker) {
          const sessionTaskId = `session.${providerType}.create`;
          progressTracker.startTask(sessionTaskId);
        }
        
        try {
          const providerResult = await this.createProviderSession(providerType, tag, tag);
          this.logger.info(`✅ ${providerType} session created successfully`, providerResult);
          sessionProviders[providerType] = providerResult.info;
          hasSuccessfulCreation = true;
          
          // Complete the individual session creation
          if (progressTracker) {
            const sessionTaskId = `session.${providerType}.create`;
            progressTracker.completeTask(sessionTaskId);
          }
        } catch (error) {
          this.logger.error(`❌ Failed to create ${providerType} session:`, { error, providerType });
          
          // Store error for potential rollback
          sessionProviders[providerType] = { 
            sessionId: 'error', 
            sessionPaths: {},
            error: error instanceof Error ? error : new Error(String(error)) 
          };
          
          // Mark task as failed (not completed) in progress tracker
          if (progressTracker && progressTracker.failTask) {
            const sessionTaskId = `session.${providerType}.create`;
            progressTracker.failTask(sessionTaskId, error instanceof Error ? error : new Error(String(error)));
          }
        }
      }

      if (!hasSuccessfulCreation) {
        throw new Error("Failed to create session in any provider");
      }

      // Register session in registry
      await this.registry.registerSession(tag, sessionProviders);

      // Set current session
      this.currentSession = { tag, provider: currentProvider };

      this.logger.info("Session created successfully", {
        tag,
        provider: currentProvider,
        providers: Object.keys(sessionProviders),
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error("Failed to create session", {
        tag,
        error: err.message,
      });
      throw err;
    } finally {
      this.activeSessionCreations.delete(tag);
    }
  }

  // Resume session removed - providers handle resumption internally

  /**
   * Get currently active provider type
   * 
   * @returns {ProviderType} Current provider type
   * @description Returns the currently active AI provider.
   */
  getCurrentProvider(): ProviderType {
    this.ensureInitialized();

    if (!this.providerSwitchService) {
      throw new Error("Provider switch service not initialized");
    }

    return this.providerSwitchService.getCurrentProvider();
  }

  /**
   * Get currently active provider instance
   * 
   * @returns {IProvider | null} Current provider instance or null
   * @description Returns the actual provider instance for direct interaction.
   */
  getCurrentProviderInstance(): IProvider | null {
    this.ensureInitialized();

    if (!this.providerManager || !this.providerSwitchService) {
      return null;
    }

    const currentProviderName = this.providerSwitchService.getCurrentProvider();
    return this.providerManager.getProvider(currentProviderName as ProviderType);
  }

  /**
   * Get current session information
   * 
   * @returns {Promise<ISessionInfo | null>} Session information or null
   * @description Retrieves current session metadata including provider and timing information.
   */
  async getCurrentSessionInfo(): Promise<ISessionInfo | null> {
    this.ensureInitialized();

    if (!this.currentSession) {
      return null;
    }

    // Convert to ISessionInfo format
    return {
      id: this.currentSession.tag,
      tag: this.currentSession.tag,
      provider: this.currentSession.provider,
      timestamp: new Date(),
      isActive: true,
      messageCount: 0,
    };
  }

  /**
   * Get list of available providers
   * 
   * @returns {string[]} Array of available provider names
   * @description Returns providers that are initialized and ready for use.
   */
  getAvailableProviders(): string[] {
    this.ensureInitialized();

    if (!this.providerManager) {
      return [];
    }

    return this.providerManager.getAvailableProviders();
  }

  /**
   * Send message to current provider
   * 
   * @param {string} message - Message to send
   * @returns {Promise<string>} Provider response text
   * @description Sends message to currently active provider and returns response.
   */
  async sendMessage(message: string): Promise<string> {
    this.ensureInitialized();

    if (!this.providerManager || !this.providerSwitchService) {
      throw new Error("Required services not initialized");
    }

    const currentProvider = this.providerSwitchService.getCurrentProvider();
    const provider = this.providerManager.getProvider(currentProvider as ProviderType);

    if (!provider) {
      throw new Error(`Provider ${currentProvider} not available`);
    }

    const response = await provider.sendMessage(message);
    return response.text;
  }

  /**
   * Stream message to current provider with real-time callbacks
   * 
   * @param {string} message - Message to stream
   * @param {IStreamingCallbacks} callbacks - Streaming event handlers
   * @returns {Promise<void>} Streaming completion promise
   * @description Enables real-time streaming with tool execution and permission handling.
   */
  async streamMessage(message: string, callbacks: IStreamingCallbacks): Promise<void> {
    this.ensureInitialized();

    if (!this.providerManager || !this.providerSwitchService) {
      throw new Error("Required services not initialized");
    }

    const currentProvider = this.providerSwitchService.getCurrentProvider();
    const provider = this.providerManager.getStreamingProvider(currentProvider as ProviderType);

    if (!provider) {
      throw new Error(`Streaming provider ${currentProvider} not available`);
    }

    if (!provider.streamMessage) {
      throw new Error(`Provider ${currentProvider} does not support streaming`);
    }

    // Convert IStreamingCallbacks to IProviderStreamingCallbacks
    const providerCallbacks: IProviderStreamingCallbacks = {
      onStreamChunk: callbacks.onToken,
      onContentMessage: callbacks.onToken,  // Gemini uses onContentMessage instead of onStreamChunk
      onThinkingChunk: callbacks.onThinkingChunk,  // Pass through thinking chunks
      onComplete: callbacks.onComplete ? async (response: IProviderResponse) => {
        await callbacks.onComplete!(response.text);
        
        // Trigger sync after conversation completes (only for Claude)
        if (currentProvider === ProviderType.CLAUDE) {
          this.logger.info("Triggering automatic sync after Claude conversation");
          await this.triggerPostStreamingSync();
        }
      } : undefined,
      onError: callbacks.onError ? (error: string) => {
        callbacks.onError!(new Error(error));
      } : undefined,
      onToolExecutionStart: callbacks.onToolUse ? (data: any) => {
        callbacks.onToolUse!({
          toolName: data.toolName,
          arguments: data.args || data.arguments || {},
          executionId: data.executionId,
          timestamp: data.timestamp
        });
      } : undefined,
      onToolExecutionComplete: callbacks.onToolExecutionComplete ? (data: IToolExecutionData) => {
        callbacks.onToolExecutionComplete!(data.executionId, data.result);
      } : undefined,
      onToolFailure: callbacks.onToolFailure ? (data: IToolExecutionData) => {
        // Handle tool failures including permission denials
        callbacks.onToolFailure!(data.executionId, data.error || 'Tool execution failed');
      } : undefined,
      onPermissionRequest: callbacks.onPermissionRequest ? async (request: IPermissionRequest) => {
        const outcome = await callbacks.onPermissionRequest!({
          toolName: request.toolName,
          arguments: request.arguments,
          description: request.description,
          toolUseId: request.toolUseId
        });
        // Convert ToolConfirmationOutcome back to IPermissionResponse
        const approved = outcome === ToolConfirmationOutcome.ProceedOnce || outcome === ToolConfirmationOutcome.ProceedAlways;
        return {
          approved: approved,
          reason: outcome === ToolConfirmationOutcome.Cancel ? 'User denied permission' : undefined
        };
      } : undefined
    };

    return provider.streamMessage(message, providerCallbacks);
  }

  /**
   * Check if current provider supports streaming
   * 
   * @returns {boolean} True if streaming is supported
   * @description Validates streaming capability of current provider.
   */
  supportsStreaming(): boolean {
    this.ensureInitialized();

    if (!this.providerManager || !this.providerSwitchService) {
      return false;
    }

    const currentProvider = this.providerSwitchService.getCurrentProvider();
    return this.providerManager.supportsStreaming(currentProvider as ProviderType);
  }

  /**
   * Trigger synchronization after streaming operation
   * 
   * @returns {Promise<void>} Sync completion promise
   * @description Performs provider-specific sync to maintain consistency across providers.
   */
  async triggerPostStreamingSync(): Promise<void> {
    this.ensureInitialized();

    if (!this.syncEngine) {
      this.logger.warn("Sync engine not available");
      return;
    }

    const sessionInfo = await this.getCurrentSessionInfo();

    if (!sessionInfo) {
      this.logger.warn("No current session for post-streaming sync");
      return;
    }

    // Check if the current provider has written content to disk
    const currentProviderInstance = this.getCurrentProviderInstance() as ProviderWithSessionContent;
    if (currentProviderInstance && typeof currentProviderInstance.hasSessionContent === "function") {
      const hasContent = await currentProviderInstance.hasSessionContent();
      if (!hasContent) {
        this.logger.info("Skipping sync - session file not yet written", {
          sessionId: sessionInfo.tag,
          provider: sessionInfo.provider,
        });
        return;
      }
    }

    try {
      // Determine sync direction based on current provider
      // When on Claude: sync claude-to-gemini (push Claude changes to Gemini)
      // When on Gemini: sync gemini-to-claude (push Gemini changes to Claude)
      const currentProviderType = this.getCurrentProvider();
      const syncDirection = currentProviderType === ProviderType.CLAUDE ? 'claude-to-gemini' : 'gemini-to-claude';
      
      this.logger.info("Performing provider-specific sync", {
        sessionId: sessionInfo.tag,
        currentProvider: currentProviderType,
        syncDirection
      });
      
      await (this.syncEngine as SyncEngineWithDirection).instantSync(sessionInfo.tag, syncDirection as SyncDirection);
      this.logger.info("Post-streaming sync completed", {
        sessionId: sessionInfo.tag,
        syncDirection
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.warn("Post-streaming sync failed", {
        sessionId: sessionInfo.tag,
        error: err.message,
      });
    }
  }

  /**
   * Get conversation history for a session
   * 
   * @param {string} sessionId - Session identifier
   * @returns {Promise<ConversationHistoryItem[]>} Conversation history items
   * @description Retrieves conversation history (placeholder implementation).
   */
  async getConversationHistory(sessionId: string): Promise<ConversationHistoryItem[]> {
    this.ensureInitialized();

    this.logger.info("Getting conversation history", { sessionId });

    // For now, return empty array - this method should be implemented
    // based on the specific requirements for conversation history
    return [];
  }

  /**
   * Clean up session manager and all providers
   * 
   * @returns {Promise<void>} Cleanup completion promise
   * @description Performs final save and cleanup of all providers and resources.
   */
  async cleanup(): Promise<void> {
    try {
      this.logger.info("Cleaning up Session Manager");

      // Perform final save for current provider before cleanup
      await this.performFinalSave();

      if (this.providerManager) {
        await this.providerManager.cleanup();
      }

      this.isInitialized = false;
      this.logger.info("Session Manager cleanup completed");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error("Failed to cleanup Session Manager", {
        error: err.message,
      });
    }
  }

  /**
   * Execute askModel request with a specific provider
   * 
   * @param {ProviderType | string} targetProvider - Provider to consult
   * @param {string} prompt - Consultation prompt
   * @returns {Promise<string>} Provider response
   * @description Used by askModel MCP tool to consult other AI models.
   * This is a READ-only operation that does not update session references.
   */
  async executeAskModel(targetProvider: ProviderType | string, prompt: string): Promise<string> {
    this.ensureInitialized();

    if (!this.providerManager) {
      throw new Error('Provider manager not initialized');
    }

    this.logger.info('Executing askModel request (READ-ONLY)', {
      targetProvider,
      promptLength: prompt.length
    });

    // Convert string to ProviderType if needed
    const providerType = typeof targetProvider === 'string' 
      ? (isValidProviderType(targetProvider) ? targetProvider as ProviderType : null)
      : targetProvider;
    
    if (!providerType) {
      throw new Error(`Invalid provider type: ${targetProvider}`);
    }
    
    // Get the target provider
    const provider = this.providerManager.getProvider(providerType);
    if (!provider) {
      throw new Error(`Provider ${providerType} not available`);
    }

    // Note: Provider should already be initialized by ProviderManager

    try {
      // Use read-only method for Claude, regular sendMessage for others
      let response;
      if (providerType === ProviderType.CLAUDE && 'sendMessageReadOnly' in provider) {
        this.logger.debug('Using read-only method for Claude askModel request');
        response = await (provider as any).sendMessageReadOnly(prompt);
      } else {
        // For non-Claude providers, use regular sendMessage
        response = await provider.sendMessage(prompt);
      }
      
      this.logger.info('askModel request completed (READ-ONLY)', {
        targetProvider,
        responseLength: response?.text?.length || 0
      });

      return response.text;
    } catch (error) {
      this.logger.error('Failed to execute askModel request', {
        targetProvider,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Perform final save for the current provider
   * 
   * @returns {Promise<void>} Final save completion promise
   * @description Called before app exit to ensure conversations are saved and synced.
   */
  async performFinalSave(): Promise<void> {
    try {
      const currentProvider = this.getCurrentProvider();
      const sessionInfo = await this.getCurrentSessionInfo();
      
      if (!sessionInfo) {
        this.logger.debug('No current session for final save');
        return;
      }

      this.logger.info(`Performing final save for ${currentProvider} provider`, {
        sessionId: sessionInfo.tag
      });

      // Handle final save for providers that require manual saving
      if (this.providerManager) {
        const provider = this.providerManager.getProvider(currentProvider);
        const providerWithSave = provider as ProviderWithFinalSave;
        if (provider?.capabilities.requiresManualSave && typeof providerWithSave.performFinalSave === 'function') {
          await providerWithSave.performFinalSave();
          this.logger.info(`${currentProvider} final save completed`);
        }
      }

      // Perform final sync to ensure both providers have latest data
      if (this.syncEngine) {
        try {
          const syncDirection = currentProvider === ProviderType.CLAUDE ? 'claude-to-gemini' : 'gemini-to-claude';
          await (this.syncEngine as SyncEngineWithDirection).instantSync(sessionInfo.tag, syncDirection as SyncDirection);
          this.logger.info('Final sync completed', { syncDirection });
        } catch (error) {
          this.logger.warn('Final sync failed', { error });
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to perform final save', {
        error: err.message
      });
    }
  }

  private async initializeServices(progressTracker?: IProgressTracker): Promise<void> {
    // Services are now injected via constructor - no direct instantiation needed
    this.logger.info("Services injected via DI container");
  }

  private async initializeProviderManager(progressTracker?: IProgressTracker): Promise<void> {
    if (!this.providerManager) {
      throw new Error("Provider manager not injected");
    }

    // Start provider manager task
    if (progressTracker) {
      progressTracker.startTask("provider.manager");
    }

    await this.providerManager.initialize(progressTracker);

    if (progressTracker) {
      progressTracker.completeTask("provider.manager");
    }
  }

  private async initializeSessionServices(progressTracker?: IProgressTracker): Promise<void> {
    if (!this.providerSwitchService || !this.providerManager) {
      throw new Error("Required services not injected");
    }

    // Start session services task
    if (progressTracker) {
      progressTracker.startTask("session.services");
    }

    // Initialize registry for direct session management
    if (progressTracker) {
      progressTracker.startTask("session.registry");
    }
    this.registry = this.sessionRegistryManager;
    await this.registry.initialize();
    if (progressTracker) {
      progressTracker.completeTask("session.registry");
    }

    // Check provider availability using ProviderRegistry
    if (progressTracker) {
      progressTracker.startTask("session.check");
    }
    const availableProviderTypes = this.providerRegistry.getAvailableTypes();

    for (const providerType of availableProviderTypes) {
      try {
        if (this.providerRegistry.hasProvider(providerType)) {
          this.availableProviders.add(providerType);
          this.logger.info(`✅ ${providerType} provider available for session management`);
        }
      } catch (error) {
        this.logger.warn(`⚠️ ${providerType} provider not available:`, { error, providerType });
      }
    }

    if (this.availableProviders.size === 0) {
      throw new Error("No providers available for session management");
    }
    if (progressTracker) {
      progressTracker.completeTask("session.check");
    }

    // Initialize switch service
    if (progressTracker) {
      progressTracker.startTask("session.switch");
    }
    await this.providerSwitchService.initialize(this.syncEngine!, this.providerManager || undefined);
    if (progressTracker) {
      progressTracker.completeTask("session.switch");
    }

    this.logger.info(`✅ Session services initialized with ${this.availableProviders.size} providers`);

    if (progressTracker) {
      progressTracker.completeTask("session.services");
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error("Session Manager not initialized");
    }
  }

  // Circuit breaker methods for session creation
  private isSessionCreationBlocked(): boolean {
    if (this.sessionCreationAttempts >= this.maxSessionCreationAttempts) {
      if (this.lastSessionCreationFailure) {
        const timeSinceLastFailure = Date.now() - this.lastSessionCreationFailure;
        return timeSinceLastFailure < this.sessionCreationCooldownMs;
      }
      return true;
    }
    return false;
  }

  private triggerSessionCreationCircuitBreaker(): void {
    this.sessionCreationAttempts++;
    this.lastSessionCreationFailure = Date.now();

    this.logger.warn("Session creation circuit breaker triggered", {
      attempts: this.sessionCreationAttempts,
      maxAttempts: this.maxSessionCreationAttempts,
      nextAttemptAfter: new Date(Date.now() + this.sessionCreationCooldownMs).toISOString(),
    });
  }

  private resetSessionCreationCircuitBreaker(): void {
    this.sessionCreationAttempts = 0;
    this.lastSessionCreationFailure = null;
    this.logger.info("Session creation circuit breaker reset - session created successfully");
  }

  private generateUniqueSessionTag(): string {
    // Use timestamp + random component to prevent collisions
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const processId = process.pid.toString().substring(-3);
    return `session-${timestamp}-${random}-${processId}`;
  }

  // Direct provider session management (moved from SessionLifecycleService)
  private async createProviderSession(
    providerType: ProviderType,
    tag: string,
    sessionId: string
  ): Promise<{
    provider: string;
    info: ProviderSessionInfo;
  }> {
    this.logger.info(`🔄 Starting ${providerType} session creation for tag: ${tag}`);

    if (!this.providerManager) {
      throw new Error('Provider manager not initialized');
    }

    const provider = this.providerManager.getProvider(providerType);
    if (!provider) {
      throw new Error(`Provider ${providerType} not available`);
    }

    // Provider-specific setup is handled globally by ProviderManager.setSessionTag()

    await provider.createSession(tag);

    // Get provider-specific session information
    const sessionInfo: ProviderSessionInfo = {
      sessionId: tag, // Default session identifier
      sessionPaths: {}, // Initialize empty session paths
    };

    // Handle provider-specific session data extraction
    if (providerType === ProviderType.GEMINI) {
      if (provider.getCheckpointPath) {
        const checkpointPath = provider.getCheckpointPath(tag);
        sessionInfo.checkpointPath = path.resolve(checkpointPath);
        this.logger.info(`✅ ${providerType} session created - checkpoint path: ${checkpointPath}`);
      }
    } else if (providerType === ProviderType.CLAUDE) {
      if (provider.getCurrentSessionId) {
        const sessionId = provider.getCurrentSessionId();
        if (sessionId) {
          sessionInfo.sessionId = sessionId;
        }
      }
      if (provider.getCurrentMemoryFile) {
        const memoryPath = provider.getCurrentMemoryFile() || "";
        // Note: memoryPath is provider-specific data, not part of ProviderSessionInfo
      }
      this.logger.info(`✅ ${providerType} session created - session ID: ${sessionInfo.sessionId}`);
    }

    return {
      provider: providerType,
      info: sessionInfo,
    };
  }
}
