/**
 * Slash Command Parser Service Interface
 * Defines the contract for parsing slash commands
 */

export interface ISlashCommandParseResult {
  isSlashCommand: boolean;
  commandName?: string;
  arguments?: string;
  isListRequest?: boolean;
}

export interface ISlashCommandParserService {
  parseInput(input: string): ISlashCommandParseResult;
  processCommandContent(content: string, args?: string): string;
}