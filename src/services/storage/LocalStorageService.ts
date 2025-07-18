/**
 * Local Storage Service
 * Provides standardized localStorage access with consistent error handling and fallbacks
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../infrastructure/di/types.js';
import { ILoggerService } from '../../interfaces/core/ILoggerService.js';
import { ILocalStorageService } from '../../interfaces/storage/ILocalStorageService.js';

@injectable()
export class LocalStorageService implements ILocalStorageService {
  private isStorageAvailable: boolean;
  
  constructor(@inject(TYPES.LoggerService) private logger: ILoggerService) {
    this.isStorageAvailable = this.checkStorageAvailability();
  }
  
  /**
   * Check if localStorage is available in the current environment
   */
  private checkStorageAvailability(): boolean {
    try {
      if (typeof localStorage === 'undefined') {
        return false;
      }
      
      // Test if we can actually write to localStorage
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get item from localStorage with JSON parsing
   */
  getItem<T>(key: string, defaultValue?: T): T | null {
    if (!this.isStorageAvailable) {
      return defaultValue ?? null;
    }
    
    try {
      const item = localStorage.getItem(key);
      if (item === null) {
        return defaultValue ?? null;
      }
      
      return JSON.parse(item) as T;
    } catch (error) {
      this.logger.warn(`Failed to get item from localStorage (key: ${key}):`, { key, error });
      return defaultValue ?? null;
    }
  }
  
  /**
   * Set item in localStorage with JSON serialization
   */
  setItem<T>(key: string, value: T): boolean {
    if (!this.isStorageAvailable) {
      return false;
    }
    
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      this.logger.warn(`Failed to set item in localStorage (key: ${key}):`, { key, error });
      return false;
    }
  }
  
  /**
   * Remove item from localStorage
   */
  removeItem(key: string): boolean {
    if (!this.isStorageAvailable) {
      return false;
    }
    
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      this.logger.warn(`Failed to remove item from localStorage (key: ${key}):`, { key, error });
      return false;
    }
  }
  
  /**
   * Clear all localStorage data
   */
  clear(): boolean {
    if (!this.isStorageAvailable) {
      return false;
    }
    
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      this.logger.warn('Failed to clear localStorage:', { error });
      return false;
    }
  }
  
  /**
   * Check if localStorage is available
   */
  isAvailable(): boolean {
    return this.isStorageAvailable;
  }
}