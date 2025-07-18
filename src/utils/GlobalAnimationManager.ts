/**
 * Global Animation Manager
 * 
 * Centralizes all animations using a single RAF loop to improve performance
 * and reduce timer overhead during permission dialogs and tool execution.
 */

import { injectable } from 'inversify';

/**
 * Animation subscriber interface
 */
export interface AnimationSubscriber {
  id: string;
  callback: (frameTime: number) => void;
  interval: number; // ms between updates
  lastUpdate: number;
}

/**
 * Global animation manager interface
 */
export interface IGlobalAnimationManager {
  subscribe(id: string, callback: (frameTime: number) => void, interval?: number): void;
  unsubscribe(id: string): void;
  pause(): void;
  resume(): void;
}

/**
 * Global animation manager implementation
 * 
 * @class GlobalAnimationManager
 * @implements {IGlobalAnimationManager}
 * @description Centralizes all animations using a single RAF loop to improve performance
 */
@injectable()
class GlobalAnimationManager implements IGlobalAnimationManager {
  private subscribers: Map<string, AnimationSubscriber> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isPaused = false;
  private lastFrameTime = 0;

  /**
   * Subscribe to animation updates
   * 
   * @param {string} id - Unique identifier for the subscriber
   * @param {Function} callback - Function to call on each animation frame
   * @param {number} interval - Interval in milliseconds between updates (default: 16ms)
   * @returns {void}
   */
  subscribe(id: string, callback: (frameTime: number) => void, interval: number = 16): void {
    this.subscribers.set(id, {
      id,
      callback,
      interval,
      lastUpdate: 0
    });

    if (!this.isRunning) {
      this.start();
    }
  }

  /**
   * Unsubscribe from animation updates
   * 
   * @param {string} id - Unique identifier of the subscriber to remove
   * @returns {void}
   */
  unsubscribe(id: string): void {
    this.subscribers.delete(id);
    
    if (this.subscribers.size === 0) {
      this.stop();
    }
  }

  /**
   * Start the animation loop
   * 
   * @private
   * @returns {void}
   */
  private start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastFrameTime = Date.now();
    
    // Use setInterval with 16ms for smooth animation (60fps equivalent)
    this.intervalId = setInterval(this.animate, 16);
  }

  /**
   * Stop the animation loop
   * 
   * @private
   * @returns {void}
   */
  private stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  /**
   * Main animation loop using setInterval
   * 
   * @private
   * @returns {void}
   */
  private animate = (): void => {
    if (this.isPaused) return;
    
    const currentTime = Date.now();
    
    // Update subscribers based on their individual intervals
    this.subscribers.forEach((subscriber) => {
      if (currentTime - subscriber.lastUpdate >= subscriber.interval) {
        subscriber.callback(currentTime);
        subscriber.lastUpdate = currentTime;
      }
    });

    this.lastFrameTime = currentTime;
  };


  /**
   * Pause all animations (keeps subscribers but stops animation loop)
   * 
   * @returns {void}
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resume all animations
   * 
   * @returns {void}
   */
  resume(): void {
    this.isPaused = false;
  }
}

// Export class for DI
export { GlobalAnimationManager };

// Temporary singleton for backward compatibility - will be removed after DI migration
export const globalAnimationManager = new GlobalAnimationManager();