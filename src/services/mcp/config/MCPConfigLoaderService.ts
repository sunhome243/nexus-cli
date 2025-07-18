/**
 * MCP Config Loader Service - Configuration loading and parsing
 * 
 * @class MCPConfigLoaderService
 * @implements {IMCPConfigLoaderService}
 * @description Handles loading MCP server configurations from various sources and scopes.
 * Provides unified loading interface for both Claude and Gemini configurations.
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../../infrastructure/di/types.js';
import { ILoggerService } from '../../../interfaces/core/ILoggerService.js';
import { MCPServer, ClaudeMCPConfig, GeminiMCPConfig, ClaudeScope, GeminiScope, TransportType } from '../../core/MCPService.js';
import { IMCPConfigPathResolverService } from './MCPConfigPathResolverService.js';
import * as fs from 'node:fs/promises';

/**
 * MCP Config Loader Service interface
 */
export interface IMCPConfigLoaderService {
  loadAllServers(): Promise<MCPServer[]>;
  loadServersByScope(): Promise<{
    claudeLocal: MCPServer[];
    claudeProject: MCPServer[];
    claudeUser: MCPServer[];
    geminiProject: MCPServer[];
    geminiUser: MCPServer[];
  }>;
  loadClaudeConfig(configPath: string, scope?: ClaudeScope): Promise<MCPServer[]>;
  loadGeminiConfig(configPath: string): Promise<MCPServer[]>;
}

/**
 * MCP Config Loader Service implementation
 * 
 * @class MCPConfigLoaderService
 * @implements {IMCPConfigLoaderService}
 * @description Loads and parses MCP server configurations from file system.
 * Handles both Claude and Gemini configuration formats with scope-based organization.
 */
@injectable()
export class MCPConfigLoaderService implements IMCPConfigLoaderService {
  constructor(
    @inject(TYPES.LoggerService) private logger: ILoggerService,
    @inject(TYPES.MCPConfigPathResolverService) private pathResolver: IMCPConfigPathResolverService
  ) {}

  /**
   * Load all MCP servers from file configurations
   */
  async loadAllServers(): Promise<MCPServer[]> {
    // Load Claude servers from files
    const claudeServers = await this.loadClaudeServersFromFiles();
    
    // Load Gemini servers from files
    const geminiServers = await this.loadGeminiServersFromFiles();
    
    // Merge results
    const allServers = new Map<string, MCPServer>();
    
    // Add Claude servers
    claudeServers.forEach(server => {
      allServers.set(server.name, server);
    });
    
    // Add/merge Gemini servers
    geminiServers.forEach(server => {
      const existing = allServers.get(server.name);
      if (existing) {
        // Merge with existing
        allServers.set(server.name, {
          ...existing,
          geminiCLI: true,
          geminiScope: server.geminiScope
        });
      } else {
        allServers.set(server.name, server);
      }
    });
    
    return Array.from(allServers.values());
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
    const result = {
      claudeLocal: [] as MCPServer[],
      claudeProject: [] as MCPServer[],
      claudeUser: [] as MCPServer[],
      geminiProject: [] as MCPServer[],
      geminiUser: [] as MCPServer[]
    };

    // For scope-organized display, we need to use file-based loading for Claude servers
    const claudeLocalPath = this.pathResolver.getClaudeConfigPath('local');
    const claudeProjectPath = this.pathResolver.getClaudeConfigPath('project');
    const claudeUserPath = this.pathResolver.getClaudeConfigPath('user');

    result.claudeLocal = (await this.loadClaudeConfig(claudeLocalPath, 'local')).map(server => ({
      ...server,
      claudeScope: 'local' as ClaudeScope
    }));
    
    result.claudeProject = (await this.loadClaudeConfig(claudeProjectPath, 'project')).map(server => ({
      ...server,
      claudeScope: 'project' as ClaudeScope
    }));
    
    result.claudeUser = (await this.loadClaudeConfig(claudeUserPath, 'user')).map(server => ({
      ...server,
      claudeScope: 'user' as ClaudeScope
    }));

    // Load Gemini CLI servers by scope
    const geminiProjectPath = this.pathResolver.getGeminiConfigPath('project');
    const geminiUserPath = this.pathResolver.getGeminiConfigPath('user');

    result.geminiProject = (await this.loadGeminiConfig(geminiProjectPath)).map(server => ({
      ...server,
      geminiScope: 'project' as GeminiScope
    }));
    
    result.geminiUser = (await this.loadGeminiConfig(geminiUserPath)).map(server => ({
      ...server,
      geminiScope: 'user' as GeminiScope
    }));

    return result;
  }

  /**
   * Load Claude Code MCP servers from a specific config file
   */
  async loadClaudeConfig(configPath: string, scope?: ClaudeScope): Promise<MCPServer[]> {
    try {
      const data = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(data);
      
      let mcpServers: Record<string, any> = {};
      
      if (scope === 'local') {
        // For local scope, look in projects section
        const projectPath = process.cwd();
        mcpServers = config.projects?.[projectPath]?.mcpServers || {};
        this.logger.debug(`Loading local scope from ${projectPath}`, { 
          projectPath, 
          serverCount: Object.keys(mcpServers).length 
        });
      } else {
        // For project and user scope, use mcpServers directly
        mcpServers = config.mcpServers || {};
        this.logger.debug(`Loading ${scope} scope`, { 
          scope, 
          serverCount: Object.keys(mcpServers).length 
        });
      }
      
      return Object.entries(mcpServers).map(([name, server]) => {
        // Determine transport type
        let transport: TransportType = 'stdio';
        if (server.url) {
          transport = server.url.includes('/sse') ? 'SSE' : 'HTTP';
        }

        return {
          name,
          transport,
          command: server.command,
          url: server.url,
          args: server.args || [],
          env: server.env || {},
          timeout: server.timeout || 30000,
          headers: server.headers,
          claudeCode: true,
          geminiCLI: false
        };
      });
    } catch (error) {
      this.logger.warn(`Failed to load ${scope} scope from ${configPath}:`, { 
        scope, 
        configPath, 
        error 
      });
      // File doesn't exist or is invalid
      return [];
    }
  }

  /**
   * Load Gemini CLI MCP servers from a specific config file
   */
  async loadGeminiConfig(configPath: string): Promise<MCPServer[]> {
    try {
      const data = await fs.readFile(configPath, 'utf-8');
      const config: GeminiMCPConfig = JSON.parse(data);
      
      return Object.entries(config.mcpServers || {}).map(([name, server]) => ({
        name,
        transport: 'stdio' as TransportType, // Gemini CLI only supports stdio
        command: server.command,
        args: server.args || [],
        env: server.env || {},
        timeout: server.timeout || 30000,
        claudeCode: false,
        geminiCLI: true
      }));
    } catch (error) {
      // File doesn't exist or is invalid
      return [];
    }
  }

  /**
   * Load Claude Code servers from files
   */
  private async loadClaudeServersFromFiles(): Promise<MCPServer[]> {
    const allServers = new Map<string, MCPServer>();
    
    // Load Claude Code servers from all scopes
    const claudeScopes: ClaudeScope[] = ['local', 'project', 'user'];
    for (const scope of claudeScopes) {
      const configPath = this.pathResolver.getClaudeConfigPath(scope);
      const servers = await this.loadClaudeConfig(configPath, scope);
      
      servers.forEach(server => {
        const existing = allServers.get(server.name);
        if (existing) {
          // Merge with existing
          allServers.set(server.name, {
            ...existing,
            claudeCode: true,
            claudeScope: scope
          });
        } else {
          allServers.set(server.name, {
            ...server,
            claudeScope: scope
          });
        }
      });
    }
    
    return Array.from(allServers.values());
  }

  /**
   * Load Gemini CLI servers from files
   */
  private async loadGeminiServersFromFiles(): Promise<MCPServer[]> {
    const allServers: MCPServer[] = [];
    
    // Load Gemini CLI servers from all scopes
    const geminiScopes: GeminiScope[] = ['project', 'user'];
    for (const scope of geminiScopes) {
      const configPath = this.pathResolver.getGeminiConfigPath(scope);
      const servers = await this.loadGeminiConfig(configPath);
      
      servers.forEach(server => {
        allServers.push({
          ...server,
          geminiScope: scope
        });
      });
    }
    
    return allServers;
  }

}