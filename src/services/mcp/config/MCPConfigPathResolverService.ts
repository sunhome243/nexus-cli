/**
 * MCP Config Path Resolver
 * Handles all MCP configuration file path resolution for Claude and Gemini
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../../infrastructure/di/types.js';
import { ILoggerService } from '../../../interfaces/core/ILoggerService.js';
import { ClaudeScope, GeminiScope } from '../../../services/core/MCPService.js';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { homedir } from 'node:os';

export interface IMCPConfigPathResolverService {
  getStandardMCPConfigPath(): string;
  getClaudeConfigPath(scope: ClaudeScope): string;
  getGeminiConfigPath(scope: GeminiScope): string;
  getAvailableClaudeConfigs(): Promise<Array<{ scope: ClaudeScope; path: string }>>;
  getPrimaryClaudeConfigPath(): Promise<string>;
}

@injectable()
export class MCPConfigPathResolverService implements IMCPConfigPathResolverService {
  constructor(
    @inject(TYPES.LoggerService) private logger: ILoggerService
  ) {}

  /**
   * Get standard MCP configuration path
   */
  getStandardMCPConfigPath(): string {
    return path.join(homedir(), '.claude.json');
  }


  /**
   * Get the appropriate config file path for Claude Code based on scope
   */
  getClaudeConfigPath(scope: ClaudeScope): string {
    switch (scope) {
      case 'local':
        return path.join(homedir(), '.claude.json');
      case 'project':
        return path.join(process.cwd(), '.mcp.json');
      case 'user':
        return path.join(homedir(), '.claude', 'mcp.json');
      default:
        return path.join(homedir(), '.claude.json');
    }
  }

  /**
   * Get the appropriate config file path for Gemini CLI based on scope
   */
  getGeminiConfigPath(scope: GeminiScope): string {
    switch (scope) {
      case 'project':
        return path.join(process.cwd(), '.gemini', 'settings.json');
      case 'user':
        return path.join(homedir(), '.gemini', 'settings.json');
      default:
        return path.join(process.cwd(), '.gemini', 'settings.json');
    }
  }

  /**
   * Get all available Claude MCP config paths (that exist)
   */
  async getAvailableClaudeConfigs(): Promise<Array<{ scope: ClaudeScope; path: string }>> {
    const scopes: ClaudeScope[] = ['local', 'project', 'user'];
    const available: Array<{ scope: ClaudeScope; path: string }> = [];
    
    for (const scope of scopes) {
      const configPath = this.getClaudeConfigPath(scope);
      try {
        await fs.access(configPath);
        available.push({ scope, path: configPath });
      } catch (error) {
        // File doesn't exist, skip it
      }
    }
    
    return available;
  }

  /**
   * Get the most appropriate Claude config path for CLI usage
   */
  async getPrimaryClaudeConfigPath(): Promise<string> {
    const available = await this.getAvailableClaudeConfigs();
    
    if (available.length === 0) {
      // Create default local config
      return this.getClaudeConfigPath('local');
    }
    
    // Prefer local, then project, then user
    const preferred = available.find(c => c.scope === 'local') ||
                     available.find(c => c.scope === 'project') ||
                     available[0];
    
    return preferred.path;
  }
}