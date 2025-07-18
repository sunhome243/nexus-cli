/**
 * Permission Response Service
 * Handles communication with MCP permission server via Unix socket
 * Extracted from App.tsx for better architecture and error handling
 */

import { injectable, inject } from "inversify";
import { TYPES } from "../../../../infrastructure/di/types.js";
import { ILoggerService } from "../../../../interfaces/core/ILoggerService.js";
import { BaseProvider } from "../../shared/BaseProvider.js";
import * as net from "net";

export interface PermissionResponse {
  toolUseId: string;
  approved: boolean;
  reason?: string;
  autoApprove?: boolean;
}

export interface PermissionResponseStats {
  totalResponses: number;
  approvedResponses: number;
  deniedResponses: number;
  socketErrors: number;
  connectionFailures: number;
  lastResponseTime: Date | null;
}

@injectable()
export class PermissionResponseService extends BaseProvider {
  private stats: PermissionResponseStats = {
    totalResponses: 0,
    approvedResponses: 0,
    deniedResponses: 0,
    socketErrors: 0,
    connectionFailures: 0,
    lastResponseTime: null
  };

  private readonly SOCKET_TIMEOUT_MS = 5000;
  private readonly MAX_RETRY_ATTEMPTS = 3;

  constructor(@inject(TYPES.LoggerService) logger?: ILoggerService) {
    super();
    if (logger) {
      this.setLogger(logger);
    }
  }

  async initialize(): Promise<void> {
    this.setInitialized(true);
    this.logInfo('Permission Response Service initialized');
  }

  async cleanup(): Promise<void> {
    this.setInitialized(false);
    this.logInfo('Permission Response Service cleaned up');
  }

  /**
   * Send permission response to MCP permission server
   */
  async sendPermissionResponse(response: PermissionResponse): Promise<void> {
    this.ensureInitialized();

    const { toolUseId, approved, reason, autoApprove } = response;

    if (!toolUseId) {
      throw new Error('PermissionResponseService: toolUseId is required');
    }

    this.logInfo(`Sending permission response to MCP server`, {
      toolUseId,
      approved,
      reason: reason || 'No reason provided',
      autoApprove: autoApprove || false
    });

    // Update stats
    this.stats.totalResponses++;
    if (approved) {
      this.stats.approvedResponses++;
    } else {
      this.stats.deniedResponses++;
    }
    this.stats.lastResponseTime = new Date();

    // Get socket path (same logic as MCP server)
    const sessionId = process.env.SESSION_ID || "default";
    const socketPath = `/tmp/mcp-permission-${sessionId}.sock`;

    let attempt = 0;
    while (attempt < this.MAX_RETRY_ATTEMPTS) {
      try {
        await this.sendToSocket(socketPath, response);
        this.logInfo(`Permission response sent successfully on attempt ${attempt + 1}`, {
          toolUseId,
          approved,
          socketPath
        });
        return;
      } catch (error) {
        attempt++;
        this.stats.socketErrors++;
        
        if (attempt >= this.MAX_RETRY_ATTEMPTS) {
          this.stats.connectionFailures++;
          this.logError(`Failed to send permission response after ${this.MAX_RETRY_ATTEMPTS} attempts`, {
            toolUseId,
            approved,
            socketPath,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          throw new Error(`Failed to send permission response: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } else {
          this.logWarn(`Permission response attempt ${attempt} failed, retrying...`, {
            toolUseId,
            approved,
            socketPath,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          // Wait briefly before retry
          await this.delay(500);
        }
      }
    }
  }

  /**
   * Send data to Unix socket
   */
  private sendToSocket(socketPath: string, response: PermissionResponse): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = net.createConnection(socketPath, () => {
        this.logDebug(`Connected to MCP permission socket: ${socketPath}`);
        
        const message = JSON.stringify({
          toolUseId: response.toolUseId,
          approved: response.approved,
          reason: response.reason,
          autoApprove: response.autoApprove || false,
        });

        this.logDebug(`Sending message to MCP server:`, message);
        client.write(message);
        client.end();
      });

      client.on('data', (data) => {
        try {
          const serverResponse = JSON.parse(data.toString());
          this.logDebug(`Received acknowledgment from MCP server:`, serverResponse);
          
          if (serverResponse.success) {
            resolve();
          } else {
            reject(new Error(`MCP server error: ${serverResponse.error || 'Unknown error'}`));
          }
        } catch (error) {
          this.logWarn(`Failed to parse MCP server response:`, { data: data.toString(), error });
          // Still resolve since message was sent
          resolve();
        }
      });

      client.on('error', (error) => {
        this.logError(`Socket connection error:`, {
          socketPath,
          error: error.message,
          code: (error as any).code
        });
        reject(error);
      });

      client.on('close', () => {
        this.logDebug(`Socket connection closed: ${socketPath}`);
        // If we haven't resolved/rejected yet, assume success
        resolve();
      });

      // Set timeout
      client.setTimeout(this.SOCKET_TIMEOUT_MS, () => {
        this.logWarn(`Socket timeout after ${this.SOCKET_TIMEOUT_MS}ms`, { socketPath });
        client.destroy();
        reject(new Error(`Socket timeout after ${this.SOCKET_TIMEOUT_MS}ms`));
      });
    });
  }

  /**
   * Get permission response statistics
   */
  getStats(): Readonly<PermissionResponseStats> {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalResponses: 0,
      approvedResponses: 0,
      deniedResponses: 0,
      socketErrors: 0,
      connectionFailures: 0,
      lastResponseTime: null
    };
    this.logDebug('Permission response statistics reset');
  }

  /**
   * Check if MCP permission server socket exists
   */
  async checkSocketExists(sessionId?: string): Promise<boolean> {
    const actualSessionId = sessionId || process.env.SESSION_ID || "default";
    const socketPath = `/tmp/mcp-permission-${actualSessionId}.sock`;
    
    try {
      const fs = await import('fs/promises');
      await fs.access(socketPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get socket path for current session
   */
  getSocketPath(sessionId?: string): string {
    const actualSessionId = sessionId || process.env.SESSION_ID || "default";
    return `/tmp/mcp-permission-${actualSessionId}.sock`;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}