/**
 * App Initialization Service Interface
 * Manages the complex application startup process with service coordination
 */

export interface InitializationProgress {
  step: number;
  message: string;
  isLoading: boolean;
  initialized: boolean;
  error?: string;
  microProgress?: number; // 0-1 for smooth animation
}

export interface InitializationCallbacks {
  onProgressUpdate: (progress: InitializationProgress) => void;
}

export interface IAppInitializationService {
  // Core initialization
  initialize(callbacks: InitializationCallbacks): Promise<void>;
  
  // State management
  isInitialized(): boolean;
  isInitializing(): boolean;
  getInitializationError(): string | null;
  
  // Service access (replaces global variables)
  getSessionManager(): import('../core/ISessionManager.js').ISessionManager | null;
  
  // Cleanup
  cleanup(): Promise<void>;
}