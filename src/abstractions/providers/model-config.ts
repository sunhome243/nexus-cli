import { injectable, optional, inject } from "inversify";
import { IModelConfig, ProviderType } from "./types.js";

/**
 * Model configuration to replace hardcoded model names and IDs
 * This allows adding new models without code changes
 */
export interface IProviderModels {
  [key: string]: {
    models: Record<string, IModelConfig>;
    defaultModel: string;
  };
}

/**
 * Interface for Model Configuration Manager
 */
export interface IModelConfigManager {
  getProviderModels(provider: ProviderType | string): Record<string, IModelConfig>;
  getModel(provider: ProviderType | string, modelName: string): IModelConfig | undefined;
  getModelId(provider: ProviderType | string, modelName: string): string | undefined;
  getDefaultModel(provider: ProviderType | string): string;
  isValidModel(provider: ProviderType | string, modelName: string): boolean;
  getModelNames(provider: ProviderType | string): string[];
  setModel(provider: ProviderType | string, modelName: string, config: IModelConfig): void;
  loadFromJson(json: string): void;
  toJson(): string;
}

/**
 * Default model configurations
 * Can be overridden by external configuration
 */
export const DEFAULT_MODEL_CONFIG: IProviderModels = {
  [ProviderType.CLAUDE]: {
    models: {
      "sonnet-4": {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        tier: "standard",
        maxTokens: 200000,
        supportedFeatures: ["tools", "vision", "streaming", "reasoning", "hybrid-reasoning"],
      },
      "opus-4": {
        id: "claude-opus-4-20250514",
        name: "Claude Opus 4",
        tier: "advanced",
        maxTokens: 200000,
        supportedFeatures: ["tools", "vision", "streaming", "reasoning", "hybrid-reasoning", "long-running-tasks"],
      },
      sonnet: {
        id: "claude-4-sonnet",
        name: "Claude 4 Sonnet",
        tier: "standard",
        maxTokens: 200000,
        supportedFeatures: ["tools", "vision", "streaming"],
      },
      opus: {
        id: "claude-4-opus",
        name: "Claude 3 Opus",
        tier: "advanced",
        maxTokens: 200000,
        supportedFeatures: ["tools", "vision", "streaming"],
      },
    },
    defaultModel: "sonnet",
  },
  [ProviderType.GEMINI]: {
    models: {
      "pro-2.5": {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        tier: "advanced",
        maxTokens: 1048576,
        supportedFeatures: ["tools", "vision", "streaming", "multimodal", "thinking", "reasoning"],
      },
      "flash-2.5": {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        tier: "standard",
        maxTokens: 1048576,
        supportedFeatures: ["tools", "vision", "streaming", "multimodal", "thinking", "reasoning", "agentic"],
      },
      pro: {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        tier: "standard",
        maxTokens: 1048576,
        supportedFeatures: ["tools", "vision", "streaming", "multimodal"],
      },
      flash: {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        tier: "fast",
        maxTokens: 1048576,
        supportedFeatures: ["tools", "vision", "streaming", "multimodal"],
      },
    },
    defaultModel: "pro-2.5",
  },
};

/**
 * Model configuration manager
 */
@injectable()
export class ModelConfigManager implements IModelConfigManager {
  private config: IProviderModels;

  constructor(@optional() @inject("CustomModelConfig") customConfig?: IProviderModels) {
    this.config = customConfig || DEFAULT_MODEL_CONFIG;
  }

  /**
   * Get models for a specific provider
   */
  getProviderModels(provider: ProviderType | string): Record<string, IModelConfig> {
    return this.config[provider]?.models || {};
  }

  /**
   * Get a specific model configuration
   */
  getModel(provider: ProviderType | string, modelName: string): IModelConfig | undefined {
    return this.config[provider]?.models[modelName];
  }

  /**
   * Get model ID by name
   */
  getModelId(provider: ProviderType | string, modelName: string): string | undefined {
    return this.getModel(provider, modelName)?.id;
  }

  /**
   * Get default model for a provider
   */
  getDefaultModel(provider: ProviderType | string): string {
    return this.config[provider]?.defaultModel || "";
  }

  /**
   * Check if a model is valid for a provider
   */
  isValidModel(provider: ProviderType | string, modelName: string): boolean {
    return !!this.getModel(provider, modelName);
  }

  /**
   * Get all model names for a provider
   */
  getModelNames(provider: ProviderType | string): string[] {
    return Object.keys(this.getProviderModels(provider));
  }

  /**
   * Add or update a model configuration
   */
  setModel(provider: ProviderType | string, modelName: string, config: IModelConfig): void {
    if (!this.config[provider]) {
      this.config[provider] = { models: {}, defaultModel: modelName };
    }
    this.config[provider].models[modelName] = config;
  }

  /**
   * Load configuration from JSON
   */
  loadFromJson(json: string): void {
    try {
      const parsed = JSON.parse(json);
      this.config = parsed;
    } catch (error) {
      throw new Error(`Failed to load model configuration: ${error}`);
    }
  }

  /**
   * Export configuration to JSON
   */
  toJson(): string {
    return JSON.stringify(this.config, null, 2);
  }
}
