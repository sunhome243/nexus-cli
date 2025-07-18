/**
 * Claude Usage Tracker - External ccusage integration for Claude usage tracking
 *
 * @class ClaudeUsageTracker
 * @implements {IUsageTracker}
 * @description Integrates with external ccusage CLI tool for comprehensive Claude usage tracking.
 * Provides multi-plan usage monitoring, progress visualization, and cost tracking.
 */

import { injectable, inject } from "inversify";
import { execSync, exec } from "child_process";
import { promisify } from "util";
import { TYPES } from "../../../infrastructure/di/types.js";
import { ILoggerService } from "../../../interfaces/core/ILoggerService.js";
import { IUsageTracker, IUsageStats } from "../../../interfaces/core/IUsageTracker.js";
import { ProviderType } from "../../../abstractions/providers/index.js";
import {
  CLAUDE_PLAN_LIMITS,
  CLAUDE_PLAN_DISPLAY_NAMES,
  PROGRESS_BAR_LENGTH,
  PROGRESS_BAR_FILLED,
  PROGRESS_BAR_EMPTY,
  type ClaudePlan,
  type CcusageResponse,
  type PlanUsageData,
  type CcusageSessionBlock,
} from "./claudeUsageTypes.js";
import { defaultNexusTheme } from "../../../themes/NexusTheme.js";

const execAsync = promisify(exec);

/**
 * Claude Usage Tracker implementation
 *
 * @class ClaudeUsageTracker
 * @implements {IUsageTracker}
 * @description Tracks Claude AI usage through external ccusage CLI tool integration.
 * Monitors multiple subscription plans with token usage, costs, and reset timing.
 */
@injectable()
export class ClaudeUsageTracker implements IUsageTracker {
  readonly name = "claude-usage-tracker";
  readonly provider: ProviderType = ProviderType.CLAUDE;

  constructor(@inject(TYPES.LoggerService) private logger: ILoggerService) {}

  /**
   * Get current usage data for a specific plan from ccusage (async version - kept for potential future use)
   *
   * @param {ClaudePlan} plan - Claude subscription plan type
   * @param {number} limit - Token limit for the plan
   * @returns {Promise<CcusageResponse>} Usage data from ccusage
   * @private
   */
  private async getCcusageDataForPlan(plan: ClaudePlan, limit: number): Promise<CcusageResponse> {
    try {
      this.logger.debug(`Calling ccusage for ${plan} with limit ${limit}`, { plan, limit });

      const { stdout, stderr } = await execAsync(`npx ccusage blocks --active --token-limit ${limit} --json`, {
        encoding: "utf8",
        timeout: 10000, // 10 second timeout
        maxBuffer: 1024 * 1024, // 1MB buffer
      });

      if (stderr) {
        this.logger.warn(`ccusage stderr for ${plan}:`, { plan, stderr });
      }

      this.logger.debug(`Got ccusage result for ${plan}`, { plan, outputLength: stdout.length });
      return JSON.parse(stdout) as CcusageResponse;
    } catch (error) {
      this.logger.warn(`Failed to get ccusage data for ${plan}:`, { plan, error });
      return { blocks: [] };
    }
  }

  /**
   * Get usage data for all Claude plans (optimized to call ccusage only once, fully async)
   *
   * @returns {Promise<PlanUsageData[]>} Usage data for all Claude plans
   * @description Optimized single ccusage call for all plans to minimize external command overhead.
   */
  public async getAllPlansUsage(): Promise<PlanUsageData[]> {
    try {
      this.logger.debug(`Calling ccusage once for all plans`);

      // Call ccusage asynchronously to avoid blocking the main thread
      const { stdout, stderr } = await execAsync("npx ccusage blocks --active --json", {
        encoding: "utf8",
        timeout: 10000, // 10 second timeout
        maxBuffer: 1024 * 1024, // 1MB buffer for large JSON responses
      });

      if (stderr) {
        this.logger.warn(`ccusage stderr:`, { stderr });
      }

      this.logger.debug(`Got ccusage result`, { outputLength: stdout.length });
      const baseData = JSON.parse(stdout) as CcusageResponse;

      // Create results for each plan using the same data
      const results: PlanUsageData[] = [];
      for (const [plan, limit] of Object.entries(CLAUDE_PLAN_LIMITS)) {
        results.push({
          plan,
          limit,
          data: baseData,
        });
      }

      return results;
    } catch (error) {
      this.logger.warn(`Failed to get ccusage data:`, { error });

      // Return empty results for all plans
      const results: PlanUsageData[] = [];
      for (const [plan, limit] of Object.entries(CLAUDE_PLAN_LIMITS)) {
        results.push({
          plan,
          limit,
          data: { blocks: [] },
        });
      }
      return results;
    }
  }

  /**
   * Format time remaining until session reset
   *
   * @param {CcusageSessionBlock} block - Session block with timing information
   * @returns {string} Human-readable time until reset (e.g., "2h 30m")
   * @private
   */
  private formatTimeUntilReset(block: CcusageSessionBlock): string {
    const now = new Date();
    const resetTime = new Date(block.endTime);
    const remaining = resetTime.getTime() - now.getTime();

    if (remaining <= 0) {
      return "Session expired";
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  }

  /**
   * Create progress bar visualization
   *
   * @param {number} percentage - Usage percentage (0-100)
   * @returns {string} Unicode block-based progress bar
   * @private
   */
  private createProgressBar(percentage: number): string {
    // Ensure percentage is a valid number and within bounds
    const safePercentage = Math.max(0, Math.min(100, percentage || 0));
    const filled = Math.max(0, Math.round((safePercentage / 100) * PROGRESS_BAR_LENGTH));
    const empty = Math.max(0, PROGRESS_BAR_LENGTH - filled);

    this.logger.debug(`Progress bar calculation`, { percentage: safePercentage, filled, empty });

    return PROGRESS_BAR_FILLED.repeat(filled) + PROGRESS_BAR_EMPTY.repeat(empty);
  }

  /**
   * Format plan usage for display
   *
   * @param {PlanUsageData} planData - Plan usage data from ccusage
   * @returns {string[]} Formatted display lines for the plan
   * @private
   */
  private formatPlanUsage(planData: PlanUsageData): string[] {
    const { plan, limit, data } = planData;
    const displayName = CLAUDE_PLAN_DISPLAY_NAMES[plan as ClaudePlan];
    const lines: string[] = [];

    const activeBlocks = data.blocks?.filter((b) => b.isActive) || [];

    if (activeBlocks.length > 0) {
      const block = activeBlocks[0];
      const usage = block.totalTokens || 0;
      const percentage = (usage / limit) * 100;

      this.logger.debug(`Plan usage calculation`, { plan: displayName, usage, limit, percentage });

      const progressBar = this.createProgressBar(percentage);

      // Main usage line with warning if exceeded
      const warningIcon = percentage > 100 ? " ⚠️" : "";
      lines.push(
        `${displayName}: ${progressBar} ${usage.toLocaleString()}/${limit.toLocaleString()} (${percentage.toFixed(
          1
        )}%)${warningIcon}`
      );

      // Projection line if available
      if (block.projection && block.projection.totalTokens) {
        const projectedTokens = block.projection.totalTokens;
        const projectedPercentage = (projectedTokens / limit) * 100;
        const projectedWarningIcon = projectedPercentage > 100 ? " ⚠️" : "";
        lines.push(
          `   Projected: ${projectedTokens.toLocaleString()}/${limit.toLocaleString()} (${projectedPercentage.toFixed(
            1
          )}%) at current rate${projectedWarningIcon}`
        );
      }

      // Reset time only (cost and burn rate will be shown once at the bottom)
      const resetTime = this.formatTimeUntilReset(block);
      lines.push(`   Resets in: ${resetTime}`);
    } else {
      // No active session
      const emptyBar = PROGRESS_BAR_EMPTY.repeat(PROGRESS_BAR_LENGTH);
      lines.push(`${displayName}: ${emptyBar} 0/${limit.toLocaleString()} (0.0%)`);
      lines.push(`   No active session`);
    }

    return lines;
  }

  /**
   * Get formatted Claude usage statistics using ccusage
   *
   * @returns {Promise<string>} Formatted usage display with colors and progress bars
   * @description Creates comprehensive Claude usage display with multi-plan monitoring.
   */
  public async getFormattedClaudeStats(): Promise<string> {
    try {
      const planResults = await this.getAllPlansUsage();
      const lines: string[] = [];

      // Header with Claude color
      lines.push(`\x1b[38;2;222;117;86m🤖 Claude Usage (5-hour windows)\x1b[0m`);
      lines.push("");

      // Display each plan (without cost/burn rate)
      for (const planData of planResults) {
        const planLines = this.formatPlanUsage(planData);
        lines.push(...planLines);
        lines.push(""); // Spacing between plans
      }

      // Show cost and burn rate once at the bottom
      const activeBlocks = planResults[0]?.data?.blocks?.filter((b) => b.isActive) || [];
      if (activeBlocks.length > 0) {
        const block = activeBlocks[0];
        const cost = block.costUSD?.toFixed(4) || "0.0000";

        lines.push(`Session Cost: $${cost}`);

        if (block.burnRate) {
          const tokensPerMin = Math.round(block.burnRate.tokensPerMinute);
          const costPerHour = block.burnRate.costPerHour.toFixed(4);
          lines.push(`Burn Rate: ${tokensPerMin.toLocaleString()} tokens/min ($${costPerHour}/hr)`);
        }

        lines.push("");
      }

      // Footer info with disclaimer
      lines.push(`\x1b[90mData from ccusage - includes all Claude Code usage\x1b[0m`);
      lines.push(`\x1b[90mNote: Token counts may differ from Claude's official calculation\x1b[0m`);
      lines.push(`\x1b[90m(Cache tokens might be counted differently)\x1b[0m`);

      return lines.join("\n");
    } catch (error) {
      return `\x1b[31mError fetching Claude usage data: ${error}\x1b[0m\n\nMake sure ccusage is installed and Claude Code has been used.`;
    }
  }

  /**
   * Check if ccusage is available
   *
   * @returns {Promise<boolean>} True if ccusage CLI is available
   * @description Verifies ccusage installation for external usage tracking.
   */
  public async isCcusageAvailable(): Promise<boolean> {
    try {
      await execAsync("npx ccusage --version", {
        encoding: "utf8",
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  }

  // IUsageTracker implementation methods

  /**
   * Record token usage (external tracking via ccusage)
   *
   * @param {number} tokens - Number of tokens consumed
   * @param {string} [sessionId] - Optional session identifier
   * @description Claude usage is handled externally by ccusage CLI. This is a no-op.
   */
  recordTokenUsage(tokens: number, sessionId?: string): void {
    // Claude usage is handled externally by ccusage CLI
    // This is a no-op as ccusage automatically tracks token usage
    this.logger.debug(`Claude token usage tracked externally by ccusage`, { tokens });
  }

  /**
   * Start session tracking (external management via ccusage)
   *
   * @param {string} [sessionId] - Optional session identifier
   * @description Claude sessions are managed externally by ccusage.
   */

  startSession(sessionId?: string): void {
    // Claude sessions are managed externally by ccusage
    this.logger.debug("Claude session start managed externally by ccusage", { sessionId });
  }

  /**
   * End session tracking (external management via ccusage)
   *
   * @description Claude sessions are managed externally by ccusage.
   */

  endSession(): void {
    // Claude sessions are managed externally by ccusage
    this.logger.debug("Claude session end managed externally by ccusage");
  }

  /**
   * Get basic usage statistics
   *
   * @returns {IUsageStats} Basic usage statistics with provider metadata
   * @description Returns minimal stats as detailed usage comes from ccusage external tool.
   */

  getUsageStats(): IUsageStats {
    return {
      provider: this.provider,
      lastUpdated: new Date(),
    };
  }

  /**
   * Reset usage data (no-op for external tracking)
   *
   * @description Claude usage data is managed externally by ccusage and cannot be reset.
   */

  reset(): void {
    // Claude usage data is managed externally by ccusage
    // Cannot reset external data, this is a no-op
    this.logger.debug("Claude usage data is managed externally by ccusage - cannot reset");
  }

  // Claude-specific methods

  /**
   * Get cached usage display for unified stats
   *
   * @returns {Object} Simple object representing Claude usage status
   * @description Used by UnifiedStatsService for displaying external tracking status.
   */

  getCachedUsageDisplay(): { provider: string; external: boolean; message: string } {
    // Return a simple object that represents Claude usage
    // This is used by UnifiedStatsService for displaying stats
    return {
      provider: ProviderType.CLAUDE,
      external: true,
      message: "Usage tracked externally by ccusage",
    };
  }

  /**
   * Get time until reset (Claude-specific method)
   *
   * @returns {string} Time until Claude window reset
   * @description Placeholder for Claude-specific reset timing. Requires ccusage integration.
   */
  getTimeUntilReset(): string {
    // This would need to call ccusage to get actual reset time
    // For now, return a placeholder
    return "N/A (external tracking)";
  }

  /**
   * Get usage percentage for specific Claude plan
   *
   * @param {('plus'|'max2x'|'max4x')} planType - Claude subscription plan type
   * @returns {number} Usage percentage for the plan
   * @description Placeholder for Claude-specific plan usage. Requires ccusage integration.
   */
  getUsagePercentage(planType: "plus" | "max2x" | "max4x"): number {
    // This would need to call ccusage to get actual percentage
    // For now, return 0
    return 0;
  }
}
