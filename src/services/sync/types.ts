/**
 * Universal Message Format (UMF) - The bridge format for cross-provider sync
 * Designed to losslessly represent both Gemini and Claude message formats
 */

import { ProviderType } from '../../abstractions/providers/types.js';

export interface UniversalMessage {
  /** Universal unique identifier for this message */
  id: string;
  
  /** Parent message ID for threading (null for root messages) */
  parentId: string | null;
  
  /** Universal session identifier */
  sessionId: string;
  
  /** Message creation timestamp in ISO-8601 format */
  timestamp: string;
  
  /** Message role */
  role: 'user' | 'assistant';
  
  /** Message type for handling different interaction patterns */
  type: 'message' | 'tool_use' | 'tool_result';
  
  /** Message content structure */
  content: UniversalContent;
  
  /** Provider-specific metadata for lossless conversion */
  metadata: UniversalMetadata;
}

export interface UniversalContent {
  /** Plain text content (for simple messages) */
  text?: string;
  
  /** Tool call information (for tool use messages) */
  toolCall?: {
    name: string;
    args: Record<string, any>;
    id?: string; // Tool call ID for tracking
  };
  
  /** Tool result information (for tool result messages) */
  toolResult?: {
    id: string; // Tool call ID this result responds to
    name: string;
    result: unknown;
    isError?: boolean;
  };
  
  /** Multiple content parts (for complex messages) */
  parts?: UniversalContentPart[];
}

export interface UniversalContentPart {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  toolCall?: {
    name: string;
    args: Record<string, any>;
    id?: string;
  };
  toolResult?: {
    id: string;
    name: string;
    result: unknown;
    isError?: boolean;
  };
}

export interface UniversalMetadata {
  /** Source provider */
  provider: ProviderType;
  
  /** Original provider-specific message ID */
  originalId?: string;
  
  /** Working directory when message was created */
  cwd?: string;
  
  /** Provider version information */
  version?: string;
  
  /** Token usage information (if available) */
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
    serviceTier?: string;
  };
  
  /** Additional provider-specific metadata */
  extra?: Record<string, unknown>;
}

/**
 * Gemini-specific message format (for type safety in converters)
 */
export interface GeminiMessage {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface GeminiPart {
  text?: string;
  functionCall?: {
    name: string;
    args: Record<string, any>;
  };
  functionResponse?: {
    id: string;
    name: string;
    response: {
      output: string;
    };
  };
}

/**
 * Claude-specific message format (for type safety in converters)
 */
export interface ClaudeMessage {
  parentUuid: string | null;
  isSidechain: boolean;
  userType: string;
  cwd: string;
  sessionId: string;
  version: string;
  type: 'user' | 'assistant';
  message: {
    role: 'user' | 'assistant';
    content: string | ClaudeContentPart[];
    id?: string;
    model?: string;
    stop_reason?: string | null;
    stop_sequence?: string | null;
    usage?: {
      input_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
      output_tokens: number;
      service_tier: string;
    };
  };
  requestId?: string;
  uuid: string;
  timestamp: string;
  toolUseResult?: {
    stdout: string;
    stderr: string;
    interrupted: boolean;
    isImage: boolean;
  };
}

export interface ClaudeContentPart {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, any>;
  tool_use_id?: string;
  content?: string;
  is_error?: boolean;
}

/**
 * Conversion result wrapper for error handling
 */
export interface ConversionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

