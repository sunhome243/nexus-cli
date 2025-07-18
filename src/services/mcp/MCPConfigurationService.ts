/**
 * MCP Configuration Service - Model Context Protocol configuration management
 * 
 * @class MCPConfigurationService
 * @implements {IMCPConfigurationService}
 * @description Manages MCP server configuration loading and saving across Claude and Gemini platforms.
 * 
 * @architecture This is a large orchestrator service (734 lines) that coordinates multiple MCP concerns.
 * 
 * Key responsibilities:
 * - Permission MCP Management: Standard MCP server setup
 * - Claude Config Operations: Claude-specific configuration handling
 * - Gemini Config Operations: Gemini-specific configuration handling
 * - Server Loading & Aggregation: Cross-platform server discovery
 * - Server CRUD Operations: Create, read, update, delete operations
 * - Path Resolution: Configuration file path management
 * 
 * @future Consider decomposing into focused services:
 * - MCPPermissionService: Permission MCP setup
 * - MCPClaudeConfigService: Claude-specific operations
 * - MCPGeminiConfigService: Gemini-specific operations
 * - MCPServerAggregationService: Server loading/aggregation
 * - MCPPathResolutionService: Path resolution utilities
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../infrastructure/di/types.js';
import { ILoggerService } from '../../interfaces/index.js';
import { IMCPConfigurationService } from '../../interfaces/mcp/IMCPConfigurationService.js';
import { MCPServer, ClaudeMCPConfig, GeminiMCPConfig, WizardState, ClaudeScope, GeminiScope, TransportType } from '../core/MCPService.js';
import { IMCPConfigPathResolverService } from './config/MCPConfigPathResolverService.js';
import { IMCPConfigLoaderService } from './config/MCPConfigLoaderService.js';
import { IMCPConfigSaverService } from './config/MCPConfigSaverService.js';
import { IMCPServerRemoverService } from './config/MCPServerRemoverService.js';
import { IMCPConfigValidatorService } from './config/MCPConfigValidatorService.js';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

@injectable()
export class MCPConfigurationService implements IMCPConfigurationService {
  constructor(
    @inject(TYPES.LoggerService) private logger: ILoggerService,
    @inject(TYPES.MCPConfigPathResolverService) private pathResolver: IMCPConfigPathResolverService,
    @inject(TYPES.MCPConfigLoaderService) private configLoader: IMCPConfigLoaderService,
    @inject(TYPES.MCPConfigSaverService) private configSaver: IMCPConfigSaverService,
    @inject(TYPES.MCPServerRemoverService) private serverRemover: IMCPServerRemoverService,
    @inject(TYPES.MCPConfigValidatorService) private configValidator: IMCPConfigValidatorService
  ) {}

  /**
   * Ensure standard MCP configuration is set up
   */
  async ensureStandardMCPConfiguration(): Promise<void> {
    try {
      const standardConfigPath = this.getStandardMCPConfigPath();
      
      // Create directory if it doesn't exist
      await fs.mkdir(path.dirname(standardConfigPath), { recursive: true });
      
      // Ensure standard MCP servers are configured
      await this.ensureStandardMCPServersInConfig(standardConfigPath);
      
      this.logger.info('Standard MCP configuration ensured');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to ensure standard MCP configuration', { error: err.message });
      throw err;
    }
  }

  /**
   * Get standard MCP configuration path
   */
  getStandardMCPConfigPath(): string {
    return this.pathResolver.getStandardMCPConfigPath();
  }


  /**
   * Ensure standard MCP servers (permission and askModel) are configured in the config file
   */
  async ensureStandardMCPServersInConfig(configPath: string): Promise<void> {
    interface MCPConfig {
      projects?: Record<string, {
        mcpServers?: Record<string, unknown>;
      }>;
      [key: string]: unknown;
    }
    
    let config: MCPConfig = {};
    
    try {
      // Try to read existing config
      const existingContent = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(existingContent);
    } catch (error) {
      // Config doesn't exist or is invalid, use default
      this.logger.debug('Creating new Claude global configuration');
    }
    
    // Initialize projects section
    if (!config.projects) {
      config.projects = {};
    }
    
    const projectPath = process.cwd();
    if (!config.projects[projectPath]) {
      config.projects[projectPath] = {};
    }
    if (!config.projects[projectPath].mcpServers) {
      config.projects[projectPath].mcpServers = {};
    }
    
    // Add permission MCP if it doesn't exist
    if (!config.projects[projectPath].mcpServers['permission-mcp']) {
      const permissionMCPPath = this.resolveMCPServerPath('mcp-permission-server.cjs');
      
      config.projects[projectPath].mcpServers['permission-mcp'] = {
        command: 'node',
        args: [permissionMCPPath],
        env: {}
      };
      
      this.logger.info('Added permission-mcp to Claude configuration');
    }
    
    // Add crossProvider MCP if it doesn't exist
    if (!config.projects[projectPath].mcpServers['crossProvider']) {
      const crossProviderMCPPath = this.resolveMCPServerPath('mcp-crossprovider-server.cjs');
      
      config.projects[projectPath].mcpServers['crossProvider'] = {
        command: 'node',
        args: [crossProviderMCPPath],
        env: {}
      };
      
      this.logger.info('Added crossProvider MCP to Claude configuration');
    }
    
    // Write updated config
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Get the appropriate config file path for Claude Code based on scope
   */
  getClaudeConfigPath(scope: ClaudeScope): string {
    return this.pathResolver.getClaudeConfigPath(scope);
  }

  /**
   * Get the appropriate config file path for Gemini CLI based on scope
   */
  getGeminiConfigPath(scope: GeminiScope): string {
    return this.pathResolver.getGeminiConfigPath(scope);
  }

  /**
   * Load Claude Code MCP servers from a specific config file
   */
  async loadClaudeConfig(configPath: string, scope?: ClaudeScope): Promise<MCPServer[]> {
    return this.configLoader.loadClaudeConfig(configPath, scope);
  }

  /**
   * Load Gemini CLI MCP servers from a specific config file
   */
  async loadGeminiConfig(configPath: string): Promise<MCPServer[]> {
    return this.configLoader.loadGeminiConfig(configPath);
  }


  /**
   * Load all MCP servers using CLI commands with file fallback
   */
  async loadAllServers(): Promise<MCPServer[]> {
    return this.configLoader.loadAllServers();
  }


  /**
   * Load servers organized by scope for better display
   */
  async loadServersByScope(): Promise<{
    claudeLocal: MCPServer[];
    claudeProject: MCPServer[];
    claudeUser: MCPServer[];
    geminiProject: MCPServer[];
    geminiUser: MCPServer[];
  }> {
    return this.configLoader.loadServersByScope();
  }

  /**
   * Save MCP server configuration based on wizard state
   */
  async saveServer(config: WizardState): Promise<void> {
    return this.configSaver.saveServer(config);
  }

  /**
   * Remove MCP server from all configurations
   */
  async removeServer(serverName: string): Promise<{ claude: boolean; gemini: boolean }> {
    return this.serverRemover.removeServer(serverName);
  }

  /**
   * Check if a server name already exists
   */
  async serverExists(serverName: string): Promise<boolean> {
    return this.configValidator.serverExists(serverName);
  }

  /**
   * Get all available Claude MCP config paths (that exist)
   */
  async getAvailableClaudeConfigs(): Promise<Array<{ scope: ClaudeScope; path: string }>> {
    return this.pathResolver.getAvailableClaudeConfigs();
  }

  /**
   * Get the most appropriate Claude config path for CLI usage
   */
  async getPrimaryClaudeConfigPath(): Promise<string> {
    return this.pathResolver.getPrimaryClaudeConfigPath();
  }

  /**
   * Ensure a minimal Claude config exists for CLI usage
   */
  async ensureClaudeConfig(): Promise<string> {
    return this.configValidator.ensureClaudeConfig();
  }

  /**
   * Resolve MCP server path relative to compiled module location
   */
  private resolveMCPServerPath(filename: string): string {
    // Get the directory of this file using import.meta.url
    const currentFileUrl = import.meta.url;
    const currentDir = path.dirname(fileURLToPath(currentFileUrl));
    
    // In production: dist/services/mcp/MCPConfigurationService.js
    // MCP servers in: dist/services/providers/claude/
    return path.join(currentDir, '../providers/claude', filename);
  }

}