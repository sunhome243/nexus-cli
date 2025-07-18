/**
 * Slash Command Service - Command execution orchestrator
 * 
 * @class SlashCommandService
 * @implements {ISlashCommandService}
 * @description Orchestrates slash command execution by delegating to the command registry.
 * Provides unified interface for command discovery, validation, and execution.
 */

import { injectable, inject } from 'inversify';
import { ISlashCommand, ISlashCommandExecutionResult, ISlashCommandListItem } from '../../interfaces/commands/ISlashCommand.js';
import { ISlashCommandService } from '../../interfaces/commands/ISlashCommandService.js';
import { ICommandRegistry } from '../../interfaces/commands/ICommandRegistry.js';
import { TYPES } from '../../infrastructure/di/types.js';

/**
 * Slash Command Service implementation
 * 
 * @class SlashCommandService
 * @implements {ISlashCommandService}
 * @description High-level service for slash command operations. Acts as facade over command registry.
 */
@injectable()
export class SlashCommandService implements ISlashCommandService {
  constructor(
    @inject(TYPES.CommandRegistry) private commandRegistry: ICommandRegistry
  ) {}

  /**
   * Scan the .claude/commands directory for available commands
   * 
   * @returns {Promise<ISlashCommand[]>} Array of scanned commands (currently empty as registry handles internally)
   * @description Triggers command registry loading. Returns empty array as file commands are handled internally.
   */
  public async scanCommands(): Promise<ISlashCommand[]> {
    await this.commandRegistry.loadCommands();
    // Return empty array as file commands are handled internally by registry
    return [];
  }

  /**
   * Get a list of available commands for display
   * 
   * @returns {Promise<ISlashCommandListItem[]>} List of available commands with metadata
   * @description Retrieves both built-in and file-based commands for user selection.
   */
  public async getAvailableCommands(): Promise<ISlashCommandListItem[]> {
    return await this.commandRegistry.getAvailableCommands();
  }

  /**
   * Execute a slash command with the provided arguments
   * 
   * @param {string} commandName - Name of the command to execute
   * @param {string} [args] - Optional command arguments
   * @returns {Promise<ISlashCommandExecutionResult>} Execution result with success status and content
   * @description Executes specified command through registry delegation.
   */
  public async executeCommand(commandName: string, args?: string): Promise<ISlashCommandExecutionResult> {
    return await this.commandRegistry.executeCommand(commandName, args);
  }

  /**
   * Check if a command exists
   * 
   * @param {string} commandName - Name of the command to check
   * @returns {Promise<boolean>} True if command exists in registry
   * @description Validates command existence across built-in and file-based commands.
   */
  public async hasCommand(commandName: string): Promise<boolean> {
    return await this.commandRegistry.hasCommand(commandName);
  }

  /**
   * Get a specific command by name
   * 
   * @param {string} commandName - Name of the command to retrieve
   * @returns {Promise<ISlashCommand | null>} Command instance or null if not found
   * @description Retrieves command metadata and content for inspection.
   */
  public async getCommand(commandName: string): Promise<ISlashCommand | null> {
    return await this.commandRegistry.getCommand(commandName);
  }

}