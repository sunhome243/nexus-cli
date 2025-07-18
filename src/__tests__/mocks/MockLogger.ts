import { injectable } from "inversify";
import { ILoggerService, LogLevel } from "../../interfaces/core/ILoggerService";

@injectable()
export class MockLogger implements ILoggerService {
  private logs: Array<{ level: LogLevel; message: string; context?: any }> = [];

  debug(message: string, context?: any): void {
    this.logs.push({ level: LogLevel.DEBUG, message, context });
  }

  info(message: string, context?: any): void {
    this.logs.push({ level: LogLevel.INFO, message, context });
  }

  warn(message: string, context?: any): void {
    this.logs.push({ level: LogLevel.WARN, message, context });
  }

  error(message: string, context?: any): void {
    this.logs.push({ level: LogLevel.ERROR, message, context });
  }

  setLevel(level: LogLevel): void {
    // Mock implementation
  }

  getLevel(): LogLevel {
    return LogLevel.INFO;
  }

  getLogs(): Array<{ level: LogLevel; message: string; context?: any }> {
    return this.logs;
  }

  clearLogs(): void {
    this.logs = [];
  }
}