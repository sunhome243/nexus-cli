/**
 * Claude Settings Service
 * Handles management of .claude/settings.local.json file for auto-approved permissions
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../../infrastructure/di/types.js';
import { ILoggerService } from '../../../interfaces/core/ILoggerService.js';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { homedir } from 'node:os';

export interface ClaudeSettings {
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
}

export interface IClaudeSettingsService {
  addAutoApprovedTool(tool: string, args?: Record<string, unknown>): Promise<void>;
  isToolAutoApproved(tool: string, args?: Record<string, unknown>): Promise<boolean>;
  getSettings(): Promise<ClaudeSettings>;
  saveSettings(settings: ClaudeSettings): Promise<void>;
  ensureSettingsDirectory(): Promise<void>;
}

@injectable()
export class ClaudeSettingsService implements IClaudeSettingsService {
  private readonly settingsPath: string;

  constructor(
    @inject(TYPES.LoggerService) private logger: ILoggerService
  ) {
    this.settingsPath = path.join(homedir(), '.claude', 'settings.local.json');
  }

  /**
   * Add an auto-approved tool to the settings
   */
  async addAutoApprovedTool(tool: string, args?: Record<string, unknown>): Promise<void> {
    await this.ensureSettingsDirectory();
    
    const settings = await this.getSettings();
    
    // Initialize permissions structure if it doesn't exist
    if (!settings.permissions) {
      settings.permissions = { allow: [], deny: [] };
    }
    if (!settings.permissions.allow) {
      settings.permissions.allow = [];
    }

    // Create permission entry for the tool
    const permissionEntry = this.createPermissionEntry(tool, args);
    
    // Check if this permission already exists
    if (!settings.permissions.allow.includes(permissionEntry)) {
      settings.permissions.allow.push(permissionEntry);
      await this.saveSettings(settings);
      this.logger.info(`Added auto-approved tool to settings: ${permissionEntry}`);
    } else {
      this.logger.debug(`Tool already auto-approved: ${permissionEntry}`);
    }
  }

  /**
   * Check if a tool is auto-approved based on current settings
   */
  async isToolAutoApproved(tool: string, args?: Record<string, unknown>): Promise<boolean> {
    try {
      const settings = await this.getSettings();
      
      if (!settings.permissions?.allow) {
        return false;
      }

      // Create permission entry for the tool to check
      const permissionEntry = this.createPermissionEntry(tool, args);
      
      // Check exact match first
      if (settings.permissions.allow.includes(permissionEntry)) {
        this.logger.debug(`Tool auto-approved (exact match): ${permissionEntry}`);
        return true;
      }

      // Check wildcard matches
      const toolWildcard = `${tool}(*)`;
      if (settings.permissions.allow.includes(toolWildcard)) {
        this.logger.debug(`Tool auto-approved (wildcard match): ${toolWildcard}`);
        return true;
      }

      // Check pattern matches for file operations
      if (['Read', 'Write', 'Edit', 'MultiEdit'].includes(tool) && args?.file_path) {
        const filePath = args.file_path as string;
        const ext = path.extname(filePath);
        if (ext) {
          const extPattern = `${tool}(*${ext})`;
          if (settings.permissions.allow.includes(extPattern)) {
            this.logger.debug(`Tool auto-approved (extension match): ${extPattern}`);
            return true;
          }
        }
      }

      // Check command-based matches for Bash
      if (tool === 'Bash' && args?.command) {
        const command = (args.command as string).split(' ')[0];
        const commandPattern = `Bash(${command}:*)`;
        if (settings.permissions.allow.includes(commandPattern)) {
          this.logger.debug(`Tool auto-approved (command match): ${commandPattern}`);
          return true;
        }
      }

      // Check domain-based matches for WebFetch
      if (tool === 'WebFetch' && args?.url) {
        try {
          const url = new URL(args.url as string);
          const domainPattern = `WebFetch(domain:${url.hostname})`;
          if (settings.permissions.allow.includes(domainPattern)) {
            this.logger.debug(`Tool auto-approved (domain match): ${domainPattern}`);
            return true;
          }
        } catch {
          // Invalid URL, ignore domain matching
        }
      }

      this.logger.debug(`Tool not auto-approved: ${permissionEntry}`);
      return false;
    } catch (error) {
      this.logger.error('Failed to check auto-approved tool', { 
        tool, 
        error: error?.toString() 
      });
      return false;
    }
  }

  /**
   * Get current settings from file
   */
  async getSettings(): Promise<ClaudeSettings> {
    try {
      const data = await fs.readFile(this.settingsPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist, return default settings
        return {
          permissions: {
            allow: [],
            deny: []
          }
        };
      }
      this.logger.error('Failed to read settings file', { error: error?.toString() });
      throw error;
    }
  }

  /**
   * Save settings to file
   */
  async saveSettings(settings: ClaudeSettings): Promise<void> {
    try {
      await this.ensureSettingsDirectory();
      await fs.writeFile(this.settingsPath, JSON.stringify(settings, null, 2));
      this.logger.debug('Settings saved successfully');
    } catch (error) {
      this.logger.error('Failed to save settings file', { error: error?.toString() });
      throw error;
    }
  }

  /**
   * Ensure the .claude directory exists
   */
  async ensureSettingsDirectory(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.settingsPath), { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create settings directory', { error: error?.toString() });
      throw error;
    }
  }

  /**
   * Create a permission entry string for a tool and its arguments
   */
  private createPermissionEntry(tool: string, args?: Record<string, unknown>): string {
    if (!args || Object.keys(args).length === 0) {
      return `${tool}(*)`;
    }

    // Create a simplified permission entry based on tool type and key arguments
    switch (tool) {
      case 'Bash':
        // For Bash commands, use the command as the key parameter
        if (args.command && typeof args.command === 'string') {
          const command = args.command.split(' ')[0]; // Get the base command
          return `Bash(${command}:*)`;
        }
        return `Bash(*)`;
        
      case 'WebFetch':
        // For WebFetch, use the domain if available
        if (args.url && typeof args.url === 'string') {
          try {
            const url = new URL(args.url);
            return `WebFetch(domain:${url.hostname})`;
          } catch {
            return `WebFetch(*)`;
          }
        }
        return `WebFetch(*)`;
        
      case 'Read':
      case 'Write':
      case 'Edit':
      case 'MultiEdit':
        // For file operations, could include file patterns if needed
        if (args.file_path && typeof args.file_path === 'string') {
          const fileName = path.basename(args.file_path);
          const ext = path.extname(fileName);
          if (ext) {
            return `${tool}(*${ext})`;
          }
        }
        return `${tool}(*)`;
        
      case 'Grep':
      case 'Glob':
        // For search operations, use pattern-based permissions
        return `${tool}(*)`;
        
      default:
        // For other tools, use wildcard permissions
        return `${tool}(*)`;
    }
  }
}