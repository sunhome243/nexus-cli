/**
 * Sync Lock Service Implementation - Concurrency control for sync operations
 * 
 * @class SyncLockService
 * @implements {ISyncLockService}
 * @description Manages synchronization locks to prevent concurrent operations.
 * Provides session-level locking with timeout and expiration mechanisms.
 */

import { injectable } from 'inversify';
import { ISyncLockService } from '../../../interfaces/sync/ISyncLockService.js';

/**
 * Lock information interface
 */
interface LockInfo {
  sessionId: string;
  timestamp: Date;
  expiresAt: Date;
}

/**
 * Sync Lock Service implementation
 * 
 * @class SyncLockService
 * @implements {ISyncLockService}
 * @description Provides thread-safe synchronization locking for session-based operations.
 * Prevents race conditions during cross-provider synchronization.
 */
@injectable()
export class SyncLockService implements ISyncLockService {
  private locks: Map<string, LockInfo> = new Map();
  private stats = {
    totalAcquired: 0,
    totalReleased: 0
  };

  async acquire(sessionId: string, timeoutMs: number = 30000): Promise<void> {
    if (this.isLocked(sessionId)) {
      throw new Error(`Session ${sessionId} is already locked`);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + timeoutMs);
    
    this.locks.set(sessionId, {
      sessionId,
      timestamp: now,
      expiresAt
    });
    
    this.stats.totalAcquired++;
  }

  async release(sessionId: string): Promise<void> {
    if (!this.locks.has(sessionId)) {
      throw new Error(`No lock found for session ${sessionId}`);
    }
    
    this.locks.delete(sessionId);
    this.stats.totalReleased++;
  }

  isLocked(sessionId: string): boolean {
    const lock = this.locks.get(sessionId);
    if (!lock) return false;
    
    // Check if lock has expired
    if (new Date() > lock.expiresAt) {
      this.locks.delete(sessionId);
      return false;
    }
    
    return true;
  }

  getStats(): { activeLocks: number; totalAcquired: number; totalReleased: number } {
    // Clean up expired locks before reporting
    this.cleanupStaleLocks();
    
    return {
      activeLocks: this.locks.size,
      totalAcquired: this.stats.totalAcquired,
      totalReleased: this.stats.totalReleased
    };
  }

  cleanupStaleLocks(): void {
    const now = new Date();
    const expiredSessions: string[] = [];
    
    for (const [sessionId, lock] of this.locks.entries()) {
      if (now > lock.expiresAt) {
        expiredSessions.push(sessionId);
      }
    }
    
    for (const sessionId of expiredSessions) {
      this.locks.delete(sessionId);
    }
  }
}