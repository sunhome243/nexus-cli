/**
 * useGeminiStream - React hook for Gemini streaming state management
 * Based on gemini-cli useGeminiStream hook for proper React integration
 */

import { useState, useCallback, useRef } from 'react';
import { SessionManager } from '../services/session/SessionManager.js';
import { useServices } from '../components/providers/ServiceProvider.js';
import { ProviderType } from '../abstractions/providers/types.js';
import { IProviderResponse, IPermissionRequest, IPermissionResponse, IToolExecutionData } from '../interfaces/core/IProvider.js';
import { IPermissionRequestData, IToolUseData } from '../interfaces/core/ISessionManager.js';
import { 
  ServerGeminiStreamEvent,
  GeminiEventType,
  ServerGeminiContentEvent,
  ServerGeminiThoughtEvent,
  ServerGeminiToolCallRequestEvent,
  ServerGeminiToolCallResponseEvent,
  ServerGeminiErrorEvent,
  ToolConfirmationOutcome
} from '@google/gemini-cli-core';

// Type definitions for better type safety
interface GeminiToolArgs {
  [key: string]: unknown;
}

interface GeminiToolResult {
  content?: string;
  data?: unknown;
  error?: string;
  success?: boolean;
}

interface GeminiStreamResponse {
  success: boolean;
  message?: string;
  error?: string;
  toolResults?: GeminiToolResult[];
}

interface GeminiPermissionRequest {
  name: string;
  args: GeminiToolArgs;
  permissionTier?: string;
  description?: string;
  timestamp?: Date;
}

// Streaming states based on gemini-cli patterns
export enum StreamingState {
  Idle = 'idle',
  Responding = 'responding', 
  WaitingForConfirmation = 'waiting_for_confirmation',
}

// Message types for conversation history
export enum MessageType {
  USER = 'user',
  GEMINI = 'gemini',
  TOOL_GROUP = 'tool_group',
  INFO = 'info',
  ERROR = 'error',
  THINKING = 'thinking',
  PERMISSION_DENIED = 'permission_denied'
}

// History item structure
export interface HistoryItem {
  id: string;
  type: MessageType;
  text?: string;
  thinking?: {
    subject: string;
    description: string;
    timestamp: Date;
  };
  toolExecutions?: ToolExecution[];
  provider: string;
  timestamp: Date;
  isUser?: boolean;
  isError?: boolean;
}

// Tool execution state
export interface ToolExecution {
  id: string;
  toolName: string;
  args: GeminiToolArgs;
  isExecuting: boolean;
  result?: GeminiToolResult;
  timestamp: Date;
  toolUseId: string;
  provider: ProviderType;
  isError?: boolean;
  errorMessage?: string;
}

// Hook state interface
export interface GeminiStreamState {
  history: HistoryItem[];
  streamingState: StreamingState;
  currentMessage: string;
  isLoading: boolean;
  error: string | null;
  thinking: {
    subject: string;
    description: string;
    timestamp: Date;
  } | null;
  pendingToolExecutions: ToolExecution[];
}

// Core streaming event callbacks
export interface CoreStreamingCallbacks {
  onContentEvent?: (event: ServerGeminiContentEvent) => void;
  onThoughtEvent?: (event: ServerGeminiThoughtEvent) => void;
  onToolCallRequestEvent?: (event: ServerGeminiToolCallRequestEvent) => void;
  onToolCallResponseEvent?: (event: ServerGeminiToolCallResponseEvent) => void;
  onErrorEvent?: (event: ServerGeminiErrorEvent) => void;
  onComplete?: (result: GeminiStreamResponse) => void;
  onPermissionRequest?: (request: GeminiPermissionRequest) => Promise<ToolConfirmationOutcome>;
  abortController?: AbortController;
}

// Hook return interface
export interface UseGeminiStreamReturn {
  // State
  state: GeminiStreamState;
  
  // Actions
  sendMessage: (message: string) => Promise<void>;
  cancelStream: () => void;
  clearHistory: () => void;
  
  // Tool actions
  approveToolExecution: (toolId: string) => void;
  cancelToolExecution: (toolId: string) => void;
  
  // Permission callback - to be set by App.tsx
  setPermissionCallback: (callback: (request: GeminiPermissionRequest) => Promise<ToolConfirmationOutcome>) => void;
}

export function useGeminiStream(sessionManager: SessionManager): UseGeminiStreamReturn {
  // Get logger from service provider
  const { logger } = useServices();
  
  // State management
  const [state, setState] = useState<GeminiStreamState>({
    history: [],
    streamingState: StreamingState.Idle,
    currentMessage: '',
    isLoading: false,
    error: null,
    thinking: null,
    pendingToolExecutions: []
  });

  // Refs for stable references
  const sessionManagerRef = useRef<SessionManager | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const historyIdCounter = useRef(0);
  const permissionCallbackRef = useRef<((request: GeminiPermissionRequest) => Promise<ToolConfirmationOutcome>) | null>(null);

  // Get session manager instance
  const getSessionManager = useCallback(() => {
    if (!sessionManagerRef.current) {
      sessionManagerRef.current = sessionManager;
    }
    return sessionManagerRef.current;
  }, [sessionManager]);

  // Generate unique ID for history items
  const generateId = useCallback(() => {
    return `msg_${Date.now()}_${++historyIdCounter.current}`;
  }, []);

  // Add message to history
  const addToHistory = useCallback((item: Omit<HistoryItem, 'id'>) => {
    const newItem = {
      ...item,
      id: generateId()
    };
    
    logger.debug('Adding item to history', {
      component: 'useGeminiStream',
      id: newItem.id,
      type: newItem.type,
      isUser: newItem.isUser,
      textPreview: newItem.text?.substring(0, 30),
      hasThinking: !!newItem.thinking
    });
    
    setState(prev => {
      const newHistory = [
        ...prev.history,
        newItem
      ];
      
      logger.debug('History updated', {
        component: 'useGeminiStream',
        newLength: newHistory.length
      });
      
      return {
        ...prev,
        history: newHistory
      };
    });
  }, [generateId]);

  // Update streaming state
  const updateStreamingState = useCallback((newState: StreamingState) => {
    setState(prev => ({
      ...prev,
      streamingState: newState
    }));
  }, []);

  // Handle core streaming events
  const handleContentEvent = useCallback((event: ServerGeminiContentEvent) => {
    logger.debug('Content event received', {
      component: 'useGeminiStream',
      value: event.value
    });
    setState(prev => {
      const newMessage = prev.currentMessage + event.value;
      logger.debug('Current message updated', {
        component: 'useGeminiStream',
        messageLength: newMessage.length
      });
      return {
        ...prev,
        currentMessage: newMessage
      };
    });
  }, []);

  // Handle thinking event
  const handleThoughtEvent = useCallback((event: ServerGeminiThoughtEvent) => {
    logger.debug('Thought event received', {
      component: 'useGeminiStream',
      subject: event.value.subject,
      description: event.value.description
    });
    
    // Store thinking in state - will be displayed by existing LoadingIndicator
    setState(prev => ({
      ...prev,
      thinking: {
        subject: event.value.subject || 'Thinking...',
        description: event.value.description || '',
        timestamp: new Date()
      }
    }));
  }, []);

  // Handle tool call request event
  const handleToolCallRequestEvent = useCallback((event: ServerGeminiToolCallRequestEvent) => {
    logger.debug('Tool call request event received', {
      component: 'useGeminiStream',
      callId: event.value.callId,
      toolName: event.value.name,
      args: event.value.args
    });
    
    const execution: ToolExecution = {
      id: event.value.callId,
      toolName: event.value.name,
      args: event.value.args,
      isExecuting: true,
      timestamp: new Date(),
      toolUseId: event.value.callId,
      provider: ProviderType.GEMINI
    };
    
    setState(prev => ({
      ...prev,
      pendingToolExecutions: [
        ...prev.pendingToolExecutions,
        execution
      ]
    }));
  }, []);

  // Handle tool call response event
  const handleToolCallResponseEvent = useCallback((event: ServerGeminiToolCallResponseEvent) => {
    logger.debug('Tool call response event received', {
      component: 'useGeminiStream',
      callId: event.value.callId,
      hasError: !!event.value.error,
      errorMessage: event.value.error?.message
    });
    
    setState(prev => ({
      ...prev,
      pendingToolExecutions: prev.pendingToolExecutions.map(tool =>
        tool.id === event.value.callId ? {
          ...tool,
          isExecuting: false,
          result: event.value.resultDisplay ? { 
            content: typeof event.value.resultDisplay === 'string' 
              ? event.value.resultDisplay 
              : `${event.value.resultDisplay.fileName}\n${event.value.resultDisplay.fileDiff}`,
            success: !event.value.error
          } : undefined,
          errorMessage: event.value.error?.message,
          isError: !!event.value.error
        } : tool
      )
    }));
  }, []);

  // Handle stream completion
  const handleStreamComplete = useCallback(async (response: IProviderResponse) => {
    // Use current state snapshot to avoid stale closure issues
    setState(prev => {
      logger.debug('Stream completion handling started', {
        component: 'useGeminiStream',
        currentMessageLength: prev.currentMessage.length,
        hasThinking: !!prev.thinking,
        pendingToolExecutions: prev.pendingToolExecutions.length
      });
      
      const finalMessage = prev.currentMessage;
      
      // Add final message to history if there's content
      if (finalMessage.trim()) {
        logger.debug('Adding final Gemini message to history', {
          component: 'useGeminiStream',
          messagePreview: finalMessage.substring(0, 50)
        });
        // Use a timeout to avoid batching with state reset
        setTimeout(() => {
          addToHistory({
            type: MessageType.GEMINI,
            text: finalMessage,
            provider: ProviderType.GEMINI,
            timestamp: new Date(),
            isUser: false
          });
        }, 0);
      } else {
        logger.debug('No final message to add (empty or whitespace)', {
          component: 'useGeminiStream'
        });
      }


      // Add completed tool executions to history if present
      const completedTools = prev.pendingToolExecutions.filter(tool => !tool.isExecuting);
      if (completedTools.length > 0) {
        logger.debug('Adding completed tools to history', {
          component: 'useGeminiStream',
          toolCount: completedTools.length
        });
        setTimeout(() => {
          addToHistory({
            type: MessageType.TOOL_GROUP,
            toolExecutions: completedTools,
            provider: ProviderType.GEMINI,
            timestamp: new Date(),
            isUser: false
          });
        }, 10);
      } else {
        logger.debug('No completed tools to add to history', {
          component: 'useGeminiStream'
        });
      }

      logger.debug('Stream completion handling finished', {
        component: 'useGeminiStream'
      });
      
      // Reset streaming state
      return {
        ...prev,
        streamingState: StreamingState.Idle,
        currentMessage: '',
        isLoading: false,
        thinking: null,
        pendingToolExecutions: []
      };
    });
  }, [addToHistory]);

  // Handle error event
  const handleErrorEvent = useCallback((event: ServerGeminiErrorEvent) => {
    logger.error('Error event received', {
      component: 'useGeminiStream',
      errorMessage: event.value.error.message
    });
    
    const errorMessage = event.value.error.message;
    
    addToHistory({
      type: MessageType.ERROR,
      text: `Error: ${errorMessage}`,
      provider: ProviderType.GEMINI,
      timestamp: new Date(),
      isUser: false,
      isError: true
    });

    setState(prev => ({
      ...prev,
      streamingState: StreamingState.Idle,
      currentMessage: '',
      isLoading: false,
      error: errorMessage,
      thinking: null,
      pendingToolExecutions: []
    }));
  }, [addToHistory]);

  // Send message function
  const sendMessage = useCallback(async (message: string) => {
    if (state.streamingState !== StreamingState.Idle) {
      logger.warn('Cannot send message while stream is active', {
        component: 'useGeminiStream',
        currentState: state.streamingState
      });
      return;
    }

    logger.debug('Send message called', {
      component: 'useGeminiStream',
      messagePreview: message.substring(0, 50)
    });

    try {
      // Add user message to history immediately
      logger.debug('Adding user message to history immediately', {
        component: 'useGeminiStream'
      });
      addToHistory({
        type: MessageType.USER,
        text: message,
        provider: ProviderType.GEMINI,
        timestamp: new Date(),
        isUser: true
      });

      // Update state to responding
      logger.debug('Updating state to responding', {
        component: 'useGeminiStream'
      });
      setState(prev => ({
        ...prev,
        streamingState: StreamingState.Responding,
        currentMessage: '',
        isLoading: false, // No loading bar as per requirements
        error: null,
        thinking: null,
        pendingToolExecutions: []
      }));

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      // Get session manager and stream message
      logger.debug('Starting stream with session manager', {
        component: 'useGeminiStream'
      });
      const sessionManager = getSessionManager();
      
      await sessionManager.streamMessage(message, {
        onToken: (text: string) => {
          handleContentEvent({ type: GeminiEventType.Content, value: text });
        },
        onToolUse: (tool: IToolUseData) => {
          handleToolCallRequestEvent({
            type: GeminiEventType.ToolCallRequest,
            value: {
              callId: tool.executionId || '',
              name: tool.toolName,
              args: tool.arguments || {},
              isClientInitiated: false,
              prompt_id: ''
            }
          });
          
          // Also handle completion
          handleToolCallResponseEvent({
            type: GeminiEventType.ToolCallResponse,
            value: {
              callId: tool.executionId || '',
              responseParts: [],
              resultDisplay: undefined,
              error: undefined
            }
          });
        },
        onError: (error: Error) => {
          handleErrorEvent({
            type: GeminiEventType.Error,
            value: { error: { message: error.message } }
          });
        },
        onComplete: (fullText: string) => {
          // Convert string to IProviderResponse for handleStreamComplete
          const response: IProviderResponse = {
            text: fullText,
            provider: 'gemini',
            timestamp: new Date()
          };
          handleStreamComplete(response);
        },
        onPermissionRequest: permissionCallbackRef.current ? 
          async (request: IPermissionRequestData) => {
            logger.debug('Permission request received', {
              component: 'useGeminiStream',
              request
            });
            // Adapt IPermissionRequestData to GeminiPermissionRequest format
            const geminiRequest: GeminiPermissionRequest = {
              name: request.toolName,
              args: request.arguments
            };
            const result = await permissionCallbackRef.current!(geminiRequest);
            logger.debug('Permission request processed', {
              component: 'useGeminiStream',
              result
            });
            // Result is now ToolConfirmationOutcome, return it directly
            return result;
          } : undefined
      });

      logger.info('Stream completed successfully', {
        component: 'useGeminiStream'
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Stream error occurred', {
        component: 'useGeminiStream',
        errorMessage
      });
      handleErrorEvent({ 
        type: 'error' as GeminiEventType, 
        value: { error: { message: errorMessage } } 
      } as ServerGeminiErrorEvent);
    }
  }, [
    state.streamingState,
    addToHistory,
    getSessionManager,
    handleContentEvent,
    handleThoughtEvent,
    handleToolCallRequestEvent,
    handleToolCallResponseEvent,
    handleStreamComplete,
    handleErrorEvent
  ]);

  // Cancel stream function
  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setState(prev => ({
      ...prev,
      streamingState: StreamingState.Idle,
      currentMessage: '',
      isLoading: false,
      thinking: null,
      pendingToolExecutions: []
    }));
  }, []);

  // Clear history function
  const clearHistory = useCallback(() => {
    setState(prev => ({
      ...prev,
      history: []
    }));
  }, []);

  // Tool approval functions (placeholder for future implementation)
  const approveToolExecution = useCallback((toolId: string) => {
    logger.warn('Tool approval not yet implemented', {
      component: 'useGeminiStream',
      toolId
    });
  }, []);

  const cancelToolExecution = useCallback((toolId: string) => {
    setState(prev => ({
      ...prev,
      pendingToolExecutions: prev.pendingToolExecutions.filter(tool => tool.id !== toolId)
    }));
  }, []);

  // Set permission callback function
  const setPermissionCallback = useCallback((callback: (request: GeminiPermissionRequest) => Promise<ToolConfirmationOutcome>) => {
    permissionCallbackRef.current = callback;
  }, []);

  return {
    state,
    sendMessage,
    cancelStream,
    clearHistory,
    approveToolExecution,
    cancelToolExecution,
    setPermissionCallback
  };
}