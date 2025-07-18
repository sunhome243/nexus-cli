#!/usr/bin/env node

// MCP Server for handling permission approvals - following Claude Code SDK docs
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const net = require('net');
const fs = require('fs');

class PermissionPromptServer {
  constructor() {
    this.server = new Server(
      {
        name: 'permission',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Get session ID from environment or use default
    this.sessionId = process.env.SESSION_ID || 'default';
    this.socketPath = `/tmp/mcp-permission-${this.sessionId}.sock`;
    
    // Bridge mode: Provide both stdio (for Claude CLI) and socket (for UI)
    // console.error('🌉 MCP: Bridge mode - stdio for Claude CLI, socket for UI communication');
    
    // Map to store pending permission requests
    this.pendingResponses = new Map();
    
    // Set to track processed tool use IDs to prevent duplicates
    this.processedToolUseIds = new Set();
    
    // Bridge mode flag
    this.isUsingExistingSocket = false;
    
    // Setup both transports
    this.setupSocketServer();
    this.setupTools();
  }

  setupSocketServer() {
    // Always create socket server for UI responses
    // Remove any existing socket file first
    if (fs.existsSync(this.socketPath)) {
      // console.error(`🧹 MCP: Removing existing socket file at ${this.socketPath}`);
      try {
        fs.unlinkSync(this.socketPath);
      } catch (error) {
        console.error(`❌ MCP: Failed to remove existing socket: ${error.message}`);
      }
    }
    this.createSocketServer();
  }


  createSocketServer() {
    // console.error(`🔌 MCP: Creating socket server at ${this.socketPath}`);
    
    this.socketServer = net.createServer((socket) => {
      // console.error('🔌 MCP: Client connected to permission socket');
      
      socket.on('data', (data) => {
        try {
          const response = JSON.parse(data.toString());
          // console.error('📥 MCP: Received permission response:', response);
          
          // console.error(`🔧 MCP: Processing permission response:`, response);
          // console.error(`🔧 MCP: Current pending requests:`, Array.from(this.pendingResponses.keys()));
          
          // Handle response - if toolUseId is provided, match it, otherwise use first pending request
          let resolverEntry = null;
          let toolUseId = null;
          
          if (response.toolUseId && this.pendingResponses.has(response.toolUseId)) {
            // Exact match with toolUseId
            toolUseId = response.toolUseId;
            resolverEntry = this.pendingResponses.get(toolUseId);
            // console.error(`✅ MCP: Found exact match for toolUseId: ${toolUseId}`);
          } else if (this.pendingResponses.size > 0) {
            // Use first pending request if no toolUseId or no exact match
            const firstKey = this.pendingResponses.keys().next().value;
            toolUseId = firstKey;
            resolverEntry = this.pendingResponses.get(firstKey);
            // console.error(`📝 MCP: Using first pending request: ${toolUseId} (requested: ${response.toolUseId})`);
          }
          
          if (resolverEntry) {
            // console.error(`🔧 MCP: About to resolve permission request with response:`, response);
            resolverEntry.resolve(response);
            this.pendingResponses.delete(toolUseId);
            // console.error(`✅ MCP: Resolved permission request: ${toolUseId}`);
            
            // Send acknowledgment back to UI
            socket.write(JSON.stringify({ success: true, toolUseId }));
          } else {
            console.error(`❌ MCP: No pending requests found`);
            socket.write(JSON.stringify({ success: false, error: 'No pending requests' }));
          }
        } catch (error) {
          console.error('❌ MCP: Error parsing permission response:', error);
          socket.write(JSON.stringify({ success: false, error: 'Invalid JSON' }));
        }
      });
      
      socket.on('error', (error) => {
        console.error('❌ MCP: Socket error:', error);
        // Close the socket to prevent memory leaks
        socket.destroy();
      });
      
      socket.on('close', () => {
        // console.error('🔌 MCP: Client disconnected from permission socket');
      });
    });
    
    this.socketServer.listen(this.socketPath, () => {
      // console.error(`🔌 MCP: Permission socket server listening on ${this.socketPath}`);
    });
    
    this.socketServer.on('error', (error) => {
      console.error('❌ MCP: Socket server error:', error);
    });
  }

  waitForUserResponse(toolUseId) { // No timeout - wait indefinitely for user decision
    return new Promise((resolve, reject) => {
      // Store resolver
      this.pendingResponses.set(toolUseId, { resolve, reject });
    });
  }

  setupTools() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      // Tools list requested by Claude CLI
      const result = {
        tools: [
          {
            name: 'approval_prompt',
            description: 'Handle user permission approval for tool execution',
            inputSchema: {
              type: 'object',
              properties: {
                tool_name: {
                  type: 'string',
                  description: 'Name of the tool requesting permission',
                },
                input: {
                  type: 'object',
                  description: 'Input parameters for the tool',
                  additionalProperties: true,
                },
                tool_use_id: {
                  type: 'string',
                  description: 'The unique tool use request ID',
                  optional: true,
                },
              },
              required: ['tool_name', 'input'],
            },
          },
        ],
      };
      // Returning tools list to Claude CLI
      return result;
    });

    // Handle tool calls - this is where we ask user for permission
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      // CallTool request received from Claude CLI
      console.error(`🔍 MCP: Received tool request: ${request.params.name}`);
      
      // LOG FULL RAW JSON THAT FLOWED INTO MCP
      console.error(`🔍 MCP: === FULL RAW JSON REQUEST ===`);
      console.error(JSON.stringify(request, null, 2));
      console.error(`🔍 MCP: === END RAW JSON REQUEST ===`);
      
      if (request.params.name !== 'approval_prompt') {
        console.error(`❌ MCP Server: Unknown tool: ${request.params.name}`);
        throw new Error(`Unknown tool: ${request.params.name}`);
      }

      const { tool_name, input, tool_use_id } = request.params.arguments;
      console.error(`🔍 MCP: Tool request details - tool: ${tool_name}, toolUseId: ${tool_use_id}`);
      console.error(`🔍 MCP: Full request arguments:`, request.params.arguments);
      // Processing permission request
      
      // Check for duplicate requests
      if (tool_use_id && this.processedToolUseIds.has(tool_use_id)) {
        // Duplicate request detected - returning cached response
        // Return the same response as if it was approved (since it was likely already processed)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                behavior: 'allow',
                updatedInput: input,
              }),
            },
          ],
        };
      }
      
      // Permission requested for tool
      // Processing tool input

      // Check if this is a dangerous operation that needs user approval
      const needsApproval = this.needsUserApproval(tool_name, input);

      if (!needsApproval) {
        // Safe operation - auto-approve
        // Auto-approved safe operation
        const response = {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                behavior: 'allow',
                updatedInput: input,
              }),
            },
          ],
        };
        // Sending auto-approval response to Claude CLI
        return response;
      }

      // Dangerous operation - send permission request to UI via stderr and WAIT for response
      // Dangerous operation requires approval
      
      // Create enhanced permission request for UI with all necessary information
      const permissionRequest = {
        tool: tool_name,
        tier: this.getTier(tool_name, input),
        command: this.formatCommand(tool_name, input),
        description: this.generateDescription(tool_name, input),
        arguments: input || {},
        timestamp: new Date().toISOString(),
        toolUseId: tool_use_id || `tool_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      };
      
      // Enhanced logging for debugging
      console.error(`🔍 MCP: About to emit PERMISSION_REQUEST for tool: ${tool_name} with toolUseId: ${permissionRequest.toolUseId}`);
      console.error(`🔍 MCP: Permission request details:`, {
        tool: permissionRequest.tool,
        arguments: permissionRequest.arguments,
        tier: permissionRequest.tier,
        description: permissionRequest.description
      });
      
      // Send permission request to UI via stderr (UI monitors this)
      console.error(`PERMISSION_REQUEST:${JSON.stringify(permissionRequest)}`);
      
      // In bridge mode, if UI socket doesn't exist, handle response directly through stderr monitoring
      // UI monitors stderr and responds, no socket forwarding needed
      // Waiting for user permission response
      
      let userResponse;
      try {
        userResponse = await this.waitForUserResponse(permissionRequest.toolUseId);
        // Received user response
      } catch (error) {
        console.error(`❌ MCP: Error waiting for user response: ${error.message}`);
        userResponse = { approved: false, reason: `Failed to get user response (${error.message})` };
      }
      
      // Mark this tool_use_id as processed to prevent duplicates
      if (tool_use_id) {
        this.processedToolUseIds.add(tool_use_id);
        
        // Clean up old processed IDs to prevent memory leak (keep only last 100)
        if (this.processedToolUseIds.size > 100) {
          const oldestIds = Array.from(this.processedToolUseIds).slice(0, this.processedToolUseIds.size - 100);
          oldestIds.forEach(id => this.processedToolUseIds.delete(id));
        }
      }

      if (userResponse && userResponse.approved) {
          // User approved the tool
          const response = {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  behavior: 'allow',
                  updatedInput: input,
                }),
              },
            ],
          };
          // Sending approval response to Claude CLI
          return response;
        } else {
          // User denied the tool
          const response = {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  behavior: 'deny',
                  message: `Permission denied for ${tool_name}: ${userResponse?.reason || 'User denied the request'}`,
                }),
              },
            ],
          };
          // Sending denial response to Claude CLI
          return response;
        }
    });
  }

  // Bridge forwarding removed - simplified to always create socket server

  needsUserApproval(toolName, input) {
    // Safe tools - no approval needed (matches ToolPermissionManager.ts)
    if (['Read', 'LS', 'Glob', 'Grep', 'NotebookRead', 'TodoRead', 'TodoWrite', 'WebSearch', 'exit_plan_mode'].includes(toolName)) {
      return false;
    }

    // All Bash commands need approval - no auto-approval for any command
    if (toolName === 'Bash') {
      return true;
    }

    // File editing tools need approval
    if (['Edit', 'Write', 'MultiEdit'].includes(toolName)) {
      return true;
    }

    // Default to requiring approval for unknown tools
    return true;
  }

  getTier(toolName, input) {
    // Using shared tool classification - matches ToolPermissionManager.ts
    const safeTools = ['Read', 'LS', 'Glob', 'Grep', 'NotebookRead', 'TodoRead', 'TodoWrite', 'WebSearch', 'exit_plan_mode'];
    const cautiousTools = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'];
    const dangerousTools = ['Bash', 'Execute', 'Run'];
    
    if (safeTools.includes(toolName)) {
      return 'safe';
    } else if (cautiousTools.includes(toolName)) {
      return 'cautious';
    } else if (dangerousTools.includes(toolName)) {
      return 'dangerous';
    }
    
    return 'cautious'; // Default to cautious for unknown tools
  }

  formatCommand(toolName, input) {
    if (toolName === 'Bash' && input.command) {
      return input.command;
    }
    if (toolName === 'Read' && input.file_path) {
      return `Read ${input.file_path}`;
    }
    if (toolName === 'Write' && input.file_path) {
      return `Write ${input.file_path}`;
    }
    if (toolName === 'Edit' && input.file_path) {
      return `Edit ${input.file_path}`;
    }

    return `${toolName} ${JSON.stringify(input)}`;
  }

  generateDescription(toolName, input) {
    switch (toolName) {
      case 'Edit':
        return `Edit file`;
      case 'Write':
        return `Write new file`;
      case 'MultiEdit':
        return `Edit multiple parts of file`;
      case 'Bash':
        return `Execute command`;
      default:
        return `Use ${toolName} tool`;
    }
  }

  async start() {
    // console.error('🚀 MCP Permission Server: Starting...');
    // console.error('🔧 MCP Server: Server name "permission", tool name "approval_prompt"');
    // console.error('🔧 MCP Server: Expected Claude CLI flag: --permission-prompt-tool mcp__permission__approval_prompt');
    // console.error('🔧 MCP Server: Session ID from env:', process.env.SESSION_ID || 'default');
    // console.error('🔧 MCP Server: Permission mode from env:', process.env.PERMISSION_MODE || 'default');
    
    // Setup stdio transport for Claude CLI communication (Bridge mode)
    const transport = new (require('@modelcontextprotocol/sdk/server/stdio.js')).StdioServerTransport();
    
    // console.error('🚀 MCP Permission Server: Connecting to stdio transport...');
    await this.server.connect(transport);
    
    // console.error('🔧 MCP Permission Server started successfully!');
    // console.error('🌉 Bridge mode active: stdio (Claude CLI) + socket (UI)');
    // Ready to handle requests from both Claude CLI and UI
  }
}

// Start the server
const server = new PermissionPromptServer();
server.start().catch(console.error);