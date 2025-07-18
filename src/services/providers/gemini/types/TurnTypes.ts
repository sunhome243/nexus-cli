/**
 * Turn API Type Definitions
 * Provides type-safe interfaces for Gemini Turn API events
 */

export interface ITurnEvent {
  type: 'content' | 'thinking' | 'toolCallRequest' | 'toolCallResponse' | 'error' | 'complete';
  value?: unknown;
  timestamp?: Date;
}

export interface IContentEvent extends ITurnEvent {
  type: 'content';
  value: string;
}

export interface IThinkingEvent extends ITurnEvent {
  type: 'thinking';
  value: string | { content: string };
}

export interface IToolCallRequestEvent extends ITurnEvent {
  type: 'toolCallRequest';
  value: {
    id: string;
    name: string;
    input: Record<string, unknown>;
  };
}

export interface IToolCallResponseEvent extends ITurnEvent {
  type: 'toolCallResponse';
  value: {
    id: string;
    name: string;
    output: unknown;
    error?: string;
  };
}

export interface IErrorEvent extends ITurnEvent {
  type: 'error';
  value: {
    message: string;
    code?: string;
    stack?: string;
  };
}

export interface ICompleteEvent extends ITurnEvent {
  type: 'complete';
  value?: {
    totalTokens?: number;
    finishReason?: string;
  };
}

export type TurnEventType =
  | 'content'
  | 'thinking'
  | 'toolCallRequest'
  | 'toolCallResponse'
  | 'error'
  | 'complete'
  | 'user_cancelled';

export interface IStreamingState {
  isStreaming: boolean;
  currentTurn?: unknown;
  contentAccumulator: string;
  pendingToolCalls: IToolCallRequestEvent['value'][];
  activeToolExecutions: Map<string, IToolCallRequestEvent['value']>;
  modelSwitchedFromQuotaError: boolean;
  quotaExhaustedFallbackUsed: boolean;
}