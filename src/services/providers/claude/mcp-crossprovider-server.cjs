#!/usr/bin/env node

// MCP Server for handling askModel tool - allows Claude to consult other AI models
// This uses socket communication to route requests through the main app's authenticated sessions
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { ListToolsRequestSchema, CallToolRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const net = require("net");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

class AskModelServer {
  constructor() {
    this.server = new Server(
      {
        name: "askModel",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Get session ID from environment
    this.sessionId = process.env.SESSION_ID || "default";
    this.socketPath = `/tmp/mcp-askmodel-${this.sessionId}.sock`;

    // Map to store pending askModel requests
    this.pendingRequests = new Map();

    this.setupTools();
  }

  setupTools() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "askModel",
            description: "Consult another AI model for collaborative problem-solving",
            inputSchema: {
              type: "object",
              properties: {
                model: {
                  type: "string",
                  enum: ["claude", "gemini"],
                  description: "The AI model to consult. You can not consult yourself.",
                },
                prompt: {
                  type: "string",
                  description:
                    "The question or topic to discuss with the other model. Briefly explain the current situation and the goal. The opposite model has all the access to the previous conversation, read files, glob, and websearch tools.",
                },
                sessionTag: {
                  type: "string",
                  description: "The session tag to use for context (optional)",
                },
              },
              required: ["model", "prompt"],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      console.error(`🔧 [askModel] Tool call received: ${request.params.name}`);
      console.error(`🔧 [askModel] Tool arguments: ${JSON.stringify(request.params.arguments)}`);

      if (request.params.name !== "askModel") {
        console.error(`❌ [askModel] Unknown tool: ${request.params.name}`);
        throw new Error(`Unknown tool: ${request.params.name}`);
      }

      const { model, prompt, sessionTag } = request.params.arguments;

      try {
        if (model === "claude") {
          // Consulting Claude
          return await this.consultClaudeDirect(prompt, sessionTag);
        } else if (model === "gemini") {
          // Consulting Gemini
          return await this.consultGeminiDirect(prompt);
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Error: Unknown model "${model}". Available models: claude, gemini`,
              },
            ],
          };
        }
      } catch (error) {
        console.error("Error in askModel:", error);
        return {
          content: [
            {
              type: "text",
              text: `Error consulting ${model}: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  async consultGeminiDirect(prompt) {
    console.error(`[askModel] Consulting Gemini with prompt: ${prompt.substring(0, 100)}...`);

    try {
      // Create unique request ID
      const requestId = `askmodel_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Send request to main app via socket
      const response = await this.sendAskModelRequest({
        requestId,
        model: "gemini",
        prompt,
        timestamp: new Date().toISOString(),
      });

      console.error(`[askModel] Gemini consultation complete`);
      return {
        content: [
          {
            type: "text",
            text: response.text || "No response received",
          },
        ],
      };
    } catch (error) {
      console.error("[askModel] Error consulting Gemini:", error);

      // Return a helpful error message
      return {
        content: [
          {
            type: "text",
            text: `I encountered an error while trying to consult Gemini: ${error.message}\n\nPlease ensure Gemini is properly initialized and available.`,
          },
        ],
      };
    }
  }

  async consultClaudeDirect(prompt, sessionTag) {
    console.error(`[askModel] Consulting Claude with prompt: ${prompt.substring(0, 100)}...`);

    try {
      // Use passed sessionTag if available, otherwise fall back to environment
      sessionTag = sessionTag || this.sessionId;
      console.error(
        `[askModel] Using session tag: ${sessionTag} (passed: ${sessionTag ? "yes" : "no"}, env: ${this.sessionId})`
      );

      // For Gemini calls, we need to find the most recent session tag since Gemini can't pass it
      if (sessionTag === "default") {
        const refDir = path.join(process.cwd(), ".nexus", "claude-ref");
        if (fs.existsSync(refDir)) {
          const refFiles = await fs.promises.readdir(refDir);
          const taggedFiles = refFiles.filter((f) => f.startsWith("tagged-") && f.endsWith(".ref"));

          if (taggedFiles.length > 0) {
            // Find the most recent ref file
            let mostRecentFile = null;
            let mostRecentTime = 0;

            for (const file of taggedFiles) {
              const stats = await fs.promises.stat(path.join(refDir, file));
              if (stats.mtimeMs > mostRecentTime) {
                mostRecentTime = stats.mtimeMs;
                mostRecentFile = file;
              }
            }

            if (mostRecentFile) {
              sessionTag = mostRecentFile.replace("tagged-", "").replace(".ref", "");
              console.error(`[askModel] Found most recent session tag: ${sessionTag}`);
            }
          }
        }
      }

      const refDir = path.join(process.cwd(), ".nexus", "claude-ref");
      const refFilePath = path.join(refDir, `tagged-${sessionTag}.ref`);

      // Use socket connection to communicate with main app
      console.error("[askModel] Using socket connection for Claude consultation");
      return await this.consultClaudeViaSocket(prompt, sessionTag);
    } catch (error) {
      console.error("[askModel] Error consulting Claude:", error);

      // Return a helpful error message
      return {
        content: [
          {
            type: "text",
            text: `I encountered an error while trying to consult Claude: ${error.message}`,
          },
        ],
      };
    }
  }

  /**
   * Send askModel request to main app via socket
   */
  async sendAskModelRequest(request) {
    return new Promise((resolve, reject) => {
      // Store resolver for this request
      this.pendingRequests.set(request.requestId, {
        resolve: (response) => {
          resolve(response);
        },
        reject: (error) => {
          reject(error);
        },
      });

      // Try to connect to main app socket
      console.error(`[askModel] Attempting to connect to socket: ${this.socketPath}`);
      const client = net.createConnection(this.socketPath, () => {
        console.error(`[askModel] Connected to main app socket`);

        // Send the request
        const message = JSON.stringify(request);
        console.error(`[askModel] Sending request: ${message.substring(0, 200)}...`);
        client.write(message);
      });

      client.on("data", (data) => {
        try {
          const response = JSON.parse(data.toString());
          console.error(`[askModel] Received response:`, response);

          if (response.requestId && this.pendingRequests.has(response.requestId)) {
            const { resolve } = this.pendingRequests.get(response.requestId);
            this.pendingRequests.delete(response.requestId);
            resolve(response);
            // Close the connection after receiving response
            client.end();
          }
        } catch (error) {
          console.error("[askModel] Error parsing response:", error);
          console.error("[askModel] Raw data received:", data.toString());
        }
      });

      client.on("error", (error) => {
        console.error("[askModel] Socket connection error:", error);
        if (this.pendingRequests.has(request.requestId)) {
          const { reject } = this.pendingRequests.get(request.requestId);
          this.pendingRequests.delete(request.requestId);
          reject(new Error(`Socket connection failed: ${error.message}`));
        }
      });

      client.on("close", () => {
        console.error("[askModel] Socket connection closed");
        // If we haven't resolved yet, it means the connection closed without a response
        if (this.pendingRequests.has(request.requestId)) {
          const { reject } = this.pendingRequests.get(request.requestId);
          this.pendingRequests.delete(request.requestId);
          reject(new Error("Socket connection closed without response"));
        }
      });
    });
  }

  async start() {
    console.error("🚀 MCP askModel Server: Starting...");
    console.error(`📍 Session ID: ${this.sessionId}`);
    console.error(`📍 Working directory: ${process.cwd()}`);
    console.error(`📍 Script location: ${__dirname}`);
    console.error(`📍 Process args: ${process.argv.join(" ")}`);
    console.error(`📍 Environment SESSION_ID: ${process.env.SESSION_ID}`);
    console.error(`📍 Environment PERMISSION_MODE: ${process.env.PERMISSION_MODE}`);

    // Setup stdio transport
    const transport = new StdioServerTransport();

    console.error("🚀 MCP askModel Server: Connecting to stdio transport...");
    await this.server.connect(transport);

    console.error("✅ MCP askModel Server started successfully!");
    console.error("📋 Registered tools:");
    console.error("  - askModel: Consult another AI model for collaborative problem-solving");
  }

  /**
   * Spawn Claude process for consultation
   */
  async spawnClaudeForConsultation(args) {
    return new Promise((resolve, reject) => {
      console.error(`[askModel] Spawning Claude with args:`, args.join(" "));
      console.error(`[askModel] Working directory: ${process.cwd()}`);

      // Check if claude CLI is available
      const claudeCommand = "claude";
      console.error(`[askModel] Using command: ${claudeCommand}`);

      // Debug: Log exact arguments being passed
      console.error(`[askModel] Spawn command: ${claudeCommand}`);
      console.error(`[askModel] Spawn args:`, JSON.stringify(args));
      console.error(`[askModel] Prompt length: ${args[args.length - 1].length} chars`);

      // Ensure we have all necessary environment variables
      const spawnEnv = {
        ...process.env,
        // Ensure Claude-specific env vars are set
        HOME: process.env.HOME,
        PATH: process.env.PATH,
        USER: process.env.USER,
        // Add any Claude-specific env vars that might be needed
        CLAUDE_SESSION_DIR: process.env.CLAUDE_SESSION_DIR,
        NO_COLOR: "1", // Disable color output for easier parsing
        CLAUDE_MCP_MODE: "1", // Signal that Claude is being used as MCP tool
      };

      const child = spawn(claudeCommand, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: spawnEnv,
        cwd: process.cwd(),
        shell: false, // Explicitly set shell to false
      });
      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        const chunk = data.toString();
        stderr += chunk;
        // Log stderr in real-time for debugging
        console.error(`[askModel] Claude stderr: ${chunk}`);
      });

      child.on("close", (code) => {
        if (code === 0) {
          try {
            // Log the raw stdout for debugging
            console.error(`[askModel] Claude stdout (first 500 chars): ${stdout.substring(0, 500)}`);

            // Try to parse as JSON
            const response = JSON.parse(stdout);
            console.error(`[askModel] Claude returned JSON response`);
            resolve({ text: response.content || response.text || stdout });
          } catch (error) {
            // If not valid JSON, return raw output
            console.error(`[askModel] Claude returned non-JSON response, using raw output`);
            resolve({ text: stdout || "No output received from Claude" });
          }
        } else {
          console.error(`[askModel] Claude exited with code ${code}, stderr: ${stderr}`);
          reject(new Error(`Claude exited with code ${code}: ${stderr}`));
        }
      });

      child.on("error", (error) => {
        console.error(`[askModel] Failed to spawn Claude:`, error);
        if (error.code === "ENOENT") {
          reject(new Error("Claude CLI not found. Please ensure claude is installed and in your PATH"));
        } else {
          reject(error);
        }
      });
    });
  }

  /**
   * Check if Claude CLI is available
   */
  async checkClaudeCliAvailable() {
    const { exec } = require("child_process");
    return new Promise((resolve) => {
      exec("which claude", (error, stdout, stderr) => {
        if (error || !stdout.trim()) {
          console.error("[askModel] Claude CLI not found in PATH");
          resolve(false);
        } else {
          console.error(`[askModel] Claude CLI found at: ${stdout.trim()}`);
          resolve(true);
        }
      });
    });
  }

  /**
   * Consult Claude via socket communication (fallback when CLI not available)
   */
  async consultClaudeViaSocket(prompt, sessionTag) {
    console.error(`[askModel] Using socket fallback for Claude consultation`);

    try {
      // Create unique request ID
      const requestId = `askmodel_claude_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Send request to main app via socket
      const response = await this.sendAskModelRequest({
        requestId,
        model: "claude",
        prompt,
        sessionTag,
        timestamp: new Date().toISOString(),
      });

      console.error(`[askModel] Claude consultation via socket complete`);
      return {
        content: [
          {
            type: "text",
            text: response.text || "No response received",
          },
        ],
      };
    } catch (error) {
      console.error("[askModel] Error consulting Claude via socket:", error);

      // Return a helpful error message
      return {
        content: [
          {
            type: "text",
            text: `I encountered an error while trying to consult Claude: ${error.message}\n\nPlease ensure Claude is properly initialized and available.`,
          },
        ],
      };
    }
  }
}

// Start the server
const server = new AskModelServer();
server.start().catch(console.error);
