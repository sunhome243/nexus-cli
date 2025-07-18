/**
 * Claude Command - Built-in command for Claude model switching
 * 
 * @class ClaudeCommand
 * @implements {IBuiltInCommand}
 * @description Built-in command for switching between Claude model variants.
 * Provides model validation and switching capabilities with user feedback.
 */

import { injectable, inject } from 'inversify';
import { IBuiltInCommand } from '../../../interfaces/commands/IBuiltInCommand.js';
import { ISlashCommandExecutionResult } from '../../../interfaces/commands/ISlashCommand.js';
import { IModelService } from '../../../interfaces/core/IModelService.js';
import { TYPES } from '../../../infrastructure/di/types.js';
import { IModelConfigManager, ProviderType, ModelName } from '../../../abstractions/providers/index.js';

/**
 * Claude Command implementation
 * 
 * @class ClaudeCommand
 * @implements {IBuiltInCommand}
 * @description Handles Claude model switching with validation and feedback.
 */
@injectable()
export class ClaudeCommand implements IBuiltInCommand {
  readonly name = 'claude';
  readonly description = 'Switch Claude model';
  readonly subdirectory = 'built-in';

  constructor(
    @inject(TYPES.ModelService) private modelService: IModelService,
    @inject(TYPES.ModelConfigManager) private modelConfigManager: IModelConfigManager
  ) {}

  /**
   * Execute Claude model switching command
   * 
   * @param {string} [args] - Model name to switch to (optional)
   * @returns {Promise<ISlashCommandExecutionResult>} Execution result with model switch status
   * @description Switches Claude model or displays current model and available options.
   */
  async execute(args?: string): Promise<ISlashCommandExecutionResult> {
    try {
      const availableModels = this.modelConfigManager.getModelNames(ProviderType.CLAUDE);
      const modelList = availableModels.join(' or ');
      
      if (!args) {
        const currentModel = this.modelService.getCurrentModel();
        return {
          success: true,
          processedContent: `Current Claude model: ${currentModel}\nUsage: /claude ${modelList}`,
        };
      }

      const model = args.trim().toLowerCase() as ModelName;
      if (availableModels.includes(model)) {
        await this.modelService.switchModel(model);
        return {
          success: true,
          processedContent: `✅ Switched to Claude ${model.charAt(0).toUpperCase() + model.slice(1)} 4`,
        };
      } else {
        return {
          success: false,
          processedContent: '',
          error: `Invalid model. Use: /claude ${modelList}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        processedContent: '',
        error: `Failed to switch model: ${error}`,
      };
    }
  }
}