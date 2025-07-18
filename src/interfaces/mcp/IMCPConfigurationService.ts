/**
 * MCP Configuration Service Interface
 * Manages MCP server configuration loading and saving across Claude and Gemini platforms
 */

import { MCPServer, ClaudeMCPConfig, GeminiMCPConfig, WizardState, ClaudeScope, GeminiScope } from '../../services/core/MCPService.js';

export interface IMCPConfigurationService {
  // Configuration setup
  ensureStandardMCPConfiguration(): Promise<void>;
  ensureStandardMCPServersInConfig(configPath: string): Promise<void>;
  
  // Claude configuration management
  loadClaudeConfig(configPath: string, scope?: ClaudeScope): Promise<MCPServer[]>;
  getClaudeConfigPath(scope: ClaudeScope): string;
  
  // Gemini configuration management  
  loadGeminiConfig(configPath: string): Promise<MCPServer[]>;
  getGeminiConfigPath(scope: GeminiScope): string;
  
  // Path management
  getStandardMCPConfigPath(): string;
  
  // Configuration orchestration methods
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
}