/**
 * Central Provider Configuration
 * Single source of truth for all available providers in the system
 * This file addresses the magic string problem by centralizing provider definitions
 */

import { Container } from 'inversify';
import { IProviderMetadata } from '../interfaces/core/IProviderRegistry.js';
import { createClaudeProviderConfigs } from './providers/claude.config.js';
import { createGeminiProviderConfigs } from './providers/gemini.config.js';
import { ProviderType } from '../abstractions/providers/types.js';

export interface IProviderConfiguration {
  getAllProviders(container: Container): IProviderMetadata[];
  getProvidersByType(container: Container, types: string[]): IProviderMetadata[];
  getAvailableProviderTypes(): string[];
  getStreamingProviders(container: Container): IProviderMetadata[];
  getCoreProviders(container: Container): IProviderMetadata[];
}

export class ProviderConfiguration implements IProviderConfiguration {
  private static readonly AVAILABLE_PROVIDER_TYPES = [ProviderType.CLAUDE, ProviderType.GEMINI] as const;
  
  /**
   * Get all available providers in the system
   */
  getAllProviders(container: Container): IProviderMetadata[] {
    const allProviders = [
      ...createClaudeProviderConfigs(container),
      ...createGeminiProviderConfigs(container)
    ];
    
    return allProviders;
  }

  /**
   * Get providers filtered by specific types
   */
  getProvidersByType(container: Container, types: string[]): IProviderMetadata[] {
    const allProviders = this.getAllProviders(container);
    return allProviders.filter(provider => types.includes(provider.type));
  }

  /**
   * Get all available provider types
   */
  getAvailableProviderTypes(): string[] {
    return Array.from(ProviderConfiguration.AVAILABLE_PROVIDER_TYPES);
  }

  /**
   * Get only providers that support streaming
   */
  getStreamingProviders(container: Container): IProviderMetadata[] {
    const allProviders = this.getAllProviders(container);
    return allProviders.filter(provider => provider.capabilities.supportsStreaming);
  }

  /**
   * Get only core-integrated providers
   */
  getCoreProviders(container: Container): IProviderMetadata[] {
    const allProviders = this.getAllProviders(container);
    return allProviders.filter(provider => provider.isCore === true);
  }
}

/**
 * Default provider configuration instance
 */
export const providerConfiguration = new ProviderConfiguration();

/**
 * Utility functions for common provider operations
 */
export const ProviderConfigurationUtils = {
  /**
   * Get all provider configurations for DI container initialization
   */
  getAllProviderConfigurations(container: Container): IProviderMetadata[] {
    return providerConfiguration.getAllProviders(container);
  },

  /**
   * Get provider types that support streaming
   */
  getStreamingProviderTypes(): string[] {
    return providerConfiguration.getAvailableProviderTypes().filter(type => 
      type === ProviderType.GEMINI || type === ProviderType.CLAUDE
    );
  },

  /**
   * Check if a provider type is valid
   */
  isValidProviderType(type: string): boolean {
    return providerConfiguration.getAvailableProviderTypes().includes(type);
  },

  /**
   * Get default provider type
   */
  getDefaultProviderType(): string {
    return ProviderType.GEMINI; // Default to Gemini as it's core-integrated
  },

  /**
   * Get provider configuration by type
   */
  getProviderConfigByType(container: Container, type: string): IProviderMetadata | undefined {
    const allProviders = providerConfiguration.getAllProviders(container);
    return allProviders.find(provider => provider.type === type);
  }
};

/**
 * Provider Registry Initialization Helper
 * Used by the DI container to populate the ProviderRegistry
 */
export function initializeProvidersFromConfiguration(container: Container): IProviderMetadata[] {
  // Note: This function is called during DI container initialization
  // Logger may not be available yet, so we skip logging here
  const providers = ProviderConfigurationUtils.getAllProviderConfigurations(container);
  
  // Validate all providers have required properties
  providers.forEach(provider => {
    if (!provider.name || !provider.type || !provider.factory || !provider.capabilities) {
      throw new Error(`Invalid provider configuration for ${provider.name}: Missing required properties`);
    }
  });
  
  return providers;
}