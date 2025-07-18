/**
 * Usage Tracking Types
 * Defines types for hybrid usage tracking (external Claude, internal Gemini)
 */
import { ProviderType } from '../../abstractions/providers/types.js';

export type AIProvider = ProviderType;

// Claude plan type definition
export type ClaudePlanType = 'plus' | 'max5x' | 'max20x'; // Uses ccusage plan names

export interface ClaudeSessionWindow {
  windowStart: Date;
  windowEnd: Date;
  tokensUsed: number;
}

export interface ClaudePlanUsage {
  planType: ClaudePlanType;
  tokenLimit: number;
  tokensUsed: number;
  percentageUsed: number;
  status: 'safe' | 'warning' | 'danger'; // < 50%, 50-80%, > 80%
}

export interface ClaudeUsageStats {
  currentWindow: ClaudeSessionWindow;
  planUsages: ClaudePlanUsage[]; // Show usage against all three plans
  todayTotal: {
    tokensUsed: number;
    windowsCompleted: number;
    averagePerWindow: number;
  };
}

export interface GeminiUsageStats {
  currentSession: {
    tokensUsed: number;
    duration: string;
    startTime: Date;
  };
  todayTotal: {
    tokensUsed: number;
    sessionCount: number;
    estimatedCost: number;
  };
}

export interface UnifiedStats {
  claude: ClaudeUsageStats;
  gemini: GeminiUsageStats;
  lastUpdated: Date;
}

export interface DailyUsageData {
  date: string; // YYYY-MM-DD
  claude: {
    totalTokens: number;
    windowsCompleted: number;
  };
  gemini: {
    totalTokens: number;
    sessionCount: number;
  };
}

export interface TokenUsageEvent {
  provider: AIProvider;
  tokens: number;
  timestamp: Date;
  sessionId?: string;
}

// Note: Claude plan limits and constants are now in claudeUsageTypes.ts 
// to avoid conflicts between external ccusage and internal tracking definitions