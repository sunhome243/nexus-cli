/**
 * MCP Config Validator
 * Handles validation and existence checking for MCP server configurations
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../../infrastructure/di/types.js';
import { ILoggerService } from '../../../interfaces/core/ILoggerService.js';
import { ClaudeMCPConfig } from '../../core/MCPService.js';
import { IMCPConfigPathResolverService } from './MCPConfigPathResolverService.js';
import { IMCPConfigLoaderService } from './MCPConfigLoaderService.js';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

export interface IMCPConfigValidatorService {
  serverExists(serverName: string): Promise<boolean>;
  ensureClaudeConfig(): Promise<string>;
}

@injectable()
export class MCPConfigValidatorService implements IMCPConfigValidatorService {
  constructor(
    @inject(TYPES.LoggerService) private logger: ILoggerService,
    @inject(TYPES.MCPConfigPathResolverService) private pathResolver: IMCPConfigPathResolverService,
    @inject(TYPES.MCPConfigLoaderService) private configLoader: IMCPConfigLoaderService
  ) {}

  /**
   * Check if a server name already exists
   */
  async serverExists(serverName: string): Promise<boolean> {
    const servers = await this.configLoader.loadAllServers();
    return servers.some(server => server.name === serverName);
  }

  /**
   * Ensure a minimal Claude config exists for CLI usage
   */
  async ensureClaudeConfig(): Promise<string> {
    const configPath = await this.pathResolver.getPrimaryClaudeConfigPath();
    
    try {
      await fs.access(configPath);
    } catch (error) {
      // Create minimal config
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      const minimalConfig: ClaudeMCPConfig = { mcpServers: {} };
      await fs.writeFile(configPath, JSON.stringify(minimalConfig, null, 2));
      this.logger.info(`Created minimal Claude config at ${configPath}`);
    }
    
    return configPath;
  }
}