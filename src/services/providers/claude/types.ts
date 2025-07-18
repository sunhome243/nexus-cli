/**
 * Claude-specific types for streaming and permissions
 */

// Claude CLI stream-json message types
export interface ClaudeStreamMessage {
  type: 'system' | 'user' | 'assistant' | 'result' | 'error';
  subtype?: string;
  session_id?: string;
  message?: {
    id?: string;
    role: 'user' | 'assistant';
    content: ClaudeContent[];
    model?: string;
    stop_reason?: string | null;
    stop_sequence?: string | null;
    usage?: ClaudeUsage;
  };
  result?: string;
  duration_ms?: number;
  duration_api_ms?: number;
  total_cost_usd?: number;
  tools?: string[];
  model?: string;
  permissionMode?: ClaudePermissionMode;
  error?: string;
}

export interface ClaudeContent {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
  is_error?: boolean;
}

export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  service_tier?: string;
}

// Permission system types
export type ClaudePermissionMode = 'plan' | 'default' | 'acceptEdits' | 'bypassPermissions';

export interface ClaudePermissionRequest {
  tool: string;
  tier: 'safe' | 'cautious' | 'dangerous';
  command: string;
  description: string;
  arguments?: Record<string, unknown>;
  timestamp: Date;
  toolUseId?: string; // Add toolUseId for MCP server response
  plan?: string; // Add plan content for exit_plan_mode and other planning operations
}

export interface ClaudePermissionResponse {
  approved: boolean;
  autoApprove?: boolean;
  message?: string;
}

// Streaming callback types
export interface ClaudeStreamCallbacks {
  onStreamChunk?: (text: string) => void;
  onPermissionRequest?: (request: ClaudePermissionRequest) => Promise<ClaudePermissionResponse>;
  onComplete?: (response: unknown) => void;
  onError?: (error: string) => void;
}

