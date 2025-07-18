/**
 * Gemini Usage Tracker Interface
 * Defines the contract for Gemini usage tracking
 */

import { IUsageTracker } from '../core/IUsageTracker.js';
import { GeminiUsageStats } from '../../utils/geminiStatsUtils.js';

// Gemini usage data interface
export interface GeminiUsageData {
  tokens: {
    input: number;
    output: number;
    cached: number;
    total: number;
  };
  model: string;
  timestamp: Date;
  duration: number;
  error?: string;
  toolCalls?: number;
}

export interface IGeminiUsageTracker extends IUsageTracker {
  /**
   * Track Gemini API usage
   */
  trackUsage(usage: GeminiUsageData): Promise<void>;

  /**
   * Get Gemini usage statistics
   */
  getUsageStats(): GeminiUsageStats;

  /**
   * Reset usage statistics - implementing IUsageTracker.reset()
   */
  resetStats(): void;

  /**
   * Get provider type
   */
  getProviderType(): string;
}