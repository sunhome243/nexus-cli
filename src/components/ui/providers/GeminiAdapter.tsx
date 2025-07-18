import React from 'react';
import { Box, Text } from 'ink';
import { BaseToolRenderer, ToolExecutionData } from '../interactive-base/BaseToolRenderer.js';
import { useTheme } from '../../shared/ThemeProvider.js';
import { formatUtils } from '../../shared/ThemeUtils.js';
import { GeminiPermissionPrompt } from '../../providers/gemini/GeminiPermissionPrompt.js';
import { GeminiPermissionPromptProps } from '../../providers/types/gemini.js';

/**
 * Re-export GeminiPermissionPrompt for consistency with adapter pattern
 */
export { GeminiPermissionPrompt } from '../../providers/gemini/GeminiPermissionPrompt.js';
export type { GeminiPermissionPromptProps } from '../../providers/types/gemini.js';

export interface GeminiToolRendererProps {
  toolData: ToolExecutionData;
  renderTodoContent?: (todos: any) => React.ReactNode;
}

/**
 * Gemini-specific tool renderer with Gemini argument formatting and core tool result handling
 */
export const GeminiToolRenderer: React.FC<GeminiToolRendererProps> = ({
  toolData,
  renderTodoContent
}) => {
  const { theme } = useTheme();
  
  // Gemini-specific argument formatting
  const formatGeminiArgs = (toolName: string, args: any): string => {
    if (!args) return "";

    // Handle MCP tools (prefixed with mcp__)
    if (toolName.startsWith('mcp__')) {
      // Extract meaningful info from MCP tool args
      if (args && typeof args === 'object') {
        const entries = Object.entries(args);
        if (entries.length === 0) return "";
        
        // Show first 2 meaningful arguments for MCP tools
        const formattedArgs = entries.slice(0, 2).map(([key, value]) => {
          if (typeof value === 'string' && value.length > 50) {
            return `${key}: "${value.substring(0, 50)}..."`;
          }
          return `${key}: ${JSON.stringify(value)}`;
        }).join(', ');
        
        return entries.length > 2 ? `${formattedArgs}...` : formattedArgs;
      }
      return "";
    }

    // Helper function to safely get file path from Gemini args
    const getFilePath = (args: any): string | null => {
      return args.file_path || args.path || args.filePath || null;
    };

    // Helper function to safely get command from Gemini args  
    const getCommand = (args: any): string | null => {
      return args.command || args.cmd || null;
    };

    // Handle built-in tools same as Claude but with Gemini-specific handling
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
          
          // Fallback to first 2 arguments
          const formattedArgs = entries.slice(0, 2).map(([key, value]) => {
            if (typeof value === 'string' && value.length > 50) {
              return `${key}: "${value.substring(0, 50)}..."`;
            }
            return `${key}: ${JSON.stringify(value)}`;
          }).join(', ');
          
          return entries.length > 2 ? `${formattedArgs}...` : formattedArgs;
        }
        return "";
    }
  };

  // Gemini-specific result formatting (handles core tool results)
  const formatGeminiResult = (toolName: string, result: string, isError?: boolean, errorMessage?: string): string => {
    if (isError && errorMessage) {
      // Special handling for permission denial
      if (errorMessage.includes("Permission denied") || errorMessage.includes("User denied")) {
        return "denied";
      }
      return `failed: ${errorMessage}`;
    }
    
    // Check for permission denial in result even if isError isn't set
    if (!result && errorMessage && (errorMessage.includes("Permission denied") || errorMessage.includes("User denied"))) {
      return "denied";
    }
    
    if (!result) return "completed";

    // Handle Gemini core tool results that might be objects
    let displayResult = result;
    if (typeof result === 'object' && result !== null) {
      // Check if it's a core tool result with returnDisplay
      if ('returnDisplay' in result) {
        const coreResult = result as any;
        if (typeof coreResult.returnDisplay === 'string') {
          displayResult = coreResult.returnDisplay;
        } else if (coreResult.returnDisplay && 'fileDiff' in coreResult.returnDisplay) {
          // Handle FileDiff format
          return "file changes applied";
        }
      } else {
        // Fallback to JSON string
        displayResult = JSON.stringify(result);
      }
    }

    const cleanResult = String(displayResult).trim();
    const lines = cleanResult.split("\n").filter((line) => line.trim()).length;

    // Gemini-specific tool result formatting
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
        // For MCP tools (contain __ in name), show full result without truncation
        if (toolName.includes('__')) {
          return cleanResult || "function completed";
        }
        return cleanResult || "completed";
    }
  };

  // Gemini-specific executing message
  const getGeminiExecutingMessage = (toolName: string, provider: string): string => {
    // Handle MCP tools
    if (toolName.startsWith('mcp__')) {
      return "Calling function";
    }

    const executingMap: { [key: string]: string } = {
      "Read": "Reading",
      "LS": "Listing", 
      "Grep": "Searching",
      "Glob": "Finding",
      "Write": "Writing",
      "Edit": "Editing",
      "MultiEdit": "Editing",
      "Bash": "Executing",
      "TodoWrite": "Updating todos",
      "TodoRead": "Reading todos",
      "WebSearch": "Searching web"
    };

    return executingMap[toolName] || "Calling function";
  };

  // Custom content rendering for Gemini-specific tools
  const renderGeminiCustomContent = (toolData: ToolExecutionData) => {
    // Special rendering for TodoWrite and TodoRead results
    if ((toolData.toolName === 'TodoWrite' || toolData.toolName === 'TodoRead') && 
        !toolData.isError && !toolData.isExecuting && renderTodoContent) {
      
      // TodoWrite contains todos in args.todos
      const todos = (toolData.args as any)?.todos;
      
      if (Array.isArray(todos) && todos.length > 0) {
        return renderTodoContent(todos);
      }
    }
    
    // Handle file diff display for Gemini core tool results
    if (toolData.result && typeof toolData.result === 'object' && 'returnDisplay' in toolData.result) {
      const coreResult = toolData.result as any;
      if (coreResult.returnDisplay && typeof coreResult.returnDisplay === 'object' && 'fileDiff' in coreResult.returnDisplay) {
        // This would be handled by a separate DiffRenderer component if available
        return (
          <Box marginTop={1}>
            <Text color={theme.text.muted}>File changes applied (diff available)</Text>
          </Box>
        );
      }
    }
    
    return null;
  };

  return (
    <BaseToolRenderer
      toolData={toolData}
      formatArgs={formatGeminiArgs}
      formatResult={formatGeminiResult}
      getExecutingMessage={getGeminiExecutingMessage}
      renderCustomContent={renderGeminiCustomContent}
      showProvider={false}
    />
  );
};

export const GeminiAdapter = {
  PermissionPrompt: GeminiPermissionPrompt,
  ToolRenderer: GeminiToolRenderer
};

export default GeminiAdapter;