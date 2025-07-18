/**
 * Provider types for core-integrated architecture
 * Enhanced for gemini-cli-core integration and Turn system support
 */

import { ProviderType } from '../../abstractions/providers/index.js';
import { ToolConfirmationOutcome } from '@google/gemini-cli-core';

export interface ProviderResponse {
  text: string;
  provider: ProviderType | string;
  timestamp: Date;
  error?: string;
  model?: string;
  metadata?: Record<string, unknown>;
  // Enhanced for core integration
  thinking?: {
    subject: string;
    description: string;
  };
  functionCalls?: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
    completed: boolean;
    response?: unknown;
  }>;
  // Core Turn system support
  turnId?: string;
  toolResults?: Array<{
    toolCallId: string;
    result: unknown;
    success: boolean;
    error?: string;
  }>;
}

export interface SessionMetadata {
  tag: string;
  provider: ProviderType | string;
  createdAt: Date;
  messageCount: number;
  lastActivity: Date;
}

// Enhanced streaming callback types for core integration
export interface StreamingCallbacks {
  onStreamChunk?: (text: string) => void;
  onContentMessage?: (content: string) => void;
  onThinkingChunk?: (text: string) => void;
  onSystemMessage?: (data: { type: string; message: string; timestamp?: Date }) => void;
  onResultMessage?: (data: { content: string; timestamp: Date; metadata?: Record<string, unknown> }) => void;
  onPermissionRequest?: (request: { toolName: string; args: Record<string, unknown>; description?: string; toolUseId?: string }) => Promise<ToolConfirmationOutcome>;
  onPermissionDenied?: (toolName: string, reason?: string) => void;
  onToolExecutionStart?: (data: { toolName: string; args: Record<string, unknown>; executionId: string }) => void;
  onToolExecutionComplete?: (data: { toolName: string; result: unknown; executionId: string; success: boolean }) => void;
  onToolFailure?: (data: { toolName: string; error: string; executionId: string }) => void;
  onToolAutoApproved?: (data: { toolName: string; args: Record<string, unknown> }) => void;
  onComplete?: (response: ProviderResponse) => Promise<void>;
  onError?: (error: string) => void;
  onCancelRequested?: () => void;
  onContinue?: (functionResponses: Array<{ id: string; result: unknown; success: boolean }>) => Promise<void>;
  onFlashFallback?: (currentModel: string, fallbackModel: string, error?: unknown) => Promise<boolean>;
  abortController?: AbortController;
  
  // Enhanced core integration callbacks
  onTurnStart?: (turnId: string) => void;
  onTurnComplete?: (turnId: string, result: ProviderResponse) => void;
  onCoreToolExecution?: (toolExecution: CoreToolExecution) => void;
}

// Core tool execution type for enhanced integration
export interface CoreToolExecution {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
  isExecuting: boolean;
  timestamp: Date;
  toolUseId: string;
  provider: ProviderType | string;
}

// Enhanced provider capabilities for core integration
export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsToolExecution: boolean;
  supportsSessionManagement: boolean;
  maxTokens: number;
  supportedModels: string[];
  permissions: boolean;
  modes?: string[];
  // Enhanced core integration capabilities
  thinking?: boolean;
  multimodal?: boolean;
  coreIntegrated?: boolean;
  turnSystem?: boolean;
  checkpointing?: boolean;
  supportsPermissionModeCycling?: boolean;
  supportsAutoModelSwitching?: boolean;
  requiresManualSave?: boolean;
}

export interface AIProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  
  initialize(): Promise<void>;
  sendMessage(message: string): Promise<ProviderResponse>;
  sendMessageStreaming(message: string, callbacks: StreamingCallbacks): Promise<void>;
  createSession(tag: string): Promise<void>;
  resumeSession(tag: string): Promise<void>;
  cleanup(): Promise<void>;
  
  // Enhanced core integration methods
  streamMessage?: (message: string | Array<{ role: string; content: string }>, callbacks: StreamingCallbacks, isContinuation?: boolean) => Promise<void>;
  updateCurrentModel?: (model: string) => void;
  getModel?: () => string | null;
  dispose?: () => Promise<void>;
  getCapabilities?: () => ProviderCapabilities;
  
  // Core session management
  saveSession?: (tag: string) => Promise<void>;
  getCheckpointPath?: (tag: string) => string;
  getConversationHistory?: () => Array<{ role: string; content: string; timestamp: Date }>;
  getClient?: () => unknown;
  
  // Enhanced permission support for core integration
  setPermissionMode?: (mode: string) => void;
  getPermissionMode?: () => string;
  
  // Core adapter access (for Gemini provider)
  getCoreAdapter?: () => unknown;
}

export interface AppState {
  currentProvider: "gemini" | "claude";
  isLoading: boolean;
  initialized: boolean;
  messages: Array<{
    text: string;
    provider: "gemini" | "claude" | "user";
    timestamp: Date;
  }>;
  currentSession?: string;
}
