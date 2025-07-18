/**
 * Provider Switch Service - Core Integration
 * Handles provider switching with gemini-cli-core awareness and synchronization
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../infrastructure/di/types.js';
import { ILoggerService, ISyncEngine } from '../../interfaces/index.js';
import { IProviderSwitchService, IProviderManager } from '../../interfaces/session/index.js';
import { IProvider } from '../../interfaces/core/IProvider.js';
// ISessionLifecycleService removed - SessionManager handles lifecycle directly
import { SyncEngine, SyncDirection } from '../sync/index.js';
import { IDiffEngine } from '../../interfaces/sync/IDiffEngine.js';
import { ProviderType } from '../../abstractions/providers/index.js';

interface SwitchHistoryEntry {
  from: ProviderType;
  to: ProviderType;
  timestamp: Date;
}

@injectable()
export class ProviderSwitchService implements IProviderSwitchService {
  private currentProvider: ProviderType = ProviderType.CLAUDE;
  private switchHistory: SwitchHistoryEntry[] = [];
  private syncEngine: ISyncEngine | null = null;
  private providerManager: IProviderManager | null = null;
  private isInitialized = false;
  private isInitializing = false;
  

  constructor(
    @inject(TYPES.LoggerService) private logger: ILoggerService
  ) {}

  async initialize(syncEngine: ISyncEngine, providerManager?: IProviderManager): Promise<void> {
    this.syncEngine = syncEngine;
    this.providerManager = providerManager || null;
    this.isInitialized = true;
    this.logger.info('Provider Switch Service initialized with Core Integration', {
      providerManagerAvailable: !!this.providerManager
    });
  }

  async switchProvider(fromProvider: ProviderType, toProvider: ProviderType, sessionId?: string): Promise<void> {
    this.ensureInitialized();
    
    this.validateSwitchRequest(fromProvider, toProvider);
    
    try {
      this.logger.info('Switching provider', { 
        from: fromProvider, 
        to: toProvider, 
        sessionId 
      });
      
      // Skip sync during initialization
      if (this.isInitializing) {
        this.logger.debug('Skipping sync during initialization');
        this.performSwitch(fromProvider, toProvider);
        return;
      }
      
      // Save Gemini session before switching away
      if (fromProvider === ProviderType.GEMINI && sessionId && this.providerManager) {
        const geminiProvider = this.providerManager.getProvider(ProviderType.GEMINI);
        if (geminiProvider && '_saveSessionInternal' in geminiProvider) {
          this.logger.info('Saving Gemini session before provider switch');
          await (geminiProvider as IProvider & { _saveSessionInternal: (sessionId: string) => Promise<void> })._saveSessionInternal(sessionId);
        }
      }
      
      // Sync is now handled automatically after each conversation
      // No need to sync during provider switch
      
      // Sessions are already initialized at startup - just perform the switch
      this.performSwitch(fromProvider, toProvider);
      
      this.logger.info('Provider switched successfully', { 
        from: fromProvider, 
        to: toProvider 
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to switch provider', { 
        from: fromProvider, 
        to: toProvider, 
        error: err.message 
      });
      throw err;
    }
  }

  canSwitchProvider(toProvider: ProviderType): boolean {
    this.ensureInitialized();
    
    // Check basic provider availability
    if (![ProviderType.CLAUDE, ProviderType.GEMINI].includes(toProvider as ProviderType)) {
      return false;
    }
    
    // For Gemini, check basic provider availability
    if (toProvider === ProviderType.GEMINI && this.providerManager) {
      try {
        // Check if provider manager has the provider available
        const isAvailable = this.providerManager.isProviderAvailable(ProviderType.GEMINI);
        
        this.logger.debug('Gemini provider availability check', {
          isAvailable
        });
        
        return isAvailable;
      } catch (error) {
        this.logger.warn('Failed to check Gemini provider availability', { error });
        return false;
      }
    }
    
    // For Claude, use provider manager if available
    if (toProvider === ProviderType.CLAUDE && this.providerManager) {
      try {
        return this.providerManager.isProviderAvailable(ProviderType.CLAUDE);
      } catch (error) {
        this.logger.warn('Failed to check Claude provider availability', { error });
        return true; // Fallback to allowing Claude
      }
    }
    
    // Default to allowing switch if no provider manager
    return true;
  }

  getCurrentProvider(): ProviderType {
    return this.currentProvider;
  }

  setCurrentProvider(provider: ProviderType): void {
    this.currentProvider = provider;
    this.logger.debug('Current provider updated', { provider });
  }

  getSwitchHistory(): SwitchHistoryEntry[] {
    return [...this.switchHistory];
  }

  setInitializing(isInitializing: boolean): void {
    this.isInitializing = isInitializing;
  }

  private validateSwitchRequest(fromProvider: ProviderType, toProvider: ProviderType): void {
    if (!fromProvider || !toProvider) {
      throw new Error('Provider names cannot be empty');
    }
    
    if (fromProvider === toProvider) {
      throw new Error('Cannot switch to the same provider');
    }
    
    if (!this.canSwitchProvider(toProvider)) {
      throw new Error(`Cannot switch to provider: ${toProvider}`);
    }
  }


  private performSwitch(fromProvider: ProviderType, toProvider: ProviderType): void {
    this.currentProvider = toProvider;
    
    this.switchHistory.push({
      from: fromProvider,
      to: toProvider,
      timestamp: new Date()
    });
    
    this.logger.info('Provider switch completed', {
      from: fromProvider,
      to: toProvider,
    });
    
    // Keep history limited to last 50 switches
    if (this.switchHistory.length > 50) {
      this.switchHistory.shift();
    }
  }



  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Provider Switch Service not initialized');
    }
  }
}