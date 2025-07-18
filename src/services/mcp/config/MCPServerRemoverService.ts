/**
 * MCP Server Remover
 * Handles removal of MCP servers from configurations across all scopes and platforms
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../../infrastructure/di/types.js';
import { ILoggerService } from '../../../interfaces/core/ILoggerService.js';
import { ClaudeScope, GeminiScope, GeminiMCPConfig } from '../../core/MCPService.js';
import { IMCPConfigPathResolverService } from './MCPConfigPathResolverService.js';
import * as fs from 'node:fs/promises';

export interface IMCPServerRemoverService {
  removeServer(serverName: string): Promise<{ claude: boolean; gemini: boolean }>;
  removeClaudeServer(serverName: string, scope: ClaudeScope): Promise<boolean>;
  removeGeminiServer(serverName: string, scope: GeminiScope): Promise<boolean>;
}

@injectable()
export class MCPServerRemoverService implements IMCPServerRemoverService {
  constructor(
    @inject(TYPES.LoggerService) private logger: ILoggerService,
    @inject(TYPES.MCPConfigPathResolverService) private pathResolver: IMCPConfigPathResolverService
  ) {}

  /**
   * Remove MCP server from all configurations
   */
  async removeServer(serverName: string): Promise<{ claude: boolean; gemini: boolean }> {
    const claudeScopes: ClaudeScope[] = ['local', 'project', 'user'];
    const geminiScopes: GeminiScope[] = ['project', 'user'];
    
    let claudeRemoved = false;
    let geminiRemoved = false;
    
    // Remove from all Claude Code configurations
    for (const scope of claudeScopes) {
      const removed = await this.removeClaudeServer(serverName, scope);
      if (removed) claudeRemoved = true;
    }
    
    // Remove from all Gemini CLI configurations
    for (const scope of geminiScopes) {
      const removed = await this.removeGeminiServer(serverName, scope);
      if (removed) geminiRemoved = true;
    }
    
    return { claude: claudeRemoved, gemini: geminiRemoved };
  }

  /**
   * Remove MCP server from Claude Code configuration
   */
  async removeClaudeServer(serverName: string, scope: ClaudeScope): Promise<boolean> {
    const configPath = this.pathResolver.getClaudeConfigPath(scope);
    
    try {
      const data = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(data);
      
      let removed = false;
      
      if (scope === 'local') {
        // For local scope, remove from project section
        const projectPath = process.cwd();
        if (config.projects?.[projectPath]?.mcpServers?.[serverName]) {
          delete config.projects[projectPath].mcpServers[serverName];
          removed = true;
        }
      } else {
        // For project and user scope, remove from mcpServers
        if (config.mcpServers && config.mcpServers[serverName]) {
          delete config.mcpServers[serverName];
          removed = true;
        }
      }
      
      if (removed) {
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
        this.logger.info(`Removed MCP server '${serverName}' from Claude ${scope} scope`);
        return true;
      }
    } catch (error) {
      // File doesn't exist or is invalid
      this.logger.debug(`Failed to remove server '${serverName}' from Claude ${scope} config: ${error}`);
    }
    
    return false;
  }

  /**
   * Remove MCP server from Gemini CLI configuration
   */
  async removeGeminiServer(serverName: string, scope: GeminiScope): Promise<boolean> {
    const configPath = this.pathResolver.getGeminiConfigPath(scope);
    
    try {
      const data = await fs.readFile(configPath, 'utf-8');
      const config: GeminiMCPConfig = JSON.parse(data);
      
      if (config.mcpServers && config.mcpServers[serverName]) {
        delete config.mcpServers[serverName];
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
        this.logger.info(`Removed MCP server '${serverName}' from Gemini ${scope} scope`);
        return true;
      }
    } catch (error) {
      // File doesn't exist or is invalid
      this.logger.debug(`Failed to remove server '${serverName}' from Gemini ${scope} config: ${error}`);
    }
    
    return false;
  }
}