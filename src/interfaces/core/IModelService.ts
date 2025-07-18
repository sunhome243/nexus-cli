import { ModelName } from '../../abstractions/providers/model-types.js';

export interface IModelService {
  getCurrentModel(): ModelName;
  switchModel(model: ModelName): Promise<void>;
  getAutoOpusEnabled(): boolean;
  toggleAutoOpus(): Promise<void>;
  onPlanModeChange(isPlanMode: boolean): Promise<void>;
  onPermissionModeChange(mode: string): Promise<void>;
  getClaudeCliModelFlag(): string;
  
  // Events
  onModelChanged(callback: (model: ModelName) => void): void;
  onAutoOpusChanged(callback: (enabled: boolean) => void): void;
  
  // Extended methods for flexible model support
  getAvailableModels?(): ModelName[];
  isValidModel?(model: ModelName): boolean;
}