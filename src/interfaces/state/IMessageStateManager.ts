/**
 * Message State Manager Interface
 * Manages message-related state operations with gemini-cli-core integration
 */

import { AppState, RenderItem, Message } from '../../components/core/types.js';
import { ServerGeminiStreamEvent } from '@google/gemini-cli-core';

export interface IMessageStateManager {
  /**
   * Add user message to state
   */
  addUserMessage(state: AppState, message: string): AppState;
  
  /**
   * Add assistant message to state
   */
  addAssistantMessage(state: AppState, content: string): AppState;
  
  /**
   * Get last message of specific role
   */
  getLastMessage(state: AppState, role: 'user' | 'assistant'): Message | null;
  
  /**
   * Get message count
   */
  getMessageCount(state: AppState): number;
  
  /**
   * Process streaming event from gemini-cli-core
   */
  processStreamingEvent(state: AppState, event: ServerGeminiStreamEvent): AppState;
  
  /**
   * Update assistant message content (for streaming)
   */
  updateAssistantMessageContent(state: AppState, additionalContent: string): AppState;
  
  /**
   * Finalize streaming by converting streamingChunks to a final message
   */
  finalizeStreamingContent(state: AppState): AppState;
}