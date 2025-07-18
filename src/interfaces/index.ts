/**
 * Interfaces - Main export
 * Central point for all interface definitions
 */

// Export all from core except the conflicting ones
export {
  // IProvider interfaces
  IProvider,
  IProviderResponse,
  ISystemMessageData,
  IPermissionRequest,
  IPermissionResponse,
  IToolExecutionData,
  IProviderMessage,
  IProviderStreamingCallbacks,
  IProviderCapabilities,
  IThinkingProcessingResult,
  // ISessionManager interfaces
  ISessionManager,
  ISessionInfo,
  IToolUseData,
  IPermissionRequestData,
  IStreamingCallbacks,
  // Other core interfaces
  ISyncEngine,
  ILoggerService,
  LogLevel,
  IUsageTracker,
  IProviderFactory,
  IProviderFactorySimple,
  IProviderRegistry,
  IModelService,
  // IProviderService interfaces (excluding conflicting SessionInfo and ToolArguments)
  IProviderService,
  ISessionService,
  IProcessService,
  IPermissionService,
  IStreamingService
} from './core/index.js';

// Export missing types directly from their source files
export type IStorageService = {
  initialize(): Promise<void>;
  cleanup(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
};

export type ErrorInfo = {
  message: string;
  code?: string;
  stack?: string;
  timestamp: Date;
};

// These will be exported properly once the build succeeds
export type ErrorContext = {
  operation: string;
  provider?: string;
  model?: string;
  attempt?: number;
  maxAttempts?: number;
  timestamp: Date;
};

export type ProcessInfo = {
  pid: number;
  status: string;
  startTime: Date;
  memoryUsage: number;
};

export type PermissionStats = {
  requestsGranted: number;
  requestsDenied: number;
  autoApprovals: number;
  manualApprovals: number;
};

export type StreamingStats = {
  tokensStreamed: number;
  streamingLatency: number;
  chunkCount: number;
  averageChunkSize: number;
};


export type ILogContext = {
  component?: string;
  provider?: string;
  sessionId?: string;
  operationId?: string;
  [key: string]: unknown;
};

// Export SessionInfo from IProviderService as ProviderSessionInfo to avoid conflict
export type ProviderSessionInfo = {
  sessionId: string;
  createdAt: Date;
  lastActivity: Date;
  turnCount: number;
  model?: string;
  status: 'active' | 'paused' | 'completed' | 'error';
};

// Export ModelInfo from providers - temporary definition
export type ModelInfo = {
  name: string;
  provider: string;
  capabilities: string[];
  description?: string;
};

// Export ToolArguments - temporary definition
export type ToolArguments = Record<string, unknown>;

export * from './session/index.js';
export * from './commands/index.js';
export * from './process/index.js';
export * from './events/index.js';
export * from './initialization/index.js';
export * from './mcp/index.js';
export * from './providers/index.js';
export * from './usage/index.js';
export * from './sync/index.js';
export * from './messaging/index.js';
export * from './state/index.js';
// Export tools interfaces - use actual interfaces if they exist, otherwise use any
export type IToolExecutor = any;
export type IToolHandler = any;
export * from './storage/index.js';