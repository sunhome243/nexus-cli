import { ISlashCommand, ISlashCommandExecutionResult, ISlashCommandListItem } from './ISlashCommand.js';

export interface ISlashCommandService {
  /**
   * Scan the .claude/commands directory for available commands
   */
  scanCommands(): Promise<ISlashCommand[]>;

  /**
   * Get a list of available commands for display
   */
  getAvailableCommands(): Promise<ISlashCommandListItem[]>;

  /**
   * Execute a slash command with the provided arguments
   */
  executeCommand(commandName: string, args?: string): Promise<ISlashCommandExecutionResult>;

  /**
   * Check if a command exists
   */
  hasCommand(commandName: string): Promise<boolean>;

  /**
   * Get a specific command by name
   */
  getCommand(commandName: string): Promise<ISlashCommand | null>;

}