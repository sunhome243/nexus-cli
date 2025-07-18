/**
 * Message Command Interfaces
 * Defines command contracts for message processing pipeline
 */

import { IProviderStreamingCallbacks, IProviderResponse } from '../core/IProvider.js';

export interface IMessageCommand {
  messageId: string;
  timestamp: Date;
  provider: string;
}

export interface ISendMessageCommand extends IMessageCommand {
  content: string;
  userId: string;
  sessionId: string;
}

export interface IStreamMessageCommand extends IMessageCommand {
  content: string;
  userId: string;
  sessionId: string;
  callbacks: IStreamingCallbacks;
}

export interface IProcessResponseCommand extends IMessageCommand {
  response: IProviderResponse;
  isStreaming: boolean;
}

// Use the properly typed streaming callbacks from IProvider
export interface IStreamingCallbacks extends IProviderStreamingCallbacks {}