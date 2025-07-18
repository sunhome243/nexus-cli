/**
 * MCP Socket Manager
 * Handles MCP server process lifecycle and socket file cleanup
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../../infrastructure/di/types.js';
import { ILoggerService } from '../../../interfaces/core/ILoggerService.js';
import { ProcessTracker, FileCleanupUtil } from '../../../utils/processTracker.js';

export interface IMCPSocketManager {
  cleanupSocketFiles(): Promise<void>;
  killMCPProcesses(): Promise<void>;
  performFullCleanup(): Promise<void>;
  setupProcessSignalHandlers(): void;
}

@injectable()
export class MCPSocketManager implements IMCPSocketManager {
  constructor(
    @inject(TYPES.LoggerService) private logger: ILoggerService
  ) {}

  /**
   * Kill all MCP server processes using tracked PIDs (secure alternative to pkill)
   */
  async killMCPProcesses(): Promise<void> {
    try {
      const processTracker = ProcessTracker.getInstance();
      await processTracker.killTrackedProcesses('mcp-permission-server');
      this.logger.info("🗑️ Cleaned up MCP server processes");
    } catch (error) {
      this.logger.error("❌ Failed to kill MCP processes", { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Clean up MCP socket files using Node.js fs operations (secure alternative to rm)
   */
  async cleanupSocketFiles(): Promise<void> {
    try {
      await FileCleanupUtil.cleanupMCPPermissionSockets();
      this.logger.info("🗑️ Cleaned up MCP socket files");
    } catch (error) {
      this.logger.error("❌ Failed to cleanup socket files", { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Perform complete MCP cleanup (processes + sockets)
   */
  async performFullCleanup(): Promise<void> {
    try {
      this.logger.info("\n🛑 Shutting down MCP services gracefully...");
      
      await this.killMCPProcesses();
      await this.cleanupSocketFiles();
      
      this.logger.info("✅ MCP cleanup complete");
    } catch (error) {
      this.logger.error("❌ Error during MCP cleanup", { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Setup process signal handlers for graceful shutdown
   */
  setupProcessSignalHandlers(): void {
    process.on("SIGINT", async () => {
      await this.performFullCleanup();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      await this.performFullCleanup();
      process.exit(0);
    });
  }
}