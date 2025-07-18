/**
 * Gemini File Handler Interface
 * Defines the contract for Gemini file handling operations
 */

export interface IGeminiFileHandler {
  /**
   * Initialize the handler
   */
  initialize(): Promise<void>;

  /**
   * Cleanup the handler
   */
  cleanup(): Promise<void>;

  /**
   * Handle file synchronization
   */
  handleSync(filePath: string, content: string): Promise<void>;

  /**
   * Read file content
   */
  readFile(filePath: string): Promise<string>;

  /**
   * Write file content
   */
  writeFile(filePath: string, content: string): Promise<void>;

  /**
   * Check if file exists
   */
  fileExists(filePath: string): Promise<boolean>;

  /**
   * Get file metadata
   */
  getFileMetadata(filePath: string): Promise<any>;
}