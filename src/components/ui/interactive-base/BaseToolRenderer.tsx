import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../../shared/ThemeProvider.js';
import { colorUtils } from '../../shared/ThemeUtils.js';
import { globalAnimationManager } from '../../../utils/GlobalAnimationManager.js';
import { MarkdownRenderer } from '../renderers/index.js';
import { ProviderType } from '../../../abstractions/providers/types.js';

/**
 * Tool execution data interface
 */
export interface ToolExecutionData {
  toolName: string;
  args: any;
  isExecuting?: boolean;
  result?: string;
  provider: ProviderType;
  isError?: boolean;
  errorMessage?: string;
  timestamp?: Date;
  toolUseId?: string;
  permissionTier?: 'safe' | 'cautious' | 'dangerous';
  executionTime?: number;
  // Core tool execution fields
  status?: 'validating' | 'scheduled' | 'executing' | 'awaiting_approval' | 'success' | 'error' | 'cancelled';
  liveOutput?: string;
  durationMs?: number;
  callId?: string;
}

/**
 * Props interface for BaseToolRenderer component
 */
export interface BaseToolRendererProps {
  toolData: ToolExecutionData;
  formatArgs?: (toolName: string, args: any) => string;
  formatResult?: (toolName: string, result: string, isError?: boolean, errorMessage?: string) => string;
  getExecutingMessage?: (toolName: string, provider: string) => string;
  renderCustomContent?: (toolData: ToolExecutionData) => React.ReactNode;
  showProvider?: boolean;
}

const DEFAULT_SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/**
 * Base tool renderer component - provides core structure and spinner logic
 * Provider-specific logic should be in ClaudeAdapter/GeminiAdapter
 */
export const BaseToolRenderer: React.FC<BaseToolRendererProps> = ({
  toolData,
  formatArgs,
  formatResult,
  getExecutingMessage,
  renderCustomContent
}) => {
  const { theme } = useTheme();
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  
  const {
    toolName,
    args,
    isExecuting = false,
    result,
    provider,
    isError = false,
    errorMessage,
    toolUseId,
    permissionTier,
    executionTime
  } = toolData;

  // Animate spinner when executing
  useEffect(() => {
    const animationId = `tool-spinner-${toolName}-${toolUseId || Date.now()}`;
    
    if (!isExecuting) {
      setSpinnerFrame(0);
      globalAnimationManager.unsubscribe(animationId);
      return;
    }

    globalAnimationManager.subscribe(animationId, () => {
      setSpinnerFrame((prev) => (prev + 1) % DEFAULT_SPINNER_FRAMES.length);
    }, 100);

    const failsafe = setTimeout(() => {
      setSpinnerFrame(0);
      globalAnimationManager.unsubscribe(animationId);
    }, 30000);

    return () => {
      globalAnimationManager.unsubscribe(animationId);
      clearTimeout(failsafe);
    };
  }, [isExecuting, toolName, toolUseId]);

  // Force immediate re-render when isExecuting changes
  useEffect(() => {
    if (!isExecuting) {
      setSpinnerFrame(0);
    }
  }, [isExecuting]);

  // Simple fallback formatters - provider adapters should provide their own
  const defaultFormatArgs = (_toolName: string, args: any): string => {
    if (!args) return "";
    
    // Simple fallback - show first meaningful field
    if (typeof args === 'object') {
      const entries = Object.entries(args);
      if (entries.length === 0) return "";
      
      const [, value] = entries[0];
      if (typeof value === 'string') {
        return value.length > 30 ? `${value.substring(0, 30)}...` : value;
      }
    }
    return "";
  };

  const defaultFormatResult = (_toolName: string, result: string, isError?: boolean, errorMessage?: string): string => {
    if (isError && errorMessage) {
      if (errorMessage.includes("Permission denied")) return "denied";
      return `failed: ${errorMessage}`;
    }
    return result?.trim() || "completed";
  };

  const defaultGetExecutingMessage = (_toolName: string, provider: string): string => {
    return provider === "gemini" ? "Calling function" : "Running";
  };

  const formattedArgs = (formatArgs || defaultFormatArgs)(toolName, args);
  const formattedResult = (formatResult || defaultFormatResult)(toolName, result || "", isError, errorMessage);
  const executingMessage = (getExecutingMessage || defaultGetExecutingMessage)(toolName, provider);

  const toolColor = colorUtils.getProviderColor(provider, theme);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={toolColor} bold>{"● "}</Text>
        <Text color={toolColor} bold>{toolName}</Text>
        {formattedArgs && (
          <Box width={50}>
            <Text color={theme.text.muted}>(</Text>
            <MarkdownRenderer 
              content={formattedArgs}
              wrap="truncate-end"
              color={theme.text.muted}
            />
            <Text color={theme.text.muted}>)</Text>
          </Box>
        )}
        {permissionTier && (
          <Text color={colorUtils.getTierColor(permissionTier, theme)}> [{permissionTier.toUpperCase()}]</Text>
        )}
      </Box>

      <Box marginLeft={2}>
        <Text color={theme.text.muted}>⎿  </Text>
        {isExecuting ? (
          <Box flexDirection="column">
            <Text color={theme.status.warning}>
              [{DEFAULT_SPINNER_FRAMES[spinnerFrame]}] {executingMessage}...
            </Text>
            {toolData.liveOutput && (
              <Box marginTop={1}>
                <Text color={theme.text.muted}>{toolData.liveOutput}</Text>
              </Box>
            )}
            {toolData.status && toolData.status !== 'executing' && (
              <Text color={theme.text.muted}>Status: {toolData.status}</Text>
            )}
          </Box>
        ) : (
          <Box>
            <Text color={isError ? theme.syntax.error : theme.status.success}>
              {isError ? "✗" : "✓"} 
            </Text>
            <Box width={toolName.includes('__') ? undefined : 100}>
              <MarkdownRenderer 
                content={formattedResult}
                wrap={toolName.includes('__') ? "wrap" : "truncate-end"}
                color={isError ? theme.syntax.error : theme.status.success}
              />
            </Box>
            {(toolData.durationMs || executionTime) && !isExecuting && (
              <Text color={theme.text.muted}> ({toolData.durationMs || executionTime}ms)</Text>
            )}
            {toolData.callId && (
              <Text color={theme.text.muted}> ID: {toolData.callId.substring(0, 8)}</Text>
            )}
          </Box>
        )}
      </Box>

      {renderCustomContent && renderCustomContent(toolData)}
    </Box>
  );
};

export default BaseToolRenderer;