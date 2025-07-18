/**
 * Claude Usage Tracker Configuration
 * Defines usage tracker metadata for Claude providers
 */

import { Container } from 'inversify';
import { IUsageTrackerMetadata, IUsageTrackerFactory, IUsageTracker } from '../../interfaces/core/IUsageTracker.js';
import { TYPES } from '../../infrastructure/di/types.js';
import { ProviderType } from '../../abstractions/providers/index.js';

class ClaudeUsageTrackerFactory implements IUsageTrackerFactory {
  constructor(private container: Container) {}
  
  create(): IUsageTracker {
    return this.container.get<IUsageTracker>(TYPES.ClaudeUsageTracker);
  }
}

export function createClaudeUsageTrackerConfigs(container: Container): IUsageTrackerMetadata[] {
  return [
    {
      name: 'claude-usage-tracker',
      provider: ProviderType.CLAUDE,
      displayName: 'Claude Usage Tracker',
      description: 'Tracks Claude external usage via ccusage CLI integration',
      factory: new ClaudeUsageTrackerFactory(container),
      diSymbol: TYPES.ClaudeUsageTracker
    }
  ];
}