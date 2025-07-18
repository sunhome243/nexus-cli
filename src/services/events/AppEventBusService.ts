/**
 * App Event Bus Service Implementation
 * Centralized event coordination service replacing global EventEmitters
 * Provides type-safe event emission and subscription across the application
 */

import { EventEmitter } from "node:events";
import { injectable } from "inversify";
import { IAppEventBusService, IToolFailureData, IToolAutoApprovalData, IPermissionRequestData } from "../../interfaces/events/IAppEventBusService.js";

@injectable()
export class AppEventBusService implements IAppEventBusService {
  private permissionEventEmitter: EventEmitter;
  private permissionRequestEventEmitter: EventEmitter;
  private toolFailureEventEmitter: EventEmitter;
  private toolAutoApprovalEventEmitter: EventEmitter;

  constructor() {
    this.permissionEventEmitter = new EventEmitter();
    this.permissionRequestEventEmitter = new EventEmitter();
    this.toolFailureEventEmitter = new EventEmitter();
    this.toolAutoApprovalEventEmitter = new EventEmitter();
  }

  // Permission mode event management
  onPermissionModeChange(callback: (mode: string) => void): void {
    this.permissionEventEmitter.on("permissionModeChange", callback);
  }

  offPermissionModeChange(callback: (mode: string) => void): void {
    this.permissionEventEmitter.off("permissionModeChange", callback);
  }

  emitPermissionModeChange(mode: string): void {
    this.permissionEventEmitter.emit("permissionModeChange", mode);
  }

  // Permission request event management
  onPermissionRequest(callback: (data: IPermissionRequestData) => void): void {
    this.permissionRequestEventEmitter.on("permission_request", callback);
  }

  offPermissionRequest(callback: (data: IPermissionRequestData) => void): void {
    this.permissionRequestEventEmitter.off("permission_request", callback);
  }

  emitPermissionRequest(data: IPermissionRequestData): void {
    this.permissionRequestEventEmitter.emit("permission_request", data);
  }

  // Tool failure event management
  onToolFailure(callback: (data: IToolFailureData) => void): void {
    this.toolFailureEventEmitter.on("tool_failure", callback);
  }

  offToolFailure(callback: (data: IToolFailureData) => void): void {
    this.toolFailureEventEmitter.off("tool_failure", callback);
  }

  emitToolFailure(data: IToolFailureData): void {
    this.toolFailureEventEmitter.emit("tool_failure", data);
  }

  // Tool auto-approval event management
  onToolAutoApproval(callback: (data: IToolAutoApprovalData) => void): void {
    this.toolAutoApprovalEventEmitter.on("tool_auto_approval", callback);
  }

  offToolAutoApproval(callback: (data: IToolAutoApprovalData) => void): void {
    this.toolAutoApprovalEventEmitter.off("tool_auto_approval", callback);
  }

  emitToolAutoApproval(data: IToolAutoApprovalData): void {
    this.toolAutoApprovalEventEmitter.emit("tool_auto_approval", data);
  }

  // Cleanup method
  removeAllListeners(): void {
    this.permissionEventEmitter.removeAllListeners();
    this.permissionRequestEventEmitter.removeAllListeners();
    this.toolFailureEventEmitter.removeAllListeners();
    this.toolAutoApprovalEventEmitter.removeAllListeners();
  }
}