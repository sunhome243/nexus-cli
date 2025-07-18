// Core exports
export { App } from './core/index.js';
export type { 
  AIProvider,
  ProviderResponse,
  Message,
  StreamingChunk,
  RenderItem,
  ModelInfo,
  AppState,
  ThoughtSummary,
  ThinkingItem as ThinkingItemType,
  ToolExecution as ToolExecutionType
} from './core/index.js';

// UI exports - rename conflicting exports
export * from './ui/display/index.js';
export { LoadingIndicator, ThinkingItem, TodoRenderer } from './ui/feedback/index.js';
export * from './ui/interactive/index.js';
export * from './ui/interactive-base/index.js';
export * from './ui/renderers/index.js';

// Execution exports - rename conflicting export
export { ToolExecutionComponent as ToolExecution } from './execution/index.js';

// Other exports
export * from './overlays/index.js';
export * from './shared/index.js';

// Provider exports - be specific to avoid conflicts
export {
  // Types
  ProviderType,
  IProviderAdapter,
  ArgumentRendererProps,
  TodoRendererProps,
  ClaudePermissionRequest,
  ClaudePermissionPromptProps,
  GeminiPermissionRequest,
  GeminiPermissionResponse,
  GeminiPermissionPromptProps,
  ToolConfirmationOutcome,
  ToolConfirmationDetails,
  // Factory functions
  getProviderAdapter,
  getSupportedProviders,
  isProviderSupported,
  // Components
  ClaudePermissionPrompt,
  GeminiPermissionPrompt,
  PermissionProvider,
  usePermissions
} from './providers/index.js';