import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { useTheme } from '../shared/ThemeProvider.js';
import { useServices } from '../providers/ServiceProvider.js';
import { ClaudeScope, GeminiScope } from '../../services/core/MCPService.js';
import { useTextBuffer } from '../../hooks/useTextBuffer.js';
import { useKeypress } from '../../hooks/useKeypress.js';

interface ImportOption {
  key: string;
  label: string;
  description: string;
  action: () => void;
  disabled?: boolean;
  selected?: boolean;
}

export interface JSONImportConfig {
  servers: Array<{
    name: string;
    command?: string;
    url?: string;
    args?: string[];
    env?: Record<string, string>;
    timeout?: number;
    headers?: Record<string, string>;
  }>;
  platforms: { claude: boolean; gemini: boolean };
  claudeScope: ClaudeScope;
  geminiScope: GeminiScope;
}

interface MCPJSONImportProps {
  isVisible: boolean;
  onComplete: (config: JSONImportConfig) => void;
  onCancel: () => void;
}

interface ImportedMCPConfig {
  mcpServers: Record<string, {
    command?: string;
    url?: string;
    args?: string[];
    env?: Record<string, string>;
    timeout?: number;
    headers?: Record<string, string>;
  }>;
}

export const MCPJSONImport: React.FC<MCPJSONImportProps> = ({ isVisible, onComplete, onCancel }) => {
  const { theme } = useTheme();
  const { logger } = useServices();
  const [currentStep, setCurrentStep] = useState<'json' | 'platforms' | 'scope' | 'preview'>('json');
  const [selectedOption, setSelectedOption] = useState(0);
  const [isInputMode, setIsInputMode] = useState(false);
  const [parsedServers, setParsedServers] = useState<JSONImportConfig['servers']>([]);
  const [platforms, setPlatforms] = useState({ claude: true, gemini: true });
  const [claudeScope, setClaudeScope] = useState<ClaudeScope>('local');
  const [geminiScope, setGeminiScope] = useState<GeminiScope>('project');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Declare functions before using them in hooks
  const finishJSONInput = useCallback(() => {
    setIsInputMode(false);
  }, []);

  const startJSONInput = useCallback(() => {
    setIsInputMode(true);
  }, []);

  // Set up stdin for TextBuffer
  const { stdin, setRawMode } = useStdin();
  
  // Text buffer for JSON input (matching gemini-cli pattern)
  const jsonBuffer = useTextBuffer({
    initialText: '',
    viewport: { width: 80, height: 10 },
    stdin,
    setRawMode,
    onChange: (text: string) => {
      // JSON input change handled automatically
    },
    isValidPath: (path: string) => {
      // Simple path validation for JSON mode
      try {
        return path.length > 0 && !path.includes('\n') && !path.includes('\r');
      } catch {
        return false;
      }
    },
  });

  const parseJSONAndProceed = useCallback((text: string) => {
    try {
      setErrorMessage('');
      
      if (!text.trim()) {
        setErrorMessage('Please paste JSON configuration');
        return false;
      }

      const config: ImportedMCPConfig = JSON.parse(text);
      
      if (!config.mcpServers || typeof config.mcpServers !== 'object') {
        setErrorMessage('JSON must contain "mcpServers" object');
        return false;
      }

      const servers = Object.entries(config.mcpServers).map(([name, serverConfig]) => {
        // Validate server config
        if (!serverConfig.command && !serverConfig.url) {
          throw new Error(`Server "${name}" must have either "command" or "url"`);
        }

        return {
          name,
          command: serverConfig.command,
          url: serverConfig.url,
          args: serverConfig.args || [],
          env: serverConfig.env || {},
          timeout: serverConfig.timeout || 30000,
          headers: serverConfig.headers
        };
      });

      if (servers.length === 0) {
        setErrorMessage('No valid servers found in configuration');
        return false;
      }

      setParsedServers(servers);
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? `Invalid JSON: ${error.message}` : 'Invalid JSON format');
      return false;
    }
  }, []); // No dependencies since we pass text as parameter

  // Ref to track if we just received a backslash (for Shift+Enter detection)
  const jsonJustReceivedBackslashRef = useRef(false);

  // Handle JSON input submission with Enter (consistent UX pattern)  
  const handleJSONInput = useCallback((key: any) => {
    // Debug logging to understand what we're receiving
    logger.debug('JSON input key received', {
      component: 'MCPJSONImport',
      keyName: key.name,
      shift: key.shift,
      ctrl: key.ctrl,
      meta: key.meta,
      paste: key.paste,
      sequence: JSON.stringify(key.sequence)
    });
    
    // Handle backslash - might be start of Shift+Enter sequence
    if (key.sequence === '\\' && !key.paste) {
      logger.debug('Received backslash, waiting for Enter to confirm Shift+Enter', { component: 'MCPJSONImport' });
      jsonJustReceivedBackslashRef.current = true;
      // Don't insert the backslash yet - wait to see if Enter follows
      setTimeout(() => {
        jsonJustReceivedBackslashRef.current = false;
      }, 100); // Reset after 100ms
      return;
    }
    
    // Handle Enter - check if it's part of Shift+Enter sequence or submission
    if (key.name === 'return' && !key.paste) {
      logger.debug('Checking for Shift+Enter sequence', { 
        component: 'MCPJSONImport', 
        jsonJustReceivedBackslash: jsonJustReceivedBackslashRef.current 
      });
      if (jsonJustReceivedBackslashRef.current) {
        // This is Shift+Enter sequence: backslash followed by Enter
        logger.debug('Detected Shift+Enter sequence, inserting newline', { component: 'MCPJSONImport' });
        jsonJustReceivedBackslashRef.current = false;
        jsonBuffer.newline();
        return;
      }
      
      // Regular Enter - submit JSON (only if no modifier keys)
      if (!key.ctrl && !key.meta && !key.shift) {
        if (parseJSONAndProceed(jsonBuffer.text)) {
          finishJSONInput();
          setCurrentStep('platforms');
          setSelectedOption(0);
        }
        return;
      }
    }
    
    // For proper Shift+Enter (if terminal supports it), insert newline
    if (key.name === 'return' && key.shift && !key.paste) {
      logger.debug('Native Shift+Enter detected, inserting newline', { component: 'MCPJSONImport' });
      jsonBuffer.newline();
      return;
    }
    
    // If we received any other key after backslash, it wasn't Shift+Enter
    if (jsonJustReceivedBackslashRef.current) {
      logger.debug('Backslash was not Shift+Enter, inserting backslash + current key', { component: 'MCPJSONImport' });
      jsonJustReceivedBackslashRef.current = false;
      jsonBuffer.insert('\\'); // Insert the backslash we held back
    }
    
    // Let TextBuffer handle all other input (backspace, paste, character input, navigation, etc.)
    jsonBuffer.handleInput(key);
  }, [logger, jsonBuffer, parseJSONAndProceed, finishJSONInput, setCurrentStep, setSelectedOption]);
  
  // Set up keypress listening only when in input mode
  useKeypress(handleJSONInput, { isActive: isInputMode });

  const resetImport = () => {
    setCurrentStep('json');
    setSelectedOption(0);
    setIsInputMode(false);
    jsonBuffer.setText('');
    setParsedServers([]);
    setPlatforms({ claude: true, gemini: true });
    setClaudeScope('local');
    setGeminiScope('project');
    setErrorMessage('');
  };

  const handleNext = () => {
    switch (currentStep) {
      case 'json':
        if (parseJSONAndProceed(jsonBuffer.text)) {
          setCurrentStep('platforms');
          setSelectedOption(0);
        }
        break;
      case 'platforms':
        if (!platforms.claude && !platforms.gemini) {
          setErrorMessage('At least one platform must be selected');
          return;
        }
        setErrorMessage('');
        setCurrentStep('scope');
        setSelectedOption(0);
        break;
      case 'scope':
        setCurrentStep('preview');
        setSelectedOption(0);
        break;
      case 'preview':
        onComplete({
          servers: parsedServers,
          platforms,
          claudeScope,
          geminiScope
        });
        break;
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'platforms':
        setCurrentStep('json');
        break;
      case 'scope':
        setCurrentStep('platforms');
        break;
      case 'preview':
        setCurrentStep('scope');
        break;
    }
    setSelectedOption(0);
  };


  const getStepContent = (): { title: string; options: ImportOption[] } => {
    switch (currentStep) {
      case 'json':
        return {
          title: 'Import MCP Configuration',
          options: [
            {
              key: 'input',
              label: 'Enter JSON Configuration',
              description: 'Type or paste your MCP servers JSON configuration',
              action: startJSONInput
            },
            ...(jsonBuffer.text.trim() ? [{
              key: 'clear',
              label: 'Clear JSON',
              description: 'Clear current JSON input',
              action: () => jsonBuffer.setText('')
            }] : []),
            {
              key: 'next',
              label: 'Parse & Continue',
              description: 'Parse JSON and continue to platform selection',
              action: handleNext,
              disabled: !jsonBuffer.text.trim()
            },
            {
              key: 'back',
              label: 'Back',
              description: 'Return to main menu',
              action: onCancel
            }
          ]
        };

      case 'platforms':
        return {
          title: 'Select Platforms',
          options: [
            {
              key: 'claude',
              label: `Claude Code: ${platforms.claude ? 'Yes' : 'No'}`,
              description: 'Import servers for Claude Code',
              action: () => setPlatforms(prev => ({ ...prev, claude: !prev.claude }))
            },
            {
              key: 'gemini',
              label: `Gemini CLI: ${platforms.gemini ? 'Yes' : 'No'}`,
              description: 'Import servers for Gemini CLI (stdio only)',
              action: () => setPlatforms(prev => ({ ...prev, gemini: !prev.gemini }))
            },
            {
              key: 'next',
              label: 'Next',
              description: 'Continue to scope selection',
              action: handleNext
            },
            {
              key: 'back',
              label: 'Back',
              description: 'Return to JSON input',
              action: handleBack
            }
          ]
        };

      case 'scope':
        return {
          title: 'Configure Scopes',
          options: [
            ...(platforms.claude ? [
              {
                key: 'claude-local',
                label: 'Claude Local',
                description: 'Project only (local scope: ~/.claude.json)',
                action: () => setClaudeScope('local'),
                selected: claudeScope === 'local'
              },
              {
                key: 'claude-project',
                label: 'Claude Project',
                description: 'Version controlled (.mcp.json)',
                action: () => setClaudeScope('project'),
                selected: claudeScope === 'project'
              },
              {
                key: 'claude-user',
                label: 'Claude User',
                description: 'All projects (~/.claude/mcp.json)',
                action: () => setClaudeScope('user'),
                selected: claudeScope === 'user'
              }
            ] : []),
            ...(platforms.gemini ? [
              {
                key: 'gemini-project',
                label: 'Gemini Project',
                description: 'Project specific (.gemini/settings.json)',
                action: () => setGeminiScope('project'),
                selected: geminiScope === 'project'
              },
              {
                key: 'gemini-user',
                label: 'Gemini User',
                description: 'Global (~/.gemini/settings.json)',
                action: () => setGeminiScope('user'),
                selected: geminiScope === 'user'
              }
            ] : []),
            {
              key: 'next',
              label: 'Next',
              description: 'Continue to preview',
              action: handleNext
            },
            {
              key: 'back',
              label: 'Back',
              description: 'Return to platform selection',
              action: handleBack
            }
          ]
        };

      case 'preview':
        return {
          title: 'Import Preview',
          options: [
            {
              key: 'import',
              label: 'Import Servers',
              description: `Import ${parsedServers.length} server(s) to selected platforms`,
              action: handleNext
            },
            {
              key: 'back',
              label: 'Back',
              description: 'Return to scope selection',
              action: handleBack
            }
          ]
        };

      default:
        return { title: 'Unknown Step', options: [] };
    }
  };

  // Handle navigation when not in input mode, ESC always works
  useInput((input, key) => {
    if (!isVisible) return;
    
    // Handle ESC in any mode
    if (key.escape) {
      if (isInputMode) {
        finishJSONInput();
      } else {
        onCancel();
      }
      return;
    }
    
    // Ignore other keys when in input mode (let TextBuffer handle them)
    if (isInputMode) return;

    const content = getStepContent();
    const options = content.options.filter(opt => !opt.disabled);

    if (key.upArrow) {
      setSelectedOption((prev) => (prev - 1 + options.length) % options.length);
      return;
    }
    if (key.downArrow) {
      setSelectedOption((prev) => (prev + 1) % options.length);
      return;
    }
    if (key.return) {
      const selectedOpt = options[selectedOption];
      if (selectedOpt) {
        selectedOpt.action();
      }
      return;
    }
  });

  if (!isVisible) return null;

  const content = getStepContent();
  const options = content.options.filter(opt => !opt.disabled);

  return (
    <Box flexDirection="column" width="100%" paddingY={1}>
      <Box
        borderStyle="round"
        borderColor={theme.interaction.primary}
        flexDirection="column"
        paddingX={2}
        paddingY={1}
        width="100%"
      >
        {/* Header */}
        <Box justifyContent="center">
          <Text color={theme.interaction.primary} bold>
            {content.title}
          </Text>
        </Box>
        <Box height={1} />

        {/* Error Message */}
        {errorMessage && (
          <>
            <Box>
              <Text color={theme.status.danger}>Error: {errorMessage}</Text>
            </Box>
            <Box height={1} />
          </>
        )}

        {/* JSON Input Mode */}
        {isInputMode && (
          <>
            <Box>
              <Text color={theme.text.primary}>Enter JSON configuration:</Text>
            </Box>
            <Box height={1} />
            <Box borderStyle="single" borderColor={theme.interaction.primary} padding={1} minHeight={8}>
              <Box flexDirection="column">
                {jsonBuffer.text ? (
                  <Box flexDirection="column">
                    {jsonBuffer.viewportVisualLines.map((line, visualIdxInRenderedSet) => {
                      const [cursorVisualRowAbsolute, cursorVisualColAbsolute] = jsonBuffer.visualCursor;
                      const scrollVisualRow = jsonBuffer.visualScrollRow;
                      const cursorVisualRow = cursorVisualRowAbsolute - scrollVisualRow;
                      const inputWidth = 75; // Conservative width for JSON input
                      
                      let display = line || ' ';
                      
                      // Handle cursor highlighting (matching Input.tsx logic)
                      if (visualIdxInRenderedSet === cursorVisualRow) {
                        const relativeVisualColForHighlight = cursorVisualColAbsolute;
                        
                        if (relativeVisualColForHighlight >= 0) {
                          if (relativeVisualColForHighlight < display.length) {
                            const charToHighlight = display.charAt(relativeVisualColForHighlight) || ' ';
                            const beforeCursor = display.slice(0, relativeVisualColForHighlight);
                            const afterCursor = display.slice(relativeVisualColForHighlight + 1);
                            
                            return (
                              <Text key={`line-${visualIdxInRenderedSet}`} color={theme.text.primary}>
                                {beforeCursor}
                                <Text inverse>{charToHighlight}</Text>
                                {afterCursor}
                              </Text>
                            );
                          } else if (relativeVisualColForHighlight === display.length) {
                            return (
                              <Text key={`line-${visualIdxInRenderedSet}`} color={theme.text.primary}>
                                {display}
                                <Text inverse> </Text>
                              </Text>
                            );
                          }
                        }
                      }
                      
                      return (
                        <Text key={`line-${visualIdxInRenderedSet}`} color={theme.text.primary}>
                          {display}
                        </Text>
                      );
                    })}
                    <Box height={1} />
                    <Text color={theme.text.muted}>
                      {jsonBuffer.lines.length} lines • {jsonBuffer.text.length} chars
                    </Text>
                  </Box>
                ) : (
                  <Text color={theme.text.muted} dimColor>
                    Type or paste your MCP JSON configuration here...
                    {'\n'}
                    {'\n'}Example:
                    {'\n'}{'{'} 
                    {'\n'}  "mcpServers": {'{'}
                    {'\n'}    "server-name": {'{'}
                    {'\n'}      "command": "npx",
                    {'\n'}      "args": ["-y", "package"]
                    {'\n'}    {'}'}
                    {'\n'}  {'}'}
                    {'\n'}{'}'}
                  </Text>
                )}
              </Box>
            </Box>
            <Box height={1} />
            <Box>
              <Text color={theme.text.muted}>
                Enter to continue • Shift+Enter for new line • ESC to cancel
              </Text>
            </Box>
            <Box height={1} />
          </>
        )}

        {/* JSON Preview */}
        {currentStep === 'json' && jsonBuffer.text && !isInputMode && (
          <>
            <Box>
              <Text color={theme.text.primary}>Current JSON:</Text>
            </Box>
            <Box borderStyle="single" borderColor={theme.text.muted} padding={1}>
              <Text color={theme.text.secondary}>
                {jsonBuffer.text.slice(0, 200)}{jsonBuffer.text.length > 200 ? '...' : ''}
              </Text>
            </Box>
            <Box height={1} />
          </>
        )}

        {/* Server Preview */}
        {currentStep === 'preview' && !isInputMode && (
          <>
            <Box flexDirection="column">
              <Text color={theme.text.primary} bold>Servers to Import ({parsedServers.length}):</Text>
              <Box height={1} />
              {parsedServers.map((server, index) => (
                <Box key={server.name} flexDirection="column">
                  <Text color={theme.text.secondary}>• {server.name}</Text>
                  <Box paddingLeft={2}>
                    <Text color={theme.text.muted}>
                      {server.command ? `Command: ${server.command}` : `URL: ${server.url}`}
                      {server.args && server.args.length > 0 && ` Args: ${server.args.join(' ')}`}
                    </Text>
                  </Box>
                </Box>
              ))}
              <Box height={1} />
              <Text color={theme.text.secondary}>
                Platforms: {[platforms.claude && 'Claude Code', platforms.gemini && 'Gemini CLI'].filter(Boolean).join(', ')}
              </Text>
              {platforms.claude && (
                <Text color={theme.text.secondary}>Claude Scope: {claudeScope}</Text>
              )}
              {platforms.gemini && (
                <Text color={theme.text.secondary}>Gemini Scope: {geminiScope}</Text>
              )}
            </Box>
            <Box height={1} />
          </>
        )}


        {/* Options Menu */}
        {!isInputMode && (
          <>
            {options.map((option, index) => (
              <Box key={option.key} flexDirection="column">
                <Box>
                  <Text color={theme.text.primary}>
                    {index === selectedOption ? '> ' : '  '}
                  </Text>
                  <Text 
                    color={
                      option.selected ? theme.status.success : 
                      index === selectedOption ? theme.interaction.primary : 
                      theme.text.primary
                    }
                    bold={index === selectedOption || option.selected}
                  >
                    {option.selected ? '✓ ' : ''}{option.label}
                  </Text>
                </Box>
                <Box paddingLeft={3}>
                  <Text color={theme.text.muted}>
                    {option.description}
                  </Text>
                </Box>
              </Box>
            ))}
          </>
        )}

        <Box height={1} />

        {/* Footer */}
        <Box justifyContent="center" borderTop>
          <Text color={theme.text.muted}>
            {isInputMode 
              ? 'Enter to continue • Shift+Enter for new line • ESC to cancel'
              : '↑/↓ Navigate • Enter Select • ESC Close'
            }
          </Text>
        </Box>
      </Box>
    </Box>
  );
};