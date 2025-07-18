/**
 * MCP Service - Model Context Protocol management service
 *
 * @class MCPService
 * @implements {IMCPService}
 * @description Manages MCP server lifecycle, socket management, and configuration
 * Consolidated from MCPConfigManager.ts to centralize all MCP-related operations
 */

import { injectable, inject } from "inversify";
import { TYPES } from "../../infrastructure/di/types.js";
import { ILoggerService } from "../../interfaces/index.js";
import { IMCPConfigurationService } from "../../interfaces/mcp/IMCPConfigurationService.js";
import { spawn, ChildProcess } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

/**
 * Transport types supported by MCP protocol
 */
export type TransportType = "stdio" | "SSE" | "HTTP";

/**
 * Scope levels for Claude MCP configuration
 */
export type ClaudeScope = "local" | "project" | "user";

/**
 * Scope levels for Gemini MCP configuration
 */
export type GeminiScope = "project" | "user";

/**
 * Wizard state for MCP server configuration
 */
export interface WizardState {
  step: "name" | "transport" | "input" | "platforms" | "scope" | "advanced" | "preview";
  serverName: string;
  transport: TransportType;
  commandOrUrl: string;
  platforms: { claude: boolean; gemini: boolean };
  claudeScope: ClaudeScope;
  geminiScope: GeminiScope;
  advanced: {
    args: string[];
    env: Record<string, string>;
    timeout: number;
    headers?: Record<string, string>;
  };
}

/**
 * MCP server configuration object
 */
export interface MCPServer {
  name: string;
  transport: TransportType;
  command?: string;
  url?: string;
  args?: string[];
  env?: Record<string, string>;
  timeout?: number;
  headers?: Record<string, string>;
  claudeCode: boolean;
  geminiCLI: boolean;
  claudeScope?: ClaudeScope;
  geminiScope?: GeminiScope;
  advanced?: {
    args: string[];
    env: Record<string, string>;
    timeout: number;
    headers?: Record<string, string>;
  };
}

export interface ClaudeMCPConfig {
  mcpServers?: Record<
    string,
    {
      command?: string;
      url?: string;
      args?: string[];
      env?: Record<string, string>;
      timeout?: number;
      headers?: Record<string, string>;
    }
  >;
  projects?: Record<
    string,
    {
      mcpServers?: Record<
        string,
        {
          command?: string;
          url?: string;
          args?: string[];
          env?: Record<string, string>;
          timeout?: number;
          headers?: Record<string, string>;
        }
      >;
      [key: string]: any;
    }
  >;
  [key: string]: any;
}

/**
 * Gemini MCP server configuration structure
 */
export interface GeminiMCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  timeout?: number;
}

/**
 * Gemini MCP configuration structure
 */
export interface GeminiMCPConfig {
  mcpServers?: Record<string, GeminiMCPServerConfig>;
  // Add other known Gemini config properties here
}

/**
 * CLI command execution result
 */
export interface CLIResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
}

/**
 * MCP service interface
 */
export interface IMCPService {
  // Configuration lifecycle methods
  initialize(): Promise<void>;
  ensureStandardMCPConfig(): Promise<void>;

  // Configuration management methods (from MCPConfigManager)
  loadAllServers(): Promise<MCPServer[]>;
  loadServersByScope(): Promise<{
    claudeLocal: MCPServer[];
    claudeProject: MCPServer[];
    claudeUser: MCPServer[];
    geminiProject: MCPServer[];
    geminiUser: MCPServer[];
  }>;
  saveServer(config: WizardState): Promise<void>;
  removeServer(serverName: string): Promise<{ claude: boolean; gemini: boolean }>;
  serverExists(serverName: string): Promise<boolean>;
  getAvailableClaudeConfigs(): Promise<Array<{ scope: ClaudeScope; path: string }>>;
  getPrimaryClaudeConfigPath(): Promise<string>;
  ensureClaudeConfig(): Promise<string>;

  // Integrated configuration methods (from MCPIntegratedConfigService)
  generateIntegratedConfig(permissionMode?: string, sessionTag?: string): Promise<string>;
  generateFallbackConfig(permissionMode?: string, sessionTag?: string): Promise<string>;
  cleanupIntegratedConfigs(): Promise<void>;
}

@injectable()
export class MCPService implements IMCPService {
  // MCP server lifecycle is handled by Claude CLI
  private isInitialized = false;
  private useCliFirst = true;

  private readonly configFileName = "mcp-integrated.json";
  private readonly fallbackFileName = "mcp-fallback.json";

  constructor(
    @inject(TYPES.LoggerService) private logger: ILoggerService,
    @inject(TYPES.MCPConfigurationService) private configService: IMCPConfigurationService
  ) {}

  /**
   * Initialize the MCP service
   *
   * @returns {Promise<void>}
   * @throws {Error} If initialization fails
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Ensure standard MCP configuration
      await this.ensureStandardMCPConfig();
      
      // Generate the integrated MCP configuration file
      await this.generateIntegratedConfig();
      
      this.isInitialized = true;
      this.logger.info("MCP Service initialized successfully");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error("Failed to initialize MCP Service", { error: err.message });
      throw err;
    }
  }

  // Server lifecycle methods removed - MCP server lifecycle is handled by Claude CLI

  // Configuration methods removed - delegated to MCPConfigurationService

  /**
   * Ensure standard MCP configuration - delegates to MCPConfigurationService
   *
   * @returns {Promise<void>}
   */
  async ensureStandardMCPConfig(): Promise<void> {
    return this.configService.ensureStandardMCPConfiguration();
  }

  // Configuration management methods (consolidated from MCPConfigManager)

  // CLI integration methods removed - delegated to MCPCLIIntegrationService

  // Path configuration methods removed - delegated to MCPConfigurationService

  // Load configuration methods removed - delegated to MCPConfigurationService

  /**
   * Load all MCP servers using CLI commands with file fallback
   *
   * @returns {Promise<MCPServer[]>} Array of all MCP servers
   */
  async loadAllServers(): Promise<MCPServer[]> {
    return this.configService.loadAllServers();
  }

  /**
   * Load servers organized by scope for better display
   *
   * @returns {Promise<Object>} Servers organized by scope
   */
  async loadServersByScope(): Promise<{
    claudeLocal: MCPServer[];
    claudeProject: MCPServer[];
    claudeUser: MCPServer[];
    geminiProject: MCPServer[];
    geminiUser: MCPServer[];
  }> {
    return this.configService.loadServersByScope();
  }

  /**
   * Save MCP server configuration based on wizard state
   *
   * @param {WizardState} config - Configuration from wizard
   * @returns {Promise<void>}
   */
  async saveServer(config: WizardState): Promise<void> {
    return this.configService.saveServer(config);
  }

  /**
   * Remove MCP server from all configurations
   *
   * @param {string} serverName - Name of server to remove
   * @returns {Promise<Object>} Removal status for each provider
   */
  async removeServer(serverName: string): Promise<{ claude: boolean; gemini: boolean }> {
    return this.configService.removeServer(serverName);
  }

  /**
   * Check if a server name already exists
   *
   * @param {string} serverName - Name to check
   * @returns {Promise<boolean>} True if server exists
   */
  async serverExists(serverName: string): Promise<boolean> {
    return this.configService.serverExists(serverName);
  }

  /**
   * Get all available Claude MCP config paths (that exist)
   *
   * @returns {Promise<Array>} Array of available config paths with scope
   */
  async getAvailableClaudeConfigs(): Promise<Array<{ scope: ClaudeScope; path: string }>> {
    return this.configService.getAvailableClaudeConfigs();
  }

  /**
   * Get the most appropriate Claude config path for CLI usage
   *
   * @returns {Promise<string>} Primary config path
   */
  async getPrimaryClaudeConfigPath(): Promise<string> {
    return this.configService.getPrimaryClaudeConfigPath();
  }

  /**
   * Ensure a minimal Claude config exists for CLI usage
   *
   * @returns {Promise<string>} Path to ensured config
   */
  async ensureClaudeConfig(): Promise<string> {
    return this.configService.ensureClaudeConfig();
  }

  /**
   * Generate integrated MCP configuration file
   *
   * @param {string} permissionMode - Permission mode for MCP servers
   * @param {string} [sessionTag] - Session tag for configuration
   * @returns {Promise<string>} Path to generated config file
   */
  async generateIntegratedConfig(permissionMode: string = "default", sessionTag?: string): Promise<string> {
    try {
      const configPath = path.join(process.cwd(), ".nexus", this.configFileName);

      try {
        await fs.access(configPath);
        this.logger.debug("Using existing MCP config file", { configPath });
        return configPath;
      } catch (error) {
        this.logger.info("Creating new MCP config file");
      }

      const allServers = await this.loadAllServers();
      this.logger.info(`Found ${allServers.length} existing MCP servers across all scopes`, {
        serverCount: allServers.length,
      });
      /** Internal interface for MCP server configuration */
      interface MCPServerConfig {
        command?: string;
        url?: string;
        args?: string[];
        env?: Record<string, string>;
        timeout?: number;
      }

      const integratedConfig: { mcpServers: Record<string, MCPServerConfig> } = {
        mcpServers: {},
      };

      allServers.forEach((server) => {
        if (server.name !== "permission") {
          integratedConfig.mcpServers[server.name] = {
            command: server.command,
            url: server.url,
            args: server.args || [],
            env: server.env || {},
            timeout: server.timeout || 30000,
          };

          const serverConfig = integratedConfig.mcpServers[server.name];
          if (!serverConfig.command) {
            delete serverConfig.command;
          }
          if (!serverConfig.url) {
            delete serverConfig.url;
          }
          if (!serverConfig.args?.length) {
            delete serverConfig.args;
          }
          if (!Object.keys(serverConfig.env || {}).length) {
            delete serverConfig.env;
          }
        }
      });

      const nodePath = process.execPath || "node";
      const mcpPermissionServerPath = this.resolveMCPServerPath("mcp-permission-server.cjs");
      const mcpCrossProviderServerPath = this.resolveMCPServerPath("mcp-crossprovider-server.cjs");

      integratedConfig.mcpServers.permission = {
        command: nodePath,
        args: [mcpPermissionServerPath],
        env: {
          SESSION_ID: sessionTag || "default",
          PERMISSION_MODE: permissionMode,
        },
      };

      integratedConfig.mcpServers.askModel = {
        command: nodePath,
        args: [mcpCrossProviderServerPath],
        env: {
          SESSION_ID: sessionTag || "default",
          PERMISSION_MODE: permissionMode,
        },
      };

      const finalConfigPath = await this.writeIntegratedConfig(this.configFileName, integratedConfig);

      this.logger.info(`Generated integrated MCP config at ${finalConfigPath}`, {
        configPath: finalConfigPath,
        serverCount: Object.keys(integratedConfig.mcpServers).length,
        servers: Object.keys(integratedConfig.mcpServers),
      });

      return finalConfigPath;
    } catch (error) {
      this.logger.error("Failed to generate integrated MCP config:", { error });

      return await this.generateFallbackConfig(permissionMode, sessionTag);
    }
  }

  /**
   * Generate fallback MCP configuration with permission server only
   *
   * @param {string} permissionMode - Permission mode for MCP servers
   * @param {string} [sessionTag] - Session tag for configuration
   * @returns {Promise<string>} Path to generated fallback config
   */
  async generateFallbackConfig(permissionMode: string = "default", sessionTag?: string): Promise<string> {
    this.logger.info("Generating fallback permission-only MCP config");

    const nodePath = process.execPath || "node";
    const mcpServerPath = this.resolveMCPServerPath("mcp-permission-server.cjs");

    const fallbackConfig = {
      mcpServers: {
        permission: {
          command: nodePath,
          args: [mcpServerPath],
          env: {
            SESSION_ID: sessionTag || "default",
            PERMISSION_MODE: permissionMode,
          },
        },
      },
    };

    const configPath = await this.writeIntegratedConfig(this.fallbackFileName, fallbackConfig);
    this.logger.info(`Generated fallback MCP config at ${configPath}`, { configPath });

    return configPath;
  }

  /**
   * Write integrated MCP configuration to file
   *
   * @private
   * @param {string} fileName - Name of the config file
   * @param {Record<string, unknown>} config - Configuration object
   * @returns {Promise<string>} Path to written config file
   */
  private async writeIntegratedConfig(fileName: string, config: Record<string, unknown>): Promise<string> {
    const nexusDir = path.join(process.cwd(), ".nexus");
    await fs.mkdir(nexusDir, { recursive: true });
    const configPath = path.join(nexusDir, fileName);
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    return configPath;
  }

  /**
   * Clean up temporary integrated MCP configuration files
   *
   * @returns {Promise<void>}
   */
  async cleanupIntegratedConfigs(): Promise<void> {
    try {
      const tempFiles = [this.configFileName, this.fallbackFileName];

      for (const fileName of tempFiles) {
        const tempPath = path.join(process.cwd(), ".nexus", fileName);
        try {
          await fs.unlink(tempPath);
          this.logger.debug(`Cleaned up temporary MCP config: ${tempPath}`, { tempPath });
        } catch (error) {
          // Ignore if file doesn't exist
        }
      }
    } catch (error) {
      this.logger.error("Failed to cleanup MCP config files:", { error });
    }
  }

  /**
   * Resolve MCP server path relative to this module
   * Works in both development and production environments
   *
   * @private
   * @param {string} filename - Name of the MCP server file
   * @returns {string} Absolute path to the MCP server file
   */
  private resolveMCPServerPath(filename: string): string {
    // Get the directory of this file
    const currentFileUrl = import.meta.url;
    const currentDir = path.dirname(fileURLToPath(currentFileUrl));

    // In production: dist/services/core/MCPService.js
    // MCP servers in: dist/services/providers/claude/
    return path.join(currentDir, "../providers/claude", filename);
  }
}
