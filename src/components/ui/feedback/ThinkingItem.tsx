import React from 'react';
import { Box, Text } from 'ink';
import { ThinkingItem } from '../../core/types.js';
import { useTheme } from '../../shared/ThemeProvider.js';
import { MarkdownRenderer } from '../renderers/index.js';
import { ProviderRegistry } from '../../shared/ProviderRegistry.js';
import { ProviderType } from '../../providers/types/index.js';

interface ThinkingItemProps {
  thinking: ThinkingItem;
}

export const ThinkingItemComponent = React.memo(function ThinkingItemComponent({ 
  thinking
}: ThinkingItemProps) {
  const { theme } = useTheme();
  // Use provider-specific color for thinking indicator
  const getThinkingColor = (provider: ProviderType) => {
    const providerTheme = ProviderRegistry.getTheme(provider);
    return providerTheme.primary;
  };

  return (
    <Box marginBottom={1} flexDirection="column">
      {/* Thinking header with provider-specific color */}
      <Box flexDirection="row" alignItems="flex-start">
        <Text color={getThinkingColor(thinking.provider as ProviderType)} bold>
          ● {thinking.subject}
        </Text>
        <Text color={theme.text.muted}> [Thinking]</Text>
      </Box>
      
      {/* Thinking description indented with markdown support */}
      <Box marginLeft={2} marginTop={0}>
        <MarkdownRenderer 
          content={thinking.description}
          autoDetectMarkdown={true}
          enableInlineFormatting={true}
          textColor={theme.text.muted}
        />
      </Box>
    </Box>
  );
});

export default ThinkingItemComponent;