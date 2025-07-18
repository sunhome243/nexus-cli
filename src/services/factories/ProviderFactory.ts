/**
 * Provider Factory Implementation
 * Factory pattern for provider creation and lifecycle management
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../infrastructure/di/types.js';
import { IProviderFactory } from '../../interfaces/core/IProviderFactory.js';
import { ProviderType } from '../../abstractions/providers/index.js';
import { IProvider } from '../../interfaces/core/IProvider.js';
import { ILoggerService } from '../../interfaces/core/ILoggerService.js';

@injectable()
export class ProviderFactory implements IProviderFactory {
  private currentProvider: IProvider | null = null;
  private providerInstances: Map<ProviderType, IProvider> = new Map();

  constructor(
    @inject(TYPES.LoggerService) private logger: ILoggerService,
    @inject(TYPES.GeminiProvider) private geminiProvider: IProvider,
    @inject(TYPES.ClaudeProvider) private claudeProvider: IProvider
  ) {}

  async createProvider(type: ProviderType): Promise<IProvider> {
    try {
      this.logger.info(`Creating provider of type: ${type}`);
      
      // Check if instance already exists
      if (this.providerInstances.has(type)) {
        const existingProvider = this.providerInstances.get(type)!;
        this.logger.info(`Reusing existing provider instance: ${type}`);
        return existingProvider;
      }

      let provider: IProvider;

      switch (type) {
        case ProviderType.GEMINI:
          provider = this.geminiProvider;
          break;
        case ProviderType.CLAUDE:
          provider = this.claudeProvider;
          break;
        default:
          throw new Error(`Unsupported provider type: ${type}`);
      }

      // Store instance for reuse
      this.providerInstances.set(type, provider);
      
      this.logger.info(`Successfully created provider: ${type}`);
      return provider;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create provider ${type}: ${errorMessage}`);
      throw new Error(`Failed to create provider ${type}: ${errorMessage}`);
    }
  }

  async destroyProvider(provider: IProvider): Promise<void> {
    try {
      this.logger.info(`Destroying provider instance`);
      
      // Find and remove from instances map
      for (const [type, instance] of this.providerInstances.entries()) {
        if (instance === provider) {
          this.providerInstances.delete(type);
          this.logger.info(`Removed provider instance: ${type}`);
          break;
        }
      }

      // Clear current provider if it matches
      if (this.currentProvider === provider) {
        this.currentProvider = null;
        this.logger.info(`Cleared current provider reference`);
      }

      // Cleanup provider resources if it has cleanup method
      if ('cleanup' in provider && typeof provider.cleanup === 'function') {
        await provider.cleanup();
        this.logger.info(`Provider cleanup completed`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to destroy provider: ${errorMessage}`);
      throw new Error(`Failed to destroy provider: ${errorMessage}`);
    }
  }

  getSupportedTypes(): ProviderType[] {
    return [ProviderType.CLAUDE, ProviderType.GEMINI];
  }

  isSupported(type: ProviderType): boolean {
    return this.getSupportedTypes().includes(type);
  }

  getCurrentProvider(): IProvider | null {
    return this.currentProvider;
  }

  async switchProvider(type: ProviderType): Promise<IProvider> {
    try {
      this.logger.info(`Switching to provider: ${type}`);
      
      if (!this.isSupported(type)) {
        throw new Error(`Unsupported provider type: ${type}`);
      }

      const newProvider = await this.createProvider(type);
      this.currentProvider = newProvider;
      
      this.logger.info(`Successfully switched to provider: ${type}`);
      return newProvider;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to switch provider to ${type}: ${errorMessage}`);
      throw new Error(`Failed to switch provider to ${type}: ${errorMessage}`);
    }
  }

  /**
   * Gets statistics about provider instances
   */
  getStats(): { activeInstances: number; currentType: string | null } {
    const currentType = this.currentProvider ? 
      Array.from(this.providerInstances.entries())
        .find(([, instance]) => instance === this.currentProvider)?.[0] || null
      : null;

    return {
      activeInstances: this.providerInstances.size,
      currentType
    };
  }
}