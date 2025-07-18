/**
 * Model type definitions to replace hardcoded model names
 */

import { ModelConfigManager } from './model-config.js';
import { ProviderType } from './types.js';

/**
 * Dynamic model type based on configuration
 * This replaces hardcoded 'sonnet' | 'opus' unions
 */
export type ModelName = string;


/**
 * Model service interface using dynamic model names
 */
export interface IFlexibleModelService {
  getCurrentModel(): ModelName;
  switchModel(model: ModelName): Promise<void>;
  getAvailableModels(): ModelName[];
  isValidModel(model: ModelName): boolean;
  getModelId(model: ModelName): string | undefined;
}