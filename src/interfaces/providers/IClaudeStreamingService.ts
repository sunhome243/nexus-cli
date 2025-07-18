/**
 * Claude Streaming Service Interface
 * Defines the contract for Claude streaming operations
 */

import { IStreamingService } from '../core/IProviderService.js';
import { IProviderStreamingCallbacks } from '../core/IProvider.js';

export interface ClaudeStreamingResponse {
  type: 'stream_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_stop';
  content?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface ClaudeStreamChunk {
  text?: string;
  type: 'text' | 'thinking' | 'tool_use' | 'error';
  timestamp: Date;
  sequenceNumber: number;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
}

export interface ClaudeStreamError {
  message: string;
  code?: string;
  timestamp: Date;
  context?: Record<string, unknown>;
}

export interface ClaudeStreamingStats {
  totalMessages: number;
  totalChunks: number;
  totalThinkingChunks: number;
  totalPermissionRequests: number;
  totalToolExecutions: number;
  totalErrors: number;
  sessionUpdates: number;
  totalCharacters: number;
  averageChunkSize: number;
  streamingStartTime: Date | null;
  streamingEndTime: Date | null;
  lastChunkTime: Date | null;
}

export interface IClaudeStreamingService extends IStreamingService {
  /**
   * Setup streaming handlers
   */
  setupStreamHandlers(callbacks: IProviderStreamingCallbacks): void;

  /**
   * Get streaming statistics
   */
  getStreamingStats(): ClaudeStreamingStats;

  /**
   * Reset streaming statistics
   */
  resetStats(): void;

  /**
   * Handle streaming response
   */
  handleStreamingResponse(response: ClaudeStreamingResponse): void;

  /**
   * Process stream chunk
   */
  processStreamChunk(chunk: ClaudeStreamChunk): void;

  /**
   * Handle stream error
   */
  handleStreamError(error: ClaudeStreamError): void;
}