import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../shared/ThemeProvider.js';
import { useServices } from '../providers/ServiceProvider.js';
import { MCPJSONImport, JSONImportConfig } from './MCPJSONImport.js';
import { MCPService, MCPServer } from '../../services/core/MCPService.js';

interface MCPManagerProps {
  isVisible: boolean;
  onClose: () => void;
  mcpService: MCPService;
}

export const MCPManager: React.FC<MCPManagerProps> = ({ isVisible, onClose, mcpService }) => {
  const { theme } = useTheme();
  const { logger } = useServices();
  const [currentView, setCurrentView] = useState<'main' | 'add' | 'list' | 'remove' | 'removeConfirm'>('main');
  const [selectedOption, setSelectedOption] = useState(0);
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [serversByScope, setServersByScope] = useState<{
    claudeLocal: MCPServer[];
    claudeProject: MCPServer[];
    claudeUser: MCPServer[];
    geminiProject: MCPServer[];
    geminiUser: MCPServer[];
  }>({ claudeLocal: [], claudeProject: [], claudeUser: [], geminiProject: [], geminiUser: [] });
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [serverToRemove, setServerToRemove] = useState<string>('');

  useEffect(() => {
    if (isVisible) {
      loadServers();
    }
  }, [isVisible]);

  const loadServers = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      
      logger.info('Starting to load MCP servers', { component: 'MCPManager' });
      
      // Load both unified and scope-separated views
      const [allServers, scopedServers] = await Promise.all([
        mcpService.loadAllServers(),
        mcpService.loadServersByScope()
      ]);
      
      logger.info('Successfully loaded MCP servers', {
        component: 'MCPManager',
        allServersCount: allServers.length,
        allServers: allServers.map(s => ({ name: s.name, claudeCode: s.claudeCode, geminiCLI: s.geminiCLI, claudeScope: s.claudeScope, geminiScope: s.geminiScope })),
        scopedServers: {
          claudeLocal: scopedServers.claudeLocal.length,
          claudeProject: scopedServers.claudeProject.length,
          claudeUser: scopedServers.claudeUser.length,
          geminiProject: scopedServers.geminiProject.length,
          geminiUser: scopedServers.geminiUser.length
        }
      });
      
      setServers(allServers);
      setServersByScope(scopedServers);
    } catch (error) {
      logger.error('Failed to load MCP servers', { component: 'MCPManager', error: error?.toString() });
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load servers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJSONImportComplete = async (config: JSONImportConfig) => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      
      // Import each server from the JSON configuration
      const importPromises = config.servers.map(async (server) => {
        // Convert JSONImportConfig server to WizardState format
        const serverConfig = {
          step: 'preview' as const,
          serverName: server.name,
          transport: (server.url ? (server.url.includes('/sse') ? 'SSE' : 'HTTP') : 'stdio') as 'stdio' | 'SSE' | 'HTTP',
          commandOrUrl: server.command || server.url || '',
          platforms: config.platforms,
          claudeScope: config.claudeScope,
          geminiScope: config.geminiScope,
          advanced: {
            args: server.args || [],
            env: server.env || {},
            timeout: server.timeout || 30000,
            headers: server.headers
          }
        };
        
        await mcpService.saveServer(serverConfig);
      });
      
      await Promise.all(importPromises);
      await loadServers();
      setCurrentView('main');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to import servers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveServer = async (serverName: string) => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      
      const result = await mcpService.removeServer(serverName);
      
      if (!result.claude && !result.gemini) {
        setErrorMessage('Server not found in any configuration');
        return;
      }
      
      await loadServers();
      setCurrentView('main');
      setServerToRemove('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to remove server');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmRemoveServer = (serverName: string) => {
    setServerToRemove(serverName);
    setCurrentView('removeConfirm');
  };

  const getMainOptions = () => [
    {
      key: 'add',
      label: 'Add MCP Server',
      description: 'Configure a new MCP server with guided setup',
      action: () => setCurrentView('add')
    },
    {
      key: 'list',
      label: `List Servers (${servers.length})`,
      description: 'View all configured MCP servers',
      action: () => setCurrentView('list')
    },
    {
      key: 'remove',
      label: 'Remove Server',
      description: 'Remove MCP server from all configurations',
      action: () => setCurrentView('remove')
    },
    {
      key: 'back',
      label: 'Back',
      description: 'Return to main dashboard',
      action: onClose
    }
  ];

  const getRemoveConfirmOptions = () => {
    const server = servers.find(s => s.name === serverToRemove);
    if (!server) return [];
    
    return [
      {
        key: 'confirm',
        label: 'Remove Server',
        description: `Remove "${serverToRemove}" from all configurations`,
        action: () => handleRemoveServer(serverToRemove)
      },
      {
        key: 'back',
        label: 'Back',
        description: 'Return to server list',
        action: () => {
          setCurrentView('remove');
          setServerToRemove('');
        }
      }
    ];
  };

  const getRemoveOptions = () => [
    ...servers.map(server => ({
      key: server.name,
      label: server.name,
      description: `Remove from ${[server.claudeCode && 'Claude Code', server.geminiCLI && 'Gemini CLI'].filter(Boolean).join(' and ')}`,
      action: () => confirmRemoveServer(server.name)
    })),
    {
      key: 'back',
      label: 'Back',
      description: 'Return to main menu',
      action: () => setCurrentView('main')
    }
  ];

  const getCurrentOptions = () => {
    switch (currentView) {
      case 'remove': return getRemoveOptions();
      case 'removeConfirm': return getRemoveConfirmOptions();
      default: return getMainOptions();
    }
  };

  const getCurrentTitle = () => {
    switch (currentView) {
      case 'list': return 'MCP Servers';
      case 'remove': return 'Remove MCP Server';
      case 'removeConfirm': return 'Confirm Removal';
      default: return 'MCP Manager';
    }
  };

  useInput((input, key) => {
    if (!isVisible || currentView === 'add') return;

    const options = getCurrentOptions();

    if (key.upArrow) {
      setSelectedOption((prev) => (prev - 1 + options.length) % options.length);
      return;
    }
    if (key.downArrow) {
      setSelectedOption((prev) => (prev + 1) % options.length);
      return;
    }
    if (key.return) {
      if (!isLoading) {
        options[selectedOption]?.action();
      }
      return;
    }
    if (key.escape) {
      onClose();
      return;
    }
  });

  if (!isVisible) return null;

  // Show JSON import for add view
  if (currentView === 'add') {
    return (
      <MCPJSONImport
        isVisible={true}
        onComplete={handleJSONImportComplete}
        onCancel={() => setCurrentView('main')}
      />
    );
  }

  const options = getCurrentOptions();

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
            {getCurrentTitle()}
          </Text>
        </Box>
        <Box height={1} />

        {/* Loading Indicator */}
        {isLoading && (
          <>
            <Box>
              <Text color={theme.interaction.primary}>Processing...</Text>
            </Box>
            <Box height={1} />
          </>
        )}

        {/* Error Message */}
        {errorMessage && (
          <>
            <Box>
              <Text color={theme.status.danger}>Error: {errorMessage}</Text>
            </Box>
            <Box height={1} />
          </>
        )}

        {/* List View - Scope Separated */}
        {currentView === 'list' && (
          <>
            {servers.length === 0 ? (
              <Box flexDirection="column">
                <Text color={theme.text.muted}>No MCP servers configured</Text>
                <Box height={1} />
                <Text color={theme.text.muted}>Use "Add MCP Server" to configure your first server.</Text>
              </Box>
            ) : (
              <Box flexDirection="column">
                {/* Local Scope (Claude Code only) */}
                {serversByScope.claudeLocal.length > 0 && (
                  <>
                    <Box>
                      <Text color={theme.interaction.primary} bold>Local Scope (Claude Code)</Text>
                    </Box>
                    <Box height={1} />
                    {serversByScope.claudeLocal.map((server) => (
                      <Box key={`local-${server.name}`} flexDirection="column" paddingLeft={2}>
                        <Box>
                          <Text color={theme.text.primary} bold>• {server.name}</Text>
                        </Box>
                        <Box paddingLeft={2}>
                          <Text color={theme.text.secondary}>
                            {server.transport} • {server.transport === 'stdio' ? `Command: ${server.command}` : `URL: ${server.url}`}
                          </Text>
                        </Box>
                        {(server.timeout !== 30000 || (server.args && server.args.length > 0)) && (
                          <Box paddingLeft={2}>
                            <Text color={theme.text.muted}>
                              Timeout: {server.timeout}ms
                              {server.args && server.args.length > 0 && ` • Args: ${server.args.join(' ')}`}
                            </Text>
                          </Box>
                        )}
                        <Box height={1} />
                      </Box>
                    ))}
                  </>
                )}

                {/* Project Scope */}
                {(serversByScope.claudeProject.length > 0 || serversByScope.geminiProject.length > 0) && (
                  <>
                    <Box>
                      <Text color={theme.interaction.primary} bold>Project Scope</Text>
                    </Box>
                    <Box height={1} />
                    
                    {/* Claude Code Project Servers */}
                    {serversByScope.claudeProject.length > 0 && (
                      <>
                        <Box paddingLeft={1}>
                          <Text color={theme.text.primary}>Claude Code:</Text>
                        </Box>
                        {serversByScope.claudeProject.map((server) => (
                          <Box key={`claude-project-${server.name}`} flexDirection="column" paddingLeft={3}>
                            <Box>
                              <Text color={theme.text.primary} bold>• {server.name}</Text>
                            </Box>
                            <Box paddingLeft={2}>
                              <Text color={theme.text.secondary}>
                                {server.transport} • {server.transport === 'stdio' ? `Command: ${server.command}` : `URL: ${server.url}`}
                              </Text>
                            </Box>
                            {(server.timeout !== 30000 || (server.args && server.args.length > 0)) && (
                              <Box paddingLeft={2}>
                                <Text color={theme.text.muted}>
                                  Timeout: {server.timeout}ms
                                  {server.args && server.args.length > 0 && ` • Args: ${server.args.join(' ')}`}
                                </Text>
                              </Box>
                            )}
                            <Box height={1} />
                          </Box>
                        ))}
                      </>
                    )}
                    
                    {/* Gemini CLI Project Servers */}
                    {serversByScope.geminiProject.length > 0 && (
                      <>
                        <Box paddingLeft={1}>
                          <Text color={theme.text.primary}>Gemini CLI:</Text>
                        </Box>
                        {serversByScope.geminiProject.map((server) => (
                          <Box key={`gemini-project-${server.name}`} flexDirection="column" paddingLeft={3}>
                            <Box>
                              <Text color={theme.text.primary} bold>• {server.name}</Text>
                            </Box>
                            <Box paddingLeft={2}>
                              <Text color={theme.text.secondary}>
                                {server.transport} • Command: {server.command}
                              </Text>
                            </Box>
                            {(server.timeout !== 30000 || (server.args && server.args.length > 0)) && (
                              <Box paddingLeft={2}>
                                <Text color={theme.text.muted}>
                                  Timeout: {server.timeout}ms
                                  {server.args && server.args.length > 0 && ` • Args: ${server.args.join(' ')}`}
                                </Text>
                              </Box>
                            )}
                            <Box height={1} />
                          </Box>
                        ))}
                      </>
                    )}
                  </>
                )}

                {/* User Scope */}
                {(serversByScope.claudeUser.length > 0 || serversByScope.geminiUser.length > 0) && (
                  <>
                    <Box>
                      <Text color={theme.interaction.primary} bold>User Scope</Text>
                    </Box>
                    <Box height={1} />
                    
                    {/* Claude Code User Servers */}
                    {serversByScope.claudeUser.length > 0 && (
                      <>
                        <Box paddingLeft={1}>
                          <Text color={theme.text.primary}>Claude Code:</Text>
                        </Box>
                        {serversByScope.claudeUser.map((server) => (
                          <Box key={`claude-user-${server.name}`} flexDirection="column" paddingLeft={3}>
                            <Box>
                              <Text color={theme.text.primary} bold>• {server.name}</Text>
                            </Box>
                            <Box paddingLeft={2}>
                              <Text color={theme.text.secondary}>
                                {server.transport} • {server.transport === 'stdio' ? `Command: ${server.command}` : `URL: ${server.url}`}
                              </Text>
                            </Box>
                            {(server.timeout !== 30000 || (server.args && server.args.length > 0)) && (
                              <Box paddingLeft={2}>
                                <Text color={theme.text.muted}>
                                  Timeout: {server.timeout}ms
                                  {server.args && server.args.length > 0 && ` • Args: ${server.args.join(' ')}`}
                                </Text>
                              </Box>
                            )}
                            <Box height={1} />
                          </Box>
                        ))}
                      </>
                    )}
                    
                    {/* Gemini CLI User Servers */}
                    {serversByScope.geminiUser.length > 0 && (
                      <>
                        <Box paddingLeft={1}>
                          <Text color={theme.text.primary}>Gemini CLI:</Text>
                        </Box>
                        {serversByScope.geminiUser.map((server) => (
                          <Box key={`gemini-user-${server.name}`} flexDirection="column" paddingLeft={3}>
                            <Box>
                              <Text color={theme.text.primary} bold>• {server.name}</Text>
                            </Box>
                            <Box paddingLeft={2}>
                              <Text color={theme.text.secondary}>
                                {server.transport} • Command: {server.command}
                              </Text>
                            </Box>
                            {(server.timeout !== 30000 || (server.args && server.args.length > 0)) && (
                              <Box paddingLeft={2}>
                                <Text color={theme.text.muted}>
                                  Timeout: {server.timeout}ms
                                  {server.args && server.args.length > 0 && ` • Args: ${server.args.join(' ')}`}
                                </Text>
                              </Box>
                            )}
                            <Box height={1} />
                          </Box>
                        ))}
                      </>
                    )}
                  </>
                )}
              </Box>
            )}
            <Box>
              <Text color={theme.text.muted}>Press ESC to return to main menu</Text>
            </Box>
          </>
        )}

        {/* Remove Confirmation */}
        {currentView === 'removeConfirm' && (
          <>
            <Box flexDirection="column">
              <Text color={theme.status.warning} bold>Warning: Server Removal</Text>
              <Box height={1} />
              <Text color={theme.text.primary}>
                Are you sure you want to remove "{serverToRemove}"?
              </Text>
              <Box height={1} />
              {(() => {
                const server = servers.find(s => s.name === serverToRemove);
                if (server) {
                  return (
                    <Box flexDirection="column">
                      <Text color={theme.text.secondary}>This will remove the server from:</Text>
                      {server.claudeCode && (
                        <Text color={theme.text.secondary}>• Claude Code ({server.claudeScope} scope)</Text>
                      )}
                      {server.geminiCLI && (
                        <Text color={theme.text.secondary}>• Gemini CLI ({server.geminiScope} scope)</Text>
                      )}
                      <Box height={1} />
                      <Text color={theme.status.warning}>This action cannot be undone.</Text>
                    </Box>
                  );
                }
                return null;
              })()}
            </Box>
            <Box height={1} />
          </>
        )}

        {/* Options Menu */}
        {currentView !== 'list' && (
          <>
            {options.map((option, index) => (
              <Box key={option.key} flexDirection="column">
                <Box>
                  <Text color={theme.text.primary}>
                    {index === selectedOption ? '> ' : '  '}
                  </Text>
                  <Text 
                    color={index === selectedOption ? theme.interaction.primary : theme.text.primary}
                    bold={index === selectedOption}
                    dimColor={isLoading}
                  >
                    {option.label}
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
            {isLoading 
              ? 'Please wait...'
              : '↑/↓ Navigate • Enter Select • ESC Close'
            }
          </Text>
        </Box>
      </Box>
    </Box>
  );
};