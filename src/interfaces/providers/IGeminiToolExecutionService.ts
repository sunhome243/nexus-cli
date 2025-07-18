/**
 * Gemini Tool Execution Service Interface
 * Defines the contract for Gemini tool execution operations
 */

import { IProviderService } from '../core/IProviderService.js';
import { IProviderStreamingCallbacks } from '../core/IProvider.js';
import { ToolCallRequestInfo } from '@google/gemini-cli-core';

export interface GeminiToolCall {
  name: string;
  id: string;
  arguments: Record<string, unknown>;
  timestamp: Date;
}

export interface GeminiToolExecutionContext {
  config: any; // Config from gemini-cli-core
  toolRegistry: any; // ToolRegistry from gemini-cli-core
  abortSignal: AbortSignal;
}

export interface GeminiToolExecutionResult {
  toolCallId: string;
  result: unknown;
  success: boolean;
  error?: string;
  executionTime: number;
}

export interface IGeminiToolExecutionService extends IProviderService {
  /**
   * Execute tools and continue
   */
  executeToolsAndContinue(
    pendingToolCalls: ToolCallRequestInfo[],
    callbacks: any, // GeminiCoreAdapterCallbacks from the service
    context: any // ToolExecutionContext from the service
  ): Promise<GeminiToolExecutionResult[]>;
}