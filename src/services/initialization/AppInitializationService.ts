/**
 * App Initialization Service Implementation - Centralized application startup orchestration
 * 
 * @class AppInitializationService
 * @implements {IAppInitializationService}
 * @description Centralized application startup coordination service with progress tracking.
 * Manages complex initialization process, service dependencies, and error recovery.
 * Provides circuit breaker patterns and graceful degradation for resilient startup.
 */

import { injectable, inject } from "inversify";
import { TYPES } from "../../infrastructure/di/types.js";
import { IAppInitializationService, InitializationProgress, InitializationCallbacks } from "../../interfaces/initialization/IAppInitializationService.js";
import { ISessionManager } from "../../interfaces/core/ISessionManager.js";
import { ISlashCommandService } from "../../interfaces/commands/index.js";
import { IModelService } from "../../interfaces/core/IModelService.js";
import { ILoggerService } from "../../interfaces/core/ILoggerService.js";
import { IProvider } from "../../interfaces/core/IProvider.js";
import { ProgressTracker, initializationTasks } from "./ProgressTracker.js";

/**
 * App Initialization Service implementation
 * 
 * @class AppInitializationService
 * @implements {IAppInitializationService}
 * @description Orchestrates complete application initialization with detailed progress reporting.
 */
@injectable()
export class AppInitializationService implements IAppInitializationService {
  private sessionManager: ISessionManager | null = null;
  private isInitializingFlag = false;
  private initializedFlag = false;
  private initializationError: string | null = null;
  private progressTracker: ProgressTracker | null = null;

  constructor(
    @inject(TYPES.SessionManager) private injectedSessionManager: ISessionManager,
    @inject(TYPES.SlashCommandService) private slashCommandService: ISlashCommandService,
    @inject(TYPES.ModelService) private modelService: IModelService,
    @inject(TYPES.LoggerService) private logger: ILoggerService
  ) {}

  /**
   * Initialize the complete application stack
   * 
   * @param {InitializationCallbacks} callbacks - Progress callbacks for UI updates
   * @returns {Promise<void>} Initialization completion promise
   * @description Orchestrates phased initialization with detailed progress tracking and error handling.
   */
  async initialize(callbacks: InitializationCallbacks): Promise<void> {
    // Prevent multiple concurrent initialization attempts
    if (this.isInitializingFlag) {
      this.logger.info("🔒 SessionManager initialization already in progress, skipping...");
      return;
    }
    
    // If sessionManager is already available and initialized, notify and skip
    if (this.sessionManager) {
      this.logger.info("🔒 SessionManager already available, setting initialized state...");
      
      this.initializedFlag = true;
      callbacks.onProgressUpdate({
        step: 5,
        message: "Ready!",
        isLoading: false,
        initialized: true,
        microProgress: 1.0
      });
      return;
    }
    
    this.isInitializingFlag = true;
    this.initializationError = null;
    
    // Create progress tracker with callback
    this.progressTracker = new ProgressTracker(initializationTasks, (update) => {
      callbacks.onProgressUpdate({
        step: Math.ceil(update.progress * 5), // Required by interface
        message: update.message,
        isLoading: update.progress < 1.0,
        initialized: update.progress >= 1.0,
        microProgress: update.progress
      });
    }, this.logger);
    
    try {
      // Phase 1: App initialization
      this.progressTracker.startTask("app.init");
      
      // Start sub-tasks
      this.progressTracker.startTask("app.init.start");
      await new Promise(resolve => setTimeout(resolve, 2)); // Simulate minimal work
      this.progressTracker.completeTask("app.init.start");
      
      this.progressTracker.startTask("app.init.validate");
      if (!this.injectedSessionManager) {
        this.logger.error("🚨 SessionManager not provided during initialization");
        throw new Error("SessionManager is required but not provided");
      }
      this.progressTracker.completeTask("app.init.validate");
      
      this.progressTracker.startTask("app.init.logger");
      this.sessionManager = this.injectedSessionManager;
      this.logger.info("✅ SessionManager set successfully:", { sessionManagerSet: this.sessionManager !== null });
      this.progressTracker.completeTask("app.init.logger");
      
      this.progressTracker.startTask("app.init.model");
      this.logger.info('🏗️ [AppInitialization] Using injected ModelService');
      this.logger.info('🏗️ [AppInitialization] Initial model:', { currentModel: this.modelService.getCurrentModel() });
      this.logger.info('🏗️ [AppInitialization] Initializing permission mode tracking with: default');
      await this.modelService.onPermissionModeChange("default");
      this.logger.info('🏗️ [AppInitialization] Permission mode tracking initialized');
      this.progressTracker.completeTask("app.init.model");
      
      this.progressTracker.completeTask("app.init");
      
      // Phase 2: Core services
      this.progressTracker.startTask("core.services");
      
      // Start parallel initialization
      const initPromises = [
        // SessionManager initialization with progress tracking
        this.initializeSessionManagerWithProgress(),
        
        // MCP monitoring (lightweight)
        this.initializeMCPMonitoring()
      ];
      
      await Promise.all(initPromises);
      this.progressTracker.completeTask("core.services");
      
      // Phase 3: Finalization
      this.progressTracker.startTask("finalize");
      
      this.progressTracker.startTask("final.permission");
      try {
        if (this.sessionManager) {
          const currentProviderInstance = this.sessionManager.getCurrentProviderInstance();
          if (currentProviderInstance && 'setPermissionMode' in currentProviderInstance && typeof currentProviderInstance.setPermissionMode === 'function') {
            currentProviderInstance.setPermissionMode("default");
          }
        }
      } catch (error) {
        this.logger.warn('Failed to set initial permission mode:', { error: (error as Error).message });
      }
      this.progressTracker.completeTask("final.permission");
      
      this.progressTracker.startTask("final.state");
      this.initializedFlag = true;
      this.progressTracker.completeTask("final.state");
      
      this.progressTracker.startTask("final.complete");
      await new Promise(resolve => setTimeout(resolve, 5)); // Brief pause for visual effect
      this.progressTracker.completeTask("final.complete");
      
      this.progressTracker.completeTask("finalize");
      
      // Ensure we report 100% completion with a brief pause to show it
      callbacks.onProgressUpdate({
        step: 5,
        message: "Ready!",
        isLoading: true, // Keep showing for a moment
        initialized: false,
        microProgress: 1.0
      });
      
      // Brief pause to show 100% before hiding
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Now hide the progress bar
      callbacks.onProgressUpdate({
        step: 5,
        message: "Ready!",
        isLoading: false,
        initialized: true,
        microProgress: 1.0
      });
      
    } catch (error) {
      this.logger.error("🚨 SessionManager initialization failed:", { error: (error as Error).message });
      this.logger.error("🚨 Setting sessionManager to null, input will be disabled");
      this.sessionManager = null;
      this.initializationError = `Initialization failed: ${(error as Error).message}`;
      
      callbacks.onProgressUpdate({
        step: 0,
        message: "Initialization failed",
        isLoading: false,
        initialized: true,
        error: this.initializationError
      });
    } finally {
      this.isInitializingFlag = false;
      if (this.progressTracker) {
        this.progressTracker.cleanup();
      }
    }
  }
  
  /**
   * Initialize session manager with progress tracking
   * 
   * @returns {Promise<void>} Session manager initialization completion promise
   * @description Initializes session manager with detailed progress delegation.
   * @private
   */
  private async initializeSessionManagerWithProgress(): Promise<void> {
    this.progressTracker!.startTask("session.manager");
    
    try {
      this.progressTracker!.startTask("session.start");
      await new Promise(resolve => setTimeout(resolve, 10));
      this.progressTracker!.completeTask("session.start");
      
      // Pass progress tracker to session manager for detailed progress
      await this.sessionManager!.initialize(this.progressTracker || undefined);
      
      this.progressTracker!.completeTask("session.manager");
    } catch (error) {
      this.progressTracker!.completeTask("session.manager");
      throw error;
    }
  }
  
  /**
   * Initialize MCP monitoring capabilities
   * 
   * @returns {Promise<void>} MCP monitoring initialization completion promise
   * @description Sets up lightweight MCP monitoring without server management.
   * @private
   */
  private async initializeMCPMonitoring(): Promise<void> {
    this.progressTracker!.startTask("mcp.monitor");
    
    this.logger.debug("🔧 UI will monitor stderr for permissions - Claude CLI handles MCP server");
    await new Promise(resolve => setTimeout(resolve, 10));
    
    this.progressTracker!.completeTask("mcp.monitor");
  }

  /**
   * Check if application is fully initialized
   * 
   * @returns {boolean} True if initialization is complete
   * @description Returns initialization completion status.
   */
  isInitialized(): boolean {
    return this.initializedFlag;
  }

  /**
   * Check if initialization is currently in progress
   * 
   * @returns {boolean} True if initialization is ongoing
   * @description Returns current initialization status to prevent concurrent attempts.
   */
  isInitializing(): boolean {
    return this.isInitializingFlag;
  }

  /**
   * Get last initialization error if any
   * 
   * @returns {string | null} Error message or null if no error
   * @description Retrieves error information for debugging and user feedback.
   */
  getInitializationError(): string | null {
    return this.initializationError;
  }

  /**
   * Get initialized session manager instance
   * 
   * @returns {ISessionManager | null} Session manager instance or null if not available
   * @description Provides access to session manager after successful initialization.
   */
  getSessionManager(): ISessionManager | null {
    return this.sessionManager;
  }

  /**
   * Clean up initialization service and all managed resources
   * 
   * @returns {Promise<void>} Cleanup completion promise
   * @description Performs graceful shutdown of all initialized services and resources.
   */
  async cleanup(): Promise<void> {
    try {
      if (this.sessionManager) {
        await this.sessionManager.cleanup();
      }
      // MCP server lifecycle is handled by CLI - no need to stop server process
      
      this.sessionManager = null;
      this.initializedFlag = false;
      this.isInitializingFlag = false;
      this.initializationError = null;
    } catch (error) {
      this.logger.error("Error during AppInitializationService cleanup:", { error: (error as Error).message });
    }
  }
}