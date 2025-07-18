/**
 * Gemini Callback Adapter Service
 * Handles callback transformation and event handling for Gemini provider
 * Extracted from GeminiProvider.ts to reduce complexity
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../../../infrastructure/di/types.js';
import { ILoggerService } from '../../../../interfaces/core/ILoggerService.js';
import { BaseProvider } from '../../shared/BaseProvider.js';
import { StreamingCallbacks } from '../../types.js';
import { 
  GeminiCoreAdapterCallbacks, 
  GeminiStreamingResult, 
  GeminiToolResponse, 
  GeminiToolExecutionContext 
} from '../types.js';
import { ToolCallRequestInfo } from "@google/gemini-cli-core";
import { GeminiToolExecutionService } from './GeminiToolExecutionService.js';
import { GeminiStreamingService } from './GeminiStreamingService.js';
import { GeminiBackupService } from './GeminiBackupService.js';
import { GeminiSessionManagementService } from './GeminiSessionManagementService.js';
import { GeminiConfigurationService } from './GeminiConfigurationService.js';
import { GeminiCheckpointWrapper } from '../../../../utils/GeminiCheckpointWrapper.js';
import { IProviderResponse } from '../../../../interfaces/core/IProvider.js';
import { ProviderType } from '../../../../abstractions/providers/index.js';

@injectable()
export class GeminiCallbackAdapterService extends BaseProvider {
  private currentOnFlashFallbackCallback: ((currentModel: string, fallbackModel: string, error?: unknown) => Promise<boolean>) | null = null;
  private checkpointWrapper: GeminiCheckpointWrapper | null = null;

  constructor(
    @inject(TYPES.LoggerService) logger: ILoggerService,
    @inject(TYPES.GeminiToolExecutionService) private toolExecutionService: GeminiToolExecutionService,
    @inject(TYPES.GeminiStreamingService) private streamingService: GeminiStreamingService,
    @inject(TYPES.GeminiBackupService) private backupService: GeminiBackupService,
    @inject(TYPES.GeminiSessionManagementService) private sessionManagementService: GeminiSessionManagementService,
    @inject(TYPES.GeminiConfigurationService) private configurationService: GeminiConfigurationService
  ) {
    super();
    this.setLogger(logger);
  }

  async initialize(): Promise<void> {
    if (this.isProviderInitialized()) {
      return;
    }

    try {
      this.logInfo('Initializing Gemini Callback Adapter Service');
      this.setInitialized(true);
      this.logInfo('Gemini Callback Adapter Service initialized successfully');
    } catch (error) {
      const err = this.wrapError(error);
      this.logError('Failed to initialize Gemini Callback Adapter Service', err);
      throw err;
    }
  }

  async cleanup(): Promise<void> {
    try {
      this.logInfo('Cleaning up Gemini Callback Adapter Service');
      this.currentOnFlashFallbackCallback = null;
      this.setInitialized(false);
      this.logInfo('Gemini Callback Adapter Service cleaned up successfully');
    } catch (error) {
      const err = this.wrapError(error);
      this.logError('Failed to cleanup Gemini Callback Adapter Service', err);
    }
  }

  convertMessageToString(message: string | Array<{ role: string; content: string; timestamp?: Date }>): string {
    return typeof message === 'string' ? message : JSON.stringify(message);
  }

  setFlashFallbackCallback(callback: ((currentModel: string, fallbackModel: string, error?: unknown) => Promise<boolean>) | null): void {
    this.currentOnFlashFallbackCallback = callback;
  }

  setCheckpointWrapper(wrapper: GeminiCheckpointWrapper | null): void {
    this.checkpointWrapper = wrapper;
  }

  createAdapterCallbacks(callbacks: StreamingCallbacks): GeminiCoreAdapterCallbacks {
    return {
      onStreamChunk: callbacks.onStreamChunk,
      onContentMessage: callbacks.onContentMessage,
      onThinkingChunk: callbacks.onThinkingChunk,
      onSystemMessage: callbacks.onSystemMessage,
      onResultMessage: callbacks.onResultMessage,
      onPermissionRequest: callbacks.onPermissionRequest,
      onPermissionDenied: callbacks.onPermissionDenied,
      onToolExecutionStart: callbacks.onToolExecutionStart,
      onToolExecutionComplete: callbacks.onToolExecutionComplete,
      onToolFailure: callbacks.onToolFailure,
      onComplete: async (result: GeminiStreamingResult) => {
        await this.handleStreamingComplete(result, callbacks);
      },
      onError: (error: string) => {
        this.handleStreamingError(error, callbacks);
      },
      onCancelRequested: callbacks.onCancelRequested,
      onContinue: async (functionResponses: GeminiToolResponse[]) => {
        await this.handleToolContinuation(functionResponses, callbacks);
      },
      onFlashFallback: callbacks.onFlashFallback,
      abortController: callbacks.abortController
    };
  }

  private async handleStreamingComplete(result: GeminiStreamingResult, callbacks: StreamingCallbacks): Promise<void> {
    // ✅ CRITICAL FIX: Perform backup-first save before calling onComplete
    await this.performBackupFirstSave();
    
    if (callbacks.onComplete) {
      // Convert GeminiStreamingResult to ProviderResponse
      const providerResponse: IProviderResponse = {
        text: result.response?.text || '',
        provider: ProviderType.GEMINI,
        timestamp: new Date(),
        error: result.error
      };
      await callbacks.onComplete(providerResponse);
    }
    
    this.currentOnFlashFallbackCallback = null;
  }

  /**
   * Perform backup-first save using injected services
   */
  private async performBackupFirstSave(): Promise<void> {
    try {
      const currentSessionTag = this.sessionManagementService.getCurrentSessionTag();
      if (currentSessionTag && this.checkpointWrapper) {
        this.logInfo(`🔄 Triggering backup-first save for session: ${currentSessionTag}`);
        await this.backupService.performBackupFirstSave(currentSessionTag, this.checkpointWrapper);
        this.logInfo(`✅ Backup-first save completed for session: ${currentSessionTag}`);
      } else {
        this.logWarn(`⚠️ Skipping backup-first save - missing session tag (${!!currentSessionTag}) or checkpoint wrapper (${!!this.checkpointWrapper})`);
      }
    } catch (error) {
      this.logError("❌ Failed backup-first save process:", error);
      // Don't throw - we don't want to break the completion flow
    }
  }

  private handleStreamingError(error: string, callbacks: StreamingCallbacks): void {
    this.currentOnFlashFallbackCallback = null;
    if (callbacks.onError) {
      callbacks.onError(error);
    }
  }

  private async handleToolContinuation(functionResponses: GeminiToolResponse[], callbacks: StreamingCallbacks): Promise<void> {
    this.logInfo("🔧 Starting actual tool execution", {
      toolCount: functionResponses.length,
      tools: functionResponses.map(r => ({ name: r.metadata?.toolName, id: r.toolCallId }))
    });

    try {
      // ✅ CRITICAL FIX: Actually execute the tools instead of passing dummy responses
      const config = this.configurationService.getConfig();
      const toolRegistry = this.configurationService.getToolRegistry();
      
      if (!config || !toolRegistry) {
        this.logError("❌ Cannot execute tools - missing config or toolRegistry");
        return await this.continueWithToolResponses(functionResponses, this.createAdapterCallbacks(callbacks), callbacks);
      }

      // Extract tool call requests from the placeholder responses  
      const toolCallRequests: ToolCallRequestInfo[] = functionResponses.map(response => ({
        callId: response.toolCallId,
        name: String(response.metadata?.toolName || 'unknown'),
        args: (response.metadata?.args as Record<string, unknown>) || {},
        isClientInitiated: false,
        prompt_id: `tool-execution-${response.toolCallId}`
      }));

      // Create execution context
      const executionContext = this.createToolExecutionContext(config, toolRegistry, callbacks);
      
      // Actually execute the tools!
      this.logInfo("⚙️ Executing tools with GeminiToolExecutionService");
      const executionResults = await this.toolExecutionService.executeToolsAndContinue(
        toolCallRequests,
        this.createAdapterCallbacks(callbacks),
        executionContext
      );

      // Convert execution results to GeminiToolResponse format
      const realToolResponses: GeminiToolResponse[] = executionResults.map(result => ({
        id: result.toolCallId,
        toolCallId: result.toolCallId,
        result: result.result,
        success: result.success,
        error: result.error,
        timestamp: new Date(),
        metadata: {
          toolName: toolCallRequests.find(req => req.callId === result.toolCallId)?.name || 'unknown',
          args: toolCallRequests.find(req => req.callId === result.toolCallId)?.args || {}
        }
      }));

      this.logInfo("✅ Tool execution completed", {
        resultCount: realToolResponses.length,
        successCount: realToolResponses.filter(r => r.success).length,
        results: realToolResponses.map(r => ({ 
          id: r.toolCallId, 
          success: r.success,
          hasResult: !!r.result,
          error: r.error 
        }))
      });

      // Continue with the real results
      await this.continueWithToolResponses(realToolResponses, this.createAdapterCallbacks(callbacks), callbacks);

    } catch (error) {
      this.logError("❌ Tool execution failed", error);
      // Fallback to original dummy responses
      await this.continueWithToolResponses(functionResponses, this.createAdapterCallbacks(callbacks), callbacks);
    }
  }

  createToolExecutionContext(config: any, toolRegistry: any, callbacks: StreamingCallbacks): GeminiToolExecutionContext {
    return {
      config: config,
      toolRegistry: toolRegistry,
      abortSignal: callbacks.abortController?.signal || new AbortController().signal
    };
  }

  private async continueWithToolResponses(toolResponses: GeminiToolResponse[], adapterCallbacks: GeminiCoreAdapterCallbacks, callbacks: StreamingCallbacks): Promise<void> {
    if (toolResponses.length > 0) {
      const streamingState = this.streamingService.getStreamingState();
      if (streamingState.currentTurn) {
        await this.streamingService.continueWithToolResponses(
          streamingState.currentTurn,
          toolResponses,
          adapterCallbacks,
          callbacks.abortController?.signal || new AbortController().signal
        );
      } else {
        this.logError('No current turn available for continuation');
      }
    }
  }

  getCurrentFlashFallbackCallback(): ((currentModel: string, fallbackModel: string, error?: unknown) => Promise<boolean>) | null {
    return this.currentOnFlashFallbackCallback;
  }
}