/**
 * Provider Manager Interface
 * Manages provider instances and their lifecycle
 */

import { ProviderType } from '../../abstractions/providers/index.js';
import { IProvider } from '../core/IProvider.js';
import { IProgressTracker } from '../core/IProgressTracker.js';
import { IProviderRegistry } from '../core/IProviderRegistry.js';

export interface ISimpleProviderRegistry {
  getProvider(type: ProviderType): IProvider | undefined;
  registerProvider(type: ProviderType, provider: IProvider): void;
  getAllProviders(): Map<ProviderType, IProvider>;
}

export interface IProviderLifecycleManager {
  initialize(provider: IProvider): Promise<void>;
  cleanup(provider: IProvider): Promise<void>;
  isInitialized(provider: IProvider): boolean;
}

export interface IProviderManager {
  initialize(progressTracker?: IProgressTracker): Promise<void>;
  getProvider(type: ProviderType): IProvider;
  getStreamingProvider(type: ProviderType): IProvider;
  getAvailableProviders(): string[];
  supportsStreaming(type: ProviderType): boolean;
  isProviderAvailable(type: ProviderType): boolean;
  setSessionTag(sessionTag: string): void;
  cleanup(): Promise<void>;
  
  // Registry management
  getRegistry(): IProviderRegistry;
}