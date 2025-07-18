import { injectable } from "inversify";
import { IProviderManager } from "../../interfaces/session/IProviderManager";

@injectable()
export class MockProviderManager implements IProviderManager {
  private availableProviders = ["claude", "gemini"];
  private sessionTag = "";

  async initialize(): Promise<void> {
    // Mock implementation
  }

  isProviderAvailable(provider: string): boolean {
    return this.availableProviders.includes(provider);
  }

  getProvider(provider: "claude" | "gemini"): any {
    return {
      sendMessage: async (message: string) => ({ content: `Mock response to: ${message}` })
    };
  }

  getStreamingProvider(provider: "claude" | "gemini"): any {
    return {
      streamMessage: async (message: string, callbacks: any) => {
        if (callbacks.onChunk) callbacks.onChunk("Mock chunk");
        if (callbacks.onComplete) callbacks.onComplete({ content: `Mock streamed response to: ${message}` });
      }
    };
  }

  getAvailableProviders(): string[] {
    return this.availableProviders;
  }

  supportsStreaming(provider: "claude" | "gemini"): boolean {
    return true;
  }

  setSessionTag(tag: string): void {
    this.sessionTag = tag;
  }

  async cleanup(): Promise<void> {
    // Mock implementation
  }

  /**
   * Get the mock registry for external access
   */
  getRegistry(): any {
    return {
      // Mock registry implementation
      registerSession: () => {},
      getSession: () => null,
      removeSession: () => {},
    };
  }

}