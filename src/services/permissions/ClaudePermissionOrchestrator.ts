/**
 * Claude Permission Orchestrator Service
 * Handles Claude-specific MCP permission integration and workflow
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../infrastructure/di/types.js';
import { ILoggerService } from '../../interfaces/core/ILoggerService.js';
import { BaseProvider } from '../providers/shared/BaseProvider.js';
import { 
  IClaudePermissionService, 
  ClaudePermissionRequest, 
  ClaudePermissionResponse,
  ClaudePermissionMode,
  MCPServerStatus
} from '../../interfaces/permissions/IClaudePermissionService.js';
import { PermissionResponseService } from '../providers/claude/services/PermissionResponseService.js';
import { ClaudeSettingsService } from '../mcp/config/ClaudeSettingsService.js';
import { ISessionManager } from '../../interfaces/core/ISessionManager.js';
import { IAppEventBusService } from '../../interfaces/events/IAppEventBusService.js';

/**
 * Permission resolve callback function type
 */
type PermissionResolveCallback = (response: ClaudePermissionResponse) => void;

/**
 * Pending permission state
 */
interface PendingPermission {
  request: ClaudePermissionRequest;
  resolve: PermissionResolveCallback;
  timestamp: Date;
}

@injectable()
export class ClaudePermissionOrchestrator extends BaseProvider implements IClaudePermissionService {
  private currentPermissionMode: ClaudePermissionMode = 'default';
  private pendingPermission: PendingPermission | null = null;
  private permissionStats = {
    totalRequests: 0,
    approvedRequests: 0,
    deniedRequests: 0,
    autoApprovedRequests: 0,
    requestsByTool: {} as Record<string, number>
  };

  constructor(
    @inject(TYPES.LoggerService) logger: ILoggerService,
    @inject(TYPES.PermissionResponseService) private permissionResponseService: PermissionResponseService,
    @inject(TYPES.ClaudeSettingsService) private claudeSettingsService: ClaudeSettingsService,
    @inject(TYPES.SessionManager) private sessionManager: ISessionManager,
    @inject(TYPES.AppEventBusService) private appEventBusService: IAppEventBusService
  ) {
    super();
    this.setLogger(logger);
  }

  async initialize(): Promise<void> {
    this.setInitialized(true);
    this.logInfo('Claude Permission Orchestrator initialized');
  }

  async cleanup(): Promise<void> {
    this.pendingPermission = null;
    this.setInitialized(false);
    this.logInfo('Claude Permission Orchestrator cleaned up');
  }

  setPermissionMode(mode: ClaudePermissionMode): void {
    this.currentPermissionMode = mode;
    this.logInfo(`Permission mode set to: ${mode}`);
    this.appEventBusService.emitPermissionModeChange(mode);
  }

  getPermissionMode(): ClaudePermissionMode {
    return this.currentPermissionMode;
  }

  cyclePermissionMode(): ClaudePermissionMode {
    const modes: ClaudePermissionMode[] = ['plan', 'default', 'acceptEdits', 'bypassPermissions'];
    const currentIndex = modes.indexOf(this.currentPermissionMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex];
    
    this.setPermissionMode(nextMode);
    return nextMode;
  }

  isAutoApprovalMode(): boolean {
    return this.currentPermissionMode === 'acceptEdits' || this.currentPermissionMode === 'bypassPermissions';
  }

  getPermissionModeDisplayName(): string {
    const displayNames: Record<ClaudePermissionMode, string> = {
      'plan': 'Plan Mode',
      'default': 'Default',
      'acceptEdits': 'Accept Edits',
      'bypassPermissions': 'Bypass Permissions'
    };
    return displayNames[this.currentPermissionMode];
  }

  async checkToolPermission(toolName: string, args?: unknown): Promise<{ granted: boolean; reason?: string; autoApprove?: boolean }> {
    // Check if permission mode allows auto-approval
    if (this.isAutoApprovalMode()) {
      return { granted: true, autoApprove: true };
    }

    // Check if tool is in auto-approved list
    try {
      const isAutoApproved = await this.claudeSettingsService.isToolAutoApproved(toolName, args as Record<string, unknown>);
      if (isAutoApproved) {
        return { granted: true, autoApprove: true };
      }
    } catch (error) {
      this.logWarn('Failed to check auto-approved tools', { error });
    }

    return { granted: false };
  }

  async handlePermissionRequest(request: ClaudePermissionRequest): Promise<ClaudePermissionResponse> {
    this.ensureInitialized();
    
    this.permissionStats.totalRequests++;
    this.permissionStats.requestsByTool[request.tool] = (this.permissionStats.requestsByTool[request.tool] || 0) + 1;

    this.logInfo('Processing Claude permission request', {
      tool: request.tool,
      tier: request.tier,
      toolUseId: request.toolUseId
    });

    // Check for auto-approval
    const permissionCheck = await this.checkToolPermission(request.tool, request.args);
    if (permissionCheck.granted && permissionCheck.autoApprove) {
      this.permissionStats.autoApprovedRequests++;
      
      const response: ClaudePermissionResponse = {
        approved: true,
        autoApprove: true,
        toolUseId: request.toolUseId,
        timestamp: new Date()
      };

      await this.sendPermissionResponseToMCP(response);
      return response;
    }

    // Request user permission
    return new Promise<ClaudePermissionResponse>(async (resolve) => {
      this.pendingPermission = {
        request,
        resolve,
        timestamp: new Date()
      };

      // Emit permission request event for UI to handle
      const sessionInfo = await this.sessionManager.getCurrentSessionInfo();
      this.appEventBusService.emitPermissionRequest({
        toolName: request.tool,
        toolUseId: request.toolUseId,
        args: request.args || {},
        tier: request.tier,
        description: request.description,
        timestamp: new Date(),
        context: {
          provider: 'claude',
          sessionId: sessionInfo?.tag || 'unknown',
          messageId: request.toolUseId
        }
      });
    });
  }

  async sendPermissionResponseToMCP(response: ClaudePermissionResponse): Promise<void> {
    try {
      await this.permissionResponseService.sendPermissionResponse({
        toolUseId: response.toolUseId,
        approved: response.approved,
        reason: response.reason,
        autoApprove: response.autoApprove
      });

      this.logInfo('Permission response sent to MCP server', {
        toolUseId: response.toolUseId,
        approved: response.approved
      });
    } catch (error) {
      this.logError('Failed to send permission response to MCP server', { error });
      throw error;
    }
  }

  getMCPServerStatus(): MCPServerStatus {
    // This would typically get status from the MCP connection
    return {
      isConnected: true, // Placeholder - would check actual connection
      errorCount: 0
    };
  }

  async handleUserResponse(response: ClaudePermissionResponse): Promise<void> {
    if (!this.pendingPermission) {
      this.logWarn('Received permission response but no pending permission');
      return;
    }

    try {
      // Update statistics
      if (response.approved) {
        this.permissionStats.approvedRequests++;
      } else {
        this.permissionStats.deniedRequests++;
      }

      // Handle auto-approve functionality
      if (response.autoApprove && response.approved) {
        await this.handleAutoApprove(this.pendingPermission.request);
      }

      // Send to MCP server
      await this.sendPermissionResponseToMCP(response);

      // Resolve the pending permission
      this.pendingPermission.resolve(response);

    } catch (error) {
      this.logError('Failed to handle permission response', { error });
      throw error;
    } finally {
      this.pendingPermission = null;
    }
  }

  private async handleAutoApprove(request: ClaudePermissionRequest): Promise<void> {
    try {
      // Add tool to auto-approved list
      await this.claudeSettingsService.addAutoApprovedTool(request.tool, request.args);
      this.logInfo(`Added ${request.tool} to auto-approved tools`);

      // Change permission mode to acceptEdits for this session
      const provider = this.sessionManager.getCurrentProvider();
      if (provider && (provider as any).setPermissionMode) {
        (provider as any).setPermissionMode('acceptEdits');
        this.setPermissionMode('acceptEdits');
        this.logInfo('Permission mode changed to acceptEdits after auto-approve');
      }
    } catch (error) {
      this.logError('Failed to process auto-approve', { error });
    }
  }

  getPermissionStats() {
    return { ...this.permissionStats };
  }

  resetPermissionStats(): void {
    this.permissionStats = {
      totalRequests: 0,
      approvedRequests: 0,
      deniedRequests: 0,
      autoApprovedRequests: 0,
      requestsByTool: {}
    };
  }

  shouldAutoApprove(toolName: string, tier?: string): boolean {
    return this.isAutoApprovalMode();
  }

  getPendingPermission(): PendingPermission | null {
    return this.pendingPermission;
  }
}