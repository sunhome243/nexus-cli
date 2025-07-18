/**
 * Gemini Provider Configuration
 * Central configuration for Gemini provider
 */

import { IProviderMetadata } from "../../interfaces/core/IProviderRegistry.js";
import { IProviderFactorySimple } from "../../interfaces/core/IProviderFactorySimple.js";
import { IProvider } from "../../interfaces/core/IProvider.js";
import { TYPES } from "../../infrastructure/di/types.js";
import { ProviderType } from "../../abstractions/providers/index.js";

class GeminiProviderFactory implements IProviderFactorySimple {
  constructor(private container: any) {}

  create(): IProvider {
    return this.container.get(TYPES.GeminiProvider) as IProvider;
  }
}

export function createGeminiProviderConfigs(container: any): IProviderMetadata[] {
  return [
    {
      name: "gemini",
      type: ProviderType.GEMINI,
      displayName: "Gemini",
      description: "Google Gemini AI Assistant with Core Integration",
      capabilities: {
        supportsStreaming: true,
        supportsToolExecution: true,
        supportsSessionManagement: true,
        maxTokens: 1048576,
        supportedModels: [
          "gemini-2.5-pro-latest",
          "gemini-2.5-pro",
          "gemini-2.5-flash-latest",
          "gemini-2.5-flash",
          "gemini-pro",
        ],
        permissions: true,
      },
      factory: new GeminiProviderFactory(container),
      diSymbol: TYPES.GeminiProvider,
      defaultConfig: {
        model: "gemini-2.5-pro-latest",
        temperature: 0.7,
        maxTokens: 1048576,
        streaming: true,
        multimodal: true,
      },
      isCore: true,
    },
  ];
}
