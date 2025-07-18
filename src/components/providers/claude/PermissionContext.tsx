/**
 * Permission Context - Simplified for stdio-based MCP permission handling
 * No complex communication - permissions handled via stream parser
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { ClaudePermissionRequest, ClaudePermissionResponse } from "../../../services/providers/claude/types.js";
import { useServices } from "../ServiceProvider.js";

interface PermissionContextType {
  currentPermissionRequest: ClaudePermissionRequest | null;
  respondToPermission: (response: ClaudePermissionResponse) => void;
  isConnected: boolean; // Always true for stdio-based approach
  requestPermission: (request: ClaudePermissionRequest) => Promise<ClaudePermissionResponse>;
  handleToolFailure: (toolUseId: string, error: string) => void;
  cancelPermissionRequest: (toolUseId: string) => void;
}

const PermissionContext = createContext<PermissionContextType | null>(null);

interface PermissionProviderProps {
  children: React.ReactNode;
}

export function PermissionProvider({ children }: PermissionProviderProps) {
  const { logger, eventBus } = useServices();
  const [currentPermissionRequest, setCurrentPermissionRequest] = useState<ClaudePermissionRequest | null>(null);
  const [currentResolver, setCurrentResolver] = useState<((response: ClaudePermissionResponse) => void) | null>(null);
  const delayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const failureListenerRef = useRef<Map<string, (error: string) => void>>(new Map());
  const pendingRequestsRef = useRef<Map<string, { timer: NodeJS.Timeout; resolve: (response: ClaudePermissionResponse) => void }>>(new Map());

  // Simplified permission handling - no complex communication needed
  const respondToPermission = useCallback(
    (response: ClaudePermissionResponse) => {
      if (currentResolver) {
        currentResolver(response);
        setCurrentPermissionRequest(null);
        setCurrentResolver(null);
      }
    },
    [currentResolver]
  );

  // New function to handle permission requests with 3-second delay
  const requestPermission = useCallback((request: ClaudePermissionRequest): Promise<ClaudePermissionResponse> => {
    return new Promise((resolve) => {
      logger.info(`Permission request received: ${request.tool}`, { 
        component: 'PermissionProvider',
        toolUseId: request.toolUseId,
        tool: request.tool 
      });

      // Set up failure listener for this tool
      const toolUseId = request.toolUseId || "unknown";
      failureListenerRef.current.set(toolUseId, (error: string) => {
        logger.warn(`Tool failed quickly: ${request.tool}`, { 
          component: 'PermissionProvider',
          toolUseId,
          tool: request.tool,
          error 
        });

        // Clear delay timer from pending requests
        const pendingRequest = pendingRequestsRef.current.get(toolUseId);
        if (pendingRequest) {
          clearTimeout(pendingRequest.timer);
          pendingRequestsRef.current.delete(toolUseId);
        }

        // Show failure in tool execution UI (don't show permission prompt)
        logger.info(`Tool execution failed: ${request.tool}`, { 
          component: 'PermissionProvider',
          toolUseId,
          tool: request.tool,
          error 
        });

        // Don't auto-deny - still show permission prompt for user decision
        // The tool failure might be recoverable with user approval
        logger.info(`Tool failed but showing permission prompt anyway for user decision`, { 
          component: 'PermissionProvider',
          toolUseId,
          tool: request.tool 
        });

        // Clear failure listener and show permission prompt
        failureListenerRef.current.delete(toolUseId);
        setCurrentPermissionRequest(request);
        setCurrentResolver(() => resolve);
      });

      // Start 2-second delay timer
      const timer = setTimeout(() => {
        logger.info(`2-second delay complete, showing permission UI: ${request.tool}`, { 
          component: 'PermissionProvider',
          toolUseId,
          tool: request.tool 
        });

        // Remove from pending requests
        pendingRequestsRef.current.delete(toolUseId);

        // Clear failure listener since we're showing UI
        failureListenerRef.current.delete(toolUseId);

        // Show permission prompt
        setCurrentPermissionRequest(request);
        setCurrentResolver(() => resolve);

        delayTimerRef.current = null;
      }, 2000);

      // Store in pending requests
      pendingRequestsRef.current.set(toolUseId, { timer, resolve });
      delayTimerRef.current = timer;
    });
  }, []);

  // Function to handle tool failures
  const handleToolFailure = useCallback((toolUseId: string, error: string) => {
    const failureHandler = failureListenerRef.current.get(toolUseId);
    if (failureHandler) {
      failureHandler(error);
    }
  }, []);

  // Function to cancel a pending permission request (when Claude CLI auto-approves)
  const cancelPermissionRequest = useCallback((toolUseId: string) => {
    const pendingRequest = pendingRequestsRef.current.get(toolUseId);
    if (pendingRequest) {
      logger.info(`Cancelling permission UI for auto-approved tool`, { 
        component: 'PermissionProvider',
        toolUseId 
      });
      
      // Clear the timer
      clearTimeout(pendingRequest.timer);
      
      // Resolve the promise as auto-approved
      pendingRequest.resolve({
        approved: true,
        autoApprove: true,
        message: 'Auto-approved by Claude CLI'
      });
      
      // Remove from pending requests
      pendingRequestsRef.current.delete(toolUseId);
      
      // Clear failure listener if exists
      failureListenerRef.current.delete(toolUseId);
      
      // Update delayTimerRef if it matches
      if (delayTimerRef.current === pendingRequest.timer) {
        delayTimerRef.current = null;
      }
    }
  }, []);

  // Clean up on unmount and listen for tool failures and auto-approvals
  useEffect(() => {
    // Listen for tool failures from the event bus
    const handleGlobalToolFailure = (data: any) => {
      handleToolFailure(data.toolUseId || data.executionId, data.error);
    };

    // Listen for tool auto-approvals from the event bus
    const handleGlobalToolAutoApproval = (data: any) => {
      cancelPermissionRequest(data.toolUseId);
    };

    eventBus.onToolFailure(handleGlobalToolFailure);
    eventBus.onToolAutoApproval(handleGlobalToolAutoApproval);

    return () => {
      eventBus.offToolFailure(handleGlobalToolFailure);
      eventBus.offToolAutoApproval(handleGlobalToolAutoApproval);
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
      }
      failureListenerRef.current.clear();
      
      // Clear all pending permission requests
      pendingRequestsRef.current.forEach((request) => {
        clearTimeout(request.timer);
      });
      pendingRequestsRef.current.clear();
    };
  }, [handleToolFailure, cancelPermissionRequest, eventBus]);

  const contextValue: PermissionContextType = {
    currentPermissionRequest,
    respondToPermission,
    isConnected: true, // stdio-based MCP is always "connected"
    requestPermission,
    handleToolFailure,
    cancelPermissionRequest,
  };

  return <PermissionContext.Provider value={contextValue}>{children}</PermissionContext.Provider>;
}

export function usePermissions(): PermissionContextType {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error("usePermissions must be used within a PermissionProvider");
  }
  return context;
}
