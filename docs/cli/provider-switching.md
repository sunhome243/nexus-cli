# Provider Switching Guide

Nexus CLI's most powerful feature is seamless switching between Claude and Gemini AI providers while maintaining conversation continuity. This guide explains how provider switching works, its benefits, and advanced usage patterns.

## Overview

Provider switching allows you to:

- **Compare Responses**: Get different perspectives on the same question
- **Leverage Strengths**: Use each provider's unique capabilities
- **Maintain Context**: Preserve conversation history across switches
- **Seamless Experience**: Switch instantly without losing progress

## Basic Provider Switching

### The Switch Command

**Keyboard Shortcut**: `Ctrl+S`

Press `Ctrl+S` at any time to switch between providers:

```
Current: Claude (Sonnet)
Press Ctrl+S
→ Current: Gemini (2.5 Pro)
Press Ctrl+S
→ Current: Claude (Sonnet)
```

### Visual Indicators

The status bar shows your current provider:

```
Claude (Available) | Permission: default | Model: Sonnet | MCP: Connected
```

```
Gemini (Connected) | Model: 2.5 Pro | Session: active
```

### Provider Colors

Each provider has distinct visual theming:

- **Claude**: Orange/rust color scheme (#DE7356)
- **Gemini**: Blue color scheme (#4285F4)

## How Provider Switching Works

### Instant Synchronization

When you switch providers:

1. **Current conversation syncs** to the new provider
2. **Session state transfers** seamlessly
3. **Context preserved** including file references and tool results
4. **Immediate availability** - new provider ready instantly

### Conversation Continuity

Your conversation history is automatically synchronized:

```
You: "Explain quantum computing"
Claude: [Detailed explanation with analogies]

[Press Ctrl+S to switch to Gemini]

You: "Can you provide a more technical explanation?"
Gemini: [Technical explanation building on Claude's response]

[Press Ctrl+S to switch back to Claude]

You: "Now combine both perspectives"
Claude: [Response incorporating both previous explanations]
```

### Behind the Scenes

The sync engine handles:

- **Message Translation**: Converts between provider-specific formats
- **Universal Format**: Maintains internal conversation state
- **Bidirectional Sync**: Updates both provider sessions
- **Error Recovery**: Handles sync failures gracefully

## Provider Capabilities

### Claude Strengths

**Writing and Analysis**:

- Excellent for creative writing and storytelling
- Strong analytical and reasoning capabilities
- Superior code review and documentation

**Tool Integration**:

- Advanced MCP (Model Context Protocol) support
- Sophisticated permission system
- File manipulation and system operations

**Permission Modes**:

- Multiple permission levels for secure operations
- Auto Opus for complex planning tasks
- Plan mode for strategic thinking

### Gemini Strengths

**Technical Knowledge**:

- Strong in mathematical and scientific domains
- Excellent for data analysis and interpretation
- Good at structured problem-solving

**Real-time Capabilities**:

- Fast response times
- Efficient token usage
- Good for iterative development

**Integration**:

- Native Google ecosystem integration
- Direct API access for efficiency

## Advanced Switching Patterns

### Comparison Workflow

Use provider switching to compare different approaches:

1. **Ask Claude** for an initial solution
2. **Switch to Gemini** (`Ctrl+S`)
3. **Ask the same question** to see alternative approach
4. **Switch back to Claude** (`Ctrl+S`)
5. **Ask for synthesis** of both approaches

**Example:**

```
You: "Design a user authentication system"
Claude: [Security-focused design with detailed error handling]

[Ctrl+S]

You: "Design a user authentication system"
Gemini: [Performance-focused design with scalability considerations]

[Ctrl+S]

You: "Combine the best aspects of both designs"
Claude: [Integrated solution using strengths from both]
```

### Specialized Task Routing

Route tasks to providers based on their strengths:

**For Claude:**

- Creative writing and storytelling
- Code reviews and refactoring
- Complex planning and strategy
- File operations and system tasks

**For Gemini:**

- Mathematical calculations
- Data analysis and visualization
- Quick iterations and prototyping
- Scientific and technical research

### Iterative Development

Use provider switching for iterative improvement:

```
1. Start with Gemini for rapid prototyping
2. Switch to Claude for code review and refinement
3. Back to Gemini for performance optimization
4. Claude again for documentation and testing
```

## Model Selection Within Providers

### Claude Models

Use `/claude` slash command to switch between Claude models:

```bash
/claude sonnet          # Switch to Claude Sonnet 4 (default)
/claude opus            # Switch to Claude Opus 4 (most powerful)
```

**When to use Opus:**

- Complex reasoning tasks
- Large codebase analysis
- Strategic planning sessions
- Auto-triggered in plan mode (if enabled)

### Gemini Models

Gemini automatically selects appropriate models:

- **Gemini 2.5 Pro**: Default for most tasks
- **Gemini Flash**: For faster, simpler operations
- Automatic optimization based on request complexity

## Auto Opus Integration

### Automatic Model Switching

When **Auto Opus** is enabled in dashboard settings:

1. **Plan Mode Trigger**: Switching to plan mode automatically activates Opus
2. **Enhanced Context**: Gets maximum reasoning capability for complex tasks
3. **Automatic Restoration**: Returns to previous model when exiting plan mode

### Enabling Auto Opus

1. Open dashboard: `/dashboard`
2. Navigate to "Auto Opus" setting
3. Toggle ON for automatic switching
4. Use `Shift+Tab` to cycle to plan mode and trigger Opus

## Session Management During Switching

### Session Persistence

Each provider maintains its own session files:

**Claude Sessions:**

- Stored in `~/.claude/projects/{project-hash}/`
- JSONL format with conversation chains
- Linked-list structure for message relationships

**Gemini Sessions:**

- Stored in `.gemini/checkpoints/`
- JSON checkpoint format
- Tag-based session identification

### Cross-Provider Session Sync

The sync engine maintains:

- **Universal Session ID**: Consistent identifier across providers
- **Bidirectional Updates**: Changes sync to both provider sessions
- **Conflict Resolution**: Handles simultaneous updates gracefully
- **State Consistency**: Ensures both providers have latest conversation

### Session Recovery

If sync fails:

1. **Automatic Retry**: System attempts to re-sync automatically
2. **Manual Recovery**: Switch providers to trigger re-sync
3. **Fallback**: Each provider maintains independent session as backup

## Troubleshooting Provider Switching

### Common Issues

**Provider Not Available:**

```
Claude (Unavailable) | Check authentication
```

**Solutions:**

- Verify Claude CLI installation: `claude --version`
- Check authentication: `claude auth`
- Ensure proper API keys for Gemini

**Sync Failures:**

```
Sync failed: Unable to update Gemini session
```

**Solutions:**

- Wait and retry switching
- Check network connectivity
- Restart Nexus CLI to reset sync engine

**Context Loss:**

```
Provider switched but conversation history missing
```

**Solutions:**

- Use `Ctrl+S` again to re-trigger sync
- Check session file permissions
- Verify provider authentication

### Performance Optimization

**Reduce Sync Delays:**

- Ensure fast network connection
- Keep session files accessible
- Regular cleanup of old session files

**Improve Response Times:**

- Use appropriate model for task complexity
- Consider provider strengths for task routing
- Enable Auto Opus only when needed

## Best Practices

### Efficient Switching

1. **Task-Appropriate Routing**: Use Claude for writing, Gemini for math
2. **Comparison Workflows**: Switch for different perspectives
3. **Iterative Development**: Alternate for different development phases
4. **Quick Verification**: Switch to validate solutions

### Context Management

1. **Clear Instructions**: Provide context when switching providers
2. **Reference Previous Work**: Mention earlier responses when needed
3. **Maintain Thread**: Keep conversation logical across switches
4. **File References**: Use `@filename` syntax for consistent file context

### Performance Tips

1. **Strategic Switching**: Don't switch unnecessarily
2. **Model Selection**: Use appropriate models for task complexity
3. **Session Cleanup**: Regularly clean old session files
4. **Network Awareness**: Consider connection quality for sync speed

## Integration with Other Features

### Permission System

Provider switching respects Claude permission modes:

- **Permission State**: Preserved across switches
- **Mode-Specific Behavior**: Plan mode triggers Auto Opus
- **Tool Permissions**: Maintained for consistent security

### Slash Commands

Commands work across provider switches:

- **Command History**: Available regardless of current provider
- **Execution Context**: Commands executed with current provider
- **Result Consistency**: Command results sync across providers

### Dashboard Settings

Dashboard settings affect provider switching:

- **Auto Opus Configuration**: Controls automatic model switching
- **Provider Preferences**: Default provider selection
- **Sync Settings**: Controls sync behavior and timing
