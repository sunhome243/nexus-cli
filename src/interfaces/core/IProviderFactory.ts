/**
 * Provider Factory Interface
 * Factory pattern interface for provider creation and lifecycle management
 */

import { IProvider } from './IProvider.js';
import { ProviderType } from '../../abstractions/providers/index.js';

export interface IProviderFactory {
  /**
   * Creates a provider instance based on type
   */
  createProvider(type: ProviderType): Promise<IProvider>;
  
  /**
   * Destroys a provider instance and cleans up resources
   */
  destroyProvider(provider: IProvider): Promise<void>;
  
  /**
   * Gets the supported provider types
   */
  getSupportedTypes(): ProviderType[];
  
  /**
   * Checks if a provider type is supported
   */
  isSupported(type: ProviderType): boolean;
  
  /**
   * Gets the current active provider
   */
  getCurrentProvider(): IProvider | null;
  
  /**
   * Switches to a different provider type
   */
  switchProvider(type: ProviderType): Promise<IProvider>;
  
  /**
   * Gets statistics about provider instances
   */
  getStats(): { activeInstances: number; currentType: string | null };
}