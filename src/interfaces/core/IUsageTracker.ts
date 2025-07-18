/**
 * Usage Tracker Interface
 * Defines the contract for provider-specific usage tracking implementations
 */

import { ProviderType } from '../../abstractions/providers/index.js';

export interface IUsageStats {
  readonly provider: ProviderType;
  readonly lastUpdated: Date;
}

export interface IUsageTracker {
  readonly name: string;
  readonly provider: ProviderType;
  
  recordTokenUsage(tokens: number, sessionId?: string): void;
  startSession(sessionId?: string): void;
  endSession(): void;
  getUsageStats(): IUsageStats;
  reset(): void;
}

export interface IUsageTrackerMetadata {
  name: string;
  provider: ProviderType;
  displayName: string;
  description: string;
  factory: IUsageTrackerFactory;
  diSymbol: symbol;
}

export interface IUsageTrackerFactory {
  create(): IUsageTracker;
}

export interface IUsageTrackerRegistry {
  registerTracker(metadata: IUsageTrackerMetadata): void;
  getTracker(provider: ProviderType): IUsageTrackerMetadata | undefined;
  hasTracker(provider: ProviderType): boolean;
  listTrackers(): IUsageTrackerMetadata[];
  getAvailableProviders(): ProviderType[];
  createTrackerInstance(provider: ProviderType): IUsageTracker;
  clear(): void;
}