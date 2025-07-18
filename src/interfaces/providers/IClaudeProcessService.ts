/**
 * Claude Process Service Interface
 * Defines the contract for Claude process management
 */

import { IProcessService } from '../core/IProviderService.js';
import { IModelService } from '../core/IModelService.js';
import { IProviderResponse } from '../core/IProvider.js';

// Claude-specific type definitions
export interface ClaudeMessageOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  timeout?: number;
}

export interface ClaudeStreamingCallbacks {
  onStreamChunk?: (chunk: string) => void;
  onComplete?: (response: IProviderResponse) => void;
  onError?: (error: string) => void;
  abortController?: AbortController;
}

export interface ClaudeProcessStatus {
  isRunning: boolean;
  pid?: number;
  memory?: number;
  cpu?: number;
  uptime?: number;
  lastActivity?: Date;
  error?: string;
}

export interface ClaudeToolData {
  toolName: string;
  args: Record<string, unknown>;
  toolUseId: string;
  timestamp?: Date;
  context?: Record<string, unknown>;
}

export interface ClaudeToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  toolUseId: string;
  duration?: number;
}

export interface IClaudeProcessService extends IProcessService {
  /**
   * Send message to Claude
   */
  sendMessage(message: string, options?: ClaudeMessageOptions): Promise<IProviderResponse>;

  /**
   * Stream message to Claude
   */
  streamMessage(message: string, callbacks?: ClaudeStreamingCallbacks): Promise<void>;

  /**
   * Get process status
   */
  getProcessStatus(): ClaudeProcessStatus;

  /**
   * Set model service
   */
  setModelService(modelService: IModelService): void;

  /**
   * Handle tool execution
   */
  handleToolExecution(toolData: ClaudeToolData): Promise<ClaudeToolExecutionResult>;
}