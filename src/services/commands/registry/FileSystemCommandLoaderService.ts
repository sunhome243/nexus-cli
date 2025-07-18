/**
 * File System Command Loader Service - File-based command discovery and loading
 * 
 * @class FileSystemCommandLoaderService
 * @implements {IFileSystemCommandLoaderService}
 * @description Scans .claude/commands directory for Markdown-based command files.
 * Supports nested directory structures and automatic description extraction.
 */

import { injectable, inject } from 'inversify';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TYPES } from '../../../infrastructure/di/types.js';
import { ILoggerService } from '../../../interfaces/core/ILoggerService.js';
import { ISlashCommand } from '../../../interfaces/commands/ISlashCommand.js';
import { IFileSystemCommandLoaderService } from '../../../interfaces/commands/IFileSystemCommandLoaderService.js';

/**
 * File System Command Loader Service implementation
 * 
 * @class FileSystemCommandLoaderService
 * @implements {IFileSystemCommandLoaderService}
 * @description Loads commands from .claude/commands directory with recursive scanning.
 */
@injectable()
export class FileSystemCommandLoaderService implements IFileSystemCommandLoaderService {
  constructor(
    @inject(TYPES.LoggerService) private logger: ILoggerService
  ) {}
  /**
   * Scan the .claude/commands directory for available commands
   * 
   * @returns {Promise<ISlashCommand[]>} Array of loaded command objects
   * @description Recursively scans .claude/commands for .md files and loads them as commands.
   */
  async loadCommands(): Promise<ISlashCommand[]> {
    const commandsDir = path.join(process.cwd(), '.claude', 'commands');
    
    try {
      const commands: ISlashCommand[] = [];
      await this.scanDirectory(commandsDir, commands);
      return commands;
    } catch (error) {
      this.logger.warn('Could not scan commands directory:', { commandsDir, error });
      return [];
    }
  }

  /**
   * Recursively scan directory for command files
   * 
   * @param {string} dir - Directory path to scan
   * @param {ISlashCommand[]} commands - Array to populate with found commands
   * @param {string} [subdirectory] - Current subdirectory path for organization
   * @returns {Promise<void>} Completion promise
   * @private
   */
  private async scanDirectory(dir: string, commands: ISlashCommand[], subdirectory?: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          const subdir = subdirectory ? `${subdirectory}/${entry.name}` : entry.name;
          await this.scanDirectory(fullPath, commands, subdir);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          // Load command file
          const commandName = path.basename(entry.name, '.md');
          const content = await fs.readFile(fullPath, 'utf-8');
          
          commands.push({
            name: commandName,
            description: this.extractDescription(content),
            filePath: fullPath,
            content,
            subdirectory,
          });
        }
      }
    } catch (error) {
      // Ignore errors for directories that don't exist or can't be read
    }
  }

  /**
   * Extract description from command content (first line or purpose line)
   * 
   * @param {string} content - Raw command file content
   * @returns {string} Extracted description or default message
   * @description Looks for 'Purpose:' line first, then falls back to first non-header line.
   * @private
   */
  private extractDescription(content: string): string {
    const lines = content.split('\n');
    
    // Look for a purpose line
    for (const line of lines) {
      if (line.toLowerCase().includes('purpose:')) {
        return line.replace(/^.*purpose:\s*/i, '').trim();
      }
    }
    
    // Fall back to first non-empty line
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        return trimmed;
      }
    }
    
    return 'No description available';
  }
}