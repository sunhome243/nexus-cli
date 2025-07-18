import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../shared/ThemeProvider.js';
import { IModelService } from '../../interfaces/core/IModelService.js';
import { ILoggerService } from '../../interfaces/core/ILoggerService.js';
import { ModelName } from '../../abstractions/providers/index.js';
import { ClaudeUsageTracker } from '../../services/usage/external/ClaudeUsageTracker.js';
import { GeminiUsageTracker } from '../../services/usage/internal/GeminiUsageTracker.js';
import { MCPService } from '../../services/core/MCPService.js';
import { MCPManager } from './MCPManager.js';
import { ToggleSwitch } from '../ui/interactive/ToggleSwitch.js';
import { UsageStatsDisplay } from '../ui/display/UsageStatsDisplay.js';

interface DashboardOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  modelService: IModelService;
  claudeUsageTracker: ClaudeUsageTracker;
  geminiUsageTracker: GeminiUsageTracker;
  mcpService: MCPService;
  logger: ILoggerService;
}

export const DashboardOverlay: React.FC<DashboardOverlayProps> = ({
  isVisible,
  onClose,
  modelService,
  claudeUsageTracker,
  geminiUsageTracker,
  mcpService,
  logger
}) => {
  const { theme, themeMode, toggleTheme } = useTheme();
  const [selectedOption, setSelectedOption] = useState(0);
  const [autoOpusEnabled, setAutoOpusEnabled] = useState(false);
  const [currentModel, setCurrentModel] = useState<ModelName>('sonnet');
  const [statsData, setStatsData] = useState<string>('');
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [showMCPManager, setShowMCPManager] = useState(false);


  useEffect(() => {
    if (!isVisible) {
      // Reset loading state when dashboard is hidden
      setIsLoadingStats(true);
      setStatsData('');
      return;
    }

    // Initialize current state
    setAutoOpusEnabled(modelService.getAutoOpusEnabled());
    setCurrentModel(modelService.getCurrentModel() as ModelName);

    // Load stats data only when dashboard opens
    loadStatsData();

    // Listen for changes
    const handleAutoOpusChange = (enabled: boolean) => {
      setAutoOpusEnabled(enabled);
    };
    
    const handleModelChange = (model: string) => {
      setCurrentModel(model as ModelName);
    };
    
    modelService.onAutoOpusChanged(handleAutoOpusChange);
    modelService.onModelChanged(handleModelChange as any);

    // No auto-refresh - load only when dashboard opens
    return () => {
      // No cleanup needed for intervals
    };
  }, [isVisible, modelService]);

  const loadStatsData = async () => {
    try {
      setIsLoadingStats(true);
      const lines: string[] = [];
      
      // Get Claude usage from claudeUsageTracker - exact original format
      const claudeStats = await claudeUsageTracker.getFormattedClaudeStats();
      lines.push(claudeStats);
      
      // Add separator
      lines.push('');
      
      // Get Gemini usage from existing tracker using structured stats
      const structuredStats = geminiUsageTracker.getStructuredStats();
      lines.push(`\x1b[38;2;66;133;244m🔷 Gemini Usage\x1b[0m`);
      lines.push('');
      
      // Format structured stats to match original format
      const geminiLines: string[] = [];
      geminiLines.push(`Current Session: ${structuredStats.session.tokens.toLocaleString()} tokens (${structuredStats.session.duration})`);
      
      if (structuredStats.session.models && structuredStats.session.models.length > 0) {
        geminiLines.push('');
        geminiLines.push('Model Usage:');
        structuredStats.session.models.forEach((model) => {
          geminiLines.push(`  ${model.name}: ${model.tokens.total.toLocaleString()} tokens (${model.requests} requests)`);
        });
      }
      
      if (structuredStats.session.tools && structuredStats.session.tools.length > 0) {
        const totalCalls = structuredStats.session.tools.reduce((sum, tool) => sum + tool.calls, 0);
        const successfulCalls = structuredStats.session.tools.reduce((sum, tool) => sum + tool.successes, 0);
        const failedCalls = totalCalls - successfulCalls;
        geminiLines.push('');
        geminiLines.push(`Tools: ${totalCalls} calls (${successfulCalls} success, ${failedCalls} failed)`);
      }
      
      geminiLines.push('');
      geminiLines.push(`Today's Total: ${structuredStats.daily.tokens.toLocaleString()} tokens (${structuredStats.daily.sessions} sessions)`);
      geminiLines.push(`Estimated Cost: $${structuredStats.daily.estimatedCost.toFixed(4)}`);
      
      if (structuredStats.session.tokens === 0 && structuredStats.daily.tokens === 0) {
        geminiLines.push('');
        geminiLines.push('\x1b[90mNo Gemini usage recorded yet\x1b[0m');
      }
      
      lines.push(geminiLines.join('\n'));
      
      const finalStatsData = lines.join('\n');
      
      // Update state in a single batch using callback to ensure proper sequencing
      setStatsData(finalStatsData);
      // Use setTimeout to ensure this runs after the statsData update
      setTimeout(() => setIsLoadingStats(false), 0);
      
    } catch (error) {
      logger.error(`❌ Dashboard: Stats load error: ${error}`, { component: 'DashboardOverlay' });
      setStatsData(`Failed to load stats: ${error}`);
      setIsLoadingStats(false);
    }
  };

  // Navigation options - expandable
  const options = [
    {
      key: 'theme',
      label: `Theme: ${themeMode.toUpperCase()}`,
      description: 'Toggle between dark and light themes',
      isToggle: true,
      value: themeMode === 'dark',
      action: () => {
        toggleTheme();
      }
    },
    {
      key: 'autoOpus',
      label: `Auto Opus on Plan Mode`,
      description: 'Automatically use Opus in Plan Mode',
      isToggle: true,
      value: autoOpusEnabled,
      action: async () => {
        await modelService.toggleAutoOpus();
      }
    },
    {
      key: 'mcpServers',
      label: 'MCP Servers',
      description: 'Manage MCP servers for Claude Code and Gemini CLI',
      isToggle: false,
      action: () => {
        setShowMCPManager(true);
      }
    }
  ];

  // Handle keyboard navigation - following BasePermissionPrompt pattern
  useInput((input, key) => {
    if (!isVisible) return;

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
    
    // Escape closes dashboard
    if (key.escape) {
      onClose();
      return;
    }
  });

  if (!isVisible) return null;

  // Show MCP Manager if requested
  if (showMCPManager) {
    return (
      <MCPManager
        isVisible={showMCPManager}
        onClose={() => setShowMCPManager(false)}
        mcpService={mcpService}
      />
    );
  }

  return (
    <Box flexDirection="column" width="100%" paddingY={1}>
      <Box
        borderStyle="single"
        borderColor={theme.interaction.primary}
        flexDirection="column"
        paddingX={2}
        paddingY={1}
        width="100%"
      >
        {/* Header */}
        <Box justifyContent="center">
          <Text color={theme.interaction.primary} bold>
            🔧 Dashboard
          </Text>
        </Box>
        <Box height={1} />

        {/* Settings Section */}
        {options.map((option, index) => (
          <Box key={option.key} flexDirection="column">
            <Box>
              <Text color={theme.text.primary}>
                {index === selectedOption ? '▶ ' : '  '}
              </Text>
              {option.isToggle ? (
                <ToggleSwitch
                  value={option.value || false}
                  label={option.label}
                />
              ) : (
                <Text 
                  color={index === selectedOption ? theme.interaction.primary : theme.text.primary}
                  bold={index === selectedOption}
                >
                  {option.label}
                </Text>
              )}
            </Box>
            <Box paddingLeft={3}>
              <Text color={theme.text.muted}>
                {option.description}
              </Text>
            </Box>
          </Box>
        ))}

        <Box height={1} />
        
        {/* Separator */}
        <Box width="100%">
          <Text>{'─'.repeat(50)}</Text>
        </Box>
        
        <Box height={1} />

        {/* Usage Statistics */}
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color={theme.text.primary} bold>
              Usage Statistics
            </Text>
          </Box>
          
          <UsageStatsDisplay 
            claudeStatsData={statsData}
            isLoading={isLoadingStats}
          />
        </Box>

        <Box height={1} />

        {/* Footer */}
        <Box justifyContent="center" borderTop>
          <Text color={theme.text.muted}>
            ↑/↓ Navigate • Enter Toggle • ESC Close
          </Text>
        </Box>
      </Box>
    </Box>
  );
};