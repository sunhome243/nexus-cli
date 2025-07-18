# Core Features Documentation

This document explains the core logic and implementation details of Nexus CLI's main features for developers who need to understand or extend the system.

## Technical Deep Dives

For detailed technical documentation on specific core features:

- **[Permission System](./permission-system.md)** - How permission requests work for Claude and Gemini providers
- **[Session Memory Sync](./session-memory-sync.md)** - How session memory sync flow works between providers  
- **[Cross-Provider MCP](./cross-provider-mcp.md)** - How cross-provider MCP tool functionality works

## 🔄 Provider System

### Unified Provider Interface

Nexus CLI abstracts different AI services through a common interface:

```typescript
interface IProvider {
  readonly name: string;
  readonly capabilities: IProviderCapabilities;
  
  initialize(): Promise<void>;
  sendMessage(message: string): Promise<IProviderResponse>;
  sendMessageStreaming(message: string, callbacks: IProviderStreamingCallbacks): Promise<void>;
  
  // Session management
  createSession(tag: string): Promise<void>;
  resumeSession(tag: string): Promise<void>;
  cleanup(): Promise<void>;
  
  // Optional methods
  getCurrentSessionId?(): string | null;
  getModel?(): string | null;
  dispose?(): Promise<void>;
  setSessionTag?(tag: string): void;
  getCurrentMemoryFile?(): string | null;
  processThinkingChunk?(text: string): IThinkingProcessingResult;
  getCurrentModelInfo?(): { model: string; isUsingFallback: boolean; hasQuotaError: boolean } | null;
}

interface IProviderCapabilities {
  streaming: boolean;
  tools: boolean;
  permissions: boolean;
  models?: string[];
}
```

### Provider Implementations

**Claude Provider (`ClaudeProviderService`)**:

- Uses subprocess communication with Claude CLI
- Supports permission modes (default, acceptEdits, plan, bypass)
- Handles Auto Opus switching in plan mode
- Integrates with MCP servers through Claude CLI

**Gemini Provider (`GeminiProviderService`)**:

- Direct API integration via `@google/gemini-cli-core`
- Implements quota fallback (Pro → Flash)
- Handles rate limiting and API errors
- Supports streaming responses

### Provider Switching Logic

```typescript
// Core switching mechanism in ProviderService
async switchProvider(targetProvider: ProviderType): Promise<void> {
  const currentContext = await this.sessionManager.getCurrentContext();

  // Sync conversation history to target provider
  await this.sessionManager.syncContext(targetProvider, currentContext);

  // Update active provider
  this.currentProvider = targetProvider;

  // Notify UI of provider change
  this.eventEmitter.emit('providerChanged', targetProvider);
}
```

## 📂 Session Management System

### Universal Session Format

All conversations are normalized into a provider-agnostic format:

```typescript
// Session tracking uses SessionRegistryEntry for cross-provider sessions
interface SessionRegistryEntry {
  sessionId: string;
  projectPath: string;
  createdAt: string; // ISO-8601 format
  lastActivity: string; // ISO-8601 format
  providers: ProviderSessionInfo[];
}

interface ProviderSessionInfo {
  provider: ProviderType;
  sessionId: string;
  messageCount: number;
  lastSync?: string; // ISO-8601 format
}

// Universal message format for sync
interface UniversalMessage {
  id: string;
  parentId: string | null;
  sessionId: string;
  timestamp: string; // ISO-8601 format
  role: 'user' | 'assistant';
  type: 'message' | 'tool_use' | 'tool_result';
  content: UniversalContent;
  metadata: UniversalMetadata;
}

interface UniversalContent {
  text?: string;
  tool_use?: {
    tool_name: string;
    tool_input: any;
  };
  tool_result?: {
    output?: string;
    error?: string;
  };
}

interface UniversalMetadata {
  provider: ProviderType;
  model?: string;
  originalMessageId?: string;
  thinkingContent?: string;
}
```

### Session Persistence

Sessions are stored in multiple locations:

- **Universal Registry**: `.nexus/sessions.json` - Cross-provider session index
- **Claude Sessions**: `~/.claude/projects/*/` - Native Claude CLI format
- **Gemini Backups**: `.nexus/gemini-backup/` - For diff computation

### Message Synchronization Algorithm

The core synchronization uses a simplified append-only diff algorithm for safety:

```typescript
class MyersDiff implements IDiffAlgorithm {
  computeDiff(source: UniversalMessage[], target: UniversalMessage[]): ConversationDiff {
    // Uses append-only strategy for safety
    return this.computeAppendOnlyDiff(source, target);
  }

  private computeAppendOnlyDiff(source: UniversalMessage[], target: UniversalMessage[]): ConversationDiff {
    const operations: DiffOperation[] = [];
    
    // Find messages in source that aren't in target
    for (const sourceMsg of source) {
      const exists = target.some(targetMsg => 
        this.isMessageSimilar(sourceMsg, targetMsg)
      );
      
      if (!exists) {
        operations.push({ type: 'insert', message: sourceMsg });
      }
    }
    
    return { operations, hasChanges: operations.length > 0 };
  }

  private isMessageSimilar(msg1: UniversalMessage, msg2: UniversalMessage): boolean {
    // Compare by content, ignoring IDs and session metadata
    // Same content = same message regardless of which session it came from
    return msg1.role === msg2.role && 
           msg1.content.text === msg2.content.text;
  }
}

// Note: Full Myers algorithm is implemented but not used for safety reasons
```

### Sync Process Flow

1. **Provider Switch Initiated**: User presses `Ctrl+S`
2. **Get Current Context**: Load universal session state
3. **Load Target Provider State**: Read target provider's conversation
4. **Compute Diff**: Use Myers algorithm to find differences
5. **Apply Changes**: Sync missing messages to target provider
6. **Update Registry**: Save updated universal session
7. **Switch Active Provider**: Complete the transition

## 🔐 Permission System

### Permission Model

```typescript
// Permission modes control auto-approval behavior
type PermissionMode = 
  | 'DEFAULT'           // Prompt for cautious and dangerous
  | 'CAUTIOUS'         // More restrictive prompting
  | 'YOLO'             // Auto-approve file edits (Gemini)
  | 'PLAN'             // Enhanced planning with Auto Opus
  | 'ACCEPT_EDITS'     // Auto-approve file modifications  
  | 'BYPASS_PERMISSIONS'; // Auto-approve all operations

// Tool tiers determine permission requirements
type ToolTier = 'safe' | 'cautious' | 'dangerous';

// Tool classification is handled by utility functions
function getToolTier(toolName: string): ToolTier {
  const safeTools = ['read_file', 'list_files', 'search_files'];
  const dangerousTools = ['write_file', 'execute_command', 'delete_file'];
  
  if (safeTools.includes(toolName)) return 'safe';
  if (dangerousTools.includes(toolName)) return 'dangerous';
  return 'cautious';
}
```

### Permission Handling Implementation

```typescript
// Provider-specific permission services handle requests
class ClaudePermissionService {
  async processPermissionRequest(request: PermissionRequest): Promise<PermissionResponse> {
    const { tool_name, arguments: toolArgs } = request;
    const tier = getToolTier(tool_name);
    
    // Check if we should auto-approve
    if (!this.shouldShowPermissionPrompt(tool_name, this.currentMode)) {
      return { 
        approved: true, 
        autoApproved: true,
        tier 
      };
    }
    
    // Create permission socket for UI interaction
    const socketPath = await this.createPermissionSocket();
    
    // Show permission prompt and wait for user response
    const approval = await this.promptUser({
      tool_name,
      arguments: toolArgs,
      tier,
      socketPath
    });
    
    return { 
      approved: approval.granted, 
      autoApproved: false,
      tier 
    };
  }
  
  private shouldShowPermissionPrompt(toolName: string, mode: PermissionMode): boolean {
    const tier = getToolTier(toolName);
    
    switch (mode) {
      case 'BYPASS_PERMISSIONS':
        return false; // Auto-approve everything
      case 'PLAN':
      case 'ACCEPT_EDITS':
      case 'YOLO':
        return tier === 'dangerous' && !isFileEditTool(toolName);
      case 'CAUTIOUS':
        return tier !== 'safe';
      case 'DEFAULT':
      default:
        return tier === 'cautious' || tier === 'dangerous';
    }
  }
}
```

### Auto Opus Integration

When permission mode is set to "plan":

1. **Detect Plan Mode**: Permission manager recognizes plan mode activation
2. **Trigger Opus Switch**: If Auto Opus is enabled, switch Claude to Opus model
3. **Enhanced Planning**: Opus provides superior reasoning for complex tasks
4. **Model Restoration**: Return to previous model when exiting plan mode

## 🔌 MCP Integration

### MCP Architecture

Model Context Protocol servers extend Nexus's capabilities:

```typescript
interface MCPServer {
  name: string;
  transport: "stdio" | "SSE" | "HTTP";
  command: string;
  args: string[];
  env?: Record<string, string>;
  url?: string; // For HTTP/SSE transports
  timeout?: number;
  headers?: Record<string, string>; // For HTTP/SSE
}
```

### Platform Integration

**Claude Code Integration**:

- MCP servers configured in `.claude_config` files
- Automatic permission prompts for tool execution
- Socket-based communication for real-time approval

**Gemini CLI Integration**:

- Limited MCP support through CLI configuration
- Tools executed through command interface

### Permission Flow with MCP

1. **Tool Request**: AI provider requests tool execution
2. **Classification**: Permission manager classifies tool operation
3. **Socket Communication**: Create permission socket for UI interaction
4. **User Approval**: Display permission prompt with tool details
5. **Execution**: Execute tool if approved, deny if rejected
6. **Result Handling**: Return tool results to AI provider

## ⌨️ Command System

### Slash Command Architecture

```typescript
// Built-in commands implement this interface
interface IBuiltInCommand {
  name: string;
  description: string;
  execute(args?: string): Promise<void>;
}

// File-based commands use this structure
interface ISlashCommand {
  name: string;
  description: string;
  command: string; // The actual command content
}

// Command service handles both types
class SlashCommandService {
  constructor(
    private builtInCommands: IBuiltInCommand[],
    private fileCommands: ISlashCommand[]
  ) {}

  async executeCommand(input: string): Promise<void> {
    const parsed = this.parser.parseInput(input);
    
    if (!parsed) {
      return; // Not a slash command
    }

    // Check built-in commands first
    const builtIn = this.builtInCommands.find(cmd => cmd.name === parsed.command);
    if (builtIn) {
      await builtIn.execute(parsed.arguments);
      return;
    }

    // Check file-based commands
    const fileCmd = this.fileCommands.find(cmd => cmd.name === parsed.command);
    if (fileCmd) {
      await this.executeFileCommand(fileCmd, parsed.arguments);
      return;
    }

    throw new Error(`Unknown command: ${parsed.command}`);
  }
}
```

### Command Parser Implementation

```typescript
interface ISlashCommandParseResult {
  command: string;
  arguments?: string; // Single string, not parsed into array
  originalInput: string;
}

class SlashCommandParserService {
  parseInput(input: string): ISlashCommandParseResult | null {
    // Match pattern: /command [arguments]
    const match = input.match(/^\/(\w+)(?:\s+(.*))?$/);

    if (!match) return null;

    const [originalInput, command, args] = match;

    return {
      command,
      arguments: args?.trim(), // Keep as single string
      originalInput
    };
  }
}

// Note: Arguments are kept as a single string and passed directly
// to commands for their own parsing. No array parsing or quote
// handling is done at the parser level.
```

### Built-in Commands

- **`/dashboard`**: Opens settings and statistics interface
- **`/claude [model]`**: Switch Claude models (sonnet, opus)
- **Custom commands**: Loaded from `.claude/commands/` directory

## 🏗️ Dependency Injection

### Container Setup

Nexus uses Inversify.js for dependency injection:

```typescript
// Service registration
container.bind<IProviderService>(TYPES.ProviderService).to(ProviderService).inSingletonScope();

container.bind<ISessionManager>(TYPES.SessionManager).to(SessionManager).inSingletonScope();

// Provider implementations
container.bind<IClaudeProvider>(TYPES.ClaudeProvider).to(ClaudeProviderService).inSingletonScope();

container.bind<IGeminiProvider>(TYPES.GeminiProvider).to(GeminiProviderService).inSingletonScope();
```

### Service Consumption

```typescript
@injectable()
export class ProviderService implements IProviderService {
  constructor(
    @inject(TYPES.ClaudeProvider) private claudeProvider: IClaudeProvider,
    @inject(TYPES.GeminiProvider) private geminiProvider: IGeminiProvider,
    @inject(TYPES.SessionManager) private sessionManager: ISessionManager
  ) {}

  // Service methods use injected dependencies
}
```

## 🎨 UI Architecture (React + Ink)

### Component Flow

```typescript
// Main App → Services Integration
export const App: React.FC = () => {
  const container = useContainer();
  return (
    <AppProvider container={container}>
      <MainInterface />
    </AppProvider>
  );
};

// Service consumption in components
const useProviderState = () => {
  const providerService = useService<IProviderService>(TYPES.ProviderService);
  // Use service methods in React hooks
};
```

This documentation covers the essential core logic that developers need to understand to contribute effectively to Nexus CLI without overwhelming implementation details.
