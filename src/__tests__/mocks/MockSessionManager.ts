import { injectable } from "inversify";
import { ISessionManager, ISessionInfo } from "../../interfaces/core/ISessionManager";

@injectable()
export class MockSessionManager implements ISessionManager {
  private isInit = false;
  private currentProvider = "claude";
  private currentSession: ISessionInfo | null = null;

  async initialize(): Promise<void> {
    this.isInit = true;
  }

  async switchProvider(provider: "claude" | "gemini"): Promise<void> {
    this.currentProvider = provider;
  }

  async createSession(tag: string): Promise<void> {
    this.currentSession = {
      id: `mock-${tag}`,
      tag,
      provider: this.currentProvider,
      timestamp: new Date(),
      isActive: true,
      messageCount: 0
    };
  }

  async resumeSession(tag: string): Promise<void> {
    // Mock implementation
  }

  getCurrentProvider(): string {
    return this.currentProvider;
  }

  async getCurrentSessionInfo(): Promise<ISessionInfo | null> {
    return this.currentSession;
  }

  getAvailableProviders(): string[] {
    return ["claude", "gemini"];
  }

  async sendMessage(message: string): Promise<any> {
    return { content: `Mock response to: ${message}` };
  }

  async streamMessage(message: string, callbacks: any): Promise<void> {
    if (callbacks.onChunk) callbacks.onChunk("Mock chunk");
    if (callbacks.onComplete) callbacks.onComplete({ content: `Mock response to: ${message}` });
  }

  supportsStreaming(): boolean {
    return true;
  }

  async triggerPostStreamingSync(): Promise<void> {
    // Mock implementation
  }

  async cleanup(): Promise<void> {
    this.isInit = false;
  }

  isInitialized(): boolean {
    return this.isInit;
  }
}