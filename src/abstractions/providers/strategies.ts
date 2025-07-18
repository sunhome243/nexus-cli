import { ProviderType } from './types.js';

/**
 * Strategy interfaces to replace provider-specific conditional logic
 */

// Type definitions for strategy contexts and parameters
export interface ProviderContext {
  provider: ProviderType | string;
  sessionId?: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface SyncSessionData {
  sessionId: string;
  messages: unknown[];
  metadata: Record<string, unknown>;
  lastSync?: Date;
  provider: ProviderType | string;
}

export interface SyncData {
  source: SyncSessionData;
  target: SyncSessionData;
  operations: unknown[];
}

export interface ToolExecutionParams {
  toolName: string;
  args: Record<string, unknown>;
  context?: ProviderContext;
  timeout?: number;
}

export interface ToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface SessionConfig {
  sessionId: string;
  provider: ProviderType | string;
  settings: Record<string, unknown>;
  credentials?: Record<string, unknown>;
}

export interface SessionResult {
  sessionId: string;
  initialized: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface PermissionContext {
  mode: string;
  toolName?: string;
  sessionId?: string;
  provider?: ProviderType | string;
}

export interface PermissionResult {
  allowed: boolean;
  mode: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Base strategy interface for provider-specific operations
 */
export interface IProviderStrategy {
  providerType: ProviderType | string;
  execute(context: ProviderContext): Promise<unknown>;
}

/**
 * Sync strategy for handling provider-specific sync logic
 */
export interface ISyncStrategy extends IProviderStrategy {
  getSyncDirection(fromProvider: string, toProvider: string): string;
  prepareForSync(sessionData: SyncSessionData): SyncData;
  performSync(data: SyncData): Promise<SyncSessionData>;
}

/**
 * Model switching strategy
 */
export interface IModelStrategy extends IProviderStrategy {
  validateModel(modelName: string): boolean;
  switchModel(modelName: string): Promise<void>;
  getCurrentModel(): string;
  getAvailableModels(): string[];
}

/**
 * Tool execution strategy
 */
export interface IToolStrategy extends IProviderStrategy {
  canExecuteTool(toolName: string): boolean;
  executeTool(toolName: string, params: ToolExecutionParams): Promise<ToolExecutionResult>;
  getToolCapabilities(): string[];
}

/**
 * Session initialization strategy
 */
export interface ISessionStrategy extends IProviderStrategy {
  initializeSession(config: SessionConfig): Promise<SessionResult>;
  validateSession(sessionId: string): boolean;
  cleanupSession(sessionId: string): Promise<void>;
}

/**
 * Permission handling strategy
 */
export interface IPermissionStrategy extends IProviderStrategy {
  getDefaultPermissionMode(): string;
  validatePermissionMode(mode: string): boolean;
  applyPermissions(mode: string, context: PermissionContext): PermissionResult;
}

/**
 * Abstract base class for provider strategies
 */
export abstract class BaseProviderStrategy implements IProviderStrategy {
  constructor(public readonly providerType: ProviderType | string) {}

  abstract execute(context: ProviderContext): Promise<unknown>;

  /**
   * Helper method to check if this strategy handles a specific provider
   */
  handlesProvider(provider: string): boolean {
    return this.providerType === provider || 
           this.providerType.toLowerCase() === provider.toLowerCase();
  }
}

/**
 * Strategy factory interface
 */
export interface IStrategyFactory {
  createSyncStrategy(provider: ProviderType | string): ISyncStrategy;
  createModelStrategy(provider: ProviderType | string): IModelStrategy;
  createToolStrategy(provider: ProviderType | string): IToolStrategy;
  createSessionStrategy(provider: ProviderType | string): ISessionStrategy;
  createPermissionStrategy(provider: ProviderType | string): IPermissionStrategy;
}

/**
 * Strategy registry for managing provider-specific strategies
 */
export class StrategyRegistry {
  private strategies: Map<string, Map<string, IProviderStrategy>> = new Map();

  /**
   * Register a strategy for a provider and strategy type
   */
  register(provider: string, strategyType: string, strategy: IProviderStrategy): void {
    if (!this.strategies.has(provider)) {
      this.strategies.set(provider, new Map());
    }
    this.strategies.get(provider)!.set(strategyType, strategy);
  }

  /**
   * Get a strategy for a provider and strategy type
   */
  getStrategy<T extends IProviderStrategy>(
    provider: string, 
    strategyType: string
  ): T | undefined {
    return this.strategies.get(provider)?.get(strategyType) as T;
  }

  /**
   * Check if a strategy exists
   */
  hasStrategy(provider: string, strategyType: string): boolean {
    return !!this.strategies.get(provider)?.has(strategyType);
  }
}