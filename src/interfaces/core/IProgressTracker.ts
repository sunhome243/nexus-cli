/**
 * Progress Tracker Interface
 * Provides type-safe progress tracking for long-running operations
 */

export interface IProgressTracker {
  /**
   * Start tracking a task
   */
  startTask(taskId: string, description?: string): void;
  
  /**
   * Complete a task (success)
   */
  completeTask(taskId: string): void;
  
  /**
   * Fail a task
   */
  failTask(taskId: string, error?: Error | string): void;
  
  /**
   * Update task progress
   */
  updateTaskProgress(taskId: string, progress: number, message?: string): void;
  
  /**
   * Check if a task is being tracked
   */
  hasTask(taskId: string): boolean;
  
  /**
   * Get current progress for a task
   */
  getTaskProgress(taskId: string): number | undefined;
  
  /**
   * Get all active tasks
   */
  getActiveTasks(): string[];
  
  /**
   * Clear all tasks
   */
  clearAllTasks(): void;
}

/**
 * Progress update information
 */
export interface ProgressUpdate {
  taskId: string;
  progress: number;
  message?: string;
  timestamp: Date;
}

/**
 * Task information
 */
export interface TaskInfo {
  taskId: string;
  description?: string;
  progress: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
  startTime: Date;
  endTime?: Date;
}