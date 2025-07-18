# Complete Features Guide

This guide provides a comprehensive overview of all Nexus CLI capabilities, from core functionality to advanced features.

## Core Features

### 🤖 Unified AI Provider Interface

Nexus CLI provides a single interface for interacting with multiple AI providers:

- **Claude Integration**: Direct integration with Claude CLI for Claude models
- **Gemini Integration**: Native integration with Google Gemini API
- **Seamless Switching**: Switch between providers instantly with `Ctrl+S`
- **Unified Experience**: Consistent interface regardless of the underlying provider

### 🔄 Real-time Provider Switching

Switch between AI providers without losing conversation context:

```
Current Provider: Claude (Sonnet)
Press Ctrl+S
→ Current Provider: Gemini (2.5 Pro)
```

**How it works:**

- Press `Ctrl+S` to instantly switch providers
- Conversation history syncs automatically
- Visual indicator shows current provider in status bar
- Session state preserved across switches

### 💾 Cross-provider Conversation Persistence

Maintain conversation continuity across provider switches:

- **Automatic Session Creation**: New sessions created at startup
- **Cross-provider Sync**: Conversations sync bidirectionally between providers
- **Conversation Continuity**: Each message continues from previous conversation history
- **Universal Session IDs**: Consistent session tracking across providers

### ⚡ Real-time Streaming Responses

Experience live AI responses as they're generated:

- **Character-by-character streaming** for immediate feedback
- **Tool execution visualization** during operation
- **Thinking process display** for transparency
- **Progress indicators** for long-running operations

### 🛠️ Tool Execution with Visual Feedback

Watch tools execute in real-time with comprehensive visualization:

- **Live output streaming** during tool execution
- **File diff rendering** with syntax highlighting
- **Todo list visualization** for task tracking
- **Error handling** with recovery options

## Advanced Features

### 🎯 Auto Opus Model Switching

Automatically switch to Claude's most powerful model based on context:

**Behavior:**

- Automatically switches to Opus when entering plan mode
- Returns to previous model when exiting plan mode
- Configurable via dashboard settings
- Integrates with permission mode cycling

**Triggers:**

- Permission mode change to "plan" via `Shift+Tab`
- Manual plan mode activation
- Complex task detection

### 🔐 Advanced Permission Management

Four-tier permission system for secure AI interactions:

#### Permission Modes (Claude only)

1. **Default Mode** (Grey border)

   - Standard operation with permission prompts
   - User approval required for file modifications
   - Balanced security and functionality

2. **Accept Edits Mode** (Blue border)

   - Automatically accepts file edit operations
   - Ideal for trusted coding sessions
   - Bypass prompts for Edit, Write, MultiEdit tools

3. **Plan Mode** (Green border)

   - Enhanced planning context for complex tasks
   - Triggers Auto Opus if enabled
   - Optimized for strategic thinking

4. **Bypass Permissions Mode** (Red border)
   - Skips all permission prompts
   - Maximum automation
   - Use with caution

#### Tool Safety Tiers

**Safe Tools** (Auto-approved):

- `Read`, `LS`, `Glob`, `Grep`
- Information gathering and search
- No system modifications

**Cautious Tools** (Require approval in default mode):

- `Edit`, `Write`, `MultiEdit`
- File modification operations
- Prompted in default mode only

**Dangerous Tools** (Always require approval):

- `Bash`, `Execute`
- System command execution
- Always prompted regardless of mode

### 📊 Comprehensive Usage Tracking

Monitor AI usage across providers with detailed statistics:

#### Claude Usage Tracking

- **5-hour rolling windows** with multiple plan support
- **Plan-specific usage**: Plus, Max2x, Max4x plans
- **Visual progress bars** with provider-specific colors
- **Time until reset** display

#### Gemini Usage Tracking

- **Session-based tracking** with cost estimation
- **Token recording** from API responses
- **Real-time usage updates**

#### Unified Statistics

```
╭─ Usage Statistics ─╮
│ Claude (5h window) │
│ ████████░░ 80%     │
│ Gemini (Session)   │
│ ███░░░░░░░ 30%     │
╰───────────────────╯
```

### 💬 Advanced Slash Command System

Extensible command system for power users:

#### Built-in Commands

**`/claude [model]`**

- Switch Claude models: `/claude sonnet` or `/claude opus`
- Immediate model switching
- Preserves conversation context

**`/dashboard`**

- Opens interactive dashboard overlay
- Access settings and statistics
- MCP server management

#### Custom Commands

**Directory Scanning**: Automatically scans `.claude/commands/` for custom commands
**Markdown Format**: Commands stored as `.md` files with descriptions
**Hierarchical Organization**: Subdirectory support for command categories
**Dynamic Loading**: Commands loaded on-demand with caching

**Example custom command structure:**

```
.claude/commands/
├── deploy.md
├── test.md
```

### 🎛️ Interactive Dashboard

Comprehensive settings and statistics interface accessible via `/dashboard`:

#### Features

- **Auto Opus Toggle**: Enable/disable automatic Opus switching
- **MCP Server Management**: Add, list, and remove MCP servers
- **Real-time Statistics**: Live token usage visualization
- **Keyboard Navigation**: Arrow keys for navigation, Enter to select

#### Navigation

```
╭─ Nexus Dashboard ─╮
│ → Auto Opus: ON    │
│   MCP Servers: 2   │
│   Usage Stats      │
│   Exit Dashboard   │
╰───────────────────╯
```

### 🔗 MCP (Model Context Protocol) Integration

Advanced tool integration with permission management:

#### MCP Manager Features

- **JSON Import**: Import MCP server configurations from JSON files
- **Multi-scope Support**: Project, user, and local scope configurations
- **Transport Types**: stdio, SSE, and HTTP transport support
- **Automatic Discovery**: Built-in MCP server detection

#### Permission Server

- **Socket Management**: Automatic socket file cleanup
- **Multi-server Support**: Handle multiple MCP servers per scope
- **Configuration Validation**: JSON schema validation for server configs

### 🔄 Quota Management & Fallback

Intelligent handling of provider limitations:

#### Automatic Quota Fallback

- **Smart Detection**: Automatically detects when Gemini Pro quota is exceeded
- **Seamless Fallback**: Instantly switches to Gemini Flash without interruption
- **User Notification**: Clear indication when fallback occurs
- **Automatic Recovery**: Retries with original model when quota resets

#### Circuit Breaker Protection

- **Session Creation Limits**: Prevents repeated session creation failures
- **Cooldown Periods**: Implements backoff strategy for failed operations
- **Automatic Recovery**: Resets circuit breaker on successful operations
- **Diagnostic Information**: Logs detailed failure information for troubleshooting

### 🔒 Real-time Permission System

Advanced permission management with live UI:

#### Socket-based Communication

- **Real-time Updates**: Permission requests appear instantly in UI
- **Socket Management**: Automatic cleanup of orphaned sockets
- **Multi-session Support**: Handles permissions across multiple sessions
- **Bridge Architecture**: Seamless connection between CLI and UI

#### Visual Permission Interface

- **Git Diff Rendering**: Shows exact file changes with syntax highlighting
- **Todo List Display**: Structured task display with status indicators (☒☐□)
- **Tool Execution Visualization**: Progress bars and status updates
- **Markdown Rendering**: Rich formatting for permission content

### ✏️ Advanced Text Editing

Sophisticated text input capabilities:

#### Multiline Support

- **Visual line wrapping** with proper cursor tracking
- **Shift+Enter** or **\+Enter** for newlines
- **Unicode and emoji support**
- **Efficient rendering** for large text blocks

#### File Integration

- **File path syntax**: `@path/to/file` includes file contents
- **Path validation**: Built-in file path checking
- **Drag-and-drop support**: Easy file inclusion

#### Input Features

- **Command history**: 50 chat entries, 100 CLI entries
- **Word navigation**: Alt+Left/Right for word-by-word movement
- **Advanced editing**: Ctrl+A/E for line navigation, Ctrl+K/U for deletion

### 🧠 Thinking Process Visualization

Transparent AI reasoning with real-time thinking display:

#### Claude Thinking

- Filters out thinking content from final output
- Shows internal reasoning process
- Helps understand AI decision-making

#### Gemini Thinking

- Parses and displays structured thinking summaries
- Real-time thinking updates during response generation
- Enhanced transparency in complex reasoning

### 🔄 Sophisticated Session Synchronization

Bidirectional conversation sync between providers:

#### Sync Engine Features

- **Myers diff algorithm** for efficient synchronization
- **Lock management** prevents concurrent operations
- **Conflict resolution** handles sync conflicts gracefully
- **Error recovery** with automatic retry logic

#### Sync Process

1. **Instant sync** on provider switch
2. **Post-streaming sync** after message completion
3. **State tracking** maintains sync state across sessions
4. **Graceful error handling** with recovery mechanisms

### 🎨 Dynamic Theming & UI

Provider-specific visual themes and rich rendering:

#### Theme System

- **Claude Colors**: Orange/rust color scheme (#DE7356)
- **Gemini Colors**: Blue color scheme (#4285F4)
- **Status Colors**: Semantic colors for warnings, errors, success
- **Provider-specific borders** for permission modes

#### Rich Rendering

- **Syntax-highlighted file diffs** with proper formatting
- **Structured todo list display** with status indicators
- **Tool execution visualization** with progress bars
- **Markdown rendering** for formatted content

### ⚡ Performance Optimizations

Efficient operation with smart resource management:

#### Initialization

- **Parallel initialization** of providers and services
- **Lazy loading** of commands and resources
- **Socket cleanup** removes orphaned files

#### Streaming

- **Immediate display** of message chunks
- **Animation lifecycle management** for smooth UX
- **Memory management** with proper cleanup

### 🛠️ Development & Debugging

Built-in tools for troubleshooting and development:

#### Logging System

- **Comprehensive logging** throughout the application
- **Debug information** for troubleshooting
- **Error tracking** with detailed reporting

#### Testing Support

- **Stats testing** functionality
- **Mock provider** support for testing
- **Configuration validation** for MCP setups

## Status Indicators

### Permission Mode Indicators

- **Grey border**: Default mode
- **Blue border**: Accept Edits mode
- **Green border**: Plan mode
- **Red border**: Bypass Permissions mode

### Connection Status

- **MCP servers**: Connected/Disconnected indicators
- **Provider availability**: Real-time status checking
- **Sync status**: Synchronization state indicators

## Workflow Examples

### Basic Conversation

1. Start Nexus CLI
2. Type your message
3. Press Enter to send
4. Watch streaming response
5. Continue conversation

### Provider Switching Workflow

1. Start conversation with Claude
2. Press `Ctrl+S` to switch to Gemini
3. Continue same conversation with Gemini
4. Press `Ctrl+S` again to return to Claude
5. Full conversation history maintained

### Complex Task with Auto Opus

1. Start with Claude Sonnet
2. Press `Shift+Tab` to enter plan mode
3. Auto Opus activates (if enabled)
4. Describe complex task
5. Get enhanced planning response
6. Return to Sonnet for implementation

### File-based Workflow

1. Type message with file reference: `Review @src/main.js`
2. File contents automatically included
3. AI analyzes file in context
4. Make edits with proper permissions
5. Changes tracked and visualized

This comprehensive feature set makes Nexus CLI a powerful, unified interface for AI-assisted development and productivity workflows.
