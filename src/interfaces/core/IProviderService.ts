/**
 * Provider Service Interface
 * Defines the base contract for all provider services
 */

import { IProviderStreamingCallbacks } from './IProvider.js';

export interface IProviderService {
  initialize(): Promise<void>;
  cleanup(): Promise<void>;
  isInitialized(): boolean;
}

// Session information interface
export interface SessionInfo {
  sessionId: string;
  tag?: string;
  createdAt: Date;
  lastActivity: Date;
  provider: string;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

// Tool arguments interface
export interface ToolArguments {
  [key: string]: unknown;
}

export interface ISessionService extends IProviderService {
  createSession(sessionTag?: string): Promise<string>;
  resumeSession(sessionId: string): Promise<void>;
  endCurrentSession(): Promise<void>;
  getCurrentSessionId(): string | null;
  getSessionInfo(): SessionInfo | null;
  updateActivity(): void;
}

export interface IErrorHandlerService extends IProviderService {
  handleWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    options?: RetryOptions,
    callbacks?: ErrorCallbacks
  ): Promise<T>;
  categorizeError(error: unknown): ErrorCategory;
  createUserFriendlyMessage(error: unknown, context?: ErrorContext): string;
}

export interface IPermissionService extends IProviderService {
  setPermissionMode(mode: string): void;
  checkToolPermission(toolName: string, args?: ToolArguments): Promise<PermissionResult>;
  getPermissionStats(): PermissionStats;
}

export interface IStreamingService extends IProviderService {
  setupStreamHandlers(callbacks: IProviderStreamingCallbacks): void;
  getStreamingStats(): StreamingStats;
  resetStats(): void;
}

export interface IProcessService extends IProviderService {
  startProcess(command: string, args: string[]): Promise<void>;
  stopProcess(): Promise<void>;
  isProcessRunning(): boolean;
  getProcessInfo(): ProcessInfo | null;
}

// Common interfaces used across services
export interface ErrorContext {
  operation: string;
  provider?: string;
  model?: string;
  attempt?: number;
  maxAttempts?: number;
  timestamp: Date;
}

export interface ErrorCategory {
  type: 'network' | 'quota' | 'permission' | 'validation' | 'system' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRetryable: boolean;
  suggestedAction: string;
}

export interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  exponentialBackoff: boolean;
  retryableErrors: string[];
}

export interface ErrorCallbacks {
  onRetryAttempt?: (attempt: number, maxAttempts: number, error: Error) => void;
  onRetryExhausted?: (finalError: Error, attempts: number) => void;
  onErrorRecovered?: (originalError: Error, recoveryMethod: string) => void;
}

export interface PermissionResult {
  approved: boolean;
  reason?: string;
  autoApproved?: boolean;
}

export interface PermissionStats {
  totalRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  autoApprovedRequests: number;
  requestsByTier: Record<string, number>;
}


export interface StreamingStats {
  totalChunks: number;
  totalCharacters: number;
  averageChunkSize: number;
  streamingStartTime: Date | null;
  streamingEndTime: Date | null;
  lastChunkTime: Date | null;
}

export interface ProcessInfo {
  pid: number;
  command: string;
  args: string[];
  startTime: Date;
  isRunning: boolean;
}