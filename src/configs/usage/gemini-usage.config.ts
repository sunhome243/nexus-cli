/**
 * Gemini Usage Tracker Configuration
 * Defines usage tracker metadata for Gemini providers
 */

import { Container } from 'inversify';
import { IUsageTrackerMetadata, IUsageTrackerFactory, IUsageTracker } from '../../interfaces/core/IUsageTracker.js';
import { TYPES } from '../../infrastructure/di/types.js';
import { ProviderType } from '../../abstractions/providers/index.js';

class GeminiUsageTrackerFactory implements IUsageTrackerFactory {
  constructor(private container: Container) {}
  
  create(): IUsageTracker {
    return this.container.get<IUsageTracker>(TYPES.GeminiUsageTracker);
  }
}

export function createGeminiUsageTrackerConfigs(container: Container): IUsageTrackerMetadata[] {
  return [
    {
      name: 'gemini-usage-tracker',
      provider: ProviderType.GEMINI,
      displayName: 'Gemini Usage Tracker',
      description: 'Tracks Gemini session-based usage with telemetry integration',
      factory: new GeminiUsageTrackerFactory(container),
      diSymbol: TYPES.GeminiUsageTracker
    }
  ];
}