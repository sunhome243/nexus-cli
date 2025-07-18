/**
 * Core Provider Interface
 * Defines the contract for all AI providers (Claude, Gemini)
 */

import { ProviderType } from '../../abstractions/providers/index.js';

export interface IProviderResponse {
  text: string;
  provider: ProviderType | string;
  timestamp: Date;
  model?: string;
  error?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

export interface ISystemMessageData {
  type: 'system' | 'info' | 'warning' | 'error';
  message: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

export interface IPermissionRequest {
  toolName: string;
  arguments: Record<string, unknown>;
  description?: string;
  toolUseId?: string; // Original tool use ID from provider
}

export interface IPermissionResponse {
  approved: boolean;
  reason?: string;
  modifiedArguments?: Record<string, unknown>;
}

export interface IToolExecutionData {
  toolName: string;
  arguments: Record<string, unknown>;
  executionId: string;
  timestamp: Date;
  status?: 'started' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
}

export interface IProviderMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  toolCalls?: IToolExecutionData[];
}

export interface IProviderStreamingCallbacks {
  onStreamChunk?: (text: string) => void;
  onContentMessage?: (text: string) => void;  // Used by Gemini provider
  onThinkingChunk?: (text: string) => void;
  onSystemMessage?: (data: ISystemMessageData) => void;
  onResultMessage?: (data: IProviderMessage) => void;
  onPermissionRequest?: (request: IPermissionRequest) => Promise<IPermissionResponse>;
  onToolExecutionStart?: (data: IToolExecutionData) => void;
  onToolExecutionComplete?: (data: IToolExecutionData) => void;
  onToolFailure?: (data: IToolExecutionData) => void;
  onMessage?: (message: IProviderMessage) => void;
  onComplete?: (response: IProviderResponse) => Promise<void>;
  onError?: (error: string) => void;
  onCancelRequested?: () => void;
  abortController?: AbortController;
}

export interface IProviderCapabilities {
  supportsStreaming: boolean;
  supportsToolExecution: boolean;
  supportsSessionManagement: boolean;
  maxTokens: number;
  supportedModels: string[];
  permissions: boolean;
  modes?: string[];
  thinking?: boolean;
  multimodal?: boolean;
  coreIntegrated?: boolean;
  turnSystem?: boolean;
  checkpointing?: boolean;
  supportsPermissionModeCycling?: boolean;
  supportsAutoModelSwitching?: boolean;
  requiresManualSave?: boolean;
}

export interface IThinkingProcessingResult {
  shouldDisplay: boolean;
  thinkingItem?: {
    subject: string;
    description: string;
  };
}

export interface IProvider {
  readonly name: string;
  readonly capabilities: IProviderCapabilities;
  
  initialize(): Promise<void>;
  sendMessage(message: string): Promise<IProviderResponse>;
  sendMessageStreaming(message: string, callbacks: IProviderStreamingCallbacks): Promise<void>;
  
  /**
   * Create a fresh session - Always creates new session, no smart detection
   * @param tag - Session identifier tag
   */
  createSession(tag: string): Promise<void>;
  
  /**
   * Resume an existing session using native provider capabilities
   * @param tag - Session identifier tag of existing session
   */
  resumeSession(tag: string): Promise<void>;
  
  // Session management methods
  getCurrentSessionId?(): string | null;
  getModel?(): string | null;
  dispose?(): Promise<void>;
  streamMessage?(message: string, callbacks: IProviderStreamingCallbacks): Promise<void>;
  
  // Provider-specific session methods
  setSessionTag?(tag: string): void;
  getCurrentMemoryFile?(): string | null;
  getCheckpointPath?(tag: string): string;
  
  cleanup(): Promise<void>;
  processThinkingChunk?(text: string): IThinkingProcessingResult;
  
  // Model information method (for providers that support dynamic model info)
  getCurrentModelInfo?(): { model: string; isUsingFallback: boolean; hasQuotaError: boolean } | null;
}