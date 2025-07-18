/**
 * Gemini Usage Tracker - Internal telemetry-based usage tracking
 * 
 * @class GeminiUsageTracker
 * @implements {IUsageTracker}
 * @description Integrates with gemini-cli-core telemetry system for comprehensive usage tracking.
 * Provides session-based tracking with daily aggregation and cost estimation.
 */

import { injectable, inject } from 'inversify';
import { 
  UiTelemetryService, 
  SessionMetrics, 
  UiEvent 
} from '@google/gemini-cli-core';
import { GeminiUsageStats, DailyUsageData } from '../types.js';
import { TYPES } from '../../../infrastructure/di/types.js';
import { IUsageTracker, IUsageStats } from '../../../interfaces/core/IUsageTracker.js';
import { ProviderType } from '../../../abstractions/providers/index.js';
import { ILocalStorageService } from '../../../interfaces/storage/ILocalStorageService.js';
import { 
  GeminiUsageStats as StructuredGeminiStats,
  computeSessionStats,
  calculateEstimatedCost,
  calculateCacheEfficiency,
  formatDuration
} from '../../../utils/geminiStatsUtils.js';

interface GeminiUsageStatsWithBaseInfo extends GeminiUsageStats, IUsageStats {
  readonly provider: ProviderType;
  readonly lastUpdated: Date;
}

/**
 * Gemini Usage Tracker implementation
 * 
 * @class GeminiUsageTracker
 * @implements {IUsageTracker}
 * @description Tracks Gemini AI usage through telemetry integration with daily persistence.
 * Manages session metrics, token counting, and cost estimation.
 */
@injectable()
export class GeminiUsageTracker implements IUsageTracker {
  readonly name = 'gemini-usage-tracker';
  readonly provider: ProviderType = ProviderType.GEMINI;
  private telemetryService: UiTelemetryService;
  private sessionStartTime: Date;
  private dailyUsage: Map<string, DailyUsageData['gemini']> = new Map();

  constructor(
    @inject(TYPES.UiTelemetryService) telemetryService: UiTelemetryService,
    @inject(TYPES.LocalStorageService) private storageService: ILocalStorageService
  ) {
    this.telemetryService = telemetryService;
    this.sessionStartTime = new Date();
    this.loadPersistedData();
    
    // Listen for telemetry updates to maintain daily usage
    this.telemetryService.on('update', this.handleTelemetryUpdate.bind(this));
  }

  /**
   * Start a new Gemini session
   * 
   * @param {string} [sessionId] - Optional session identifier
   * @description Initializes session tracking with timestamp. Works with DI-managed singleton telemetry service.
   */
  startSession(sessionId?: string): void {
    this.sessionStartTime = new Date();
    
    // Note: With DI-managed UiTelemetryService, we work with the singleton instance
    // rather than creating new instances. The telemetry service handles session boundaries internally.
  }

  /**
   * Add telemetry event (delegates to core telemetry service)
   * 
   * @param {UiEvent} event - Telemetry event to record
   * @description Delegates event recording to the core telemetry service singleton.
   */
  addEvent(event: UiEvent): void {
    this.telemetryService.addEvent(event);
  }

  /**
   * Record token usage for current Gemini session
   * 
   * @param {number} tokens - Number of tokens consumed
   * @param {string} [sessionId] - Optional session identifier
   * @description With core integration, tokens are tracked automatically via telemetry events.
   * This method updates daily usage aggregation.
   */
  recordTokenUsage(tokens: number, sessionId?: string): void {
    // With gemini-cli-core integration, token usage is tracked automatically
    // through ApiResponseEvent events, but we maintain daily usage for tracking
    this.updateDailyUsage(tokens);
    this.persistData();
  }

  /**
   * End current session
   * 
   * @description Updates daily session count and persists usage data to storage.
   */
  endSession(): void {
    // Update daily session count
    const today = this.getTodayKey();
    const todayData = this.dailyUsage.get(today) || { totalTokens: 0, sessionCount: 0 };
    todayData.sessionCount += 1;
    this.dailyUsage.set(today, todayData);
    
    this.persistData();
  }

  /**
   * Get current Gemini usage statistics
   * 
   * @returns {GeminiUsageStatsWithBaseInfo} Current usage statistics with provider metadata
   * @description Aggregates session metrics from telemetry service with daily totals.
   */
  getUsageStats(): GeminiUsageStatsWithBaseInfo {
    const sessionMetrics = this.telemetryService.getMetrics();
    const today = this.getTodayKey();
    const todayData = this.dailyUsage.get(today) || { totalTokens: 0, sessionCount: 0 };

    // Calculate total tokens from all models
    const currentSessionTokens = this.getCurrentSessionTokens(sessionMetrics);
    
    return {
      currentSession: {
        tokensUsed: currentSessionTokens,
        duration: this.getSessionDuration(),
        startTime: this.sessionStartTime
      },
      todayTotal: {
        tokensUsed: todayData.totalTokens,
        sessionCount: todayData.sessionCount,
        estimatedCost: this.calculateEstimatedCost(todayData.totalTokens)
      },
      provider: this.provider,
      lastUpdated: new Date()
    };
  }

  /**
   * Get structured Gemini usage statistics using proven gemini-cli logic
   * 
   * @returns {StructuredGeminiStats} Structured statistics following gemini-cli patterns
   * @description Uses proven computation logic from gemini-cli for consistent metrics.
   */
  getStructuredStats(): StructuredGeminiStats {
    const sessionMetrics = this.telemetryService.getMetrics();
    const today = this.getTodayKey();
    const todayData = this.dailyUsage.get(today) || { totalTokens: 0, sessionCount: 0 };

    // Use proven computation logic from gemini-cli
    const sessionStats = computeSessionStats(sessionMetrics);
    
    // Calculate cache efficiency if available
    const cacheEfficiency = calculateCacheEfficiency(sessionMetrics);
    
    return {
      provider: this.provider,
      lastUpdated: new Date(),
      session: sessionStats,
      daily: {
        tokens: todayData.totalTokens,
        sessions: todayData.sessionCount,
        estimatedCost: calculateEstimatedCost(todayData.totalTokens),
      },
      cacheEfficiency,
    };
  }


  /**
   * Get current session duration as formatted string
   * 
   * @returns {string} Human-readable duration (e.g., "2h 15m")
   * @private
   */
  private getSessionDuration(): string {
    const ms = Date.now() - this.sessionStartTime.getTime();
    return this.formatDuration(ms);
  }

  /**
   * Calculate total tokens from session metrics
   * 
   * @param {SessionMetrics} sessionMetrics - Telemetry session metrics
   * @returns {number} Total token count across all models
   * @private
   */
  private getCurrentSessionTokens(sessionMetrics: SessionMetrics): number {
    return Object.values(sessionMetrics.models).reduce(
      (total, model) => total + model.tokens.total,
      0
    );
  }

  /**
   * Handle telemetry updates to maintain daily usage
   * 
   * @param {Object} data - Telemetry update data
   * @param {SessionMetrics} data.metrics - Current session metrics
   * @param {number} data.lastPromptTokenCount - Last prompt token count
   * @private
   */
  private handleTelemetryUpdate(data: { metrics: SessionMetrics, lastPromptTokenCount: number }): void {
    const totalTokens = this.getCurrentSessionTokens(data.metrics);
    
    // Update daily usage with the total token count
    // Note: This replaces the current session total rather than adding to it
    const today = this.getTodayKey();
    const todayData = this.dailyUsage.get(today) || { totalTokens: 0, sessionCount: 0 };
    
    // Calculate the difference and add it to daily total
    const previousTotal = this.getCurrentSessionTokens(this.telemetryService.getMetrics());
    const tokensDifference = totalTokens - previousTotal;
    
    if (tokensDifference > 0) {
      todayData.totalTokens += tokensDifference;
      this.dailyUsage.set(today, todayData);
      this.persistData();
    }
  }

  /**
   * Calculate estimated cost based on token usage
   * 
   * @param {number} tokens - Number of tokens
   * @returns {number} Estimated cost in USD
   * @description Using Gemini API pricing as rough estimate. Actual pricing varies by model and plan.
   * @private
   */
  private calculateEstimatedCost(tokens: number): number {
    // Rough estimate: $0.00001 per token (adjust based on actual Gemini pricing)
    // This is a placeholder - actual pricing varies by model and plan
    const costPerToken = 0.00001;
    return Math.round(tokens * costPerToken * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Update daily usage totals
   * 
   * @param {number} tokens - Tokens to add to daily total
   * @private
   */
  private updateDailyUsage(tokens: number): void {
    const today = this.getTodayKey();
    const todayData = this.dailyUsage.get(today) || { totalTokens: 0, sessionCount: 0 };
    
    todayData.totalTokens += tokens;
    this.dailyUsage.set(today, todayData);
  }

  /**
   * Get today's date key (YYYY-MM-DD)
   * 
   * @returns {string} ISO date string for today
   * @private
   */
  private getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
  }


  /**
   * Format duration from milliseconds to human-readable string
   * 
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Formatted duration (e.g., "2h 15m" or "45m")
   * @private
   */
  private formatDuration(ms: number): string {
    const minutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Load persisted usage data from storage
   * 
   * @private
   * @description Restores daily usage data from local storage on initialization.
   */
  private loadPersistedData(): void {
    const data = this.storageService.getItem<Record<string, DailyUsageData['gemini']>>('gemini-daily-usage', {});
    if (data) {
      this.dailyUsage = new Map(Object.entries(data));
    }
  }

  /**
   * Persist usage data to storage
   * 
   * @private
   * @description Saves daily usage data to local storage for persistence across sessions.
   */
  private persistData(): void {
    const data = Object.fromEntries(this.dailyUsage.entries());
    this.storageService.setItem('gemini-daily-usage', data);
  }

  /**
   * Get detailed session metrics from core telemetry
   * 
   * @returns {SessionMetrics} Raw session metrics from telemetry service
   * @description Provides direct access to detailed telemetry data.
   */
  getDetailedMetrics(): SessionMetrics {
    return this.telemetryService.getMetrics();
  }

  /**
   * Get telemetry service instance for direct access
   * 
   * @returns {UiTelemetryService} The telemetry service singleton
   * @description Exposes telemetry service for advanced usage scenarios.
   */
  getTelemetryService(): UiTelemetryService {
    return this.telemetryService;
  }

  /**
   * Reset usage data (for testing/debugging)
   * 
   * @description Resets local state and clears persisted data. Use with caution.
   * Note: UiTelemetryService is DI-managed singleton and cannot be reset here.
   */
  reset(): void {
    // Reset local state - telemetry service is DI-managed singleton
    this.sessionStartTime = new Date();
    this.dailyUsage.clear();
    this.persistData();
    
    // Note: UiTelemetryService is now DI-managed singleton.
    // For testing, consider injecting a fresh instance or using test-specific DI configuration.
  }
}