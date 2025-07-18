/**
 * Claude Usage Tracker Interface
 * Defines the contract for Claude usage tracking
 */

import { IUsageTracker } from '../core/IUsageTracker.js';
import { ProviderType } from '../../abstractions/providers/types.js';

export interface ClaudeUsageData {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model: string;
  timestamp: Date;
  requestId?: string;
  sessionId?: string;
}

export interface ClaudeUsageStats {
  totalRequests: number;
  totalTokens: number;
  averageTokensPerRequest: number;
  totalCost: number;
  requestsByModel: Record<string, number>;
  tokensByModel: Record<string, number>;
  dailyUsage: Record<string, number>;
  lastUpdated: Date;
  provider: ProviderType; // Required by IUsageStats
}

export interface IClaudeUsageTracker extends IUsageTracker {
  /**
   * Track Claude API usage
   */
  trackUsage(usage: ClaudeUsageData): Promise<void>;

  /**
   * Get Claude usage statistics
   */
  getUsageStats(): ClaudeUsageStats;

  /**
   * Reset usage statistics - implementing IUsageTracker.reset()
   */
  resetStats(): void;

  /**
   * Get provider type
   */
  getProviderType(): string;
}