// Provider-specific adapters
export { ClaudeAdapter, ClaudePermissionPrompt, ClaudeToolRenderer } from './ClaudeAdapter.js';
export type { 
  ClaudePermissionRequest, 
  ClaudePermissionPromptProps, 
  ClaudeToolRendererProps 
} from './ClaudeAdapter.js';

export { GeminiAdapter, GeminiPermissionPrompt, GeminiToolRenderer } from './GeminiAdapter.js';
export type { 
  GeminiPermissionPromptProps, 
  GeminiToolRendererProps 
} from './GeminiAdapter.js';