/**
 * Tool Type Definitions
 * Provides type-safe interfaces for tool execution and handling
 */

export interface IToolRequest {
  id: string;
  name: string;
  input: Record<string, unknown>;
  timestamp?: Date;
}

export interface IToolResponse {
  id: string;
  name: string;
  output: unknown;
  error?: string;
  timestamp?: Date;
}

export interface IToolCall {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: unknown;
  error?: Error;
}

export interface IToolExecutionContext {
  provider: string;
  model: string;
  sessionId?: string;
  userId?: string;
}

export interface IToolProgressUpdate {
  toolId: string;
  progress: number; // 0-100
  message?: string;
  timestamp: Date;
}

export interface IProgressCallback {
  (update: IToolProgressUpdate): void;
}