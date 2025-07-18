/**
 * Unified Error Handler Service - Comprehensive error handling and recovery system
 * 
 * @class ErrorHandlerService
 * @extends {BaseProvider}
 * @implements {IErrorHandlerService}
 * @description Provides consistent error handling across all provider implementations.
 * Features automatic retry logic, error categorization, user-friendly messaging, and recovery mechanisms.
 */

import { injectable, inject } from "inversify";
import { TYPES } from "../../../infrastructure/di/types.js";
import { ILoggerService } from "../../../interfaces/core/ILoggerService.js";
import { BaseProvider } from "./BaseProvider.js";
import { IErrorHandlerService, ErrorContext, ErrorCategory, RetryOptions, ErrorCallbacks } from "../../../interfaces/core/IProviderService.js";

/**
 * Error Handler Service implementation
 * 
 * @class ErrorHandlerService
 * @extends {BaseProvider}
 * @implements {IErrorHandlerService}
 * @description Centralized error handling with intelligent retry strategies and error categorization.
 */
@injectable()
export class ErrorHandlerService extends BaseProvider implements IErrorHandlerService {
  private readonly defaultRetryOptions: RetryOptions = {
    maxAttempts: 3,
    delayMs: 1000,
    exponentialBackoff: true,
    retryableErrors: [
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNREFUSED',
      '500',
      '502',
      '503',
      '504',
      'Rate limit',
      'timeout'
    ]
  };

  constructor(@inject(TYPES.LoggerService) logger: ILoggerService) {
    super();
    this.setLogger(logger);
  }

  /**
   * Initialize the error handler service
   * 
   * @returns {Promise<void>} Initialization completion promise
   * @description Sets up error handling service with default configurations.
   */
  async initialize(): Promise<void> {
    this.setInitialized(true);
    this.logInfo('Error Handler Service initialized');
  }

  /**
   * Clean up error handler service
   * 
   * @returns {Promise<void>} Cleanup completion promise
   * @description Performs cleanup of error handling resources.
   */
  async cleanup(): Promise<void> {
    this.setInitialized(false);
    this.logInfo('Error Handler Service cleaned up');
  }

  /**
   * Handle errors with automatic retry logic
   * 
   * @template T
   * @param {() => Promise<T>} operation - Operation to retry on failure
   * @param {ErrorContext} context - Error context information
   * @param {Partial<RetryOptions>} [options={}] - Retry configuration options
   * @param {ErrorCallbacks} [callbacks] - Optional callbacks for retry events
   * @returns {Promise<T>} Result of successful operation
   * @throws {Error} When all retry attempts are exhausted
   * @description Handles errors with intelligent retry logic, exponential backoff, and recovery tracking.
   */
  async handleWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    options: Partial<RetryOptions> = {},
    callbacks?: ErrorCallbacks
  ): Promise<T> {
    this.ensureInitialized();

    const retryOptions = { ...this.defaultRetryOptions, ...options };
    let lastError: Error;
    let currentDelay = retryOptions.delayMs;

    for (let attempt = 1; attempt <= retryOptions.maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        // If we succeeded after retries, log recovery
        if (attempt > 1 && callbacks?.onErrorRecovered) {
          callbacks.onErrorRecovered(lastError!, `Retry attempt ${attempt}`);
        }
        
        return result;

      } catch (error) {
        lastError = this.wrapError(error);
        
        this.logError(`Operation failed on attempt ${attempt}/${retryOptions.maxAttempts}`, lastError, {
          operation: context.operation,
          provider: context.provider,
          model: context.model,
          attempt
        });

        // Check if this is the last attempt
        if (attempt === retryOptions.maxAttempts) {
          if (callbacks?.onRetryExhausted) {
            callbacks.onRetryExhausted(lastError, attempt);
          }
          
          this.logError(`All retry attempts exhausted for ${context.operation}`, lastError);
          throw lastError;
        }

        // Check if error is retryable
        if (!this.isRetryableError(lastError, retryOptions.retryableErrors)) {
          this.logWarn(`Non-retryable error for ${context.operation}, aborting retries`, lastError);
          throw lastError;
        }

        // Notify about retry attempt
        if (callbacks?.onRetryAttempt) {
          callbacks.onRetryAttempt(attempt, retryOptions.maxAttempts, lastError);
        }

        // Wait before retry with optional exponential backoff
        await this.delay(currentDelay);
        
        if (retryOptions.exponentialBackoff) {
          currentDelay *= 2;
        }
      }
    }

    // This should never be reached, but TypeScript requires it
    throw lastError!;
  }

  /**
   * Categorize error type for appropriate handling
   * 
   * @param {unknown} error - Error to categorize
   * @returns {ErrorCategory} Error category with handling metadata
   * @description Analyzes error patterns to determine category, severity, and appropriate response.
   */
  categorizeError(error: unknown): ErrorCategory {
    const errorStr = String(error);
    const errorMessage = error instanceof Error ? error.message : errorStr;

    // Network errors
    if (this.isNetworkError(errorMessage)) {
      return {
        type: 'network',
        severity: 'medium',
        isRetryable: true,
        suggestedAction: 'Retry with exponential backoff'
      };
    }

    // Quota errors
    if (this.isQuotaError(errorMessage)) {
      return {
        type: 'quota',
        severity: 'high',
        isRetryable: false,
        suggestedAction: 'Wait or use fallback model'
      };
    }

    // Permission errors
    if (this.isPermissionError(errorMessage)) {
      return {
        type: 'permission',
        severity: 'high',
        isRetryable: false,
        suggestedAction: 'Check API credentials or permissions'
      };
    }

    // Validation errors
    if (this.isValidationError(errorMessage)) {
      return {
        type: 'validation',
        severity: 'medium',
        isRetryable: false,
        suggestedAction: 'Fix input parameters'
      };
    }

    // System errors
    if (this.isSystemError(errorMessage)) {
      return {
        type: 'system',
        severity: 'critical',
        isRetryable: true,
        suggestedAction: 'Check system resources and retry'
      };
    }

    return {
      type: 'unknown',
      severity: 'medium',
      isRetryable: false,
      suggestedAction: 'Review error details and logs'
    };
  }

  /**
   * Create user-friendly error messages
   * 
   * @param {unknown} error - Error to format
   * @param {ErrorContext} [context] - Optional error context
   * @returns {string} Human-readable error message
   * @description Converts technical errors into user-friendly messages based on error category.
   */
  createUserFriendlyMessage(error: unknown, context?: ErrorContext): string {
    const category = this.categorizeError(error);
    const operation = context?.operation || 'operation';
    const provider = context?.provider || 'provider';

    switch (category.type) {
      case 'network':
        return `Network connection issue during ${operation} with ${provider}. Please check your internet connection and try again.`;
        
      case 'quota':
        return `API quota exceeded for ${operation} with ${provider}. Please wait a moment or consider using a different model.`;
        
      case 'permission':
        return `Permission denied for ${operation} with ${provider}. Please check your API credentials.`;
        
      case 'validation':
        return `Invalid input for ${operation} with ${provider}. Please check your request parameters.`;
        
      case 'system':
        return `System error during ${operation} with ${provider}. Please try again in a moment.`;
        
      default:
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error during ${operation} with ${provider}: ${errorMessage}`;
    }
  }

  /**
   * Check if error is retryable based on patterns
   * 
   * @param {Error} error - Error to check
   * @param {string[]} retryablePatterns - Array of retryable error patterns
   * @returns {boolean} True if error matches retryable patterns
   * @description Determines if an error should be retried based on pattern matching.
   * @private
   */
  private isRetryableError(error: Error, retryablePatterns: string[]): boolean {
    const errorMessage = error.message.toLowerCase();
    
    return retryablePatterns.some(pattern => 
      errorMessage.includes(pattern.toLowerCase())
    );
  }

  /**
   * Check if error is network-related
   * 
   * @param {string} message - Error message to analyze
   * @returns {boolean} True if error is network-related
   * @description Identifies network connectivity and timeout errors.
   * @private
   */
  private isNetworkError(message: string): boolean {
    const networkPatterns = [
      'ECONNRESET',
      'ENOTFOUND', 
      'ETIMEDOUT',
      'ECONNREFUSED',
      'network',
      'connection',
      'timeout',
      'dns'
    ];
    
    return networkPatterns.some(pattern => 
      message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Check if error is quota-related
   * 
   * @param {string} message - Error message to analyze
   * @returns {boolean} True if error is quota/rate limit related
   * @description Identifies API quota and rate limiting errors.
   * @private
   */
  private isQuotaError(message: string): boolean {
    const quotaPatterns = [
      'quota',
      'rate limit',
      'too many requests',
      '429',
      'resource exhausted'
    ];
    
    return quotaPatterns.some(pattern => 
      message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Check if error is permission-related
   * 
   * @param {string} message - Error message to analyze
   * @returns {boolean} True if error is permission/authentication related
   * @description Identifies authentication and authorization errors.
   * @private
   */
  private isPermissionError(message: string): boolean {
    const permissionPatterns = [
      'unauthorized',
      'forbidden',
      'permission denied',
      'access denied',
      '401',
      '403',
      'api key',
      'authentication'
    ];
    
    return permissionPatterns.some(pattern => 
      message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Check if error is validation-related
   * 
   * @param {string} message - Error message to analyze
   * @returns {boolean} True if error is input validation related
   * @description Identifies invalid input and parameter errors.
   * @private
   */
  private isValidationError(message: string): boolean {
    const validationPatterns = [
      'invalid',
      'validation',
      'bad request',
      '400',
      'malformed',
      'required parameter',
      'missing'
    ];
    
    return validationPatterns.some(pattern => 
      message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Check if error is system-related
   * 
   * @param {string} message - Error message to analyze
   * @returns {boolean} True if error is system/infrastructure related
   * @description Identifies system resource and infrastructure errors.
   * @private
   */
  private isSystemError(message: string): boolean {
    const systemPatterns = [
      'internal server error',
      '500',
      'service unavailable',
      '503',
      'bad gateway',
      '502',
      'memory',
      'cpu',
      'disk'
    ];
    
    return systemPatterns.some(pattern => 
      message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Delay helper for retry logic
   * 
   * @param {number} ms - Delay in milliseconds
   * @returns {Promise<void>} Promise that resolves after delay
   * @description Creates a delay between retry attempts.
   * @private
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}