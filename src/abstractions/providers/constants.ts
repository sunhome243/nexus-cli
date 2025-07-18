/**
 * Centralized constants to replace magic numbers throughout the codebase
 */

/**
 * Timeout constants in milliseconds
 */
export const TIMEOUTS = {
  SESSION_COOLDOWN: 5000,        // 5 seconds - SessionManager cooldown
  USAGE_FETCH: 10000,            // 10 seconds - Usage tracking fetch
  PROCESS_RETRY: 1000,           // 1 second - Process retry delay
  SYNC_DELAY_SHORT: 1000,        // 1 second - Short sync delay
  SYNC_DELAY_MEDIUM: 2000,       // 2 seconds - Medium sync delay
  SYNC_DELAY_LONG: 3000,         // 3 seconds - Long sync delay
  SYNC_DELAY_EXTRA: 5000,        // 5 seconds - Extra sync delay
  USAGE_QUICK_FETCH: 5000,       // 5 seconds - Quick usage fetch
  MESSAGE_RECENT_THRESHOLD: 5000 // 5 seconds - Recent message threshold
} as const;

/**
 * UI dimension constants
 */
export const UI_DIMENSIONS = {
  DEFAULT_WIDTH: 60,
  DEFAULT_HEIGHT_RATIO: 0.85,
  MCP_RESULT_LIMIT: 100
} as const;

/**
 * Time calculation constants
 */
export const TIME_UNITS = {
  MS_PER_SECOND: 1000,
  MS_PER_MINUTE: 1000 * 60,
  MS_PER_HOUR: 1000 * 60 * 60
} as const;

/**
 * Token limits and thresholds
 */
export const TOKEN_LIMITS = {
  GEMINI_REFERENCE: 10000  // Reference token count for Gemini percentage calculations
} as const;

/**
 * Retry and polling constants
 */
export const POLLING = {
  DEFAULT_INTERVAL: 1000,
  MAX_RETRIES: 3
} as const;

/**
 * Test timeout constants (for test files)
 */
export const TEST_TIMEOUTS = {
  STANDARD: 3000,
  QUICK: 2000,
  EXTENDED: 5000
} as const;