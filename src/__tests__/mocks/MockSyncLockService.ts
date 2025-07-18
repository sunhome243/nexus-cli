import { injectable } from "inversify";
import { ISyncLockService } from "../../interfaces/sync/ISyncLockService";

@injectable()
export class MockSyncLockService implements ISyncLockService {
  private locks = new Set<string>();
  private totalAcquired = 0;
  private totalReleased = 0;

  async acquire(sessionId: string, timeoutMs?: number): Promise<void> {
    if (this.locks.has(sessionId)) {
      throw new Error(`Lock already acquired for session: ${sessionId}`);
    }
    this.locks.add(sessionId);
    this.totalAcquired++;
  }

  async release(sessionId: string): Promise<void> {
    this.locks.delete(sessionId);
    this.totalReleased++;
  }

  isLocked(sessionId: string): boolean {
    return this.locks.has(sessionId);
  }

  getStats(): { activeLocks: number; totalAcquired: number; totalReleased: number; } {
    return {
      activeLocks: this.locks.size,
      totalAcquired: this.totalAcquired,
      totalReleased: this.totalReleased
    };
  }

  cleanupStaleLocks(): void {
    this.locks.clear();
  }
}