/**
 * Thinking State Manager Interface
 * Manages thinking/reasoning state operations with gemini-cli-core integration
 */

import { AppState, ThinkingItem } from '../../components/core/types.js';
import { 
  ServerGeminiStreamEvent, 
  ThoughtSummary 
} from '@google/gemini-cli-core';

export interface IThinkingStateManager {
  /**
   * Add thinking item to state
   */
  addThinkingItem(state: AppState, thinking: ThinkingItem): AppState;
  
  /**
   * Update current thought summary
   */
  updateCurrentThought(state: AppState, thought: ThoughtSummary): AppState;
  
  /**
   * Clear current thought
   */
  clearCurrentThought(state: AppState): AppState;
  
  /**
   * Get current thought summary
   */
  getCurrentThought(state: AppState): ThoughtSummary | undefined;
  
  /**
   * Get thinking history
   */
  getThinkingHistory(state: AppState): ThinkingItem[];
  
  /**
   * Process streaming event from gemini-cli-core
   */
  processStreamingEvent(state: AppState, event: ServerGeminiStreamEvent): AppState;
  
  /**
   * Process core ThoughtSummary directly
   */
  processThoughtSummary(state: AppState, thoughtSummary: ThoughtSummary): AppState;
  
  /**
   * Update current thought with core ThoughtSummary
   */
  updateCurrentThoughtFromCore(state: AppState, thoughtSummary: ThoughtSummary): AppState;
}