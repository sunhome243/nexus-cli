/**
 * Cross-Provider Tool Execution Strategy - Inter-AI consultation and communication
 * 
 * @class CrossProviderToolExecutionStrategy
 * @implements {IToolExecutionStrategy}
 * @description Handles askModel tool calls for cross-provider AI consultation.
 * Enables Gemini to consult Claude for collaborative problem-solving with session isolation.
 */

import { injectable, inject } from "inversify";
import { TYPES } from "../../../infrastructure/di/types.js";
import {
  IToolExecutionStrategy,
  IToolExecutionContext,
  IToolExecutionResult,
} from "../../../interfaces/tools/IToolExecutionStrategy.js";
import { ILoggerService } from "../../../interfaces/core/ILoggerService.js";
import { ClaudeProvider } from "../../providers/claude/ClaudeProvider.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Container } from "inversify";
import { ProviderType } from "../../../abstractions/providers/types.js";
import { IProvider } from "../../../interfaces/core/IProvider.js";

/**
 * Cross-Provider Tool Execution Strategy implementation
 * 
 * @class CrossProviderToolExecutionStrategy
 * @implements {IToolExecutionStrategy}
 * @description Manages inter-provider communication through the askModel tool.
 * Provides secure, session-isolated consultation between AI providers.
 */
@injectable()
export class CrossProviderToolExecutionStrategy implements IToolExecutionStrategy {
  constructor(
    @inject(TYPES.LoggerService) private logger: ILoggerService,
    @inject("Container") private container: Container
  ) {}

  /**
   * Check if this strategy can handle the tool execution context
   * 
   * @param {IToolExecutionContext} context - Tool execution context
   * @returns {boolean} True if this strategy handles askModel tools
   */
  canHandle(context: IToolExecutionContext): boolean {
    return context.toolName === "askModel";
  }

  /**
   * Execute cross-provider tool consultation
   * 
   * @param {IToolExecutionContext} context - Tool execution context with parameters
   * @returns {Promise<IToolExecutionResult>} Consultation result from target provider
   * @description Validates parameters and routes consultation to appropriate provider.
   */
  async execute(context: IToolExecutionContext): Promise<IToolExecutionResult> {
    const startTime = Date.now();

    try {
      const args = context.args as { model?: string; prompt?: string; sessionTag?: string };
      const { model, prompt, sessionTag } = args;

      if (!model || !prompt) {
        return {
          success: false,
          error: "Missing required parameters: model and prompt",
          executionTime: Date.now() - startTime,
          metadata: {
            strategy: "cross-provider",
            toolName: context.toolName,
          },
        };
      }

      this.logger.info(`[CrossProvider] Handling askModel request`, {
        targetModel: model,
        sessionId: context.sessionId,
        sessionTag: sessionTag,
        promptLength: prompt.length,
      });

      // Use sessionTag from args if provided, otherwise fall back to context.sessionId
      const effectiveSessionTag = sessionTag || context.sessionId;

      if (model === ProviderType.CLAUDE) {
        return await this.consultClaude(context, prompt, startTime, effectiveSessionTag);
      } else if (model === ProviderType.GEMINI) {
        // Check if this is Gemini trying to consult itself
        if (context.provider === ProviderType.GEMINI) {
          return {
            success: false,
            error:
              'Gemini cannot consult itself. To use the askModel tool, please specify model: "claude" to consult Claude.',
            executionTime: Date.now() - startTime,
            metadata: {
              strategy: "cross-provider",
              toolName: context.toolName,
              note: "Self-consultation prevented to avoid infinite loops",
            },
          };
        }
        // If called from Claude, we would implement Gemini consultation here
        return {
          success: false,
          error: "Gemini consultation from Claude is not yet implemented",
          executionTime: Date.now() - startTime,
          metadata: {
            strategy: "cross-provider",
            toolName: context.toolName,
          },
        };
      } else {
        return {
          success: false,
          error: `Unknown model: ${model}. Available models: claude`,
          executionTime: Date.now() - startTime,
          metadata: {
            strategy: "cross-provider",
            toolName: context.toolName,
          },
        };
      }
    } catch (error) {
      this.logger.error("[CrossProvider] Tool execution failed", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime: Date.now() - startTime,
        metadata: {
          strategy: "cross-provider",
          toolName: context.toolName,
        },
      };
    }
  }

  /**
   * Consult Claude provider for collaborative analysis
   * 
   * @param {IToolExecutionContext} context - Tool execution context
   * @param {string} prompt - Consultation prompt for Claude
   * @param {number} startTime - Execution start timestamp
   * @param {string} sessionTag - Session identifier for context isolation
   * @returns {Promise<IToolExecutionResult>} Claude's consultation response
   * @description Initializes Claude provider, loads session context, and executes consultation.
   * @private
   */
  private async consultClaude(
    context: IToolExecutionContext,
    prompt: string,
    startTime: number,
    sessionTag: string
  ): Promise<IToolExecutionResult> {
    try {
      // Get ClaudeProvider from DI container
      const claudeProvider = this.container.get<ClaudeProvider>(TYPES.ClaudeProvider);

      // Initialize provider
      await claudeProvider.initialize();
      this.logger.info(`[CrossProvider] Claude provider initialized`);

      // Read current Claude session ID from ref file (read-only)
      const refPath = path.join(process.cwd(), ".nexus", "claude-ref", `tagged-${sessionTag}.ref`);
      let sessionId: string;

      try {
        sessionId = (await fs.readFile(refPath, "utf-8")).trim();
        this.logger.info(`[CrossProvider] Read Claude session ID from ref: ${sessionId}`);
      } catch (error) {
        this.logger.error(`[CrossProvider] Failed to read Claude ref file`, { error, refPath });
        throw new Error(`No Claude session found for tag: ${sessionTag}`);
      }

      // Set session directly without updating ref file
      claudeProvider.currentSessionId = sessionId;

      // Load session content
      const sessionService = (claudeProvider as any).sessionService;
      if (sessionService && sessionService.loadSessionIfNeeded) {
        await sessionService.loadSessionIfNeeded();
        this.logger.info(`[CrossProvider] Claude session loaded`);
      }

      // Prepare consultation prompt
      const consultPrompt = `[CONSULTATION MODE - DO NOT EXECUTE DANGEROUS TOOLS OR DANGEROUS COMMANDS]
${prompt}

Please provide your analysis/thoughts. You may read files and use safe information-gathering tools, but do not execute commands or modify files.`;

      this.logger.info(`[CrossProvider] Sending consultation prompt to Claude`);

      // Get complete response (not streaming)
      const response = await claudeProvider.sendMessage(consultPrompt);

      this.logger.info(`[CrossProvider] Claude consultation complete`, {
        responseLength: response.text.length,
      });

      // Clean up - dispose provider without saving
      await claudeProvider.dispose();

      // Return response
      return {
        success: true,
        result: response.text,
        executionTime: Date.now() - startTime,
        metadata: {
          strategy: "cross-provider",
          consultedModel: ProviderType.CLAUDE,
          sessionTag,
          toolName: context.toolName,
        },
      };
    } catch (error) {
      this.logger.error("[CrossProvider] Failed to consult Claude", { error });
      throw error;
    }
  }

  /**
   * Get the strategy name for identification
   * 
   * @returns {string} Strategy identifier
   */
  getStrategyName(): string {
    return "CrossProviderToolExecution";
  }

  /**
   * Get strategy execution priority
   * 
   * @returns {number} Priority value (higher = more priority)
   * @description High priority for cross-provider operations
   */
  getPriority(): number {
    return 90; // High priority for cross-provider operations
  }
}
