/**
 * Claude Provider - Main service orchestrator for Claude AI interactions
 *
 * @class ClaudeProvider
 * @extends {BaseProvider}
 * @implements {AIProvider}
 * @implements {IProvider}
 * @description Orchestrates Claude services for real-time streaming responses with permission system.
 * Refactored to use focused services for better maintainability and separation of concerns.
 */

import { AIProvider, StreamingCallbacks } from "../types.js";
import {
  IProvider,
  IThinkingProcessingResult,
  IProviderResponse,
  IProviderStreamingCallbacks,
  IProviderCapabilities,
} from "../../../interfaces/core/IProvider.js";
import { injectable, inject } from "inversify";
import { TYPES } from "../../../infrastructure/di/types.js";
import { IModelService } from "../../../interfaces/core/IModelService.js";
import { IMCPService } from "../../core/MCPService.js";
import { ILoggerService } from "../../../interfaces/core/ILoggerService.js";
import { BaseProvider } from "../shared/BaseProvider.js";
import { SessionRegistryManager } from "../../../services/sync/index.js";
import { ClaudePermissionRequest } from "./types.js";
import { SessionInfo, PermissionStats } from "../../../interfaces/core/IProviderService.js";
import { StreamingStats } from "../../../interfaces/core/IProviderService.js";
import { ToolConfirmationOutcome } from "@google/gemini-cli-core";

/**
 * Service statistics interface for Claude provider
 */
export interface ClaudeServiceStats {
  session: SessionInfo | null;
  permission: PermissionStats;
  streaming: StreamingStats;
  process: boolean;
}

/**
 * Claude provider response interface
 */
export interface ClaudeProviderResponse {
  success: boolean;
  error?: string;
  stderr?: string;
}
import { ProviderType } from "../../../abstractions/providers/index.js";
import { ClaudeStreamParser } from "./services/index.js";

import {
  ClaudeSessionService,
  ClaudeProcessService,
  ClaudePermissionService,
  ClaudeStreamingService,
} from "./services/index.js";

import { ErrorHandlerService } from "../shared/ErrorHandlerService.js";

/**
 * Claude Provider implementation
 *
 * @class ClaudeProvider
 * @extends {BaseProvider}
 * @implements {AIProvider}
 * @implements {IProvider}
 * @description Main provider class for Claude AI interactions, managing session lifecycle,
 * streaming responses, permissions, and tool execution through dedicated service classes.
 */
@injectable()
export class ClaudeProvider extends BaseProvider implements AIProvider, IProvider {
  readonly name: string = "claude";
  readonly capabilities: IProviderCapabilities = {
    supportsStreaming: true,
    supportsToolExecution: true,
    supportsSessionManagement: true,
    maxTokens: 200000,
    supportedModels: ["claude-4-sonnet", "claude-4-opus"],
    permissions: true,
    thinking: true,
    multimodal: false,
    coreIntegrated: true,
    turnSystem: false,
    checkpointing: true,
    supportsPermissionModeCycling: true,
    supportsAutoModelSwitching: true,
    requiresManualSave: false,
  };

  // Orchestrated services
  private sessionService: ClaudeSessionService;
  private processService: ClaudeProcessService;
  private permissionService: ClaudePermissionService;
  private streamingService: ClaudeStreamingService;
  private errorHandler: ErrorHandlerService;

  // Dependencies
  private registry: SessionRegistryManager | null = null;
  private modelService: IModelService | null = null;
  private mcpService: IMCPService | null = null;

  private mcpConfigPath: string | null = null;
  get currentSessionId(): string | null {
    return this.sessionService.getCurrentSessionId();
  }

  set currentSessionId(value: string | null) {
    this.sessionService.setCurrentSessionId(value);
  }

  getCurrentSessionTag(): string | null {
    return this.sessionService.getCurrentSessionTag();
  }

  setSessionTag(tag: string): void {
    this.sessionService.setSessionTag(tag);
  }

  constructor(
    @inject(TYPES.LoggerService) logger: ILoggerService,
    @inject(TYPES.ClaudeSessionService) sessionService: ClaudeSessionService,
    @inject(TYPES.ClaudeProcessService) processService: ClaudeProcessService,
    @inject(TYPES.ClaudePermissionService) permissionService: ClaudePermissionService,
    @inject(TYPES.ClaudeStreamingService) streamingService: ClaudeStreamingService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ModelService) modelService?: IModelService,
    @inject(TYPES.MCPService) mcpService?: IMCPService
  ) {
    super();
    this.setLogger(logger);
    this.modelService = modelService || null;
    this.mcpService = mcpService || null;
    this.registry = null;

    // Inject services
    this.sessionService = sessionService;
    this.processService = processService;
    this.permissionService = permissionService;
    this.streamingService = streamingService;
    this.errorHandler = errorHandler;

    // Set up service dependencies
    if (this.registry) {
      this.sessionService.setRegistry(this.registry);
    }
  }

  /**
   * Initialize the provider and all its services
   */
  async initialize(): Promise<void> {
    try {
      // Initialize all services
      await Promise.all([
        this.sessionService.initialize(),
        this.processService.initialize(),
        this.permissionService.initialize(),
        this.streamingService.initialize(),
        this.errorHandler.initialize(),
      ]);

      this.mcpConfigPath = await this.generateMCPConfig();

      this.setInitialized(true);
      this.logInfo("Claude Streaming Provider initialized with all services");
    } catch (error) {
      const err = this.wrapError(error);
      this.logError("Failed to initialize ClaudeProvider", err);
      throw err;
    }
  }

  /**
   * Send message with streaming support
   */
  async sendMessage(message: string): Promise<IProviderResponse> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      let responseText = "";
      let isCompleted = false;

      // Set up streaming callbacks (will be provided by UI layer)
      const callbacks: StreamingCallbacks = {
        onStreamChunk: (text: string) => {
          responseText += text;
          // In non-streaming mode, we just accumulate text
        },
        onPermissionRequest: undefined, // No permission requests in sendMessage mode
        onComplete: async (response: any) => {
          if (!isCompleted) {
            isCompleted = true;
            resolve({
              text: responseText,
              provider: "claude",
              timestamp: new Date(),
              model: this.sessionService.getCurrentModel() || undefined,
            });
          }
        },
        onError: (error: string) => {
          if (!isCompleted) {
            isCompleted = true;
            reject(new Error(error));
          }
        },
      };

      this.streamMessage(message, callbacks).catch(reject);
    });
  }

  /**
   * Send message for read-only consultation (used by askModel MCP tool)
   * This method does NOT update session references and is used for cross-provider queries
   */
  async sendMessageReadOnly(message: string): Promise<IProviderResponse> {
    this.ensureInitialized();

    // Get current session ID before starting to preserve it
    const originalSessionId = this.sessionService.getCurrentSessionId();
    this.logDebug(`[READ-ONLY] Starting read-only query, preserving session: ${originalSessionId}`);

    return new Promise((resolve, reject) => {
      let responseText = "";
      let isCompleted = false;

      // Set up streaming callbacks for read-only operation
      const callbacks: StreamingCallbacks = {
        onStreamChunk: (text: string) => {
          responseText += text;
          // In read-only mode, we just accumulate text
        },
        onPermissionRequest: undefined, // No permission requests in read-only mode
        onComplete: async (response: any) => {
          if (!isCompleted) {
            isCompleted = true;

            // Restore the original session ID if it was changed
            const currentSessionId = this.sessionService.getCurrentSessionId();
            if (currentSessionId !== originalSessionId && originalSessionId) {
              this.logDebug(`[READ-ONLY] Restoring original session: ${originalSessionId} (was ${currentSessionId})`);
              this.sessionService.setCurrentSessionId(originalSessionId);
            }

            resolve({
              text: responseText,
              provider: "claude",
              timestamp: new Date(),
              model: this.sessionService.getCurrentModel() || undefined,
            });
          }
        },
        onError: (error: string) => {
          if (!isCompleted) {
            isCompleted = true;

            // Restore the original session ID on error too
            const currentSessionId = this.sessionService.getCurrentSessionId();
            if (currentSessionId !== originalSessionId && originalSessionId) {
              this.logDebug(`[READ-ONLY] Restoring original session after error: ${originalSessionId}`);
              this.sessionService.setCurrentSessionId(originalSessionId);
            }

            reject(new Error(error));
          }
        },
      };

      // Use internal streaming method for read-only operation
      this.streamMessageInternal(message, callbacks, false, true).catch(reject);
    });
  }

  /**
   * Stream message with real-time callbacks - orchestrates all services
   * Overload for both IProvider and AIProvider interfaces
   */
  async streamMessage(
    message: string | Array<{ role: string; content: string }>,
    callbacks: IProviderStreamingCallbacks | StreamingCallbacks,
    isContinuation?: boolean
  ): Promise<void> {
    // SessionManager always passes IProviderStreamingCallbacks, so we always use that handler
    return this.streamMessageInternalProvider(message, callbacks as IProviderStreamingCallbacks, isContinuation);
  }

  private async streamMessageInternal(
    message: string | unknown[],
    callbacks: StreamingCallbacks,
    forceNewSession: boolean = false,
    isReadOnly: boolean = false
  ): Promise<void> {
    this.ensureInitialized();

    const messageText = typeof message === "string" ? message : JSON.stringify(message);

    try {
      const mcpConfigPath = this.mcpConfigPath;

      if (!mcpConfigPath) {
        throw new Error("MCP configuration not initialized. Please ensure provider is properly initialized.");
      }

      const modelFlag = this.processService.getModelFlag();
      await this.sessionService.loadSessionIfNeeded();
      const commandArgs = {
        sessionId: this.sessionService.getCurrentSessionId() || undefined,
        model: modelFlag,
        message: messageText,
        mcpConfigPath,
        permissionMode: this.permissionService.getPermissionMode(),
        forceNewSession: forceNewSession || this.sessionService.isCreatingSession(),
      };

      // Check if already cancelled before starting
      if (callbacks.abortController?.signal.aborted) {
        this.logInfo("Stream already cancelled before starting");
        callbacks.onError?.("Stream cancelled before starting");
        return;
      }

      // Set up streaming service event handlers with modified callbacks
      // We need to intercept onStreamChunk to process raw JSON first
      const modifiedCallbacks = {
        ...callbacks,
        onStreamChunk: (chunk: string) => {
          // Process the raw JSON chunk through the stream parser
          this.streamingService.processStreamChunk(chunk);
        },
      };

      this.streamingService.setupStreamParserEvents(
        callbacks,
        // Session update handler
        (sessionId: string, source: "system" | "result") => {
          this.sessionService.updateSessionId(sessionId, source);
        },
        // Model update handler
        (model: string) => {
          this.sessionService.setCurrentModel(model);
        },
        // Permission request handler
        async (request: ClaudePermissionRequest) => {
          const result = await this.permissionService.processPermissionRequest(
            request,
            this.sessionService.getCurrentSessionId(),
            callbacks.onPermissionRequest
              ? async (req: ClaudePermissionRequest) => {
                  if (callbacks.onPermissionRequest) {
                    const outcome = await callbacks.onPermissionRequest({
                      toolName: req.tool,
                      args: req.arguments || {},
                      description: req.description,
                      toolUseId: req.toolUseId,
                    } as any);
                    // Convert ToolConfirmationOutcome to boolean for Claude permission service
                    const approved =
                      outcome === ToolConfirmationOutcome.ProceedOnce ||
                      outcome === ToolConfirmationOutcome.ProceedAlways;
                    this.logInfo(`🔍 Claude permission conversion: ${JSON.stringify(outcome)} -> ${approved}`);
                    return {
                      approved: approved,
                      reason: outcome === ToolConfirmationOutcome.Cancel ? "User denied permission" : undefined,
                    };
                  }
                  return { approved: false };
                }
              : undefined
          );
          // Convert ClaudePermissionResponse to ToolConfirmationOutcome
          return result.approved ? ToolConfirmationOutcome.ProceedOnce : ToolConfirmationOutcome.Cancel;
        },
        // Pass read-only flag
        isReadOnly
      );

      // Execute command with error handling
      const result = await this.errorHandler.handleWithRetry(
        () => this.processService.executeStreamingCommand(commandArgs, modifiedCallbacks),
        {
          operation: "streamMessage",
          provider: ProviderType.CLAUDE,
          model: modelFlag,
          timestamp: new Date(),
        }
      );

      if (!result.success) {
        throw new Error(`Claude CLI failed: ${result.error || result.stderr}`);
      }
    } catch (error) {
      // Check if this is a cancellation
      if (callbacks.abortController?.signal.aborted) {
        this.logInfo("Stream cancelled during execution");
        callbacks.onError?.("Stream cancelled by user");
        return;
      }

      const friendlyMessage = this.errorHandler.createUserFriendlyMessage(error, {
        operation: "streaming",
        timestamp: new Date(),
      });
      callbacks.onError?.(friendlyMessage);
    }
  }

  /**
   * Stream message for IProviderStreamingCallbacks interface
   */
  private async streamMessageInternalProvider(
    message: string | unknown[],
    callbacks: IProviderStreamingCallbacks,
    isContinuation?: boolean
  ): Promise<void> {
    this.ensureInitialized();

    // Convert IProviderStreamingCallbacks to StreamingCallbacks
    const streamingCallbacks: StreamingCallbacks = {
      onStreamChunk: callbacks.onStreamChunk,
      onThinkingChunk: callbacks.onThinkingChunk,
      onSystemMessage: callbacks.onSystemMessage
        ? (data: { type: string; message: string; timestamp?: Date }) => {
            callbacks.onSystemMessage!({
              type: data.type as any,
              message: data.message,
              timestamp: data.timestamp,
            });
          }
        : undefined,
      onResultMessage: callbacks.onResultMessage
        ? (data: { content: string; timestamp: Date; metadata?: Record<string, unknown> }) => {
            callbacks.onResultMessage!({
              role: "assistant",
              content: data.content,
              timestamp: data.timestamp,
              metadata: data.metadata,
            });
          }
        : undefined,
      onPermissionRequest: callbacks.onPermissionRequest
        ? async (request: {
            toolName: string;
            args: Record<string, unknown>;
            description?: string;
            toolUseId?: string;
          }) => {
            const response = await callbacks.onPermissionRequest!({
              toolName: request.toolName,
              arguments: request.args,
              description: request.description,
              toolUseId: request.toolUseId,
            });
            // Convert IPermissionResponse to ToolConfirmationOutcome
            const outcome = response.approved ? ToolConfirmationOutcome.ProceedOnce : ToolConfirmationOutcome.Cancel;
            this.logInfo(
              `🔍 Claude IProvider permission conversion: ${response.approved} -> ${JSON.stringify(outcome)}`
            );
            return outcome;
          }
        : undefined,
      onToolExecutionStart: callbacks.onToolExecutionStart
        ? (data: { toolName: string; args: Record<string, unknown>; executionId: string }) => {
            callbacks.onToolExecutionStart!({
              toolName: data.toolName,
              arguments: data.args,
              executionId: data.executionId,
              timestamp: new Date(),
            });
          }
        : undefined,
      onToolExecutionComplete: callbacks.onToolExecutionComplete
        ? (data: { toolName: string; result: unknown; executionId: string; success: boolean }) => {
            callbacks.onToolExecutionComplete!({
              toolName: data.toolName,
              arguments: {},
              executionId: data.executionId,
              timestamp: new Date(),
              result: data.result,
              status: data.success ? "completed" : "failed",
            });
          }
        : undefined,
      onToolFailure: callbacks.onToolFailure
        ? (data: { toolName: string; error: string; executionId: string }) => {
            callbacks.onToolFailure!({
              toolName: data.toolName,
              arguments: {},
              executionId: data.executionId,
              timestamp: new Date(),
              error: data.error,
              status: "failed",
            });
          }
        : undefined,
      onComplete: callbacks.onComplete,
      onError: callbacks.onError,
      onCancelRequested: callbacks.onCancelRequested,
      abortController: callbacks.abortController,
    };

    return this.streamMessageInternal(message, streamingCallbacks, isContinuation);
  }

  // Removed - delegated to ClaudePermissionService

  // Removed - delegated to ClaudeProcessService

  // Removed - delegated to ClaudeStreamingService

  // Removed - delegated to ClaudeSessionService

  /**
   * Create new session (Session Creation Mode - fresh session files)
   */
  async createSession(tag: string): Promise<void> {
    this.ensureInitialized();

    // Check if we already have a Claude session for this tag
    const existingSessionId = await this.sessionService.findSessionByTag(tag);

    if (existingSessionId) {
      this.logInfo(
        `Found existing Claude session for tag: ${tag} (session: ${existingSessionId}), resuming instead of creating fresh`
      );
      return this.resumeSession(tag);
    }

    // Only create fresh session if no existing mapping found
    await this.sessionService.createSession(tag);
    this.streamingService.clearStreamParser();

    try {
      // Send initialization message to create fresh session (no --resume)
      await this.sendMessage("init. do no do anything. say ok");

      if (this.sessionService.getCurrentSessionId()) {
        await this.sessionService.completeSessionCreation(this.sessionService.getCurrentSessionId()!);
        this.logInfo(`Fresh Claude session created: ${tag} -> ${this.sessionService.getCurrentSessionId()}`);
      }
    } finally {
      // Session service handles clearing creation flag
    }
  }

  /**
   * Resume session
   */
  async resumeSession(tag: string): Promise<void> {
    this.ensureInitialized();
    await this.sessionService.resumeSession(tag);
    this.streamingService.clearStreamParser();
  }

  /**
   * Save current session
   */
  async saveSession(tag: string): Promise<void> {
    this.ensureInitialized();
    await this.sessionService.saveSession(tag);
  }

  /**
   * Save session tag (private method for testing)
   */
  private async saveSessionTag(tag: string, sessionId: string): Promise<void> {
    return this.sessionService.saveSessionTag(tag, sessionId);
  }

  /**
   * Find session by tag (private method for testing)
   */
  private async findSessionByTag(tag: string): Promise<string | null> {
    return this.sessionService.findSessionByTag(tag);
  }

  /**
   * Update registry with new session (private method for testing)
   */
  private async updateRegistryWithNewSession(sessionId: string, tag: string): Promise<void> {
    return this.sessionService.updateRegistryWithNewSession(sessionId, tag);
  }

  /**
   * Get current memory file path
   */
  getCurrentMemoryFile(): string | null {
    return this.sessionService.getCurrentMemoryFile();
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    // Cleanup all services
    await Promise.all([
      this.processService.cleanup(),
      this.sessionService.cleanup(),
      this.permissionService.cleanup(),
      this.streamingService.cleanup(),
      this.errorHandler.cleanup(),
    ]);

    // Clean up session-specific MCP config file
    await this.cleanupMCPConfig();

    this.setInitialized(false);
    this.logInfo("Claude streaming provider disposed");
  }

  /**
   * Clean up MCP config file
   */
  private async cleanupMCPConfig(): Promise<void> {
    try {
      if (this.mcpService) {
        await this.mcpService.cleanupIntegratedConfigs();
      }
    } catch (error) {
      // Ignore errors - files might not exist or already cleaned up
      this.logDebug(`MCP config cleanup: ${(error as Error).message}`);
    }
  }

  // Helper methods now delegated to services

  /**
   * Generate MCP config
   */
  private async generateMCPConfig(): Promise<string> {
    try {
      if (this.mcpService) {
        const sessionTag = this.getCurrentSessionTag();
        return await this.mcpService.generateIntegratedConfig(
          this.permissionService.getPermissionMode(),
          sessionTag || undefined
        );
      } else {
        throw new Error("MCP Service not available");
      }
    } catch (error) {
      this.logError("Failed to generate integrated MCP config:", error);

      // Fallback to simple permission-only config
      if (this.mcpService) {
        const sessionTag = this.getCurrentSessionTag();
        return await this.mcpService.generateFallbackConfig(
          this.permissionService.getPermissionMode(),
          sessionTag || undefined
        );
      } else {
        throw new Error("MCP Service not available");
      }
    }
  }

  // Method overloads for both interfaces
  async sendMessageStreaming(message: string, callbacks: IProviderStreamingCallbacks): Promise<void>;
  async sendMessageStreaming(message: string, callbacks: StreamingCallbacks): Promise<void>;
  async sendMessageStreaming(
    message: string,
    callbacks: IProviderStreamingCallbacks | StreamingCallbacks
  ): Promise<void> {
    this.ensureInitialized();

    // Check if it's IProviderStreamingCallbacks by looking for a property that exists in IProviderStreamingCallbacks but not StreamingCallbacks
    const isIProviderCallbacks =
      "onMessage" in callbacks || (callbacks.onSystemMessage && typeof callbacks.onSystemMessage === "function");

    if (isIProviderCallbacks) {
      return this.sendMessageStreamingProvider(message, callbacks as IProviderStreamingCallbacks);
    } else {
      return this.streamMessage(message, callbacks as StreamingCallbacks);
    }
  }

  // Implementation for IProvider interface
  private async sendMessageStreamingProvider(message: string, callbacks: IProviderStreamingCallbacks): Promise<void> {
    this.ensureInitialized();

    // Convert IProviderStreamingCallbacks to StreamingCallbacks
    const streamingCallbacks: StreamingCallbacks = {
      onStreamChunk: callbacks.onStreamChunk,
      onThinkingChunk: callbacks.onThinkingChunk,
      onSystemMessage: callbacks.onSystemMessage
        ? (data: { type: string; message: string; timestamp?: Date }) => {
            callbacks.onSystemMessage!({
              type: data.type as any,
              message: data.message,
              timestamp: data.timestamp,
            });
          }
        : undefined,
      onResultMessage: callbacks.onResultMessage
        ? (data: { content: string; timestamp: Date; metadata?: Record<string, unknown> }) => {
            callbacks.onResultMessage!({
              role: "assistant",
              content: data.content,
              timestamp: data.timestamp,
              metadata: data.metadata,
            });
          }
        : undefined,
      onPermissionRequest: callbacks.onPermissionRequest
        ? async (request: {
            toolName: string;
            args: Record<string, unknown>;
            description?: string;
            toolUseId?: string;
          }) => {
            const response = await callbacks.onPermissionRequest!({
              toolName: request.toolName,
              arguments: request.args,
              description: request.description,
              toolUseId: request.toolUseId,
            });
            // Convert IPermissionResponse to ToolConfirmationOutcome
            const outcome = response.approved ? ToolConfirmationOutcome.ProceedOnce : ToolConfirmationOutcome.Cancel;
            this.logInfo(
              `🔍 Claude IProvider permission conversion: ${response.approved} -> ${JSON.stringify(outcome)}`
            );
            return outcome;
          }
        : undefined,
      onToolExecutionStart: callbacks.onToolExecutionStart
        ? (data: { toolName: string; args: Record<string, unknown>; executionId: string }) => {
            callbacks.onToolExecutionStart!({
              toolName: data.toolName,
              arguments: data.args,
              executionId: data.executionId,
              timestamp: new Date(),
            });
          }
        : undefined,
      onToolExecutionComplete: callbacks.onToolExecutionComplete
        ? (data: { toolName: string; result: unknown; executionId: string; success: boolean }) => {
            callbacks.onToolExecutionComplete!({
              toolName: data.toolName,
              arguments: {},
              executionId: data.executionId,
              timestamp: new Date(),
              result: data.result,
              status: data.success ? "completed" : "failed",
            });
          }
        : undefined,
      onToolFailure: callbacks.onToolFailure
        ? (data: { toolName: string; error: string; executionId: string }) => {
            callbacks.onToolFailure!({
              toolName: data.toolName,
              arguments: {},
              executionId: data.executionId,
              timestamp: new Date(),
              error: data.error,
              status: "failed",
            });
          }
        : undefined,
      onComplete: callbacks.onComplete,
      onError: callbacks.onError,
      onCancelRequested: callbacks.onCancelRequested,
      abortController: callbacks.abortController,
    };

    return this.streamMessage(message, streamingCallbacks);
  }

  /**
   * Get current model
   */
  getModel(): string | null {
    return this.sessionService.getCurrentModel() || this.modelService?.getClaudeCliModelFlag() || null;
  }

  /**
   * Update current model
   */
  updateCurrentModel(model: string): void {
    this.sessionService.setCurrentModel(model);
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.sessionService.getCurrentSessionId();
  }

  /**
   * Set permission mode
   */
  setPermissionMode(mode: string): void {
    if (this.permissionService.isValidPermissionMode(mode)) {
      this.permissionService.setPermissionMode(mode);
    } else {
      this.logWarn(`Invalid permission mode: ${mode}`);
    }
  }

  /**
   * Get current permission mode
   */
  getPermissionMode(): string {
    return this.permissionService.getPermissionMode();
  }

  /**
   * Cleanup method (implements BaseProvider)
   */
  async cleanup(): Promise<void> {
    await this.dispose();
  }

  /**
   * Get Claude's actual session ID from stream (may differ from our session ID)
   */
  getClaudeActualSessionId(): string | null {
    return this.streamingService.getClaudeActualSessionId();
  }

  /**
   * Process thinking chunk for Claude provider
   * Claude filters out thinking content - doesn't display it
   */
  processThinkingChunk(_text: string): IThinkingProcessingResult {
    return {
      shouldDisplay: false,
    };
  }

  /**
   * Set registry for session service
   */
  setRegistry(registry: SessionRegistryManager): void {
    this.registry = registry;
    this.sessionService.setRegistry(registry);
  }

  /**
   * Get service statistics for monitoring
   */
  getServiceStats(): ClaudeServiceStats {
    const claudeSessionInfo = this.sessionService.getSessionInfo();
    const sessionInfo = claudeSessionInfo
      ? {
          ...claudeSessionInfo,
          provider: "claude" as ProviderType,
          isActive: true,
        }
      : null;

    return {
      session: sessionInfo,
      permission: this.permissionService.getPermissionStats(),
      streaming: this.streamingService.getStreamingStats(),
      process: this.processService.isProcessRunning(),
    };
  }

  /**
   * Check if session file has been written to disk
   */
  async hasSessionContent(): Promise<boolean> {
    const sessionPath = this.sessionService.getCurrentMemoryFile();
    if (!sessionPath) {
      return false;
    }

    try {
      const fs = await import("node:fs/promises");
      const stats = await fs.stat(sessionPath);

      // Check if file exists and has content (> 0 bytes)
      const hasContent = stats.size > 0;

      this.logDebug(`Session file check: ${sessionPath} - size: ${stats.size}, hasContent: ${hasContent}`);
      return hasContent;
    } catch (error) {
      this.logDebug(`Session file not found or error checking: ${error}`);
      return false;
    }
  }
}
