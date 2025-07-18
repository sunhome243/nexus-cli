import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../../shared/ThemeProvider.js';
import { colorUtils, formatUtils, labelUtils } from '../../shared/ThemeUtils.js';
import { useTerminalWidth } from '../../../hooks/useTerminalWidth.js';
import { ProviderType } from '../../../abstractions/providers/types.js';

export interface PermissionRequest {
  tool: string;
  description: string;
  tier: 'safe' | 'cautious' | 'dangerous';
  timestamp?: Date;
  arguments?: any;
  plan?: string;
  command?: string;
}

export interface PermissionResponse {
  approved: boolean;
  autoApprove?: boolean;
}

export interface PermissionOption {
  key: string;
  label: string;
  action: () => void;
  color?: string;
}

export interface BasePermissionPromptProps {
  request: PermissionRequest;
  onResponse: (response: PermissionResponse) => void;
  permissionMode?: string;
  provider?: ProviderType;
  children?: React.ReactNode;
  renderArguments?: (args: any) => React.ReactNode;
  renderDetails?: () => React.ReactNode;
  customOptions?: PermissionOption[];
}

export const BasePermissionPrompt: React.FC<BasePermissionPromptProps> = ({
  request,
  onResponse,
  permissionMode = 'default',
  provider = ProviderType.CLAUDE,
  children,
  renderArguments,
  renderDetails,
  customOptions
}) => {
  const { theme } = useTheme();
  const [selectedOption, setSelectedOption] = useState(0);
  const { promptWidth } = useTerminalWidth({ minWidth: 60, maxWidth: 120, targetPercent: 0.85 });
  
  const handlePermissionResponse = (response: PermissionResponse) => {
    onResponse(response);
  };
  
  const defaultOptions: PermissionOption[] = [
    { 
      key: 'y', 
      label: 'Approve', 
      action: () => handlePermissionResponse({ approved: true }),
      color: theme.status.success
    },
    { 
      key: 'n', 
      label: 'Deny', 
      action: () => handlePermissionResponse({ approved: false }),
      color: theme.status.danger
    },
    { 
      key: 'a', 
      label: 'Auto-approve', 
      action: () => handlePermissionResponse({ approved: true, autoApprove: true }),
      color: theme.interaction.primary
    }
  ];
  
  const options = customOptions || defaultOptions;
  
  // Handle keyboard input with both arrow navigation and direct shortcuts
  useInput((input, key) => {
    // Arrow key navigation
    if (key.upArrow) {
      setSelectedOption((prev) => (prev - 1 + options.length) % options.length);
      return;
    }
    if (key.downArrow) {
      setSelectedOption((prev) => (prev + 1) % options.length);
      return;
    }
    
    // Enter key confirms selection
    if (key.return) {
      options[selectedOption].action();
      return;
    }
    
    // Direct keyboard shortcuts
    const option = options.find(opt => opt.key === input.toLowerCase());
    if (option) {
      option.action();
      return;
    }
    
    // Escape cancels
    if (key.escape) {
      handlePermissionResponse({ approved: false });
    }
  });

  const tierColor = colorUtils.getTierColor(request.tier, theme, permissionMode);
  const providerPrefix = provider === ProviderType.GEMINI ? 'GEMINI ' : '';
  
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={tierColor} paddingX={1} paddingY={0} width={promptWidth}>
      {/* Compact permission header */}
      <Box justifyContent="space-between">
        <Text color={theme.text.muted}>[{providerPrefix}PERMISSION]</Text>
        <Text color={tierColor} bold>
          {labelUtils.getTierLabel(request.tier)} {labelUtils.getPermissionModeLabel(permissionMode)}
        </Text>
      </Box>

      {/* Compact request description */}
      <Box>
        <Text color={theme.text.primary} bold>
          {provider === ProviderType.GEMINI ? '⚙ ' : '⚡ '}{request.tool}: 
        </Text>
        <Text color={theme.text.primary}>{request.description}</Text>
      </Box>


      {/* Compact plan content */}
      {request.plan && (
        <Box>
          <Text color={theme.text.muted} bold>Plan: </Text>
          <Text color={theme.text.primary}>{request.plan}</Text>
        </Box>
      )}

      {/* Provider-specific details */}
      {renderDetails && renderDetails()}

      {/* Dynamic arguments section with tool-specific labels */}
      {request.arguments && renderArguments && (
        <Box flexDirection="column" width={promptWidth - 2}>
          <Text color={theme.text.muted} bold>
            {(() => {
              if (provider === ProviderType.GEMINI) return 'Arguments:';
              
              // Tool-specific labels for Claude
              switch (request.tool) {
                case 'Write':
                case 'NotebookEdit':
                  return 'Content:';
                case 'Bash':
                  return 'Command:';
                case 'Read':
                case 'Glob':
                case 'Grep':
                  return 'Query:';
                default:
                  return 'Changes:';
              }
            })()}
          </Text>
          <Box width="100%" overflow="hidden">
            {renderArguments(request.arguments)}
          </Box>
        </Box>
      )}

      {/* Custom children content */}
      {children}

      {/* Compact interactive options */}
      <Box flexDirection="column" marginTop={1}>
        {options.map((option, index) => (
          <Box key={option.key}>
            <Text color={selectedOption === index ? theme.interaction.primary : theme.text.muted}>
              {selectedOption === index ? '▶ ' : '  '}
            </Text>
            <Text 
              color={selectedOption === index ? (option.color || theme.interaction.primary) : theme.text.muted}
              bold={selectedOption === index}
            >
              [{option.key}] {option.label}
              {option.key === 'a' && provider === ProviderType.CLAUDE && ' (session)'}
              {option.key === 'a' && provider === ProviderType.GEMINI && ' (similar)'}
            </Text>
          </Box>
        ))}
        <Box>
          <Text color={theme.text.muted}>  [Esc] Cancel</Text>
        </Box>
      </Box>

      {/* Compact danger warning */}
      {request.tier === 'dangerous' && (
        <Box>
          <Text color={theme.status.danger} bold>
            ⚠ DANGER: Can execute system commands or modify critical files
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default BasePermissionPrompt;