/**
 * Gemini Model Service - Model configuration and fallback management
 *
 * @class GeminiModelService
 * @extends {BaseProvider}
 * @description Handles model selection, configuration, and fallback logic for Gemini AI.
 * Extracted from GeminiCoreAdapter to reduce complexity and improve model management.
 */

import { injectable, inject } from "inversify";
import { TYPES } from "../../../../infrastructure/di/types.js";
import { ILoggerService } from "../../../../interfaces/core/ILoggerService.js";
import { BaseProvider } from "../../shared/BaseProvider.js";
import { ModelCapabilities, ModelPerformance } from "../../../../interfaces/providers/IGeminiModelService.js";
import { Config, DEFAULT_GEMINI_MODEL, DEFAULT_GEMINI_FLASH_MODEL } from "@google/gemini-cli-core";

/**
 * Model information interface
 */
export interface ModelInfo {
  name: string;
  isUsingFallback: boolean;
  hasQuotaError: boolean;
  fallbackReason?: string;
}

/**
 * Flash fallback handler function interface
 */
export interface FlashFallbackHandler {
  (currentModel: string, fallbackModel: string, error?: unknown): Promise<boolean>;
}

/**
 * Gemini Model Service implementation
 *
 * @class GeminiModelService
 * @extends {BaseProvider}
 * @description Manages Gemini model selection, fallback mechanisms, and model configuration.
 * Provides intelligent model switching and quota error handling.
 */
@injectable()
export class GeminiModelService extends BaseProvider {
  private currentModel: string = DEFAULT_GEMINI_MODEL;
  private isUsingFallback: boolean = false;
  private hasQuotaError: boolean = false;
  private fallbackReason?: string;
  private config: Config | null = null;

  constructor(@inject(TYPES.LoggerService) logger: ILoggerService) {
    super();
    this.setLogger(logger);
  }

  async initialize(): Promise<void> {
    this.setInitialized(true);
    this.logInfo("Gemini Model Service initialized");
  }

  async cleanup(): Promise<void> {
    this.config = null;
    this.resetModelState();
    this.setInitialized(false);
    this.logInfo("Gemini Model Service cleaned up");
  }

  /**
   * Set the configuration instance
   */
  setConfig(config: Config): void {
    this.config = config;
    this.logInfo("Config set in GeminiModelService", {
      hasConfig: !!config,
      configType: config ? config.constructor.name : "null",
    });
  }

  /**
   * Get current model information
   */
  getCurrentModelInfo(): ModelInfo {
    const modelInfo = {
      name: this.currentModel,
      isUsingFallback: this.isUsingFallback,
      hasQuotaError: this.hasQuotaError,
      fallbackReason: this.fallbackReason,
    };

    // Don't log on every call - this is called frequently by UI polling
    // Only log when there are actual changes (in setCurrentModel, setQuotaError, etc.)
    return modelInfo;
  }

  /**
   * Set current model
   */
  setCurrentModel(model: string, reason?: string): void {
    this.ensureInitialized();

    const previousModel = this.currentModel;
    this.currentModel = model;

    if (reason) {
      this.fallbackReason = reason;
      this.isUsingFallback = true;
    }

    this.logInfo(`Model changed: ${previousModel} -> ${model}`, {
      reason,
      isUsingFallback: this.isUsingFallback,
      currentModel: this.currentModel,
      modelInfo: this.getCurrentModelInfo(),
    });
  }

  /**
   * Get current model name
   */
  getCurrentModel(): string {
    return this.currentModel;
  }

  /**
   * Check if currently using fallback model
   */
  isCurrentlyUsingFallback(): boolean {
    return this.isUsingFallback;
  }

  /**
   * Check if there's a quota error
   */
  hasCurrentQuotaError(): boolean {
    return this.hasQuotaError;
  }

  /**
   * Set quota error state
   */
  setQuotaError(hasError: boolean, reason?: string): void {
    this.hasQuotaError = hasError;
    if (hasError && reason) {
      this.fallbackReason = reason;
    }

    this.logInfo(`Quota error state: ${hasError}`, { reason });
  }

  /**
   * Setup flash fallback handler on config
   */
  setupFlashFallbackHandler(handler: FlashFallbackHandler): void {
    this.ensureInitialized();

    if (!this.config) {
      this.logError("Cannot setup flash fallback handler: Config not set", {
        hasConfig: !!this.config,
        configType: this.config ? typeof this.config : "null",
      });
      throw new Error("Config not set - ensure setConfig() is called before setupFlashFallbackHandler()");
    }

    // Runtime type checking to ensure the method exists
    if (typeof this.config.setFlashFallbackHandler !== "function") {
      this.logError("Config missing setFlashFallbackHandler method", {
        configType: typeof this.config,
        configConstructor: this.config?.constructor?.name,
        availableMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(this.config || {}))
          .filter((name) => typeof (this.config as any)[name] === "function")
          .slice(0, 10), // Show first 10 methods for debugging
      });
      throw new Error("Config instance does not have setFlashFallbackHandler method - possible version mismatch");
    }

    try {
      this.config.setFlashFallbackHandler(async (currentModel: string, fallbackModel: string, error?: unknown) => {
        this.logInfo(`Flash fallback triggered: ${currentModel} -> ${fallbackModel}`);

        try {
          const shouldFallback = await handler(currentModel, fallbackModel, error);

          if (shouldFallback) {
            this.setCurrentModel(fallbackModel, `Fallback from ${currentModel} due to quota/error`);
            this.setQuotaError(true, `Fallback from ${currentModel}`);
          }

          return shouldFallback;
        } catch (handlerError) {
          this.logError("Flash fallback handler error", handlerError);
          return false;
        }
      });

      this.logInfo("Flash fallback handler configured successfully");
    } catch (error) {
      this.logError("Failed to setup flash fallback handler", error);
      throw new Error(
        `Failed to setup flash fallback handler: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get default model for provider
   */
  getDefaultModel(): string {
    return DEFAULT_GEMINI_MODEL;
  }

  /**
   * Get default flash model for fallback
   */
  getDefaultFlashModel(): string {
    return DEFAULT_GEMINI_FLASH_MODEL;
  }

  /**
   * Get available models list
   */
  getAvailableModels(): string[] {
    return [
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.0-flash-exp",
      "gemini-2.5-pro-latest",
      "gemini-2.5-flash-latest",
    ];
  }

  /**
   * Check if model is a Pro model
   */
  isProModel(model: string): boolean {
    return model.toLowerCase().includes("pro");
  }

  /**
   * Check if model is a Flash model
   */
  isFlashModel(model: string): boolean {
    return model.toLowerCase().includes("flash");
  }

  /**
   * Get recommended fallback model for given model
   */
  getRecommendedFallback(model: string): string {
    if (this.isProModel(model)) {
      return this.getDefaultFlashModel();
    }

    // For Flash models, fallback to basic Flash
    return "gemini-2.5-flash";
  }

  /**
   * Validate model name
   */
  isValidModel(model: string): boolean {
    const availableModels = this.getAvailableModels();
    return availableModels.includes(model);
  }

  /**
   * Reset model state to defaults
   */
  resetModelState(): void {
    this.currentModel = DEFAULT_GEMINI_MODEL;
    this.isUsingFallback = false;
    this.hasQuotaError = false;
    this.fallbackReason = undefined;

    this.logDebug("Model state reset to defaults");
  }

  /**
   * Get model capabilities info
   */
  getModelCapabilities(model: string): ModelCapabilities {
    const isProModel = this.isProModel(model);

    return {
      maxTokens: isProModel ? 1000000 : 1000000, // Both support 1M context
      supportsStreaming: true,
      supportsToolUse: true,
      supportsThinking: true,
      supportsMultimodal: true,
      supportedLanguages: ["en", "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "zh"],
      contextWindow: 1000000,
      features: {
        functionCalling: true,
        codeExecution: true,
        webSearch: false,
        fileAnalysis: true,
      },
      limitations: {
        rateLimit: isProModel ? 100 : 50,
        dailyLimit: isProModel ? 10000 : 5000,
        concurrentRequests: isProModel ? 10 : 5,
      },
    };
  }

  /**
   * Get model performance characteristics
   */
  getModelPerformance(model: string): ModelPerformance {
    const isProModel = this.isProModel(model);
    const isFlashModel = this.isFlashModel(model);

    return {
      averageLatency: isFlashModel ? 500 : 1500, // ms
      tokensPerSecond: isFlashModel ? 100 : 50,
      successRate: 0.98,
      errorRate: 0.02,
      uptime: 0.995,
      reliability: {
        last24h: 0.995,
        last7d: 0.993,
        last30d: 0.99,
      },
      costs: {
        inputTokenCost: isProModel ? 0.00125 : 0.00015,
        outputTokenCost: isProModel ? 0.005 : 0.0006,
        currency: "USD",
      },
      benchmarks: {
        accuracy: isProModel ? 0.95 : 0.85,
        speed: isFlashModel ? 0.9 : 0.6,
        qualityScore: isProModel ? 0.92 : 0.78,
      },
    };
  }

  /**
   * Get formatted model status for display
   */
  getFormattedModelStatus(): string {
    const info = this.getCurrentModelInfo();
    let status = `Model: ${info.name}`;

    if (info.isUsingFallback) {
      status += ` (fallback)`;
    }

    if (info.hasQuotaError) {
      status += ` [quota error]`;
    }

    if (info.fallbackReason) {
      status += ` - ${info.fallbackReason}`;
    }

    return status;
  }
}
