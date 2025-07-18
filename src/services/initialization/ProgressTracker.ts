/**
 * Progress Tracker for Smooth Initialization Animation - Advanced progress visualization
 * 
 * @class ProgressTracker
 * @implements {IProgressTracker}
 * @description Manages weighted micro-tasks with virtual steps for continuous progress updates.
 * Provides smooth 60fps animations, parallel task coordination, and detailed progress reporting.
 */

import { globalAnimationManager } from "../../utils/GlobalAnimationManager.js";
import { ILoggerService } from "../../interfaces/core/ILoggerService.js";
import { IProgressTracker } from "../../interfaces/core/IProgressTracker.js";

export interface AnimatedTask {
  id: string;
  name: string;
  weight: number;
  estimatedDurationMs: number;
  virtualSteps: number;
  currentStep: number;
  startTime?: number;
  completed: boolean;
  children?: string[]; // IDs of child tasks for parallel execution
  error?: string;
}

export interface TaskDefinition {
  id: string;
  name: string;
  weight: number;
  estimatedDurationMs: number;
  children?: TaskDefinition[];
}

export interface ProgressUpdate {
  progress: number; // 0-1
  message: string;
  activeTasks: string[];
  completedTasks: string[];
}

/**
 * Progress Tracker implementation
 * 
 * @class ProgressTracker
 * @implements {IProgressTracker}
 * @description Advanced progress tracking with smooth animations and hierarchical task management.
 */
export class ProgressTracker implements IProgressTracker {
  private tasks: Map<string, AnimatedTask> = new Map();
  private activeAnimations: Map<string, NodeJS.Timeout> = new Map();
  private totalWeight: number = 0;
  private onProgressUpdate?: (update: ProgressUpdate) => void;
  private animationSubscriptionId?: string;
  private smoothedProgress: number = 0;
  private previousProgress: number = 0;
  private targetProgress: number = 0;
  private logger?: ILoggerService;

  /**
   * Create progress tracker with task definitions
   * 
   * @param {TaskDefinition[]} taskDefinitions - Hierarchical task structure
   * @param {(update: ProgressUpdate) => void} [onProgressUpdate] - Progress callback
   * @param {ILoggerService} [logger] - Optional logging service
   * @description Initializes progress tracking with weighted task hierarchy and smooth animation.
   */
  constructor(
    taskDefinitions: TaskDefinition[],
    onProgressUpdate?: (update: ProgressUpdate) => void,
    logger?: ILoggerService
  ) {
    this.onProgressUpdate = onProgressUpdate;
    this.logger = logger;
    this.initializeTasks(taskDefinitions);
    this.startSmoothAnimation();
  }

  /**
   * Initialize task hierarchy from definitions
   * 
   * @param {TaskDefinition[]} definitions - Task definitions to initialize
   * @param {string} [parentId] - Parent task ID for nested tasks
   * @description Recursively builds task hierarchy with weight calculation and virtual steps.
   * @private
   */
  private initializeTasks(definitions: TaskDefinition[], parentId?: string): void {
    for (const def of definitions) {
      // Limit virtual steps to 100 max to prevent performance issues with long tasks
      const virtualSteps = Math.min(Math.max(Math.floor(def.estimatedDurationMs / 50), 5), 100);

      const task: AnimatedTask = {
        id: def.id,
        name: def.name,
        weight: def.weight,
        estimatedDurationMs: def.estimatedDurationMs,
        virtualSteps,
        currentStep: 0,
        completed: false,
        children: def.children?.map((c) => c.id),
      };

      this.tasks.set(def.id, task);

      // Only add weight for leaf tasks (no children) to avoid double counting
      if (!def.children || def.children.length === 0) {
        this.totalWeight += def.weight;
      }

      if (def.children) {
        this.initializeTasks(def.children, def.id);
      }
    }
  }

  /**
   * Start smooth 60fps animation loop
   * 
   * @description Subscribes to global animation manager for smooth progress interpolation.
   * @private
   */
  private startSmoothAnimation(): void {
    // Use global animation manager for smooth 60fps updates
    this.animationSubscriptionId = `progress-tracker-${Date.now()}`;

    globalAnimationManager.subscribe(
      this.animationSubscriptionId,
      () => {
        // Smooth interpolation towards target progress
        const diff = this.targetProgress - this.smoothedProgress;
        const step = diff * 0.15; // 15% of difference per frame for smooth animation

        this.smoothedProgress = Math.min(this.smoothedProgress + step, this.targetProgress);

        this.emitProgressUpdate();
      },
      16
    ); // 60fps
  }

  /**
   * Start a task with animated progress
   * 
   * @param {string} taskId - Task identifier to start
   * @description Begins task execution with virtual step animation over estimated duration.
   */
  startTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task || task.completed) return;

    task.startTime = Date.now();
    task.currentStep = 0;

    // Clear any existing animation for this task
    const existingAnimation = this.activeAnimations.get(taskId);
    if (existingAnimation) {
      clearInterval(existingAnimation);
    }

    // Animate virtual steps over estimated duration
    // For very long tasks, update more frequently to show progress
    const stepDuration = Math.min(
      Math.max(task.estimatedDurationMs / task.virtualSteps, 10),
      500 // Max 500ms between updates for smooth progress on long tasks
    );

    const animationId = setInterval(() => {
      if (task.currentStep < task.virtualSteps) {
        task.currentStep++;
        this.updateTargetProgress();
      } else {
        clearInterval(animationId);
        this.activeAnimations.delete(taskId);
      }
    }, stepDuration);

    this.activeAnimations.set(taskId, animationId);
    this.updateTargetProgress();
  }

  /**
   * Complete a task immediately
   * 
   * @param {string} taskId - Task identifier to complete
   * @description Marks task as completed and updates progress immediately.
   */
  completeTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    // Mark as completed
    task.completed = true;
    task.currentStep = task.virtualSteps;

    // Clear any ongoing animation
    const animationId = this.activeAnimations.get(taskId);
    if (animationId) {
      clearInterval(animationId);
      this.activeAnimations.delete(taskId);
    }

    this.updateTargetProgress();

    // Log completion of major tasks
    if (task.weight > 0.1 && this.logger) {
      this.logger.info(`Completed major task: ${task.name}`, {
        component: "ProgressTracker",
        taskId,
        taskName: task.name,
        weight: task.weight,
      });
    }
  }

  /**
   * Start multiple tasks in parallel
   * 
   * @param {string[]} taskIds - Array of task identifiers to start
   * @description Starts all specified tasks simultaneously for parallel execution.
   */
  startParallelTasks(taskIds: string[]): void {
    // Start all tasks simultaneously
    taskIds.forEach((taskId) => this.startTask(taskId));
  }

  /**
   * Complete multiple tasks in parallel
   * 
   * @param {string[]} taskIds - Array of task identifiers to complete
   * @description Completes all specified tasks simultaneously.
   */
  completeParallelTasks(taskIds: string[]): void {
    // Complete all tasks
    taskIds.forEach((taskId) => this.completeTask(taskId));
  }

  /**
   * Update target progress based on task completion
   * 
   * @description Calculates weighted progress and updates animation target.
   * @private
   */
  private updateTargetProgress(): void {
    let totalProgress = 0;
    let leafTaskCount = 0;

    for (const [_, task] of this.tasks) {
      // Only count leaf tasks (no children)
      const isLeafTask = !task.children || task.children.length === 0;

      if (isLeafTask) {
        leafTaskCount++;
        if (task.completed) {
          totalProgress += task.weight;
        } else if (task.currentStep > 0) {
          // Partial progress for active tasks
          const taskProgress = (task.currentStep / task.virtualSteps) * task.weight;
          totalProgress += taskProgress;
        }
      }
    }

    this.targetProgress = Math.min(totalProgress / this.totalWeight, 1.0);

    // Debug logging
    if (this.targetProgress > 0.95 && this.logger) {
      this.logger.debug(`High progress: ${(this.targetProgress * 100).toFixed(2)}%`, {
        component: "ProgressTracker",
        targetProgress: this.targetProgress,
        totalProgress: totalProgress.toFixed(4),
        totalWeight: this.totalWeight.toFixed(4),
        leafTaskCount,
      });
    }
  }

  /**
   * Emit progress update to callback
   * 
   * @description Generates progress message and calls update callback with current state.
   * @private
   */
  private emitProgressUpdate(): void {
    if (!this.onProgressUpdate) return;

    const activeTasks: string[] = [];
    const completedTasks: string[] = [];

    for (const [taskId, task] of this.tasks) {
      if (task.completed) {
        completedTasks.push(taskId);
      } else if (task.currentStep > 0 && task.currentStep < task.virtualSteps) {
        activeTasks.push(taskId);
      }
    }

    // Generate progress message based on active tasks
    let message = "Initializing...";
    if (activeTasks.length > 0) {
      const activeNames = activeTasks
        .map((id) => this.tasks.get(id)?.name)
        .filter(Boolean)
        .slice(0, 3); // Show max 3 active tasks

      if (activeNames.length === 1) {
        message = activeNames[0]!;
      } else if (activeNames.length > 1) {
        message = `Initializing: ${activeNames.join(", ")}${activeTasks.length > 3 ? "..." : ""}`;
      }
    } else if (this.smoothedProgress >= 0.95) {
      message = "Finalizing...";
    }

    this.onProgressUpdate({
      progress: this.smoothedProgress,
      message,
      activeTasks,
      completedTasks,
    });
  }

  /**
   * Get current smoothed progress
   * 
   * @returns {number} Current progress value (0-1)
   * @description Returns smoothly interpolated progress value.
   */
  getProgress(): number {
    return this.smoothedProgress;
  }

  /**
   * Get currently active task IDs
   * 
   * @returns {string[]} Array of active task identifiers
   * @description Returns tasks that are started but not completed.
   */
  getActiveTasks(): string[] {
    const active: string[] = [];
    for (const [taskId, task] of this.tasks) {
      if (!task.completed && task.currentStep > 0) {
        active.push(taskId);
      }
    }
    return active;
  }

  /**
   * Clean up progress tracker resources
   * 
   * @description Clears animations and unsubscribes from global animation manager.
   */
  cleanup(): void {
    // Clear all animations
    for (const animationId of this.activeAnimations.values()) {
      clearInterval(animationId);
    }
    this.activeAnimations.clear();

    // Unsubscribe from global animation manager
    if (this.animationSubscriptionId) {
      globalAnimationManager.unsubscribe(this.animationSubscriptionId);
    }
  }

  /**
   * Mark task as failed
   * 
   * @param {string} taskId - Task identifier that failed
   * @param {Error | string} [error] - Optional error information
   * @description Marks task as completed with error state.
   */
  failTask(taskId: string, error?: Error | string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.completed = true;
      task.error = error instanceof Error ? error.message : error;
      this.completeTask(taskId);
    }
  }

  /**
   * Update progress for a specific task
   * 
   * @param {string} taskId - Task identifier to update
   * @param {number} progress - Progress value (0-1)
   * @param {string} [message] - Optional progress message
   * @description Updates task progress without completing it.
   */
  updateTaskProgress(taskId: string, progress: number, message?: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.currentStep = Math.round(progress * task.virtualSteps);
      if (message) {
        task.name = message;
      }
      this.emitProgressUpdate();
    }
  }

  /**
   * Check if task exists
   * 
   * @param {string} taskId - Task identifier to check
   * @returns {boolean} True if task exists
   * @description Validates task existence in the tracker.
   */
  hasTask(taskId: string): boolean {
    return this.tasks.has(taskId);
  }

  /**
   * Get progress for a specific task
   * 
   * @param {string} taskId - Task identifier
   * @returns {number | undefined} Task progress (0-1) or undefined if not found
   * @description Retrieves current progress for specified task.
   */
  getTaskProgress(taskId: string): number | undefined {
    const task = this.tasks.get(taskId);
    return task ? task.currentStep / task.virtualSteps : undefined;
  }

  /**
   * Clear all tasks and reset tracker
   * 
   * @description Removes all tasks and resets progress tracker to initial state.
   */
  clearAllTasks(): void {
    this.tasks.clear();
    this.activeAnimations.forEach((timeout) => clearInterval(timeout));
    this.activeAnimations.clear();
    this.totalWeight = 0;
    this.smoothedProgress = 0;
    this.previousProgress = 0;
  }
}

// Task definitions for the initialization process
// Based on actual timing: ~13.6s total (App: 0.1s, Providers: 4s, Sessions: 9.6s, Final: 0.1s)
export const initializationTasks: TaskDefinition[] = [
  {
    id: "app.init",
    name: "Starting Nexus",
    weight: 0.03, // 3% - make initial steps more visible
    estimatedDurationMs: 400,
    children: [
      { id: "app.init.start", name: "Checking initialization state", weight: 0.005, estimatedDurationMs: 70 },
      { id: "app.init.validate", name: "Validating dependencies", weight: 0.008, estimatedDurationMs: 110 },
      { id: "app.init.logger", name: "Setting up logger", weight: 0.007, estimatedDurationMs: 100 },
      { id: "app.init.model", name: "Initializing model service", weight: 0.01, estimatedDurationMs: 120 },
    ],
  },
  {
    id: "core.services",
    name: "Core services",
    weight: 0.94, // 94% of total time
    estimatedDurationMs: 13200,
    children: [
      {
        id: "session.manager",
        name: "Session Manager",
        weight: 0.93,
        estimatedDurationMs: 13000,
        children: [
          { id: "session.start", name: "Starting session manager", weight: 0.005, estimatedDurationMs: 70 },
          {
            id: "provider.manager",
            name: "Provider Manager",
            weight: 0.3, // 30% for provider init (4s of 13.6s)
            estimatedDurationMs: 4000,
            children: [
              { id: "pm.registry", name: "Creating registry", weight: 0.01, estimatedDurationMs: 140 },
              {
                id: "pm.providers.create",
                name: "Creating provider instances",
                weight: 0.01,
                estimatedDurationMs: 140,
              },
              {
                id: "pm.providers.init",
                name: "Initializing providers",
                weight: 0.27, // Most of provider manager time
                estimatedDurationMs: 3600,
                children: [
                  {
                    id: "claude.init",
                    name: "Claude Provider",
                    weight: 0.04, // Claude init (~500ms)
                    estimatedDurationMs: 500,
                    children: [
                      { id: "claude.session", name: "Claude session service", weight: 0.008, estimatedDurationMs: 100 },
                      { id: "claude.process", name: "Claude process service", weight: 0.008, estimatedDurationMs: 100 },
                      {
                        id: "claude.permission",
                        name: "Claude permission service",
                        weight: 0.008,
                        estimatedDurationMs: 100,
                      },
                      {
                        id: "claude.streaming",
                        name: "Claude streaming service",
                        weight: 0.008,
                        estimatedDurationMs: 100,
                      },
                      { id: "claude.error", name: "Claude error handler", weight: 0.008, estimatedDurationMs: 100 },
                    ],
                  },
                  {
                    id: "gemini.init",
                    name: "Gemini Provider",
                    weight: 0.23, // Gemini takes longer (~3.1s)
                    estimatedDurationMs: 3100,
                    children: [
                      {
                        id: "gemini.services",
                        name: "Gemini services",
                        weight: 0.01,
                        estimatedDurationMs: 140,
                        children: [
                          { id: "gemini.streaming", name: "Gemini streaming", weight: 0.002, estimatedDurationMs: 25 },
                          { id: "gemini.tools", name: "Gemini tools", weight: 0.002, estimatedDurationMs: 25 },
                          { id: "gemini.quota", name: "Gemini quota", weight: 0.002, estimatedDurationMs: 25 },
                          { id: "gemini.session", name: "Gemini session", weight: 0.002, estimatedDurationMs: 25 },
                          { id: "gemini.model", name: "Gemini model", weight: 0.002, estimatedDurationMs: 25 },
                          { id: "gemini.error", name: "Gemini error handler", weight: 0.0, estimatedDurationMs: 15 },
                        ],
                      },
                      {
                        id: "gemini.core",
                        name: "Gemini Core",
                        weight: 0.22, // Most time spent here (auth, client init)
                        estimatedDurationMs: 2960,
                        children: [
                          { id: "gemini.config", name: "Creating config", weight: 0.02, estimatedDurationMs: 270 },
                          {
                            id: "gemini.auth",
                            name: "Checking authentication",
                            weight: 0.08,
                            estimatedDurationMs: 1100,
                          },
                          { id: "gemini.client", name: "Initializing client", weight: 0.08, estimatedDurationMs: 1100 },
                          {
                            id: "gemini.registry",
                            name: "Setting up tool registry",
                            weight: 0.02,
                            estimatedDurationMs: 270,
                          },
                          {
                            id: "gemini.checkpoint",
                            name: "Checkpoint wrapper",
                            weight: 0.02,
                            estimatedDurationMs: 220,
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              { id: "pm.detect", name: "Detecting available providers", weight: 0.01, estimatedDurationMs: 140 },
            ],
          },
          {
            id: "session.services",
            name: "Session Creation",
            weight: 0.005,
            estimatedDurationMs: 70,
            children: [
              { id: "session.registry", name: "Initializing registry", weight: 0.002, estimatedDurationMs: 30 },
              { id: "session.check", name: "Checking providers", weight: 0.001, estimatedDurationMs: 15 },
              { id: "session.switch", name: "Switch service", weight: 0.002, estimatedDurationMs: 25 },
            ],
          },
          {
            id: "session.creation",
            name: "Creating Sessions",
            weight: 0.6, // 60% - the main bottleneck, now broken down
            estimatedDurationMs: 8200,
            children: [
              { id: "session.claude.create", name: "Creating Claude session", weight: 0.4, estimatedDurationMs: 5400 }, // 40% (7.4s of 13.6s)
              { id: "session.gemini.create", name: "Creating Gemini session", weight: 0.2, estimatedDurationMs: 2800 }, // 20% (2.2s of 13.6s)
            ],
          },
        ],
      },
      { id: "mcp.monitor", name: "MCP monitoring", weight: 0.01, estimatedDurationMs: 140 },
    ],
  },
  {
    id: "finalize",
    name: "Finalizing",
    weight: 0.03, // 3% - make final steps more visible
    estimatedDurationMs: 400,
    children: [
      { id: "final.permission", name: "Syncing permissions", weight: 0.01, estimatedDurationMs: 140 },
      { id: "final.state", name: "Updating state", weight: 0.01, estimatedDurationMs: 140 },
      { id: "final.complete", name: "Ready!", weight: 0.01, estimatedDurationMs: 120 },
    ],
  },
];
