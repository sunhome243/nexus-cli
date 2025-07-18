/**
 * Built-in Command Interface
 * Defines the contract for built-in slash commands
 */

import { ISlashCommandExecutionResult } from './ISlashCommand.js';

export interface IBuiltInCommand {
  readonly name: string;
  readonly description: string;
  readonly subdirectory: string;
  
  execute(args?: string): Promise<ISlashCommandExecutionResult>;
}