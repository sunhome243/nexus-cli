/**
 * MCP Config Saver
 * Handles saving MCP server configurations for Claude and Gemini platforms
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../../infrastructure/di/types.js';
import { ILoggerService } from '../../../interfaces/core/ILoggerService.js';
import { ClaudeMCPConfig, GeminiMCPConfig, WizardState, ClaudeScope, GeminiScope } from '../../core/MCPService.js';
import { IMCPConfigPathResolverService } from './MCPConfigPathResolverService.js';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

export interface IMCPConfigSaverService {
  saveServer(config: WizardState): Promise<void>;
  saveClaudeConfig(config: WizardState): Promise<void>;
  saveGeminiConfig(config: WizardState): Promise<void>;
  ensureConfigDirectories(configPath: string): Promise<void>;
}

@injectable()
export class MCPConfigSaverService implements IMCPConfigSaverService {
  constructor(
    @inject(TYPES.LoggerService) private logger: ILoggerService,
    @inject(TYPES.MCPConfigPathResolverService) private pathResolver: IMCPConfigPathResolverService
  ) {}

  /**
   * Save MCP server configuration based on wizard state
   */
  async saveServer(config: WizardState): Promise<void> {
    const promises: Promise<void>[] = [];

    if (config.platforms.claude) {
      promises.push(this.saveClaudeConfig(config));
    }

    if (config.platforms.gemini) {
      if (config.transport !== 'stdio') {
        throw new Error(`Cannot configure Gemini CLI with ${config.transport} transport. Only stdio is supported.`);
      }
      promises.push(this.saveGeminiConfig(config));
    }

    await Promise.all(promises);
  }

  /**
   * Save Claude Code MCP server configuration
   */
  async saveClaudeConfig(config: WizardState): Promise<void> {
    const configPath = this.pathResolver.getClaudeConfigPath(config.claudeScope);
    
    // Ensure directory exists
    await this.ensureConfigDirectories(configPath);
    
    let existingConfig: ClaudeMCPConfig = { mcpServers: {} };
    
    try {
      const data = await fs.readFile(configPath, 'utf-8');
      existingConfig = JSON.parse(data);
    } catch (error) {
      // File doesn't exist, use default
    }
    
    // Prepare server configuration based on transport type
    const serverConfig: {
      command?: string;
      url?: string;
      args?: string[];
      env?: Record<string, string>;
      timeout?: number;
      headers?: Record<string, string>;
    } = {
      timeout: config.advanced.timeout
    };

    if (config.transport === 'stdio') {
      serverConfig.command = config.commandOrUrl.split(' ')[0];
      if (config.advanced.args.length > 0) {
        serverConfig.args = config.advanced.args;
      } else {
        // Parse args from command if not explicitly set
        const commandParts = config.commandOrUrl.split(' ');
        if (commandParts.length > 1) {
          serverConfig.args = commandParts.slice(1);
        }
      }
    } else {
      // SSE or HTTP
      serverConfig.url = config.commandOrUrl;
      if (config.advanced.headers && Object.keys(config.advanced.headers).length > 0) {
        serverConfig.headers = config.advanced.headers;
      }
    }

    if (Object.keys(config.advanced.env).length > 0) {
      serverConfig.env = config.advanced.env;
    }
    
    if (config.claudeScope === 'local') {
      // For local scope, store in project section
      const projectPath = process.cwd();
      existingConfig.projects = existingConfig.projects || {};
      existingConfig.projects[projectPath] = existingConfig.projects[projectPath] || {};
      existingConfig.projects[projectPath].mcpServers = existingConfig.projects[projectPath].mcpServers || {};
      existingConfig.projects[projectPath].mcpServers[config.serverName] = serverConfig;
    } else {
      // For project and user scope, store in mcpServers
      existingConfig.mcpServers = existingConfig.mcpServers || {};
      existingConfig.mcpServers[config.serverName] = serverConfig;
    }
    
    await fs.writeFile(configPath, JSON.stringify(existingConfig, null, 2));
  }

  /**
   * Save Gemini CLI MCP server configuration
   */
  async saveGeminiConfig(config: WizardState): Promise<void> {
    const configPath = this.pathResolver.getGeminiConfigPath(config.geminiScope);
    
    // Ensure directory exists
    await this.ensureConfigDirectories(configPath);
    
    let existingConfig: GeminiMCPConfig = {};
    
    try {
      const data = await fs.readFile(configPath, 'utf-8');
      existingConfig = JSON.parse(data);
    } catch (error) {
      // File doesn't exist, use default
    }
    
    // Gemini CLI only supports stdio transport
    if (config.transport !== 'stdio') {
      throw new Error(`Gemini CLI does not support ${config.transport} transport`);
    }
    
    const commandParts = config.commandOrUrl.split(' ');
    const serverConfig: NonNullable<GeminiMCPConfig['mcpServers']>[string] = {
      command: commandParts[0],
      timeout: config.advanced.timeout
    };

    if (commandParts.length > 1) {
      serverConfig.args = commandParts.slice(1);
    }

    if (config.advanced.args.length > 0) {
      serverConfig.args = config.advanced.args;
    }

    if (Object.keys(config.advanced.env).length > 0) {
      serverConfig.env = config.advanced.env;
    }
    
    existingConfig.mcpServers = existingConfig.mcpServers || {};
    existingConfig.mcpServers[config.serverName] = serverConfig;
    
    await fs.writeFile(configPath, JSON.stringify(existingConfig, null, 2));
  }

  /**
   * Ensure configuration directories exist
   */
  async ensureConfigDirectories(configPath: string): Promise<void> {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
  }
}