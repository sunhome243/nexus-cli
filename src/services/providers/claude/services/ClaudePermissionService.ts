/**
 * Claude Permission Service
 * Handles permission mode management and request processing
 * Extracted from ClaudeProvider to reduce complexity
 */

import { injectable, inject } from "inversify";
import { TYPES } from "../../../../infrastructure/di/types.js";
import { ILoggerService } from "../../../../interfaces/core/ILoggerService.js";
import { BaseProvider } from "../../shared/BaseProvider.js";
import { ClaudePermissionRequest, ClaudePermissionResponse } from "../types.js";
import { getToolTier } from "../../shared/ToolPermissionManager.js";
import { ClaudePermissionStats } from "../../../../interfaces/providers/IClaudePermissionService.js";
import { PermissionResponseService } from "./PermissionResponseService.js";

export type PermissionMode = 'plan' | 'default' | 'acceptEdits' | 'bypassPermissions';

@injectable()
export class ClaudePermissionService extends BaseProvider {
  private permissionMode: PermissionMode = 'default';
  // Integrated permission response handling
  private stats: ClaudePermissionStats = {
    totalRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
    autoApprovedRequests: 0,
    requestsByTier: {},
    approved: 0,
    denied: 0,
    autoApproved: 0,
    byMode: {
      plan: 0,
      default: 0,
      acceptEdits: 0,
      bypassPermissions: 0
    },
    byTool: {}
  };

  // Tool categorization
  private readonly safeTools = [
    "Read", "LS", "Glob", "Grep", "NotebookRead", "TodoRead", 
    "TodoWrite", "WebSearch", "exit_plan_mode"
  ];
  
  private readonly editTools = [
    "Edit", "Write", "MultiEdit", "NotebookEdit"
  ];

  constructor(
    @inject(TYPES.LoggerService) logger?: ILoggerService,
    @inject(TYPES.PermissionResponseService) private permissionResponseService?: PermissionResponseService
  ) {
    super();
    if (logger) {
      this.setLogger(logger);
    }
  }

  async initialize(): Promise<void> {
    this.setInitialized(true);
    this.logInfo('Claude Permission Service initialized');
  }

  async cleanup(): Promise<void> {
    this.setInitialized(false);
    this.logInfo('Claude Permission Service cleaned up');
  }

  /**
   * Set permission mode
   */
  setPermissionMode(mode: PermissionMode): void {
    this.permissionMode = mode;
    this.logInfo(`Permission mode set to: ${mode}`);
  }

  /**
   * Get current permission mode
   */
  getPermissionMode(): PermissionMode {
    return this.permissionMode;
  }

  /**
   * Check if a permission prompt should be shown for this request
   */
  shouldShowPermissionPrompt(request: ClaudePermissionRequest): boolean {
    switch (this.permissionMode) {
      case "bypassPermissions":
        return false; // Never show prompts in bypass mode

      case "acceptEdits":
        return !this.safeTools.includes(request.tool) && !this.editTools.includes(request.tool);

      case "plan":
        return !this.safeTools.includes(request.tool); // Show prompts for non-read operations in plan mode

      case "default":
      default:
        return !this.safeTools.includes(request.tool); // Show prompts for non-safe operations
    }
  }

  /**
   * Process a permission request
   */
  async processPermissionRequest(
    request: ClaudePermissionRequest,
    sessionId: string | null,
    onPermissionRequest?: (request: ClaudePermissionRequest) => Promise<ClaudePermissionResponse>
  ): Promise<ClaudePermissionResponse> {
    this.ensureInitialized();

    // Enhance request with tool tier if not set
    if (!request.tier) {
      request.tier = getToolTier(request.tool);
    }

    // Update statistics
    this.updateStats(request);

    this.logInfo(`Processing permission request: ${request.tool} (tier: ${request.tier}, mode: ${this.permissionMode})`);

    const shouldPrompt = this.shouldShowPermissionPrompt(request);

    if (shouldPrompt && onPermissionRequest) {
      this.logInfo(`Requesting user permission for: ${request.tool}`);
      try {
        const response = await onPermissionRequest(request);
        this.logInfo(`User permission response: ${response.approved ? "APPROVED" : "DENIED"}`);

        // Update approval statistics
        if (response.approved) {
          this.stats.approved++;
        } else {
          this.stats.denied++;
          this.logInfo(`User denied ${request.tool} - MCP server will block execution`);
        }

        // Send permission response to MCP server for user decisions
        if (request.toolUseId && sessionId && this.permissionResponseService) {
          try {
            await this.permissionResponseService.sendPermissionResponse({
              toolUseId: request.toolUseId,
              approved: response.approved,
              reason: response.message || (response.approved ? 'User approved' : 'User denied'),
              autoApprove: false
            });
            this.logInfo(`User permission response sent to MCP server for ${request.tool}`);
          } catch (error) {
            this.logError(`Failed to send user permission response to MCP server:`, error);
          }
        }

        return response;
      } catch (error) {
        this.logError(`Permission request failed:`, error);
        return { approved: false, message: `Permission request failed: ${error}` };
      }
    } else {
      this.logInfo(`Tool ${request.tool} bypassed UI prompt (mode: ${this.permissionMode})`);
      
      // For auto-approved tools, send permission response to MCP server
      if (request.toolUseId && sessionId && this.permissionResponseService) {
        try {
          await this.permissionResponseService.sendPermissionResponse({
            toolUseId: request.toolUseId,
            approved: true,
            reason: `Auto-approved ${request.tool} (tier: ${request.tier}, mode: ${this.permissionMode})`,
            autoApprove: true
          });
          this.logInfo(`Auto-approved ${request.tool} sent to MCP server`);
          this.stats.autoApproved++;
        } catch (error) {
          this.logError(`Failed to send auto-approval to MCP server:`, error);
        }
      }

      return { 
        approved: true, 
        autoApprove: true,
        message: `Auto-approved in ${this.permissionMode} mode`
      };
    }
  }

  /**
   * Send permission response to MCP server
   */
  async sendPermissionResponse(
    sessionId: string,
    response: {
      toolUseId: string;
      approved: boolean;
      reason?: string;
    }
  ): Promise<void> {
    this.ensureInitialized();

    if (!this.permissionResponseService) {
      this.logError('PermissionResponseService not available');
      throw new Error('PermissionResponseService not available');
    }

    try {
      await this.permissionResponseService.sendPermissionResponse({
        toolUseId: response.toolUseId,
        approved: response.approved,
        reason: response.reason,
        autoApprove: false
      });
      this.logInfo(`Permission response sent to MCP server via PermissionResponseService`, {
        toolUseId: response.toolUseId,
        approved: response.approved,
        sessionId
      });
    } catch (error) {
      this.logError(`Failed to send permission response to MCP server:`, error);
      throw error;
    }
  }

  /**
   * Get permission statistics
   */
  getPermissionStats(): Readonly<ClaudePermissionStats> {
    return { ...this.stats };
  }

  /**
   * Reset permission statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      approvedRequests: 0,
      rejectedRequests: 0,
      autoApprovedRequests: 0,
      requestsByTier: {},
      approved: 0,
      denied: 0,
      autoApproved: 0,
      byMode: {
        plan: 0,
        default: 0,
        acceptEdits: 0,
        bypassPermissions: 0
      },
      byTool: {}
    };
    this.logDebug('Permission statistics reset');
  }

  /**
   * Check if tool is considered safe
   */
  isToolSafe(toolName: string): boolean {
    return this.safeTools.includes(toolName);
  }

  /**
   * Check if tool is an edit tool
   */
  isEditTool(toolName: string): boolean {
    return this.editTools.includes(toolName);
  }

  /**
   * Get tool categorization
   */
  getToolCategory(toolName: string): 'safe' | 'edit' | 'restricted' {
    if (this.isToolSafe(toolName)) {
      return 'safe';
    } else if (this.isEditTool(toolName)) {
      return 'edit';
    } else {
      return 'restricted';
    }
  }

  /**
   * Update permission statistics
   */
  private updateStats(request: ClaudePermissionRequest): void {
    this.stats.totalRequests++;
    this.stats.byMode[this.permissionMode]++;
    
    if (this.stats.byTool[request.tool]) {
      this.stats.byTool[request.tool]++;
    } else {
      this.stats.byTool[request.tool] = 1;
    }
  }

  /**
   * Create enhanced permission request with additional context
   */
  createPermissionRequest(
    tool: string,
    command: string,
    description: string,
    args?: Record<string, unknown>,
    toolUseId?: string
  ): ClaudePermissionRequest {
    return {
      tool,
      tier: getToolTier(tool),
      command,
      description,
      arguments: args,
      timestamp: new Date(),
      toolUseId
    };
  }

  /**
   * Validate permission mode
   */
  isValidPermissionMode(mode: string): mode is PermissionMode {
    return ['plan', 'default', 'acceptEdits', 'bypassPermissions'].includes(mode);
  }

  /**
   * Get permission mode description
   */
  getPermissionModeDescription(mode: PermissionMode): string {
    switch (mode) {
      case 'plan':
        return 'Planning mode - prompts for all non-read operations';
      case 'default':
        return 'Default mode - prompts for non-safe operations';
      case 'acceptEdits':
        return 'Accept edits mode - auto-approves safe and edit tools';
      case 'bypassPermissions':
        return 'Bypass mode - auto-approves all tools';
      default:
        return 'Unknown permission mode';
    }
  }
}