/**
 * Core Services Container
 * Handles fundamental application services
 */

import { Container } from 'inversify';
import { TYPES } from './types.js';

// Import core services
import { LoggerService } from '../../services/core/LoggerService.js';
import { MCPService, IMCPService } from '../../services/core/MCPService.js';
import { AppEventBusService } from '../../services/events/AppEventBusService.js';
import { AppInitializationService } from '../../services/initialization/AppInitializationService.js';
import { MCPConfigurationService } from '../../services/mcp/MCPConfigurationService.js';
import { MCPConfigPathResolverService, IMCPConfigPathResolverService } from '../../services/mcp/config/MCPConfigPathResolverService.js';
import { MCPSocketManager, IMCPSocketManager } from '../../services/mcp/lifecycle/MCPSocketManager.js';
import { MCPConfigLoaderService, IMCPConfigLoaderService } from '../../services/mcp/config/MCPConfigLoaderService.js';
import { MCPConfigSaverService, IMCPConfigSaverService } from '../../services/mcp/config/MCPConfigSaverService.js';
import { MCPServerRemoverService, IMCPServerRemoverService } from '../../services/mcp/config/MCPServerRemoverService.js';
import { MCPConfigValidatorService, IMCPConfigValidatorService } from '../../services/mcp/config/MCPConfigValidatorService.js';
import { LocalStorageService } from '../../services/storage/LocalStorageService.js';
import { ILocalStorageService } from '../../interfaces/storage/ILocalStorageService.js';
import { AskModelSocketService, IAskModelSocketService } from '../../services/mcp/AskModelSocketService.js';
import { ModelConfigManager, IModelConfigManager } from '../../abstractions/providers/model-config.js';
import { GlobalAnimationManager, IGlobalAnimationManager } from '../../utils/GlobalAnimationManager.js';
import { ClaudeSettingsService, IClaudeSettingsService } from '../../services/mcp/config/ClaudeSettingsService.js';

// Import interfaces
import { ILoggerService } from '../../interfaces/index.js';
import { IAppEventBusService } from '../../interfaces/events/IAppEventBusService.js';
import { IAppInitializationService } from '../../interfaces/initialization/IAppInitializationService.js';
import { IMCPConfigurationService } from '../../interfaces/mcp/IMCPConfigurationService.js';

/**
 * Configure core application services
 */
export function configureCoreServices(container: Container): void {
  // Core services
  container.bind<ILoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
  container.bind<IMCPService>(TYPES.MCPService).to(MCPService).inSingletonScope();
  
  // Storage services
  container.bind<ILocalStorageService>(TYPES.LocalStorageService).to(LocalStorageService).inSingletonScope();

  // Model Configuration
  container.bind<IModelConfigManager>(TYPES.ModelConfigManager).to(ModelConfigManager).inSingletonScope();

  // Animation Management
  container.bind<IGlobalAnimationManager>(TYPES.GlobalAnimationManager).to(GlobalAnimationManager).inSingletonScope();

  // Event Services
  container.bind<IAppEventBusService>(TYPES.AppEventBusService).to(AppEventBusService).inSingletonScope();

  // Initialization Services
  container.bind<IAppInitializationService>(TYPES.AppInitializationService).to(AppInitializationService).inSingletonScope();

  // MCP Services - Decomposed from MCPService god class
  container.bind<IMCPConfigurationService>(TYPES.MCPConfigurationService).to(MCPConfigurationService).inSingletonScope();
  container.bind<IMCPConfigPathResolverService>(TYPES.MCPConfigPathResolverService).to(MCPConfigPathResolverService).inSingletonScope();
  container.bind<IMCPSocketManager>(TYPES.MCPSocketManager).to(MCPSocketManager).inSingletonScope();
  container.bind<IMCPConfigLoaderService>(TYPES.MCPConfigLoaderService).to(MCPConfigLoaderService).inSingletonScope();
  container.bind<IMCPConfigSaverService>(TYPES.MCPConfigSaverService).to(MCPConfigSaverService).inSingletonScope();
  container.bind<IMCPServerRemoverService>(TYPES.MCPServerRemoverService).to(MCPServerRemoverService).inSingletonScope();
  container.bind<IMCPConfigValidatorService>(TYPES.MCPConfigValidatorService).to(MCPConfigValidatorService).inSingletonScope();
  container.bind<IAskModelSocketService>(TYPES.AskModelSocketService).to(AskModelSocketService).inSingletonScope();
  container.bind<IClaudeSettingsService>(TYPES.ClaudeSettingsService).to(ClaudeSettingsService).inSingletonScope();

  // Use logger service for logging
  const logger = container.get<ILoggerService>(TYPES.LoggerService);
  logger.info('🔧 Core services configured');
}