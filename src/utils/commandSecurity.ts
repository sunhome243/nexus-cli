/**
 * Command Security Utilities
 * Provides validation and sanitization functions to prevent command injection vulnerabilities
 */

import * as path from 'node:path';
import { IModelConfigManager, ProviderType, PermissionMode } from '../abstractions/providers/index.js';

// Dangerous shell metacharacters that could enable command injection
const SHELL_METACHARACTERS = /[|&;<>$`"'\\]/;

// Safe pattern for session IDs (alphanumeric + hyphens only)
const SAFE_SESSION_ID_PATTERN = /^[a-zA-Z0-9-]+$/;

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates model name against configuration
 * Uses dynamic model configuration for validation
 */
export function validateModelName(model: string, provider?: ProviderType | string, modelConfigManager?: IModelConfigManager): ValidationResult {
  if (typeof model !== 'string' || model.length === 0) {
    return { isValid: false, error: 'Model name must be a non-empty string' };
  }

  // If provider is specified, use provider-specific validation
  if (provider && modelConfigManager) {
    const validModels = modelConfigManager.getModelNames(provider);
    if (validModels.length > 0 && !validModels.includes(model.toLowerCase())) {
      return { 
        isValid: false, 
        error: `Invalid model name for ${provider}. Allowed models: ${validModels.join(', ')}, got: ${model}` 
      };
    }
  } else if (!provider && modelConfigManager) {
    // Check against all available models
    const allModels = [
      ...modelConfigManager.getModelNames(ProviderType.CLAUDE),
      ...modelConfigManager.getModelNames(ProviderType.GEMINI)
    ];
    
    if (allModels.length > 0 && !allModels.includes(model.toLowerCase())) {
      return { 
        isValid: false, 
        error: `Invalid model name. Allowed models: ${allModels.join(', ')}, got: ${model}` 
      };
    }
  }

  return { isValid: true };
}

/**
 * Validates command arguments to prevent shell metacharacter injection
 */
export function validateCommandArgument(arg: string): ValidationResult {
  if (typeof arg !== 'string') {
    return { isValid: false, error: 'Argument must be a string' };
  }

  if (SHELL_METACHARACTERS.test(arg)) {
    return { 
      isValid: false, 
      error: `Argument contains dangerous shell metacharacters: ${arg}` 
    };
  }

  return { isValid: true };
}

/**
 * Validates session ID format to prevent injection
 * Only allows alphanumeric characters and hyphens
 */
export function validateSessionId(sessionId: string): ValidationResult {
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    return { isValid: false, error: 'Session ID must be a non-empty string' };
  }

  if (sessionId.length > 64) {
    return { isValid: false, error: 'Session ID must be 64 characters or less' };
  }

  if (!SAFE_SESSION_ID_PATTERN.test(sessionId)) {
    return { 
      isValid: false, 
      error: `Session ID contains invalid characters. Only alphanumeric and hyphens allowed: ${sessionId}` 
    };
  }

  return { isValid: true };
}

/**
 * Sanitizes and validates file paths to prevent directory traversal
 */
export function sanitizeFilePath(filePath: string): string {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    throw new Error('File path must be a non-empty string');
  }

  // Normalize the path to resolve .. and . components
  const normalizedPath = path.normalize(filePath);
  
  // Resolve to absolute path to prevent traversal
  const resolvedPath = path.resolve(normalizedPath);
  
  // Additional check: ensure the resolved path doesn't contain null bytes
  if (resolvedPath.includes('\0')) {
    throw new Error('File path contains null bytes');
  }

  return resolvedPath;
}

/**
 * Validates user messages but does NOT modify content
 * Messages are passed as spawn() arguments, so shell interpretation is not a risk
 * We want full access to message content - users should be able to ask about any topic
 */
export function validateMessage(message: string): ValidationResult {
  if (typeof message !== 'string') {
    return { isValid: false, error: 'Message must be a string' };
  }

  // Basic validation - just ensure it's not empty and not excessively long
  if (message.trim().length === 0) {
    return { isValid: false, error: 'Message cannot be empty' };
  }

  if (message.length > 100000) { // 100KB limit
    return { isValid: false, error: 'Message is too long (max 100KB)' };
  }

  // No content filtering - users have full access to ask about anything
  return { isValid: true };
}

/**
 * Validates an array of command arguments
 * Returns the first validation error found, or null if all are valid
 */
export function validateCommandArguments(args: string[]): ValidationResult {
  if (!Array.isArray(args)) {
    return { isValid: false, error: 'Arguments must be an array' };
  }

  for (let i = 0; i < args.length; i++) {
    const result = validateCommandArgument(args[i]);
    if (!result.isValid) {
      return { 
        isValid: false, 
        error: `Argument at index ${i} is invalid: ${result.error}` 
      };
    }
  }

  return { isValid: true };
}

/**
 * Validates permission mode values
 */
export function validatePermissionMode(mode: string): ValidationResult {
  const allowedModes = ['default', 'acceptEdits', 'plan', 'bypassPermissions'];
  
  if (typeof mode !== 'string' || !allowedModes.includes(mode)) {
    return { 
      isValid: false, 
      error: `Invalid permission mode. Must be one of: ${allowedModes.join(', ')}` 
    };
  }

  return { isValid: true };
}