/**
 * Gemini Quota Service Interface
 * Defines the contract for quota detection, management, and flash fallback logic
 */

import { IProviderService } from '../core/IProviderService.js';

export interface GeminiQuotaCallbacks {
  onFlashFallback?: (currentModel: string, fallbackModel: string, error?: unknown) => Promise<boolean>;
}

export interface IGeminiQuotaService extends IProviderService {
  /**
   * Check if error is specifically Pro quota exceeded
   */
  isProQuotaExceededError(error: unknown): boolean;

  /**
   * Check if error is any type of quota exceeded error
   */
  isGenericQuotaExceededError(error: unknown): boolean;

  /**
   * Handle quota exceeded errors and attempt flash fallback
   */
  handleQuotaExceededError(
    error: Error | unknown,
    callbacks: GeminiQuotaCallbacks,
    currentModel: string
  ): Promise<boolean>;

  /**
   * Check if current error indicates quota exhaustion
   */
  isQuotaError(error: unknown): boolean;

  /**
   * Get suggested fallback model for quota errors
   */
  getSuggestedFallbackModel(currentModel: string): string;

  /**
   * Log quota error details for debugging
   */
  logQuotaErrorDetails(error: unknown, context?: string): void;
}