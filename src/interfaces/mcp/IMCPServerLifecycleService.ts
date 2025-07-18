/**
 * MCP Server Lifecycle Service Interface
 * Manages the lifecycle of MCP servers
 */

export interface MCPServerConfig {
  port?: number;
  host?: string;
  timeout?: number;
  retryAttempts?: number;
  enableLogging?: boolean;
  socketPath?: string;
  environment?: Record<string, string>;
  command?: string;
  args?: string[];
}

export interface IMCPServerLifecycleService {
  /**
   * Initialize the service
   */
  initialize(): Promise<void>;
  
  /**
   * Start a server with configuration
   */
  startServer(serverId: string, config: MCPServerConfig): Promise<void>;
  
  /**
   * Stop a specific server
   */
  stopServer(serverId: string): Promise<void>;
  
  /**
   * Stop all servers
   */
  stopAllServers(): Promise<void>;
  
  /**
   * Check if a server is running
   */
  isServerRunning(serverId: string): boolean;
  
  /**
   * Get server status
   */
  getServerStatus(serverId: string): {
    running: boolean;
    pid?: number;
    startTime?: Date;
  } | null;
  
  /**
   * Cleanup resources
   */
  cleanup(): Promise<void>;
}