/**
 * Tool State Manager Interface
 * Manages tool execution state operations with gemini-cli-core integration
 */

import { AppState, ToolExecution } from '../../components/core/types.js';
import { ServerGeminiStreamEvent } from '@google/gemini-cli-core';

export interface IToolStateManager {
  /**
   * Add tool execution to state
   */
  addToolExecution(state: AppState, tool: ToolExecution): AppState;
  
  /**
   * Update existing tool execution
   */
  updateToolExecution(state: AppState, toolUseId: string, updates: Partial<ToolExecution>): AppState;
  
  /**
   * Mark tool as completed
   */
  completeToolExecution(state: AppState, toolUseId: string, result: string, executionTime?: number): AppState;
  
  /**
   * Mark tool as failed
   */
  failToolExecution(state: AppState, toolUseId: string, error: string): AppState;
  
  /**
   * Stop all executing tools
   */
  stopAllExecutingTools(state: AppState): AppState;
  
  /**
   * Get executing tools
   */
  getExecutingTools(state: AppState): ToolExecution[];
  
  /**
   * Get tool execution by ID
   */
  getToolExecution(state: AppState, toolUseId: string): ToolExecution | null;
  
  /**
   * Process streaming event from gemini-cli-core
   */
  processStreamingEvent(state: AppState, event: ServerGeminiStreamEvent): AppState;
}