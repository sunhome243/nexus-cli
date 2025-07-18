/**
 * Process Tracker Utility
 * Securely tracks and manages spawned processes without shell commands
 */

import * as fs from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import * as path from 'node:path';
import { LoggerService } from '../services/core/LoggerService.js';
import { LogLevel } from '../interfaces/core/ILoggerService.js';

/**
 * Tracked process interface
 */
export interface TrackedProcess {
  pid: number;
  name: string;
  startTime: number;
}

/**
 * Secure process tracking to replace pkill commands
 * 
 * @class ProcessTracker
 * @description Singleton class for tracking and managing spawned processes
 */
export class ProcessTracker {
  private static instance: ProcessTracker | null = null;
  private trackedProcesses = new Map<string, Set<number>>();
  private logger = new LoggerService();

  private constructor() {}

  /**
   * Get the singleton instance of ProcessTracker
   * 
   * @returns {ProcessTracker} The singleton instance
   */
  static getInstance(): ProcessTracker {
    if (!ProcessTracker.instance) {
      ProcessTracker.instance = new ProcessTracker();
    }
    return ProcessTracker.instance;
  }

  /**
   * Register a process for tracking
   * 
   * @param {string} processName - Name of the process to track
   * @param {number} pid - Process ID to track
   * @returns {void}
   */
  trackProcess(processName: string, pid: number): void {
    if (!this.trackedProcesses.has(processName)) {
      this.trackedProcesses.set(processName, new Set());
    }
    this.trackedProcesses.get(processName)!.add(pid);
  }

  /**
   * Unregister a process from tracking
   * 
   * @param {string} processName - Name of the process to untrack
   * @param {number} pid - Process ID to untrack
   * @returns {void}
   */
  untrackProcess(processName: string, pid: number): void {
    const processes = this.trackedProcesses.get(processName);
    if (processes) {
      processes.delete(pid);
      if (processes.size === 0) {
        this.trackedProcesses.delete(processName);
      }
    }
  }

  /**
   * Get all tracked PIDs for a process name
   * 
   * @param {string} processName - Name of the process to get PIDs for
   * @returns {number[]} Array of tracked PIDs
   */
  getTrackedPids(processName: string): number[] {
    const processes = this.trackedProcesses.get(processName);
    return processes ? Array.from(processes) : [];
  }

  /**
   * Kill all tracked processes for a given name
   * Replaces pkill functionality with tracked PIDs
   * 
   * @param {string} processName - Name of the process to kill
   * @returns {Promise<void>}
   */
  async killTrackedProcesses(processName: string): Promise<void> {
    const pids = this.getTrackedPids(processName);
    
    for (const pid of pids) {
      try {
        // Check if process is still running
        if (this.isProcessRunning(pid)) {
          // Graceful shutdown first
          process.kill(pid, 'SIGTERM');
          
          // Wait a bit for graceful shutdown
          await this.delay(1000);
          
          // Force kill if still running
          if (this.isProcessRunning(pid)) {
            process.kill(pid, 'SIGKILL');
          }
        }
        
        // Remove from tracking
        this.untrackProcess(processName, pid);
      } catch (error) {
        // Process might already be dead, that's fine
        this.untrackProcess(processName, pid);
      }
    }
  }

  /**
   * Check if a process is still running
   * 
   * @private
   * @param {number} pid - Process ID to check
   * @returns {boolean} True if process is running
   */
  private isProcessRunning(pid: number): boolean {
    try {
      // Sending signal 0 doesn't actually send a signal, just checks if process exists
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Utility delay function
   * 
   * @private
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get all tracked processes (for debugging)
   * 
   * @returns {Map<string, Set<number>>} Map of process names to PIDs
   */
  getAllTrackedProcesses(): Map<string, Set<number>> {
    return new Map(this.trackedProcesses);
  }

  /**
   * Clear all tracked processes
   * 
   * @returns {void}
   */
  clearAllTracked(): void {
    this.trackedProcesses.clear();
  }
}

/**
 * Secure file cleanup to replace rm commands
 * 
 * @class FileCleanupUtil
 * @description Utility class for secure file cleanup operations
 */
export class FileCleanupUtil {
  private static logger = new LoggerService();

  /**
   * Clean up socket files by pattern matching
   * Replaces rm -f /tmp/mcp-permission-*.sock functionality
   * 
   * @static
   * @param {string} socketDir - Directory to search for socket files
   * @param {string[]} patterns - Array of patterns to match
   * @returns {Promise<void>}
   */
  static async cleanupSocketFiles(socketDir: string = '/tmp', patterns: string[]): Promise<void> {
    try {
      const files = await readdir(socketDir);
      
      for (const file of files) {
        // Check if file matches any of the patterns
        const matchesPattern = patterns.some(pattern => {
          // Convert shell glob pattern to regex
          const regexPattern = pattern
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
          const regex = new RegExp(`^${regexPattern}$`);
          return regex.test(file);
        });

        if (matchesPattern) {
          const filePath = path.join(socketDir, file);
          try {
            await fs.unlink(filePath);
          } catch (error) {
            // File might not exist or permission denied, continue with others
            FileCleanupUtil.logger.warn(`Failed to delete ${filePath}`, { error, filePath });
          }
        }
      }
    } catch (error) {
      // Directory might not exist, that's fine
      FileCleanupUtil.logger.warn(`Failed to read directory ${socketDir}`, { error, socketDir });
    }
  }

  /**
   * Clean up MCP permission socket files
   * 
   * @static
   * @returns {Promise<void>}
   */
  static async cleanupMCPPermissionSockets(): Promise<void> {
    await FileCleanupUtil.cleanupSocketFiles('/tmp', ['mcp-permission-*.sock']);
  }

  /**
   * Clean up all MCP socket files (permission + askmodel)
   * 
   * @static
   * @returns {Promise<void>}
   */
  static async cleanupAllMCPSockets(): Promise<void> {
    await FileCleanupUtil.cleanupSocketFiles('/tmp', [
      'mcp-permission-*.sock',
      'mcp-askmodel-*.sock'
    ]);
  }
}