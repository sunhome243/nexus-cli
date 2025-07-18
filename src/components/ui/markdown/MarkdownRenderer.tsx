/**
 * Enhanced markdown renderer wrapper
 * Drop-in replacement for TextRenderer with enhanced markdown capabilities
 */

import React from 'react';
import { Box, Text } from 'ink';
import { MarkdownDisplay } from './MarkdownDisplay.js';
import { RenderInline } from './InlineMarkdownRenderer.js';

export interface MarkdownRendererProps {
  content: string;
  autoDetectMarkdown?: boolean;
  isPending?: boolean;
  color?: string;
  textColor?: string; // Alias for color
  dimColor?: boolean;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  wrap?: 'wrap' | 'truncate' | 'truncate-start' | 'truncate-middle' | 'truncate-end';
  enableInlineFormatting?: boolean; // Ignored
}

/**
 * Enhanced text renderer with markdown support
 * Supports TextRenderer API
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  autoDetectMarkdown = true,
  isPending = false,
  color,
  textColor,
  dimColor,
  bold,
  italic,
  underline,
  strikethrough,
  wrap = 'wrap',
  enableInlineFormatting, // Ignored
}) => {
  // Use textColor if provided, otherwise fall back to color
  const effectiveColor = textColor || color;
  
  // Use parent Box width if available, otherwise terminal dimensions
  const terminalWidth = process.stdout.columns || 80;
  const availableHeight = process.stdout.rows || 24;
  
  // For permission prompts, we need to respect the constrained width
  const effectiveWidth = Math.min(terminalWidth, 100);

  // Detect if content contains markdown patterns
  const hasMarkdown = React.useMemo(() => {
    if (!autoDetectMarkdown) return false;
    
    // Check for common markdown patterns
    const markdownPatterns = [
      /^#{1,6}\s+/m,           // Headers
      /```[\s\S]*?```/,        // Code blocks
      /^\s*[-*+]\s+/m,         // Unordered lists
      /^\s*\d+\.\s+/m,         // Ordered lists
      /\*\*.*?\*\*/,           // Bold
      /\*.*?\*/,               // Italic
      /`[^`]+`/,               // Inline code
      /^\s*>/m,                // Blockquotes
      /^\s*---\s*$/m,          // Horizontal rules
      /\[.*?\]\(.*?\)/,        // Links
      /^\|.*\|$/m,             // Tables
    ];
    
    return markdownPatterns.some(pattern => pattern.test(content));
  }, [content, autoDetectMarkdown]);

  // If markdown is detected and enabled, use MarkdownDisplay
  if (hasMarkdown && autoDetectMarkdown) {
    return (
      <Box width="100%" flexDirection="column">
        <MarkdownDisplay
          text={content}
          isPending={isPending}
          availableTerminalHeight={availableHeight}
          terminalWidth={effectiveWidth}
        />
      </Box>
    );
  }

  // For non-markdown content, check if it has inline formatting
  const hasInlineFormatting = /(\*\*.*?\*\*|\*.*?\*|_.*?_|~~.*?~~|`[^`]+`|\[.*?\]\(.*?\))/.test(content);
  
  // Apply text properties
  const textProps = {
    color: effectiveColor,
    dimColor,
    bold,
    italic,
    underline,
    strikethrough,
    wrap,
  };

  // If it has inline formatting but not full markdown, use RenderInline
  if (hasInlineFormatting && autoDetectMarkdown) {
    return (
      <Text {...textProps}>
        <RenderInline text={content} />
      </Text>
    );
  }

  // Otherwise, render as plain text
  return <Text {...textProps}>{content}</Text>;
};

// Export as default for easier drop-in replacement
export default MarkdownRenderer;