/**
 * AskModel Socket Service
 * Handles socket communication between askModel MCP server and main app
 * Routes askModel requests through SessionManager to use authenticated sessions
 */

import { injectable, inject } from 'inversify';
import * as net from 'node:net';
import * as fs from 'node:fs';
import { TYPES } from '../../infrastructure/di/types.js';
import { ILoggerService } from '../../interfaces/index.js';
import { ISessionManager } from '../../interfaces/core/ISessionManager.js';
import { ProviderType } from '../../abstractions/providers/types.js';

export interface IAskModelRequest {
  requestId: string;
  model: ProviderType;
  prompt: string;
  timestamp: string;
}

export interface IAskModelResponse {
  requestId: string;
  text: string;
  error?: string;
  timestamp: string;
}

@injectable()
export class AskModelSocketService {
  private socketServer: net.Server | null = null;
  private socketPath: string;
  private isInitialized = false;

  constructor(
    @inject(TYPES.LoggerService) private logger: ILoggerService,
    @inject(TYPES.SessionManager) private sessionManager: ISessionManager
  ) {
    const sessionId = process.env.SESSION_ID || 'default';
    this.socketPath = `/tmp/mcp-askmodel-${sessionId}.sock`;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logger.info('Initializing AskModel Socket Service');
      
      // Remove existing socket file if it exists
      if (fs.existsSync(this.socketPath)) {
        this.logger.info(`Removing existing socket file at ${this.socketPath}`);
        try {
          fs.unlinkSync(this.socketPath);
        } catch (error) {
          this.logger.error('Failed to remove existing socket', { error });
        }
      }

      // Create socket server
      this.createSocketServer();
      
      this.isInitialized = true;
      this.logger.info('AskModel Socket Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize AskModel Socket Service', { error });
      throw error;
    }
  }

  private createSocketServer(): void {
    this.logger.info(`Creating askModel socket server at ${this.socketPath}`);
    
    this.socketServer = net.createServer((socket) => {
      this.logger.info('Client connected to askModel socket');
      
      // Buffer to accumulate incoming data chunks
      let dataBuffer = '';
      
      socket.on('data', async (data) => {
        try {
          // Append new data to buffer
          dataBuffer += data.toString();
          
          // Try to process complete JSON messages
          while (dataBuffer.length > 0) {
            try {
              // Attempt to parse the accumulated data
              const request: IAskModelRequest = JSON.parse(dataBuffer);
              
              // If we successfully parsed, clear the buffer and process the request
              dataBuffer = '';
              
              this.logger.info('Received askModel request', {
                requestId: request.requestId,
                model: request.model,
                promptLength: request.prompt.length
              });
              
              // Handle the askModel request
              const response = await this.handleAskModelRequest(request);
              
              // Send response back to MCP server
              socket.write(JSON.stringify(response));
              
              // Break out of the loop since we processed the message
              break;
            } catch (parseError) {
              // If JSON parsing failed, check if it's due to incomplete data
              if (parseError instanceof SyntaxError && 
                  (parseError.message.includes('Unexpected end of JSON input') ||
                   parseError.message.includes('Unterminated string'))) {
                // Data is incomplete, wait for more chunks
                this.logger.debug('Waiting for more data chunks...');
                break;
              } else {
                // This is a real JSON error, not just incomplete data
                throw parseError;
              }
            }
          }
        } catch (error) {
          this.logger.error('Error handling askModel request', { error });
          
          // Clear the buffer on error
          dataBuffer = '';
          
          // Send error response
          const errorResponse: IAskModelResponse = {
            requestId: 'unknown',
            text: '',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          };
          socket.write(JSON.stringify(errorResponse));
        }
      });
      
      socket.on('error', (error) => {
        this.logger.error('Socket error', { error });
        // Close the socket to prevent memory leaks
        socket.destroy();
      });
      
      socket.on('close', () => {
        this.logger.debug('Client disconnected from askModel socket');
      });
    });
    
    this.socketServer.listen(this.socketPath, () => {
      this.logger.info(`AskModel socket server listening on ${this.socketPath}`);
    });
    
    this.socketServer.on('error', (error) => {
      this.logger.error('Socket server error', { error });
    });
  }

  private async handleAskModelRequest(request: IAskModelRequest): Promise<IAskModelResponse> {
    try {
      // Validate request
      if (!request.requestId || !request.model || !request.prompt) {
        throw new Error('Invalid askModel request: missing required fields');
      }

      // Get current provider
      const currentProvider = this.sessionManager.getCurrentProvider();
      this.logger.info(`Current provider: ${currentProvider}, requested model: ${request.model}`);

      // Use executeAskModel if available, otherwise fall back to sendMessage
      let responseText;
      if (this.sessionManager.executeAskModel) {
        // Use the new executeAskModel method that can target specific providers
        responseText = await this.sessionManager.executeAskModel(request.model, request.prompt);
      } else {
        // Fallback to sending message with current provider
        if (currentProvider !== request.model) {
          this.logger.warn(`Cannot switch from ${currentProvider} to ${request.model} - using current provider`);
        }
        responseText = await this.sessionManager.sendMessage(request.prompt);
      }
      
      // Log response details for debugging
      this.logger.debug('askModel response received', {
        hasResponse: !!responseText,
        responseLength: typeof responseText === 'string' ? responseText.length : 0,
        responseType: typeof responseText
      });
      
      return {
        requestId: request.requestId,
        text: responseText || 'No response received',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Error executing askModel request', { error });
      
      return {
        requestId: request.requestId,
        text: '',
        error: error instanceof Error ? error.message : 'Failed to execute askModel request',
        timestamp: new Date().toISOString()
      };
    }
  }

  async cleanup(): Promise<void> {
    try {
      this.logger.info('Cleaning up AskModel Socket Service');
      
      if (this.socketServer) {
        this.socketServer.close();
        this.socketServer = null;
      }
      
      // Remove socket file
      if (fs.existsSync(this.socketPath)) {
        try {
          fs.unlinkSync(this.socketPath);
          this.logger.info('Removed askModel socket file');
        } catch (error) {
          this.logger.error('Failed to remove socket file', { error });
        }
      }
      
      this.isInitialized = false;
      this.logger.info('AskModel Socket Service cleanup completed');
    } catch (error) {
      this.logger.error('Error during cleanup', { error });
    }
  }
}

export interface IAskModelSocketService {
  initialize(): Promise<void>;
  cleanup(): Promise<void>;
}