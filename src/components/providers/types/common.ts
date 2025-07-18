import React from 'react';
import { PermissionRequest, PermissionResponse } from '../../ui/interactive-base/BasePermissionPrompt.js';
import { ToolExecutionData } from '../../ui/interactive-base/BaseToolRenderer.js';
import { ProviderType } from '../../../abstractions/providers/types.js';

/**
 * Base provider type definitions
 */
export { ProviderType };

/**
 * Standard provider adapter interface
 */
export interface IProviderAdapter {
  PermissionPrompt: React.ComponentType<any>;
  ToolRenderer: React.ComponentType<any>;
}

/**
 * Base permission prompt props interface
 */
export interface BasePermissionPromptProps {
  request: PermissionRequest;
  onResponse: (response: PermissionResponse) => void;
  permissionMode?: string;
  sessionId?: string;
}

/**
 * Base tool renderer props interface
 */
export interface BaseToolRendererProps {
  toolData: ToolExecutionData;
  renderTodoContent?: (args: any) => React.ReactNode;
}

/**
 * Argument renderer props for shared component
 */
export interface ArgumentRendererProps {
  args: any;
  tool: string;
  tryRenderAsDiff?: (args: any) => React.ReactNode | null;
}

/**
 * Todo renderer props for shared component
 */
export interface TodoRendererProps {
  toolData: ToolExecutionData;
  renderTodoContent?: (args: any) => React.ReactNode;
}