/**
 * Command Registry - Central command management and execution
 * 
 * @class CommandRegistry
 * @implements {ICommandRegistry}
 * @description Manages both built-in and file-based commands with unified execution interface.
 * Coordinates command loading, discovery, and execution across different command sources.
 */

import { injectable, inject } from 'inversify';
import { ISlashCommand, ISlashCommandListItem, ISlashCommandExecutionResult } from '../../../interfaces/commands/ISlashCommand.js';
import { IBuiltInCommand } from '../../../interfaces/commands/IBuiltInCommand.js';
import { ICommandRegistry } from '../../../interfaces/commands/ICommandRegistry.js';
import { IFileSystemCommandLoaderService } from '../../../interfaces/commands/IFileSystemCommandLoaderService.js';
import { ISlashCommandParserService } from '../../../interfaces/commands/ISlashCommandParserService.js';
import { TYPES } from '../../../infrastructure/di/types.js';

/**
 * Command Registry implementation
 * 
 * @class CommandRegistry
 * @implements {ICommandRegistry}
 * @description Central registry for command management. Handles built-in commands and file-based commands.
 */
@injectable()
export class CommandRegistry implements ICommandRegistry {
  private fileCommands: ISlashCommand[] = [];
  private commandsLoaded = false;

  constructor(
    @inject(TYPES.FileSystemCommandLoaderService) private fileLoader: IFileSystemCommandLoaderService,
    @inject(TYPES.SlashCommandParserService) private parser: ISlashCommandParserService,
    @inject('BuiltInCommands') private builtInCommands: IBuiltInCommand[]
  ) {}

  /**
   * Load all available commands (file-based and built-in)
   * 
   * @returns {Promise<void>} Completion promise
   * @description Loads file-based commands from filesystem. Built-in commands are injected via DI.
   */
  async loadCommands(): Promise<void> {
    if (this.commandsLoaded) return;
    
    this.fileCommands = await this.fileLoader.loadCommands();
    this.commandsLoaded = true;
  }

  /**
   * Get all available commands for display
   * 
   * @returns {Promise<ISlashCommandListItem[]>} List of available commands with metadata
   * @description Combines built-in and file-based commands for user interface display.
   */
  async getAvailableCommands(): Promise<ISlashCommandListItem[]> {
    await this.loadCommands();

    const fileCommandItems = this.fileCommands.map(cmd => ({
      name: cmd.name,
      description: cmd.description || 'No description',
      subdirectory: cmd.subdirectory,
    }));

    const builtInCommandItems = this.builtInCommands.map(cmd => ({
      name: cmd.name,
      description: cmd.description,
      subdirectory: cmd.subdirectory,
    }));

    return [...builtInCommandItems, ...fileCommandItems];
  }

  /**
   * Execute a command by name
   * 
   * @param {string} commandName - Name of the command to execute
   * @param {string} [args] - Optional command arguments
   * @returns {Promise<ISlashCommandExecutionResult>} Execution result
   * @description Executes command with priority: built-in first, then file-based commands.
   */
  async executeCommand(commandName: string, args?: string): Promise<ISlashCommandExecutionResult> {
    // Check built-in commands first
    const builtInCommand = this.builtInCommands.find(cmd => cmd.name === commandName);
    if (builtInCommand) {
      return await builtInCommand.execute(args);
    }

    // Check file-based commands
    await this.loadCommands();
    const fileCommand = this.fileCommands.find(cmd => cmd.name === commandName);
    
    if (!fileCommand) {
      return {
        success: false,
        processedContent: '',
        error: `Command '${commandName}' not found.`,
      };
    }

    try {
      const processedContent = this.parser.processCommandContent(fileCommand.content, args);
      return {
        success: true,
        processedContent,
      };
    } catch (error) {
      return {
        success: false,
        processedContent: '',
        error: `Failed to execute command '${commandName}': ${error}`,
      };
    }
  }

  /**
   * Check if a command exists
   * 
   * @param {string} commandName - Name of the command to check
   * @returns {Promise<boolean>} True if command exists
   * @description Searches both built-in and file-based command sources.
   */
  async hasCommand(commandName: string): Promise<boolean> {
    // Check built-in commands
    if (this.builtInCommands.some(cmd => cmd.name === commandName)) {
      return true;
    }

    // Check file-based commands
    await this.loadCommands();
    return this.fileCommands.some(cmd => cmd.name === commandName);
  }

  /**
   * Get a specific file-based command by name
   * 
   * @param {string} commandName - Name of the command to retrieve
   * @returns {Promise<ISlashCommand | null>} Command instance or null if not found
   * @description Retrieves file-based commands only. Built-in commands are not returned.
   */
  async getCommand(commandName: string): Promise<ISlashCommand | null> {
    await this.loadCommands();
    return this.fileCommands.find(cmd => cmd.name === commandName) || null;
  }
}