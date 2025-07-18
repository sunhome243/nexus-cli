/**
 * Provider abstraction types to replace hardcoded provider names
 */

/**
 * Enum for all supported providers
 * This replaces hardcoded 'claude' | 'gemini' unions throughout the codebase
 */
export enum ProviderType {
  CLAUDE = 'claude',
  GEMINI = 'gemini'
}

/**
 * Permission modes enum to replace magic strings
 */
export enum PermissionMode {
  DEFAULT = 'default',
  CAUTIOUS = 'cautious',
  YOLO = 'yolo',
  PLAN = 'plan',
  ACCEPT_EDITS = 'acceptEdits',
  BYPASS_PERMISSIONS = 'bypassPermissions'
}

/**
 * Model configuration interface
 */
export interface IModelConfig {
  id: string;
  name: string;
  tier: 'standard' | 'advanced' | 'fast';
  maxTokens?: number;
  supportedFeatures?: string[];
}

/**
 * Provider plugin interface for extensibility
 */
export interface IProviderPlugin {
  type: ProviderType | string;
  name: string;
  models: Record<string, IModelConfig>;
  capabilities: {
    streaming: boolean;
    tools: boolean;
    permissions: boolean;
    multimodal?: boolean;
  };
  initialize(): Promise<any>;
}

/**
 * Provider registry interface
 */
export interface IProviderRegistry {
  register(plugin: IProviderPlugin): void;
  getProvider(type: ProviderType | string): IProviderPlugin | undefined;
  getAvailableProviders(): (ProviderType | string)[];
  isProviderRegistered(type: ProviderType | string): boolean;
}

/**
 * Type guard to check if a string is a valid ProviderType
 */
export function isValidProviderType(value: string): value is ProviderType {
  return Object.values(ProviderType).includes(value as ProviderType);
}

/**
 * Type guard to check if a string is a valid PermissionMode
 */
export function isValidPermissionMode(value: string): value is PermissionMode {
  return Object.values(PermissionMode).includes(value as PermissionMode);
}