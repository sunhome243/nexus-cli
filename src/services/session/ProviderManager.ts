/**
 * Provider Manager Service - Core AI provider integration and lifecycle management
 * 
 * @class ProviderManager
 * @implements {IProviderManager}
 * @description Manages provider instances with gemini-cli-core integration patterns.
 * Focuses on core adapter management with dependency injection and availability detection.
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../infrastructure/di/types.js';
import { ILoggerService } from '../../interfaces/index.js';
import { IProgressTracker } from '../../interfaces/core/IProgressTracker.js';
import { IProviderManager, IProviderLifecycleManager } from '../../interfaces/session/index.js';
import { IMCPService } from '../core/index.js';
import { ProviderType } from '../../abstractions/providers/index.js';
import { IProviderRegistry } from '../../interfaces/core/IProviderRegistry.js';
import { IProvider } from '../../interfaces/core/IProvider.js';
import { SessionRegistryManager, ISessionRegistryManager } from '../sync/index.js';

/**
 * Provider Manager implementation
 * 
 * @class ProviderManager
 * @implements {IProviderManager}
 * @description Central manager for AI provider instances with initialization and lifecycle management.
 */
@injectable()
export class ProviderManager implements IProviderManager {
  private providerInstances: Map<ProviderType, IProvider> = new Map();
  // Removed lifecycleService - SessionManager handles sessions directly
  private registry: ISessionRegistryManager | null = null;
  private availableProviders: Set<string> = new Set();
  private isInitialized = false;
  private useStreaming = true;

  constructor(
    @inject(TYPES.LoggerService) private logger: ILoggerService,
    @inject(TYPES.ProviderRegistry) private providerRegistry: IProviderRegistry,
    @inject(TYPES.MCPService) private injectedMCPService: IMCPService,
    @inject(TYPES.SessionRegistryManager) private sessionRegistryManager: ISessionRegistryManager
  ) {}

  /**
   * Initialize the provider manager and all providers
   * 
   * @param {IProgressTracker} [progressTracker] - Optional progress tracking for UI updates
   * @returns {Promise<void>} Initialization completion promise
   * @description Creates provider instances, initializes them, and detects availability.
   */
  async initialize(progressTracker?: IProgressTracker): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logger.info('Initializing Provider Manager with Core Integration');
      
      // Core adapter functionality is now handled by individual provider services
      
      // Create registry for session management
      if (progressTracker) {
        progressTracker.startTask("pm.registry");
      }
      await this.createRegistry();
      if (progressTracker) {
        progressTracker.completeTask("pm.registry");
      }
      
      // Initialize providers with core integration
      if (progressTracker) {
        progressTracker.startTask("pm.providers.create");
      }
      await this.createProviders();
      if (progressTracker) {
        progressTracker.completeTask("pm.providers.create");
      }
      
      await this.createLifecycleManager();
      
      if (progressTracker) {
        progressTracker.startTask("pm.providers.init");
      }
      await this.initializeProviders(progressTracker);
      if (progressTracker) {
        progressTracker.completeTask("pm.providers.init");
      }
      
      // Detect available providers using core capabilities
      if (progressTracker) {
        progressTracker.startTask("pm.detect");
      }
      await this.detectAvailableProviders();
      if (progressTracker) {
        progressTracker.completeTask("pm.detect");
      }
      
      this.isInitialized = true;
      this.logger.info('Provider Manager initialized successfully', { 
        availableProviders: Array.from(this.availableProviders)
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to initialize Provider Manager', { error: err.message });
      throw err;
    }
  }

  /**
   * Get provider instance by type
   * 
   * @param {ProviderType} type - Provider type to retrieve
   * @returns {IProvider} Provider instance
   * @throws {Error} When provider is not available
   * @description Retrieves initialized provider instance for the specified type.
   */
  getProvider(type: ProviderType): IProvider {
    this.ensureInitialized();
    
    const providerInstance = this.providerInstances.get(type);
    if (!providerInstance) {
      throw new Error(`Provider not available: ${type}`);
    }
    
    return providerInstance;
  }

  /**
   * Get streaming-capable provider instance
   * 
   * @param {ProviderType} type - Provider type to retrieve
   * @returns {IProvider} Streaming provider instance
   * @throws {Error} When provider doesn't support streaming or is not available
   * @description Retrieves provider instance with streaming capability validation.
   */
  getStreamingProvider(type: ProviderType): IProvider {
    this.ensureInitialized();
    
    const providerMetadata = this.providerRegistry.getProvider(type);
    if (!providerMetadata) {
      throw new Error(`Provider not registered: ${type}`);
    }
    
    if (!providerMetadata.capabilities.supportsStreaming) {
      throw new Error(`Provider does not support streaming: ${type}`);
    }
    
    const providerInstance = this.providerInstances.get(type);
    if (!providerInstance) {
      throw new Error(`Provider not available: ${type}`);
    }
    
    return providerInstance;
  }

  /**
   * Get list of available provider names
   * 
   * @returns {string[]} Array of available provider names
   * @description Returns providers that are successfully initialized and available.
   */
  getAvailableProviders(): string[] {
    this.ensureInitialized();
    return Array.from(this.availableProviders);
  }

  /**
   * Check if provider supports streaming
   * 
   * @param {ProviderType} type - Provider type to check
   * @returns {boolean} True if provider supports streaming
   * @description Validates streaming capability based on provider metadata and availability.
   */
  supportsStreaming(type: ProviderType): boolean {
    this.ensureInitialized();
    
    const providerMetadata = this.providerRegistry.getProvider(type);
    if (!providerMetadata) {
      this.logger.debug(`[STREAMING CHECK] No metadata for provider: ${type}`);
      return false;
    }
    
    const hasStreamingCapability = providerMetadata.capabilities.supportsStreaming;
    const isProviderAvailable = this.providerInstances.has(type);
    const isInAvailableSet = this.availableProviders.has(type);
    
    const result = hasStreamingCapability && isProviderAvailable && this.useStreaming;
    
    this.logger.debug(`[STREAMING CHECK] Provider ${type} streaming support:`, {
      hasStreamingCapability,
      isProviderAvailable,
      isInAvailableSet,
      useStreaming: this.useStreaming,
      result
    });
    
    return result;
  }

  /**
   * Check if provider is available for use
   * 
   * @param {ProviderType} type - Provider type to check
   * @returns {boolean} True if provider is available
   * @description Validates provider availability after initialization.
   */
  isProviderAvailable(type: ProviderType): boolean {
    this.ensureInitialized();
    return this.availableProviders.has(type);
  }

  /**
   * Clean up all provider instances
   * 
   * @returns {Promise<void>} Cleanup completion promise
   * @description Properly disposes of all provider instances and resets internal state.
   */
  async cleanup(): Promise<void> {
    try {
      this.logger.info('Cleaning up Provider Manager');
      
      // Cleanup all provider instances
      for (const [providerType, providerInstance] of this.providerInstances) {
        try {
          if ('cleanup' in providerInstance && typeof providerInstance.cleanup === 'function') {
            await (providerInstance as IProvider & { cleanup: () => Promise<void> }).cleanup();
            this.logger.info(`Provider cleaned up: ${providerType}`);
          } else if ('dispose' in providerInstance && typeof providerInstance.dispose === 'function') {
            await (providerInstance as IProvider & { dispose: () => Promise<void> }).dispose();
            this.logger.info(`Provider disposed: ${providerType}`);
          }
        } catch (error) {
          this.logger.warn(`Failed to cleanup provider ${providerType}:`, { error, providerType });
        }
      }
      
      // Reset references
      this.providerInstances.clear();
      // Lifecycle service removed - managed by SessionManager
      this.registry = null;
      this.availableProviders.clear();
      
      this.isInitialized = false;
      this.logger.info('Provider Manager cleanup completed');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to cleanup Provider Manager', { error: err.message });
    }
  }

  /**
   * Create session registry for provider management
   * 
   * @returns {Promise<void>} Registry creation completion promise
   * @description Initializes session registry using injected instance.
   * @private
   */
  private async createRegistry(): Promise<void> {
    // Use injected registry instance
    this.registry = this.sessionRegistryManager;
  }

  /**
   * Create instances for all available provider types
   * 
   * @returns {Promise<void>} Provider creation completion promise
   * @description Creates provider instances for all types registered in the provider registry.
   * @private
   */
  private async createProviders(): Promise<void> {
    if (!this.registry) {
      throw new Error('Registry not initialized');
    }

    // Get all available provider types from registry
    const availableTypes = this.providerRegistry.getAvailableTypes();
    
    // Create provider instances for all available types
    for (const providerType of availableTypes) {
      try {
        const providerInstance = this.providerRegistry.createProviderInstance(providerType);
        this.providerInstances.set(providerType, providerInstance);
        this.logger.info(`Created provider instance: ${providerType}`);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`Failed to create provider instance for ${providerType}: ${err.message}`);
      }
    }
    
    if (this.providerInstances.size === 0) {
      throw new Error('No provider instances could be created');
    }
  }

  /**
   * Create lifecycle manager (delegated to SessionManager)
   * 
   * @returns {Promise<void>} Lifecycle manager creation completion promise
   * @description Session lifecycle management is now handled by SessionManager.
   * @private
   */
  private async createLifecycleManager(): Promise<void> {
    this.logger.info('Session lifecycle management handled by SessionManager');
  }

  /**
   * Initialize all provider instances in parallel
   * 
   * @param {IProgressTracker} [progressTracker] - Optional progress tracking
   * @returns {Promise<void>} Initialization completion promise
   * @description Initializes all created provider instances with detailed progress tracking.
   * @private
   */
  private async initializeProviders(progressTracker?: IProgressTracker): Promise<void> {
    // Get provider initialization promises
    const providerInitPromises: Promise<void>[] = [];
    const providerTypes: string[] = [];
    
    // Start all provider tasks
    if (progressTracker) {
      progressTracker.startTask("claude.init");
      progressTracker.startTask("gemini.init");
    }
    
    for (const [providerType, providerInstance] of this.providerInstances) {
      providerTypes.push(providerType);
      
      const initPromise = (async () => {
        try {
          this.logger.info(`Initializing provider: ${providerType}`);
          
          // Start provider-specific tasks
          if (progressTracker) {
            if (providerType === ProviderType.CLAUDE) {
              // Start Claude sub-tasks
              progressTracker.startTask("claude.session");
              progressTracker.startTask("claude.process");
              progressTracker.startTask("claude.permission");
              progressTracker.startTask("claude.streaming");
              progressTracker.startTask("claude.error");
            } else if (providerType === ProviderType.GEMINI) {
              // Start Gemini service tasks
              progressTracker.startTask("gemini.streaming");
              progressTracker.startTask("gemini.tools");
              progressTracker.startTask("gemini.quota");
              progressTracker.startTask("gemini.session");
              progressTracker.startTask("gemini.model");
              progressTracker.startTask("gemini.error");
              // Start Gemini core tasks
              progressTracker.startTask("gemini.core");
            }
          }
          
          await providerInstance.initialize();
          
          // Complete provider-specific tasks
          if (progressTracker) {
            if (providerType === ProviderType.CLAUDE) {
              progressTracker.completeTask("claude.session");
              progressTracker.completeTask("claude.process");
              progressTracker.completeTask("claude.permission");
              progressTracker.completeTask("claude.streaming");
              progressTracker.completeTask("claude.error");
              progressTracker.completeTask("claude.init");
            } else if (providerType === ProviderType.GEMINI) {
              progressTracker.completeTask("gemini.streaming");
              progressTracker.completeTask("gemini.tools");
              progressTracker.completeTask("gemini.quota");
              progressTracker.completeTask("gemini.session");
              progressTracker.completeTask("gemini.model");
              progressTracker.completeTask("gemini.error");
              
              // Gemini core sub-tasks
              progressTracker.startTask("gemini.config");
              await new Promise(resolve => setTimeout(resolve, 20));
              progressTracker.completeTask("gemini.config");
              
              progressTracker.startTask("gemini.auth");
              await new Promise(resolve => setTimeout(resolve, 30));
              progressTracker.completeTask("gemini.auth");
              
              progressTracker.startTask("gemini.client");
              await new Promise(resolve => setTimeout(resolve, 30));
              progressTracker.completeTask("gemini.client");
              
              progressTracker.startTask("gemini.registry");
              await new Promise(resolve => setTimeout(resolve, 20));
              progressTracker.completeTask("gemini.registry");
              
              progressTracker.startTask("gemini.checkpoint");
              await new Promise(resolve => setTimeout(resolve, 25));
              progressTracker.completeTask("gemini.checkpoint");
              
              progressTracker.completeTask("gemini.core");
              progressTracker.completeTask("gemini.init");
            }
          }
          
          this.logger.info(`Provider initialized successfully: ${providerType}`);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.logger.error(`Failed to initialize provider ${providerType}: ${err.message}`);
          
          // Complete tasks on error
          if (progressTracker) {
            if (providerType === ProviderType.CLAUDE) {
              progressTracker.completeTask("claude.init");
            } else if (providerType === ProviderType.GEMINI) {
              progressTracker.completeTask("gemini.init");
            }
          }
          
          // Continue with other providers even if one fails
        }
      })();
      
      providerInitPromises.push(initPromise);
    }
    
    // Wait for all providers to initialize in parallel
    await Promise.all(providerInitPromises);
    
    this.logger.info('All provider initialization attempts completed');
  }

  // Removed: initializeStreamingProvider - now handled in main initialization

  /**
   * Detect which providers are successfully initialized and available
   * 
   * @returns {Promise<void>} Detection completion promise
   * @description Validates provider initialization status and marks available providers.
   * @private
   */
  private async detectAvailableProviders(): Promise<void> {
    // Lifecycle service removed - providers manage themselves

    this.availableProviders.clear();
    
    // Check availability based on successfully initialized provider instances
    for (const [providerType, providerInstance] of this.providerInstances) {
      // Only mark as available if the provider is actually initialized
      // Check if provider has isProviderInitialized method (from BaseProvider)
      if ('isProviderInitialized' in providerInstance && 
          typeof providerInstance.isProviderInitialized === 'function' && 
          providerInstance.isProviderInitialized()) {
        this.availableProviders.add(providerType);
        this.logger.info(`Provider available: ${providerType}`);
      } else {
        this.logger.warn(`Provider ${providerType} exists but is not initialized`);
      }
    }
    
    // Lifecycle service removed - providers tracked directly via instances
    
    // Provider availability is determined by successful provider instance initialization
    
    this.logger.info('Provider availability detection completed', {
      availableProviders: Array.from(this.availableProviders)
    });
  }

  /**
   * Set session tag for all providers
   * 
   * @param {string} sessionTag - Session tag to set across all providers
   * @description Propagates session tag to all provider instances that support it.
   */
  setSessionTag(sessionTag: string): void {
    this.ensureInitialized();
    
    // Set session tag for all provider instances that support it
    for (const [providerType, providerInstance] of this.providerInstances) {
      try {
        if (providerInstance.setSessionTag) {
          providerInstance.setSessionTag(sessionTag);
          this.logger.info(`Session tag set for ${providerType} provider`, { sessionTag });
        }
      } catch (error) {
        this.logger.warn(`Failed to set session tag for ${providerType}: ${error}`);
      }
    }
  }


  /**
   * Get the session registry for external access
   * 
   * @returns {IProviderRegistry} Provider registry instance
   * @throws {Error} When registry is not available
   * @description Provides access to the provider registry for external services.
   */
  getRegistry(): IProviderRegistry {
    this.ensureInitialized();
    if (!this.providerRegistry) {
      throw new Error('Provider registry not available');
    }
    return this.providerRegistry;
  }


  /**
   * Ensure provider manager is initialized
   * 
   * @throws {Error} When provider manager is not initialized
   * @description Validates initialization state before operations.
   * @private
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Provider Manager not initialized');
    }
  }
}