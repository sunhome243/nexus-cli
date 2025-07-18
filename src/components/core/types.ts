/**
 * CLI Component Types
 *
 * Type definitions for the CLI interface components.
 */

import { ProviderType } from "../../abstractions/providers/index.js";

export type AIProvider = ProviderType;

export interface ProviderResponse {
  text: string;
  provider: ProviderType;
  timestamp: Date;
  error?: string;
}

export interface ToolExecution {
  id?: string; // Unique identifier for the tool execution
  toolName: string;
  args: Record<string, unknown>;
  isExecuting: boolean;
  result?: string;
  timestamp: Date;
  toolUseId?: string;
  isError?: boolean;
  errorMessage?: string;
  provider: AIProvider; // NEW: permanent provider tracking
  permissionTier?: "safe" | "cautious" | "dangerous"; // NEW: permission level
  executionTime?: number; // NEW: execution timing in milliseconds
}

export interface ThoughtSummary {
  subject: string;
  description: string;
}

export interface Message {
  role?: "user" | "assistant";
  content?: string;
  text?: string;
  provider: AIProvider;
  timestamp: Date;
  toolExecutions?: ToolExecution[];
  isUser?: boolean;
  isError?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ThinkingItem {
  subject: string;
  description: string;
  provider: AIProvider;
  timestamp: Date;
}

export interface StreamingChunk {
  type: 'content' | 'thinking' | 'tool';
  value: string;
  timestamp: number;
}

export interface RenderItem {
  type: "message" | "tool" | "thinking" | "tool_execution";
  timestamp: Date;
  data: Message | ToolExecution | ThinkingItem;
}

export interface ModelInfo {
  model: string;
  isUsingFallback: boolean;
  hasQuotaError: boolean;
}

export interface PendingPermission {
  toolName: string;
  args: Record<string, unknown>;
  description?: string;
  timestamp: Date;
  request?: {
    tool: string;
    arguments: Record<string, unknown>;
    description?: string;
    tier: 'safe' | 'cautious' | 'dangerous';
    toolUseId?: string;
  };
  resolve?: (response: { approved: boolean; reason?: string; autoApprove?: boolean }) => void;
}

export interface PendingPermissionRequest {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  description?: string;
  timestamp: Date;
}

export interface StreamingMessage {
  content: string;
  timestamp: Date;
  type: 'partial' | 'thinking' | 'system';
}

export interface AppState {
  currentProvider: AIProvider;
  isLoading: boolean;
  initialized?: boolean;
  initError?: string;
  // Unified items array - messages and tools in arrival order
  items: RenderItem[];
  
  // Alternative render items from experiment branch
  renderItems?: RenderItem[];
  
  // Claude streaming state
  isStreaming?: boolean;
  streamingText?: string;
  streamingMessage?: StreamingMessage | null;
  streamingChunks?: StreamingChunk[];
  pendingPermission?: PendingPermission;
  pendingPermissionRequest?: PendingPermissionRequest;
  permissionMode?: string;
  
  // Gemini thinking state
  currentThought?: ThoughtSummary;
  
  // Model tracking for quota/fallback handling
  modelInfo?: ModelInfo | null;
  
}
