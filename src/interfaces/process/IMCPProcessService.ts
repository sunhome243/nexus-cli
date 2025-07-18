/**
 * MCP Process Service Interface
 * Manages MCP server processes lifecycle
 */

export interface MCPServerConfig {
  port?: number;
  host?: string;
  timeout?: number;
  retryAttempts?: number;
  enableLogging?: boolean;
  socketPath?: string;
  environment?: Record<string, string>;
}

export interface IMCPProcessService {
  /**
   * Start MCP server
   */
  startServer(config?: MCPServerConfig): Promise<void>;
  
  /**
   * Stop MCP server
   */
  stopServer(): Promise<void>;
  
  /**
   * Check if server is running
   */
  isServerRunning(): boolean;
  
  /**
   * Clean up orphan sockets
   */
  cleanupOrphanSockets(): Promise<void>;
  
  /**
   * Get server status
   */
  getServerStatus(): {
    running: boolean;
    pid?: number;
    startTime?: Date;
  };
}