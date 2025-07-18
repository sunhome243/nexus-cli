/**
 * Central Usage Tracker Configuration
 * Single source of truth for all available usage trackers in the system
 * This file addresses the provider-specific coupling problem by centralizing tracker definitions
 */

import { Container } from 'inversify';
import { IUsageTrackerMetadata } from '../interfaces/core/IUsageTracker.js';
import { createClaudeUsageTrackerConfigs } from './usage/claude-usage.config.js';
import { createGeminiUsageTrackerConfigs } from './usage/gemini-usage.config.js';
import { ProviderType } from '../abstractions/providers/index.js';

export interface IUsageTrackerConfiguration {
  getAllTrackers(container: Container): IUsageTrackerMetadata[];
  getTrackersByProvider(container: Container, providers: ProviderType[]): IUsageTrackerMetadata[];
  getAvailableProviders(): ProviderType[];
}

export class UsageTrackerConfiguration implements IUsageTrackerConfiguration {
  private static readonly AVAILABLE_PROVIDERS = [ProviderType.CLAUDE, ProviderType.GEMINI] as const;
  
  /**
   * Get all available usage trackers in the system
   */
  getAllTrackers(container: Container): IUsageTrackerMetadata[] {
    const allTrackers = [
      ...createClaudeUsageTrackerConfigs(container),
      ...createGeminiUsageTrackerConfigs(container)
    ];
    
    return allTrackers;
  }

  /**
   * Get usage trackers filtered by specific providers
   */
  getTrackersByProvider(container: Container, providers: ProviderType[]): IUsageTrackerMetadata[] {
    const allTrackers = this.getAllTrackers(container);
    return allTrackers.filter(tracker => providers.includes(tracker.provider));
  }

  /**
   * Get all provider types that have usage trackers
   */
  getAvailableProviders(): ProviderType[] {
    return Array.from(UsageTrackerConfiguration.AVAILABLE_PROVIDERS);
  }
}

/**
 * Default usage tracker configuration instance
 */
export const usageTrackerConfiguration = new UsageTrackerConfiguration();

/**
 * Utility functions for common usage tracker operations
 */
export const UsageTrackerConfigurationUtils = {
  /**
   * Get all usage tracker configurations for DI container initialization
   */
  getAllUsageTrackerConfigurations(container: Container): IUsageTrackerMetadata[] {
    return usageTrackerConfiguration.getAllTrackers(container);
  },

  /**
   * Check if a provider has a usage tracker
   */
  hasUsageTracker(provider: ProviderType): boolean {
    return usageTrackerConfiguration.getAvailableProviders().includes(provider);
  },

  /**
   * Get usage tracker configuration by provider
   */
  getTrackerConfigByProvider(container: Container, provider: ProviderType): IUsageTrackerMetadata | undefined {
    const allTrackers = usageTrackerConfiguration.getAllTrackers(container);
    return allTrackers.find(tracker => tracker.provider === provider);
  }
};

/**
 * Usage Tracker Registry Initialization Helper
 * Used by the DI container to populate the UsageTrackerRegistry
 */
export function initializeUsageTrackersFromConfiguration(container: Container): IUsageTrackerMetadata[] {
  // Note: This function is called during DI container initialization
  // Logger may not be available yet, so we skip logging here
  const trackers = UsageTrackerConfigurationUtils.getAllUsageTrackerConfigurations(container);
  
  // Validate all trackers have required properties
  trackers.forEach(tracker => {
    if (!tracker.name || !tracker.provider || !tracker.factory) {
      throw new Error(`Invalid usage tracker configuration for ${tracker.name}: Missing required properties`);
    }
  });
  
  return trackers;
}