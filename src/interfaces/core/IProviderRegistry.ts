/**
 * Provider Registry Interface
 * Central registry for managing AI providers and their configurations
 */

import { IProvider, IProviderCapabilities } from './IProvider.js';
import { ProviderType } from '../../abstractions/providers/index.js';
import { IProviderFactorySimple } from './IProviderFactorySimple.js';

export interface IProviderMetadata {
  readonly name: string;
  readonly type: ProviderType;
  readonly displayName: string;
  readonly description: string;
  readonly capabilities: IProviderCapabilities;
  readonly factory: IProviderFactorySimple;
  readonly diSymbol: symbol;
  readonly defaultConfig?: Record<string, any>;
  readonly isCore?: boolean;
}

export interface IProviderRegistry {
  registerProvider(metadata: IProviderMetadata): void;
  
  getProvider(type: ProviderType): IProviderMetadata | undefined;
  
  hasProvider(type: ProviderType): boolean;
  
  listProviders(): IProviderMetadata[];
  
  getAvailableTypes(): ProviderType[];
  
  getStreamingProviders(): IProviderMetadata[];
  
  getProvidersByCapability(capability: keyof IProviderCapabilities): IProviderMetadata[];
  
  createProviderInstance(type: ProviderType): IProvider;
  
  clear(): void;
}