import { injectable, inject } from 'inversify';
import { IModelService } from '../../interfaces/core/IModelService.js';
import { ModelName, IModelConfigManager, ProviderType } from '../../abstractions/providers/index.js';
import { ILocalStorageService } from '../../interfaces/storage/ILocalStorageService.js';
import { TYPES } from '../../infrastructure/di/types.js';
import { ILoggerService } from '../../interfaces/core/ILoggerService.js';

/**
 * Model service for managing Claude model selection and auto-opus functionality
 * 
 * @class ModelService
 * @implements {IModelService}
 * @description Handles model switching, auto-opus mode, and plan mode integration
 */
@injectable()
export class ModelService implements IModelService {
  private currentModel: ModelName;
  private autoOpusEnabled: boolean = false;
  private previousModel: ModelName;
  private currentPermissionMode: string = 'default';
  
  private modelChangeCallbacks: ((model: ModelName) => void)[] = [];
  private autoOpusChangeCallbacks: ((enabled: boolean) => void)[] = [];

  constructor(
    @inject(TYPES.LoggerService) private logger: ILoggerService,
    @inject(TYPES.LocalStorageService) private storageService: ILocalStorageService,
    @inject(TYPES.ModelConfigManager) private modelConfigManager: IModelConfigManager
  ) {
    this.logger.debug('ModelService constructor called');
    const defaultModel = this.modelConfigManager.getDefaultModel(ProviderType.CLAUDE);
    this.currentModel = defaultModel;
    this.previousModel = defaultModel;
    this.loadSettings();
    this.logger.info('ModelService initialized', { 
      model: this.currentModel, 
      autoOpus: this.autoOpusEnabled 
    });
  }

  /**
   * Get the currently selected model
   * 
   * @returns {ModelName} The current model name
   */
  getCurrentModel(): ModelName {
    return this.currentModel;
  }

  /**
   * Switch to a different model
   * 
   * @param {ModelName} model - The model to switch to
   * @returns {Promise<void>}
   */
  async switchModel(model: ModelName): Promise<void> {
    if (this.currentModel === model) {
      return; // No change needed
    }

    this.logger.info(`Switching Claude model from ${this.currentModel} to ${model}`, {
      fromModel: this.currentModel,
      toModel: model
    });
    
    this.previousModel = this.currentModel;
    this.currentModel = model;
    
    this.saveSettings();
    this.notifyModelChanged();
  }

  /**
   * Get the current auto-opus enabled state
   * 
   * @returns {boolean} True if auto-opus is enabled
   */
  getAutoOpusEnabled(): boolean {
    return this.autoOpusEnabled;
  }

  /**
   * Toggle the auto-opus feature on/off
   * 
   * @returns {Promise<void>}
   */
  async toggleAutoOpus(): Promise<void> {
    this.logger.debug('toggleAutoOpus called', { currentState: this.autoOpusEnabled });
    this.autoOpusEnabled = !this.autoOpusEnabled;
    this.logger.info(`Auto Opus ${this.autoOpusEnabled ? 'enabled' : 'disabled'}`, {
      autoOpusEnabled: this.autoOpusEnabled,
      permissionMode: this.currentPermissionMode,
      currentModel: this.currentModel
    });
    
    this.saveSettings();
    this.notifyAutoOpusChanged();
    
    // If we just enabled Auto Opus and we're already in plan mode, switch to Opus immediately
    const opusModel = this.modelConfigManager.getModelNames(ProviderType.CLAUDE).find(m => m === 'opus') || this.modelConfigManager.getDefaultModel(ProviderType.CLAUDE);
    if (this.autoOpusEnabled && this.currentPermissionMode === 'plan' && this.currentModel !== opusModel) {
      this.logger.info('Auto Opus enabled in plan mode - switching to Opus immediately');
      this.previousModel = this.currentModel;
      this.currentModel = opusModel;
      this.saveSettings();
      this.logger.debug('About to notify model changed (toggle)');
      this.notifyModelChanged();
      this.logger.debug('Model changed notification sent (toggle)');
    } else {
      this.logger.debug('No immediate model switch needed', {
        autoOpus: this.autoOpusEnabled,
        mode: this.currentPermissionMode,
        model: this.currentModel
      });
    }
    this.logger.debug('toggleAutoOpus completed');
  }

  /**
   * Handle plan mode changes - automatically switches to Opus in plan mode if auto-opus is enabled
   * 
   * @param {boolean} isPlanMode - Whether plan mode is being entered or exited
   * @returns {Promise<void>}
   */
  async onPlanModeChange(isPlanMode: boolean): Promise<void> {
    this.logger.debug('onPlanModeChange called', { isPlanMode });
    
    // Update current permission mode tracking
    const newMode = isPlanMode ? 'plan' : 'default';
    this.logger.debug('Permission mode tracking', {
      from: this.currentPermissionMode,
      to: newMode
    });
    this.currentPermissionMode = newMode;
    
    if (!this.autoOpusEnabled) {
      this.logger.debug('Auto Opus disabled - skipping plan mode change');
      return; // Auto Opus is disabled
    }

    this.logger.info(`Plan mode change detected: ${isPlanMode ? 'entering' : 'exiting'} plan mode`, {
      isPlanMode,
      currentModel: this.currentModel,
      previousModel: this.previousModel
    });

    if (isPlanMode) {
      // Entering plan mode - switch to Opus if not already
      const opusModel = this.modelConfigManager.getModelNames(ProviderType.CLAUDE).find(m => m === 'opus') || this.modelConfigManager.getDefaultModel(ProviderType.CLAUDE);
      if (this.currentModel !== opusModel) {
        this.logger.info('Plan mode activated - auto-switching to Opus');
        this.previousModel = this.currentModel;
        this.currentModel = opusModel;
        this.saveSettings();
        this.logger.debug('About to notify model changed');
        this.notifyModelChanged();
        this.logger.debug('Model changed notification sent');
      } else {
        this.logger.debug('Already using Opus model in plan mode');
      }
    } else {
      // Exiting plan mode - restore previous model
      const opusModel = this.modelConfigManager.getModelNames(ProviderType.CLAUDE).find(m => m === 'opus') || this.modelConfigManager.getDefaultModel(ProviderType.CLAUDE);
      if (this.currentModel === opusModel && this.previousModel !== opusModel) {
        this.logger.info(`Plan mode deactivated - restoring ${this.previousModel} model`, {
          currentModel: this.currentModel,
          restoringTo: this.previousModel
        });
        this.currentModel = this.previousModel;
        this.saveSettings();
        this.logger.debug('About to notify model changed (restore)');
        this.notifyModelChanged();
        this.logger.debug('Model changed notification sent (restore)');
      } else {
        this.logger.debug('No model restoration needed on plan mode exit');
      }
    }
    this.logger.debug('onPlanModeChange completed');
  }

  /**
   * Handle permission mode changes
   * 
   * @param {string} mode - The new permission mode
   * @returns {Promise<void>}
   */
  async onPermissionModeChange(mode: string): Promise<void> {
    this.logger.debug('onPermissionModeChange called', {
      mode,
      currentMode: this.currentPermissionMode,
      autoOpusEnabled: this.autoOpusEnabled,
      currentModel: this.currentModel
    });
    
    this.currentPermissionMode = mode;
    
    // Call the existing plan mode logic
    const isPlanMode = mode === 'plan';
    this.logger.debug('Calling onPlanModeChange', { isPlanMode });
    await this.onPlanModeChange(isPlanMode);
    this.logger.debug('onPermissionModeChange completed');
  }

  /**
   * Register a callback for model change events
   * 
   * @param {Function} callback - Callback function to receive model changes
   * @returns {void}
   */
  onModelChanged(callback: (model: ModelName) => void): void {
    this.modelChangeCallbacks.push(callback);
  }

  /**
   * Register a callback for auto-opus state changes
   * 
   * @param {Function} callback - Callback function to receive auto-opus state changes
   * @returns {void}
   */
  onAutoOpusChanged(callback: (enabled: boolean) => void): void {
    this.autoOpusChangeCallbacks.push(callback);
  }

  /**
   * Notify all registered callbacks about model changes
   * 
   * @private
   * @returns {void}
   */
  private notifyModelChanged(): void {
    this.logger.debug('notifyModelChanged', {
      model: this.currentModel,
      callbackCount: this.modelChangeCallbacks.length
    });
    this.modelChangeCallbacks.forEach((callback, index) => {
      try {
        this.logger.debug(`Calling model change callback ${index + 1}/${this.modelChangeCallbacks.length}`);
        callback(this.currentModel);
        this.logger.debug(`Model change callback ${index + 1} completed successfully`);
      } catch (error) {
        this.logger.error(`Error in model change callback ${index + 1}:`, { error });
      }
    });
    this.logger.debug('All model change callbacks completed');
  }

  /**
   * Notify all registered callbacks about auto-opus state changes
   * 
   * @private
   * @returns {void}
   */
  private notifyAutoOpusChanged(): void {
    this.autoOpusChangeCallbacks.forEach(callback => {
      try {
        callback(this.autoOpusEnabled);
      } catch (error) {
        this.logger.error('Error in auto opus change callback:', { error });
      }
    });
  }

  /**
   * Load settings from storage
   * 
   * @private
   * @returns {void}
   */
  private loadSettings(): void {
    const defaultSettings = {
      currentModel: this.modelConfigManager.getDefaultModel(ProviderType.CLAUDE),
      autoOpusEnabled: false,
      previousModel: this.modelConfigManager.getDefaultModel(ProviderType.CLAUDE)
    };
    
    const settings = this.storageService.getItem('claude-model-settings', defaultSettings);
    if (settings) {
      this.currentModel = settings.currentModel || this.modelConfigManager.getDefaultModel(ProviderType.CLAUDE);
      this.autoOpusEnabled = settings.autoOpusEnabled || false;
      this.previousModel = settings.previousModel || this.modelConfigManager.getDefaultModel(ProviderType.CLAUDE);
      this.logger.debug('Loaded settings', { 
        model: this.currentModel, 
        autoOpus: this.autoOpusEnabled 
      });
    }
  }

  /**
   * Save settings to storage
   * 
   * @private
   * @returns {void}
   */
  private saveSettings(): void {
    const settings = {
      currentModel: this.currentModel,
      autoOpusEnabled: this.autoOpusEnabled,
      previousModel: this.previousModel
    };
    
    const success = this.storageService.setItem('claude-model-settings', settings);
    if (success) {
      this.logger.debug('Settings saved', { 
        model: this.currentModel, 
        autoOpus: this.autoOpusEnabled 
      });
    } else {
      this.logger.debug('localStorage not available - settings saved in memory only');
    }
  }

  /**
   * Get the model alias for Claude CLI --model flag
   * 
   * @returns {string} The model name for CLI usage
   */
  getClaudeCliModelFlag(): string {
    return this.currentModel || this.modelConfigManager.getDefaultModel(ProviderType.CLAUDE); // Use the alias directly
  }
}