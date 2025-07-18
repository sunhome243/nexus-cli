/**
 * Provider Registry Implementation
 * 
 * @class ProviderRegistry
 * @implements {IProviderRegistry}
 * @description Central registry for managing AI providers and their configurations
 */

import { injectable, Container, inject } from 'inversify';
import { IProviderRegistry, IProviderMetadata } from '../../interfaces/core/IProviderRegistry.js';
import { ProviderType } from '../../abstractions/providers/index.js';
import { IProvider, IProviderCapabilities } from '../../interfaces/core/IProvider.js';

@injectable()
export class ProviderRegistry implements IProviderRegistry {
  private providers = new Map<ProviderType, IProviderMetadata>();

  constructor(
    @inject('Container') private container: Container
  ) {}

  /**
   * Register a provider in the registry
   * 
   * @param {IProviderMetadata} metadata - Provider metadata to register
   * @throws {Error} If provider type is already registered
   * @returns {void}
   */
  registerProvider(metadata: IProviderMetadata): void {
    if (this.providers.has(metadata.type)) {
      throw new Error(`Provider ${metadata.type} is already registered`);
    }

    this.providers.set(metadata.type, metadata);
  }

  /**
   * Get provider metadata by type
   * 
   * @param {ProviderType} type - The provider type to retrieve
   * @returns {IProviderMetadata | undefined} Provider metadata or undefined if not found
   */
  getProvider(type: ProviderType): IProviderMetadata | undefined {
    return this.providers.get(type);
  }

  /**
   * Check if a provider type is registered
   * 
   * @param {ProviderType} type - The provider type to check
   * @returns {boolean} True if provider is registered
   */
  hasProvider(type: ProviderType): boolean {
    return this.providers.has(type);
  }

  /**
   * Get all registered providers
   * 
   * @returns {IProviderMetadata[]} Array of all provider metadata
   */
  listProviders(): IProviderMetadata[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get all available provider types
   * 
   * @returns {ProviderType[]} Array of available provider types
   */
  getAvailableTypes(): ProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get providers that support streaming
   * 
   * @returns {IProviderMetadata[]} Array of streaming-capable providers
   */
  getStreamingProviders(): IProviderMetadata[] {
    return this.listProviders().filter(provider => 
      provider.capabilities.supportsStreaming
    );
  }

  /**
   * Get providers that support a specific capability
   * 
   * @param {keyof IProviderCapabilities} capability - The capability to filter by
   * @returns {IProviderMetadata[]} Array of providers with the specified capability
   */
  getProvidersByCapability(capability: keyof IProviderCapabilities): IProviderMetadata[] {
    return this.listProviders().filter(provider => 
      provider.capabilities[capability] === true
    );
  }

  /**
   * Create a provider instance by type
   * 
   * @param {ProviderType} type - The provider type to create
   * @returns {IProvider} Created provider instance
   * @throws {Error} If provider is not registered or creation fails
   */
  createProviderInstance(type: ProviderType): IProvider {
    const metadata = this.getProvider(type);
    if (!metadata) {
      throw new Error(`Provider ${type} is not registered`);
    }

    try {
      if (this.container.isBound(metadata.diSymbol)) {
        return this.container.get<IProvider>(metadata.diSymbol);
      } else {
        return metadata.factory.create();
      }
    } catch (error) {
      throw new Error(`Failed to create provider instance for ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear all registered providers
   * 
   * @returns {void}
   */
  clear(): void {
    this.providers.clear();
  }
}