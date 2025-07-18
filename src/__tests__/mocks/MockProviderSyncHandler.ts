import { injectable } from "inversify";
import { IProviderSyncHandler } from "../../interfaces/sync/IProviderSyncHandler";

@injectable()
export class MockProviderSyncHandler implements IProviderSyncHandler {
  private conversations = new Map<string, any[]>();
  private files = new Map<string, string>();

  async updateSessionTracking(sessionId: string): Promise<void> {
    // Mock implementation
  }

  async initializeState(sessionId: string): Promise<void> {
    if (!this.conversations.has(sessionId)) {
      this.conversations.set(sessionId, []);
    }
  }

  async getBeforeFile(sessionId: string): Promise<string> {
    return `mock-before-${sessionId}.json`;
  }

  async getAfterFile(sessionId: string): Promise<string> {
    return `mock-after-${sessionId}.json`;
  }

  async readConversation(filePath: string, sessionId: string): Promise<any[]> {
    return this.conversations.get(sessionId) || [];
  }

  async writeConversation(filePath: string, messages: any[], sessionId: string): Promise<void> {
    this.conversations.set(sessionId, [...messages]);
    this.files.set(filePath, JSON.stringify(messages));
  }

  async updateAfterSync(sessionId: string): Promise<void> {
    // Mock implementation
  }

  async cleanup(): Promise<void> {
    this.conversations.clear();
    this.files.clear();
  }
}