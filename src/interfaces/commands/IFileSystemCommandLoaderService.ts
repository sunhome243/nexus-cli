/**
 * File System Command Loader Interface
 * Defines the contract for loading slash commands from the file system
 */

import { ISlashCommand } from './ISlashCommand.js';

export interface IFileSystemCommandLoaderService {
  /**
   * Scan the .claude/commands directory for available commands
   */
  loadCommands(): Promise<ISlashCommand[]>;
}