/**
 * Provider Services Container
 * Handles all provider-related services and registries
 */

import { Container } from 'inversify';
import { TYPES } from './types.js';

// Import session services
import { ProviderManager } from '../../services/session/ProviderManager.js';
import { ProviderSwitchService } from '../../services/session/ProviderSwitchService.js';
import { SessionManager } from '../../services/session/SessionManager.js';

// Import provider services
import { GeminiProvider } from '../../services/providers/gemini/GeminiProvider.js';
import { ClaudeProvider } from '../../services/providers/claude/ClaudeProvider.js';

// Import Gemini services
import {
  GeminiQuotaService,
  GeminiSessionService,
  GeminiModelService,
  GeminiStreamingService,
  GeminiToolExecutionService,
  GeminiConfigurationService,
  GeminiCallbackAdapterService,
  GeminiBackupService,
  GeminiSessionManagementService
} from '../../services/providers/gemini/services/index.js';

// Import Claude services
import {
  ClaudeSessionService,
  ClaudeProcessService,
  ClaudePermissionService,
  ClaudeStreamingService
} from '../../services/providers/claude/services/index.js';
import { PermissionResponseService } from '../../services/providers/claude/services/PermissionResponseService.js';

// Import shared provider services  
import { ErrorHandlerService } from '../../services/providers/shared/ErrorHandlerService.js';

// Import factories and registries
import { ProviderFactory } from '../../services/factories/ProviderFactory.js';
import { ProviderRegistry } from '../../services/core/ProviderRegistry.js';
import { ModelService } from '../../services/core/ModelService.js';

// Import usage services
import { ClaudeUsageTracker } from '../../services/usage/external/ClaudeUsageTracker.js';
import { GeminiUsageTracker } from '../../services/usage/internal/GeminiUsageTracker.js';
import { UnifiedStatsService } from '../../services/usage/unified/UnifiedStatsService.js';
import { UiTelemetryService } from '@google/gemini-cli-core';
import { UsageTrackerRegistry } from '../../services/core/UsageTrackerRegistry.js';

// Import interfaces
import { ISessionManager } from '../../interfaces/index.js';
import { IProviderManager, IProviderSwitchService } from '../../interfaces/session/index.js';
import { IProviderFactory } from '../../interfaces/core/IProviderFactory.js';
import { IProviderRegistry } from '../../interfaces/core/IProviderRegistry.js';
import { IProvider } from '../../interfaces/core/IProvider.js';
import { IModelService } from '../../interfaces/core/IModelService.js';
import { IUsageTrackerRegistry, IUsageTracker } from '../../interfaces/core/IUsageTracker.js';
import { ILoggerService } from '../../interfaces/core/ILoggerService.js';
import { 
  IGeminiQuotaService, 
  IGeminiSessionService, 
  IGeminiModelService, 
  IGeminiStreamingService, 
  IGeminiToolExecutionService,
  IClaudeSessionService,
  IClaudeProcessService,
  IClaudePermissionService,
  IClaudeStreamingService
} from '../../interfaces/providers/index.js';
import { 
  IClaudeUsageTracker, 
  IGeminiUsageTracker, 
  IUnifiedStatsService, 
  IUiTelemetryService 
} from '../../interfaces/usage/index.js';

// Import provider configurations
import { initializeProvidersFromConfiguration } from '../../configs/providers.config.js';
import { initializeUsageTrackersFromConfiguration } from '../../configs/usage-trackers.config.js';

/**
 * Configure provider-related services
 */
export function configureProviderServices(container: Container): void {
  // Session services
  container.bind<IProviderManager>(TYPES.ProviderManager).to(ProviderManager).inSingletonScope();
  container.bind<IProviderSwitchService>(TYPES.ProviderSwitchService).to(ProviderSwitchService).inSingletonScope();
  container.bind<ISessionManager>(TYPES.SessionManager).to(SessionManager).inSingletonScope();

  // Provider services
  container.bind<IProvider>(TYPES.GeminiProvider).to(GeminiProvider).inSingletonScope();
  container.bind<IProvider>(TYPES.ClaudeProvider).to(ClaudeProvider).inSingletonScope();
  
  // Gemini services
  container.bind<IGeminiQuotaService>(TYPES.GeminiQuotaService).to(GeminiQuotaService).inSingletonScope();
  container.bind<IGeminiSessionService>(TYPES.GeminiSessionService).to(GeminiSessionService).inSingletonScope();
  container.bind<IGeminiModelService>(TYPES.GeminiModelService).to(GeminiModelService).inSingletonScope();
  container.bind<IGeminiStreamingService>(TYPES.GeminiStreamingService).to(GeminiStreamingService).inSingletonScope();
  container.bind<IGeminiToolExecutionService>(TYPES.GeminiToolExecutionService).to(GeminiToolExecutionService).inSingletonScope();
  container.bind<GeminiConfigurationService>(TYPES.GeminiConfigurationService).to(GeminiConfigurationService).inSingletonScope();
  container.bind<GeminiCallbackAdapterService>(TYPES.GeminiCallbackAdapterService).to(GeminiCallbackAdapterService).inSingletonScope();
  container.bind<GeminiBackupService>(TYPES.GeminiBackupService).to(GeminiBackupService).inSingletonScope();
  container.bind<GeminiSessionManagementService>(TYPES.GeminiSessionManagementService).to(GeminiSessionManagementService).inSingletonScope();
  
  // Claude services
  container.bind<ClaudeSessionService>(TYPES.ClaudeSessionService).to(ClaudeSessionService).inSingletonScope();
  container.bind<ClaudeProcessService>(TYPES.ClaudeProcessService).to(ClaudeProcessService).inSingletonScope();
  container.bind<ClaudePermissionService>(TYPES.ClaudePermissionService).to(ClaudePermissionService).inSingletonScope();
  container.bind<ClaudeStreamingService>(TYPES.ClaudeStreamingService).to(ClaudeStreamingService).inSingletonScope();
  container.bind<PermissionResponseService>(TYPES.PermissionResponseService).to(PermissionResponseService).inSingletonScope();
  
  // Shared provider services
  container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();

  // Factories and registries
  container.bind<IProviderFactory>(TYPES.ProviderFactory).to(ProviderFactory).inSingletonScope();
  container.bind<IProviderRegistry>(TYPES.ProviderRegistry).to(ProviderRegistry).inSingletonScope();
  
  // Model management
  container.bind<IModelService>(TYPES.ModelService).to(ModelService).inSingletonScope();
  
  // Usage services
  container.bind<IUsageTracker>(TYPES.ClaudeUsageTracker).to(ClaudeUsageTracker).inSingletonScope();
  container.bind<IUsageTracker>(TYPES.GeminiUsageTracker).to(GeminiUsageTracker).inSingletonScope();
  container.bind<UnifiedStatsService>(TYPES.UnifiedStatsService).to(UnifiedStatsService).inSingletonScope();
  container.bind<UiTelemetryService>(TYPES.UiTelemetryService).to(UiTelemetryService).inSingletonScope();
  container.bind<IUsageTrackerRegistry>(TYPES.UsageTrackerRegistry).to(UsageTrackerRegistry).inSingletonScope();

  // Use logger service for logging
  const logger = container.get<ILoggerService>(TYPES.LoggerService);
  logger.info('🔧 Provider services configured');
}

/**
 * Initialize Provider Registry with configurations
 */
export function initializeProviderRegistry(container: Container): void {
  // Skip provider registration during tests to avoid test interference
  const isTestEnvironment = process.env.VITEST || 
                           process.env.NODE_ENV?.includes('test') || 
                           typeof global !== 'undefined' && (global as any).__vitest_environment__ ||
                           typeof process !== 'undefined' && process.env.npm_lifecycle_event?.includes('test');
  
  if (!isTestEnvironment) {
    const registry = container.get<IProviderRegistry>(TYPES.ProviderRegistry);
    
    // Get all provider configurations from central configuration
    const providerConfigs = initializeProvidersFromConfiguration(container);
    
    // Register all providers
    providerConfigs.forEach(config => registry.registerProvider(config));
    
    const logger = container.get<ILoggerService>(TYPES.LoggerService);
    logger.info('📋 Provider Registry initialized with providers:', { providers: registry.getAvailableTypes() });
  }
}

/**
 * Initialize Usage Tracker Registry with configurations
 */
export function initializeUsageTrackerRegistry(container: Container): void {
  // Skip during tests
  const isTestEnvironment = process.env.VITEST || 
                           process.env.NODE_ENV?.includes('test') || 
                           typeof global !== 'undefined' && (global as any).__vitest_environment__ ||
                           typeof process !== 'undefined' && process.env.npm_lifecycle_event?.includes('test');
  
  if (!isTestEnvironment) {
    const registry = container.get<IUsageTrackerRegistry>(TYPES.UsageTrackerRegistry);
    
    // Get all usage tracker configurations from central configuration
    const trackerConfigs = initializeUsageTrackersFromConfiguration(container);
    
    // Register all usage trackers
    trackerConfigs.forEach(config => registry.registerTracker(config));
    
    const logger = container.get<ILoggerService>(TYPES.LoggerService);
    logger.info('📊 Usage Tracker Registry initialized with trackers:', { trackers: registry.getAvailableProviders() });
  }
}