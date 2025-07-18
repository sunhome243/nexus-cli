import { injectable } from "inversify";
import { IProviderSwitchService } from "../../interfaces/session/IProviderSwitchService";

@injectable()
export class MockProviderSwitchService implements IProviderSwitchService {
  private currentProvider = "claude";
  private switchHistory: Array<{ from: string; to: string; timestamp: Date }> = [];

  async initialize(syncEngine: any, providerManager?: any): Promise<void> {
    // Mock implementation
  }

  getCurrentProvider(): string {
    return this.currentProvider;
  }

  setCurrentProvider(provider: string): void {
    this.currentProvider = provider;
  }

  canSwitchProvider(toProvider: string): boolean {
    return toProvider === "claude" || toProvider === "gemini";
  }

  getSwitchHistory(): Array<{ from: string; to: string; timestamp: Date }> {
    return this.switchHistory;
  }

  async switchProvider(from: string, to: string, sessionId?: string): Promise<void> {
    if (!this.canSwitchProvider(to)) {
      throw new Error(`Invalid provider: ${to}`);
    }
    this.switchHistory.push({ from, to, timestamp: new Date() });
    this.currentProvider = to;
  }
}