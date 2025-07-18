/**
 * Gemini Streaming Service Interface
 * Defines the contract for Gemini streaming operations
 */

import { IProviderService } from '../core/IProviderService.js';
import { Turn, ToolCallRequestInfo } from "@google/gemini-cli-core";

export interface StreamingState {
  isStreaming: boolean;
  currentTurn: Turn | null;
  pendingToolCalls: ToolCallRequestInfo[];
  modelSwitchedFromQuotaError: boolean;
  accumulatedContent: string[];
}

export interface IGeminiStreamingService extends IProviderService {
  /**
   * Get streaming state
   */
  getStreamingState(): Readonly<StreamingState>;

  /**
   * Set model switched from quota error
   */
  setModelSwitchedFromQuotaError(value: boolean): void;

  /**
   * Check if streaming is active
   */
  isStreaming(): boolean;
}