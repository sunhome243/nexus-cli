# Slash Commands Guide

Nexus CLI features a powerful and extensible slash command system that allows you to execute both built-in commands and custom project-specific commands by typing `/commandname [arguments]`.

## Overview

The slash command system provides:

- **Built-in Commands**: Core functionality like provider switching and dashboard access
- **Custom Commands**: Project-specific workflows stored in `.claude/commands/`
- **Auto-completion**: Real-time command suggestions as you type
- **Argument Support**: Commands can accept and process arguments
- **Hierarchical Organization**: Commands can be organized in subdirectories

## Built-in Commands

### `/claude [model]`

Switch Claude models or show current model information.

**Usage:**

```bash
/claude                 # Show current model and usage info
/claude sonnet          # Switch to Claude Sonnet 4
/claude opus            # Switch to Claude Opus 4
```

**Features:**

- Instant model switching
- Usage statistics display
- Model availability checking
- Preserves conversation context

### `/dashboard`

Opens the interactive dashboard overlay for settings and statistics.

**Usage:**

```bash
/dashboard              # Open dashboard overlay
```

**Features:**

- Auto Opus toggle configuration
- MCP server management
- Real-time usage statistics
- Keyboard navigation (↑/↓/Enter/ESC)

### `/` (List Commands)

Shows all available commands with descriptions.

**Usage:**

```bash
/                       # List all available commands
```

**Features:**

- Shows both built-in and custom commands
- Command descriptions and categories
- Real-time filtering as you type

## Custom Command System

### Command Directory Structure

Custom commands are stored as Markdown files in the `.claude/commands/` directory:

### Command File Format

Commands use a standardized Markdown format:

```markdown
# Command Name - Brief Description

Purpose: Clear description of what the command does
Target: $ARGUMENTS (description of expected arguments)

## Command Implementation

[Detailed instructions for the AI assistant]

Use $ARGUMENTS placeholder where user-provided arguments should be inserted.
```

**Example: `commit.md`**

```markdown
# Git Commit Helper

Purpose: Generate conventional commit messages by analyzing staged changes
Target: $ARGUMENTS (optional scope or additional context)

## Command Implementation

Analyze the staged changes and generate a conventional commit message.

Scope context: $ARGUMENTS

Steps:

1. Run git diff --staged to see changes
2. Categorize the type of changes
3. Generate conventional commit message
4. Validate with pre-commit checks
```

### Creating Custom Commands

1. **Create Command File**: Add a `.md` file to `.claude/commands/`
2. **Follow Format**: Use the standard command format with Purpose and $ARGUMENTS
3. **Automatic Discovery**: Commands are automatically loaded on next startup

**Command Template:**

```markdown
# Your Command Name

Purpose: What this command does
Target: $ARGUMENTS (what arguments are expected)

## Implementation

Your detailed instructions here.

When user provides arguments, replace $ARGUMENTS with: $ARGUMENTS
```

## Command Execution

### Basic Execution

Type a slash followed by the command name:

```bash
/commit "Add user authentication feature"
```

### With Arguments

Commands can accept arguments that replace the `$ARGUMENTS` placeholder:

```bash
/plan "Build a REST API with authentication"
/ask "Why is my React component not re-rendering?"
/doc "Explain the user authentication system"
```

### Auto-completion

As you type `/`, you'll see available commands:

```
Available commands:
  /claude     - Switch Claude models
  /dashboard  - Open settings dashboard
  /commit     - Generate commit messages
  /plan       - Task planning assistance
  /ask        - Debugging help
```

## Command Discovery and Loading

### Automatic Scanning

Commands are automatically discovered by:

1. **Directory Scanning**: Recursively scans `.claude/commands/`
2. **File Loading**: Reads all `.md` files
3. **Metadata Extraction**: Extracts command descriptions and purposes
4. **Caching**: Loads once and caches for performance

### Command Metadata

Each command provides:

- **Name**: Filename without `.md` extension
- **Description**: From "Purpose:" line or first content line
- **Content**: Full command implementation

## Advanced Features

### Argument Processing

Commands support sophisticated argument handling:

```markdown
# Multi-argument Command Example

Purpose: Process multiple inputs
Target: $ARGUMENTS (format: "arg1,arg2,arg3")

## Implementation

First argument: {extract first from $ARGUMENTS}
Second argument: {extract second from $ARGUMENTS}
Remaining arguments: {process rest of $ARGUMENTS}
```

### Provider Integration

Commands work seamlessly with both providers:

- **Claude Integration**: Commands executed through Claude provider
- **Gemini Integration**: Commands processed by Gemini provider
- **Provider Switching**: Command context preserved across switches
- **Permission Handling**: Commands respect Claude permission modes

### Error Handling

The slash command system provides robust error handling:

- **Command Not Found**: Clear error message with available commands list
- **Invalid Arguments**: Helpful error messages explaining expected format
- **Execution Failures**: Graceful fallback with descriptive error information
- **Permission Denied**: Clear security messages when commands are restricted

## Best Practices

### Writing Effective Commands

1. **Clear Purpose**: Write descriptive purpose statements
2. **Argument Documentation**: Clearly explain expected arguments
3. **Structured Implementation**: Use clear step-by-step instructions
4. **Context Preservation**: Include relevant context requirements

### Command Organization

1. **Consistent Naming**: Use clear, descriptive command names
2. **Avoid Conflicts**: Don't duplicate built-in command names
3. **Documentation**: Include helpful descriptions

### Performance Considerations

1. **Efficient Commands**: Keep command logic focused and efficient
2. **Minimal Dependencies**: Avoid complex external dependencies
3. **Fast Execution**: Design for quick command processing

## Integration with Nexus CLI Features

### Permission System

Commands integrate with Claude's permission modes:

- **Default Mode**: Standard permission prompts
- **Accept Edits**: Auto-approve file modifications
- **Plan Mode**: Enhanced planning context
- **Bypass Mode**: Skip permission prompts

Gemini Permission mode switching is not supported yet.

### Session Management

Commands work with Nexus's session system:

- **Session Persistence**: Command history preserved
- **Cross-Provider Sync**: Commands synchronized between providers
- **Context Continuity**: Command results maintain conversation flow

## Security and Safety

### File System Security

- **Restricted Access**: Commands limited to `.claude/commands/` directory
- **Safe Processing**: No arbitrary code execution
- **Content Validation**: Markdown-only format prevents injection

### Argument Sanitization

- **Input Validation**: Arguments validated before processing
- **Safe Substitution**: Secure placeholder replacement
- **Error Boundaries**: Graceful handling of malformed inputs

## Troubleshooting

### Common Issues

**Commands Not Loading:**

- Check `.claude/commands/` directory exists
- Verify `.md` file format
- Ensure proper file permissions

**Command Not Found:**

- Check command name spelling
- Verify file is in correct directory
- Restart CLI to refresh command cache

**Arguments Not Working:**

- Ensure `$ARGUMENTS` placeholder in command file
- Check argument format requirements
- Verify command expects arguments

### Debug Information

Enable debug logging to troubleshoot command issues:

- Command discovery process
- File loading errors
- Execution failures
