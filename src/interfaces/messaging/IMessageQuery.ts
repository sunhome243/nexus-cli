/**
 * Message Query Interfaces
 * Defines query contracts for message processing pipeline
 */

import { IProviderMessage } from '../core/IProvider.js';

export interface IMessageQuery {
  queryId: string;
  timestamp: Date;
}

export interface IGetMessageHistoryQuery extends IMessageQuery {
  sessionId: string;
  limit?: number;
  offset?: number;
  provider?: string;
}

export interface IGetStreamingStatusQuery extends IMessageQuery {
  sessionId: string;
}

export interface IValidateMessageQuery extends IMessageQuery {
  content: string;
  provider: string;
}

export interface IMessageHistoryResult {
  messages: IProviderMessage[];
  totalCount: number;
  hasMore: boolean;
}

export interface IStreamingStatusResult {
  isStreaming: boolean;
  currentProvider: string;
  streamingStartTime?: Date;
}

export interface IValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Provider-specific validation rule definition
 */
export interface IProviderValidationRule {
  /** Provider type this rule applies to */
  providerType: string;
  /** Maximum recommended message length for optimal performance */
  maxOptimalLength?: number;
  /** Custom validation function */
  validate: (content: string, errors: string[], warnings: string[]) => void;
}

/**
 * Validation registry for managing provider-specific validation rules
 */
export interface IValidationRegistry {
  /** Register a validation rule for a provider */
  registerValidationRule(rule: IProviderValidationRule): void;
  /** Get validation rule for a provider */
  getValidationRule(providerType: string): IProviderValidationRule | undefined;
  /** Get all registered provider types */
  getRegisteredProviderTypes(): string[];
}