/**
 * Logger service implementation providing structured logging with context support
 * 
 * @class LoggerService
 * @implements {ILoggerService}
 * @description Handles application logging with configurable levels and structured context
 */

import { injectable } from 'inversify';
import { ILoggerService, LogLevel, ILogContext } from '../../interfaces/index.js';

@injectable()
export class LoggerService implements ILoggerService {
  private currentLevel: LogLevel = this.determineLogLevel();

  /**
   * Determines the appropriate log level based on environment variables
   * 
   * @private
   * @returns {LogLevel} The resolved log level
   * @description Priority order: LOG_LEVEL > DEBUG > NODE_ENV > default (SILENT)
   */
  private determineLogLevel(): LogLevel {
    // Check environment variables for log level
    const nodeEnv = process.env.NODE_ENV;
    const debugEnv = process.env.DEBUG;
    const logLevelEnv = process.env.LOG_LEVEL;

    // Priority: LOG_LEVEL > DEBUG > NODE_ENV > default
    if (logLevelEnv) {
      switch (logLevelEnv.toLowerCase()) {
        case 'dev':
        case 'development':
          return LogLevel.DEV;
        case 'info':
          return LogLevel.INFO;
        case 'silent':
          return LogLevel.SILENT;
      }
    }

    if (debugEnv === 'true' || debugEnv === '1') {
      return LogLevel.DEV;
    }

    if (nodeEnv === 'development') {
      return LogLevel.DEV;
    }

    // Default to SILENT for production environments
    return LogLevel.SILENT;
  }

  /**
   * Logs a debug message if debug level is enabled
   * 
   * @param {string} message - The message to log
   * @param {ILogContext} [context] - Optional context data
   */
  debug(message: string, context?: ILogContext): void {
    if (this.shouldLog('debug')) {
      this.log('debug', message, context);
    }
  }

  /**
   * Logs an info message if info level is enabled
   * 
   * @param {string} message - The message to log
   * @param {ILogContext} [context] - Optional context data
   */
  info(message: string, context?: ILogContext): void {
    if (this.shouldLog('info')) {
      this.log('info', message, context);
    }
  }

  /**
   * Logs a warning message if warn level is enabled
   * 
   * @param {string} message - The message to log
   * @param {ILogContext} [context] - Optional context data
   */
  warn(message: string, context?: ILogContext): void {
    if (this.shouldLog('warn')) {
      this.log('warn', message, context);
    }
  }

  /**
   * Logs an error message if error level is enabled
   * 
   * @param {string} message - The message to log
   * @param {ILogContext} [context] - Optional context data
   */
  error(message: string, context?: ILogContext): void {
    if (this.shouldLog('error')) {
      this.log('error', message, context);
    }
  }

  /**
   * Sets the current log level
   * 
   * @param {LogLevel} level - The log level to set
   */
  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * Gets the current log level
   * 
   * @returns {LogLevel} The current log level
   */
  getLevel(): LogLevel {
    return this.currentLevel;
  }

  /**
   * Determines if a message should be logged based on current log level
   * 
   * @private
   * @param {string} messageType - The type of message to check
   * @returns {boolean} True if message should be logged
   */
  private shouldLog(messageType: 'debug' | 'info' | 'warn' | 'error'): boolean {
    // SILENT: log nothing
    if (this.currentLevel === LogLevel.SILENT) {
      return false;
    }
    
    // INFO: log only info messages
    if (this.currentLevel === LogLevel.INFO) {
      return messageType === 'info';
    }
    
    // DEV: log info, warn, and error messages (debug maps to info in DEV mode)
    if (this.currentLevel === LogLevel.DEV) {
      return ['debug', 'info', 'warn', 'error'].includes(messageType);
    }
    
    return false;
  }

  /**
   * Performs the actual logging to console with formatting
   * 
   * @private
   * @param {string} messageType - The type of message being logged
   * @param {string} message - The message to log
   * @param {ILogContext} [context] - Optional context data
   */
  private log(messageType: 'debug' | 'info' | 'warn' | 'error', message: string, context?: ILogContext): void {
    const timestamp = new Date().toISOString();
    const prefix = this.getLevelPrefix(messageType);
    
    let logMessage = `${timestamp} ${prefix} ${message}`;
    
    if (context) {
      const contextString = this.formatContext(context);
      logMessage += ` ${contextString}`;
    }

    // Use appropriate console method based on message type
    switch (messageType) {
      case 'debug':
        console.debug(logMessage);
        break;
      case 'info':
        console.info(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'error':
        console.error(logMessage);
        break;
    }
  }

  /**
   * Gets the emoji prefix for a given message type
   * 
   * @private
   * @param {string} messageType - The type of message
   * @returns {string} The emoji prefix
   */
  private getLevelPrefix(messageType: 'debug' | 'info' | 'warn' | 'error'): string {
    switch (messageType) {
      case 'debug':
        return '🔍';
      case 'info':
        return '📘';
      case 'warn':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return '📘';
    }
  }

  /**
   * Formats context object into a readable string
   * 
   * @private
   * @param {ILogContext} context - The context object to format
   * @returns {string} The formatted context string
   */
  private formatContext(context: ILogContext): string {
    const parts = [];
    
    if (context.component) {
      parts.push(`[${context.component}]`);
    }
    
    if (context.provider) {
      parts.push(`provider=${context.provider}`);
    }
    
    if (context.sessionId) {
      parts.push(`session=${context.sessionId}`);
    }
    
    if (context.operationId) {
      parts.push(`operation=${context.operationId}`);
    }

    // Add any additional context properties
    const additionalContext = Object.keys(context)
      .filter(key => !['component', 'provider', 'sessionId', 'operationId'].includes(key))
      .map(key => `${key}=${context[key]}`)
      .join(' ');

    if (additionalContext) {
      parts.push(additionalContext);
    }

    return parts.length > 0 ? `(${parts.join(' ')})` : '';
  }
}