/**
 * Logger Interface
 * Defines the contract for logging throughout the application
 */

export enum LogLevel {
  SILENT = 'silent',
  INFO = 'info',
  DEV = 'dev'
}

export interface ILogContext {
  component?: string;
  provider?: string;
  sessionId?: string;
  operationId?: string;
  [key: string]: unknown;
}

export interface ILoggerService {
  debug(message: string, context?: ILogContext): void;
  info(message: string, context?: ILogContext): void;
  warn(message: string, context?: ILogContext): void;
  error(message: string, context?: ILogContext): void;
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
}