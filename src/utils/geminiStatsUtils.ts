/**
 * Gemini Statistics Utilities
 * Adapted from proven gemini-cli logic for accurate stats computation
 */

import { SessionMetrics, ModelMetrics, ToolCallStats } from '@google/gemini-cli-core';
import { ProviderType } from '../abstractions/providers/types.js';

// Tool statistics interface for proper typing
interface ToolStats {
  totalCalls: number;
  totalSuccess: number;
  totalFail: number;
  averageDuration: number;
  totalDuration: number;
}

// Type guard to check if object has tool stats properties
function isToolStats(obj: unknown): obj is ToolStats {
  return typeof obj === 'object' && 
         obj !== null && 
         'totalCalls' in obj;
}

export interface GeminiUsageStats {
  session: {
    tokens: number;
    duration: string;
    models: ModelUsage[];
    tools: ToolUsage[];
    performance: {
      totalTime: number;
      apiTime: number;
      toolTime: number;
    };
  };
  daily: {
    tokens: number;
    sessions: number;
    estimatedCost: number;
  };
  cacheEfficiency?: {
    savedTokens: number;
    percentage: number;
  };
  provider: ProviderType; // Required by IUsageStats
  lastUpdated: Date; // Required by IUsageStats
}

export interface ModelUsage {
  name: string;
  requests: number;
  tokens: {
    input: number;
    output: number;
    cached: number;
    total: number;
  };
  errors: number;
  averageLatency: number;
}

export interface ToolUsage {
  name: string;
  calls: number;
  successes: number;
  failures: number;
  successRate: number;
  averageDuration: number;
}

/**
 * Compute comprehensive session statistics from telemetry data
 * Adapted from gemini-cli's computeStats function
 */
export function computeSessionStats(sessionMetrics: SessionMetrics): GeminiUsageStats['session'] {
  const models: ModelUsage[] = [];
  const tools: ToolUsage[] = [];
  
  let totalTokens = 0;
  let totalApiTime = 0;
  let totalToolTime = 0;
  let sessionStartTime = Date.now();

  // Process model metrics
  Object.entries(sessionMetrics.models || {}).forEach(([modelName, metrics]) => {
    const modelUsage: ModelUsage = {
      name: modelName,
      requests: metrics.api?.totalRequests || 0,
      tokens: {
        input: metrics.tokens?.prompt || 0,
        output: metrics.tokens?.candidates || 0,
        cached: metrics.tokens?.cached || 0,
        total: metrics.tokens?.total || 0,
      },
      errors: metrics.api?.totalErrors || 0,
      averageLatency: calculateAverageLatency(metrics),
    };
    
    models.push(modelUsage);
    totalTokens += modelUsage.tokens.total;
    totalApiTime += (metrics.api?.totalLatencyMs || 0);
  });

  // Process tool metrics
  if (sessionMetrics.tools && typeof sessionMetrics.tools === 'object') {
    Object.entries(sessionMetrics.tools).forEach(([toolName, stats]) => {
      // Handle different types of tool stats
      if (isToolStats(stats)) {
        const toolUsage: ToolUsage = {
          name: toolName,
          calls: stats.totalCalls || 0,
          successes: stats.totalSuccess || 0,
          failures: stats.totalFail || 0,
          successRate: calculateSuccessRate(stats.totalSuccess || 0, stats.totalCalls || 0),
          averageDuration: stats.averageDuration || 0,
        };
        
        tools.push(toolUsage);
        totalToolTime += (stats.totalDuration || 0);
      }
    });
  }

  // Calculate session duration
  const sessionDuration = Date.now() - sessionStartTime;
  
  return {
    tokens: totalTokens,
    duration: formatDuration(sessionDuration),
    models,
    tools,
    performance: {
      totalTime: sessionDuration,
      apiTime: totalApiTime,
      toolTime: totalToolTime,
    },
  };
}

/**
 * Calculate average latency for a model
 */
function calculateAverageLatency(metrics: ModelMetrics): number {
  const requests = metrics.api?.totalRequests || 0;
  const totalLatency = metrics.api?.totalLatencyMs || 0;
  return requests > 0 ? totalLatency / requests : 0;
}

/**
 * Calculate success rate percentage
 */
function calculateSuccessRate(successes: number, total: number): number {
  return total > 0 ? Math.round((successes / total) * 100) : 0;
}

/**
 * Format duration in milliseconds to human readable string
 * Adapted from gemini-cli's formatDuration
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  
  return `${seconds}s`;
}

/**
 * Calculate estimated cost based on token usage
 * Using approximate Gemini pricing: $0.00001 per token for simplicity
 */
export function calculateEstimatedCost(tokens: number): number {
  return tokens * 0.00001; // $0.00001 per token
}

/**
 * Calculate cache efficiency if cache data is available
 */
export function calculateCacheEfficiency(sessionMetrics: SessionMetrics): { savedTokens: number; percentage: number } | undefined {
  let totalTokens = 0;
  let cachedTokens = 0;
  
  Object.values(sessionMetrics.models || {}).forEach(metrics => {
    totalTokens += metrics.tokens?.total || 0;
    cachedTokens += metrics.tokens?.cached || 0;
  });
  
  if (totalTokens === 0) {
    return undefined;
  }
  
  const percentage = Math.round((cachedTokens / totalTokens) * 100);
  return {
    savedTokens: cachedTokens,
    percentage,
  };
}


/**
 * Create a simple text-based progress bar
 */
export function createProgressBar(value: number, max: number, width: number = 10): string {
  const percentage = Math.min(100, (value / max) * 100);
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}