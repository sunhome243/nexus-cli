/**
 * useAppState Hook
 * Centralized state management for the main App component
 * Extracts complex state logic into a reusable hook
 */

import { useState, useCallback } from "react";
import { AppState, AIProvider, RenderItem, ThoughtSummary, ModelInfo } from "../components/core/types.js";
import { useServices } from "../components/providers/ServiceProvider.js";
import { ProviderType } from "../abstractions/providers/index.js";

interface UseAppStateReturn {
  state: AppState;
  actions: {
    setCurrentProvider: (provider: AIProvider) => void;
    setLoading: (isLoading: boolean) => void;
    setInitialized: (initialized: boolean, error?: string) => void;
    addItem: (item: RenderItem) => void;
    updateItems: (updater: (items: RenderItem[]) => RenderItem[]) => void;
    setCurrentThought: (thought: ThoughtSummary | undefined) => void;
    setStreamingState: (isStreaming: boolean, text?: string) => void;
    setPendingPermission: (permission: any) => void;
    setModelInfo: (modelInfo: ModelInfo | null | undefined) => void;
    resetState: () => void;
  };
}

const initialState: AppState = {
  currentProvider: ProviderType.CLAUDE,
  isLoading: false,
  initialized: false, // Will be set by initialization service
  items: [],
  currentThought: undefined,
  streamingMessage: null,
  streamingChunks: [],
  modelInfo: undefined
};

export function useAppState(): UseAppStateReturn {
  const { logger } = useServices();
  const [state, setState] = useState<AppState>(initialState);

  const setCurrentProvider = useCallback((provider: AIProvider) => {
    setState(prev => ({ ...prev, currentProvider: provider }));
  }, []);

  const setLoading = useCallback((isLoading: boolean) => {
    setState(prev => ({ ...prev, isLoading }));
  }, []);

  const setInitialized = useCallback((initialized: boolean, error?: string) => {
    setState(prev => ({ ...prev, initialized, initError: error }));
  }, []);

  const addItem = useCallback((item: RenderItem) => {
    logger.debug('useAppState.addItem called', {
      component: 'useAppState',
      type: item.type,
      role: item.type === 'message' ? (item.data as any).role : 'n/a',
      contentPreview: item.type === 'message' ? (item.data as any).content?.substring(0, 30) : 'n/a'
    });
    setState(prev => {
      const newItems = [...prev.items, item];
      logger.debug('useAppState items updated', {
        component: 'useAppState',
        newCount: newItems.length
      });
      return { ...prev, items: newItems };
    });
  }, [logger]);

  const updateItems = useCallback((updater: (items: RenderItem[]) => RenderItem[]) => {
    setState(prev => {
      const oldCount = prev.items.length;
      const newItems = updater(prev.items);
      logger.debug('useAppState.updateItems called', {
        component: 'useAppState',
        oldCount,
        newCount: newItems.length,
        difference: newItems.length - oldCount
      });
      return { ...prev, items: newItems };
    });
  }, [logger]);

  const setCurrentThought = useCallback((thought: ThoughtSummary | undefined) => {
    setState(prev => ({ ...prev, currentThought: thought }));
  }, []);

  const setStreamingState = useCallback((isStreaming: boolean, text?: string) => {
    setState(prev => ({
      ...prev,
      isStreaming,
      streamingText: text
    }));
  }, []);

  const setPendingPermission = useCallback((permission: any) => {
    setState(prev => ({ ...prev, pendingPermission: permission }));
  }, []);

  const setModelInfo = useCallback((modelInfo: ModelInfo | null | undefined) => {
    setState(prev => ({ ...prev, modelInfo }));
  }, []);

  const resetState = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    state,
    actions: {
      setCurrentProvider,
      setLoading,
      setInitialized,
      addItem,
      updateItems,
      setCurrentThought,
      setStreamingState,
      setPendingPermission,
      setModelInfo,
      resetState
    }
  };
}