/**
 * Provider Switch Service Interface
 * Handles provider switching with synchronization
 */

import { ProviderType } from '../../abstractions/providers/index.js';
import { ISyncEngine } from '../core/ISyncEngine.js';
import { IProviderManager } from './IProviderManager.js';

export interface IProviderSwitchService {
  switchProvider(fromProvider: ProviderType, toProvider: ProviderType, sessionId?: string): Promise<void>;
  canSwitchProvider(toProvider: ProviderType): boolean;
  getCurrentProvider(): ProviderType;
  setCurrentProvider(provider: ProviderType): void;
  getSwitchHistory(): Array<{ from: ProviderType; to: ProviderType; timestamp: Date }>;
  initialize(syncEngine: ISyncEngine, providerManager?: IProviderManager): Promise<void>;
}