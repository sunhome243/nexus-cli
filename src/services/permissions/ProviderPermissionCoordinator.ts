/**
 * Provider Permission Coordinator Service
 * Unified interface for permission handling across all providers
 * Routes permission requests to appropriate provider-specific orchestrators
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../infrastructure/di/types.js';
import { ILoggerService } from '../../interfaces/core/ILoggerService.js';
import { ISessionManager } from '../../interfaces/core/ISessionManager.js';
import { IAppEventBusService, IPermissionRequestData } from '../../interfaces/events/IAppEventBusService.js';
import { BaseProvider } from '../providers/shared/BaseProvider.js';
import { ProviderType } from '../../abstractions/providers/index.js';
import { ClaudePermissionOrchestrator } from './ClaudePermissionOrchestrator.js';
import { GeminiPermissionOrchestrator } from './GeminiPermissionOrchestrator.js';
import { 
  IProviderPermissionService,
  ProviderPermissionRequest,
  ProviderPermissionResponse,
  PermissionResult,
  PermissionStats
} from '../../interfaces/permissions/IProviderPermissionService.js';

/**
 * Unified permission request type that works for both providers
 */
export interface UnifiedPermissionRequest {
  toolName: string;
  args: unknown;
  toolUseId: string;
  description?: string;
  tier?: string;
  timestamp: Date;
  // Claude-specific properties
  tool?: string;
  content?: string;
  // Gemini-specific properties
  name?: string;
  permissionTier?: string;
}

/**
 * Unified permission response type
 */
export interface UnifiedPermissionResponse {
  approved: boolean;
  reason?: string;
  autoApprove?: boolean;
  timestamp: Date;
  // Provider-specific outcome
  outcome?: string;
}

/**
 * Permission resolve callback function type
 */
export type UnifiedPermissionResolveCallback = (response: UnifiedPermissionResponse) => void;

/**
 * Pending permission state for the coordinator
 */
export interface PendingPermission {
  request: UnifiedPermissionRequest;
  resolve: UnifiedPermissionResolveCallback;
  provider: ProviderType;
  timestamp: Date;
}

@injectable()
export class ProviderPermissionCoordinator extends BaseProvider implements IProviderPermissionService {
  private pendingPermission: PendingPermission | null = null;

  constructor(
    @inject(TYPES.LoggerService) logger: ILoggerService,
    @inject(TYPES.SessionManager) private sessionManager: ISessionManager,
    @inject(TYPES.ClaudePermissionOrchestrator) private claudeOrchestrator: ClaudePermissionOrchestrator,
    @inject(TYPES.GeminiPermissionOrchestrator) private geminiOrchestrator: GeminiPermissionOrchestrator,
    @inject(TYPES.AppEventBusService) private appEventBusService: IAppEventBusService
  ) {
    super();
    this.setLogger(logger);
  }

  async initialize(): Promise<void> {
    await Promise.all([
      this.claudeOrchestrator.initialize(),
      this.geminiOrchestrator.initialize()
    ]);
    
    this.setInitialized(true);
    this.logInfo('Provider Permission Coordinator initialized');
  }

  async cleanup(): Promise<void> {
    await Promise.all([
      this.claudeOrchestrator.cleanup(),
      this.geminiOrchestrator.cleanup()
    ]);
    
    this.pendingPermission = null;
    this.setInitialized(false);
    this.logInfo('Provider Permission Coordinator cleaned up');
  }

  /**
   * Get the current active provider
   */
  private getCurrentProvider(): ProviderType {
    return this.sessionManager.getCurrentProvider();
  }

  /**
   * Get the appropriate orchestrator for the current provider
   */
  private getCurrentOrchestrator(): IProviderPermissionService {
    const currentProvider = this.getCurrentProvider();
    
    switch (currentProvider) {
      case ProviderType.CLAUDE:
        return this.claudeOrchestrator;
      case ProviderType.GEMINI:
        return this.geminiOrchestrator;
      default:
        throw new Error(`Unknown provider: ${currentProvider}`);
    }
  }

  /**
   * Set permission mode for current provider (if supported)
   */
  setPermissionMode(mode: string): void {
    const orchestrator = this.getCurrentOrchestrator();
    if (orchestrator.setPermissionMode) {
      orchestrator.setPermissionMode(mode);
    } else {
      this.logWarn(`Permission mode setting not supported for current provider`);
    }
  }

  async checkToolPermission(toolName: string, args?: unknown): Promise<PermissionResult> {
    const orchestrator = this.getCurrentOrchestrator();
    return orchestrator.checkToolPermission(toolName, args as any);
  }

  getPermissionStats(): PermissionStats {
    const orchestrator = this.getCurrentOrchestrator();
    return orchestrator.getPermissionStats();
  }

  async handlePermissionRequest(request: ProviderPermissionRequest): Promise<ProviderPermissionResponse> {
    const orchestrator = this.getCurrentOrchestrator();
    return orchestrator.handlePermissionRequest(request);
  }

  resetPermissionStats(): void {
    const orchestrator = this.getCurrentOrchestrator();
    orchestrator.resetPermissionStats();
  }

  shouldAutoApprove(toolName: string, tier?: string): boolean {
    const orchestrator = this.getCurrentOrchestrator();
    return orchestrator.shouldAutoApprove(toolName, tier);
  }

  /**
   * Handle unified permission request that works for both providers
   */
  async handleUnifiedPermissionRequest(request: UnifiedPermissionRequest): Promise<UnifiedPermissionResponse> {
    this.ensureInitialized();
    
    const currentProvider = this.getCurrentProvider();
    
    this.logInfo('Processing unified permission request', {
      provider: currentProvider,
      toolName: request.toolName || request.tool || request.name,
      toolUseId: request.toolUseId
    });

    switch (currentProvider) {
      case ProviderType.CLAUDE:
        return this.handleClaudePermissionRequest(request);
      
      case ProviderType.GEMINI:
        return this.handleGeminiPermissionRequest(request);
      
      default:
        throw new Error(`Unsupported provider: ${currentProvider}`);
    }
  }

  /**
   * Handle Claude-specific permission request
   */
  private async handleClaudePermissionRequest(request: UnifiedPermissionRequest): Promise<UnifiedPermissionResponse> {
    const claudeRequest = {
      tool: request.tool || request.toolName || request.name || 'unknown',
      toolName: request.toolName || request.tool || request.name || 'unknown',
      args: request.args as any,
      toolUseId: request.toolUseId,
      tier: request.tier || 'cautious',
      content: request.content,
      timestamp: request.timestamp,
      description: request.description
    };

    const response = await this.claudeOrchestrator.handlePermissionRequest(claudeRequest);
    
    return {
      approved: response.approved,
      reason: response.reason,
      autoApprove: response.autoApprove,
      timestamp: response.timestamp
    };
  }

  /**
   * Handle Gemini-specific permission request
   */
  private async handleGeminiPermissionRequest(request: UnifiedPermissionRequest): Promise<UnifiedPermissionResponse> {
    const geminiRequest = {
      toolName: request.toolName || request.name || 'unknown',
      args: request.args as any,
      toolUseId: request.toolUseId,
      tier: request.tier || request.permissionTier || 'cautious',
      timestamp: request.timestamp,
      description: request.description || `Execute ${request.toolName || request.name} with provided arguments`
    };

    const response = await this.geminiOrchestrator.handlePermissionRequest(geminiRequest);
    
    return {
      approved: response.approved,
      reason: response.reason,
      autoApprove: response.autoApprove || false,
      timestamp: response.timestamp,
      outcome: response.outcome
    };
  }

  /**
   * Setup permission callbacks for specific providers
   */
  setupProviderCallbacks(): void {
    // Setup Gemini permission callback
    this.geminiOrchestrator.setPermissionCallback(async (request) => {
      return new Promise((resolve) => {
        const unifiedRequest: UnifiedPermissionRequest = {
          toolName: request.toolName,
          name: request.toolName,
          args: request.args,
          toolUseId: request.toolUseId,
          tier: request.tier,
          description: request.description,
          timestamp: request.timestamp
        };

        this.pendingPermission = {
          request: unifiedRequest,
          provider: ProviderType.GEMINI,
          timestamp: new Date(),
          resolve: (response: UnifiedPermissionResponse) => {
            this.pendingPermission = null;
            resolve({
              approved: response.approved,
              reason: response.reason,
              autoApprove: response.autoApprove || false,
              timestamp: response.timestamp,
              outcome: (response.outcome as any) || (response.approved ? 'proceed_once' : 'cancel'),
              toolUseId: request.toolUseId
            });
          }
        };

        // Trigger UI permission prompt through event system
        this.notifyPendingPermission();
      });
    });
  }

  /**
   * Handle permission response from UI
   */
  async handlePermissionResponse(response: UnifiedPermissionResponse): Promise<void> {
    if (!this.pendingPermission) {
      this.logWarn('Received permission response but no pending permission');
      return;
    }

    const currentProvider = this.pendingPermission.provider;
    
    this.logInfo('Handling permission response', {
      provider: currentProvider,
      approved: response.approved,
      autoApprove: response.autoApprove
    });

    try {
      switch (currentProvider) {
        case ProviderType.CLAUDE:
          await this.claudeOrchestrator.handleUserResponse({
            approved: response.approved,
            reason: response.reason,
            autoApprove: response.autoApprove || false,
            toolUseId: this.pendingPermission.request.toolUseId,
            timestamp: response.timestamp
          });
          break;
        
        case ProviderType.GEMINI:
          // Gemini handles responses through the callback resolution
          this.pendingPermission.resolve(response);
          break;
      }
    } catch (error) {
      this.logError('Failed to handle permission response', { error });
      throw error;
    }
  }

  /**
   * Get current pending permission
   */
  getPendingPermission(): PendingPermission | null {
    return this.pendingPermission;
  }

  /**
   * Check if there's a pending permission request
   */
  hasPendingPermission(): boolean {
    return this.pendingPermission !== null;
  }

  /**
   * Notify about pending permission by emitting event to trigger UI
   */
  private async notifyPendingPermission(): Promise<void> {
    if (!this.pendingPermission) {
      this.logWarn('No pending permission to notify about');
      return;
    }

    const request = this.pendingPermission.request;
    const sessionInfo = await this.sessionManager.getCurrentSessionInfo();
    
    // Create event data in the format expected by the UI
    const eventData: IPermissionRequestData = {
      toolName: request.toolName || request.name || 'unknown',
      toolUseId: request.toolUseId,
      args: request.args as Record<string, unknown>,
      tier: request.tier,
      description: request.description,
      timestamp: request.timestamp,
      context: {
        provider: this.pendingPermission.provider.toLowerCase(),
        sessionId: sessionInfo?.tag || 'unknown',
        messageId: request.toolUseId
      }
    };

    // Emit the permission request event to trigger UI
    this.appEventBusService.emitPermissionRequest(eventData);
    this.logInfo('Permission request event emitted', { 
      toolName: eventData.toolName, 
      provider: eventData.context?.provider 
    });
  }

  /**
   * Provider-specific orchestrator access (for advanced use cases)
   */
  getClaudeOrchestrator(): ClaudePermissionOrchestrator {
    return this.claudeOrchestrator;
  }

  getGeminiOrchestrator(): GeminiPermissionOrchestrator {
    return this.geminiOrchestrator;
  }
}