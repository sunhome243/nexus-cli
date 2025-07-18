# Dashboard Guide

The Nexus CLI dashboard provides a centralized interface for managing settings, viewing usage statistics, and configuring MCP servers. This guide covers all dashboard features and how to use them effectively.

## Accessing the Dashboard

### Opening the Dashboard

**Slash Command**: `/dashboard`

Type `/dashboard` in the main interface to open the dashboard overlay:

```bash
> /dashboard
```

The dashboard opens as a modal overlay over the main interface.

### Dashboard Interface

```
┌─ 🔧 Dashboard ─────────────────────────┐
│                                        │
│ ▶ Auto Opus on Plan Mode: ON          │
│   Automatically use Opus in Plan Mode │
│                                        │
│   MCP Servers                          │
│   Manage MCP servers for Claude & Gem  │
│                                        │
│   Usage Statistics                     │
│   View real-time usage for both prov   │
│                                        │
│ ↑/↓ Navigate • Enter Toggle • ESC Close│
└────────────────────────────────────────┘
```

## Navigation

### Keyboard Controls

| Key     | Action                                       |
| ------- | -------------------------------------------- |
| `↑`     | Navigate up through options                  |
| `↓`     | Navigate down through options                |
| `Enter` | Select/toggle current option                 |
| `ESC`   | Close dashboard and return to main interface |

### Visual Indicators

- **Selected Option**: Highlighted with `▶` arrow and blue accent color
- **Option Status**: ON/OFF states clearly displayed
- **Descriptions**: Secondary text explains each option's purpose
- **Navigation Help**: Bottom bar shows available controls

## Dashboard Features

### 1. Auto Opus Settings

**Purpose**: Automatically switch to Claude Opus when entering plan mode

**How it works**:

- **Automatic Activation**: When you cycle to plan mode (`Shift+Tab`), Claude automatically switches to Opus
- **Model Restoration**: When you exit plan mode, Claude returns to your previous model (Sonnet)
- **Enhanced Planning**: Opus provides maximum reasoning capability for complex tasks
- **User Control**: Can be enabled or disabled via the dashboard

**Toggle States**:

- **ON**: Auto Opus enabled - plan mode triggers Opus
- **OFF**: Auto Opus disabled - plan mode uses current model

**Configuration**:

1. Navigate to "Auto Opus on Plan Mode" option
2. Press `Enter` to toggle between ON/OFF
3. Setting takes effect immediately
4. Setting saves to configuration file

### 2. MCP Server Management

**Purpose**: Configure Model Context Protocol servers for enhanced tool integration

#### Accessing MCP Manager

1. Navigate to "MCP Servers" option in dashboard
2. Press `Enter` to open MCP Manager
3. Use arrow keys to navigate options
4. Press `ESC` to return to main dashboard

#### MCP Manager Options

**Add MCP Server**:

- Opens guided JSON import wizard
- Supports bulk import from configuration files
- Choose Claude Code and/or Gemini CLI as targets
- Select deployment scope (local, project, user)

**List MCP Servers**:

- Displays all configured servers organized by scope
- Shows server status and configuration details
- Platform indicators (Claude Code / Gemini CLI)

**Remove MCP Server**:

- Select servers to remove with confirmation
- Organized by scope for easy management
- Prevents accidental removal with confirmation dialogs

#### MCP Server Scopes

**Claude Code Scopes**:

- **Local**: Project-specific, stored in `~/.claude.json`
- **Project**: Shared across project team, stored in `.mcp.json`
- **User**: Global user configuration, stored in `~/.claude/mcp.json`

**Gemini CLI Scopes**:

- **Project**: Project-specific configuration
- **User**: Global user configuration

#### Server Configuration

**Transport Types**:

- **stdio**: Command-line interface integration
- **SSE**: Server-Sent Events for real-time communication
- **HTTP**: REST API endpoints

**Configuration Options**:

```json
{
  "command": "server-command",
  "args": ["--arg1", "--arg2"],
  "env": {
    "ENV_VAR": "value"
  },
  "timeout": 30000
}
```

#### JSON Import Process

1. **Prepare Configuration**: Create JSON with server definitions
2. **Open Import Wizard**: Select "Add MCP Server" from MCP Manager
3. **Paste Configuration**: Input JSON configuration
4. **Select Platforms**: Choose Claude Code and/or Gemini CLI
5. **Choose Scope**: Select deployment scope
6. **Validate and Import**: System validates and imports servers

**Example Configuration**:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/files"]
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-api-key"
      }
    }
  }
}
```

### 3. Usage Statistics

**Purpose**: Monitor token usage and costs for both Claude and Gemini providers

#### Claude Usage Statistics

**Data Source**: Integrates with Claude CLI's usage tracking system

**Information Displayed**:

- **Current Session Cost**: Real-time cost in USD
- **Token Usage**: Tokens consumed in current session
- **Burn Rate**: Tokens per minute and cost per hour
- **Plan Usage**: Usage against all available Claude plans (Free, Pro, Team)
- **Progress Bars**: Visual representation of usage limits
- **Time to Reset**: When usage windows reset

**Visual Format**:

```
Claude Usage (5h window)
Free: ████████░░ 80% ($1.20 / $5.00)
Pro:  ███░░░░░░░ 30% ($3.45 / $15.00)
Reset in: 2h 15m
```

#### Gemini Usage Statistics

**Data Source**: Integrates with Gemini CLI telemetry system

**Information Displayed**:

- **Session Tokens**: Current session token consumption
- **Session Duration**: How long current session has been active
- **Model Breakdown**: Usage by specific Gemini models (2.5 Pro, Flash)
- **Daily Totals**: Accumulated daily usage
- **Cost Estimation**: Estimated costs based on usage
- **Tool Statistics**: Tool execution metrics

**Visual Format**:

```
Gemini Usage (Session)
Tokens: 1,250 (Gemini 2.5 Pro)
Duration: 25 minutes
Daily Total: 5,670 tokens
Estimated Cost: $0.23
```

#### Statistics Loading

- **Async Loading**: Statistics load asynchronously to prevent blocking
- **Loading State**: Shows spinner with "Loading usage data..." message
- **Error Handling**: Graceful fallback with error messages if data unavailable
- **No Auto-refresh**: Statistics loaded only when dashboard opens

## Dashboard Integration

### Settings Persistence

**Auto Opus Settings**:

- Stored in localStorage
- Setting saves to configuration file
- Synchronized across provider switches
- Take effect immediately when changed

**Quota Fallback Configuration**:

- Automatic detection of Gemini Pro quota exhaustion
- Seamless fallback to Gemini Flash model
- Dashboard displays current fallback status
- Fallback settings configurable per provider

**MCP Server Configuration**:

- Stored in provider-specific configuration files
- Platform-specific deployment (Claude Code vs Gemini CLI)
- Scope-based organization (local, project, user)
- Real-time validation and error reporting

### Provider Integration

**Claude Integration**:

- Auto Opus respects Claude permission modes
- MCP servers integrated with Claude Code configuration
- Usage statistics via Claude CLI tools
- Model switching synchronized with provider state

**Gemini Integration**:

- MCP servers configured for Gemini CLI
- Usage tracking via Gemini telemetry
- Settings maintained across provider switches

### Session Management

**Cross-Provider Sync**:

- Dashboard settings apply to both providers
- Configuration synchronized during provider switches
- Session persistence maintains settings

**Universal Configuration**:

- MCP servers can be configured for both providers simultaneously
- Settings remain consistent across all sessions
- Provider-specific features handled appropriately

## Best Practices

### Auto Opus Usage

1. **Enable for Complex Tasks**: Turn on Auto Opus when working on complex planning or analysis tasks
2. **Monitor Usage**: Check Claude usage statistics to manage costs
3. **Strategic Use**: Plan mode with Opus is powerful but uses more tokens
4. **Disable for Simple Tasks**: Turn off Auto Opus for routine development work

### MCP Server Management

1. **Scope Appropriately**: Use project scope for team-shared servers, user scope for personal tools
2. **Security Consideration**: Be cautious with servers that access file systems or external APIs
3. **Regular Review**: Periodically review and clean up unused MCP servers
4. **Configuration Backup**: Keep backups of important MCP configurations

### Usage Monitoring

1. **Regular Checks**: Monitor usage statistics to avoid unexpected costs
2. **Plan Management**: Choose appropriate Claude plans based on usage patterns
3. **Session Awareness**: Be mindful of long sessions and their accumulated costs
4. **Tool Usage**: Monitor tool execution statistics for optimization opportunities

## Troubleshooting

### Dashboard Not Opening

**Issue**: `/dashboard` command doesn't open dashboard

**Solutions**:

- Check that you're typing the full `/dashboard` command
- Ensure no other overlay is currently active

### Statistics Not Loading

**Issue**: Usage statistics show "Loading..." indefinitely

**Solutions**:

- Check internet connection for provider API access
- Verify Claude CLI authentication: `claude --version`
- Check Gemini CLI configuration and API keys
- Close and reopen dashboard to retry loading

### MCP Server Issues

**Issue**: MCP servers not appearing or functioning

**Solutions**:

- Verify JSON configuration syntax
- Check that server commands are installed and accessible
- Review scope configuration (local vs project vs user)
- Check server logs for connection issues

### Auto Opus Not Working

**Issue**: Auto Opus doesn't activate in plan mode

**Solutions**:

- Verify Auto Opus is enabled in dashboard
- Check that you're using Claude provider (not Gemini)
- Ensure plan mode is properly activated (`Shift+Tab`)
- Check Claude CLI authentication and model availability

### Configuration Files

**MCP Servers**: Stored in provider-specific configuration directories

- Claude Code: `~/.claude.json` (local), `.mcp.json` (project), `~/.claude/mcp.json` (user)
- Gemini CLI: Configuration managed through ~/.gemini/settings.json

**Dashboard Settings**: Stored in memory

- Auto Opus preferences
- Dashboard state and preferences
- User interface settings

The dashboard serves as the central control hub for Nexus CLI, providing easy access to essential settings, real-time usage monitoring, and advanced MCP server configuration. Regular use of the dashboard helps optimize your AI assistant workflow while maintaining awareness of usage and costs.
