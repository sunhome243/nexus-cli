/**
 * Provider Services - Central export
 * Exports all provider service implementations
 */

// Export Gemini types and components (excluding duplicates)
export { 
  GeminiProvider,
  GeminiCoreAdapterCallbacks,
  ToolExecution
} from './gemini/index.js';

// Export Claude provider
export { ClaudeProvider } from './claude/ClaudeProvider.js';

// Export shared services (excluding StreamingCallbacks which comes from types.js)
export {
  BaseProvider,
  ErrorHandlerService,
  ErrorContext,
  ErrorCategory,
  RetryOptions,
  ErrorCallbacks,
  // Tool permission exports
  ToolTier,
  SAFE_TOOLS,
  CAUTIOUS_TOOLS,
  DANGEROUS_TOOLS,
  ALL_TOOLS,
  getToolTier,
  isToolInTier,
  getToolsInTier,
  TOOL_DESCRIPTIONS,
  getToolDescription
} from './shared/index.js';

// Export types (includes AIProvider and StreamingCallbacks)
export * from './types.js';