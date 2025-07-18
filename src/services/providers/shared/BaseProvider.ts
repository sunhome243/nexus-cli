/**
 * Base Provider Abstract Class - Foundation for all AI provider implementations
 * 
 * @abstract
 * @class BaseProvider
 * @description Eliminates duplication of common provider patterns and provides shared functionality.
 * Provides consistent initialization, logging, error handling, validation, and utility methods
 * for all provider implementations (Claude, Gemini, etc.).
 */

import { injectable } from 'inversify';
import { ILoggerService } from '../../../interfaces/core/ILoggerService.js';

/**
 * Base Provider abstract class implementation
 * 
 * @abstract
 * @class BaseProvider
 * @description Foundation class providing common patterns for all AI provider implementations.
 */
@injectable()
export abstract class BaseProvider {
  protected _isInitialized = false;
  protected logger?: ILoggerService;

  /**
   * Ensure the provider is initialized before operations
   * 
   * @throws {Error} When provider is not initialized
   * @description Throws error if not initialized - consistent across all providers.
   * @protected
   */
  protected ensureInitialized(): void {
    if (!this._isInitialized) {
      throw new Error(`${this.constructor.name} not initialized. Call initialize() first.`);
    }
  }
  
  /**
   * Check if the service is initialized
   * 
   * @returns {boolean} True if service is initialized
   * @description Public method to check initialization status.
   */
  isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Common error wrapping utility
   * 
   * @param {unknown} error - Error of any type to wrap
   * @returns {Error} Properly formatted Error instance
   * @description Ensures consistent error handling across providers.
   * @protected
   */
  protected wrapError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error(String(error));
  }

  /**
   * Abstract method that must be implemented by each provider
   * 
   * @returns {Promise<void>} Initialization completion promise
   * @description Must be implemented by each provider for their specific initialization logic.
   * @abstract
   */
  abstract initialize(): Promise<void>;

  /**
   * Abstract cleanup method that must be implemented by each provider
   * 
   * @returns {Promise<void>} Cleanup completion promise
   * @description Must be implemented by each provider for their specific cleanup logic.
   * @abstract
   */
  abstract cleanup(): Promise<void>;

  /**
   * Check if provider is initialized
   * 
   * @returns {boolean} True if provider is initialized
   * @description Alternative method name for initialization status check.
   */
  isProviderInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Set logger instance for consistent logging across providers
   * 
   * @param {ILoggerService} logger - Logger service instance
   * @description Configures logging for this provider instance.
   */
  setLogger(logger: ILoggerService): void {
    this.logger = logger;
  }

  /**
   * Log info message with provider context
   * 
   * @param {string} message - Log message
   * @param {...unknown[]} args - Additional log arguments
   * @throws {Error} When logger is not available
   * @description Protected logging utility for consistent log formatting.
   * @protected
   */
  protected logInfo(message: string, ...args: unknown[]): void {
    if (this.logger) {
      this.logger.info(`[${this.constructor.name}] ${message}`, { args });
    } else {
      throw new Error(`Logger not available in ${this.constructor.name}. Ensure setLogger() is called during initialization.`);
    }
  }

  /**
   * Log error message with provider context
   * 
   * @param {string} message - Error message
   * @param {unknown} [error] - Optional error object
   * @param {...unknown[]} args - Additional log arguments
   * @throws {Error} When logger is not available
   * @description Protected error logging utility.
   * @protected
   */
  protected logError(message: string, error?: unknown, ...args: unknown[]): void {
    if (this.logger) {
      this.logger.error(`[${this.constructor.name}] ${message}`, { error, args });
    } else {
      throw new Error(`Logger not available in ${this.constructor.name}. Ensure setLogger() is called during initialization.`);
    }
  }

  /**
   * Log warning message with provider context
   * 
   * @param {string} message - Warning message
   * @param {...unknown[]} args - Additional log arguments
   * @throws {Error} When logger is not available
   * @description Protected warning logging utility.
   * @protected
   */
  protected logWarn(message: string, ...args: unknown[]): void {
    if (this.logger) {
      this.logger.warn(`[${this.constructor.name}] ${message}`, { args });
    } else {
      throw new Error(`Logger not available in ${this.constructor.name}. Ensure setLogger() is called during initialization.`);
    }
  }

  /**
   * Log debug message with provider context
   * 
   * @param {string} message - Debug message
   * @param {...unknown[]} args - Additional log arguments
   * @throws {Error} When logger is not available
   * @description Protected debug logging utility.
   * @protected
   */
  protected logDebug(message: string, ...args: unknown[]): void {
    if (this.logger) {
      this.logger.debug(`[${this.constructor.name}] ${message}`, { args });
    } else {
      throw new Error(`Logger not available in ${this.constructor.name}. Ensure setLogger() is called during initialization.`);
    }
  }

  /**
   * Common initialization guard for derived classes
   * 
   * @param {boolean} [initialized=true] - Initialization status to set
   * @description Prevents multiple initialization attempts.
   * @protected
   */
  protected setInitialized(initialized: boolean = true): void {
    this._isInitialized = initialized;
  }

  /**
   * Common validation for session tags
   * 
   * @param {string} tag - Session tag to validate
   * @throws {Error} When tag is invalid format or length
   * @description Ensures consistent session tag validation across providers.
   * @protected
   */
  protected validateSessionTag(tag: string): void {
    if (!tag || typeof tag !== 'string' || tag.trim().length === 0) {
      throw new Error('Session tag must be a non-empty string');
    }
    
    if (tag.length > 100) {
      throw new Error('Session tag must be 100 characters or less');
    }
    
    // Validate tag format (alphanumeric, hyphens, underscores only)
    if (!/^[a-zA-Z0-9_-]+$/.test(tag)) {
      throw new Error('Session tag must contain only alphanumeric characters, hyphens, and underscores');
    }
  }

  /**
   * Common timeout utility for async operations
   * 
   * @template T
   * @param {Promise<T>} promise - Promise to add timeout to
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {string} [errorMessage] - Optional custom timeout error message
   * @returns {Promise<T>} Promise that rejects on timeout
   * @description Adds timeout functionality to any async operation.
   * @protected
   */
  protected async withTimeout<T>(
    promise: Promise<T>, 
    timeoutMs: number, 
    errorMessage?: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Common retry logic for provider operations
   * 
   * @template T
   * @param {() => Promise<T>} operation - Operation to retry
   * @param {number} [maxAttempts=3] - Maximum retry attempts
   * @param {number} [delayMs=1000] - Delay between retries in milliseconds
   * @returns {Promise<T>} Result of successful operation
   * @throws {Error} When all retry attempts fail
   * @description Provides exponential backoff retry logic for provider operations.
   * @protected
   */
  protected async retryOperation<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = this.wrapError(error);
        
        if (attempt === maxAttempts) {
          break;
        }

        this.logWarn(`Attempt ${attempt} failed, retrying in ${delayMs}ms...`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }
}