import React from 'react';
import { Box, Text } from 'ink';
import { MarkdownRenderer } from '../../ui/renderers/index.js';
import { formatUtils } from '../../shared/ThemeUtils.js';
import { ArgumentRendererProps } from '../types/common.js';
import { useTerminalWidth } from '../../../hooks/useTerminalWidth.js';

/**
 * Shared ArgumentRenderer component for provider permission prompts
 * Handles sophisticated argument rendering with support for different tool types
 */
export const ArgumentRenderer: React.FC<ArgumentRendererProps> = ({
  args,
  tool,
  tryRenderAsDiff
}) => {
  const { promptWidth, truncateText, wrapText } = useTerminalWidth({ minWidth: 50, maxWidth: 100, targetPercent: 0.8 });
  const contentWidth = Math.max(40, promptWidth - 10); // Account for padding and borders, ensure minimum width
  
  if (!args) return null;

  // Try to render as diff for Edit operations only (not MultiEdit)
  if ((args.old_string !== undefined && args.new_string !== undefined) && !args.edits && tryRenderAsDiff) {
    const diffContent = tryRenderAsDiff(args);
    if (diffContent) {
      return <>{diffContent}</>;
    }
    
    // Fallback only if diff rendering failed
    const oldLines = args.old_string.split('\n');
    const newLines = args.new_string.split('\n');
    
    const formattedContent = [
      `${formatUtils.truncatePath(args.file_path, Math.floor(contentWidth * 0.7))} (-${oldLines.length} +${newLines.length})`,
      `− ${truncateText(args.old_string, contentWidth - 2)}`,
      `+ ${truncateText(args.new_string, contentWidth - 2)}`
    ].join('\n');
    
    return (
      <MarkdownRenderer 
        content={formattedContent}
        autoDetectMarkdown={true}
        enableInlineFormatting={true}
      />
    );
  }
  
  // Special handling for Write operations - MarkdownRenderer will auto-detect and format code
  if (args.file_path && args.content && typeof args.content === 'string') {
    // For large content, show a preview with line count
    const lines = args.content.split('\n');
    const maxPreviewLines = 10;
    
    if (lines.length > maxPreviewLines) {
      const preview = lines.slice(0, maxPreviewLines).join('\n');
      const remainingLines = lines.length - maxPreviewLines;
      
      return (
        <Box flexDirection="column" width="100%">
          <MarkdownRenderer 
            content={preview}
            autoDetectMarkdown={true}
          />
          <Text color="gray" dimColor>
            ... and {remainingLines} more line{remainingLines === 1 ? '' : 's'}
          </Text>
        </Box>
      );
    }
    
    return (
      <MarkdownRenderer 
        content={args.content}
        autoDetectMarkdown={true}
      />
    );
  }
  
  // Clean formatting for different tool types
  if (typeof args === 'object' && args !== null) {
    let formattedContent = '';
    
    // Skip Edit operations since they're handled above
    if (args.file_path && (args.old_string !== undefined && args.new_string !== undefined) && !args.edits) {
      // Already handled above
    }
    // Handle MultiEdit operations with diff renderer
    else if (args.file_path && args.edits && Array.isArray(args.edits) && tryRenderAsDiff) {
      const diffContent = tryRenderAsDiff(args);
      if (diffContent) {
        return <>{diffContent}</>;
      }
      
      // Fallback only if diff rendering failed
      const totalLines = args.edits.reduce((acc: any, edit: any) => {
        if (edit.old_string && edit.new_string) {
          acc.removed += edit.old_string.split('\n').length;
          acc.added += edit.new_string.split('\n').length;
        }
        return acc;
      }, { removed: 0, added: 0 });
      
      formattedContent = `${args.edits.length} edits, -${totalLines.removed} +${totalLines.added} lines`;
      
      // Show each edit clearly
      args.edits.forEach((edit: any, index: number) => {
        if (edit.old_string && edit.new_string) {
          formattedContent += `\n\nEdit ${index + 1}:`;
          formattedContent += `\n− ${edit.old_string}`;
          formattedContent += `\n+ ${edit.new_string}`;
        }
      });
    }
    // Handle Write operations fallback
    else if (args.file_path && args.content) {
      formattedContent = args.content;
    }
    // Handle Bash operations with enhanced formatting
    else if (args.command) {
      formattedContent = args.command;
      if (args.description) {
        formattedContent += `\n${args.description}`;
      }
    }
    // Handle other operations
    else {
      const relevantFields = Object.entries(args).filter(([key, value]) => 
        !key.startsWith('_') && value !== null && value !== undefined && key !== 'timeout'
      );
      
      if (relevantFields.length > 0) {
        formattedContent = relevantFields.map(([key, value]) => {
          if (key === 'file_path') return `File: ${formatUtils.truncatePath(String(value), Math.floor(contentWidth * 0.8))}`;
          if (key === 'query') return `Query: ${truncateText(String(value), contentWidth - 7)}`;
          if (key === 'pattern') return `Pattern: ${truncateText(String(value), contentWidth - 9)}`;
          if (typeof value === 'string') {
            const maxKeyWidth = Math.max(key.length + 2, 10);
            const valueWidth = contentWidth - maxKeyWidth;
            return `${key}: ${truncateText(value, valueWidth)}`;
          }
          return `${key}: ${value}`;
        }).join('\n');
      }
    }

    return (
      <MarkdownRenderer 
        content={formattedContent || 'No changes to display'}
        autoDetectMarkdown={true}
        enableInlineFormatting={true}
      />
    );
  }
  
  return <MarkdownRenderer content={String(args)} autoDetectMarkdown={true} />;
};

/**
 * Utility function to determine if arguments should be shown for a tool
 */
export const shouldShowArguments = (tool: string, args: any): boolean => {
  return args && 
    Object.keys(args).length > 0 && 
    ['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Bash'].includes(tool);
};