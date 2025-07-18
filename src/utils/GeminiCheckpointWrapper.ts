/**
 * GeminiCheckpointWrapper - Enhanced core integration with gemini-cli-core
 * Provides optimized checkpoint functionality using exact same logic as /chat save and /chat resume
 * Integrated with core Config, GeminiClient, and session management patterns
 */

import { Config, Logger, GeminiClient, GeminiChat, AuthType } from "@google/gemini-cli-core";
import { getCoreSystemPrompt } from "@google/gemini-cli-core";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { LoggerService } from "../services/core/LoggerService.js";

// Type definitions for Gemini response structures
interface GeminiResponsePart {
  text?: string;
  thought?: boolean;
}

interface GeminiResponseContent {
  parts: GeminiResponsePart[];
}

interface GeminiResponseCandidate {
  content?: GeminiResponseContent;
}

interface GeminiResponse {
  candidates?: GeminiResponseCandidate[];
}

interface GeminiHistoryItem {
  role: string;
  parts: GeminiResponsePart[];
}

interface GeminiLoggerWithInternals extends Logger {
  _checkpointPath: (tag: string) => string;
}


// Utility function to extract text from response
function getResponseText(response: GeminiResponse): string | undefined {
  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) {
    return undefined;
  }
  const textSegments = parts
    .map((part: GeminiResponsePart) => part.text)
    .filter((text: string | undefined): text is string => typeof text === "string");

  if (textSegments.length === 0) {
    return undefined;
  }
  return textSegments.join("");
}

export class GeminiCheckpointWrapper {
  private config: Config | null = null;
  private logger: Logger | null = null;
  private client: GeminiClient | null = null;
  private chat: GeminiChat | null = null;
  private projectLogger = new LoggerService();
  private initialized = false;
  private sessionId: string = "";
  private isThinkingEnabled = false;
  private sharedChat: GeminiChat | null = null; // Shared chat instance from provider

  constructor(config?: Config, sharedChat?: GeminiChat) {
    if (config) {
      this.config = config;
    }
    if (sharedChat) {
      this.sharedChat = sharedChat;
      this.chat = sharedChat; // Use shared chat directly
    }
  }

  /**
   * Initialize the wrapper with enhanced core integration
   */
  async initialize(): Promise<void> {
    try {
      // Use existing config if provided, otherwise create new one
      let config: Config;
      if (this.config) {
        config = this.config;
        // Extract sessionId from existing config
        this.sessionId = (config as any).sessionId;
      } else {
        // Generate optimized session ID for core integration
        this.sessionId = `gemini-ui-core-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        // Create optimized config parameters for core integration
        const configParams = {
          sessionId: this.sessionId,
          targetDir: process.cwd(),
          debugMode: false,
          cwd: process.cwd(),
          model: "gemini-2.0-flash-exp", // Use latest available model for optimal performance
          checkpointing: true,
          approvalMode: "default" as any,
          accessibility: {
            disableLoadingPhrases: false,
          },
          telemetry: {
            enabled: false,
            logPrompts: false,
          },
          usageStatisticsEnabled: false,
          fileFiltering: {
            respectGitIgnore: true,
            enableRecursiveFileSearch: true, // Enable for better file discovery
          },
          fullContext: false,
          showMemoryUsage: false,
          // Enhanced core integration settings
          coreTools: undefined, // Use all available core tools
          excludeTools: undefined,
        };

        // Create optimized config instance with enhanced error handling
        try {
          config = new Config(configParams);
          this.config = config;

          // Config is already initialized in constructor
        } catch (configError) {
          throw new Error(`Failed to create enhanced Config instance: ${configError}`);
        }
      }

      // Verify config is available
      if (!config) {
        throw new Error("Config instance is null");
      }

      // Refresh authentication with enhanced error handling
      await config.refreshAuth(AuthType.LOGIN_WITH_GOOGLE);

      // Get optimized client instance from enhanced config
      this.client = config.getGeminiClient();
      if (!this.client) {
        throw new Error(
          'Failed to get enhanced Gemini client after auth refresh. Please run "gemini auth login" first.'
        );
      }

      // Verify auth configuration for enhanced integration
      // const authType = config.getContentGeneratorConfig()?.authType;

      // Use shared chat instance if provided, otherwise create new one with proper systemInstruction
      if (this.sharedChat) {
        this.chat = this.sharedChat;
      } else {
        // Create new chat using startChat() method like gemini-cli does
        // This ensures proper systemInstruction integration
        await this.createChatWithSystemInstruction();
      }

      // Enable optimized thinking support based on model capabilities
      this.enableOptimizedThinkingSupport();

      // Apply enhanced record history patch for better content handling
      this.patchRecordHistory();

      // Create optimized logger for checkpoint functionality
      this.logger = new Logger(this.sessionId);
      if (!this.logger) {
        throw new Error("Failed to create enhanced Logger instance");
      }

      await this.logger.initialize();

      this.initialized = true;
    } catch (error) {
      // Enhanced error reporting for debugging
      if (error instanceof Error) {
        if (error.message.includes("API key") || error.message.includes("authentication")) {
          throw new Error(`Gemini API authentication failed: ${error.message}`);
        } else if (error.message.includes("client")) {
          throw new Error(`Gemini client creation failed: ${error.message}`);
        } else {
          throw new Error(`Failed to initialize GeminiCheckpointWrapper: ${error.message}`);
        }
      } else {
        throw new Error(`Failed to initialize GeminiCheckpointWrapper: ${String(error)}`);
      }
    }
  }

  /**
   * Send message to chat and get response
   * Same chat instance = persistent session with conversation history
   */
  async sendMessage(message: string): Promise<string> {
    this.ensureInitialized();

    try {
      if (!this.chat) {
        throw new Error("Chat instance not available");
      }

      const prompt_id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Send message - this returns immediately after API response
      const response = await this.chat.sendMessage({ message }, prompt_id);

      // Wait for the sendPromise to ensure history is recorded
      // This leverages the same synchronization pattern used by gemini-cli
      const chatWithInternals = this.chat as any;
      if (chatWithInternals.sendPromise) {
        await chatWithInternals.sendPromise;
      }

      // Now history is guaranteed to be updated with both user and model responses
      const responseText = getResponseText(response as any);

      if (!responseText) {
        throw new Error("No response text received from Gemini");
      }

      return responseText;
    } catch (error) {
      throw new Error(`Failed to send message: ${error}`);
    }
  }

  /**
   * Save checkpoint using EXACT same logic as /chat save
   */
  async saveCheckpoint(tag: string): Promise<void> {
    this.ensureInitialized();

    try {
      if (!this.chat || !this.logger) {
        throw new Error("Chat or Logger not available");
      }

      // Get conversation history - same as /chat save logic
      const rawHistory = this.chat.getHistory();

      // Use history directly - let core handle validation
      const validatedHistory = rawHistory;

      const checkpointPath = this.getCheckpointPath(tag);

      if (validatedHistory.length === 0) {
        // Create empty checkpoint for initialization
        await this.logger.saveCheckpoint([], tag);
      } else {
        // Check for potential issues before saving
        // Validation removed - trust gemini-cli-core

        // Save checkpoint with validated history

        // Ensure logger throws errors instead of silently failing
        const originalSaveCheckpoint = this.logger.saveCheckpoint.bind(this.logger);
        const loggerRef = this.logger;
        const projectLoggerRef = this.projectLogger;
        this.logger.saveCheckpoint = async function (conversation: GeminiHistoryItem[], tag: string): Promise<void> {
          const path = (loggerRef as GeminiLoggerWithInternals)._checkpointPath(tag);
          try {
            const { promises: fs } = await import("fs");
            await fs.writeFile(path, JSON.stringify(conversation, null, 2), "utf-8");
          } catch (error) {
            projectLoggerRef.error(`[CHECKPOINT SAVE] Error writing to checkpoint file: ${path}`, { error, path });
            throw new Error(`Failed to write checkpoint file: ${error}`);
          }
        };

        await this.logger.saveCheckpoint(validatedHistory, tag);

        // Restore original method
        this.logger.saveCheckpoint = originalSaveCheckpoint;
      }

      // Verify the file was actually written
      const { existsSync } = await import("fs");
      const fileExists = existsSync(checkpointPath);

      if (fileExists) {
        this.projectLogger.debug(`[CHECKPOINT SAVE] Checkpoint file verified: ${checkpointPath}`);
      }
    } catch (error) {
      this.projectLogger.error(`[CHECKPOINT SAVE] Failed to save checkpoint`, { error, tag });
      throw new Error(`Failed to save checkpoint: ${error}`);
    }
  }

  /**
   * Resume from checkpoint using EXACT same logic as /chat resume
   */
  async resumeFromCheckpoint(tag: string): Promise<void> {
    this.ensureInitialized();

    try {
      if (!this.chat || !this.logger) {
        throw new Error("Chat or Logger not available");
      }

      // Load checkpoint - same as /chat resume logic
      const rawConversation = await this.logger.loadCheckpoint(tag);

      if (rawConversation.length === 0) {
        this.projectLogger.warn(`[CHECKPOINT RESUME] No saved checkpoint found with tag: ${tag}`, { tag });
        return;
      }

      const conversation = rawConversation; // Use conversation directly - let core handle validation

      if (conversation.length === 0) {
        this.projectLogger.warn(`Checkpoint contained only duplicates or invalid data - starting with empty state`, {
          tag,
        });
        return;
      }

      // Clear existing chat history but keep chat instance for session continuity

      // Clear existing history without creating fresh instance (preserve session context)
      if (this.chat) {
        // Clear the history manually instead of creating fresh instance
        (this.chat as any).history = [];
      } else {
        this.projectLogger.error(`[CHECKPOINT RESUME] No chat instance available for restore!`, { tag });
        throw new Error("No chat instance available for checkpoint restore");
      }

      // Add each item back to chat history - same as /chat resume logic
      for (let i = 0; i < conversation.length; i++) {
        const item = conversation[i];
        this.chat.addHistory(item);

        // Validate each addition to catch duplication early
        const currentHistory = this.chat.getHistory();
        if (currentHistory.length !== i + 1) {
          this.projectLogger.warn(
            `History length mismatch at item ${i}: expected ${i + 1}, got ${currentHistory.length}`,
            { i, expectedLength: i + 1, actualLength: currentHistory.length }
          );
        }
      }

      // Final validation
      const finalHistory = this.chat.getHistory();

      if (finalHistory.length !== conversation.length) {
        this.projectLogger.error(
          `History length mismatch after restore: expected ${conversation.length}, got ${finalHistory.length}`,
          { expectedLength: conversation.length, actualLength: finalHistory.length, tag }
        );
        throw new Error(`Checkpoint restore failed: history length mismatch`);
      }

      // Final verification - log a sample of the restored conversation
      const restoredHistory = this.chat.getHistory();
      if (restoredHistory.length > 0) {
        this.projectLogger.debug(`[CHECKPOINT RESUME] Restored ${restoredHistory.length} conversation items`);
      }
    } catch (error) {
      this.projectLogger.error(`[CHECKPOINT RESUME] Failed to resume from checkpoint`, { error, tag });
      throw new Error(`Failed to resume from checkpoint: ${error}`);
    }
  }

  /**
   * Create chat with system instruction exactly like gemini-cli does
   * Uses getCoreSystemPrompt and proper generationConfig
   */
  private async createChatWithSystemInstruction(): Promise<void> {
    if (!this.client || !this.config) {
      throw new Error("Client or config not available for chat creation");
    }

    try {
      // Get user memory and create system instruction exactly like gemini-cli
      const userMemory = this.config.getUserMemory();
      const systemInstruction = getCoreSystemPrompt(userMemory);
      
      // Get content generator and tools like gemini-cli does
      const contentGenerator = this.client.getContentGenerator();
      
      // Create generation config with systemInstruction like gemini-cli
      const generationConfig = {
        systemInstruction,
        // Add thinking support if available
        ...(this.isThinkingEnabled ? {
          thinkingConfig: {
            includeThoughts: true,
          }
        } : {})
      };

      // Create empty history (no environment context for checkpointing)
      const history: any[] = [];

      // Create GeminiChat exactly like gemini-cli does
      const { GeminiChat } = await import("@google/gemini-cli-core");
      this.chat = new GeminiChat(
        this.config,
        contentGenerator,
        generationConfig,
        history
      );

      this.projectLogger.info(`[CHAT CREATION] Created chat with systemInstruction for session ${this.sessionId}`);
    } catch (error) {
      this.projectLogger.error(`[CHAT CREATION] Failed to create chat with systemInstruction`, { error, sessionId: this.sessionId });
      throw new Error(`Failed to create chat with system instruction: ${error}`);
    }
  }

  /**
   * Create initial fresh checkpoint (Session Creation Mode)
   * Creates empty checkpoint like gemini-cli does for new sessions
   */
  async initializeCheckpoint(tag: string): Promise<void> {
    await this.initialize();

    // Save empty checkpoint (like gemini-cli does for new chats)
    await this.saveCheckpoint(tag);
  }

  /**
   * Get checkpoint file path for a given tag
   */
  getCheckpointPath(tag: string): string {
    // Don't require initialization - construct path directly
    const projectHash = crypto.createHash('sha256').update(process.cwd()).digest('hex');
    const geminiDir = path.join(os.homedir(), '.gemini', 'tmp', projectHash);
    return path.join(geminiDir, `checkpoint-${tag}.json`);
  }

  /**
   * Check if a checkpoint file exists for a given tag
   */
  checkpointExists(tag: string): boolean {
    try {
      // Don't require initialization - just check if file exists
      const projectHash = crypto.createHash('sha256').update(process.cwd()).digest('hex');
      const geminiDir = path.join(os.homedir(), '.gemini', 'tmp', projectHash);
      const checkpointPath = path.join(geminiDir, `checkpoint-${tag}.json`);
      
      const exists = fs.existsSync(checkpointPath);
      this.projectLogger.info(`[CHECKPOINT CHECK] Checking checkpoint for tag ${tag}: ${exists}`, { 
        tag, 
        checkpointPath,
        exists 
      });
      return exists;
    } catch (error) {
      this.projectLogger.warn(`Failed to check checkpoint existence for tag ${tag}`, { error, tag });
      return false;
    }
  }

  /**
   * Get current conversation history
   */
  getConversationHistory(): GeminiHistoryItem[] {
    this.ensureInitialized();

    if (!this.chat) {
      return [];
    }

    return this.chat.getHistory() as any;
  }

  /**
   * Get chat instance for debugging
   */
  getChatInstance(): GeminiChat | null {
    return this.chat;
  }

  /**
   * Get client instance for configuration access
   */
  getClient(): GeminiClient | null {
    return this.client;
  }

  /**
   * Enable optimized thinking support based on model capabilities
   * Enhanced implementation for better core integration
   */
  private enableOptimizedThinkingSupport(): void {
    if (!this.client || !this.config) {
      this.projectLogger.warn("Cannot enable optimized thinking support: client or config not available");
      return;
    }

    try {
      const model = this.config.getModel();
      const isThinkingSupported = model.includes("2.0") || model.includes("2.5");

      if (!isThinkingSupported) {
        this.isThinkingEnabled = false;
        return;
      }

      // Enhanced thinking configuration for better performance
      const clientWithConfig = this.client as any;
      if (clientWithConfig.generateContentConfig) {
        clientWithConfig.generateContentConfig = {
          ...clientWithConfig.generateContentConfig,
          thinkingConfig: {
            includeThoughts: true,
            // Enhanced thinking settings for better UI integration
            streamThoughts: true,
            enableAdvancedReasoning: true,
          },
        };
        this.isThinkingEnabled = true;
      } else {
        this.projectLogger.warn(
          "Cannot access generateContentConfig - optimized thinking support may not be available"
        );
        this.isThinkingEnabled = false;
      }
    } catch (error) {
      this.projectLogger.warn("Failed to enable optimized thinking support", { error });
      this.isThinkingEnabled = false;
    }
  }

  /**
   * Get enhanced configuration information
   */
  getConfigInfo(): {
    sessionId: string;
    model: string;
    thinkingEnabled: boolean;
    checkpointingEnabled: boolean;
  } {
    return {
      sessionId: this.sessionId,
      model: this.config?.getModel() || "unknown",
      thinkingEnabled: this.isThinkingEnabled,
      checkpointingEnabled: this.config?.getCheckpointingEnabled() || false,
    };
  }

  /**
   * Fix the recordHistory method to properly handle mixed thought/response content
   * The issue: isThoughtContent() filters out entire responses that contain thought parts
   * The fix: Filter out thought parts at the part level, not content level
   */
  private patchRecordHistory(): void {
    if (!this.chat) return;

    const chatWithInternals = this.chat as any;

    // Store reference to original methods
    const originalRecordHistory = chatWithInternals.recordHistory.bind(this.chat);

    // Override isThoughtContent to only return true if ALL parts are thoughts
    chatWithInternals.isThoughtContent = function (content: GeminiResponseContent): boolean {
      if (!content || !content.parts || content.parts.length === 0) {
        return false;
      }

      // Only consider it thought content if ALL parts are thoughts
      return content.parts.every((part: GeminiResponsePart) => part.thought === true);
    };

    // Override recordHistory to filter thought parts at part level
    chatWithInternals.recordHistory = function (userInput: unknown, modelOutput: GeminiResponseContent[], automaticFunctionCallingHistory?: unknown[]) {
      // Filter thought parts from model output while preserving response content
      const filteredModelOutput = modelOutput
        .map((content) => {
          if (!content || !content.parts) return content;

          // Filter out individual thought parts but keep response parts
          const nonThoughtParts = content.parts.filter((part: GeminiResponsePart) => part.thought !== true);

          if (nonThoughtParts.length === 0) {
            // If all parts are thoughts, return empty content
            return {
              ...content,
              parts: [],
            };
          }

          // Return content with only non-thought parts
          return {
            ...content,
            parts: nonThoughtParts,
          };
        })
        .filter((content) => content.parts && content.parts.length > 0); // Remove empty contents

      // Call original recordHistory with filtered content
      return originalRecordHistory.call(this, userInput, filteredModelOutput, automaticFunctionCallingHistory);
    };
  }

  /**
   * Check if wrapper is properly initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("GeminiCheckpointWrapper not initialized. Call initialize() first.");
    }
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    // Cleanup if needed
    this.initialized = false;
    this.config = null;
    this.logger = null;
    this.client = null;
    this.chat = null;
  }
}
