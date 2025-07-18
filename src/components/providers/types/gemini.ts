import { PermissionRequest, PermissionResponse } from '../../ui/interactive-base/BasePermissionPrompt.js';
import { BasePermissionPromptProps } from './common.js';

/**
 * Gemini-specific types for tool confirmation
 */
export type ToolConfirmationOutcome = 
  | 'proceed_once'
  | 'proceed_always'
  | 'proceed_always_server'
  | 'proceed_always_tool'
  | 'modify_with_editor'
  | 'cancel';

export interface ToolConfirmationDetails {
  type: 'edit' | 'exec' | 'mcp' | 'info';
  title: string;
  onConfirm: (outcome: ToolConfirmationOutcome, payload?: any) => Promise<void>;
  // Type-specific fields
  fileName?: string;
  fileDiff?: string;
  isModifying?: boolean;
  command?: string;
  rootCommand?: string;
  serverName?: string;
  toolName?: string;
  toolDisplayName?: string;
  prompt?: string;
  urls?: string[];
}

/**
 * Gemini-specific permission request interface
 */
export interface GeminiPermissionRequest extends PermissionRequest {
  confirmationDetails?: ToolConfirmationDetails;
}

/**
 * Gemini-specific permission response interface
 */
export interface GeminiPermissionResponse extends PermissionResponse {
  outcome?: ToolConfirmationOutcome;
  payload?: any;
}

/**
 * Gemini permission prompt props
 */
export interface GeminiPermissionPromptProps extends BasePermissionPromptProps {
  request: GeminiPermissionRequest;
  onResponse: (response: GeminiPermissionResponse) => void;
  permissionMode?: string;
}