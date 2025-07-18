/**
 * Gemini Configuration Service
 * Handles configuration loading, MCP setup, and authentication for Gemini provider
 * Extracted from GeminiProvider.ts to reduce complexity
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../../../infrastructure/di/types.js';
import { ILoggerService } from '../../../../interfaces/core/ILoggerService.js';
import { BaseProvider } from '../../shared/BaseProvider.js';
import { 
  Config, 
  GeminiClient, 
  AuthType, 
  ToolRegistry,
  DEFAULT_GEMINI_MODEL,
  ApprovalMode
} from "@google/gemini-cli-core";
import { GeminiMCPServerConfig } from '../../../core/MCPService.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir, platform } from 'os';
import stripJsonComments from 'strip-json-comments';
import { fileURLToPath } from 'url';

@injectable()
export class GeminiConfigurationService extends BaseProvider {
  private config: Config | null = null;
  private client: GeminiClient | null = null;
  private toolRegistry: ToolRegistry | null = null;

  constructor(@inject(TYPES.LoggerService) logger: ILoggerService) {
    super();
    this.setLogger(logger);
  }

  async initialize(): Promise<void> {
    if (this.isProviderInitialized()) {
      return;
    }

    try {
      this.logInfo('Initializing Gemini Configuration Service');
      await this.initializeGeminiCore();
      this.setInitialized(true);
      this.logInfo('Gemini Configuration Service initialized successfully');
    } catch (error) {
      const err = this.wrapError(error);
      this.logError('Failed to initialize Gemini Configuration Service', err);
      throw err;
    }
  }

  async cleanup(): Promise<void> {
    try {
      this.logInfo('Cleaning up Gemini Configuration Service');
      this.config = null;
      this.client = null;
      this.toolRegistry = null;
      this.setInitialized(false);
      this.logInfo('Gemini Configuration Service cleaned up successfully');
    } catch (error) {
      const err = this.wrapError(error);
      this.logError('Failed to cleanup Gemini Configuration Service', err);
    }
  }

  getConfig(): Config | null {
    this.logDebug("getConfig called", {
      hasConfig: !!this.config,
      configType: this.config?.constructor?.name,
      isInitialized: this.isProviderInitialized()
    });
    return this.config;
  }

  getClient(): GeminiClient | null {
    return this.client;
  }

  getToolRegistry(): ToolRegistry | null {
    return this.toolRegistry;
  }

  /**
   * Initialize Gemini core components
   */
  private async initializeGeminiCore(): Promise<void> {
    let authType = AuthType.USE_GEMINI;
    
    // Map permission mode to approval mode
    const getApprovalMode = (): ApprovalMode => {
      const permissionMode = process.env.PERMISSION_MODE || 'default';
      switch (permissionMode) {
        case 'auto':
        case 'yolo':
          return ApprovalMode.YOLO; // Full auto-approval
        case 'plan':
          return ApprovalMode.DEFAULT; // Always ask
        default:
          return ApprovalMode.DEFAULT;
      }
    };

    // Load Gemini settings and merge with our askModel server
    let mcpServers: Record<string, GeminiMCPServerConfig> | undefined;
    try {
      // Load existing Gemini settings
      const geminiSettings = await this.loadGeminiSettings();
      
      // Get existing MCP servers from settings
      const existingMcpServers = geminiSettings.mcpServers || {};
      
      // Add our askModel server (but NOT the permission server)
      // Point to claude directory relative to current location (works for both src and dist)
      const crossProviderServerPath = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        '../../claude/mcp-crossprovider-server.cjs'
      );
      
      mcpServers = {
        ...existingMcpServers,
        crossProvider: { // Renamed to avoid askModel__askModel naming conflict
          command: process.execPath || 'node',
          args: [crossProviderServerPath],
          env: {
            SESSION_ID: 'default',
            PERMISSION_MODE: process.env.PERMISSION_MODE || 'default'
          }
        }
      };
      
      this.logInfo('Configured MCP servers for Gemini', { 
        serverCount: Object.keys(mcpServers || {}).length,
        servers: Object.keys(mcpServers || {}),
        crossProviderServerPath: crossProviderServerPath
      });
      
      // Debug: Log full MCP server configuration
      this.logDebug(`Full MCP servers config: ${JSON.stringify(mcpServers, null, 2)}`);
    } catch (error) {
      this.logWarn('Failed to configure MCP servers, continuing without them', error);
    }

    // Initialize core Config
    this.logInfo("Creating Config instance", {
      sessionId: "gemini-ui-session",
      model: DEFAULT_GEMINI_MODEL,
      approvalMode: getApprovalMode()
    });
    
    this.config = new Config({
      sessionId: "gemini-ui-session",
      targetDir: process.cwd(),
      debugMode: false,
      cwd: process.cwd(),
      model: DEFAULT_GEMINI_MODEL,
      approvalMode: getApprovalMode(),
      mcpServers: mcpServers
    });
    
    this.logInfo("Config instance created", {
      hasConfig: !!this.config,
      configType: this.config?.constructor?.name,
      hasSetFlashFallbackHandler: typeof this.config?.setFlashFallbackHandler === 'function'
    });

    // Initialize the config to set up internal state including toolRegistry
    await this.config.initialize();
    
    this.logInfo("Config initialized", {
      hasConfig: !!this.config,
      hasToolRegistry: !!(await this.config?.getToolRegistry())
    });

    // Check for available authentication
    if (!process.env.GEMINI_API_KEY) {
      this.logWarn("GEMINI_API_KEY not found, falling back to LOGIN_WITH_GOOGLE");
      authType = AuthType.LOGIN_WITH_GOOGLE;
    }

    // Initialize authentication and client
    await this.config.refreshAuth(authType);
    this.client = this.config.getGeminiClient();

    if (!this.client) {
      throw new Error("Failed to initialize Gemini client");
    }

    // Get tool registry from Config (it automatically registers all tools)
    this.toolRegistry = await this.config.getToolRegistry();
    this.logInfo(`Tool registry retrieved: ${this.toolRegistry ? 'exists' : 'null'}, type: ${typeof this.toolRegistry}`);
    
    if (this.toolRegistry) {
      this.logInfo(`Tool registry methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(this.toolRegistry)).join(', ')}`);
      
      // Debug: Log all discovered tools
      try {
        const allTools = this.toolRegistry.getAllTools();
        this.logInfo(`[DEBUG] Total tools discovered: ${allTools.length}`);
        
        const toolNames = allTools.map(tool => tool.name || 'unnamed');
        this.logInfo(`[DEBUG] All tool names: ${toolNames.join(', ')}`);
        
        // Check specifically for askModel variations
        const askModelTools = toolNames.filter(name => name.includes('askModel'));
        this.logInfo(`[DEBUG] askModel-related tools: ${askModelTools.join(', ')}`);
        
        // Check for MCP tools
        const mcpTools = toolNames.filter(name => name.startsWith('mcp__') || name.includes('__'));
        this.logInfo(`[DEBUG] MCP-pattern tools: ${mcpTools.join(', ')}`);
        
      } catch (error) {
        this.logWarn(`[DEBUG] Failed to enumerate tools: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    this.logInfo("Gemini core components initialized");
  }

  /**
   * Load Gemini settings from standard locations
   * Mimics Gemini CLI's settings loading behavior
   */
  private async loadGeminiSettings(): Promise<Record<string, unknown>> {
    const settings: Record<string, unknown> = {};
    
    // Define settings paths (matching Gemini CLI)
    const systemPath = platform() === 'darwin' 
      ? '/Library/Application Support/GeminiCli/settings.json'
      : platform() === 'win32'
      ? 'C:\\ProgramData\\gemini-cli\\settings.json'
      : '/etc/gemini-cli/settings.json';
    
    const userPath = path.join(homedir(), '.gemini', 'settings.json');
    const workspacePath = path.join(process.cwd(), '.gemini', 'settings.json');
    
    // Load and merge settings in order: system -> user -> workspace
    for (const settingsPath of [systemPath, userPath, workspacePath]) {
      try {
        const content = await fs.readFile(settingsPath, 'utf-8');
        const parsed = JSON.parse(stripJsonComments(content));
        
        // Resolve environment variables
        const resolved = this.resolveEnvVarsInObject(parsed);
        
        // Merge settings
        Object.assign(settings, resolved);
        
        this.logDebug(`Loaded Gemini settings from ${settingsPath}`);
      } catch (error) {
        // File doesn't exist or parse error - continue to next
        this.logDebug(`No settings found at ${settingsPath}`);
      }
    }
    
    return settings;
  }

  /**
   * Resolve environment variables in settings object
   * Supports $VAR and ${VAR} syntax
   */
  private resolveEnvVarsInObject(obj: unknown): unknown {
    if (typeof obj === 'string') {
      // Replace $VAR or ${VAR} with environment variable value
      return obj.replace(/\$\{?([A-Z_][A-Z0-9_]*)\}?/g, (match, varName) => {
        return process.env[varName] || match;
      });
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.resolveEnvVarsInObject(item));
    } else if (obj && typeof obj === 'object') {
      const resolved: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = this.resolveEnvVarsInObject(value);
      }
      return resolved;
    }
    return obj;
  }
}