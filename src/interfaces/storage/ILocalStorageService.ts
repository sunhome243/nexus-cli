/**
 * Local Storage Service Interface
 * Defines the contract for localStorage operations
 */

export interface ILocalStorageService {
  /**
   * Get item from localStorage with JSON parsing
   */
  getItem<T>(key: string, defaultValue?: T): T | null;
  
  /**
   * Set item in localStorage with JSON serialization
   */
  setItem<T>(key: string, value: T): boolean;
  
  /**
   * Remove item from localStorage
   */
  removeItem(key: string): boolean;
  
  /**
   * Clear all localStorage data
   */
  clear(): boolean;
  
  /**
   * Check if localStorage is available
   */
  isAvailable(): boolean;
}