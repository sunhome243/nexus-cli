/**
 * Unified Stats Service Interface
 * Defines the contract for unified statistics management
 */

export interface TokenUsageData {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  provider: string;
  model?: string;
  timestamp: Date;
}

export interface UnifiedStatsData {
  totalMessages: number;
  totalTokens: number;
  tokensByProvider: Record<string, number>;
  messagesByProvider: Record<string, number>;
  sessionCount: number;
  lastActivity: Date;
}

export interface ProviderStatsData {
  messages: number;
  tokens: number;
  errors: number;
  averageResponseTime: number;
  lastActivity: Date;
}

export interface IUnifiedStatsService {
  /**
   * Initialize the service
   */
  initialize(): Promise<void>;

  /**
   * Cleanup the service
   */
  cleanup(): Promise<void>;

  /**
   * Get unified statistics
   */
  getUnifiedStats(): UnifiedStatsData;

  /**
   * Update stats with new data
   */
  updateStats(data: Partial<UnifiedStatsData>): void;

  /**
   * Record token usage for tracking
   */
  recordTokenUsage(data: TokenUsageData): void;

  /**
   * Reset all statistics
   */
  resetStats(): void;

  /**
   * Get stats for specific provider
   */
  getProviderStats(provider: string): ProviderStatsData | null;
}