/**
 * Sync Services Container
 * Handles all synchronization-related services
 */

import { Container } from 'inversify';
import { TYPES } from './types.js';

// Import sync services
import { 
  SyncLockService,
  MyersDiff,
  SyncStateService,
  SyncEngine,
  GeminiSyncHandler,
  ClaudeSyncHandler
} from '../../services/sync/index.js';
import { ClaudeFileHandler } from '../../services/sync/handlers/ClaudeFileHandler.js';
import { GeminiFileHandler } from '../../services/sync/handlers/GeminiFileHandler.js';
import { SessionRegistryManager, ISessionRegistryManager } from '../../services/sync/registry/SessionRegistry.js';

// Import interfaces
import { ISyncLockService, IDiffEngine, ISyncStateService, IProviderSyncHandler, IClaudeFileHandler, IGeminiFileHandler } from '../../interfaces/sync/index.js';
import { ISyncEngine } from '../../interfaces/core/ISyncEngine.js';
import { ILoggerService } from '../../interfaces/core/ILoggerService.js';

/**
 * Configure sync-related services
 */
export function configureSyncServices(container: Container): void {
  // Sync services
  container.bind<ISyncLockService>(TYPES.SyncLockService).to(SyncLockService).inSingletonScope();
  container.bind<IDiffEngine>(TYPES.DiffEngine).to(MyersDiff).inSingletonScope();
  container.bind<ISyncStateService>(TYPES.SyncStateService).to(SyncStateService).inSingletonScope();
  container.bind<ISessionRegistryManager>(TYPES.SessionRegistryManager).to(SessionRegistryManager).inSingletonScope();
  container.bind<ClaudeFileHandler>(TYPES.ClaudeFileHandler).to(ClaudeFileHandler).inSingletonScope();
  container.bind<GeminiFileHandler>(TYPES.GeminiFileHandler).to(GeminiFileHandler).inSingletonScope();
  container.bind<IProviderSyncHandler>(TYPES.GeminiSyncHandler).to(GeminiSyncHandler).inSingletonScope();
  container.bind<IProviderSyncHandler>(TYPES.ClaudeSyncHandler).to(ClaudeSyncHandler).inSingletonScope();
  container.bind<ISyncEngine>(TYPES.SyncEngine).to(SyncEngine).inSingletonScope();

  // Use logger service for logging
  const logger = container.get<ILoggerService>(TYPES.LoggerService);
  logger.info('🔧 Sync services configured');
}