/**
 * Gemini Model Service Interface
 * Defines the contract for Gemini model management
 */

import { IProviderService } from '../core/IProviderService.js';
import { Config } from "@google/gemini-cli-core";

export interface ModelInfo {
  name: string;
  isUsingFallback: boolean;
  hasQuotaError: boolean;
  fallbackReason?: string;
}

export interface ModelCapabilities {
  maxTokens: number;
  supportsStreaming: boolean;
  supportsToolUse: boolean;
  supportsThinking: boolean;
  supportsMultimodal: boolean;
  supportedLanguages: string[];
  contextWindow: number;
  features: {
    functionCalling: boolean;
    codeExecution: boolean;
    webSearch: boolean;
    fileAnalysis: boolean;
  };
  limitations?: {
    rateLimit?: number;
    dailyLimit?: number;
    concurrentRequests?: number;
  };
}

export interface ModelPerformance {
  averageLatency: number;
  tokensPerSecond: number;
  successRate: number;
  errorRate: number;
  uptime: number;
  reliability: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
  costs: {
    inputTokenCost: number;
    outputTokenCost: number;
    currency: string;
  };
  benchmarks?: {
    accuracy: number;
    speed: number;
    qualityScore: number;
  };
}

export interface FlashFallbackHandler {
  (currentModel: string, fallbackModel: string, error?: unknown): Promise<boolean>;
}

export interface IGeminiModelService extends IProviderService {
  /**
   * Set config
   */
  setConfig(config: Config): void;

  /**
   * Get current model info
   */
  getCurrentModelInfo(): ModelInfo;

  /**
   * Set current model
   */
  setCurrentModel(model: string, reason?: string): void;

  /**
   * Get current model
   */
  getCurrentModel(): string;

  /**
   * Check if currently using fallback
   */
  isCurrentlyUsingFallback(): boolean;

  /**
   * Check if has current quota error
   */
  hasCurrentQuotaError(): boolean;

  /**
   * Set quota error
   */
  setQuotaError(hasError: boolean, reason?: string): void;

  /**
   * Setup flash fallback handler
   */
  setupFlashFallbackHandler(handler: FlashFallbackHandler): void;

  /**
   * Get default model
   */
  getDefaultModel(): string;

  /**
   * Get default flash model
   */
  getDefaultFlashModel(): string;

  /**
   * Get available models
   */
  getAvailableModels(): string[];

  /**
   * Check if model is Pro model
   */
  isProModel(model: string): boolean;

  /**
   * Check if model is Flash model
   */
  isFlashModel(model: string): boolean;

  /**
   * Get recommended fallback
   */
  getRecommendedFallback(model: string): string;

  /**
   * Check if model is valid
   */
  isValidModel(model: string): boolean;

  /**
   * Reset model state
   */
  resetModelState(): void;

  /**
   * Get model capabilities
   */
  getModelCapabilities(model: string): ModelCapabilities;

  /**
   * Get model performance
   */
  getModelPerformance(model: string): ModelPerformance;

  /**
   * Get formatted model status
   */
  getFormattedModelStatus(): string;
}