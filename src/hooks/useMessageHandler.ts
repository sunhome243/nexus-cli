/**
 * useMessageHandler Hook
 * Extracts the complex sendMessage logic from App.tsx
 * Handles both regular messages and slash commands
 */

import { useCallback } from "react";
import { ISlashCommandParserService } from "../interfaces/commands/ISlashCommandParserService.js";
import { AIProvider, RenderItem, ToolExecution, Message, PendingPermission, PendingPermissionRequest, ModelInfo } from "../components/core/types.js";
import { useServices } from "../components/providers/ServiceProvider.js";
import { ProviderType } from "../abstractions/providers/index.js";
import { ISessionManager, IPermissionRequestData, IToolUseData } from "../interfaces/core/ISessionManager.js";
import { ISlashCommandService } from "../interfaces/commands/ISlashCommandService.js";
import { IAppEventBusService } from "../interfaces/events/IAppEventBusService.js";
import { IUnifiedStatsService } from "../interfaces/usage/IUnifiedStatsService.js";
import { TextBuffer } from "./useTextBuffer.js";
import { ToolConfirmationOutcome } from '@google/gemini-cli-core';

// Type definitions for streaming callback data
interface ResultMessageData {
  content?: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

interface PermissionRequestData {
  tool?: string;
  toolName?: string;
  toolUseId?: string;
  args?: Record<string, unknown>;
  description?: string;
  tier?: string;
  timestamp?: Date;
}

interface PermissionResponseData {
  approved: boolean;
  reason?: string;
  autoApprove?: boolean;
  message?: string;
}

interface ToolAutoApprovedData {
  toolUseId: string;
  toolName?: string;
  timestamp?: Date;
}

interface ToolFailureData {
  toolUseId: string;
  toolName?: string;
  error: string;
  timestamp?: Date;
}

interface ToolExecutionStartData {
  toolName: string;
  toolUseId: string;
  args?: Record<string, unknown>;
  timestamp?: Date;
  provider?: ProviderType;
  permissionTier?: string;
}

interface ToolExecutionCompleteData {
  toolUseId: string;
  toolName: string;
  result?: unknown;
  isError?: boolean;
  timestamp?: Date;
}

interface StreamCompleteResponseData {
  usage?: {
    total_tokens?: number;
  };
  token_count?: number;
  metadata?: Record<string, unknown>;
}

// Module-level storage for pending permissions
interface PendingPermissionResolver {
  resolve: (response: ToolConfirmationOutcome) => void;
}
const pendingPermissions = new Map<string, PendingPermissionResolver>();

interface MessageHandlerState {
  initialized?: boolean;
  currentProvider: AIProvider;
  items: RenderItem[];
}

interface MessageHandlerActions {
  addItem: (item: RenderItem) => void;
  updateItems: (updater: (items: RenderItem[]) => RenderItem[]) => void;
  setLoading: (loading: boolean) => void;
  setStreamingState: (streaming: boolean, text?: string) => void;
  setCurrentThought: (thought: { subject: string; description: string } | undefined) => void;
  setPendingPermission: (permission: PendingPermission | null) => void;
  setModelInfo?: (modelInfo: ModelInfo | null | undefined) => void;
}

interface UseMessageHandlerProps {
  state: MessageHandlerState;
  actions: MessageHandlerActions;
  sessionManager: ISessionManager;
  slashCommandService: ISlashCommandService;
  slashCommandParserService: ISlashCommandParserService;
  buffer: TextBuffer;
  setCommandExecutionStatus: (status: string | null) => void;
  setShowDashboard: (show: boolean) => void;
  statsServiceRef: React.MutableRefObject<IUnifiedStatsService | null>;
  appEventBusService: IAppEventBusService;
}

export function useMessageHandler({
  state,
  actions,
  sessionManager,
  slashCommandService,
  slashCommandParserService,
  buffer,
  setCommandExecutionStatus,
  setShowDashboard,
  statsServiceRef,
  appEventBusService
}: UseMessageHandlerProps) {
  const { logger } = useServices();

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || !state.initialized) return;

      // Check if this is a slash command
      const parseResult = slashCommandParserService.parseInput(message);
      if (parseResult.isSlashCommand && parseResult.commandName && slashCommandService) {
        // Check if this is a built-in command first
        const isBuiltInCommand = parseResult.commandName === 'claude' || parseResult.commandName === 'dashboard';
        
        if (isBuiltInCommand) {
          // Start animation immediately for built-in commands
          actions.addItem({
            type: "message",
            timestamp: new Date(),
            data: {
              role: "user",
              content: message,
              provider: state.currentProvider,
              timestamp: new Date(),
            },
          });

          actions.addItem({
            type: "tool",
            timestamp: new Date(),
            data: {
              toolName: parseResult.commandName || 'command',
              args: {},
              result: '',
              isExecuting: true,
              timestamp: new Date(),
              provider: state.currentProvider,
              permissionTier: "safe",
            } as ToolExecution,
          });

          // Execute built-in command and show results when done
          try {
            setCommandExecutionStatus(`/${parseResult.commandName} is running...`);
            const result = await slashCommandService.executeCommand(parseResult.commandName, parseResult.arguments);
            
            if (result.success) {
              setCommandExecutionStatus(null);
              
              // Handle dashboard command specially
              if (parseResult.commandName === 'dashboard' && result.metadata?.action === 'show_dashboard') {
                setShowDashboard(true);
              }
              
              actions.updateItems(items => items.map((item, index) => {
                // Update the tool execution to completed
                if (index === items.length - 1 && item.type === "tool") {
                  return {
                    ...item,
                    data: {
                      ...item.data,
                      isExecuting: false,
                      result: `${parseResult.commandName} command executed successfully`,
                    },
                  };
                }
                return item;
              }));

              actions.addItem({
                type: "message", 
                timestamp: new Date(),
                data: {
                  role: "assistant",
                  content: result.processedContent,
                  provider: state.currentProvider,
                  timestamp: new Date(),
                },
              });
            } else {
              // Handle error for built-in commands
              setCommandExecutionStatus(null);
              actions.updateItems(items => items.map((item, index) => {
                if (index === items.length - 1 && item.type === "tool") {
                  return {
                    ...item,
                    data: {
                      ...item.data,
                      isExecuting: false,
                      isError: true,
                      errorMessage: result.error || 'Command failed',
                    },
                  };
                }
                return item;
              }));
            }
          } catch (error) {
            setCommandExecutionStatus(null);
            actions.updateItems(items => items.map((item, index) => {
              if (index === items.length - 1 && item.type === "tool") {
                return {
                  ...item,
                  data: {
                    ...item.data,
                    isExecuting: false,
                    isError: true,
                    errorMessage: `Failed to execute command: ${error}`,
                  },
                };
              }
              return item;
            }));
          }
          return;
        }
        
        // Handle non-built-in commands with similar UI as built-in commands
        // Add user message
        actions.addItem({
          type: "message",
          timestamp: new Date(),
          data: {
            role: "user",
            content: message,
            provider: state.currentProvider,
            timestamp: new Date(),
          },
        });

        // Add tool execution animation
        actions.addItem({
          type: "tool",
          timestamp: new Date(),
          data: {
            toolName: parseResult.commandName || 'command',
            args: parseResult.arguments ? { arguments: parseResult.arguments } : {},
            result: '',
            isExecuting: true,
            timestamp: new Date(),
            provider: state.currentProvider,
            permissionTier: "safe",
          } as ToolExecution,
        });
        
        setCommandExecutionStatus(`/${parseResult.commandName} is running...`);
        
        try {
          const result = await slashCommandService.executeCommand(parseResult.commandName, parseResult.arguments);
          
          if (result.success) {
            setCommandExecutionStatus(null);
            
            // Update tool execution to completed
            actions.updateItems(items => items.map((item, index) => {
              if (index === items.length - 1 && item.type === "tool") {
                return {
                  ...item,
                  data: {
                    ...item.data,
                    isExecuting: false,
                    result: `${parseResult.commandName} command executed successfully`,
                  },
                };
              }
              return item;
            }));
            
            // Instead of adding a fake assistant message, send the processed content to the AI
            await sendMessage(result.processedContent);
            return;
          } else {
            // Update tool execution with error
            setCommandExecutionStatus(null);
            actions.updateItems(items => items.map((item, index) => {
              if (index === items.length - 1 && item.type === "tool") {
                return {
                  ...item,
                  data: {
                    ...item.data,
                    isExecuting: false,
                    isError: true,
                    errorMessage: result.error || 'Command failed',
                  },
                };
              }
              return item;
            }));
          }
        } catch (error) {
          setCommandExecutionStatus(null);
          actions.updateItems(items => items.map((item, index) => {
            if (index === items.length - 1 && item.type === "tool") {
              return {
                ...item,
                data: {
                  ...item.data,
                  isExecuting: false,
                  isError: true,
                  errorMessage: `Failed to execute command: ${error}`,
                },
              };
            }
            return item;
          }));
        }
        return;
      }

      if (!sessionManager) {
        actions.addItem({
          type: "message",
          timestamp: new Date(),
          data: {
            role: "assistant",
            content: "Error: Session manager not available. Please restart the application.",
            provider: state.currentProvider,
            timestamp: new Date(),
          },
        });
        return;
      }

      // Add user message to history
      actions.updateItems(currentItems => {
        logger.debug('Adding user message to main state', {
          component: 'useMessageHandler',
          content: message.substring(0, 50),
          provider: state.currentProvider,
          currentItemsCount: currentItems.length
        });
        return currentItems; // No actual update, just access current state for logging
      });
      
      actions.addItem({
        type: "message",
        timestamp: new Date(),
        data: {
          role: "user",
          content: message,
          provider: state.currentProvider,
          timestamp: new Date(),
        },
      });
      
      // Log the addition using the updater pattern
      actions.updateItems(currentItems => {
        logger.debug('User message added', {
          component: 'useMessageHandler',
          newItemsCount: currentItems.length
        });
        return currentItems;
      });

      actions.setPendingPermission(null);
      actions.setLoading(true);

      try {
        // Check if current provider supports streaming
        if (sessionManager && sessionManager.supportsStreaming()) {
          // Use streaming for Claude
          actions.setStreamingState(true);

          await sessionManager.streamMessage(message, {
            onToken: (text: string) => {
              // For Gemini: accumulate tokens in streaming state instead of adding individual messages
              // This prevents message chunking issue
              if (text && text.trim()) {
                if (state.currentProvider === 'gemini') {
                  // Just update streaming text for display, don't add to items yet
                  actions.setStreamingState(true, text.trim());
                } else {
                  // Claude: Add messages immediately to items array (existing behavior)
                  actions.updateItems(items => 
                    // Stop all tool animations when new text arrives
                    items.map((item) =>
                      item.type === "tool" && (item.data as ToolExecution).isExecuting
                        ? {
                            ...item,
                            data: {
                              ...item.data,
                              isExecuting: false,
                            },
                          }
                        : item
                    ).concat([{
                      type: "message",
                      timestamp: new Date(),
                      data: {
                        role: "assistant" as const,
                        content: text.trim(),
                        provider: state.currentProvider,
                        timestamp: new Date(),
                      },
                    }])
                  );
                }
              }
            },

            onThinkingChunk: (thinking: string) => {
              logger.debug('🧠 onThinkingChunk received:', {
                thinking,
                thinkingType: typeof thinking,
                thinkingLength: thinking?.length,
                provider: state.currentProvider
              });
              
              let thinkingData: { subject?: string; content?: string; description?: string } = {};
              
              try {
                const parsed = JSON.parse(thinking);
                logger.debug('🧠 Parsed thinking data:', parsed);
                
                thinkingData = {
                  subject: parsed.subject || 'Thinking',
                  content: parsed.content || parsed.description || thinking,
                  description: parsed.content || parsed.description || thinking
                };
              } catch (e) {
                logger.debug('🧠 Failed to parse thinking as JSON, treating as plain text:', { error: e });
                // If not JSON, treat as plain text
                thinkingData = {
                  subject: 'Thinking',
                  content: thinking,
                  description: thinking
                };
              }
              
              logger.debug('🧠 Final thinking data:', thinkingData);
              
              // Update current thought for real-time display
              actions.setCurrentThought({
                subject: thinkingData.subject || 'Thinking',
                description: thinkingData.description || ''
              });
              
              // REMOVED: Do NOT add thinking to conversation history
              // Thinking should only be displayed transiently during streaming
              // and disappear when streaming completes
            },

            onComplete: (fullText: string) => {
              actions.setLoading(false);
              actions.setStreamingState(false);
              actions.setCurrentThought(undefined);
              
              // For Gemini: Add the complete accumulated message now
              if (state.currentProvider === 'gemini' && fullText && fullText.trim()) {
                actions.addItem({
                  type: "message",
                  timestamp: new Date(),
                  data: {
                    role: "assistant" as const,
                    content: fullText.trim(),
                    provider: state.currentProvider,
                    timestamp: new Date(),
                  },
                });
              }
              
              // Mark all tools as complete
              actions.updateItems(currentItems => {
                return currentItems.map((item) => {
                  if (item.type === "tool") {
                    return {
                      ...item,
                      data: {
                        ...item.data,
                        isExecuting: false,
                      },
                    };
                  }
                  return item;
                });
              });
            },

            onError: (error: Error) => {
              actions.setLoading(false);
              actions.setStreamingState(false);
              actions.setCurrentThought(undefined);
              actions.addItem({
                type: "message",
                timestamp: new Date(),
                data: {
                  role: "assistant",
                  content: `Streaming Error: ${error.message}`,
                  provider: state.currentProvider,
                  timestamp: new Date(),
                },
              });
            },

            onToolUse: (tool: IToolUseData) => {
              logger.debug('Tool use requested', {
                component: 'useMessageHandler',
                toolName: tool.toolName,
                toolUseId: tool.executionId
              });

              actions.updateItems(items => {
                const newTool: ToolExecution = {
                  toolName: tool.toolName,
                  args: tool.arguments || {},
                  isExecuting: true,
                  timestamp: new Date(),
                  toolUseId: tool.executionId || `${tool.toolName}-${Date.now()}`,
                  provider: state.currentProvider,
                  permissionTier: "cautious",
                };

                return [
                  ...items,
                  {
                    type: "tool",
                    timestamp: newTool.timestamp,
                    data: newTool,
                  },
                ];
              });
            },

            onToolExecutionComplete: (executionId: string, result?: any) => {
              logger.debug('Tool execution completed', {
                component: 'useMessageHandler',
                executionId: executionId,
                hasResult: !!result
              });

              actions.updateItems(items => {
                return items.map(item => {
                  if (item.type === "tool") {
                    const toolData = item.data as ToolExecution;
                    if (toolData.toolUseId === executionId) {
                      return {
                        ...item,
                        data: {
                          ...toolData,
                          isExecuting: false,
                          result: result || toolData.result,
                        },
                      };
                    }
                  }
                  return item;
                });
              });
            },

            onToolFailure: (executionId: string, error: string) => {
              logger.debug('Tool execution failed', {
                component: 'useMessageHandler',
                executionId: executionId,
                error: error
              });

              actions.updateItems(items => {
                return items.map(item => {
                  if (item.type === "tool") {
                    const toolData = item.data as ToolExecution;
                    if (toolData.toolUseId === executionId) {
                      return {
                        ...item,
                        data: {
                          ...toolData,
                          isExecuting: false,
                          isError: true,
                          errorMessage: error,
                        },
                      };
                    }
                  }
                  return item;
                });
              });
            },

            onPermissionRequest: async (request: IPermissionRequestData | { toolName: string; args: Record<string, unknown>; description?: string; tier?: string; toolUseId?: string }) => {
              return new Promise<ToolConfirmationOutcome>((resolve) => {
                const toolUseId = request.toolUseId || `permission-${Date.now()}`;
                logger.info('🔍 UI received permission request', {
                  component: 'useMessageHandler',
                  tool: request.toolName,
                  toolUseId,
                  requestDetails: request
                });
                
                // Handle both IPermissionRequestData and GeminiPermissionRequest formats
                const args = ('arguments' in request) ? request.arguments : ('args' in request) ? request.args : {};
                
                // Debug: Log the permission request arguments structure
                logger.info('🔍 Permission request arguments:', {
                  arguments: args,
                  argumentsType: typeof args,
                  argumentsKeys: args ? Object.keys(args) : 'none'
                });
                
                actions.setPendingPermission({
                  toolName: request.toolName || '',
                  args: args,
                  description: request.description,
                  timestamp: new Date(),
                  request: {
                    tool: request.toolName || '',
                    description: request.description,
                    arguments: args,
                    tier: ('tier' in request) ? (
                            request.tier === 'safe' ? 'safe' : 
                            request.tier === 'dangerous' ? 'dangerous' : 'cautious'
                          ) : 'cautious',
                    toolUseId: toolUseId
                  },
                  resolve: (response: { approved: boolean; reason?: string; autoApprove?: boolean; outcome?: string | ToolConfirmationOutcome }) => {
                    actions.setPendingPermission(null);
                    pendingPermissions.delete(toolUseId);
                    
                    // If response includes an outcome, use it; otherwise map from approved boolean
                    let outcome: ToolConfirmationOutcome;
                    if (response.outcome !== undefined) {
                      // Map string outcomes to ToolConfirmationOutcome enum values
                      if (typeof response.outcome === 'string') {
                        switch (response.outcome) {
                          case 'cancel':
                            outcome = ToolConfirmationOutcome.Cancel;
                            break;
                          case 'proceed_once':
                            outcome = ToolConfirmationOutcome.ProceedOnce;
                            break;
                          case 'proceed_always':
                            outcome = (ToolConfirmationOutcome as any).ProceedAlways || ToolConfirmationOutcome.ProceedOnce;
                            break;
                          default:
                            // Fall back to approved boolean if outcome string is unrecognized
                            outcome = response.approved ? ToolConfirmationOutcome.ProceedOnce : ToolConfirmationOutcome.Cancel;
                        }
                      } else {
                        // outcome is already a ToolConfirmationOutcome enum value
                        outcome = response.outcome as ToolConfirmationOutcome;
                      }
                    } else {
                      // No outcome provided, map from approved boolean
                      outcome = response.approved ? ToolConfirmationOutcome.ProceedOnce : ToolConfirmationOutcome.Cancel;
                    }
                    
                    logger.info('🔍 Mapping UI response to ToolConfirmationOutcome', {
                      approved: response.approved,
                      responseOutcome: response.outcome,
                      mappedOutcome: outcome,
                      outcomeString: String(outcome),
                      cancelValue: ToolConfirmationOutcome.Cancel,
                      proceedValue: ToolConfirmationOutcome.ProceedOnce
                    });
                    resolve(outcome);
                  },
                });
                
                pendingPermissions.set(toolUseId, { 
                  resolve: (outcome: ToolConfirmationOutcome) => {
                    resolve(outcome);
                  }
                });
              });
            },

            onToolAutoApproved: (data: { toolName: string; args: Record<string, unknown> }) => {
              logger.debug('Tool auto-approved - stopping animations', {
                component: 'useMessageHandler',
                toolName: data.toolName
              });

              // Stop all executing tool animations when tools are auto-approved
              actions.updateItems(items => 
                items.map(item => 
                  item.type === "tool" && (item.data as ToolExecution).isExecuting
                    ? {
                        ...item,
                        data: {
                          ...item.data,
                          isExecuting: false,
                        },
                      }
                    : item
                )
              );
            }
          });
        } else if (sessionManager) {
          // Fallback to regular message sending for providers that don't support streaming
          const response = await sessionManager.sendMessage(message);

          actions.addItem({
            type: "message",
            timestamp: new Date(),
            data: {
              role: "assistant",
              content: response || "No response content",
              provider: state.currentProvider,
              timestamp: new Date(),
            },
          });
          actions.setLoading(false);
        } else {
          // SessionManager is not available
          actions.addItem({
            type: "message",
            timestamp: new Date(),
            data: {
              role: "assistant",
              content: "Error: Session manager not available. Please try restarting the application.",
              provider: state.currentProvider,
              timestamp: new Date(),
            },
          });
          actions.setLoading(false);
        }
      } catch (error) {
        actions.addItem({
          type: "message",
          timestamp: new Date(),
          data: {
            role: "assistant",
            content: `Error: ${(error as Error).message}`,
            provider: state.currentProvider,
            timestamp: new Date(),
          },
        });
        actions.setLoading(false);
        actions.setStreamingState(false);
      }

      buffer.setText("");
    },
    [state.currentProvider, state.initialized, state.items, actions, sessionManager, slashCommandService, buffer, setCommandExecutionStatus, setShowDashboard, statsServiceRef, appEventBusService, logger]
  );

  return { sendMessage };
}