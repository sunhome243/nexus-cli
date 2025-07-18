import React from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../../shared/ThemeProvider.js';

interface HeaderProps {
  showFullHeader?: boolean;
  'data-testid'?: string;
}

const NEXUS_ASCII = 
`        ■        ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
       ╱│╲       ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
    ■─┼─┼─┼─■    ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
       ╲│╱       ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
        ■        ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
                 ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝`;

export const Header = React.memo(function Header({ showFullHeader = true, 'data-testid': testId }: HeaderProps) {
  const { theme } = useTheme();

  if (!showFullHeader) {
    return (
      <Box marginBottom={1} {...(testId ? { 'data-testid': testId } : {})}>
        <Text bold color={theme.interaction.primary}>NEXUS CLI</Text>
        <Text color={theme.text.muted}> - Universal AI Bridge</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" alignItems="center" marginBottom={2} {...(testId ? { 'data-testid': testId } : {})}>
      <Box>
        <Text color={theme.interaction.primary}>{NEXUS_ASCII}</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>Universal AI Bridge</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={theme.text.muted}>Tips for getting started:</Text>
      </Box>
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={theme.text.muted}>1. Ask questions, edit files, or run commands.</Text>
        <Text color={theme.text.muted}>2. Be specific for the best results.</Text>
        <Text color={theme.text.muted}>3. Use Ctrl+S to switch providers.</Text>
      </Box>
    </Box>
  );
});