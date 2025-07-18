/**
 * ClaudeSyncHandler - Adapter for ClaudeFileHandler to IProviderSyncHandler
 * Bridges the gap between FileHandler and the sync engine requirements
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../../infrastructure/di/types.js';
import { IProviderSyncHandler } from '../../../interfaces/sync/IProviderSyncHandler.js';
import { SyncMessage } from '../../../interfaces/sync/IDiffEngine.js';
import { ClaudeFileHandler } from '../handlers/ClaudeFileHandler.js';
import { ILoggerService } from '../../../interfaces/core/ILoggerService.js';
import { UniversalMessage } from '../types.js';

@injectable()
export class ClaudeSyncHandler implements IProviderSyncHandler {
  constructor(
    @inject(TYPES.LoggerService) private logger: ILoggerService,
    @inject(TYPES.ClaudeFileHandler) private fileHandler: ClaudeFileHandler
  ) {}

  async getBeforeFile(sessionId: string): Promise<string> {
    return this.fileHandler.getBeforeFile(sessionId);
  }

  async getAfterFile(sessionId: string): Promise<string> {
    return this.fileHandler.getAfterFile(sessionId);
  }

  async readConversation(filePath: string, sessionId?: string): Promise<SyncMessage[]> {
    const messages = await this.fileHandler.readConversation(filePath, sessionId);
    return this.convertUniversalToSyncMessages(messages);
  }

  async writeConversation(filePath: string, messages: SyncMessage[], sessionId?: string): Promise<void> {
    const universalMessages = this.convertSyncToUniversalMessages(messages);
    return this.fileHandler.writeConversation(filePath, universalMessages, sessionId);
  }

  /**
   * Convert UniversalMessage[] to SyncMessage[]
   */
  private convertUniversalToSyncMessages(messages: UniversalMessage[]): SyncMessage[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content.text || '',
      timestamp: new Date(msg.timestamp),
      id: msg.id,
      provider: msg.metadata.provider,
      metadata: msg.metadata.extra || {}
    }));
  }

  /**
   * Convert SyncMessage[] to UniversalMessage[]
   */
  private convertSyncToUniversalMessages(messages: SyncMessage[]): UniversalMessage[] {
    return messages.map((msg, index) => ({
      id: msg.id || `sync_${index}`,
      parentId: null,
      sessionId: 'sync_session',
      timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : new Date(msg.timestamp).toISOString(),
      role: msg.role as 'user' | 'assistant',
      type: 'message' as const,
      content: {
        text: msg.content
      },
      metadata: {
        provider: (msg.provider || 'claude') as any,
        extra: msg.metadata || {}
      }
    }));
  }

  async initializeState(sessionId: string): Promise<void> {
    return this.fileHandler.initializeState(sessionId);
  }

  async updateAfterSync(sessionId: string): Promise<void> {
    return this.fileHandler.updateAfterSync(sessionId);
  }

  async updateSessionTracking(sessionId: string): Promise<void> {
    return this.fileHandler.updateSessionTracking(sessionId);
  }

  async cleanup(): Promise<void> {
    // No cleanup needed for file handler
    this.logger.debug(`[ClaudeSyncHandler] cleanup called`);
  }
}