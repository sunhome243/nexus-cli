/**
 * Tool Execution Strategy Interface
 * Simplified strategy contracts for core tool integration
 */

import { ToolExecution } from '../../components/core/types.js';

// Tool argument types for better type safety
export type ToolArguments = Record<string, unknown>;

// Tool execution result data
export type ToolResultData = unknown;

// Metadata for tool execution with extensible properties
export interface ToolExecutionMetadata {
  strategy: string;
  toolName: string;
  executionMethod?: 'core' | 'custom';
  [key: string]: unknown;
}

export interface IToolExecutionContext {
  toolName: string;
  args: ToolArguments;
  toolUseId: string;
  provider: string;
  sessionId: string;
  userId: string;
  permissionTier?: 'safe' | 'cautious' | 'dangerous';
}

export interface IToolExecutionResult {
  success: boolean;
  result?: ToolResultData;
  error?: string;
  executionTime: number;
  metadata?: ToolExecutionMetadata;
}

export interface IToolExecutionStrategy {
  /**
   * Check if this strategy can handle the tool (simplified for core integration)
   */
  canHandle(context: IToolExecutionContext): boolean;
  
  /**
   * Execute the tool with this strategy (core tools preferred, fallback to custom)
   */
  execute(context: IToolExecutionContext): Promise<IToolExecutionResult>;
  
  /**
   * Get strategy name for logging and metadata
   */
  getStrategyName(): string;
  
  /**
   * Get execution priority (simplified: local=100, remote=50)
   */
  getPriority(): number;
}