/**
 * Claude Provider Permission Service Interface
 * Extends base permission service with Claude-specific MCP integration
 */

import { 
  IProviderPermissionService, 
  ProviderPermissionRequest, 
  ProviderPermissionResponse 
} from './IProviderPermissionService.js';

/**
 * Claude-specific permission request with MCP integration
 */
export interface ClaudePermissionRequest extends ProviderPermissionRequest {
  tool: string; // Claude uses 'tool' property
  tier: string; // Claude permission tier
  content?: string; // Claude tool content
}

/**
 * Claude-specific permission response with MCP communication
 */
export interface ClaudePermissionResponse extends ProviderPermissionResponse {
  toolUseId: string; // Required for MCP communication
  autoApprove: boolean; // Claude-specific auto-approval flag
}

/**
 * Claude permission mode types
 */
export type ClaudePermissionMode = 'plan' | 'default' | 'acceptEdits' | 'bypassPermissions';

/**
 * MCP server communication status
 */
export interface MCPServerStatus {
  isConnected: boolean;
  socketPath?: string;
  lastResponse?: Date;
  errorCount: number;
}

/**
 * Claude-specific permission service interface with MCP integration
 */
export interface IClaudePermissionService extends IProviderPermissionService {
  /**
   * Set Claude permission mode
   */
  setPermissionMode(mode: ClaudePermissionMode): void;

  /**
   * Get current permission mode
   */
  getPermissionMode(): ClaudePermissionMode;

  /**
   * Handle Claude permission request with MCP integration
   */
  handlePermissionRequest(request: ClaudePermissionRequest): Promise<ClaudePermissionResponse>;

  /**
   * Send permission response to MCP server
   */
  sendPermissionResponseToMCP(response: ClaudePermissionResponse): Promise<void>;

  /**
   * Get MCP server connection status
   */
  getMCPServerStatus(): MCPServerStatus;

  /**
   * Cycle to next permission mode
   */
  cyclePermissionMode(): ClaudePermissionMode;

  /**
   * Check if permission mode allows auto-approval
   */
  isAutoApprovalMode(): boolean;

  /**
   * Get permission mode display name
   */
  getPermissionModeDisplayName(): string;
}