# Troubleshooting Guide

This guide provides solutions to common issues and debugging tips for Nexus CLI.

## Installation and Setup Issues

### Command Not Found

**Error**: `nexus: command not found`

**Causes and Solutions**:

- **Global installation issue**: Run `npm install -g @wondermoveinc/nexus-cli`
- **PATH not updated**: Restart terminal or add npm global bin to PATH
- **Permission issues**: Use `npx @wondermoveinc/nexus-cli` as alternative
- **Node.js version**: Ensure Node.js 20.0.0 or higher is installed

**Verification**:

```bash
# Check Node.js version
node --version

# Check global npm packages
npm list -g --depth=0

# Alternative: run without global install
npx @wondermoveinc/nexus-cli
```

### Provider Authentication Issues

#### Claude Authentication

**Error**: "claude provider is not available" or status shows "(unavailable)"

**Common causes**:

- Claude CLI not installed or not in PATH
- Claude CLI not authenticated
- Claude CLI version incompatibility

**Solutions**:

```bash
# Verify Claude CLI installation
ls -la ~/.claude/local/claude
~/.claude/local/claude --version

# Authenticate Claude CLI
~/.claude/local/claude auth login

# Test Claude CLI directly
~/.claude/local/claude --help
```

#### Gemini Authentication

**Error**: "gemini provider is not available" or status shows "(unavailable)"

**Common causes**:

- Missing or invalid `GEMINI_API_KEY`
- Network connectivity issues
- API quota exceeded

**Solutions**:

```bash
# Check API key
echo $GEMINI_API_KEY

# Set API key if missing
export GEMINI_API_KEY="your_api_key_here"

# Test API connectivity
curl -H "Authorization: Bearer $GEMINI_API_KEY" \
  https://generativelanguage.googleapis.com/v1/models
```

## Runtime Issues

### Provider Switching Problems

**Issue**: `Ctrl+S` doesn't switch providers

**Diagnostics**:

- Check status bar for provider availability messages
- Look for "claude provider is not available" or "gemini provider is not available"
- Verify both providers are initialized during startup

**Solutions**:

1. **Restart Nexus CLI**: Exit with `Ctrl+C` and restart
2. **Check provider status**: Ensure both providers show as available
3. **Network connectivity**: Test internet connection for API calls
4. **Authentication**: Verify both providers are properly authenticated

### Session Synchronization Issues

**Issue**: Context not preserved when switching providers

**Symptoms**:

- Previous conversation not visible to new provider
- "Starting fresh" instead of continuing conversation
- Inconsistent conversation history

**Solutions**:

1. **Check session files**:
   - Claude: `~/.claude/projects/{project-hash}/`
   - Gemini: Managed by `@google/gemini-cli-core`
2. **Restart session management**: Exit and restart Nexus CLI
3. **Project directory**: Ensure running from same project directory
4. **File permissions**: Check read/write access to session directories

### Streaming and Response Issues

**Issue**: No streaming responses or "Waiting for response..." stuck

**Causes**:

- Network connectivity problems
- Provider API issues
- Rate limiting or quota exceeded
- Streaming disabled or not supported

**Solutions**:

```bash
# Test network connectivity
ping google.com

# Check for rate limiting (Gemini)
# Look for HTTP 429 responses in error messages

# Restart to reset streaming state
# Exit with Ctrl+C and restart
```

### Tool Execution Problems

**Issue**: Tool permissions not working or tools failing

**Common scenarios**:

- MCP socket connection issues
- Permission tier misclassification
- Tool execution timeouts
- Sandbox or security restrictions

**Diagnostics**:

- Check for MCP connection status in status bar
- Look for permission prompt messages
- Verify tool tier classification (Safe/Cautious/Dangerous)

**Solutions**:

1. **MCP connection**:
   - Check `/tmp/mcp-permission-{session-id}.sock` exists
   - Restart to reinitialize MCP server
2. **Permission modes**: Use `Shift+Tab` to cycle Claude permission modes
3. **Tool approval**: Respond to permission prompts with `y` or `n`
4. **Manual approval**: Switch to less restrictive permission mode if needed
5. **Socket issues**: Check `/tmp/mcp-permission-*.sock` files exist and are accessible
6. **Circuit breaker**: Wait 5 seconds if session creation is temporarily blocked

## Performance Issues

### Slow Provider Switching

**Symptoms**:

- Long delays when pressing `Ctrl+S`
- Timeout messages during switching
- UI freezes during provider changes

**Causes**:

- Large conversation history
- Network latency
- Provider API delays
- Synchronization overhead

**Solutions**:

1. **Restart session**: Start fresh conversation for complex debugging
2. **Check network**: Test connection to both provider APIs
3. **Reduce history**: Clear or limit conversation length
4. **Provider health**: Verify both providers are responsive

### Memory and Resource Usage

**Issue**: High CPU or memory usage

**Monitoring**:

```bash
# Check process resource usage
ps aux | grep nexus
top -p $(pgrep nexus)
```

**Solutions**:

- Restart Nexus CLI periodically for long sessions
- Limit conversation history length
- Close unnecessary terminals running Nexus CLI
- Check for memory leaks in long-running sessions

## File and Permission Issues

### Session File Access

**Error**: Permission denied or file access issues

**Common locations**:

- `~/.claude/projects/` - Claude session files
- `/tmp/mcp-permission-*.sock` - MCP socket files
- Project `.gemini/` directories - Gemini checkpoints

**Solutions**:

```bash
# Check file permissions
ls -la ~/.claude/projects/
ls -la /tmp/mcp-permission-*

# Fix permissions if needed
chmod 644 ~/.claude/projects/*/*
chmod 755 ~/.claude/projects/*/

# Clean up stale socket files
rm /tmp/mcp-permission-*.sock
```

### Project Directory Issues

**Issue**: Session not restored or wrong project context

**Verification**:

```bash
# Check current directory
pwd

# Verify project structure
ls -la

# Check for .git directory (project root detection)
ls -la .git
```

**Solutions**:

- Run Nexus CLI from project root directory
- Ensure consistent working directory across sessions
- Check project path encoding in Claude session directories

## Network and Connectivity Issues

### API Connection Problems

**Error**: Network timeouts or connection refused

**Claude CLI**:

- Uses subprocess communication, should work offline once authenticated
- Check Claude CLI can connect: `claude --version`

**Gemini API**:

- Requires internet connectivity
- Test direct API access with curl
- Check for firewall or proxy issues

**Corporate Networks**:

```bash
# Check proxy settings
echo $HTTP_PROXY
echo $HTTPS_PROXY

# Test connectivity
curl -v https://generativelanguage.googleapis.com/
curl -v https://api.anthropic.com/
```

### Rate Limiting

**Symptoms**:

- "Rate limit exceeded" messages
- HTTP 429 responses
- Delayed or failed responses

**Solutions**:

1. **Wait**: Respect rate limits and retry later
2. **Check quotas**: Review API usage in provider dashboards
3. **Optimize usage**: Reduce frequency of requests
4. **Provider switching**: Use alternative provider when one is rate limited

## Debugging and Diagnostics

### Enable Debug Mode

While not explicitly exposed in the UI, you can debug issues:

1. **Check initialization**: Watch startup sequence for error messages
2. **Monitor status bar**: Provider status and connection indicators
3. **Test providers individually**: Verify each provider works independently
4. **Check logs**: Look for error output in terminal

### Common Error Messages

**"Initializing Nexus..."** - Normal startup sequence
**"claude provider is not available"** - Claude CLI or authentication issue
**"gemini provider is not available"** - Gemini API or connectivity issue
**"(unavailable)"** - Provider status indicator when provider is not accessible

### Recovery Procedures

#### Full Reset

```bash
# Exit cleanly
# Press Ctrl+C in Nexus CLI

# Clean up processes and sockets
pkill -f mcp-permission
rm /tmp/mcp-permission-*.sock

# Restart
nexus
```

#### Provider Reset

```bash
# Test Claude CLI independently
~/.claude/local/claude --version
~/.claude/local/claude auth status

# Test Gemini API
curl -H "Authorization: Bearer $GEMINI_API_KEY" \
  https://generativelanguage.googleapis.com/v1/models

# Restart Nexus CLI
```

#### Session Reset

- Exit Nexus CLI
- Move to different directory and back
- Restart to force new session creation

## Getting Help

### Information Gathering

When reporting issues, include:

- Nexus CLI version and installation method
- Operating system and terminal type
- Claude CLI version (`~/.claude/local/claude --version`)
- Node.js version (`node --version`)
- Error messages and stack traces
- Steps to reproduce the issue

### Support Channels

- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Check this guide and other documentation sections
- **Provider-specific help**:
  - Claude CLI: Anthropic documentation
  - Gemini API: Google AI documentation

### Workarounds

**If one provider fails**:

- Use the working provider until issue is resolved
- Provider switching allows graceful degradation

**If session sync fails**:

- Continue with single provider
- Export important conversation content
- Restart for fresh session

**If keyboard shortcuts fail**:

- Use alternative key combinations
- Restart terminal or Nexus CLI
- Check terminal configuration

This troubleshooting guide covers the most common issues encountered with Nexus CLI. For additional help, refer to the provider-specific documentation or report issues through the appropriate channels.
