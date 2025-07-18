/**
 * Gemini Provider - Main service orchestrator for Gemini AI interactions
 *
 * @class GeminiProvider
 * @extends {BaseProvider}
 * @implements {IProvider}
 * @description Orchestrates focused services for gemini-cli-core integration.
 * Provides real-time streaming, tool execution, and session management for Gemini AI.
 */

import { injectable, inject } from "inversify";
import { TYPES } from "../../../infrastructure/di/types.js";
import { ILoggerService } from "../../../interfaces/index.js";
import { ISyncEngine } from "../../../interfaces/core/ISyncEngine.js";
import { StreamingCallbacks } from "../types.js";
import { ToolConfirmationOutcome } from "@google/gemini-cli-core";
import {
  IProvider,
  IThinkingProcessingResult,
  IProviderResponse,
  IProviderStreamingCallbacks,
  IProviderCapabilities,
} from "../../../interfaces/core/IProvider.js";
import { ProviderCapabilities } from "../types.js";
import { GeminiCheckpointWrapper } from "../../../utils/GeminiCheckpointWrapper.js";
import { BaseProvider } from "../shared/BaseProvider.js";
import { ProviderType } from "../../../abstractions/providers/index.js";
import {
  Config,
  GeminiClient,
  AuthType,
  ToolRegistry,
  ToolCallRequestInfo,
  DEFAULT_GEMINI_MODEL,
  GeminiChat,
  Turn,
} from "@google/gemini-cli-core";
import {
  GeminiStreamingService,
  GeminiToolExecutionService,
  GeminiQuotaService,
  GeminiSessionService,
  GeminiModelService,
  GeminiConfigurationService,
  GeminiCallbackAdapterService,
  GeminiBackupService,
  GeminiSessionManagementService,
} from "./services/index.js";
import { ErrorHandlerService } from "../shared/index.js";
import { ErrorContext } from "../../../interfaces/core/IProviderService.js";
import {
  GeminiCoreAdapterCallbacks,
  GeminiStreamingResult,
  GeminiToolResponse,
  GeminiToolExecutionContext,
} from "./types.js";

@injectable()
export class GeminiProvider extends BaseProvider implements IProvider {
  readonly name: string = "gemini";
  readonly capabilities: IProviderCapabilities = {
    supportsStreaming: true,
    supportsToolExecution: true,
    supportsSessionManagement: true,
    maxTokens: 1000000,
    supportedModels: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash-exp"],
    permissions: true,
    thinking: true,
    multimodal: true,
    coreIntegrated: true,
    turnSystem: true,
    checkpointing: true,
    supportsPermissionModeCycling: false,
    supportsAutoModelSwitching: false,
    requiresManualSave: true,
  };

  // Core components
  private chat: GeminiChat | null = null; // Single shared chat instance
  private checkpointWrapper: GeminiCheckpointWrapper | null = null;

  // Injected services
  private streamingService: GeminiStreamingService;
  private toolExecutionService: GeminiToolExecutionService;
  private quotaService: GeminiQuotaService;
  private sessionService: GeminiSessionService;
  private modelService: GeminiModelService;
  private configurationService: GeminiConfigurationService;
  private callbackAdapterService: GeminiCallbackAdapterService;
  private backupService: GeminiBackupService;
  private sessionManagementService: GeminiSessionManagementService;
  private errorHandlerService: ErrorHandlerService;
  private syncEngine: ISyncEngine;

  constructor(
    @inject(TYPES.LoggerService) logger: ILoggerService,
    @inject(TYPES.GeminiStreamingService) streamingService: GeminiStreamingService,
    @inject(TYPES.GeminiToolExecutionService) toolExecutionService: GeminiToolExecutionService,
    @inject(TYPES.GeminiQuotaService) quotaService: GeminiQuotaService,
    @inject(TYPES.GeminiSessionService) sessionService: GeminiSessionService,
    @inject(TYPES.GeminiModelService) modelService: GeminiModelService,
    @inject(TYPES.GeminiConfigurationService) configurationService: GeminiConfigurationService,
    @inject(TYPES.GeminiCallbackAdapterService) callbackAdapterService: GeminiCallbackAdapterService,
    @inject(TYPES.GeminiBackupService) backupService: GeminiBackupService,
    @inject(TYPES.GeminiSessionManagementService) sessionManagementService: GeminiSessionManagementService,
    @inject(TYPES.ErrorHandlerService) errorHandlerService: ErrorHandlerService,
    @inject(TYPES.SyncEngine) syncEngine: ISyncEngine
  ) {
    super();
    this.setLogger(logger);

    // Assign services
    this.streamingService = streamingService;
    this.toolExecutionService = toolExecutionService;
    this.quotaService = quotaService;
    this.sessionService = sessionService;
    this.modelService = modelService;
    this.configurationService = configurationService;
    this.callbackAdapterService = callbackAdapterService;
    this.backupService = backupService;
    this.sessionManagementService = sessionManagementService;
    this.errorHandlerService = errorHandlerService;
    this.syncEngine = syncEngine;
  }

  async initialize(): Promise<void> {
    if (this.isProviderInitialized()) {
      return;
    }

    try {
      this.logInfo("Initializing Service-based Gemini Provider");

      // Initialize all services
      await Promise.all([
        this.configurationService.initialize(),
        this.callbackAdapterService.initialize(),
        this.backupService.initialize(),
        this.sessionManagementService.initialize(),
        this.streamingService.initialize(),
        this.toolExecutionService.initialize(),
        this.quotaService.initialize(),
        this.sessionService.initialize(),
        this.modelService.initialize(),
        this.errorHandlerService.initialize(),
      ]);

      // Create single shared chat instance with error recovery
      const client = this.configurationService.getClient();
      if (!client) {
        throw new Error("Gemini client not initialized");
      }

      try {
        this.chat = client.getChat();
        if (!this.chat) {
          throw new Error("Failed to create chat instance");
        }
        this.logInfo("Created single shared chat instance");
      } catch (error) {
        this.logError("Failed to create chat instance, attempting recovery", error);

        // Attempt to reinitialize client and retry
        await this.configurationService.initialize();

        const recoveredClient = this.configurationService.getClient();
        if (!recoveredClient) {
          throw new Error("Failed to recover client");
        }

        this.chat = recoveredClient.getChat();
        if (!this.chat) {
          throw new Error("Failed to create chat instance after recovery attempt");
        }

        this.logInfo("Successfully recovered and created chat instance");
      }

      // Initialize checkpoint wrapper with shared chat
      const config = this.configurationService.getConfig();
      this.logInfo("Retrieved config from configuration service", {
        configExists: !!config,
        configType: config ? typeof config : "null",
        configConstructor: config?.constructor?.name,
        hasSetFlashFallbackHandler: config ? typeof (config as any).setFlashFallbackHandler === "function" : false,
      });

      if (!config) {
        this.logError("Configuration service returned null config - this will cause initialization issues");
        // Let's check if configuration service is properly initialized
        this.logError("Configuration service state", {
          isInitialized: this.configurationService.isProviderInitialized(),
          hasClient: !!this.configurationService.getClient(),
          hasToolRegistry: !!this.configurationService.getToolRegistry(),
        });
      }

      this.checkpointWrapper = new GeminiCheckpointWrapper(config || undefined, this.chat);
      await this.checkpointWrapper.initialize();

      // Set config in model service BEFORE setting up flash fallback handler
      if (config) {
        this.logInfo("Setting config in model service");
        this.modelService.setConfig(config);
      } else {
        this.logWarn("Config is null, skipping model service configuration and flash fallback setup");
        // Skip flash fallback setup if no config
        this.setInitialized(true);
        this.logInfo("Service-based Gemini Provider initialized successfully (without flash fallback)");
        return;
      }

      // Set up flash fallback handler AFTER config is set
      try {
        this.logInfo("Setting up flash fallback handler");
        this.modelService.setupFlashFallbackHandler(async (currentModel, fallbackModel, error) => {
          return await this.handleFlashFallback(currentModel, fallbackModel, error);
        });
      } catch (error) {
        this.logError("Failed to setup flash fallback handler", error);
        // Continue initialization even if flash fallback setup fails
        // This allows the provider to work without automatic fallback
      }

      this.setInitialized(true);
      this.logInfo("Service-based Gemini Provider initialized successfully");
    } catch (error) {
      const err = this.wrapError(error);
      this.logError("Failed to initialize Service-based Gemini Provider", err);
      throw err;
    }
  }

  async sendMessage(message: string): Promise<IProviderResponse> {
    this.ensureInitialized();

    // Collect response from streaming method
    let responseText = "";
    let error: string | undefined;
    const timestamp = new Date();

    return new Promise((resolve, reject) => {
      const callbacks: StreamingCallbacks = {
        onStreamChunk: (chunk: string) => {
          responseText += chunk;
        },
        onContentMessage: (content: string) => {
          responseText += content;
        },
        onError: (errorMessage: string) => {
          error = errorMessage;
        },
        onComplete: async () => {
          const response: IProviderResponse = {
            text: responseText,
            provider: ProviderType.GEMINI,
            timestamp,
            error,
          };
          resolve(response);
        },
        // Empty handlers for other callbacks to avoid errors
        onThinkingChunk: () => {},
        onSystemMessage: () => {},
        onResultMessage: () => {},
        onPermissionRequest: async () => ToolConfirmationOutcome.ProceedOnce, // Auto-approve for non-streaming
        onToolExecutionStart: () => {},
        onToolExecutionComplete: () => {},
        onToolFailure: () => {},
        onPermissionDenied: () => {},
        onToolAutoApproved: () => {},
        abortController: new AbortController(),
      };

      // Use existing streaming method but collect response
      this.streamMessageInternal(message, callbacks, false).catch(reject);
    });
  }

  async streamMessage(
    message: string | Array<{ role: string; content: string }>,
    callbacks: IProviderStreamingCallbacks | StreamingCallbacks,
    isContinuation?: boolean
  ): Promise<void> {
    // Handle the internal streamMessage with enhanced signature
    return this.streamMessageInternal(message, callbacks as StreamingCallbacks, isContinuation);
  }

  private async streamMessageInternal(
    message: string | Array<{ role: string; content: string; timestamp?: Date }>,
    callbacks: StreamingCallbacks,
    _isContinuation: boolean = false
  ): Promise<void> {
    this.ensureInitialized();

    const messageText = this.callbackAdapterService.convertMessageToString(message);
    this.callbackAdapterService.setFlashFallbackCallback(callbacks.onFlashFallback || null);
    this.callbackAdapterService.setCheckpointWrapper(this.checkpointWrapper);

    const adapterCallbacks = this.callbackAdapterService.createAdapterCallbacks(callbacks);
    const context = this.createErrorContext("streamMessage");

    return this.errorHandlerService.handleWithRetry(
      async () => {
        await this.processStreamingTurnWithServices(messageText, adapterCallbacks);
      },
      context,
      { maxAttempts: 2 }
    );
  }

  private async performBackupFirstSave(): Promise<void> {
    try {
      const currentSessionTag = this.sessionManagementService.getCurrentSessionTag();
      if (currentSessionTag && this.checkpointWrapper) {
        await this.backupService.performBackupFirstSave(currentSessionTag, this.checkpointWrapper);
      }
    } catch (error) {
      this.logError("Failed backup-first save process:", error);
    }
  }

  private createErrorContext(operation: string): ErrorContext {
    return {
      operation,
      model: this.modelService.getCurrentModel(),
      timestamp: new Date(),
    };
  }

  async createSession(tag: string): Promise<void> {
    this.ensureInitialized();

    if (!this.checkpointWrapper) {
      throw new Error("Checkpoint wrapper not initialized");
    }

    await this.sessionManagementService.createSession(tag, this.checkpointWrapper);

    // Initialize session state in GeminiSessionService
    const config = this.configurationService.getConfig();
    const client = this.configurationService.getClient();
    const model = this.modelService.getCurrentModel() || DEFAULT_GEMINI_MODEL;

    if (config && client) {
      await this.sessionService.initializeSession(config, client, model, this.chat);
      this.logInfo(`Session state initialized for tag: ${tag}`);
    } else {
      this.logError("Failed to initialize session state - missing config or client");
    }
  }

  async resumeSession(tag: string): Promise<void> {
    this.ensureInitialized();

    if (!this.checkpointWrapper) {
      throw new Error("Checkpoint wrapper not initialized");
    }

    await this.sessionManagementService.resumeSession(tag, this.checkpointWrapper);

    // Only initialize session state if not already active
    if (!this.sessionService.isSessionActive()) {
      const config = this.configurationService.getConfig();
      const client = this.configurationService.getClient();
      const model = this.modelService.getCurrentModel() || DEFAULT_GEMINI_MODEL;

      if (config && client) {
        await this.sessionService.initializeSession(config, client, model, this.chat);
        this.logInfo(`Session state initialized after resume for tag: ${tag}`);
      } else {
        this.logError("Failed to initialize session state after resume - missing config or client");
      }
    } else {
      this.logInfo(`Session already active after resume for tag: ${tag}`);
    }
  }

  /**
   * Internal method for saving session - only called by ProviderSwitchService
   * @internal
   */
  async _saveSessionInternal(tag: string): Promise<void> {
    this.ensureInitialized();
    if (!this.checkpointWrapper) {
      throw new Error("Checkpoint wrapper not initialized");
    }
    return this.sessionManagementService.saveSessionInternal(tag, this.checkpointWrapper);
  }

  getModel(): string | null {
    this.ensureInitialized();
    return this.modelService.getCurrentModel();
  }

  updateCurrentModel(model: string): void {
    this.ensureInitialized();
    // Update model in config
    const config = this.configurationService.getConfig();
    if (config) {
      config.setModel(model);
    }
    // Also update in model service
    this.modelService.setCurrentModel(model);
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportsStreaming: true,
      supportsToolExecution: true,
      supportsSessionManagement: true,
      maxTokens: 1000000,
      supportedModels: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash-exp"],
      permissions: true, // Updated for core permission system
      thinking: true, // Core supports thinking display
      multimodal: true, // Core supports multimodal content
      coreIntegrated: true,
      turnSystem: true,
      checkpointing: true,
      supportsPermissionModeCycling: false,
      supportsAutoModelSwitching: false,
      requiresManualSave: true,
    };
  }

  // Additional methods for SessionManager
  getCheckpointPath(tag: string): string {
    this.ensureInitialized();
    if (!this.checkpointWrapper) {
      throw new Error("Checkpoint wrapper not initialized");
    }
    return this.checkpointWrapper.getCheckpointPath(tag);
  }

  getConversationHistory(): Array<{ role: string; content: string; timestamp: Date }> {
    this.ensureInitialized();
    // Use core chat history directly (includes tool results and proper role names)
    if (!this.checkpointWrapper) {
      throw new Error("Checkpoint wrapper not initialized");
    }
    const history = this.checkpointWrapper.getConversationHistory();
    // Convert GeminiHistoryItem[] to expected format
    return history.map((item) => ({
      role: item.role || "user",
      // Extract text from parts array
      content: item.parts
        .map((part) => part.text || "")
        .filter((text) => text.length > 0)
        .join(""),
      timestamp: new Date(), // GeminiHistoryItem doesn't have timestamp
    }));
  }

  getClient(): GeminiClient | null {
    this.ensureInitialized();
    return this.configurationService.getClient();
  }

  async sendMessageStreaming(message: string, callbacks: IProviderStreamingCallbacks): Promise<void> {
    this.ensureInitialized();

    // Convert IStreamingCallbacks to StreamingCallbacks format
    const adapterCallbacks = {
      onStreamChunk: callbacks.onStreamChunk,
      onThinkingChunk: callbacks.onThinkingChunk,
      onSystemMessage: callbacks.onSystemMessage,
      onResultMessage: callbacks.onResultMessage,
      onPermissionRequest: callbacks.onPermissionRequest,
      onToolExecutionStart: callbacks.onToolExecutionStart,
      onToolExecutionComplete: callbacks.onToolExecutionComplete,
      onToolFailure: callbacks.onToolFailure,
      onComplete: callbacks.onComplete,
      onError: callbacks.onError,
      onCancelRequested: callbacks.onCancelRequested,
      abortController: callbacks.abortController,
    };

    // Delegate to streamMessage which now uses core adapter
    return this.streamMessage(message, adapterCallbacks);
  }

  async cleanup(): Promise<void> {
    await this.dispose();
  }

  async dispose(): Promise<void> {
    try {
      this.logInfo("Disposing Service-based Gemini Provider");

      // End any active session
      await this.sessionService.endCurrentSession();

      // Cleanup all services
      await Promise.all([
        this.configurationService.cleanup(),
        this.callbackAdapterService.cleanup(),
        this.backupService.cleanup(),
        this.sessionManagementService.cleanup(),
        this.streamingService.cleanup(),
        this.toolExecutionService.cleanup(),
        this.quotaService.cleanup(),
        this.sessionService.cleanup(),
        this.modelService.cleanup(),
        this.errorHandlerService.cleanup(),
      ]);

      // Clear core references
      this.checkpointWrapper = null;
      this.setInitialized(false);

      this.logInfo("Service-based Gemini Provider disposed successfully");
    } catch (error) {
      const err = this.wrapError(error);
      this.logError("Failed to dispose Service-based Gemini Provider", err);
    }
  }

  getCurrentModelInfo(): { model: string; isUsingFallback: boolean; hasQuotaError: boolean } | null {
    this.ensureInitialized();
    const modelInfo = this.modelService.getCurrentModelInfo();
    if (!modelInfo) {
      return null;
    }

    // Convert ModelInfo to expected format
    return {
      model: modelInfo.name,
      isUsingFallback: modelInfo.isUsingFallback,
      hasQuotaError: modelInfo.hasQuotaError,
    };
  }

  /**
   * Get current session tag
   */
  getCurrentSessionTag(): string | null {
    return this.sessionManagementService.getCurrentSessionTag();
  }

  /**
   * Set session tag (called by ProviderManager before createSession)
   */
  setSessionTag(tag: string): void {
    this.sessionManagementService.setSessionTag(tag);
  }

  /**
   * Perform final save before session ends
   * This is called when the app is about to exit
   */
  async performFinalSave(): Promise<void> {
    try {
      const currentSessionTag = this.sessionManagementService.getCurrentSessionTag();
      if (!this.checkpointWrapper || !currentSessionTag) {
        this.logDebug("Skipping final save - no checkpoint wrapper or session tag");
        return;
      }

      const latestHistory = this.getConversationHistory();
      this.logInfo(
        `[GEMINI FINAL SAVE] Saving final conversation state: ${currentSessionTag} (${latestHistory.length} items)`
      );

      // Use the checkpoint wrapper's saveCheckpoint method directly
      await this.checkpointWrapper.saveCheckpoint(currentSessionTag);
      this.logInfo(`[GEMINI FINAL SAVE] Successfully saved final conversation state`);
    } catch (error) {
      this.logError(`[GEMINI FINAL SAVE] Failed to save final conversation state:`, error);
    }
  }

  /**
   * Get current session ID (implements IProvider interface)
   */
  getCurrentSessionId(): string | null {
    return this.sessionManagementService.getCurrentSessionTag();
  }

  /**
   * Get checkpoint wrapper for session discovery and validation
   */
  getCheckpointWrapper(): GeminiCheckpointWrapper | null {
    return this.checkpointWrapper;
  }

  /**
   * Process thinking chunk for Gemini provider
   * Gemini displays thinking content as structured items
   */
  processThinkingChunk(text: string): IThinkingProcessingResult {
    try {
      const thoughtSummary = JSON.parse(text);
      return {
        shouldDisplay: true,
        thinkingItem: {
          subject: thoughtSummary.subject || "Thinking...",
          description: thoughtSummary.description || "",
        },
      };
    } catch (error) {
      // Fallback for invalid JSON
      return {
        shouldDisplay: true,
        thinkingItem: {
          subject: text,
          description: "",
        },
      };
    }
  }

  /**
   * Process streaming turn using services
   */
  private async processStreamingTurnWithServices(
    message: string,
    callbacks: GeminiCoreAdapterCallbacks
  ): Promise<void> {
    try {
      // Create Turn for streaming
      const turn = await this.sessionService.createTurn(message);
      const userInput = [{ text: message }];
      const abortSignal = callbacks.abortController?.signal || new AbortController().signal;

      // Process streaming with streaming service
      await this.streamingService.processStreamingTurn(turn, userInput, callbacks, abortSignal);
    } catch (error) {
      // Let Gemini core handle quota errors and automatic fallback/retry
      // The core will automatically switch models and retry when needed
      // Our manual quota handling was interfering with the automatic mechanism
      throw error;
    }
  }

  /**
   * Handle flash fallback requests from Gemini core
   * This is called by the core when quota errors occur and fallback is needed
   */
  private async handleFlashFallback(currentModel: string, fallbackModel: string, _error?: unknown): Promise<boolean> {
    this.logInfo(`Flash fallback requested: ${currentModel} -> ${fallbackModel}`);

    // Update model service state to reflect the fallback
    this.modelService.setQuotaError(true, `Quota exceeded for ${currentModel}`);

    // Trigger UI notification about the fallback
    // This needs to be called to inform the user about the model switch
    const currentCallback = this.callbackAdapterService.getCurrentFlashFallbackCallback();
    if (currentCallback) {
      try {
        await currentCallback(currentModel, fallbackModel, _error);
      } catch (error) {
        this.logError("Error in onFlashFallback UI callback:", error);
      }
    }

    // Auto-approve fallback - let Gemini core handle the model switch and automatic retry
    // The core will automatically retry the user's message with the new model
    return true;
  }
}
