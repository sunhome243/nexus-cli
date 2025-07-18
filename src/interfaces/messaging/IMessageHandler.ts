/**
 * Message Handler Interfaces
 * Defines handler contracts for command and query processing
 */

import { ISendMessageCommand, IStreamMessageCommand, IProcessResponseCommand } from './IMessageCommand.js';
import { IGetMessageHistoryQuery, IGetStreamingStatusQuery, IValidateMessageQuery, IMessageHistoryResult, IStreamingStatusResult, IValidationResult } from './IMessageQuery.js';

export interface ICommandHandler<TCommand, TResult = void> {
  handle(command: TCommand): Promise<TResult>;
}

export interface IQueryHandler<TQuery, TResult> {
  handle(query: TQuery): Promise<TResult>;
}

// Command Handlers
export interface ISendMessageCommandHandler extends ICommandHandler<ISendMessageCommand, string> {}
export interface IStreamMessageCommandHandler extends ICommandHandler<IStreamMessageCommand, void> {}
export interface IProcessResponseCommandHandler extends ICommandHandler<IProcessResponseCommand, void> {}

// Query Handlers
export interface IGetMessageHistoryQueryHandler extends IQueryHandler<IGetMessageHistoryQuery, IMessageHistoryResult> {}
export interface IGetStreamingStatusQueryHandler extends IQueryHandler<IGetStreamingStatusQuery, IStreamingStatusResult> {}
export interface IValidateMessageQueryHandler extends IQueryHandler<IValidateMessageQuery, IValidationResult> {}