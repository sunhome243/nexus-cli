/**
 * Application State Manager Interface
 * Manages core application state operations
 */

import { AppState, AIProvider } from '../../components/core/types.js';

// Permission interface for app state
export interface PermissionState {
  requested: boolean;
  approved?: boolean;
  toolName?: string;
  args?: Record<string, unknown>;
  timestamp?: Date;
  mode?: string;
  autoApproved?: boolean;
}

export interface IAppStateManager {
  /**
   * Set loading state
   */
  setLoadingState(state: AppState, isLoading: boolean): AppState;
  
  /**
   * Set streaming state
   */
  setStreamingState(state: AppState, isStreaming: boolean): AppState;
  
  /**
   * Set current provider
   */
  setCurrentProvider(state: AppState, provider: AIProvider): AppState;
  
  /**
   * Set initialization state
   */
  setInitialized(state: AppState, initialized: boolean, error?: string): AppState;
  
  /**
   * Set permission state
   */
  setPermissionState(state: AppState, permission: PermissionState, mode?: string): AppState;
  
  /**
   * Clear permission state
   */
  clearPermissionState(state: AppState): AppState;
  
  /**
   * Validate complete state structure
   */
  validateState(state: AppState): boolean;
  
  /**
   * Reset state to initial values
   */
  resetState(initialProvider: AIProvider): AppState;
  
  /**
   * Create initial state
   */
  createInitialState(provider: AIProvider): AppState;
}