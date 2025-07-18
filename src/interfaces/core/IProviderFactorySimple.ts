/**
 * Simple Provider Factory Interface
 * Minimal factory interface for provider creation
 */

import { IProvider } from './IProvider.js';

export interface IProviderFactorySimple {
  /**
   * Creates a provider instance
   */
  create(): IProvider;
}