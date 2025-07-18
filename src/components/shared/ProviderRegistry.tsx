import React from "react";
import { ProviderType } from "../providers/types/index.js";
import { defaultNexusTheme } from "../../themes/NexusTheme.js";

export interface ProviderConfig {
  name: string;
  displayName: string;
  icon: string;
  theme: {
    primary: string;
    secondary: string;
    accent?: string;
  };
  capabilities: {
    supportsStreaming: boolean;
    supportsTools: boolean;
    supportsPermissions: boolean;
    supportsFiles: boolean;
    supportsCode: boolean;
  };
  features: {
    hasThinking: boolean;
    hasPermissionModes: boolean;
    hasToolExecution: boolean;
    hasFileOperations: boolean;
  };
  loadingPhrases: string[];
  spinnerType: "dots" | "dots2" | "line" | "bouncingBar";
}

const PROVIDER_CONFIGS: Record<ProviderType, ProviderConfig> = {
  [ProviderType.CLAUDE]: {
    name: "claude",
    displayName: "Claude",
    icon: "◇",
    theme: defaultNexusTheme.claude,
    capabilities: {
      supportsStreaming: true,
      supportsTools: true,
      supportsPermissions: true,
      supportsFiles: true,
      supportsCode: true,
    },
    features: {
      hasThinking: false,
      hasPermissionModes: true,
      hasToolExecution: true,
      hasFileOperations: true,
    },
    loadingPhrases: [
      "Processing",
      "Thinking",
      "Working",
      "Computing",
      "Analyzing",
      "Generating",
      "Preparing response",
      "Almost there",
    ],
    spinnerType: "dots",
  },
  [ProviderType.GEMINI]: {
    name: "gemini",
    displayName: "Gemini",
    icon: "◆",
    theme: defaultNexusTheme.gemini,
    capabilities: {
      supportsStreaming: true,
      supportsTools: true,
      supportsPermissions: true,
      supportsFiles: true,
      supportsCode: true,
    },
    features: {
      hasThinking: true,
      hasPermissionModes: true,
      hasToolExecution: true,
      hasFileOperations: true,
    },
    loadingPhrases: [
      "Thinking deeply",
      "Analyzing context",
      "Reasoning through problem",
      "Generating response",
      "Computing solution",
      "Processing information",
      "Preparing response",
      "Working through details",
    ],
    spinnerType: "dots2",
  },
};

export class ProviderRegistry {
  /**
   * Get configuration for a specific provider
   */
  static getConfig(provider: ProviderType): ProviderConfig {
    const config = PROVIDER_CONFIGS[provider];
    if (!config) {
      throw new Error(`No configuration found for provider: ${provider}`);
    }
    return config;
  }

  /**
   * Get all registered provider configurations
   */
  static getAllConfigs(): Record<ProviderType, ProviderConfig> {
    return { ...PROVIDER_CONFIGS };
  }

  /**
   * Get all supported provider types
   */
  static getSupportedProviders(): ProviderType[] {
    return Object.keys(PROVIDER_CONFIGS) as ProviderType[];
  }

  /**
   * Check if a provider is registered
   */
  static isProviderRegistered(provider: string): provider is ProviderType {
    return provider in PROVIDER_CONFIGS;
  }

  /**
   * Get theme colors for a provider
   */
  static getTheme(provider: ProviderType) {
    return this.getConfig(provider).theme;
  }

  /**
   * Get capabilities for a provider
   */
  static getCapabilities(provider: ProviderType) {
    return this.getConfig(provider).capabilities;
  }

  /**
   * Get features for a provider
   */
  static getFeatures(provider: ProviderType) {
    return this.getConfig(provider).features;
  }

  /**
   * Get display information for a provider
   */
  static getDisplayInfo(provider: ProviderType) {
    const config = this.getConfig(provider);
    return {
      name: config.displayName,
      icon: config.icon,
    };
  }

  /**
   * Get loading configuration for a provider
   */
  static getLoadingConfig(provider: ProviderType) {
    const config = this.getConfig(provider);
    return {
      phrases: config.loadingPhrases,
      spinnerType: config.spinnerType,
    };
  }

  /**
   * Check if provider supports a specific capability
   */
  static hasCapability(provider: ProviderType, capability: keyof ProviderConfig["capabilities"]): boolean {
    return this.getCapabilities(provider)[capability];
  }

  /**
   * Check if provider has a specific feature
   */
  static hasFeature(provider: ProviderType, feature: keyof ProviderConfig["features"]): boolean {
    return this.getFeatures(provider)[feature];
  }
}

export default ProviderRegistry;
