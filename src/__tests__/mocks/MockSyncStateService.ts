import { injectable } from "inversify";
import { ISyncStateService, ISyncState } from "../../interfaces/sync/ISyncStateService";

@injectable()
export class MockSyncStateService implements ISyncStateService {
  private states = new Map<string, ISyncState>();

  async initializeState(sessionId: string): Promise<void> {
    this.states.set(sessionId, {
      sessionId,
      lastSyncTimestamp: new Date(),
      geminiVersion: "1.0",
      claudeVersion: "1.0",
      messageCount: 0,
      status: 'pending',
      sessionTag: sessionId,
      lastSyncTime: Date.now(),
      gemini: {
        backupPath: '',
        lastBackupTime: 0
      },
      claude: {
        lastSessionId: '',
        currentSessionId: sessionId,
        lastSyncTime: 0
      }
    });
  }

  async getState(sessionId: string): Promise<ISyncState | null> {
    return this.states.get(sessionId) || null;
  }

  async updateState(sessionId: string, updates: Partial<ISyncState>): Promise<void> {
    const current = this.states.get(sessionId);
    if (current) {
      this.states.set(sessionId, { ...current, ...updates });
    }
  }

  async listStates(): Promise<ISyncState[]> {
    return Array.from(this.states.values());
  }

  async removeState(sessionId: string): Promise<void> {
    this.states.delete(sessionId);
  }

  async hasState(sessionId: string): Promise<boolean> {
    return this.states.has(sessionId);
  }

  // Extended methods
  async getSyncState(sessionTag: string): Promise<ISyncState> {
    const state = Array.from(this.states.values()).find(s => s.sessionTag === sessionTag);
    if (!state) {
      throw new Error(`No sync state found for session tag: ${sessionTag}`);
    }
    return state;
  }

  async updateSyncState(sessionTag: string, state: ISyncState): Promise<void> {
    const existing = Array.from(this.states.values()).find(s => s.sessionTag === sessionTag);
    if (existing) {
      this.states.set(existing.sessionId, state);
    } else {
      this.states.set(state.sessionId, state);
    }
  }

  async updateClaudeSession(sessionTag: string, currentSessionId: string): Promise<void> {
    const state = await this.getSyncState(sessionTag);
    state.claude.currentSessionId = currentSessionId;
    await this.updateSyncState(sessionTag, state);
  }

  async initializeClaudeSession(sessionTag: string, sessionId: string): Promise<void> {
    await this.initializeState(sessionId);
    const state = await this.getState(sessionId);
    if (state) {
      state.sessionTag = sessionTag;
      state.claude.currentSessionId = sessionId;
      await this.updateState(sessionId, state);
    }
  }

  async markSyncCompleted(sessionTag: string, sessionId: string): Promise<void> {
    const state = await this.getSyncState(sessionTag);
    state.claude.lastSessionId = state.claude.currentSessionId;
    state.claude.lastSyncTime = Date.now();
    state.lastSyncTime = Date.now();
    state.lastSyncTimestamp = new Date();
    state.status = 'synced';
    await this.updateSyncState(sessionTag, state);
  }

  async updateGeminiBackup(sessionTag: string, backupPath: string): Promise<void> {
    const state = await this.getSyncState(sessionTag);
    state.gemini.backupPath = backupPath;
    state.gemini.lastBackupTime = Date.now();
    await this.updateSyncState(sessionTag, state);
  }

  async listSyncStates(): Promise<ISyncState[]> {
    return this.listStates();
  }

  async removeSyncState(sessionTag: string): Promise<void> {
    const state = Array.from(this.states.values()).find(s => s.sessionTag === sessionTag);
    if (state) {
      await this.removeState(state.sessionId);
    }
  }
}