/**
 * Gemini Tool Execution Service - Comprehensive tool execution with permission management
 * 
 * @class GeminiToolExecutionService
 * @extends {BaseProvider}
 * @description Handles tool execution, permissions, and tool registry management for Gemini AI.
 * Provides comprehensive permission system with tiered tool classification and user confirmation.
 * Extracted from GeminiCoreAdapter for better modularity.
 */

import { injectable, inject } from "inversify";
import { TYPES } from "../../../../infrastructure/di/types.js";
import { ILoggerService } from "../../../../interfaces/core/ILoggerService.js";
import { BaseProvider } from "../../shared/BaseProvider.js";
import { 
  Config, 
  ToolCallRequestInfo, 
  executeToolCall,
  ToolRegistry,
  ToolConfirmationOutcome 
} from "@google/gemini-cli-core";
import { GeminiPermissionRequest, GeminiToolResponse } from '../types.js';
import { GeminiCoreAdapterCallbacks, ToolExecution, GeminiToolExecutionCompleteData } from "../types.js";
import { getToolTier, getToolDescription } from "../../shared/ToolPermissionManager.js";
import { GeminiToolExecutionResult } from "../../../../interfaces/providers/IGeminiToolExecutionService.js";

// Tool execution response interfaces
// Use GeminiToolResponse from types.ts to avoid duplication

// Use GeminiPermissionRequest from types.ts to avoid duplication

export interface GeminiConfirmationDetails {
  type: 'edit' | 'exec' | 'info';
  title: string;
  fileName?: string;
  isModifying?: boolean;
  command?: string;
  rootCommand?: string;
  prompt?: string;
}

export interface ToolExecutionContext {
  config: Config;
  toolRegistry: ToolRegistry;
  abortSignal: AbortSignal;
}

/**
 * Gemini Tool Execution Service implementation
 * 
 * @class GeminiToolExecutionService
 * @extends {BaseProvider}
 * @description Manages tool execution pipeline with permission requests, validation, and error handling.
 */
@injectable()
export class GeminiToolExecutionService extends BaseProvider {
  constructor(
    @inject(TYPES.LoggerService) logger: ILoggerService
  ) {
    super();
    this.setLogger(logger);
  }

  /**
   * Initialize the tool execution service
   * 
   * @returns {Promise<void>} Initialization completion promise
   */
  async initialize(): Promise<void> {
    this.setInitialized(true);
    this.logInfo("Gemini Tool Execution Service initialized");
    
    // Debug: Log ToolConfirmationOutcome enum values
    this.logInfo('ToolConfirmationOutcome enum values:', {
      Cancel: ToolConfirmationOutcome.Cancel,
      ProceedOnce: ToolConfirmationOutcome.ProceedOnce,
      ProceedAlways: (ToolConfirmationOutcome as any).ProceedAlways || 'N/A',
      typeofCancel: typeof ToolConfirmationOutcome.Cancel,
      typeofProceedOnce: typeof ToolConfirmationOutcome.ProceedOnce,
      stringCancel: String(ToolConfirmationOutcome.Cancel),
      stringProceedOnce: String(ToolConfirmationOutcome.ProceedOnce)
    });
  }

  /**
   * Clean up the tool execution service
   * 
   * @returns {Promise<void>} Cleanup completion promise
   */
  async cleanup(): Promise<void> {
    this.setInitialized(false);
    this.logInfo("Gemini Tool Execution Service cleaned up");
  }

  /**
   * Execute pending tool calls and prepare responses for continuation
   * 
   * @param {ToolCallRequestInfo[]} pendingToolCalls - Array of tool calls to execute
   * @param {GeminiCoreAdapterCallbacks} callbacks - Callback handlers for UI updates
   * @param {ToolExecutionContext} context - Execution context with config and registry
   * @returns {Promise<GeminiToolExecutionResult[]>} Array of tool execution results
   * @description Orchestrates tool execution pipeline with permission checks and error handling.
   */
  async executeToolsAndContinue(
    pendingToolCalls: ToolCallRequestInfo[], 
    callbacks: GeminiCoreAdapterCallbacks,
    context: ToolExecutionContext
  ): Promise<GeminiToolExecutionResult[]> {
    this.ensureInitialized();
    
    this.logInfo('Executing pending tool calls', {
      toolCount: pendingToolCalls.length,
      tools: pendingToolCalls.map(t => ({ name: t.name, callId: t.callId }))
    });

    const toolResponses: GeminiToolExecutionResult[] = [];

    // Execute all pending tools
    for (const toolRequest of pendingToolCalls) {
      try {
        // Request permission if needed
        const permissionOutcome = await this.requestToolPermission(toolRequest, callbacks, context);
        
        this.logInfo('Permission check result', {
          toolName: toolRequest.name,
          callId: toolRequest.callId,
          permissionOutcome: String(permissionOutcome),
          outcomeValue: permissionOutcome,
          outcomeType: typeof permissionOutcome,
          willExecute: permissionOutcome === ToolConfirmationOutcome.ProceedOnce,
          isCancel: permissionOutcome === ToolConfirmationOutcome.Cancel,
          cancelValue: ToolConfirmationOutcome.Cancel,
          proceedOnceValue: ToolConfirmationOutcome.ProceedOnce,
          stringEqualityCancel: String(permissionOutcome) === String(ToolConfirmationOutcome.Cancel),
          stringEqualityProceedOnce: String(permissionOutcome) === String(ToolConfirmationOutcome.ProceedOnce),
          rawComparison: `'${permissionOutcome}' vs '${ToolConfirmationOutcome.Cancel}'`
        });
        
        if (permissionOutcome === ToolConfirmationOutcome.Cancel) {
          // Handle permission denial
          this.logInfo('Permission denied - skipping tool execution', {
            toolName: toolRequest.name,
            callId: toolRequest.callId,
            outcome: permissionOutcome
          });
          await this.handlePermissionDenied(toolRequest, callbacks);
          toolResponses.push(this.createErrorResponse(toolRequest, "Permission denied by user"));
          continue;
        }

        // Execute the tool
        this.logInfo('Permission granted - executing tool', {
          toolName: toolRequest.name,
          callId: toolRequest.callId,
          outcome: permissionOutcome
        });
        const toolResponse = await this.executeTool(toolRequest, context, callbacks);
        toolResponses.push(toolResponse);

      } catch (error) {
        // Handle tool execution failure
        await this.handleToolExecutionError(toolRequest, error, callbacks);
        toolResponses.push(this.createErrorResponse(toolRequest, error));
      }
    }

    return toolResponses;
  }

  /**
   * Create a permission request for tool execution
   * 
   * @param {ToolCallRequestInfo} toolRequest - Tool request information
   * @param {Function} resolve - Permission resolution callback
   * @param {GeminiConfirmationDetails} [confirmationDetails] - Optional confirmation details
   * @returns {Promise<GeminiPermissionRequest>} Formatted permission request
   * @description Creates structured permission request with tool tier and description.
   */
  async createPermissionRequest(
    toolRequest: ToolCallRequestInfo,
    confirmationDetails?: GeminiConfirmationDetails
  ): Promise<GeminiPermissionRequest> {
    const details = confirmationDetails || this.createConfirmationDetails(toolRequest);
    
    return {
      toolName: toolRequest.name || '',
      args: toolRequest.args,
      tier: getToolTier(toolRequest.name || ''),
      description: this.formatToolDescription(toolRequest),
      timestamp: new Date(),
    };
  }

  /**
   * Create confirmation details based on tool type and arguments
   * 
   * @param {ToolCallRequestInfo} toolRequest - Tool request information
   * @returns {GeminiConfirmationDetails} Tool-specific confirmation details
   * @description Generates UI-friendly confirmation details based on tool type and arguments.
   * @private
   */
  private createConfirmationDetails(toolRequest: ToolCallRequestInfo): GeminiConfirmationDetails {
    const toolName = toolRequest.name || '';
    const args = toolRequest.args || {};

    // Extract file path from various possible argument structures
    const extractFilePath = (): string | undefined => {
      if (typeof args === 'object' && args !== null) {
        const argsObj = args as Record<string, unknown>;
        return (argsObj.file_path as string) || (argsObj.path as string) || (argsObj.filePath as string) || (argsObj.fileName as string);
      }
      return undefined;
    };

    switch (toolName) {
      case 'Read':
      case 'Edit':
      case 'Write':
      case 'MultiEdit':
      case 'replacefile':
        const filePath = extractFilePath();
        return {
          type: 'edit' as const,
          title: `${toolName}: ${this.formatToolCommand(toolName, args)}`,
          fileName: filePath,
          isModifying: toolName !== 'Read' // Read is not modifying, others are
        };

      case 'Bash':
        return {
          type: 'exec' as const,
          title: `${toolName}: ${this.formatToolCommand(toolName, args)}`,
          command: String(args.command || ''),
          rootCommand: String(args.command || '')
        };

      case 'askModel':
        return {
          type: 'info' as const,
          title: `Consult ${String(args.model || 'AI')}`,
          prompt: String(args.prompt || 'Consultation request')
        };

      default:
        // For other tools, create a generic info type
        return {
          type: 'info' as const,
          title: String(this.formatToolCommand(toolName, args)),
          prompt: `Execute ${toolName} with provided arguments`
        };
    }
  }

  /**
   * Format tool command for display (similar to Claude's implementation)
   * 
   * @param {string} toolName - Name of the tool
   * @param {Record<string, unknown> | unknown} args - Tool arguments
   * @returns {string} Formatted command display string
   * @description Creates human-readable tool command representation for UI display.
   * @private
   */
  private formatToolCommand(toolName: string, args: Record<string, unknown> | unknown): string {
    if (!args || (typeof args === 'object' && Object.keys(args).length === 0)) {
      return `${toolName}()`;
    }

    const argsObj = typeof args === 'object' && args !== null ? args as Record<string, unknown> : {};

    // Format common tool patterns
    switch (toolName) {
      case 'Read':
        return `Read: ${argsObj.file_path || argsObj.path || 'unknown file'}`;
      
      case 'Edit':
        return `Edit: ${argsObj.file_path || argsObj.path || 'unknown file'}`;
      
      case 'Write':
        return `Write: ${argsObj.file_path || argsObj.path || 'unknown file'}`;

      case 'MultiEdit':
        return `MultiEdit: ${argsObj.file_path || argsObj.path || 'unknown file'}`;

      case 'replacefile':
        return `Replace: ${argsObj.file_path || argsObj.path || 'unknown file'}`;
      
      case 'Bash':
        return `$ ${argsObj.command || 'unknown command'}`;
      
      case 'LS':
        return `ls ${argsObj.path || '.'}`;
      
      case 'Grep':
        return `grep "${argsObj.pattern}" ${argsObj.path || '.'}`;
      
      case 'askModel':
        const prompt = typeof argsObj.prompt === 'string' ? argsObj.prompt : '';
        return `Ask ${argsObj.model}: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`;
      
      default:
        // Generic formatting
        const argStr = Object.entries(argsObj)
          .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
          .join(', ');
        return `${toolName}(${argStr})`;
    }
  }

  /**
   * Request permission for tool execution
   * 
   * @param {ToolCallRequestInfo} toolRequest - Tool request information
   * @param {GeminiCoreAdapterCallbacks} callbacks - Callback handlers
   * @param {ToolExecutionContext} [context] - Optional execution context
   * @returns {Promise<ToolConfirmationOutcome>} Permission outcome from user
   * @description Handles permission workflow with user interaction and validation.
   * @private
   */
  private async requestToolPermission(
    toolRequest: ToolCallRequestInfo,
    callbacks: GeminiCoreAdapterCallbacks,
    context?: ToolExecutionContext
  ): Promise<ToolConfirmationOutcome> {
    if (!callbacks.onPermissionRequest) {
      // No permission handler, assume granted
      return ToolConfirmationOutcome.ProceedOnce;
    }

    this.logInfo('Requesting permission for tool', {
      toolName: toolRequest.name,
      callId: toolRequest.callId
    });

    // Try to get tool confirmation details if we have context
    let confirmationDetails: GeminiConfirmationDetails | undefined = undefined;
    if (context && context.toolRegistry) {
      try {
        const tool = context.toolRegistry.getTool(toolRequest.name || '');
        if (tool && tool.shouldConfirmExecute) {
          const result = await tool.shouldConfirmExecute(toolRequest.args, context.abortSignal);
          confirmationDetails = result === false ? undefined : result as GeminiConfirmationDetails;
        }
      } catch (error) {
        this.logWarn('Failed to get tool confirmation details', { error });
      }
    }

    try {
      const permissionRequest = await this.createPermissionRequest(toolRequest, confirmationDetails);
      
      this.logInfo('Showing permission request for tool', {
        toolName: toolRequest.name,
        tier: permissionRequest.tier,
        hasConfirmationDetails: !!confirmationDetails
      });

      this.logInfo('Calling onPermissionRequest callback');
      const permissionOutcome = await callbacks.onPermissionRequest!(permissionRequest);
      
      this.logInfo('Permission response received', { 
        outcome: permissionOutcome,
        outcomeString: String(permissionOutcome),
        toolName: toolRequest.name,
        outcomeType: typeof permissionOutcome,
        isCancel: permissionOutcome === ToolConfirmationOutcome.Cancel,
        isProceedOnce: permissionOutcome === ToolConfirmationOutcome.ProceedOnce,
        cancelValue: ToolConfirmationOutcome.Cancel,
        proceedValue: ToolConfirmationOutcome.ProceedOnce
      });
      
      return permissionOutcome;
    } catch (error) {
      this.logError('Permission request failed', { error });
      return ToolConfirmationOutcome.Cancel;
    }
  }

  /**
   * Execute a single tool
   * 
   * @param {ToolCallRequestInfo} toolRequest - Tool request information
   * @param {ToolExecutionContext} context - Execution context
   * @param {GeminiCoreAdapterCallbacks} callbacks - Callback handlers
   * @returns {Promise<GeminiToolExecutionResult>} Tool execution result
   * @description Executes tool through core gemini-cli integration with result formatting.
   * @private
   */
  private async executeTool(
    toolRequest: ToolCallRequestInfo,
    context: ToolExecutionContext,
    callbacks: GeminiCoreAdapterCallbacks
  ): Promise<GeminiToolExecutionResult> {
    this.logInfo('Executing tool', {
      toolName: toolRequest.name,
      callId: toolRequest.callId
    });

    const toolResponse = await executeToolCall(
      context.config,
      toolRequest,
      context.toolRegistry,
      context.abortSignal
    );

    this.logInfo('Tool execution completed', {
      toolName: toolRequest.name,
      callId: toolRequest.callId,
      success: !toolResponse.error,
      resultDisplay: toolResponse.resultDisplay
    });

    // Notify UI that tool execution is complete
    if (callbacks.onToolExecutionComplete) {
      const completeData: GeminiToolExecutionCompleteData = {
        toolName: toolRequest.name || "",
        result: toolResponse.resultDisplay,
        executionId: toolRequest.callId,
        success: !toolResponse.error,
        timestamp: new Date(),
      };
      callbacks.onToolExecutionComplete(completeData);
    }

    return {
      toolCallId: toolRequest.callId,
      result: toolResponse.responseParts,
      success: !toolResponse.error,
      error: toolResponse.error?.message,
      executionTime: 0 // TODO: Track actual execution time
    };
  }

  /**
   * Handle permission denial
   * 
   * @param {ToolCallRequestInfo} toolRequest - Tool request information
   * @param {GeminiCoreAdapterCallbacks} callbacks - Callback handlers
   * @returns {Promise<void>} Completion promise
   * @description Processes permission denial with UI notifications and state updates.
   * @private
   */
  private async handlePermissionDenied(
    toolRequest: ToolCallRequestInfo,
    callbacks: GeminiCoreAdapterCallbacks
  ): Promise<void> {
    this.logInfo('Tool execution denied by user', {
      toolName: toolRequest.name,
      callId: toolRequest.callId
    });

    // Notify UI about permission denial
    if (callbacks.onPermissionDenied) {
      callbacks.onPermissionDenied(toolRequest.name || "unknown", "User denied the request");
    }

    // Update tool execution state to show denial
    if (callbacks.onToolExecutionComplete) {
      const completeData: GeminiToolExecutionCompleteData = {
        toolName: toolRequest.name || "",
        result: "Permission denied by user",
        executionId: toolRequest.callId,
        success: false,
        timestamp: new Date(),
      };
      callbacks.onToolExecutionComplete(completeData);
    }
  }

  /**
   * Handle tool execution error
   * 
   * @param {ToolCallRequestInfo} toolRequest - Tool request information
   * @param {unknown} error - Error that occurred during execution
   * @param {GeminiCoreAdapterCallbacks} callbacks - Callback handlers
   * @returns {Promise<void>} Completion promise
   * @description Processes tool execution errors with logging and UI notifications.
   * @private
   */
  private async handleToolExecutionError(
    toolRequest: ToolCallRequestInfo,
    error: unknown,
    callbacks: GeminiCoreAdapterCallbacks
  ): Promise<void> {
    const err = error instanceof Error ? error : new Error(String(error));
    
    this.logError('Tool execution failed', {
      toolName: toolRequest.name,
      callId: toolRequest.callId,
      error: err.message
    });

    // Notify UI of tool execution failure
    if (callbacks.onToolExecutionComplete) {
      const completeData: GeminiToolExecutionCompleteData = {
        toolName: toolRequest.name || "",
        result: err.message,
        executionId: toolRequest.callId,
        success: false,
        timestamp: new Date(),
      };
      callbacks.onToolExecutionComplete(completeData);
    }
  }

  /**
   * Format tool description with specific arguments for better UI display
   * 
   * @param {ToolCallRequestInfo} toolRequest - Tool request information
   * @returns {string} Formatted tool description
   * @description Creates context-aware tool descriptions incorporating actual arguments.
   * @private
   */
  private formatToolDescription(toolRequest: ToolCallRequestInfo): string {
    const toolName = toolRequest.name || 'unknown';
    const args = toolRequest.args || {};
    const argsObj = typeof args === 'object' && args !== null ? args as Record<string, unknown> : {};
    
    // Format tool-specific descriptions with actual arguments
    switch (toolName) {
      case 'read_file':
        return `Read: ${argsObj.absolute_path || argsObj.path || 'unknown file'}`;
      
      case 'list_directory':
        return `List directory: ${argsObj.path || '.'}`;
      
      case 'search_file_content':
        return `Search for '${argsObj.pattern || 'pattern'}' in ${argsObj.path || '.'}`;
      
      case 'glob':
        return `Find files matching: ${argsObj.pattern || '*'}${argsObj.path ? ` in ${argsObj.path}` : ''}`;
      
      case 'write_file':
      case 'Write':
        return `Write to: ${argsObj.absolute_path || argsObj.file_path || argsObj.path || 'unknown file'}`;
      
      case 'edit_file':
      case 'Edit':
        return `Edit: ${argsObj.absolute_path || argsObj.file_path || argsObj.path || 'unknown file'}`;
      
      case 'run_shell_command':
      case 'Bash':
        return `Execute: ${argsObj.command || 'unknown command'}`;
      
      case 'replace':
        return `Replace in: ${argsObj.path || 'unknown file'}`;
        
      default:
        // For unknown tools, try to extract meaningful info from args
        if (argsObj.path || argsObj.file_path || argsObj.absolute_path) {
          const path = argsObj.path || argsObj.file_path || argsObj.absolute_path;
          return `${getToolDescription(toolName)} on ${path}`;
        }
        return getToolDescription(toolName);
    }
  }

  /**
   * Create error response for tool execution
   * 
   * @param {ToolCallRequestInfo} toolRequest - Tool request information
   * @param {unknown} error - Error that occurred
   * @returns {GeminiToolExecutionResult} Standardized error response
   * @description Creates consistent error response format for failed tool executions.
   * @private
   */
  private createErrorResponse(
    toolRequest: ToolCallRequestInfo,
    error: unknown
  ): GeminiToolExecutionResult {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      toolCallId: toolRequest.callId,
      result: null,
      success: false,
      error: errorMessage,
      executionTime: 0
    };
  }
}