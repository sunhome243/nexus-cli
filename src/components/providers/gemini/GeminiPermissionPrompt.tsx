import React from 'react';
import { BasePermissionPrompt } from '../../ui/interactive-base/BasePermissionPrompt.js';
import { MarkdownRenderer, DiffRenderer } from '../../ui/renderers/index.js';
import { usePermissionPromptBase } from '../shared/usePermissionPromptBase.js';
import { GeminiPermissionPromptProps, GeminiPermissionResponse } from '../types/gemini.js';
import { shortenPath } from '../shared/utils.js';
import { ProviderType } from '../../../abstractions/providers/index.js';

export const GeminiPermissionPrompt: React.FC<GeminiPermissionPromptProps> = ({
  request,
  onResponse,
  permissionMode = 'default'
}) => {
  const { renderArguments: baseRenderArguments, shouldShowArgs: baseShouldShowArgs } = usePermissionPromptBase(request);
  
  const handlePermissionResponse = async (response: GeminiPermissionResponse) => {
    // If we have core confirmation details, call the onConfirm callback
    if (request.confirmationDetails && response.outcome) {
      try {
        await request.confirmationDetails.onConfirm(response.outcome, response.payload);
      } catch (error) {
        // Permission confirmation failed - error handled silently
      }
    }
    
    // Always call the original response handler for UI updates
    onResponse(response);
  };

  const renderArguments = (args: any) => {
    if (!args || Object.keys(args).length === 0) {
      return null;
    }
    
    // Use shared ArgumentRenderer - the ArgumentRenderer already handles all cases
    return baseRenderArguments(args);
  };

  // Generate Gemini-specific options based on confirmation type
  const generateGeminiOptions = () => {
    const baseOptions = [
      { 
        key: 'y', 
        label: 'Approve', 
        action: () => handlePermissionResponse({ approved: true, outcome: 'proceed_once' } as GeminiPermissionResponse),
        color: 'success'
      },
      { 
        key: 'n', 
        label: 'Deny', 
        action: () => handlePermissionResponse({ approved: false, outcome: 'cancel' } as GeminiPermissionResponse),
        color: 'danger'
      },
      { 
        key: 'a', 
        label: 'Auto-approve', 
        action: () => handlePermissionResponse({ approved: true, outcome: 'proceed_always' } as GeminiPermissionResponse),
        color: 'primary'
      }
    ];
    
    // Add type-specific options only when needed
    if (request.confirmationDetails?.type === 'edit') {
      baseOptions.splice(2, 0, {
        key: 'e',
        label: 'Edit First',
        action: () => handlePermissionResponse({ approved: true, outcome: 'modify_with_editor' } as GeminiPermissionResponse),
        color: 'warning'
      });
    }
    
    return baseOptions;
  };

  // Show arguments for operations that need details
  const shouldShowArgs = baseShouldShowArgs && 
    !request.confirmationDetails?.fileDiff &&
    !request.confirmationDetails?.type; // Don't show args when we have specific detail types

  // Render Gemini-specific permission details in a cleaner way
  const renderGeminiDetails = () => {
    if (!request.confirmationDetails) return null;

    const { confirmationDetails } = request;

    // For edit operations with file diffs, we show the diff below, so don't duplicate info
    if (confirmationDetails.type === 'edit' && confirmationDetails.fileDiff) {
      return null;
    }

    // For other types, show minimal clean info
    switch (confirmationDetails.type) {
      case 'edit':
        return (
          <MarkdownRenderer 
            content={`File: ${shortenPath(confirmationDetails.fileName || '')} (${confirmationDetails.isModifying ? 'modify' : 'create'})`}
            autoDetectMarkdown={false}
          />
        );
      case 'exec':
        return (
          <MarkdownRenderer 
            content={`Command: ${confirmationDetails.command}${confirmationDetails.rootCommand ? `\nRoot: ${confirmationDetails.rootCommand}` : ''}`}
            autoDetectMarkdown={false}
          />
        );
      case 'mcp':
        return (
          <MarkdownRenderer 
            content={`Server: ${confirmationDetails.serverName} → ${confirmationDetails.toolDisplayName || confirmationDetails.toolName}`}
            autoDetectMarkdown={false}
          />
        );
      case 'info':
        return (
          <MarkdownRenderer 
            content={`Prompt: ${confirmationDetails.prompt}${confirmationDetails.urls?.length ? `\nURLs: ${confirmationDetails.urls.join(', ')}` : ''}`}
            autoDetectMarkdown={false}
          />
        );
      default:
        return null;
    }
  };

  return (
    <BasePermissionPrompt
      request={request}
      onResponse={onResponse}
      permissionMode={permissionMode}
      provider={ProviderType.GEMINI}
      customOptions={generateGeminiOptions()}
      renderArguments={shouldShowArgs ? renderArguments : undefined}
      renderDetails={renderGeminiDetails}
    >
      {/* Gemini-specific content */}
      {request.confirmationDetails?.fileDiff && (
        <DiffRenderer 
          fileDiff={request.confirmationDetails.fileDiff}
          fileName={request.confirmationDetails.fileName}
          showFileName={false}
          showStats={true}
        />
      )}
    </BasePermissionPrompt>
  );
};