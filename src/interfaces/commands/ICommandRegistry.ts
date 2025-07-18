/**
 * Command Registry Interface
 * Defines the contract for command registry services that manage slash commands
 */

import { ISlashCommand, ISlashCommandListItem, ISlashCommandExecutionResult } from './ISlashCommand.js';

export interface ICommandRegistry {
  /**
   * Load all available commands (file-based and built-in)
   */
  loadCommands(): Promise<void>;

  /**
   * Get all available commands for display
   */
  getAvailableCommands(): Promise<ISlashCommandListItem[]>;

  /**
   * Execute a command by name
   */
  executeCommand(commandName: string, args?: string): Promise<ISlashCommandExecutionResult>;

  /**
   * Check if a command exists
   */
  hasCommand(commandName: string): Promise<boolean>;

  /**
   * Get a specific file-based command by name
   */
  getCommand(commandName: string): Promise<ISlashCommand | null>;
}