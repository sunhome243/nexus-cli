/**
 * Claude Permission Service Interface
 * Defines the contract for Claude permission management
 */

import { IPermissionService, PermissionResult, PermissionStats, ToolArguments } from '../core/IProviderService.js';

export interface ClaudePermissionRequest {
  toolName: string;
  args: ToolArguments;
  requestId: string;
  timestamp: Date;
}

export interface ClaudePermissionStats extends PermissionStats {
  approved: number;
  denied: number;
  autoApproved: number;
  byMode: Record<string, number>;
  byTool: Record<string, number>;
}

export interface IClaudePermissionService extends IPermissionService {
  /**
   * Check tool permission
   */
  checkToolPermission(toolName: string, args?: ToolArguments): Promise<PermissionResult>;

  /**
   * Set permission mode
   */
  setPermissionMode(mode: string): void;

  /**
   * Get permission statistics
   */
  getPermissionStats(): ClaudePermissionStats;

  /**
   * Handle permission request
   */
  handlePermissionRequest(request: ClaudePermissionRequest): Promise<PermissionResult>;

  /**
   * Get current permission mode
   */
  getCurrentPermissionMode(): string;
}