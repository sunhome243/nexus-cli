/**
 * Types for Claude usage tracking via ccusage CLI
 */

// Claude plan constants (previously in constants.ts)
export const CLAUDE_PLAN_LIMITS = {
  plus: 7000, // 7k tokens per 5-hour window
  max5x: 35000, // 35k tokens per 5-hour window
  max20x: 140000, // 140k tokens per 5-hour window
} as const;

export type ClaudePlan = keyof typeof CLAUDE_PLAN_LIMITS;

export const CLAUDE_PLAN_DISPLAY_NAMES: Record<ClaudePlan, string> = {
  plus: "Plus",
  max5x: "Max 5x",
  max20x: "Max 20x",
};

// Removed: Use defaultNexusTheme.claude.primary instead

// Progress bar configuration
export const PROGRESS_BAR_LENGTH = 10;
export const PROGRESS_BAR_FILLED = "▓";
export const PROGRESS_BAR_EMPTY = "░";

export interface CcusageSessionBlock {
  id: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  actualEndTime?: string | null;
  isActive: boolean;
  isGap?: boolean;
  entries: number;
  tokenCounts: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens: number;
    cacheReadInputTokens: number;
  };
  totalTokens: number;
  costUSD: number;
  models: string[];
  burnRate?: {
    tokensPerMinute: number;
    tokensPerMinuteForIndicator: number;
    costPerHour: number;
  } | null;
  projection?: {
    totalTokens: number;
    totalCost: number;
    remainingMinutes: number;
  } | null;
  tokenLimitStatus?: {
    limit: number;
    projectedUsage: number;
    percentUsed: number;
    status: "ok" | "warning" | "exceeds";
  };
  usageLimitResetTime?: string;
}

export interface CcusageResponse {
  blocks: CcusageSessionBlock[];
  message?: string;
}

export interface PlanUsageData {
  plan: string;
  limit: number;
  data: CcusageResponse;
}
