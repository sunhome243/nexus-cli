/**
 * Unified Stats Service - Cross-provider usage statistics aggregation
 * 
 * @class UnifiedStatsService
 * @description Combines Claude and Gemini usage tracking into a unified interface.
 * Provides hybrid tracking approach: external ccusage for Claude, internal tracking for Gemini.
 * Offers formatted display with color-coded progress bars and comprehensive statistics.
 */

import { injectable, inject } from 'inversify';
import { UnifiedStats, AIProvider, TokenUsageEvent } from '../types.js';
import { TYPES } from '../../../infrastructure/di/types.js';
import { ILoggerService } from '../../../interfaces/core/ILoggerService.js';
import { IUsageTrackerRegistry, IUsageTracker } from '../../../interfaces/core/IUsageTracker.js';
import { ProviderType } from '../../../abstractions/providers/index.js';
import { ClaudeUsageTracker } from '../external/ClaudeUsageTracker.js';
import { GeminiUsageTracker } from '../internal/GeminiUsageTracker.js';

/**
 * Unified Stats Service implementation
 * 
 * @class UnifiedStatsService
 * @description Aggregates usage statistics from multiple AI providers into a single interface.
 * Handles different tracking methodologies per provider and provides unified reporting.
 */
@injectable()
export class UnifiedStatsService {
  private usageTrackerRegistry: IUsageTrackerRegistry;
  private claudeUsageTracker: ClaudeUsageTracker;
  private geminiUsageTracker: GeminiUsageTracker;
  private logger: ILoggerService;

  constructor(
    @inject(TYPES.LoggerService) logger: ILoggerService,
    @inject(TYPES.UsageTrackerRegistry) usageTrackerRegistry: IUsageTrackerRegistry,
    @inject(TYPES.ClaudeUsageTracker) claudeUsageTracker: ClaudeUsageTracker,
    @inject(TYPES.GeminiUsageTracker) geminiUsageTracker: GeminiUsageTracker
  ) {
    this.logger = logger;
    this.usageTrackerRegistry = usageTrackerRegistry;
    this.claudeUsageTracker = claudeUsageTracker;
    this.geminiUsageTracker = geminiUsageTracker;
  }

  /**
   * Get a specific usage tracker instance for a provider
   * 
   * @param {ProviderType} provider - The AI provider type
   * @returns {IUsageTracker} The usage tracker instance
   * @throws {Error} When tracker is not available for the provider
   */
  getUsageTracker(provider: ProviderType): IUsageTracker {
    if (!this.usageTrackerRegistry.hasTracker(provider)) {
      throw new Error(`Usage tracker for provider ${provider} is not available`);
    }
    return this.usageTrackerRegistry.createTrackerInstance(provider);
  }

  /**
   * Record token usage for a specific provider
   * 
   * @param {AIProvider} provider - The AI provider
   * @param {number} tokens - Number of tokens consumed
   * @param {string} [sessionId] - Optional session identifier
   * @description Uses hybrid approach: Claude usage tracked externally via ccusage, Gemini internally
   */
  recordTokenUsage(provider: AIProvider, tokens: number, sessionId?: string): void {
    const event: TokenUsageEvent = {
      provider,
      tokens,
      timestamp: new Date(),
      sessionId
    };

    this.logger.debug(`Recording ${tokens} tokens for ${provider}`, { provider, tokens, sessionId });

    try {
      if (provider === ProviderType.CLAUDE) {
        // Claude usage is tracked externally by ccusage CLI
        // No need to record internally as ccusage handles this automatically
        this.logger.debug(`Claude usage tracked externally by ccusage`, { tokens });
      } else if (provider === ProviderType.GEMINI) {
        // Gemini usage tracked internally
        this.geminiUsageTracker.recordTokenUsage(tokens, sessionId);
      }
    } catch (error) {
      this.logger.warn(`Failed to record usage for ${provider}:`, { provider, error });
    }
  }

  /**
   * Start a new session for a provider
   * 
   * @param {AIProvider} provider - The AI provider
   * @param {string} [sessionId] - Optional session identifier
   * @description Initiates session tracking. Claude sessions managed externally, Gemini internally.
   */
  startSession(provider: AIProvider, sessionId?: string): void {
    try {
      if (provider === ProviderType.CLAUDE) {
        // Claude sessions are managed externally by ccusage
        this.logger.debug(`Claude session start managed externally by ccusage`, { sessionId });
      } else if (provider === ProviderType.GEMINI) {
        this.geminiUsageTracker.startSession(sessionId);
      }
    } catch (error) {
      this.logger.warn(`Failed to start session for ${provider}:`, { provider, error });
    }
  }

  /**
   * End a session for a provider
   * 
   * @param {AIProvider} provider - The AI provider
   * @description Terminates session tracking and updates session counts.
   */
  endSession(provider: AIProvider): void {
    try {
      if (provider === ProviderType.CLAUDE) {
        // Claude sessions are managed externally by ccusage
        this.logger.debug(`Claude session end managed externally by ccusage`);
      } else if (provider === ProviderType.GEMINI) {
        this.geminiUsageTracker.endSession();
      }
    } catch (error) {
      this.logger.warn(`Failed to end session for ${provider}:`, { provider, error });
    }
  }

  /**
   * Get unified usage statistics for all available providers
   * 
   * @returns {UnifiedStats} Aggregated statistics from all providers
   * @description Uses hybrid approach: external ccusage for Claude, internal tracking for Gemini
   */
  getUnifiedStats(): UnifiedStats {
    const stats = {
      lastUpdated: new Date(),
      claude: {
        currentWindow: {
          windowStart: new Date(),
          windowEnd: new Date(),
          tokensUsed: 0
        },
        planUsages: [],
        todayTotal: {
          tokensUsed: 0,
          windowsCompleted: 0,
          averagePerWindow: 0
        }
      },
      gemini: {
        currentSession: {
          tokensUsed: 0,
          duration: '0:00:00',
          startTime: new Date()
        },
        todayTotal: {
          tokensUsed: 0,
          sessionCount: 0,
          estimatedCost: 0
        }
      }
    };

    // Get Claude stats from external ccusage service
    try {
      const claudeStats = this.claudeUsageTracker.getCachedUsageDisplay();
      // Transform ccusage data to expected format
      stats.claude = {
        currentWindow: {
          windowStart: new Date(),
          windowEnd: new Date(),
          tokensUsed: 0 // TODO: Extract from ccusage data
        },
        planUsages: [], // TODO: Extract from ccusage data
        todayTotal: {
          tokensUsed: 0,
          windowsCompleted: 0,
          averagePerWindow: 0
        }
      };
    } catch (error) {
      this.logger.warn(`Failed to get Claude stats from ccusage:`, { error });
    }

    // Get Gemini stats from internal tracker
    try {
      const geminiStats = this.geminiUsageTracker.getUsageStats();
      stats.gemini = geminiStats;
    } catch (error) {
      this.logger.warn(`Failed to get Gemini stats:`, { error });
    }

    return stats;
  }

  /**
   * Get formatted stats display string with colors
   * 
   * @returns {string} Formatted statistics with ANSI color codes and progress bars
   * @description Creates terminal-friendly display with provider-specific colors and progress visualization
   */
  getFormattedStats(): string {
    const stats = this.getUnifiedStats();
    
    // Format Claude stats with all three plans
    let claudeSection = '\x1b[38;2;222;115;86mClaude\x1b[0m (5-hour rolling windows)\n';
    claudeSection += `  Window resets in: ${this.getClaudeTimeUntilReset()}\n`;
    claudeSection += `  Today: ${stats.claude.todayTotal.windowsCompleted} windows, ${stats.claude.todayTotal.tokensUsed.toLocaleString()} tokens\n\n`;
    
    // Show usage against all three plans
    for (const planUsage of stats.claude.planUsages) {
      const statusSymbol = this.getStatusSymbol(planUsage.status);
      const progressBar = this.createClaudeProgressBar(planUsage.percentageUsed);
      
      claudeSection += `  ${statusSymbol} ${planUsage.planType.toUpperCase()}: ${progressBar} ${planUsage.tokensUsed.toLocaleString()}/${planUsage.tokenLimit.toLocaleString()} (${planUsage.percentageUsed}%)\n`;
    }

    // Format Gemini stats
    const geminiCurrentPercentage = Math.min((stats.gemini.currentSession.tokensUsed / 10000) * 100, 100); // Assume 10k as reference
    const geminiProgressBar = this.createGeminiProgressBar(geminiCurrentPercentage);
    
    const geminiSection = `\n\x1b[38;2;66;133;244mGemini\x1b[0m (current session)
  Current: ${geminiProgressBar} ${stats.gemini.currentSession.tokensUsed.toLocaleString()} tokens (${stats.gemini.currentSession.duration})
  Today: ${stats.gemini.todayTotal.sessionCount} sessions, ${stats.gemini.todayTotal.tokensUsed.toLocaleString()} tokens
  Est. cost: $${stats.gemini.todayTotal.estimatedCost.toFixed(2)}`;

    // Add tips section
    const tipsSection = `\nSummary:
  • Window resets: ${this.getClaudeTimeUntilReset()}
  • Session total: ${this.getCurrentSessionSummary(stats)}`;

    return `Usage Statistics
${'='.repeat(40)}

${claudeSection}${geminiSection}${tipsSection}`;
  }

  /**
   * Create a visual progress bar for percentage
   * 
   * @param {number} percentage - Usage percentage (0-100)
   * @param {number} [width=10] - Progress bar width in characters
   * @returns {string} Unicode block-based progress bar
   * @private
   */
  private createProgressBar(percentage: number, width: number = 10): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Create a Claude-themed progress bar with color
   * 
   * @param {number} percentage - Usage percentage (0-100)
   * @param {number} [width=10] - Progress bar width in characters
   * @returns {string} Claude-themed progress bar with ANSI colors
   * @private
   */
  private createClaudeProgressBar(percentage: number, width: number = 10): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    // Claude theme color #f4c28e (244, 194, 142)
    return '\x1b[38;2;244;194;142m' + '▓'.repeat(filled) + '\x1b[0m' + '░'.repeat(empty);
  }

  /**
   * Create a Gemini-themed progress bar with color
   * 
   * @param {number} percentage - Usage percentage (0-100)
   * @param {number} [width=10] - Progress bar width in characters
   * @returns {string} Gemini-themed progress bar with ANSI colors
   * @private
   */
  private createGeminiProgressBar(percentage: number, width: number = 10): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    // Gemini blue color #4285F4 (66, 133, 244)
    return '\x1b[38;2;66;133;244m' + '▓'.repeat(filled) + '\x1b[0m' + '░'.repeat(empty);
  }

  /**
   * Get status symbol based on usage level (terminal-friendly)
   * 
   * @param {('safe'|'warning'|'danger')} status - Usage safety level
   * @returns {string} Text-based status indicator
   * @private
   */
  private getStatusSymbol(status: 'safe' | 'warning' | 'danger'): string {
    switch (status) {
      case 'safe': return '[OK]';
      case 'warning': return '[!!]';
      case 'danger': return '[XX]';
    }
  }

  /**
   * Get current session summary
   * 
   * @param {UnifiedStats} stats - Unified statistics object
   * @returns {string} Human-readable session summary
   * @private
   */
  private getCurrentSessionSummary(stats: UnifiedStats): string {
    const claudeTokens = stats.claude.currentWindow.tokensUsed;
    const geminiTokens = stats.gemini.currentSession.tokensUsed;
    const totalTokens = claudeTokens + geminiTokens;
    
    if (totalTokens === 0) {
      return 'No tokens used yet';
    } else if (claudeTokens > 0 && geminiTokens > 0) {
      return `${totalTokens.toLocaleString()} tokens across both providers`;
    } else if (claudeTokens > 0) {
      return `${claudeTokens.toLocaleString()} Claude tokens`;
    } else {
      return `${geminiTokens.toLocaleString()} Gemini tokens`;
    }
  }

  /**
   * Reset all usage data (for testing/debugging)
   * 
   * @description Resets usage statistics for all available providers. Use with caution.
   */
  resetAllStats(): void {
    const availableProviders = this.usageTrackerRegistry.getAvailableProviders();
    
    for (const provider of availableProviders) {
      try {
        const tracker = this.getUsageTracker(provider);
        tracker.reset();
        this.logger.info(`Reset usage data for ${provider}`, { provider });
      } catch (error) {
        this.logger.warn(`Failed to reset stats for ${provider}:`, { provider, error });
      }
    }
  }

  /**
   * Get Claude-specific time until reset
   * 
   * @returns {string} Human-readable time until Claude window reset
   * @description Accesses Claude-specific functionality for window reset timing
   */
  getClaudeTimeUntilReset(): string {
    try {
      const tracker = this.getUsageTracker(ProviderType.CLAUDE);
      // Access Claude-specific functionality if available
      if ('getTimeUntilReset' in tracker && typeof tracker.getTimeUntilReset === 'function') {
        return String((tracker as IUsageTracker & { getTimeUntilReset: () => number }).getTimeUntilReset());
      }
    } catch (error) {
      this.logger.warn(`Failed to get Claude time until reset:`, { error });
    }
    return 'N/A';
  }

  /**
   * Get usage percentage for specific Claude plan
   * 
   * @param {('plus'|'max2x'|'max4x')} planType - Claude subscription plan type
   * @returns {number} Usage percentage for the specified plan
   * @description Accesses Claude-specific plan usage metrics
   */
  getClaudeUsagePercentage(planType: 'plus' | 'max2x' | 'max4x'): number {
    try {
      const tracker = this.getUsageTracker(ProviderType.CLAUDE);
      // Access Claude-specific functionality if available
      if ('getUsagePercentage' in tracker && typeof tracker.getUsagePercentage === 'function') {
        return (tracker as IUsageTracker & { getUsagePercentage: (planType: string) => number }).getUsagePercentage(planType);
      }
    } catch (error) {
      this.logger.warn(`Failed to get Claude usage percentage:`, { error });
    }
    return 0;
  }
}