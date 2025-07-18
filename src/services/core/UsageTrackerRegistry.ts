/**
 * Usage Tracker Registry Service
 * 
 * @class UsageTrackerRegistry
 * @implements {IUsageTrackerRegistry}
 * @description Manages registration and instantiation of usage tracking implementations
 * Follows the same pattern as ProviderRegistry for consistency
 */

import { injectable, inject } from 'inversify';
import { Container } from 'inversify';
import { TYPES } from '../../infrastructure/di/types.js';
import { 
  IUsageTrackerRegistry, 
  IUsageTrackerMetadata, 
  IUsageTracker 
} from '../../interfaces/core/IUsageTracker.js';
import { ProviderType } from '../../abstractions/providers/index.js';
import { ILoggerService } from '../../interfaces/core/ILoggerService.js';

@injectable()
export class UsageTrackerRegistry implements IUsageTrackerRegistry {
  private trackers: Map<ProviderType, IUsageTrackerMetadata> = new Map();
  private container: Container;

  constructor(
    @inject(TYPES.LoggerService) private logger: ILoggerService,
    @inject('Container') container: Container
  ) {
    this.container = container;
  }

  /**
   * Register a usage tracker for a provider
   * 
   * @param {IUsageTrackerMetadata} metadata - Usage tracker metadata to register
   * @throws {Error} If tracker for provider is already registered
   * @returns {void}
   */
  registerTracker(metadata: IUsageTrackerMetadata): void {
    if (this.trackers.has(metadata.provider)) {
      throw new Error(`Usage tracker for provider ${metadata.provider} is already registered`);
    }

    this.trackers.set(metadata.provider, metadata);
    this.logger.info(`✅ Registered usage tracker: ${metadata.name} for provider ${metadata.provider}`);
  }

  /**
   * Get usage tracker metadata for a provider
   * 
   * @param {ProviderType} provider - The provider type to retrieve tracker for
   * @returns {IUsageTrackerMetadata | undefined} Tracker metadata or undefined if not found
   */
  getTracker(provider: ProviderType): IUsageTrackerMetadata | undefined {
    return this.trackers.get(provider);
  }

  /**
   * Check if a usage tracker is registered for a provider
   * 
   * @param {ProviderType} provider - The provider type to check
   * @returns {boolean} True if tracker is registered
   */
  hasTracker(provider: ProviderType): boolean {
    return this.trackers.has(provider);
  }

  /**
   * Get all registered usage trackers
   * 
   * @returns {IUsageTrackerMetadata[]} Array of all tracker metadata
   */
  listTrackers(): IUsageTrackerMetadata[] {
    return Array.from(this.trackers.values());
  }

  /**
   * Get all provider types with registered trackers
   * 
   * @returns {ProviderType[]} Array of provider types with trackers
   */
  getAvailableProviders(): ProviderType[] {
    return Array.from(this.trackers.keys());
  }

  /**
   * Create a usage tracker instance for a provider
   * 
   * @param {ProviderType} provider - The provider type to create tracker for
   * @returns {IUsageTracker} Created tracker instance
   * @throws {Error} If tracker is not registered or creation fails
   */
  createTrackerInstance(provider: ProviderType): IUsageTracker {
    const metadata = this.getTracker(provider);
    if (!metadata) {
      throw new Error(`Usage tracker for provider ${provider} is not registered`);
    }

    try {
      // Try to get from DI container first
      if (this.container.isBound(metadata.diSymbol)) {
        const instance = this.container.get<IUsageTracker>(metadata.diSymbol);
        this.logger.debug(`✅ Retrieved usage tracker from DI container: ${metadata.name}`);
        return instance;
      } else {
        // Fallback to factory
        const instance = metadata.factory.create();
        this.logger.debug(`✅ Created usage tracker via factory: ${metadata.name}`);
        return instance;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Failed to create usage tracker instance for provider ${provider}:`, { error: errorMessage, provider });
      throw new Error(`Failed to create usage tracker instance for ${provider}: ${errorMessage}`);
    }
  }

  /**
   * Clear all registered usage trackers
   * 
   * @returns {void}
   */
  clear(): void {
    this.trackers.clear();
    this.logger.debug('🧹 Usage tracker registry cleared');
  }
}