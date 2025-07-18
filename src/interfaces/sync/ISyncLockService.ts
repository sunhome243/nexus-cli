/**
 * Sync Lock Service Interface
 * Manages synchronization locks to prevent concurrent operations
 */

export interface ISyncLockService {
  /**
   * Acquire lock for a session
   */
  acquire(sessionId: string, timeoutMs?: number): Promise<void>;
  
  /**
   * Release lock for a session
   */
  release(sessionId: string): Promise<void>;
  
  /**
   * Check if session is locked
   */
  isLocked(sessionId: string): boolean;
  
  /**
   * Get lock statistics
   */
  getStats(): {
    activeLocks: number;
    totalAcquired: number;
    totalReleased: number;
  };
  
  /**
   * Cleanup stale locks
   */
  cleanupStaleLocks(): void;
}