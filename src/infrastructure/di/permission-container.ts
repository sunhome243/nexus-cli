/**
 * Permission Container Configuration
 * Dependency injection setup for permission-related services
 */

import { Container } from 'inversify';
import { TYPES } from './types.js';

// Permission services
import { ClaudePermissionOrchestrator } from '../../services/permissions/ClaudePermissionOrchestrator.js';
import { GeminiPermissionOrchestrator } from '../../services/permissions/GeminiPermissionOrchestrator.js';
import { ProviderPermissionCoordinator } from '../../services/permissions/ProviderPermissionCoordinator.js';

// Permission interfaces
import { IClaudePermissionService } from '../../interfaces/permissions/IClaudePermissionService.js';
import { IGeminiPermissionService } from '../../interfaces/permissions/IGeminiPermissionService.js';
import { IProviderPermissionService } from '../../interfaces/permissions/IProviderPermissionService.js';

/**
 * Configure permission-related dependency injection bindings
 */
export function configurePermissionContainer(container: Container): void {
  // Claude Permission Orchestrator
  container.bind<IClaudePermissionService>(TYPES.ClaudePermissionOrchestrator)
    .to(ClaudePermissionOrchestrator)
    .inSingletonScope();

  // Gemini Permission Orchestrator  
  container.bind<IGeminiPermissionService>(TYPES.GeminiPermissionOrchestrator)
    .to(GeminiPermissionOrchestrator)
    .inSingletonScope();

  // Provider Permission Coordinator
  container.bind<ProviderPermissionCoordinator>(TYPES.ProviderPermissionCoordinator)
    .to(ProviderPermissionCoordinator)
    .inSingletonScope();
}