/**
 * Session Manager Interface
 * Defines the contract for session management across providers
 */

import { ProviderType } from '../../abstractions/providers/index.js';
import { IProvider } from './IProvider.js';
import { IProgressTracker } from './IProgressTracker.js';
import { ToolConfirmationOutcome } from '@google/gemini-cli-core';

export interface ISessionInfo {
  id: string;
  tag: string;
  provider: ProviderType;
  timestamp: Date;
  isActive: boolean;
  messageCount: number;
}

export interface IToolUseData {
  toolName: string;
  arguments: Record<string, unknown>;
  executionId: string;
  timestamp: Date;
}

export interface IPermissionRequestData {
  toolName: string;
  arguments: Record<string, unknown>;
  description?: string;
  toolUseId?: string; // Original tool use ID from Claude CLI
}

export interface IStreamingCallbacks {
  onToken?: (token: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
  onToolUse?: (tool: IToolUseData) => void;
  onToolExecutionComplete?: (executionId: string, result?: any) => void;
  onToolFailure?: (executionId: string, error: string) => void;
  onPermissionRequest?: (request: IPermissionRequestData) => Promise<ToolConfirmationOutcome>;
  onToolAutoApproved?: (data: { toolName: string; args: Record<string, unknown> }) => void;
  onThinkingChunk?: (thinking: string) => void;
}

export interface ISessionManager {
  initialize(progressTracker?: IProgressTracker): Promise<void>;
  switchProvider(provider: ProviderType): Promise<void>;
  createSession(tag: string, progressTracker?: IProgressTracker): Promise<void>;
  resumeSession?(tag: string): Promise<void>;
  getCurrentProvider(): ProviderType;
  getCurrentProviderInstance(): IProvider | null;
  getCurrentSessionInfo(): Promise<ISessionInfo | null>;
  getAvailableProviders(): string[];
  sendMessage(message: string): Promise<string>;
  streamMessage(message: string, callbacks: IStreamingCallbacks): Promise<void>;
  supportsStreaming(): boolean;
  triggerPostStreamingSync(): Promise<void>;
  getConversationHistory?(sessionId: string): Promise<Array<{role: string; content: string}>>;
  cleanup(): Promise<void>;
  performFinalSave?(): Promise<void>;
  executeAskModel?(targetProvider: ProviderType | string, prompt: string): Promise<string>;
}