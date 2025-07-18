/**
 * Dashboard Command - Built-in command for opening settings dashboard
 * 
 * @class DashboardCommand
 * @implements {IBuiltInCommand}
 * @description Built-in command that triggers the settings dashboard overlay.
 * Provides users with access to configuration and system status.
 */

import { injectable } from 'inversify';
import { IBuiltInCommand } from '../../../interfaces/commands/IBuiltInCommand.js';
import { ISlashCommandExecutionResult } from '../../../interfaces/commands/ISlashCommand.js';

/**
 * Dashboard Command implementation
 * 
 * @class DashboardCommand
 * @implements {IBuiltInCommand}
 * @description Opens the dashboard overlay when executed.
 */
@injectable()
export class DashboardCommand implements IBuiltInCommand {
  readonly name = 'dashboard';
  readonly description = 'Open dashboard with settings';
  readonly subdirectory = 'built-in';

  /**
   * Execute dashboard command
   * 
   * @param {string} [args] - Optional command arguments (not used)
   * @returns {Promise<ISlashCommandExecutionResult>} Execution result with dashboard action
   * @description Triggers dashboard overlay display through metadata action.
   */
  async execute(args?: string): Promise<ISlashCommandExecutionResult> {
    try {
      return {
        success: true,
        processedContent: '🔧 Opening dashboard...',
        metadata: { action: 'show_dashboard' }
      };
    } catch (error) {
      return {
        success: false,
        processedContent: '',
        error: `Failed to open dashboard: ${error}`,
      };
    }
  }
}