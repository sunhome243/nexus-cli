/**
 * Tool Services Container
 * Handles tool execution pipeline and strategies
 */

import { Container } from 'inversify';
import { TYPES } from './types.js';
import { CrossProviderToolExecutionStrategy } from '../../services/tools/strategies/CrossProviderToolExecutionStrategy.js';
import { IToolExecutionStrategy } from '../../interfaces/tools/IToolExecutionStrategy.js';
import { ILoggerService } from '../../interfaces/core/ILoggerService.js';

/**
 * Configure tool-related services
 */
export function configureToolServices(container: Container): void {
  // Tool execution strategies
  container.bind<IToolExecutionStrategy>(TYPES.CrossProviderToolExecutionStrategy)
    .to(CrossProviderToolExecutionStrategy)
    .inSingletonScope();
  
  // Bind Container itself for injection if not already bound
  if (!container.isBound('Container')) {
    container.bind<Container>('Container').toConstantValue(container);
  }

  // Log configuration completion
  const logger = container.get<ILoggerService>(TYPES.LoggerService);
  logger.info('Tool services configured', { 
    component: 'ToolContainer',
    services: ['CrossProviderToolExecutionStrategy'] 
  });
}