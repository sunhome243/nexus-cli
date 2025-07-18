import { injectable } from 'inversify';
import { IProviderPlugin, IProviderRegistry, ProviderType } from './types.js';

/**
 * Provider registry implementation for dynamic provider management
 * This replaces hardcoded provider checks throughout the codebase
 */
@injectable()
export class ProviderRegistry implements IProviderRegistry {
  private providers: Map<string, IProviderPlugin> = new Map();
  
  constructor() {
    // Registry starts empty - providers are registered at runtime
  }

  /**
   * Register a new provider plugin
   */
  register(plugin: IProviderPlugin): void {
    if (this.providers.has(plugin.type)) {
      throw new Error(`Provider ${plugin.type} is already registered`);
    }
    this.providers.set(plugin.type, plugin);
  }

  /**
   * Get a registered provider by type
   */
  getProvider(type: ProviderType | string): IProviderPlugin | undefined {
    return this.providers.get(type);
  }

  /**
   * Get all available provider types
   */
  getAvailableProviders(): (ProviderType | string)[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is registered
   */
  isProviderRegistered(type: ProviderType | string): boolean {
    return this.providers.has(type);
  }

  /**
   * Get provider by checking multiple possible types
   * Useful for handling different string formats
   */
  getProviderSafe(type: string): IProviderPlugin | undefined {
    // Direct lookup
    const provider = this.providers.get(type);
    if (provider) return provider;

    // Case-insensitive lookup
    const lowerType = type.toLowerCase();
    for (const [key, value] of this.providers.entries()) {
      if (key.toLowerCase() === lowerType) {
        return value;
      }
    }

    return undefined;
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): IProviderPlugin[] {
    return Array.from(this.providers.values());
  }

  /**
   * Clear all registered providers (useful for testing)
   */
  clear(): void {
    this.providers.clear();
  }
}