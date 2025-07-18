import React from 'react';
import { useDiffRenderer } from '../../ui/renderers/DiffRenderer.js';
import { ArgumentRenderer, shouldShowArguments } from './ArgumentRenderer.js';
import { PermissionRequest } from '../../ui/interactive-base/BasePermissionPrompt.js';

/**
 * Hook that provides common permission prompt logic
 * Reduces duplication between Claude and Gemini permission prompts
 */
export const usePermissionPromptBase = (request: PermissionRequest) => {
  const { tryRenderAsDiff } = useDiffRenderer();
  
  const renderArguments = (args: any) => {
    return (
      <ArgumentRenderer
        args={args}
        tool={request.tool}
        tryRenderAsDiff={tryRenderAsDiff}
      />
    );
  };

  const shouldShowArgs = shouldShowArguments(request.tool, request.arguments);

  return {
    tryRenderAsDiff,
    renderArguments,
    shouldShowArgs
  };
};