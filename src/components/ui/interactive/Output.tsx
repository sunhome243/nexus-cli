import React from "react";
import { Box, Text } from "ink";
import { ThoughtSummary, RenderItem, Message, ToolExecution, ThinkingItem, StreamingChunk } from "../../core/types.js";
import { LoadingIndicator } from "../feedback/LoadingIndicator.js";
import { useTheme } from '../../shared/ThemeProvider.js';
import { getProviderAdapter } from '../../providers/factory/index.js';
import { ProviderType } from '../../../abstractions/providers/index.js';
import { usePermissions } from '../../providers/claude/index.js';
import ToolExecutionComponent from '../../execution/ToolExecution.js';
import { MarkdownRenderer } from '../renderers/index.js';
import { ThemeProvider } from '../../shared/ThemeProvider.js';
import ThinkingItemComponent from '../feedback/ThinkingItem.js';

interface OutputProps {
  items: RenderItem[];
  streamingText?: string;
  streamingChunks?: StreamingChunk[];
  pendingPermission?: any;
  permissionMode?: string;
  onPermissionResponse?: (response: any) => void;
  sessionId?: string;
  currentThought?: ThoughtSummary;
  currentProvider?: ProviderType;
  'data-testid'?: string;
}


export const Output = React.memo(function Output({ 
  items, 
  streamingText = "",
  streamingChunks = [],
  pendingPermission,
  permissionMode = "default",
  onPermissionResponse,
  sessionId,
  currentThought,
  currentProvider = ProviderType.CLAUDE,
  'data-testid': testId,
}: OutputProps) {
  const { theme } = useTheme();
  const { currentPermissionRequest, respondToPermission } = usePermissions();
  
  // Memoized helper function to check if any tools are currently executing
  const shouldShowLoading = React.useMemo(() => {
    return items.some(item => item.type === "tool" && (item.data as ToolExecution).isExecuting);
  }, [items]);
  
  if (items.length === 0 && !shouldShowLoading) {
    return null; // Header now shows the welcome message and tips
  }

  return (
    <Box flexDirection="column" {...(testId ? { 'data-testid': testId } : {})}>
      {/* Render items in arrival order - optimized keys */}
      {items.map((item, index) => {
        // Use simpler key generation for better performance
        const uniqueKey = `${item.type}-${index}`;
        
        if (item.type === 'message') {
          const message = item.data as Message;
          return (
            <MessageItem
              key={uniqueKey}
              message={message}
              theme={theme}
              currentProvider={currentProvider}
            />
          );
        } else if (item.type === 'tool' || item.type === 'tool_execution') {
          const tool = item.data as ToolExecution;
          return (
            <ToolItem
              key={uniqueKey}
              tool={tool}
              theme={theme}
              currentProvider={currentProvider}
            />
          );
        } else if (item.type === 'thinking') {
          const thinking = item.data as ThinkingItem;
          return (
            <ThinkingItemComponent
              key={uniqueKey}
              thinking={thinking}
            />
          );
        }
        
        return null;
      })}

      {/* Show streaming text if currently streaming */}
      {(streamingText || streamingChunks.length > 0) && (
        <Box marginBottom={1}>
          <Box flexDirection="row" alignItems="flex-start">
            <Text color={currentProvider === "gemini" ? theme.gemini.primary : theme.claude.primary} bold>
              {currentProvider === "gemini" ? "◆" : "◇"}
            </Text>
            <Box marginLeft={1} flexDirection="column">
              <MarkdownRenderer content={
                streamingText || 
                streamingChunks
                  .filter(chunk => chunk.type === 'content')
                  .map(chunk => chunk.value)
                  .join('')
              } />
            </Box>
          </Box>
        </Box>
      )}

      {/* Unified permission prompt using provider adapter factory */}
      {(currentPermissionRequest || pendingPermission) && (
        <Box marginBottom={1}>
          {(() => {
            const ProviderPermissionPrompt = getProviderAdapter(currentProvider).PermissionPrompt;
            
            if (pendingPermission && onPermissionResponse) {
              return (
                <ProviderPermissionPrompt
                  request={pendingPermission.request}
                  onResponse={onPermissionResponse}
                  permissionMode={permissionMode}
                />
              );
            } else if (currentPermissionRequest) {
              return (
                <ProviderPermissionPrompt
                  request={currentPermissionRequest}
                  onResponse={respondToPermission}
                  permissionMode={permissionMode}
                  sessionId={sessionId}
                />
              );
            } else if (pendingPermission && onPermissionResponse) {
              return (
                <ProviderPermissionPrompt
                  request={pendingPermission.request}
                  onResponse={onPermissionResponse}
                  permissionMode={permissionMode}
                  sessionId={sessionId}
                />
              );
            }
            return null;
          })()}
        </Box>
      )}

      {/* Show loading indicator when tools are executing OR when thinking */}
      {(shouldShowLoading || currentThought) && (
        <Box marginTop={1}>
          <LoadingIndicator 
            isLoading={shouldShowLoading}
            currentThought={currentThought} 
            provider={currentProvider}
          />
        </Box>
      )}
    </Box>
  );
});

// Memoized message component for better performance
const MessageItem = React.memo(function MessageItem({ 
  message, 
  theme,
  currentProvider
}: { 
  message: Message;
  theme: any;
  currentProvider?: "claude" | "gemini";
}) {
  // Use provider-specific color for permanent message indicators
  const getMessageColor = (role: "user" | "assistant", provider: "claude" | "gemini") => {
    if (role === "user") {
      return theme.interaction.primary; // User messages always same color
    }
    // Assistant messages use original provider color
    return provider === "gemini" ? theme.gemini.primary : theme.claude.primary;
  };

  return (
    <Box marginBottom={1}>
      {/* Show indicator and message content on same line */}
      {(message.content || message.text) && (
        <Box flexDirection="row" alignItems="flex-start">
          <Text color={getMessageColor(message.role || "assistant", message.provider)} bold>
            {message.role === "user" ? "> You " : "● "}
          </Text>
          <Box flexGrow={1}>
            <MarkdownRenderer content={message.content || message.text || ""} />
          </Box>
        </Box>
      )}
    </Box>
  );
});

// Memoized tool component for better performance
const ToolItem = React.memo(function ToolItem({
  tool,
  theme,
  currentProvider
}: {
  tool: ToolExecution;
  theme: any;
  currentProvider?: "claude" | "gemini";
}) {
  return (
    <Box marginBottom={1}>
      <ToolExecutionComponent
        theme={theme}
        toolName={tool.toolName}
        args={tool.args}
        isExecuting={tool.isExecuting}
        result={tool.result}
        provider={tool.provider} // Use original provider from tool data
        isError={tool.isError}
        errorMessage={tool.errorMessage}
      />
    </Box>
  );
});
