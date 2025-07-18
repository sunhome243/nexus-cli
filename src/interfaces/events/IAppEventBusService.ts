/**
 * App Event Bus Service Interface
 * Provides type-safe event coordination across the application
 * Replaces global EventEmitters with proper service-based architecture
 */

export interface IToolFailureData {
  toolName: string;
  error: string;
  timestamp: Date;
  executionId?: string;
  arguments?: Record<string, unknown>;
  context?: {
    provider?: string;
    sessionId?: string;
    messageId?: string;
  };
}

export interface IToolAutoApprovalData {
  toolUseId: string;
  content?: string;
  timestamp: Date;
  context?: {
    provider?: string;
    sessionId?: string;
    messageId?: string;
  };
}

export interface IPermissionRequestData {
  toolName: string;
  toolUseId: string;
  args: Record<string, unknown>;
  tier?: string;
  description?: string;
  timestamp: Date;
  context?: {
    provider?: string;
    sessionId?: string;
    messageId?: string;
  };
}

export interface IAppEventBusService {
  // Permission mode events
  onPermissionModeChange(callback: (mode: string) => void): void;
  offPermissionModeChange(callback: (mode: string) => void): void;
  emitPermissionModeChange(mode: string): void;

  // Permission request events
  onPermissionRequest(callback: (data: IPermissionRequestData) => void): void;
  offPermissionRequest(callback: (data: IPermissionRequestData) => void): void;
  emitPermissionRequest(data: IPermissionRequestData): void;

  // Tool failure events  
  onToolFailure(callback: (data: IToolFailureData) => void): void;
  offToolFailure(callback: (data: IToolFailureData) => void): void;
  emitToolFailure(data: IToolFailureData): void;

  // Tool auto-approval events
  onToolAutoApproval(callback: (data: IToolAutoApprovalData) => void): void;
  offToolAutoApproval(callback: (data: IToolAutoApprovalData) => void): void;
  emitToolAutoApproval(data: IToolAutoApprovalData): void;

  // Cleanup
  removeAllListeners(): void;
}