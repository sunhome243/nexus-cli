/**
 * Gemini Permission Orchestrator Service
 * Handles Gemini-specific direct callback permission integration and workflow
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../infrastructure/di/types.js';
import { ILoggerService } from '../../interfaces/core/ILoggerService.js';
import { BaseProvider } from '../providers/shared/BaseProvider.js';
import { 
  IGeminiPermissionService, 
  GeminiPermissionRequest, 
  GeminiPermissionResponse,
  GeminiConfirmationDetails,
  GeminiConfirmationOutcome,
  GeminiToolExecutionContext,
  PermissionCallback
} from '../../interfaces/permissions/IGeminiPermissionService.js';
import { getToolTier, getToolDescription } from '../providers/shared/ToolPermissionManager.js';

/**
 * Permission resolve callback function type
 */
type PermissionResolveCallback = (response: GeminiPermissionResponse) => void;

/**
 * Pending permission state
 */
interface PendingPermission {
  request: GeminiPermissionRequest;
  resolve: PermissionResolveCallback;
  timestamp: Date;
}

@injectable()
export class GeminiPermissionOrchestrator extends BaseProvider implements IGeminiPermissionService {
  private permissionCallback: PermissionCallback | null = null;
  private pendingPermission: PendingPermission | null = null;
  private permissionStats = {
    totalRequests: 0,
    approvedRequests: 0,
    deniedRequests: 0,
    autoApprovedRequests: 0,
    requestsByTool: {} as Record<string, number>
  };

  constructor(
    @inject(TYPES.LoggerService) logger: ILoggerService
  ) {
    super();
    this.setLogger(logger);
  }

  async initialize(): Promise<void> {
    this.setInitialized(true);
    this.logInfo('Gemini Permission Orchestrator initialized');
  }

  async cleanup(): Promise<void> {
    this.permissionCallback = null;
    this.pendingPermission = null;
    this.setInitialized(false);
    this.logInfo('Gemini Permission Orchestrator cleaned up');
  }

  setPermissionCallback(callback: PermissionCallback): void {
    this.permissionCallback = callback;
    this.logInfo('Permission callback set for Gemini provider');
  }

  async checkToolPermission(toolName: string, args?: unknown): Promise<{ granted: boolean; reason?: string; autoApprove?: boolean }> {
    // Gemini uses direct permission requests - always requires user interaction
    return { granted: false };
  }

  async handlePermissionRequest(request: GeminiPermissionRequest): Promise<GeminiPermissionResponse> {
    this.ensureInitialized();
    
    this.permissionStats.totalRequests++;
    this.permissionStats.requestsByTool[request.toolName] = (this.permissionStats.requestsByTool[request.toolName] || 0) + 1;

    this.logInfo('Processing Gemini permission request', {
      toolName: request.toolName,
      tier: request.tier,
      toolUseId: request.toolUseId
    });

    if (!this.permissionCallback) {
      throw new Error('Permission callback not set for Gemini provider');
    }

    // Create enhanced permission request with confirmation details
    const enhancedRequest: GeminiPermissionRequest = {
      ...request,
      confirmationDetails: this.createConfirmationDetails(request.toolName, request.args)
    };

    try {
      const response = await this.permissionCallback(enhancedRequest);
      
      // Update statistics
      if (response.approved) {
        this.permissionStats.approvedRequests++;
      } else {
        this.permissionStats.deniedRequests++;
      }

      this.logInfo('Gemini permission response received', {
        toolName: request.toolName,
        approved: response.approved,
        outcome: response.outcome
      });

      return response;
    } catch (error) {
      this.logError('Failed to handle Gemini permission request', { error });
      throw error;
    }
  }

  createConfirmationDetails(toolName: string, args: unknown): GeminiConfirmationDetails {
    const argsObj = (args && typeof args === 'object') ? args as Record<string, unknown> : {};

    // Extract file path from various possible argument structures
    const extractFilePath = (): string | undefined => {
      return (argsObj.file_path as string) || 
             (argsObj.path as string) || 
             (argsObj.filePath as string) || 
             (argsObj.fileName as string) ||
             (argsObj.absolute_path as string);
    };

    switch (toolName) {
      case 'read_file':
      case 'edit_file':
      case 'write_file':
      case 'replacefile':
        const filePath = extractFilePath();
        return {
          type: 'edit' as const,
          title: `${toolName}: ${this.formatToolCommand(toolName, args)}`,
          fileName: filePath,
          isModifying: toolName !== 'read_file' // read_file is not modifying, others are
        };

      case 'run_shell_command':
        return {
          type: 'exec' as const,
          title: `${toolName}: ${this.formatToolCommand(toolName, args)}`,
          command: String(argsObj.command || ''),
          rootCommand: String(argsObj.command || '')
        };

      case 'askModel':
        return {
          type: 'info' as const,
          title: `Consult ${String(argsObj.model || 'AI')}`,
          prompt: String(argsObj.prompt || 'Consultation request')
        };

      default:
        // For other tools, create a generic info type
        return {
          type: 'info' as const,
          title: String(this.formatToolCommand(toolName, args)),
          prompt: `Execute ${toolName} with provided arguments`
        };
    }
  }

  async shouldConfirmTool(toolName: string, args?: unknown): Promise<boolean> {
    // Gemini tools generally require confirmation unless they are safe read-only operations
    const safeTiers = ['safe'];
    const tier = getToolTier(toolName);
    return !safeTiers.includes(tier);
  }

  formatToolCommand(toolName: string, args: unknown): string {
    if (!args || (typeof args === 'object' && Object.keys(args).length === 0)) {
      return `${toolName}()`;
    }

    const argsObj = typeof args === 'object' && args !== null ? args as Record<string, unknown> : {};

    // Format common tool patterns
    switch (toolName) {
      case 'read_file':
        return `Read: ${argsObj.file_path || argsObj.absolute_path || argsObj.path || 'unknown file'}`;
      
      case 'edit_file':
        return `Edit: ${argsObj.file_path || argsObj.absolute_path || argsObj.path || 'unknown file'}`;
      
      case 'write_file':
        return `Write: ${argsObj.file_path || argsObj.absolute_path || argsObj.path || 'unknown file'}`;

      case 'replacefile':
        return `Replace: ${argsObj.file_path || argsObj.absolute_path || argsObj.path || 'unknown file'}`;
      
      case 'run_shell_command':
        return `$ ${argsObj.command || 'unknown command'}`;
      
      case 'list_directory':
        return `ls ${argsObj.path || '.'}`;
      
      case 'search_file_content':
        return `grep "${argsObj.pattern}" ${argsObj.path || '.'}`;
      
      case 'askModel':
        const prompt = typeof argsObj.prompt === 'string' ? argsObj.prompt : '';
        return `Ask ${argsObj.model}: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`;
      
      default:
        // Generic formatting
        const argStr = Object.entries(argsObj)
          .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
          .join(', ');
        return `${toolName}(${argStr})`;
    }
  }

  formatToolDescription(toolName: string, args: unknown): string {
    const argsObj = typeof args === 'object' && args !== null ? args as Record<string, unknown> : {};
    
    // Format tool-specific descriptions with actual arguments
    switch (toolName) {
      case 'read_file':
        return `Read: ${argsObj.absolute_path || argsObj.file_path || argsObj.path || 'unknown file'}`;
      
      case 'list_directory':
        return `List directory: ${argsObj.path || '.'}`;
      
      case 'search_file_content':
        return `Search for '${argsObj.pattern || 'pattern'}' in ${argsObj.path || '.'}`;
      
      case 'write_file':
        return `Write to: ${argsObj.absolute_path || argsObj.file_path || argsObj.path || 'unknown file'}`;
      
      case 'edit_file':
        return `Edit: ${argsObj.absolute_path || argsObj.file_path || argsObj.path || 'unknown file'}`;
      
      case 'run_shell_command':
        return `Execute: ${argsObj.command || 'unknown command'}`;
      
      default:
        // For unknown tools, try to extract meaningful info from args
        if (argsObj.path || argsObj.file_path || argsObj.absolute_path) {
          const path = argsObj.path || argsObj.file_path || argsObj.absolute_path;
          return `${getToolDescription(toolName)} on ${path}`;
        }
        return getToolDescription(toolName);
    }
  }

  async processConfirmationOutcome(outcome: GeminiConfirmationOutcome, context: GeminiToolExecutionContext): Promise<void> {
    this.logInfo('Processing confirmation outcome', { outcome });
    
    switch (outcome) {
      case 'proceed_once':
      case 'proceed_always':
      case 'proceed_always_server':
      case 'proceed_always_tool':
        // Tool execution should proceed
        break;
      case 'modify_with_editor':
        // Tool should be modified before execution
        // This would trigger editor integration
        break;
      case 'cancel':
        // Tool execution should be cancelled
        break;
    }
  }

  isExecutionAllowed(outcome: GeminiConfirmationOutcome): boolean {
    return outcome !== 'cancel';
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
    // Gemini doesn't support auto-approval - always requires user interaction
    return false;
  }

  getPendingPermission(): PendingPermission | null {
    return this.pendingPermission;
  }

  /**
   * Handle permission request with direct callback (used by App.tsx integration)
   */
  async handleDirectPermissionRequest(request: any): Promise<any> {
    return new Promise((resolve) => {
      const geminiRequest: GeminiPermissionRequest = {
        toolName: request.name || request.toolName,
        description: request.description || `Execute ${request.name || request.toolName} with provided arguments`,
        args: request.args,
        tier: request.permissionTier || request.tier || "cautious",
        timestamp: new Date(),
        toolUseId: `permission-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
      };

      this.pendingPermission = {
        request: geminiRequest,
        resolve: (response: GeminiPermissionResponse) => {
          this.pendingPermission = null;
          resolve(response);
        },
        timestamp: new Date()
      };

      // This would trigger the UI permission prompt
      // For now, we'll resolve with the request to maintain the existing flow
      resolve(geminiRequest);
    });
  }
}