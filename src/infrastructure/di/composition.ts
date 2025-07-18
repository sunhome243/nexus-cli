/**
 * Container Composition Root
 * Composes all service containers into a single application container
 */

import 'reflect-metadata';
import { Container } from 'inversify';
import { configureCoreServices } from './core-container.js';
import { configureProviderServices, initializeProviderRegistry, initializeUsageTrackerRegistry } from './provider-container.js';
import { configureSyncServices } from './sync-container.js';
import { configureCommandServices } from './command-container.js';
import { configureToolServices } from './tool-container.js';
import { configurePermissionContainer } from './permission-container.js';
import { TYPES } from './types.js';
import { ILoggerService } from '../../interfaces/core/ILoggerService.js';
import { LoggerService } from '../../services/core/LoggerService.js';

/**
 * Create and configure the complete application container
 */
export function createApplicationContainer(): Container {
  const container = new Container();

  try {
    // Configure all service modules
    configureCoreServices(container);
    configureProviderServices(container);
    configureSyncServices(container);
    configureCommandServices(container);
    configureToolServices(container);
    configurePermissionContainer(container);

    // Initialize registries with configurations
    initializeProviderRegistry(container);
    initializeUsageTrackerRegistry(container);

    // Use logger service for logging
    const logger = container.get<ILoggerService>(TYPES.LoggerService);
    logger.info('🔧 Application container composed successfully');
    return container;
  } catch (error) {
    // Can't use injected logger here as container creation failed, use direct instance
    const fallbackLogger = new LoggerService();
    fallbackLogger.error('Failed to compose application container', { error });
    throw error;
  }
}

/**
 * Export the configured container instance
 */
export const container = createApplicationContainer();