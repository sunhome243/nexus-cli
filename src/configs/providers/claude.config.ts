/**
 * Claude Provider Configuration
 * Central configuration for Claude and Claude Streaming providers
 */

import { IProviderMetadata } from "../../interfaces/core/IProviderRegistry.js";
import { IProviderFactorySimple } from "../../interfaces/core/IProviderFactorySimple.js";
import { IProvider } from "../../interfaces/core/IProvider.js";
import { TYPES } from "../../infrastructure/di/types.js";
import { ProviderType } from "../../abstractions/providers/index.js";

class ClaudeProviderFactory implements IProviderFactorySimple {
  constructor(private container: any) {}

  create(): IProvider {
    return this.container.get(TYPES.ClaudeProvider) as IProvider;
  }
}

export function createClaudeProviderConfigs(container: any): IProviderMetadata[] {
  return [
    {
      name: "claude",
      type: ProviderType.CLAUDE,
      displayName: "Claude",
      description: "Anthropic Claude with real-time streaming capabilities",
      capabilities: {
        supportsStreaming: true,
        supportsToolExecution: true,
        supportsSessionManagement: true,
        maxTokens: 200000,
        supportedModels: ["claude-4-opus", "claude-4-sonnet"],
        permissions: true,
      },
      factory: new ClaudeProviderFactory(container),
      diSymbol: TYPES.ClaudeProvider,
      defaultConfig: {
        model: "claude-4-sonnet",
        temperature: 0.7,
        maxTokens: 200000,
        streaming: true,
        permissionMode: "default",
      },
      isCore: false,
    },
  ];
}
