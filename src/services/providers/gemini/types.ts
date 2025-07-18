/**
 * Gemini Provider Types
 * Shared types and interfaces for Gemini provider services
 */

import { Config, ToolRegistry, ToolCallRequestInfo, ToolConfirmationOutcome } from "@google/gemini-cli-core";

// Tool execution interface
export interface ToolExecution {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
  isError?: boolean;
  isExecuting: boolean;
  timestamp: Date;
  toolUseId: string;
  provider: string;
}

// Message and system data interfaces
export interface GeminiSystemMessageData {
  type: 'system' | 'info' | 'warning' | 'error';
  message: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

export interface GeminiResultMessageData {
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface GeminiToolExecutionStartData {
  toolName: string;
  args: Record<string, unknown>;
  executionId: string;
  timestamp?: Date;
}

export interface GeminiToolExecutionCompleteData {
  toolName: string;
  result: unknown;
  executionId: string;
  success: boolean;
  timestamp?: Date;
}

export interface GeminiToolFailureData {
  toolName: string;
  error: string;
  executionId: string;
  timestamp?: Date;
}

export interface GeminiPermissionRequest {
  toolName: string;
  args: Record<string, unknown>;
  description?: string;
  tier?: string;
  timestamp?: Date;
}

// Core adapter callback interface
export interface GeminiCoreAdapterCallbacks {
  onStreamChunk?: (text: string) => void;
  onThinkingChunk?: (text: string) => void;
  onSystemMessage?: (data: GeminiSystemMessageData) => void;
  onResultMessage?: (data: GeminiResultMessageData) => void;
  onToolExecutionStart?: (data: GeminiToolExecutionStartData) => void;
  onToolExecutionComplete?: (data: GeminiToolExecutionCompleteData) => void;
  onToolFailure?: (data: GeminiToolFailureData) => void;
  onPermissionRequest?: (request: GeminiPermissionRequest) => Promise<ToolConfirmationOutcome>;
  onPermissionDenied?: (toolName: string, reason: string) => void;
  onError?: (error: string) => void;
  onComplete?: (result: GeminiStreamingResult) => void;
  onContentMessage?: (text: string) => void;
  onCancelRequested?: () => void;
  onContinue?: (functionResponses: GeminiToolResponse[]) => Promise<void>;
  onFlashFallback?: (currentModel: string, fallbackModel: string, error?: unknown) => Promise<boolean>;
  abortController?: AbortController;
}

// Gemini streaming result interface
export interface GeminiStreamingResult {
  success: boolean;
  turnId?: string;
  response?: {
    text: string;
    timestamp: Date;
    metadata?: Record<string, unknown>;
  };
  error?: string;
  toolResults?: Array<{
    toolCallId: string;
    result: unknown;
    success: boolean;
    error?: string;
  }>;
}

// Gemini tool response interface  
export interface GeminiToolResponse {
  id: string;
  toolCallId: string;
  result: unknown;
  success: boolean;
  error?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Gemini tool execution context interface
export interface GeminiToolExecutionContext {
  config: Config;
  toolRegistry: ToolRegistry;
  abortSignal: AbortSignal;
  sessionId?: string;
  turnId?: string;
}