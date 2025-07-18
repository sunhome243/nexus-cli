/**
 * Claude Process Service - CLI process management for Claude provider
 * 
 * @class ClaudeProcessService
 * @extends {BaseProvider}
 * @description Handles Claude CLI process management including command execution, lifecycle, and timeout handling.
 * Extracted from ClaudeProvider to reduce complexity and improve process isolation.
 */

import { injectable, inject } from "inversify";
import { TYPES } from "../../../../infrastructure/di/types.js";
import { ILoggerService } from "../../../../interfaces/core/ILoggerService.js";
import { IPermissionRequest } from "../../../../interfaces/core/IProvider.js";
import { IModelService } from "../../../../interfaces/core/IModelService.js";
import { BaseProvider } from "../../shared/BaseProvider.js";
import { spawn, ChildProcess } from "node:child_process";
import * as path from "node:path";
import * as os from "node:os";
import { StreamingCallbacks } from "../../types.js";
import { 
  validateModelName, 
  validateSessionId, 
  validatePermissionMode,
  validateMessage,
  sanitizeFilePath
} from "../../../../utils/commandSecurity.js";
import { IModelConfigManager, ProviderType } from "../../../../abstractions/providers/index.js";

/**
 * Process execution options interface
 */
export interface ProcessOptions {
  cwd?: string;
  timeout?: number;
  env?: NodeJS.ProcessEnv;
}

/**
 * Process execution result interface
 */
export interface ProcessResult {
  success: boolean;
  exitCode?: number;
  error?: string;
  stderr?: string;
}

/**
 * Claude command arguments interface
 */
export interface ClaudeCommandArgs {
  sessionId?: string | undefined;
  model: string;
  message: string;
  mcpConfigPath: string;
  permissionMode: string;
  forceNewSession?: boolean;
}

/**
 * Claude Process Service implementation
 * 
 * @class ClaudeProcessService
 * @extends {BaseProvider}
 * @description Manages Claude CLI process execution, command validation, and process lifecycle.
 * Provides secure command execution with validation and timeout handling.
 */
@injectable()
export class ClaudeProcessService extends BaseProvider {
  private currentProcess: ChildProcess | null = null;
  private readonly defaultTimeout = 900000; // 15 minutes

  constructor(
    @inject(TYPES.LoggerService) logger?: ILoggerService,
    @inject(TYPES.ModelService) private modelService?: IModelService,
    @inject(TYPES.ModelConfigManager) private modelConfigManager?: IModelConfigManager
  ) {
    super();
    if (logger) {
      this.setLogger(logger);
    }
  }

  async initialize(): Promise<void> {
    await this.verifyClaudeCLI();
    this.setInitialized(true);
    this.logInfo('Claude Process Service initialized');
  }

  async cleanup(): Promise<void> {
    await this.killCurrentProcess();
    this.setInitialized(false);
    this.logInfo('Claude Process Service cleaned up');
  }

  /**
   * Execute Claude streaming command
   */
  async executeStreamingCommand(
    commandArgs: ClaudeCommandArgs,
    callbacks: StreamingCallbacks,
    options: ProcessOptions = {}
  ): Promise<ProcessResult> {
    this.ensureInitialized();

    const args = this.buildCommandArgs(commandArgs);
    const processOptions = {
      cwd: options.cwd || process.cwd(),
      timeout: options.timeout || this.defaultTimeout,
      env: options.env || process.env
    };

    return new Promise((resolve) => {
      this.logDebug("Spawning Claude CLI process", { args: args.join(" "), cwd: processOptions.cwd });
      
      // Use absolute path to Claude to avoid node_modules conflicts
      const claudeCommand = path.join(os.homedir(), ".claude", "local", "claude");
      const child = spawn(claudeCommand, args, {
        cwd: processOptions.cwd,
        stdio: ["pipe", "pipe", "pipe"],
        env: processOptions.env,
      });

      this.currentProcess = child;
      let stderr = "";
      let resolved = false;

      // Set up timeout
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.logError("Claude CLI command timed out - killing process");
          child.kill('SIGKILL');
          callbacks.onError?.("Command timed out");
          resolve({
            success: false,
            error: "Command timed out",
          });
        }
      }, processOptions.timeout);

      // Handle stdout - streaming JSON responses
      child.stdout?.on("data", (data) => {
        const chunk = data.toString();
        this.logDebug("Claude CLI stdout chunk received", { size: chunk.length });
        
        // Forward to streaming parser via callbacks
        if (callbacks.onStreamChunk) {
          callbacks.onStreamChunk(chunk);
        }
      });

      // Handle stderr
      child.stderr?.on("data", (data) => {
        const stderrData = data.toString();
        stderr += stderrData;

        this.logDebug("Claude CLI stderr output", { data: stderrData });

        // Process stderr for special MCP messages or permission requests
        this.processMCPMessages(stderrData, callbacks);
      });

      // Handle process completion
      child.on("close", (code) => {
        this.currentProcess = null;

        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);

          this.logInfo(`Claude streaming process exited with code ${code}`);

          if (code === 0) {
            // Don't trigger onComplete here - streaming service handles it via result message
            resolve({ success: true, exitCode: code });
          } else {
            callbacks.onError?.(`Claude CLI exited with code ${code}`);
            resolve({
              success: false,
              error: `Command failed with code ${code}`,
              exitCode: code || undefined,
              stderr,
            });
          }
        }
      });

      // Handle process errors
      child.on("error", (error) => {
        this.logError("Claude CLI process error", error);
        this.currentProcess = null;

        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          callbacks.onError?.(error.message);
          resolve({
            success: false,
            error: error.message,
          });
        }
      });

      // Close stdin - Claude CLI uses MCP server for permissions, not stdin
      child.stdin?.end();

      // Handle abort signal
      if (callbacks.abortController?.signal) {
        callbacks.abortController.signal.addEventListener('abort', () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            this.logInfo("Stream cancelled by user");
            child.kill('SIGTERM');
            callbacks.onError?.("Stream cancelled by user");
            resolve({
              success: false,
              error: "Stream cancelled by user"
            });
          }
        });
      }
    });
  }

  /**
   * Execute basic Claude command (non-streaming)
   */
  async executeBasicCommand(args: string[]): Promise<ProcessResult> {
    this.ensureInitialized();

    return new Promise((resolve) => {
      // Use absolute path to Claude to avoid node_modules conflicts
      const claudeCommand = path.join(os.homedir(), ".claude", "local", "claude");
      const child = spawn(claudeCommand, args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stderr = "";

      child.stdout?.on("data", () => {
        // Consume stdout but don't process for basic commands
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        resolve({ 
          success: code === 0, 
          exitCode: code || undefined,
          stderr: stderr || undefined
        });
      });

      child.on("error", (error) => {
        resolve({ 
          success: false, 
          error: error.message,
          stderr: stderr || undefined
        });
      });

      child.stdin?.end();
    });
  }

  /**
   * Kill current process if running
   */
  async killCurrentProcess(): Promise<void> {
    if (this.currentProcess) {
      this.logInfo("Killing current Claude process");
      
      // Close stdin before killing process
      if (this.currentProcess.stdin && !this.currentProcess.stdin.destroyed) {
        this.currentProcess.stdin.end();
      }
      
      this.currentProcess.kill('SIGTERM');
      
      // Give it a moment to terminate gracefully, then force kill
      setTimeout(() => {
        if (this.currentProcess && !this.currentProcess.killed) {
          this.currentProcess.kill('SIGKILL');
        }
      }, 5000);
      
      this.currentProcess = null;
    }
  }

  /**
   * Check if process is currently running
   */
  isProcessRunning(): boolean {
    return this.currentProcess !== null && !this.currentProcess.killed;
  }

  /**
   * Get current process PID
   */
  getCurrentProcessPid(): number | undefined {
    return this.currentProcess?.pid;
  }

  /**
   * Build command arguments for Claude CLI
   */
  private buildCommandArgs(commandArgs: ClaudeCommandArgs): string[] {
    // Validate all inputs to prevent command injection
    const modelValidation = validateModelName(commandArgs.model, ProviderType.CLAUDE, this.modelConfigManager);
    if (!modelValidation.isValid) {
      throw new Error(`Invalid model name: ${modelValidation.error}`);
    }

    if (commandArgs.sessionId) {
      const sessionValidation = validateSessionId(commandArgs.sessionId);
      if (!sessionValidation.isValid) {
        throw new Error(`Invalid session ID: ${sessionValidation.error}`);
      }
    }

    const permissionValidation = validatePermissionMode(commandArgs.permissionMode);
    if (!permissionValidation.isValid) {
      throw new Error(`Invalid permission mode: ${permissionValidation.error}`);
    }

    const messageValidation = validateMessage(commandArgs.message);
    if (!messageValidation.isValid) {
      throw new Error(`Invalid message: ${messageValidation.error}`);
    }

    // Sanitize file path only (message is kept as-is for full user access)
    const safeMcpConfigPath = sanitizeFilePath(commandArgs.mcpConfigPath);

    const args: string[] = ["-p"];

    // Add model (already validated)
    args.push("--model", commandArgs.model);

    // Add session handling (already validated)
    if (commandArgs.sessionId && !commandArgs.forceNewSession) {
      args.push("--resume", commandArgs.sessionId);
    }

    // Add message (validated but not modified - users have full access)
    args.push("--print", commandArgs.message);

    // Add output format and verbosity
    args.push("--output-format", "stream-json", "--verbose");

    // Add MCP configuration (sanitized path)
    args.push("--mcp-config", safeMcpConfigPath);

    // Add permission settings (already validated)
    args.push(
      "--allowedTools", "mcp__permission__approval_prompt",
      "--permission-prompt-tool", "mcp__permission__approval_prompt",
      "--permission-mode", commandArgs.permissionMode
    );

    return args;
  }

  /**
   * Process MCP messages from stderr
   */
  private processMCPMessages(stderrData: string, callbacks: StreamingCallbacks): void {
    // Look for MCP server messages
    if (this.isMCPMessage(stderrData)) {
      this.logDebug("MCP Server message detected", { data: stderrData });
    }

    // Look for permission requests from MCP server
    if (stderrData.includes("PERMISSION_REQUEST:")) {
      // Fire and forget - don't await to avoid blocking stderr processing
      this.processPermissionRequest(stderrData, callbacks).catch(error => {
        this.logError("Error processing permission request", error);
      });
    }
  }

  /**
   * Check if stderr data is an MCP message
   */
  private isMCPMessage(data: string): boolean {
    return data.includes("MCP Permission Server") ||
           data.includes("MCP [") ||
           data.includes("🚀") ||
           data.includes("🔧") ||
           data.includes("🔌");
  }

  /**
   * Process permission request from MCP server
   */
  private async processPermissionRequest(stderrData: string, callbacks: StreamingCallbacks): Promise<void> {
    try {
      const permissionMatch = stderrData.match(/PERMISSION_REQUEST:(\{.*?\})/);
      if (permissionMatch) {
        const permissionData = JSON.parse(permissionMatch[1]);
        
        this.logInfo("MCP permission request detected", {
          tool: permissionData.tool,
          toolUseId: permissionData.toolUseId
        });
        
        // Debug: Log the full permission data structure
        this.logInfo("🔍 Full permission data structure:", permissionData);
        
        // Emit permission request to UI via callbacks
        // Since ClaudeStreamParser no longer emits permission requests,
        // MCP server stderr is now the primary source
        if (callbacks.onPermissionRequest) {
          this.logInfo("🔍 ClaudeProcessService calling onPermissionRequest callback");
          try {
            // Transform MCP permission data to IPermissionRequest interface with enhanced description
            const enhancedDescription = this.createEnhancedDescription(
              permissionData.tool, 
              permissionData.args || {}, 
              permissionData.description
            );
            
            const callbackRequest = {
              toolName: permissionData.tool,
              args: permissionData.args || {},
              description: enhancedDescription,
              toolUseId: permissionData.toolUseId
            };
            
            this.logInfo("🔍 Transformed permission request:", callbackRequest);
            await callbacks.onPermissionRequest(callbackRequest);
            this.logInfo("🔍 ClaudeProcessService onPermissionRequest callback completed");
          } catch (error) {
            this.logError("Failed to handle permission request", error);
          }
        } else {
          this.logWarn("🔍 ClaudeProcessService: No onPermissionRequest callback available!");
        }
      }
    } catch (error) {
      this.logError("Failed to parse permission request from stderr", error);
    }
  }

  /**
   * Verify Claude CLI is available (used during initialization)
   */
  private async verifyClaudeCLI(): Promise<void> {
    try {
      const result = await this.executeBasicCommandWithoutInitCheck(["--version"]);
      if (!result.success) {
        throw new Error("Claude CLI not found in PATH");
      }
    } catch (error) {
      throw new Error(`Failed to verify Claude CLI: ${error}`);
    }
  }

  /**
   * Execute basic Claude command without initialization check (for internal use during initialization)
   */
  private async executeBasicCommandWithoutInitCheck(args: string[]): Promise<ProcessResult> {
    return new Promise((resolve) => {
      // Use absolute path to Claude to avoid node_modules conflicts
      const claudeCommand = path.join(os.homedir(), ".claude", "local", "claude");
      const child = spawn(claudeCommand, args, {
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stderr = "";

      child.stdout?.on("data", () => {
        // Consume stdout but don't process for basic commands
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        resolve({ 
          success: code === 0, 
          exitCode: code || undefined,
          stderr: stderr || undefined
        });
      });

      child.on("error", (error) => {
        resolve({ 
          success: false, 
          error: error.message,
          stderr: stderr || undefined
        });
      });

      child.stdin?.end();
    });
  }

  /**
   * Create enhanced description for Claude permission prompts
   */
  private createEnhancedDescription(
    toolName: string, 
    args: Record<string, unknown>, 
    originalDescription?: string
  ): string {
    // Start with tool name
    let description = toolName;
    
    // Add specific argument information for common tools
    switch (toolName) {
      case 'Read':
        if (args.file_path && typeof args.file_path === 'string') {
          description = `Read: ${args.file_path}`;
        }
        break;
      case 'Write':
        if (args.file_path && typeof args.file_path === 'string') {
          description = `Write: ${args.file_path}`;
        }
        break;
      case 'Edit':
      case 'MultiEdit':
        if (args.file_path && typeof args.file_path === 'string') {
          description = `Edit: ${args.file_path}`;
        }
        break;
      case 'Bash':
        if (args.command && typeof args.command === 'string') {
          // Truncate long commands for display
          const command = args.command.length > 50 
            ? `${args.command.substring(0, 50)}...` 
            : args.command;
          description = `Bash: ${command}`;
        }
        break;
      case 'LS':
        if (args.path && typeof args.path === 'string') {
          description = `LS: ${args.path}`;
        }
        break;
      case 'Grep':
        if (args.pattern && typeof args.pattern === 'string') {
          const searchPath = args.path && typeof args.path === 'string' ? ` in ${args.path}` : '';
          description = `Grep: "${args.pattern}"${searchPath}`;
        }
        break;
      case 'Glob':
        if (args.pattern && typeof args.pattern === 'string') {
          description = `Glob: ${args.pattern}`;
        }
        break;
      case 'TodoWrite':
        description = 'TodoWrite: Update todo list';
        break;
      case 'TodoRead':
        description = 'TodoRead: Read todo list';
        break;
      default:
        // For MCP tools or unknown tools, show the first argument if available
        if (args && Object.keys(args).length > 0) {
          const firstKey = Object.keys(args)[0];
          const firstValue = args[firstKey];
          if (typeof firstValue === 'string' && firstValue.length <= 100) {
            description = `${toolName}: ${firstValue}`;
          } else if (typeof firstValue === 'string') {
            description = `${toolName}: ${firstValue.substring(0, 100)}...`;
          }
        }
        break;
    }
    
    // If we have an original description and it's different/more informative, append it
    if (originalDescription && originalDescription !== description && originalDescription !== toolName) {
      description += ` (${originalDescription})`;
    }
    
    return description;
  }

  /**
   * Get current model flag from ModelService
   */
  getModelFlag(): string {
    if (this.modelService) {
      return this.modelService.getClaudeCliModelFlag();
    }
    // Fallback to default model from config
    if (this.modelConfigManager) {
      return this.modelConfigManager.getDefaultModel(ProviderType.CLAUDE);
    }
    return 'sonnet'; // Hard fallback
  }

}