export interface ISlashCommand {
  name: string;
  description?: string;
  filePath: string;
  content: string;
  subdirectory?: string;
}

export interface ISlashCommandExecutionResult {
  success: boolean;
  processedContent: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ISlashCommandListItem {
  name: string;
  description: string;
  subdirectory?: string;
}