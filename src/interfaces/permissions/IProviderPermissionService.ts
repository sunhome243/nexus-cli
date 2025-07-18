/**
 * Base Provider Permission Service Interface
 * Defines the common contract for permission handling across all providers
 */

import { IProviderService } from '../core/IProviderService.js';

/**
 * Tool arguments for permission checking
 */
export interface ToolArguments {
  [key: string]: unknown;
}

/**
 * Base permission request structure
 */
export interface ProviderPermissionRequest {
  toolName: string;
  args: ToolArguments;
  toolUseId: string;
  timestamp: Date;
  description?: string;
  tier?: string;
}

/**
 * Base permission response structure
 */
export interface ProviderPermissionResponse {
  approved: boolean;
  reason?: string;
  autoApprove?: boolean;
  timestamp: Date;
}

/**
 * Permission result for tool execution
 */
export interface PermissionResult {
  granted: boolean;
  reason?: string;
  autoApprove?: boolean;
}

/**
 * Permission statistics for tracking
 */
export interface PermissionStats {
  totalRequests: number;
  approvedRequests: number;
  deniedRequests: number;
  autoApprovedRequests: number;
  requestsByTool: Record<string, number>;
}

/**
 * Base interface for provider-specific permission services
 */
export interface IProviderPermissionService extends IProviderService {
  /**
   * Set permission mode (provider-specific implementation)
   */
  setPermissionMode?(mode: string): void;

  /**
   * Check if a tool requires permission
   */
  checkToolPermission(toolName: string, args?: ToolArguments): Promise<PermissionResult>;

  /**
   * Get permission statistics
   */
  getPermissionStats(): PermissionStats;

  /**
   * Handle a permission request
   */
  handlePermissionRequest(request: ProviderPermissionRequest): Promise<ProviderPermissionResponse>;

  /**
   * Reset permission statistics
   */
  resetPermissionStats(): void;

  /**
   * Check if tool should auto-approve based on settings
   */
  shouldAutoApprove(toolName: string, tier?: string): boolean;
}