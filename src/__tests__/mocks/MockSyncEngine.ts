import { injectable } from "inversify";
import { ISyncEngine, ISyncResult, ISyncOperation } from "../../interfaces/core/ISyncEngine";

@injectable()
export class MockSyncEngine implements ISyncEngine {
  private operations: ISyncOperation[] = [];
  private isInitialized = false;

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async syncSession(sessionId: string, direction: 'bidirectional' | 'claude-to-gemini' | 'gemini-to-claude'): Promise<ISyncResult> {
    const operationId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const operation: ISyncOperation = {
      id: operationId,
      type: 'sync',
      sourceProvider: direction === 'claude-to-gemini' ? 'claude' : direction === 'gemini-to-claude' ? 'gemini' : 'both',
      targetProvider: direction === 'claude-to-gemini' ? 'gemini' : direction === 'gemini-to-claude' ? 'claude' : 'both',
      timestamp: new Date(),
      status: 'completed'
    };
    
    this.operations.push(operation);
    
    return {
      success: true,
      operationId,
      syncedItems: 1,
      errors: [],
      duration: 50
    };
  }

  async validateSyncState(sessionId: string): Promise<boolean> {
    // Mock always returns true (sync state is valid)
    return true;
  }

  getOperationHistory(): ISyncOperation[] {
    return [...this.operations];
  }

  async cleanup(): Promise<void> {
    this.operations = [];
    this.isInitialized = false;
  }

  async instantSync(sessionId: string, direction: string): Promise<ISyncResult> {
    const operationId = `instant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const operation: ISyncOperation = {
      id: operationId,
      type: 'sync',
      sourceProvider: 'auto',
      targetProvider: 'auto',
      timestamp: new Date(),
      status: 'completed'
    };
    
    this.operations.push(operation);
    
    return {
      success: true,
      operationId,
      syncedItems: 1,
      errors: [],
      duration: 25
    };
  }

  async hasChangesToSync(sessionId: string): Promise<boolean> {
    // Mock implementation - sometimes return true to simulate pending changes
    return Math.random() > 0.5;
  }
}