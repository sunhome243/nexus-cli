/**
 * Gemini Quota Service
 * Handles quota detection, management, and flash fallback logic
 * Extracted from GeminiCoreAdapter to reduce complexity
 */

import { injectable, inject } from "inversify";
import { TYPES } from "../../../../infrastructure/di/types.js";
import { ILoggerService } from "../../../../interfaces/core/ILoggerService.js";
import { BaseProvider } from "../../shared/BaseProvider.js";

// Error interfaces for proper typing
export interface GaxiosErrorResponse {
  response?: {
    status?: number;
    data?: unknown;
  };
  status?: number;
  message?: string;
}

export interface StructuredError {
  message: string;
  status?: number;
  response?: {
    status?: number;
    data?: unknown;
  };
}

export interface GeminiErrorData {
  error?: {
    message?: string;
  };
}

export interface GeminiQuotaCallbacks {
  onFlashFallback?: (currentModel: string, fallbackModel: string, error?: unknown) => Promise<boolean>;
}

@injectable()
export class GeminiQuotaService extends BaseProvider {
  constructor(@inject(TYPES.LoggerService) logger: ILoggerService) {
    super();
    this.setLogger(logger);
  }

  async initialize(): Promise<void> {
    this.setInitialized(true);
    this.logInfo("Gemini Quota Service initialized");
  }

  async cleanup(): Promise<void> {
    this.setInitialized(false);
    this.logInfo("Gemini Quota Service cleaned up");
  }

  /**
   * Check if error is specifically Pro quota exceeded
   */
  isProQuotaExceededError(error: unknown): boolean {
    const checkMessage = (message: string): boolean => {
      return (
        message.includes("Quota exceeded for quota metric 'Gemini") &&
        (message.includes("2.5 Pro Requests") || message.includes("Pro Requests"))
      );
    };

    if (typeof error === "string") {
      return checkMessage(error);
    }

    // Check for structured error
    if (error && typeof error === "object" && "message" in error) {
      const structuredError = error as StructuredError;
      return checkMessage(structuredError.message);
    }

    // Check for Gaxios error with response data
    if (error && typeof error === "object" && "response" in error) {
      const gaxiosError = error as GaxiosErrorResponse;
      if (gaxiosError.response?.data) {
        if (typeof gaxiosError.response.data === "string") {
          return checkMessage(gaxiosError.response.data);
        }
        // Handle array format like [{"error": {...}}]
        if (Array.isArray(gaxiosError.response.data)) {
          const firstItem = gaxiosError.response.data[0];
          if (firstItem?.error?.message) {
            return checkMessage(firstItem.error.message);
          }
        }
        // Handle object format
        const dataObj = gaxiosError.response.data as GeminiErrorData;
        if (dataObj.error?.message) {
          return checkMessage(dataObj.error.message);
        }
      }
    }

    return false;
  }

  /**
   * Check if error is any type of quota exceeded error
   */
  isGenericQuotaExceededError(error: unknown): boolean {
    const checkCorePattern = (message: string): boolean => {
      return message.includes("Quota exceeded for quota metric");
    };

    const checkMessage = (message: string): boolean => {
      return (
        checkCorePattern(message) ||
        message.includes("Resource has been exhausted") ||
        message.includes("RESOURCE_EXHAUSTED") ||
        (message.includes("429") && message.includes("quota"))
      );
    };

    if (typeof error === "string") {
      return checkMessage(error);
    }

    // Check status code for 429 errors
    if (error && typeof error === "object") {
      const errorObj = error as GaxiosErrorResponse;
      if (errorObj.status === 429 || errorObj.response?.status === 429) {
        return true;
      }

      if (errorObj.message) {
        return checkMessage(errorObj.message);
      }

      // Check Gaxios response data
      if (errorObj.response?.data) {
        if (typeof errorObj.response.data === "string") {
          return checkMessage(errorObj.response.data);
        }
        if (Array.isArray(errorObj.response.data)) {
          const firstItem = errorObj.response.data[0];
          if (firstItem?.error?.message) {
            return checkMessage(firstItem.error.message);
          }
        }
        const dataObj = errorObj.response.data as GeminiErrorData;
        if (dataObj.error?.message) {
          return checkMessage(dataObj.error.message);
        }
      }
    }

    return false;
  }

  /**
   * Handle quota exceeded errors and attempt flash fallback
   */
  async handleQuotaExceededError(
    error: unknown,
    callbacks: GeminiQuotaCallbacks,
    currentModel: string
  ): Promise<boolean> {
    this.ensureInitialized();

    const isProQuotaError = this.isProQuotaExceededError(error);
    const isGenericQuotaError = this.isGenericQuotaExceededError(error);

    if (!isProQuotaError && !isGenericQuotaError) {
      return false; // Not a quota error
    }

    this.logWarn(`Quota exceeded error detected for model: ${currentModel}`);

    // Only attempt flash fallback if we have the callback and it's a Pro quota error
    if (isProQuotaError && callbacks.onFlashFallback) {
      try {
        const fallbackModel = "gemini-2.5-flash";
        this.logInfo(`Attempting flash fallback from ${currentModel} to ${fallbackModel}`);

        const shouldFallback = await callbacks.onFlashFallback(currentModel, fallbackModel, error);

        if (shouldFallback) {
          this.logInfo(`Flash fallback approved for ${currentModel} -> ${fallbackModel}`);
          return true;
        } else {
          this.logInfo(`Flash fallback rejected by user for ${currentModel} -> ${fallbackModel}`);
        }
      } catch (fallbackError) {
        this.logError("Error during flash fallback handling", fallbackError);
      }
    }

    return false; // Quota error but no fallback performed
  }

  /**
   * Check if current error indicates quota exhaustion
   */
  isQuotaError(error: unknown): boolean {
    return this.isProQuotaExceededError(error) || this.isGenericQuotaExceededError(error);
  }

  /**
   * Get suggested fallback model for quota errors
   */
  getSuggestedFallbackModel(currentModel: string): string {
    // For Pro models, suggest Flash
    if (currentModel.includes("pro")) {
      return "gemini-2.5-flash";
    }

    // For other models, fallback to basic Flash
    return "gemini-2.5-flash";
  }

  /**
   * Log quota error details for debugging
   */
  logQuotaErrorDetails(error: unknown, context?: string): void {
    const isProQuota = this.isProQuotaExceededError(error);
    const isGenericQuota = this.isGenericQuotaExceededError(error);

    if (isProQuota || isGenericQuota) {
      const errorType = isProQuota ? "Pro Quota" : "Generic Quota";
      const contextStr = context ? ` in ${context}` : "";

      this.logWarn(`${errorType} exceeded error detected${contextStr}`, {
        error: error instanceof Error ? error.message : String(error),
        isProQuota,
        isGenericQuota,
      });
    }
  }
}
