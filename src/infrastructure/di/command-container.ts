/**
 * Command Services Container
 * Handles all command-related services and slash commands
 */

import { Container } from 'inversify';
import { TYPES } from './types.js';

// Import slash command services
import { SlashCommandService } from '../../services/commands/SlashCommandService.js';
import { SlashCommandParserService } from '../../services/commands/SlashCommandParserService.js';
import { CommandRegistry } from '../../services/commands/registry/CommandRegistry.js';
import { FileSystemCommandLoaderService } from '../../services/commands/registry/FileSystemCommandLoaderService.js';
import { ClaudeCommand, DashboardCommand } from '../../services/commands/built-in/index.js';

// Import interfaces
import { ISlashCommandService, ISlashCommandParserService, ICommandRegistry, IFileSystemCommandLoaderService } from '../../interfaces/commands/index.js';
import { ILoggerService } from '../../interfaces/core/ILoggerService.js';

/**
 * Configure command-related services
 */
export function configureCommandServices(container: Container): void {
  // Slash command services
  container.bind<ISlashCommandService>(TYPES.SlashCommandService).to(SlashCommandService).inSingletonScope();
  container.bind<ISlashCommandParserService>(TYPES.SlashCommandParserService).to(SlashCommandParserService).inSingletonScope();
  container.bind<ICommandRegistry>(TYPES.CommandRegistry).to(CommandRegistry).inSingletonScope();
  container.bind<IFileSystemCommandLoaderService>(TYPES.FileSystemCommandLoaderService).to(FileSystemCommandLoaderService).inSingletonScope();
  
  // Built-in commands
  container.bind(ClaudeCommand).toSelf().inSingletonScope();
  container.bind(DashboardCommand).toSelf().inSingletonScope();
  container.bind('BuiltInCommands').toDynamicValue(() => [
    container.get(ClaudeCommand),
    container.get(DashboardCommand)
  ]).inSingletonScope();

  // Use logger service for logging
  const logger = container.get<ILoggerService>(TYPES.LoggerService);
  logger.info('🔧 Command services configured');
}