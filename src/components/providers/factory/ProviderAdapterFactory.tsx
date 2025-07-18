import React from 'react';
import { ClaudeAdapter } from '../../ui/providers/ClaudeAdapter.js';
import { GeminiAdapter } from '../../ui/providers/GeminiAdapter.js';
import { IProviderAdapter } from '../types/common.js';
import { ProviderType } from '../../../abstractions/providers/types.js';

/**
 * Factory function to get the appropriate provider adapter
 * @param provider - The provider type
 * @returns The provider adapter with PermissionPrompt and ToolRenderer components
 */
export function getProviderAdapter(provider: ProviderType): IProviderAdapter {
  switch (provider) {
    case ProviderType.CLAUDE:
      return {
        PermissionPrompt: ClaudeAdapter.PermissionPrompt,
        ToolRenderer: ClaudeAdapter.ToolRenderer
      };
    case ProviderType.GEMINI:
      return {
        PermissionPrompt: GeminiAdapter.PermissionPrompt,
        ToolRenderer: GeminiAdapter.ToolRenderer
      };
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Get all supported provider types
 */
export function getSupportedProviders(): ProviderType[] {
  return [ProviderType.CLAUDE, ProviderType.GEMINI];
}

/**
 * Check if a provider is supported
 * @param provider - The provider to check
 */
export function isProviderSupported(provider: string): provider is ProviderType {
  return getSupportedProviders().includes(provider as ProviderType);
}

export default {
  getProviderAdapter,
  getSupportedProviders,
  isProviderSupported
};