import React from 'react';
import { Box, Text } from 'ink';
import { BasePermissionPrompt, PermissionRequest, PermissionResponse } from '../interactive-base/BasePermissionPrompt.js';
import { BaseToolRenderer, ToolExecutionData } from '../interactive-base/BaseToolRenderer.js';
import { useTheme } from '../../shared/ThemeProvider.js';
import { formatUtils } from '../../shared/ThemeUtils.js';
import { MarkdownRenderer, DiffRenderer } from '../renderers/index.js';
import { ProviderType } from '../../../abstractions/providers/types.js';

export interface ClaudePermissionRequest extends PermissionRequest {
  toolUseId?: string;
  plan?: string;
}

export interface ClaudePermissionPromptProps {
  request: ClaudePermissionRequest;
  onResponse: (response: PermissionResponse) => void;
  permissionMode?: string;
  sessionId?: string;
}

/**
 * Claude-specific permission prompt with simplified approve/deny workflow
 */
export const ClaudePermissionPrompt: React.FC<ClaudePermissionPromptProps> = ({
  request,
  onResponse,
  permissionMode = 'default',
  sessionId
}) => {
  const { theme } = useTheme();
  
  // Hook for diff rendering capability
  const tryRenderAsDiff = (args: any): React.ReactNode | null => {
    // Try to render as diff for Edit operations only (not MultiEdit)
    if (args.old_string && args.new_string && !args.edits) {
      return (
        <DiffRenderer
          filePath={args.file_path}
          edit={{ old_string: args.old_string, new_string: args.new_string }}
          showFileName={true}
          showStats={true}
        />
      );
    }
    return null;
  };
  
  const renderArguments = (args: any) => {
    if (!args || typeof args !== 'object') {
      return <Text color={theme.text.muted}>No arguments</Text>;
    }

    // Try to render as diff for Edit operations first
    if (args.file_path && args.old_string && args.new_string && !args.edits) {
      const diffContent = tryRenderAsDiff(args);
      if (diffContent) {
        return diffContent;
      }
    }
    
    if (args.file_path && args.edits && Array.isArray(args.edits)) {
      // MultiEdit operation
      const totalChanges = args.edits.reduce((acc: any, edit: any) => {
        if (edit.old_string && edit.new_string) {
          acc.removed += edit.old_string.split('\n').length;
          acc.added += edit.new_string.split('\n').length;
        }
        return acc;
      }, { removed: 0, added: 0 });
      
      return (
        <Box flexDirection="column">
          <Text color={theme.text.primary}>
            {formatUtils.truncatePath(args.file_path, 50)} ({args.edits.length} edits, -{totalChanges.removed} +{totalChanges.added} lines)
          </Text>
          {args.edits.slice(0, 3).map((edit: any, index: number) => (
            <Box key={index} marginTop={1} flexDirection="column">
              <Text color={theme.text.muted}>Edit {index + 1}:</Text>
              <Box>
                <Text color={theme.status.danger}>− </Text>
                <Text color={theme.status.danger}>
                  {edit.old_string?.substring(0, 60) || ''}...
                </Text>
              </Box>
              <Box>
                <Text color={theme.status.success}>+ </Text>
                <Text color={theme.status.success}>
                  {edit.new_string?.substring(0, 60) || ''}...
                </Text>
              </Box>
            </Box>
          ))}
          {args.edits.length > 3 && (
            <Text color={theme.text.muted}>...and {args.edits.length - 3} more edits</Text>
          )}
        </Box>
      );
    }
    
    if (args.file_path && args.content) {
      // Write operation
      const lines = args.content.split('\n').length;
      return (
        <Box flexDirection="column">
          <Text color={theme.text.primary}>
            {formatUtils.truncatePath(args.file_path, 50)} ({lines} lines)
          </Text>
          <Box marginTop={1}>
            <Text color={theme.text.muted}>
              {args.content.length > 200 ? args.content.substring(0, 200) + '...' : args.content}
            </Text>
          </Box>
        </Box>
      );
    }
    
    if (args.command) {
      // Bash operation
      return (
        <Box flexDirection="column">
          <Text color={theme.syntax.code}>$ {args.command}</Text>
          {args.description && (
            <Text color={theme.text.muted}>{args.description}</Text>
          )}
        </Box>
      );
    }
    
    // Generic argument display
    const relevantFields = Object.entries(args).filter(([key, value]) => 
      !key.startsWith('_') && value !== null && value !== undefined && key !== 'timeout'
    );
    
    if (relevantFields.length === 0) {
      return <Text color={theme.text.muted}>No arguments</Text>;
    }
    
    return (
      <Box flexDirection="column">
        {relevantFields.map(([key, value]) => (
          <Box key={key}>
            <Text color={theme.text.muted}>{key}: </Text>
            <Text color={theme.text.primary}>
              {key.includes('path') ? formatUtils.truncatePath(String(value), 50) : String(value)}
            </Text>
          </Box>
        ))}
      </Box>
    );
  };

  // Show arguments for operations that need details
  const shouldShowArguments = request.arguments && 
    Object.keys(request.arguments).length > 0 && 
    ['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Bash'].includes(request.tool);

  return (
    <BasePermissionPrompt
      request={request}
      onResponse={onResponse}
      permissionMode={permissionMode}
      provider={ProviderType.CLAUDE}
      renderArguments={shouldShowArguments ? renderArguments : undefined}
    >
      {/* Claude-specific plan content */}
      {request.plan && (
        <Box marginTop={1}>
          <MarkdownRenderer content={request.plan} wrap="wrap" />
        </Box>
      )}
    </BasePermissionPrompt>
  );
};

export interface ClaudeToolRendererProps {
  toolData: ToolExecutionData;
  renderTodoContent?: (todos: any) => React.ReactNode;
}

/**
 * Claude-specific tool renderer with Claude argument formatting
 */
export const ClaudeToolRenderer: React.FC<ClaudeToolRendererProps> = ({
  toolData,
  renderTodoContent
}) => {
  const { theme } = useTheme();
  
  // Claude-specific argument formatting
  const formatClaudeArgs = (toolName: string, args: any): string => {
    if (!args) return "";

    // Helper function to safely get file path from Claude args
    const getFilePath = (args: any): string | null => {
      return args.file_path || args.path || args.filePath || null;
    };

    // Helper function to safely get command from Claude args  
    const getCommand = (args: any): string | null => {
      return args.command || args.cmd || null;
    };

    switch (toolName) {
      case "Read":
        const readPath = getFilePath(args);
        return readPath ? formatUtils.truncatePath(readPath) : "unknown file";
        
      case "LS":
        const lsPath = getFilePath(args);
        return lsPath ? formatUtils.truncatePath(lsPath) : ".";
        
      case "Grep":
        const pattern = args.pattern || "pattern";
        const searchPath = getFilePath(args) || ".";
        return `"${pattern}" in ${formatUtils.truncatePath(searchPath)}`;
        
      case "Glob":
        return args.pattern || "*";
        
      case "Write":
        const writePath = getFilePath(args);
        return writePath ? formatUtils.truncatePath(writePath) : "unknown file";
        
      case "Edit":
        const editPath = getFilePath(args);
        return editPath ? formatUtils.truncatePath(editPath) : "unknown file";
        
      case "MultiEdit":
        const multiEditPath = getFilePath(args);
        return multiEditPath ? formatUtils.truncatePath(multiEditPath) : "unknown file";
        
      case "Bash":
        const command = getCommand(args);
        return command || "unknown command";
        
      case "TodoWrite":
      case "TodoRead":
        // Don't show args for todo tools - they are rendered separately
        return "";
        
      case "WebSearch":
        return args.query || "search query";
        
      case "NotebookRead":
      case "NotebookEdit":
        const notebookPath = getFilePath(args) || args.notebook_path;
        return notebookPath ? formatUtils.truncatePath(notebookPath) : "unknown notebook";
        
      default:
        // For unknown tools, show first meaningful argument
        if (args && typeof args === 'object') {
          const entries = Object.entries(args);
          if (entries.length === 0) return "";
          
          // Prioritize common meaningful fields
          const priorityFields = ['file_path', 'path', 'command', 'query', 'pattern', 'url'];
          const priorityEntry = entries.find(([key]) => priorityFields.includes(key.toLowerCase()));
          
          if (priorityEntry) {
            const [key, value] = priorityEntry;
            if (typeof value === 'string') {
              return key.includes('path') ? formatUtils.truncatePath(value) : value;
            }
          }
          
          // Fallback to first argument
          const [firstKey, firstValue] = entries[0];
          if (typeof firstValue === 'string') {
            return firstKey.includes('path') ? formatUtils.truncatePath(firstValue) : firstValue;
          }
        }
        return "";
    }
  };

  // Claude-specific result formatting
  const formatClaudeResult = (toolName: string, result: string, isError?: boolean, errorMessage?: string): string => {
    if (isError && errorMessage) {
      // Special handling for permission denial
      if (errorMessage.includes("Permission denied")) {
        return "denied";
      }
      return `failed: ${errorMessage}`;
    }
    
    // Check for permission denial in result even if isError isn't set
    if (!result && errorMessage && errorMessage.includes("Permission denied")) {
      return "denied";
    }
    
    if (!result) return "completed";

    const cleanResult = result.trim();
    const lines = cleanResult.split("\n").filter((line) => line.trim()).length;

    // Claude-specific tool result formatting
    switch (toolName) {
      case "WebSearch":
        return cleanResult || "search completed";
      
      case "Read":
        return lines > 0 ? `${lines} lines read` : "file read";
      case "LS":
        return lines > 0 ? `${lines} items found` : "directory listed";
      case "Grep":
        return lines > 0 ? `${lines} matches found` : "search completed";
      case "Glob":
        return lines > 0 ? `${lines} files found` : "pattern search completed";
      case "Write":
        return "file written";
      case "Edit":
        return "file edited";
      case "MultiEdit":
        return "files edited";
      case "Bash":
        return "command executed";
      case "TodoWrite":
        return "todos updated";
      case "TodoRead":
        return "todos read";
      
      default:
        // For MCP tools (contain __ in name), show full result
        if (toolName.includes('__')) {
          return cleanResult || "function completed";
        }
        return cleanResult || "completed";
    }
  };

  // Custom content rendering for Claude-specific tools
  const renderClaudeCustomContent = (toolData: ToolExecutionData) => {
    // Special rendering for TodoWrite and TodoRead results
    if ((toolData.toolName === 'TodoWrite' || toolData.toolName === 'TodoRead') && 
        !toolData.isError && !toolData.isExecuting && renderTodoContent) {
      
      // TodoWrite contains todos in args.todos
      const todos = (toolData.args as any)?.todos;
      
      if (Array.isArray(todos) && todos.length > 0) {
        return renderTodoContent(todos);
      }
    }
    
    return null;
  };

  return (
    <BaseToolRenderer
      toolData={toolData}
      formatArgs={formatClaudeArgs}
      formatResult={formatClaudeResult}
      renderCustomContent={renderClaudeCustomContent}
      showProvider={false}
    />
  );
};

export const ClaudeAdapter = {
  PermissionPrompt: ClaudePermissionPrompt,
  ToolRenderer: ClaudeToolRenderer
};

export default ClaudeAdapter;