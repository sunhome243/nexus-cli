import { PermissionRequest, PermissionResponse } from '../../ui/interactive-base/BasePermissionPrompt.js';
import { BasePermissionPromptProps } from './common.js';

/**
 * Claude-specific permission request interface
 */
export interface ClaudePermissionRequest extends PermissionRequest {
  toolUseId?: string;
}

/**
 * Claude permission prompt props
 */
export interface ClaudePermissionPromptProps extends BasePermissionPromptProps {
  request: ClaudePermissionRequest;
  onResponse: (response: PermissionResponse) => void;
  permissionMode?: string;
  sessionId?: string;
}