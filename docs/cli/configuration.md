# Configuration Guide

This guide covers the actual configuration options available in NEXUS CLI based on the implemented codebase.

## MCP Server Configuration

### Dashboard Configuration

**Access**: `/dashboard` → MCP Servers

**Management Options**:

- Add servers via JSON import
- Configure server scopes
- Platform selection (Claude Code/Gemini CLI)
- Server lifecycle management

**Storage**: Platform-specific configuration files managed automatically

## Authentication

### Claude CLI

Uses Claude CLI's built-in authentication:

```bash
claude auth
```

### Gemini API

Requires `GEMINI_API_KEY` environment variable:

```bash
export GEMINI_API_KEY="your-api-key"
```

### Optional Environment Variables

**Logging Configuration**

```bash
export DEBUG="true"              # Enable debug logging
export LOG_LEVEL="info"          # Log level: dev, info, silent
export NODE_ENV="development"    # Environment mode
```

## Configuration Files

### MCP Configuration

**Claude Configuration**

- `~/.claude/settings.json` - Claude settings
- `.claude/.settings.local.json` - Project-specific Claude config

**Gemini Configuration**

- `~/.gemini/settings.json` - Gemini settings
- Various platform-specific paths

Example Claude config:

```json
{
  "model": "claude-4-sonnet",
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/paths"]
    }
  }
}
```

### Session Storage

**File Structure**

```
.nexus/
├── sessions.json        # Session registry
├── sync-state.json      # Sync state
├── claude-ref/          # Claude session references
└── gemini-backup/       # Gemini backup files
```

### UI Settings

- Theme preferences
- Input history
- Model selection

## Troubleshooting

### Common Issues

**Environment variables not loaded**:

```bash
# Check if variables are set
env | grep -E "(GEMINI_API_KEY|DEBUG|LOG_LEVEL)"

# Reload shell configuration
source ~/.bashrc  # or ~/.zshrc
```

**Auto Opus setting not persisting**:

- Settings stored in localStorage
- Access via `/dashboard` command
- Toggle Auto Opus setting

**MCP configuration issues**:

- Use `/dashboard` → MCP Servers
- Check MCP server logs
- Verify server configurations

**Provider authentication**:

```bash
# Test Claude CLI
claude --version

# Test Gemini API
gemini -p "Hello!"
```

## Best Practices

1. **API Keys**: Keep API keys secure, use environment variables
2. **Project Config**: Use `.claude_config` for project-specific settings
3. **MCP Servers**: Configure through dashboard for proper management
4. **Session Management**: Let the system handle session files automatically
5. **Debugging**: Use `DEBUG=true` for troubleshooting

This configuration guide covers only the features that are actually implemented in the NEXUS CLI codebase.
