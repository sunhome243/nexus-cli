import React from 'react';
import { BasePermissionPrompt } from '../../ui/interactive-base/BasePermissionPrompt.js';
import { MarkdownRenderer } from '../../ui/renderers/index.js';
import { usePermissionPromptBase } from '../shared/usePermissionPromptBase.js';
import { ClaudePermissionPromptProps } from '../types/claude.js';
import { ProviderType } from '../../../abstractions/providers/index.js';

export const ClaudePermissionPrompt: React.FC<ClaudePermissionPromptProps> = ({
  request,
  onResponse,
  permissionMode = 'default',
  sessionId
}) => {
  const { renderArguments, shouldShowArgs } = usePermissionPromptBase(request);

  return (
    <BasePermissionPrompt
      request={request}
      onResponse={onResponse}
      permissionMode={permissionMode}
      provider={ProviderType.CLAUDE}
      renderArguments={shouldShowArgs ? renderArguments : undefined}
    >
      {/* Claude-specific content */}
      {request.plan && (
        <MarkdownRenderer content={request.plan} autoDetectMarkdown={true} />
      )}
    </BasePermissionPrompt>
  );
};