/**
 * Slash Command Parser Service - Command input parsing and processing
 * 
 * @class SlashCommandParserService
 * @implements {ISlashCommandParserService}
 * @description Parses user input to detect slash commands and processes command content with argument substitution.
 */

import { injectable } from 'inversify';
import { ISlashCommandParseResult, ISlashCommandParserService } from '../../interfaces/commands/ISlashCommandParserService.js';

/**
 * Slash Command Parser Service implementation
 * 
 * @class SlashCommandParserService
 * @implements {ISlashCommandParserService}
 * @description Handles parsing of slash command syntax and argument processing.
 */
@injectable()
export class SlashCommandParserService implements ISlashCommandParserService {
  /**
   * Parse user input to determine if it's a slash command
   * 
   * @param {string} input - Raw user input to parse
   * @returns {ISlashCommandParseResult} Parsed command information
   * @description Analyzes input for slash command syntax and extracts command name and arguments.
   */
  public parseInput(input: string): ISlashCommandParseResult {
    const trimmedInput = input.trim();

    // Check if it's a slash command
    if (!trimmedInput.startsWith('/')) {
      return {
        isSlashCommand: false,
      };
    }

    // Just "/" means list all commands
    if (trimmedInput === '/') {
      return {
        isSlashCommand: true,
        isListRequest: true,
      };
    }

    // Parse command and arguments
    const parts = trimmedInput.slice(1).split(' ');
    const commandName = parts[0];
    const argumentsText = parts.slice(1).join(' ');

    return {
      isSlashCommand: true,
      commandName,
      arguments: argumentsText.length > 0 ? argumentsText : undefined,
      isListRequest: false,
    };
  }

  /**
   * Process command content by replacing $ARGUMENTS placeholder
   * 
   * @param {string} content - Command template content
   * @param {string} [args] - Optional arguments to substitute
   * @returns {string} Processed content with arguments substituted
   * @description Replaces $ARGUMENTS placeholders in command templates with provided arguments.
   */
  public processCommandContent(content: string, args?: string): string {
    if (!args) {
      return content.replace(/\$ARGUMENTS/g, '');
    }

    return content.replace(/\$ARGUMENTS/g, args);
  }
}

// Export the interface
