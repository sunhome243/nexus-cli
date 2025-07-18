import { useState, useCallback, useRef } from "react";
import { useServices } from "../components/providers/ServiceProvider.js";

export interface InputHistoryOptions {
  maxEntries?: number;
  historyType?: "chat" | "cli";
}

export interface InputHistoryState {
  isNavigating: boolean;
  navigationIndex: number;
  totalEntries: number;
}

export interface InputHistoryActions {
  addEntry: (entry: string) => void;
  navigateUp: () => boolean;
  navigateDown: () => boolean;
  resetNavigation: () => void;
  clearHistory: () => void;
}

export interface UseInputHistoryResult extends InputHistoryState, InputHistoryActions {
  getCurrentEntry: () => string | null;
}

export function useInputHistory(
  currentQuery: string,
  onChange: (value: string) => void,
  options: InputHistoryOptions = {}
): UseInputHistoryResult {
  const { maxEntries = 50, historyType = "chat" } = options;

  // Storage key based on history type
  const storageKey = `nexus-${historyType}-history`;

  // Get services from context
  const { storage: storageService } = useServices();

  // Initialize history from localStorage
  const [history, setHistory] = useState<string[]>(() => {
    return storageService.getItem<string[]>(storageKey, []) || [];
  });

  // Navigation state
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationIndex, setNavigationIndex] = useState(-1);
  const originalQueryRef = useRef<string>("");

  // Save history to localStorage
  const saveHistory = useCallback(
    (newHistory: string[]) => {
      storageService.setItem(storageKey, newHistory);
    },
    [storageKey, storageService]
  );

  // Add entry to history
  const addEntry = useCallback(
    (entry: string) => {
      if (!entry.trim()) return;

      const trimmedEntry = entry.trim();
      setHistory((prev) => {
        // Remove duplicates and add to beginning
        const filtered = prev.filter((item) => item !== trimmedEntry);
        const newHistory = [trimmedEntry, ...filtered].slice(0, maxEntries);
        saveHistory(newHistory);
        return newHistory;
      });

      // Reset navigation state
      setIsNavigating(false);
      setNavigationIndex(-1);
    },
    [maxEntries, saveHistory]
  );

  // Navigate up in history (older entries)
  const navigateUp = useCallback(() => {
    if (history.length === 0) return false;

    let nextIndex = navigationIndex;

    if (navigationIndex === -1) {
      // Starting navigation - save current query
      originalQueryRef.current = currentQuery;
      nextIndex = 0;
      setIsNavigating(true);
    } else if (navigationIndex < history.length - 1) {
      // Move to older entry
      nextIndex = navigationIndex + 1;
    } else {
      // Already at oldest entry
      return false;
    }

    setNavigationIndex(nextIndex);
    onChange(history[nextIndex]);
    return true;
  }, [history, navigationIndex, currentQuery, onChange]);

  // Navigate down in history (newer entries)
  const navigateDown = useCallback(() => {
    if (!isNavigating || navigationIndex === -1) return false;

    let nextIndex = navigationIndex;

    if (navigationIndex > 0) {
      // Move to newer entry
      nextIndex = navigationIndex - 1;
      setNavigationIndex(nextIndex);
      onChange(history[nextIndex]);
    } else {
      // Back to original query
      setNavigationIndex(-1);
      setIsNavigating(false);
      onChange(originalQueryRef.current);
    }

    return true;
  }, [isNavigating, navigationIndex, onChange, history]);

  // Reset navigation state
  const resetNavigation = useCallback(() => {
    setIsNavigating(false);
    setNavigationIndex(-1);
  }, []);

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
    resetNavigation();
  }, [saveHistory, resetNavigation]);

  // Get current entry
  const getCurrentEntry = useCallback(() => {
    if (navigationIndex >= 0 && navigationIndex < history.length) {
      return history[navigationIndex];
    }
    return null;
  }, [history, navigationIndex]);

  return {
    // State
    isNavigating,
    navigationIndex,
    totalEntries: history.length,

    // Actions
    addEntry,
    navigateUp,
    navigateDown,
    resetNavigation,
    clearHistory,
    getCurrentEntry,
  };
}
