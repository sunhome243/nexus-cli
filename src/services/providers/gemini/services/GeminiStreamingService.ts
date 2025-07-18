/**
 * Gemini Streaming Service - Real-time streaming and event processing
 * 
 * @class GeminiStreamingService
 * @extends {BaseProvider}
 * @description Handles Turn API streaming logic and event processing for Gemini AI.
 * Extracted from GeminiCoreAdapter for better modularity and streaming performance.
 */

import { injectable, inject } from "inversify";
import { TYPES } from "../../../../infrastructure/di/types.js";
import { ILoggerService } from "../../../../interfaces/core/ILoggerService.js";
import { BaseProvider } from "../../shared/BaseProvider.js";
import { Turn, ToolCallRequestInfo, executeToolCall, ServerGeminiStreamEvent, GeminiEventType } from "@google/gemini-cli-core";
import { PartListUnion } from "@google/genai";
import { GeminiCoreAdapterCallbacks, ToolExecution, GeminiToolExecutionStartData, GeminiToolExecutionCompleteData } from "../types.js";
import { ErrorHandlerService } from "../../shared/index.js";
import { ErrorContext } from "../../../../interfaces/core/IProviderService.js";
import { GeminiQuotaService, GeminiSessionService, GeminiModelService } from "./index.js";
import { formatToolResponse } from "../utils/toolResponseFormatters.js";
import { IStreamingState, IToolCallRequestEvent, IToolCallResponseEvent } from "../types/TurnTypes.js";
import { GeminiToolResponse } from "../types.js";
import { StreamingState } from "../../../../interfaces/providers/IGeminiStreamingService.js";

/**
 * Base Gemini turn event interface
 */
export interface GeminiTurnEvent {
  type: 'content' | 'thought' | 'tool_call_request' | 'tool_call_response' | 'error' | 'user_cancelled';
  value?: unknown;
}

/**
 * Gemini content event interface
 */
export interface GeminiContentEvent extends GeminiTurnEvent {
  type: 'content';
  value: string;
}

/**
 * Gemini thought event interface
 */
export interface GeminiThoughtEvent extends GeminiTurnEvent {
  type: 'thought';
  value: string | { content: string };
}

/**
 * Gemini tool call request event interface
 */
export interface GeminiToolCallRequestEvent extends GeminiTurnEvent {
  type: 'tool_call_request';
  value: ToolCallRequestInfo;
}

/**
 * Gemini tool call response event interface
 */
export interface GeminiToolCallResponseEvent extends GeminiTurnEvent {
  type: 'tool_call_response';
  value: {
    callId: string;
    responseParts: unknown;
    error?: { message: string };
  };
}

export interface GeminiErrorEvent extends GeminiTurnEvent {
  type: 'error';
  value: {
    error?: { message: string } | string;
    message?: string;
  } | string;
}

export interface GeminiUserInput {
  text?: string;
  parts?: unknown[];
  role?: string;
}

export interface GeminiThinkingData {
  content: string;
  [key: string]: unknown;
}

@injectable()
export class GeminiStreamingService extends BaseProvider {
  private streamingState: StreamingState = {
    isStreaming: false,
    currentTurn: null,
    pendingToolCalls: [],
    modelSwitchedFromQuotaError: false,
    accumulatedContent: []
  };

  constructor(
    @inject(TYPES.LoggerService) logger: ILoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandlerService: ErrorHandlerService,
    @inject(TYPES.GeminiQuotaService) private quotaService: GeminiQuotaService,
    @inject(TYPES.GeminiSessionService) private sessionService: GeminiSessionService,
    @inject(TYPES.GeminiModelService) private modelService: GeminiModelService
  ) {
    super();
    this.setLogger(logger);
  }

  async initialize(): Promise<void> {
    this.setInitialized(true);
    this.logInfo("Gemini Streaming Service initialized");
  }

  async cleanup(): Promise<void> {
    this.resetStreamingState();
    this.setInitialized(false);
    this.logInfo("Gemini Streaming Service cleaned up");
  }

  /**
   * Process streaming turn with tool execution
   */
  async processStreamingTurn(
    turn: Turn,
    userInput: GeminiUserInput[],
    callbacks: GeminiCoreAdapterCallbacks,
    abortSignal: AbortSignal
  ): Promise<void> {
    this.ensureInitialized();
    
    // Update streaming state
    this.streamingState.isStreaming = true;
    this.streamingState.currentTurn = turn;
    this.streamingState.pendingToolCalls = [];
    this.streamingState.accumulatedContent = [];

    try {
      this.logInfo("Starting Turn.run() with native tool execution", {
        messageLength: userInput[0]?.text?.length || 0,
        configModel: this.modelService.getCurrentModel(),
        modelInfo: this.modelService.getCurrentModelInfo(),
        hasThinkingCallback: !!callbacks.onThinkingChunk
      });

      // Process turn events
      for await (const event of turn.run(userInput as PartListUnion, abortSignal)) {
        await this.handleTurnEvent(event, callbacks);
      }

      // Handle pending tool calls if any
      if (this.streamingState.pendingToolCalls.length > 0) {
        // Don't continue if model was switched due to quota error
        if (this.streamingState.modelSwitchedFromQuotaError) {
          await this.handleQuotaErrorToolCancellation(callbacks);
          return;
        }
        
        // ✅ CRITICAL FIX: Actually execute tools instead of creating dummy responses
        if (callbacks.onContinue) {
          this.logInfo("🔧 Delegating tool execution to onContinue callback", {
            toolCount: this.streamingState.pendingToolCalls.length,
            tools: this.streamingState.pendingToolCalls.map(t => ({ name: t.name, callId: t.callId }))
          });
          
          // Convert ToolCallRequestInfo[] to GeminiToolResponse[] with placeholders for execution
          const toolRequests: GeminiToolResponse[] = this.streamingState.pendingToolCalls.map((call, index) => {
            const toolCall = call as ToolCallRequestInfo & { id?: string; callId?: string };
            return {
              id: toolCall.id || `tool_${Date.now()}_${index}`,
              toolCallId: toolCall.callId || toolCall.id || `tool_${Date.now()}_${index}`,
              result: undefined, // Will be populated by actual tool execution
              success: false,    // Will be updated by actual tool execution
              timestamp: new Date(),
              metadata: { toolName: call.name, args: call.args }
            };
          });
          
          await callbacks.onContinue(toolRequests);
          // Don't call onComplete here - let the continuation handle completion
          return;
        }
      }

      // Only sync and complete if there are no pending tool calls
      this.syncModelState(callbacks);
      
      // Note: Assistant response and tool results are automatically tracked by core chat.recordHistory()
      // No need to manually track here - core handles this including tool execution results
      
      if (callbacks.onComplete) {
        // Pass the accumulated content as the response text
        const fullText = this.streamingState.accumulatedContent.join('');
        callbacks.onComplete({ 
          success: true, 
          response: { 
            text: fullText,
            timestamp: new Date()
          } 
        });
      }

      this.logInfo("Turn.run() streaming completed successfully");

    } finally {
      this.streamingState.isStreaming = false;
      // Reset the quota error flag after stream completion
      this.streamingState.modelSwitchedFromQuotaError = false;
      this.logInfo("Reset modelSwitchedFromQuotaError flag after stream completion");
      // Don't null currentTurn here - it may be needed for continuation
    }
  }

  /**
   * Handle individual Turn events
   */
  async handleTurnEvent(
    event: unknown, 
    callbacks: GeminiCoreAdapterCallbacks
  ): Promise<void> {
    // Type guard for turn event
    if (!event || typeof event !== 'object' || !('type' in event)) {
      this.logWarn('Invalid turn event received', { event });
      return;
    }
    
    const turnEvent = event as GeminiTurnEvent;
    
    this.logDebug('Processing Turn event', {
      eventType: turnEvent.type,
      hasValue: 'value' in turnEvent,
      event: turnEvent,
      isThoughtEvent: turnEvent.type === 'thought'
    });

    switch (turnEvent.type) {
      case 'content':
        await this.handleContentEvent(event as ServerGeminiStreamEvent, callbacks);
        break;

      case 'thought':
        await this.handleThoughtEvent(event as ServerGeminiStreamEvent, callbacks);
        break;

      case 'tool_call_request':
        await this.handleToolCallRequest(event as ServerGeminiStreamEvent, callbacks);
        break;

      case 'tool_call_response':
        await this.handleToolCallResponse(event as ServerGeminiStreamEvent, callbacks)
        break;

      case 'user_cancelled':
        this.logInfo('User cancelled operation');
        if (callbacks.onCancelRequested) {
          callbacks.onCancelRequested();
        }
        break;

      case 'error':
        await this.handleErrorEvent(event as ServerGeminiStreamEvent, callbacks);
        break;

      default:
        this.logWarn('🔴 Unhandled Turn event type', {
          eventType: turnEvent.type,
          fullEvent: turnEvent,
          allEventKeys: Object.keys(turnEvent)
        });
        break;
    }
  }

  /**
   * Get current streaming state
   */
  getStreamingState(): Readonly<StreamingState> {
    return { ...this.streamingState };
  }

  /**
   * Set model switched flag (called by quota handling)
   */
  setModelSwitchedFromQuotaError(value: boolean): void {
    this.streamingState.modelSwitchedFromQuotaError = value;
    if (value) {
      this.logInfo('Model switched due to quota error - tool execution will be skipped');
    }
  }

  /**
   * Check if currently streaming
   */
  isStreaming(): boolean {
    return this.streamingState.isStreaming;
  }

  /**
   * Continue the current turn with tool responses
   */
  async continueWithToolResponses(
    turn: Turn,
    toolResponses: GeminiToolResponse[],
    callbacks: GeminiCoreAdapterCallbacks,
    abortSignal: AbortSignal
  ): Promise<void> {
    this.ensureInitialized();
    
    // Update streaming state
    this.streamingState.isStreaming = true;
    // Clear pending tools before processing new turn events
    this.streamingState.pendingToolCalls = [];

    try {
      this.logInfo("Continuing Turn with tool responses", {
        responseCount: toolResponses.length
      });

      // Enhanced logging for debugging tool response processing
      this.logInfo("Processing tool responses:", {
        toolCount: toolResponses.length,
        results: toolResponses.map(r => ({ 
          id: r.id, 
          hasResult: !!r.result, 
          success: r.success,
          resultType: typeof r.result,
          resultContent: r.result ? JSON.stringify(r.result).substring(0, 200) : 'null'
        })),
      });

      // Extract and convert tool responses to proper Gemini function response format
      // Based on gemini-cli convertToFunctionResponse pattern
      const formattedResponses: any[] = [];
      
      for (const response of toolResponses) {
        this.logInfo("Processing tool response:", {
          id: response.id,
          hasResult: !!response.result,
          success: response.success,
          resultType: typeof response.result,
          resultContent: response.result ? JSON.stringify(response.result).substring(0, 200) : 'null',
          error: response.error
        });

        const toolName = String(response.metadata?.toolName || 'unknown');
        
        // Use the utility function to format the response
        const formattedResponse = formatToolResponse(
          response.toolCallId,
          toolName,
          response.success,
          response.result,
          response.error
        );
        
        formattedResponses.push(formattedResponse);
      }
      
      this.logInfo("Formatted responses for Gemini API:", {
        formattedCount: formattedResponses.length,
        responses: formattedResponses.map(r => ({
          id: r.functionResponse?.id,
          name: r.functionResponse?.name,
          hasOutput: !!r.functionResponse?.response?.output,
          hasError: !!r.functionResponse?.response?.error
        }))
      });

      // ✅ Enhanced error handling: Check if we have valid responses
      if (formattedResponses.length === 0) {
        this.logError("❌ No valid tool responses to send to Gemini API");
        
        // Create a default error response
        const errorResponse = [{
          functionResponse: {
            id: 'error',
            name: 'tool_execution',
            response: { error: 'No valid tool responses were generated' }
          }
        }] as PartListUnion;
        
        // Continue the turn with error response
        for await (const event of turn.run(errorResponse, abortSignal)) {
          await this.handleTurnEvent(event, callbacks);
        }
      } else {
        // Continue the turn with properly formatted function responses
        for await (const event of turn.run(formattedResponses as PartListUnion, abortSignal)) {
          await this.handleTurnEvent(event, callbacks);
        }
      }

      // Check if there are new pending tool calls after continuation
      if (this.streamingState.pendingToolCalls.length > 0) {
        this.logInfo("New tool calls requested during continuation", {
          toolCount: this.streamingState.pendingToolCalls.length,
          tools: this.streamingState.pendingToolCalls.map(t => ({ name: t.name, callId: t.callId }))
        });
        
        // Don't continue if model was switched due to quota error
        if (this.streamingState.modelSwitchedFromQuotaError) {
          await this.handleQuotaErrorToolCancellation(callbacks);
          return;
        }
        
        // Recursively handle new tool calls
        if (callbacks.onContinue) {
          // Convert ToolCallRequestInfo[] to GeminiToolResponse[] for onContinue
          const toolResponses: GeminiToolResponse[] = this.streamingState.pendingToolCalls.map((call, index) => {
            const toolCall = call as ToolCallRequestInfo & { id?: string; callId?: string };
            return {
              id: toolCall.id || `tool_${Date.now()}_${index}`,
              toolCallId: toolCall.callId || toolCall.id || `tool_${Date.now()}_${index}`,
              result: undefined,
              success: false,
              timestamp: new Date(),
              metadata: { toolName: call.name, args: call.args }
            };
          });
          await callbacks.onContinue(toolResponses);
          // Don't call onComplete here - let the recursive continuation handle it
          return;
        }
      }

      // Only complete when there are no more pending tool calls
      this.syncModelState(callbacks);
      if (callbacks.onComplete) {
        // Pass the accumulated content as the response text
        const fullText = this.streamingState.accumulatedContent.join('');
        callbacks.onComplete({ 
          success: true, 
          response: { 
            text: fullText,
            timestamp: new Date()
          } 
        });
      }

      this.logInfo("Turn continuation completed with no pending tools");

    } finally {
      this.streamingState.isStreaming = false;
      // Only clear currentTurn when truly done
      if (this.streamingState.pendingToolCalls.length === 0) {
        this.streamingState.currentTurn = null;
      }
    }
  }

  private async handleContentEvent(event: ServerGeminiStreamEvent, callbacks: GeminiCoreAdapterCallbacks): Promise<void> {
    if ('value' in event && event.value && typeof event.value === 'string' && 
        callbacks.onContentMessage) {
      
      // Skip content that looks like thinking content to avoid duplication
      const content = event.value;
      if (this.isThinkingContent(content)) {
        this.logDebug('Skipping content event that appears to be thinking content:', content);
        return;
      }
      
      // Accumulate content for history tracking
      this.streamingState.accumulatedContent.push(event.value);
      
      this.logDebug('Calling onContentMessage with:', event.value);
      callbacks.onContentMessage(event.value);
    }
  }

  private async handleThoughtEvent(event: ServerGeminiStreamEvent, callbacks: GeminiCoreAdapterCallbacks): Promise<void> {
    this.logInfo('🧠 THOUGHT EVENT RECEIVED', {
      hasValue: 'value' in event,
      value: 'value' in event ? (event as any).value : undefined,
      hasCallback: !!callbacks.onThinkingChunk,
      modelSwitchedFromQuotaError: this.streamingState.modelSwitchedFromQuotaError,
      currentModel: this.modelService.getCurrentModel()
    });
    
    if ('value' in event && event.value && callbacks.onThinkingChunk && 
        !this.streamingState.modelSwitchedFromQuotaError) {
      const parsedThinking = this.parseThinking(event.value);
      this.logInfo('🧠 Calling onThinkingChunk callback', {
        parsedThinking,
        originalValue: event.value
      });
      callbacks.onThinkingChunk(JSON.stringify(parsedThinking));
    }
  }

  private async handleToolCallRequest(event: ServerGeminiStreamEvent, callbacks: GeminiCoreAdapterCallbacks): Promise<void> {
    if ('value' in event && event.value) {
      const toolRequest = event.value as ToolCallRequestInfo;
      this.streamingState.pendingToolCalls.push(toolRequest);
      
      this.logInfo('Tool execution queued', {
        toolName: toolRequest.name,
        callId: toolRequest.callId,
        totalPending: this.streamingState.pendingToolCalls.length
      });

      // Only notify UI if not in quota error state
      if (callbacks.onToolExecutionStart && !this.streamingState.modelSwitchedFromQuotaError) {
        callbacks.onToolExecutionStart({
          toolName: toolRequest.name || "",
          args: toolRequest.args || {},
          executionId: toolRequest.callId,
          timestamp: new Date(),
        });
      }
    }
  }

  private async handleToolCallResponse(event: ServerGeminiStreamEvent, callbacks: GeminiCoreAdapterCallbacks): Promise<void> {
    if ('value' in event && event.value && callbacks.onToolExecutionComplete) {
      const toolResponse = event.value as any;
      const toolId = `tool-response-${Date.now()}`;

      this.logInfo('Tool execution completed via event', {
        callId: toolResponse.callId,
        success: !toolResponse.error
      });

      callbacks.onToolExecutionComplete({
        toolName: "unknown", // Tool name not available in response
        result: toolResponse.responseParts,
        executionId: toolResponse.callId,
        success: !toolResponse.error,
        timestamp: new Date(),
      });
    }
  }

  private async handleErrorEvent(event: ServerGeminiStreamEvent, callbacks: GeminiCoreAdapterCallbacks): Promise<void> {
    if ('value' in event && event.value) {
      let errorMessage = 'Unknown error occurred';
      let errorForFallback = event.value;
      
      const errorValue = event.value;
      if (typeof errorValue === 'string') {
        errorMessage = errorValue;
      } else if (errorValue && typeof errorValue === 'object') {
        const errorObj = errorValue as { error?: { message?: string } | string; message?: string };
        if (errorObj.error) {
          errorMessage = typeof errorObj.error === 'string' ? errorObj.error : (errorObj.error.message || 'Unknown error');
          errorForFallback = errorObj.error as any;
        } else if (errorObj.message) {
          errorMessage = errorObj.message;
        }
      }
      
      this.logError('Error event details', {
        errorMessage,
        isProQuotaError: this.quotaService.isProQuotaExceededError(errorForFallback),
        isGenericQuotaError: this.quotaService.isGenericQuotaExceededError(errorForFallback)
      });

      // Check if this is a quota error
      if (this.quotaService.isQuotaError(errorForFallback)) {
        // Mark that we had a quota error
        this.setModelSwitchedFromQuotaError(true);
        
        // Let parent handle quota error with fallback
        if (callbacks.onError) {
          callbacks.onError(errorMessage);
        }
      } else if (callbacks.onError) {
        // Non-quota error
        callbacks.onError(errorMessage);
      }
    }
  }

  private async handleQuotaErrorToolCancellation(callbacks: GeminiCoreAdapterCallbacks): Promise<void> {
    this.logInfo('Skipping tool continuation due to quota error model switch');
    
    // Clean up pending tool executions
    for (const toolRequest of this.streamingState.pendingToolCalls) {
      if (callbacks.onToolExecutionComplete) {
        const completeData: GeminiToolExecutionCompleteData = {
          toolName: toolRequest.name || "",
          result: "Cancelled - switched to Flash model",
          executionId: toolRequest.callId,
          success: false,
          timestamp: new Date(),
        };
        callbacks.onToolExecutionComplete(completeData);
      }
    }
    
    // Reset the flag for next request
    this.streamingState.modelSwitchedFromQuotaError = false;
    this.logInfo('Reset modelSwitchedFromQuotaError flag after handling tool cancellation');
  }

  private parseThinking(thinking: any): GeminiThinkingData {
    if (typeof thinking === 'string') {
      return { 
        content: thinking,
        subject: 'Thinking',
        description: thinking 
      };
    }
    if (thinking && typeof thinking === 'object') {
      return {
        content: thinking.content || thinking.description || String(thinking),
        subject: thinking.subject || 'Thinking',
        description: thinking.content || thinking.description || String(thinking)
      };
    }
    return { 
      content: String(thinking),
      subject: 'Thinking',
      description: String(thinking)
    };
  }

  /**
   * Check if content appears to be thinking content that may have been misclassified
   */
  private isThinkingContent(content: string): boolean {
    // Check for common thinking content patterns
    if (content.includes('[Thinking]') || 
        content.includes('I\'m currently') ||
        content.includes('I need to') ||
        content.includes('Let me think') ||
        content.includes('My approach') ||
        content.includes('I should') ||
        content.startsWith('●') || // Bullet point thinking
        content.includes('Analyzing') ||
        content.includes('Calculating') ||
        content.includes('Determining')) {
      return true;
    }

    // Check if content looks like JSON thinking structure
    try {
      const parsed = JSON.parse(content);
      if (parsed.content && typeof parsed.content === 'string') {
        return true;
      }
    } catch {
      // Not JSON, continue with other checks
    }

    return false;
  }

  private syncModelState(callbacks: GeminiCoreAdapterCallbacks): void {
    // Update session activity
    this.sessionService.updateActivity();
    
    // Additional sync logic can be added here if needed
  }

  private resetStreamingState(): void {
    this.streamingState = {
      isStreaming: false,
      currentTurn: null,
      pendingToolCalls: [],
      modelSwitchedFromQuotaError: false,
      accumulatedContent: []
    };
  }
}