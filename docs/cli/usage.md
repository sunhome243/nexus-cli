# Nexus CLI

Nexus CLI provides a unified interface for interacting with Claude and Gemini AI providers through a single command-line interface. This guide covers the basic usage and core features based on the actual implementation.

## Starting Nexus CLI

Launch Nexus CLI from your terminal:

```bash
nexus
```

### Startup Sequence

When you run `nexus`, you'll see:

1. "Initializing Nexus..." with progress steps
2. Socket cleanup
3. Session manager setup
4. Provider connections (parallel initialization)
5. Provider finalization
6. Ready state

### First Launch Interface

On first startup, you'll see:

- **NEXUS** ASCII art header
- **"Cross-Provider AI CLI"** tagline
- **Getting Started Tips**:
  - "Ask questions, edit files, or run commands"
  - "Be specific"
  - "Use Ctrl+S to switch providers"

### Interface Layout

The interface consists of:

- **Header**: NEXUS branding (full on first run, compact during conversation)
- **Output Area**: Conversation history with colored provider indicators
- **Input Field**: Rounded border with prompt and placeholder text
- **Status Bar**: Project path, sandbox status, and provider information

## Basic Interaction

### Input Field

The input field shows:

- **Prompt**: `>` for chat mode, `$` for CLI mode
- **Placeholder**: "Type your message or @path/to/file"
- **Border Color** (Claude only):
  - Grey: Default mode
  - Blue: Accept edits mode
  - Green: Plan mode
  - Red: Bypass permissions mode

### Sending Messages

Type your message and press **Enter**:

```
> Hello, can you help me with my project?
```

The message is sent to the currently active provider and responses appear in real-time.

### Input History

Navigate previous messages:

- **Up Arrow (↑)**: Previous message in history
- **Down Arrow (↓)**: Next message in history
- **Escape**: Cancel history navigation

History shows: `[History N] • ↑↓: Navigate • ESC: Cancel`

### Provider Identification

Messages are displayed with provider-specific indicators:

- **User messages**: `> You`
- **Assistant messages**: `●` (colored by provider)
- Provider names shown in status bar: "claude" or "gemini-2.5-pro"

## Provider System

### Current Provider Display

The status bar shows:

- **Claude**: "claude" with 🔗 (MCP connection indicator)
- **Gemini**: "gemini-2.5-pro" with ⚡ for Flash model
- **Status**: "100% context left" indicator

### Provider Switching

**Keyboard Shortcut**: `Ctrl+S`

- Instantly switches between Claude and Gemini providers
- Conversation context is automatically preserved
- Status bar updates to show new active provider

### Claude Permission Modes

**Keyboard Shortcut**: `Shift+Tab` (Claude provider only)
Cycles through permission modes:

1. **"default"**: Normal operation (grey border)
2. **"acceptEdits"**: Auto-approve file edits (blue border)
3. **"plan"**: Planning mode (green border)
4. **"bypassPermissions"**: Skip all permissions (red border)

Input field border color changes to indicate current mode.

## Tool Execution

### Tool Permission System

Tools are categorized into safety tiers:

- **Safe**: Read, LS, Glob, Grep (auto-approved, no prompt)
- **Cautious**: Edit, Write, MultiEdit (require user approval)
- **Dangerous**: Bash, Execute, Run (require explicit approval)

### Tool Execution Flow

1. **Tool Starts**: Animated spinner with tool name appears
2. **Permission Request** (if required): Approval UI after 3-second delay
3. **User Response**:
   - `y` or `Y`: Approve execution
   - `n` or `N`: Deny execution
   - `Enter`: Default action
4. **Tool Completes**: Result shown, spinner stops

### Visual Indicators

During tool execution:

- Provider-colored indicators next to tool names
- Animated spinners during execution
- Results or error messages on completion
- Multiple tools can execute in sequence

## Session Management

### Session Creation

- Sessions created lazily on first message (not during startup)
- One unified session coordinates between providers
- Session files stored in provider-specific formats

### Session Persistence

- **Automatic Saving**: Every interaction immediately saved
- **Cross-Provider Context**: History available when switching providers
- **Project-Based**: Separate sessions per project directory

### Session Storage

Based on implementation:

- Session coordination managed in project directory
- Provider-specific storage handled automatically
- Universal session IDs for cross-provider tracking

## Status Bar Information

The status bar displays three sections:

### Left: Provider (status)

- Shows the current provider

### Center: Permission Mode Status

- Shows current permission mode status
- Gemini always shows (-) since it's not implemented yet

### Right: Provider Status

- Current model's name

## Application Control

### Exit Application

**Keyboard Shortcut**: `Ctrl+C`

- Graceful shutdown with MCP server cleanup
- Automatic session persistence
- Socket file cleanup

### Disabled States

When waiting for responses:

- Input field shows "Waiting for response..."
- Input is disabled until response completes
- Cursor appearance changes to indicate disabled state

## Error States

### Provider Unavailable

If providers fail to initialize:

- "claude not available" - Claude CLI or authentication issue
- "gemini not available" - Gemini API or connectivity issue
- Application continues with available providers

## Best Practices

### Starting Sessions

1. **Run from project directory**: `cd your-project && nexus`
2. **Check provider status**: Verify both providers show as available
3. **Test switching**: Try `Ctrl+S` to confirm both providers work

### Effective Interaction

1. **Use descriptive prompts**: Clear, specific requests get better responses
2. **Leverage file references**: Use `@path/to/file` syntax when supported
3. **Monitor tool execution**: Review permission requests before approval
4. **Switch providers strategically**: Use `Ctrl+S` for different perspectives

### Understanding Visual Cues

1. **Border colors**: Indicate Claude permission modes
2. **Provider indicators**: Colored dots show message source
3. **Status bar**: Monitor provider health and context usage
4. **Tool animations**: Track execution progress

For detailed information on specific features:

- [Provider Switching](./provider-switching.md) - Advanced switching strategies
- [Session Management](./session-management.md) - Understanding unified sessions
- [Keyboard Shortcuts](./keyboard-shortcuts.md) - Complete shortcut reference
