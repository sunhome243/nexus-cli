/**
 * Claude Streaming Service - Real-time streaming management for Claude provider
 * 
 * @class ClaudeStreamingService
 * @extends {BaseProvider}
 * @description Handles streaming logic including stream parser event handling and streaming callbacks.
 * Extracted from ClaudeProvider to reduce complexity and improve streaming performance.
 */

import { injectable, inject } from "inversify";
import { TYPES } from "../../../../infrastructure/di/types.js";
import { ILoggerService } from "../../../../interfaces/core/ILoggerService.js";
import { IAppEventBusService } from "../../../../interfaces/events/IAppEventBusService.js";
import { BaseProvider } from "../../shared/BaseProvider.js";
import { ClaudeStreamParser } from "./ClaudeStreamParser.js";
import { ClaudePermissionRequest } from "../types.js";
import { StreamingCallbacks } from "../../types.js";
import { ToolConfirmationOutcome } from "@google/gemini-cli-core";
import { ClaudeStreamingStats } from "../../../../interfaces/providers/IClaudeStreamingService.js";

/**
 * Claude tool failure event data interface
 */
export interface ClaudeToolFailureData {
  toolUseId: string;
  error: string;
  toolName?: string;
  timestamp?: Date;
}

/**
 * Claude tool auto-approval event data interface
 */
export interface ClaudeToolAutoApprovedData {
  toolUseId: string;
  toolName?: string; // Optional since it might not always be available
  approved: boolean;
  timestamp?: Date;
}

/**
 * Claude tool execution start event data interface
 */
export interface ClaudeToolExecutionStartData {
  toolUseId: string;
  toolName: string;
  args?: Record<string, unknown>;
  timestamp?: Date;
}

/**
 * Claude tool execution complete event data interface
 */
export interface ClaudeToolExecutionCompleteData {
  toolUseId: string;
  toolName?: string;
  result?: unknown;
  error?: string;
  success?: boolean;
  timestamp?: Date;
}

/**
 * Claude streaming state interface
 */
export interface ClaudeStreamingState {
  isStreaming: boolean;
  currentSessionId: string | null;
  currentModel: string | null;
  claudeActualSessionId: string | null;
  lastActivity: Date | null;
}

@injectable()
export class ClaudeStreamingService extends BaseProvider {
  private streamParser: ClaudeStreamParser;
  private streamingState: ClaudeStreamingState = {
    isStreaming: false,
    currentSessionId: null,
    currentModel: null,
    claudeActualSessionId: null,
    lastActivity: null
  };
  
  private stats: ClaudeStreamingStats = {
    totalMessages: 0,
    totalChunks: 0,
    totalThinkingChunks: 0,
    totalPermissionRequests: 0,
    totalToolExecutions: 0,
    totalErrors: 0,
    sessionUpdates: 0,
    totalCharacters: 0,
    averageChunkSize: 0,
    streamingStartTime: null,
    streamingEndTime: null,
    lastChunkTime: null
  };

  // Track processed permission requests to prevent duplicates
  private processedPermissionRequests = new Set<string>();

  constructor(
    @inject(TYPES.LoggerService) logger?: ILoggerService,
    @inject(TYPES.AppEventBusService) eventBus?: IAppEventBusService
  ) {
    super();
    if (logger) {
      this.setLogger(logger);
    }
    this.streamParser = new ClaudeStreamParser(logger, eventBus);
  }

  async initialize(): Promise<void> {
    this.setInitialized(true);
    this.logInfo('Claude Streaming Service initialized');
  }

  async cleanup(): Promise<void> {
    this.clearStreamParser();
    this.resetStreamingState();
    this.setInitialized(false);
    this.logInfo('Claude Streaming Service cleaned up');
  }

  /**
   * Setup stream parser event handlers
   */
  setupStreamParserEvents(
    callbacks: StreamingCallbacks,
    onSessionUpdate?: (sessionId: string, source: 'system' | 'result') => void,
    onModelUpdate?: (model: string) => void,
    onPermissionRequest?: (request: ClaudePermissionRequest) => Promise<ToolConfirmationOutcome>,
    isReadOnly: boolean = false
  ): void {
    this.ensureInitialized();

    // Remove previous listeners to avoid duplicates
    this.streamParser.removeAllListeners();

    this.streamParser.on("system", async (data) => {
      this.logDebug("System message received", { subtype: data.subtype, sessionId: data.sessionId });

      // Capture Claude's actual session ID from system init message
      if (data.subtype === "init" && data.sessionId) {
        const previousSessionId = this.streamingState.claudeActualSessionId;
        this.streamingState.claudeActualSessionId = data.sessionId;
        
        if (previousSessionId !== data.sessionId && data.sessionId) {
          this.logDebug(`Claude actual session changed: ${previousSessionId} → ${data.sessionId}`);
        }
      }

      // Update session ID from system message (skip if read-only)
      if (!isReadOnly && data.sessionId && data.sessionId !== this.streamingState.currentSessionId) {
        this.streamingState.currentSessionId = data.sessionId;
        this.stats.sessionUpdates++;
        
        if (onSessionUpdate) {
          onSessionUpdate(data.sessionId, 'system');
        }
      } else if (isReadOnly && data.sessionId) {
        this.logDebug(`[READ-ONLY] Skipping session update: ${data.sessionId}`);
      }

      // Update model information
      if (data.model) {
        this.streamingState.currentModel = data.model;
        if (onModelUpdate) {
          onModelUpdate(data.model);
        }
      }

      this.updateActivity();
    });

    this.streamParser.on("text_chunk", (text) => {
      this.stats.totalChunks++;
      this.updateActivity();
      callbacks.onStreamChunk?.(text);
    });

    this.streamParser.on("thinking_chunk", (text) => {
      this.stats.totalThinkingChunks++;
      this.updateActivity();
      
      // Claude doesn't emit thinking content, so this should rarely trigger
      // Only pass to thinking handler if available, don't fallback to regular messages
      if (callbacks.onThinkingChunk) {
        callbacks.onThinkingChunk(text);
      }
      // Removed: fallback that added 💭 prefix to regular messages
    });

    this.streamParser.on("permission_request", async (request: ClaudePermissionRequest) => {
      this.updateActivity();
      
      // Handle cases where tool name might be undefined (especially for MCP tools)
      const toolName = request.tool || 'unknown-tool';
      const requestId = request.toolUseId || `${toolName}-${Date.now()}`;
      
      // Log the raw request to debug undefined tool names - with full object details
      this.logInfo("🔍 Raw permission request received:");
      this.logInfo(`  Tool: ${request.tool || 'undefined'}`);
      this.logInfo(`  ToolUseId: ${request.toolUseId || 'undefined'}`);
      this.logInfo(`  Tier: ${request.tier || 'undefined'}`);
      this.logInfo(`  Description: ${request.description || 'undefined'}`);
      this.logInfo(`  Arguments: ${JSON.stringify(request.arguments, null, 2) || 'undefined'}`);
      
      // Check if we've already processed this permission request
      if (this.processedPermissionRequests.has(requestId)) {
        this.logDebug(`Duplicate permission request ignored: ${toolName} (${requestId})`);
        return;
      }
      
      // Mark as processed
      this.processedPermissionRequests.add(requestId);
      this.stats.totalPermissionRequests++;
      
      this.logInfo(`Permission request detected: ${toolName} (${requestId})`);
      
      if (onPermissionRequest) {
        this.logInfo(`🔍 ClaudeStreamingService forwarding permission request to UI`, {
          tool: request.tool,
          toolUseId: requestId
        });
        try {
          // Debug: Log original request data structure with full details
          this.logInfo("🔍 Original ClaudePermissionRequest:");
          this.logInfo(`  Tool: ${request.tool || 'undefined'}`);
          this.logInfo(`  Arguments: ${JSON.stringify(request.arguments, null, 2) || 'undefined'}`);
          this.logInfo(`  Tier: ${request.tier || 'undefined'}`);
          this.logInfo(`  Description: ${request.description || 'undefined'}`);
          this.logInfo(`  ToolUseId: ${request.toolUseId || 'undefined'}`);
          
          // Transform ClaudePermissionRequest to proper format for ClaudePermissionService
          // Use the toolName variable which has fallback logic for undefined tool names
          const uiRequest = {
            tool: toolName, // ✅ Fixed: Use 'tool' property to match ClaudePermissionRequest interface
            arguments: request.arguments || {},
            description: request.description || `Execute ${toolName} tool`,
            tier: request.tier || 'cautious', // ✅ Fixed: Use 'tier' property to match ClaudePermissionRequest interface
            toolUseId: requestId
          } as any; // Use any to bypass strict type checking as we're transforming between different interfaces
          
          this.logInfo("🔍 Transformed permission request for UI:");
          this.logInfo(`  Tool: ${uiRequest.tool}`);
          this.logInfo(`  Arguments: ${JSON.stringify(uiRequest.arguments, null, 2)}`);
          this.logInfo(`  Description: ${uiRequest.description}`);
          this.logInfo(`  Tier: ${uiRequest.tier}`);
          this.logInfo(`  ToolUseId: ${uiRequest.toolUseId}`);
          await onPermissionRequest(uiRequest);
          this.logInfo(`🔍 ClaudeStreamingService permission request handled`);
        } catch (error) {
          this.logError(`Permission request handling failed:`, error);
        }
      } else {
        this.logWarn(`🔍 ClaudeStreamingService: No onPermissionRequest callback available!`);
      }
    });

    this.streamParser.on("tool_failure", (data: ClaudeToolFailureData) => {
      this.stats.totalErrors++;
      this.updateActivity();
      
      this.logWarn(`Tool failure detected: ${data.toolUseId} - ${data.error}`);

      if (callbacks.onToolFailure) {
        callbacks.onToolFailure({
          toolName: data.toolName || 'unknown',
          error: data.error,
          executionId: data.toolUseId
        });
      }
    });

    this.streamParser.on("tool_auto_approved", (data: ClaudeToolAutoApprovedData) => {
      this.updateActivity();
      
      this.logInfo(`Tool auto-approved by Claude CLI: ${data.toolUseId}`);

      // Call auto-approved callback for any specific handling
      if (callbacks.onToolAutoApproved) {
        callbacks.onToolAutoApproved({
          toolName: data.toolName || 'unknown',
          args: {}
        });
      }
      
      // IMPORTANT: Also call tool execution complete to stop UI spinners
      if (callbacks.onToolExecutionComplete) {
        callbacks.onToolExecutionComplete({
          toolName: data.toolName || 'unknown',
          result: (data as any).content || 'Tool completed successfully',
          executionId: data.toolUseId,
          success: true
        });
      }
    });

    this.streamParser.on("tool_execution_start", (data: ClaudeToolExecutionStartData) => {
      this.stats.totalToolExecutions++;
      this.updateActivity();
      
      this.logDebug(`Tool execution started: ${data.toolName}`);
      if (callbacks.onToolExecutionStart) {
        callbacks.onToolExecutionStart({
          toolName: data.toolName,
          args: data.args || {},
          executionId: data.toolUseId
        });
      }
    });

    this.streamParser.on("tool_execution_complete", (data: ClaudeToolExecutionCompleteData) => {
      this.updateActivity();
      
      this.logDebug(`Tool execution completed: ${data.toolUseId}`);
      if (callbacks.onToolExecutionComplete) {
        callbacks.onToolExecutionComplete({
          toolName: data.toolName || 'unknown',
          result: data.result,
          executionId: data.toolUseId,
          success: data.success || false
        });
      }
    });

    this.streamParser.on("assistant_message", () => {
      this.updateActivity();
      this.logDebug("Assistant message received");
    });

    this.streamParser.on("result", (data) => {
      this.stats.totalMessages++;
      this.updateActivity();
      
      this.logDebug("Result message received", { sessionId: data.sessionId });

      // Capture session ID from result message
      if (data.sessionId && data.sessionId !== this.streamingState.currentSessionId) {
        this.streamingState.currentSessionId = data.sessionId;
        this.stats.sessionUpdates++;
        
        if (onSessionUpdate) {
          onSessionUpdate(data.sessionId, 'result');
        }
      }

      // Show result info in UI before completing
      if (callbacks.onResultMessage) {
        callbacks.onResultMessage(data);
      }

      callbacks.onComplete?.(data);
    });

    this.streamParser.on("error", (error) => {
      this.stats.totalErrors++;
      this.updateActivity();
      
      this.logError("Stream parser error:", error);
      callbacks.onError?.(error);
    });
  }

  /**
   * Process streaming chunk
   */
  processStreamChunk(chunk: string): void {
    this.ensureInitialized();
    this.updateActivity();
    this.streamParser.processChunk(chunk);
  }

  /**
   * Clear stream parser buffer and listeners
   */
  clearStreamParser(): void {
    this.streamParser.clearBuffer();
    this.streamParser.removeAllListeners();
    this.processedPermissionRequests.clear();
    this.logDebug('Stream parser cleared');
  }

  /**
   * Set streaming state
   */
  setStreamingState(isStreaming: boolean): void {
    this.streamingState.isStreaming = isStreaming;
    if (isStreaming) {
      this.updateActivity();
    }
  }

  /**
   * Get current streaming state
   */
  getStreamingState(): Readonly<ClaudeStreamingState> {
    return { ...this.streamingState };
  }

  /**
   * Get streaming statistics
   */
  getStreamingStats(): Readonly<ClaudeStreamingStats> {
    return { ...this.stats };
  }

  /**
   * Reset streaming statistics
   */
  resetStats(): void {
    this.stats = {
      totalMessages: 0,
      totalChunks: 0,
      totalThinkingChunks: 0,
      totalPermissionRequests: 0,
      totalToolExecutions: 0,
      totalErrors: 0,
      sessionUpdates: 0,
      totalCharacters: 0,
      averageChunkSize: 0,
      streamingStartTime: null,
      streamingEndTime: null,
      lastChunkTime: null
    };
    this.logDebug('Streaming statistics reset');
  }

  /**
   * Check if currently streaming
   */
  isStreaming(): boolean {
    return this.streamingState.isStreaming;
  }

  /**
   * Get current session ID from streaming state
   */
  getCurrentSessionId(): string | null {
    return this.streamingState.currentSessionId;
  }

  /**
   * Get Claude's actual session ID
   */
  getClaudeActualSessionId(): string | null {
    return this.streamingState.claudeActualSessionId;
  }

  /**
   * Get current model from streaming state
   */
  getCurrentModel(): string | null {
    return this.streamingState.currentModel;
  }

  /**
   * Get last activity timestamp
   */
  getLastActivity(): Date | null {
    return this.streamingState.lastActivity;
  }

  /**
   * Update streaming state with session info
   */
  updateStreamingSession(sessionId: string | null, model?: string | null): void {
    const previousSessionId = this.streamingState.currentSessionId;
    
    if (sessionId && sessionId !== previousSessionId) {
      this.streamingState.currentSessionId = sessionId;
      
      // Clear permission tracking when session changes
      this.processedPermissionRequests.clear();
      this.logDebug('Cleared permission tracking due to session change');
    }
    if (model) {
      this.streamingState.currentModel = model;
    }
    this.updateActivity();
  }

  /**
   * Reset streaming state
   */
  private resetStreamingState(): void {
    this.streamingState = {
      isStreaming: false,
      currentSessionId: null,
      currentModel: null,
      claudeActualSessionId: null,
      lastActivity: null
    };
    // Clear permission tracking on state reset
    this.processedPermissionRequests.clear();
  }

  /**
   * Update last activity timestamp
   */
  private updateActivity(): void {
    this.streamingState.lastActivity = new Date();
  }

  /**
   * Get stream parser for advanced operations
   */
  getStreamParser(): ClaudeStreamParser {
    return this.streamParser;
  }

  /**
   * Get formatted streaming duration
   */
  getFormattedStreamingDuration(): string {
    if (!this.streamingState.lastActivity) {
      return '0s';
    }

    const duration = Date.now() - this.streamingState.lastActivity.getTime();
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get streaming performance metrics
   */
  getPerformanceMetrics(): {
    chunksPerSecond: number;
    averageChunkSize: number;
    totalDuration: number;
    messagesPerMinute: number;
  } {
    const duration = this.streamingState.lastActivity 
      ? Date.now() - this.streamingState.lastActivity.getTime()
      : 0;
    
    const durationSeconds = duration / 1000;
    const durationMinutes = durationSeconds / 60;

    return {
      chunksPerSecond: durationSeconds > 0 ? this.stats.totalChunks / durationSeconds : 0,
      averageChunkSize: 0, // Would need to track chunk sizes
      totalDuration: duration,
      messagesPerMinute: durationMinutes > 0 ? this.stats.totalMessages / durationMinutes : 0
    };
  }

  /**
   * Clear permission request tracking
   * Call this when starting a new conversation or clearing state
   */
  clearPermissionTracking(): void {
    this.processedPermissionRequests.clear();
    this.logDebug('Permission request tracking cleared');
  }

  /**
   * Get number of tracked permission requests
   */
  getTrackedPermissionCount(): number {
    return this.processedPermissionRequests.size;
  }
}