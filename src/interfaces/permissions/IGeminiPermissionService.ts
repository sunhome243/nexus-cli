/**
 * Gemini Provider Permission Service Interface
 * Extends base permission service with Gemini-specific direct callback integration
 */

import { 
  IProviderPermissionService, 
  ProviderPermissionRequest, 
  ProviderPermissionResponse 
} from './IProviderPermissionService.js';

/**
 * Gemini-specific permission request with direct callback integration
 */
export interface GeminiPermissionRequest extends ProviderPermissionRequest {
  toolName: string; // Gemini uses 'toolName' property
  tier?: string; // Optional tier classification
  description?: string; // Tool description
  confirmationDetails?: GeminiConfirmationDetails; // Tool-specific confirmation
}

/**
 * Gemini permission confirmation details for different tool types
 */
export interface GeminiConfirmationDetails {
  type: 'edit' | 'exec' | 'info';
  title: string;
  fileName?: string;
  isModifying?: boolean;
  command?: string;
  rootCommand?: string;
  prompt?: string;
}

/**
 * Gemini permission confirmation outcome options
 */
export type GeminiConfirmationOutcome = 
  | 'proceed_once' 
  | 'proceed_always' 
  | 'proceed_always_server' 
  | 'proceed_always_tool'
  | 'modify_with_editor' 
  | 'cancel';

/**
 * Gemini-specific permission response with granular options
 */
export interface GeminiPermissionResponse extends ProviderPermissionResponse {
  outcome: GeminiConfirmationOutcome; // Specific outcome choice
  toolUseId: string; // Tool execution identifier
  confirmationDetails?: GeminiConfirmationDetails; // Updated confirmation details
}

/**
 * Tool execution context for permission validation
 */
export interface GeminiToolExecutionContext {
  config: unknown; // Gemini config object
  toolRegistry: unknown; // Gemini tool registry
  abortSignal: AbortSignal; // Cancellation signal
  sessionId?: string;
  turnId?: string;
}

/**
 * Permission callback function type
 */
export type PermissionCallback = (request: GeminiPermissionRequest) => Promise<GeminiPermissionResponse>;

/**
 * Gemini-specific permission service interface with direct callback integration
 */
export interface IGeminiPermissionService extends IProviderPermissionService {
  /**
   * Handle Gemini permission request with direct callback
   */
  handlePermissionRequest(request: GeminiPermissionRequest): Promise<GeminiPermissionResponse>;

  /**
   * Set permission callback for UI integration
   */
  setPermissionCallback(callback: PermissionCallback): void;

  /**
   * Create confirmation details for tool
   */
  createConfirmationDetails(toolName: string, args: unknown): GeminiConfirmationDetails;

  /**
   * Check if tool requires confirmation
   */
  shouldConfirmTool(toolName: string, args?: unknown): Promise<boolean>;

  /**
   * Format tool command for display
   */
  formatToolCommand(toolName: string, args: unknown): string;

  /**
   * Format tool description with arguments
   */
  formatToolDescription(toolName: string, args: unknown): string;

  /**
   * Process confirmation outcome
   */
  processConfirmationOutcome(outcome: GeminiConfirmationOutcome, context: GeminiToolExecutionContext): Promise<void>;

  /**
   * Check if outcome allows tool execution
   */
  isExecutionAllowed(outcome: GeminiConfirmationOutcome): boolean;
}