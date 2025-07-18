/**
 * Tool Execution Pipeline Interface
 * Simplified adapter pattern for core tool integration
 */

import { IToolExecutionContext, IToolExecutionResult } from './IToolExecutionStrategy.js';

export interface IToolExecutionPipeline {
  /**
   * Execute a tool through the simplified pipeline (core tools preferred)
   */
  execute(context: IToolExecutionContext): Promise<IToolExecutionResult>;
  
  /**
   * Get execution statistics for monitoring
   */
  getExecutionStats(): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
  };
  
  /**
   * Clear execution statistics
   */
  clearStats(): void;
}