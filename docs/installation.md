# Installation Guide

This comprehensive guide covers all installation methods for Nexus CLI, from basic installation to advanced development setup.

## Overview

Nexus CLI requires:

- **Node.js 20.0.0 or higher**
- **Claude CLI** (for Claude provider)
- **Google API Key** (for Gemini provider)

## Prerequisites

### 1. Node.js Installation

**Check Current Version**:

```bash
node --version
npm --version
```

**Required**: Node.js 20.0.0 or higher

**Installation Options**:

**Option A: Official Installer**

1. Visit [nodejs.org](https://nodejs.org/)
2. Download LTS version (20.x or higher)
3. Run installer and follow instructions

**Option B: Node Version Manager (Recommended)**

```bash
# Install nvm (macOS/Linux)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node.js 20
nvm install 20
nvm use 20
nvm alias default 20
```

**Option C: Package Managers**

```bash
# macOS with Homebrew
brew install node

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Windows with Chocolatey
choco install nodejs
```

### 2. Claude CLI Installation

**Installation**:

```bash
# Install Claude CLI from Anthropic
npm install -g @anthropic-ai/claude-code
```

**Alternative Installation Methods**:

```bash
# Using npm (if available)
npm install -g @anthropic-ai/claude-cli

# Direct download (check Anthropic docs for latest)
# Visit: https://docs.anthropic.com/en/docs/claude-code
```

**Verify Installation**:

```bash
claude --version
```

**Authentication**:

```bash
# Authenticate with your Anthropic account
claude auth

# Follow the prompts to sign in
# This opens a browser window for authentication
```

**Test Claude CLI**:

```bash
# Test basic functionality
claude --help

# Test in a project directory
cd /path/to/your/project
claude "Hello, can you see this project?"
```

### 3. Gemini API Setup

**Get API Key**:

1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Sign in with Google account
3. Create new API key
4. Copy the API key for later use

**Set Environment Variable**:

```bash
# Add to your shell profile (.bashrc, .zshrc, etc.)
export GEMINI_API_KEY="your-api-key-here"

# For current session only
export GEMINI_API_KEY="your-api-key-here"
```

**Verify Gemini Access**:

```bash
# Test with a simple curl command
curl -H "Content-Type: application/json" \
     -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
     -X POST \
     "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}"
```

## Installation Methods

### Method 1: Global Installation (Recommended)

**Install globally for system-wide access**:

```bash
npm install -g @wondermoveinc/nexus-cli
```

**Verify installation**:

```bash
nexus --version
which nexus
```

**First run**:

```bash
# Navigate to a project directory
cd /path/to/your/project

# Start Nexus CLI
nexus
```

### Method 2: Development Setup

**For contributors and developers**:

```bash
# Clone repository
git clone https://github.com/your-repo/nexus-cli.git
cd nexus-cli

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Or run built version
node dist/cli.js
```

**Development Commands**:

```bash
npm run dev         # Development mode with hot reload
npm run build       # Build for production
npm run typecheck   # TypeScript type checking
npm test            # Run test suite
```

## Verification and Testing

### 1. Installation Verification

**Check all components**:

```bash
# Node.js version
node --version    # Should be 20.0.0+

# npm version
npm --version

# Claude CLI
claude --version

# Nexus CLI
nexus --version

# Environment variables
echo $GEMINI_API_KEY  # Should show your API key
```

### 2. Functionality Testing

**Test Claude Integration**:

```bash
# Start Nexus CLI
nexus

# In Nexus CLI, test Claude
> Hello Claude, can you confirm you're working?

# Check Claude model switching
/claude sonnet
/claude opus
```

**Test Gemini Integration**:

```bash
# In Nexus CLI, switch to Gemini
Ctrl+S

# Test Gemini response
> Hello Gemini, can you confirm you're working?
```

**Test Provider Switching**:

```bash
# Start with Claude
> What's 2+2?

# Switch to Gemini
Ctrl+S

# Ask follow-up question
> Can you explain that differently?

# Switch back to Claude
Ctrl+S

> Now combine both explanations
```

**Test Dashboard**:

```bash
# In Nexus CLI
/dashboard

# Navigate with arrow keys, test settings
```

### 3. Session Testing

**Test Session Persistence**:

```bash
# Start conversation
> Remember this number: 42

# Exit Nexus CLI
Ctrl+C

# Restart Nexus CLI
nexus

# Test if session resumed
> What number did I tell you to remember?
```

## Configuration

### Environment Variables

**Required**:

```bash
export GEMINI_API_KEY="your-gemini-api-key"
```

**Add to Shell Profile**:

```bash
# For bash
echo 'export GEMINI_API_KEY="your-api-key"' >> ~/.bashrc
source ~/.bashrc

# For zsh
echo 'export GEMINI_API_KEY="your-api-key"' >> ~/.zshrc
source ~/.zshrc

# For fish
echo 'set -x GEMINI_API_KEY "your-api-key"' >> ~/.config/fish/config.fish
```

### Working Directory Setup

**Project-specific setup**:

```bash
# Navigate to your project
cd /your/project/directory

# Create Nexus configuration (optional)
mkdir -p .nexus

# Create custom commands directory (optional)
mkdir -p .claude/commands

# Start Nexus CLI
nexus
```

## Advanced Installation

### Container Setup

**Docker installation**:

```dockerfile
FROM node:20-alpine

# Install dependencies
RUN npm install -g @wondermoveinc/nexus-cli

# Set up environment
ENV GEMINI_API_KEY="your-api-key"

# Working directory
WORKDIR /workspace

# Entry point
CMD ["nexus"]
```

**Run in container**:

```bash
# Build image
docker build -t nexus-cli .

# Run with volume mount for session persistence
docker run -it \
  -v $(pwd):/workspace \
  -e GEMINI_API_KEY="your-api-key" \
  nexus-cli
```

## Troubleshooting Installation

### Common Issues

**Node.js version too old**:

```bash
# Error: Requires Node.js 20.0.0 or higher
# Solution: Update Node.js
nvm install 20
nvm use 20
```

**Claude CLI not found**:

```bash
# Error: claude: command not found
# Solution: Reinstall Claude CLI
npm install -g @anthropic-ai/claude-code

# Add to PATH if needed
export PATH="$PATH:$HOME/.local/bin"
```

**Gemini API authentication failed**:

```bash
# Error: API key not found or invalid
# Solution: Check API key
echo $GEMINI_API_KEY

# Reset API key
export GEMINI_API_KEY="your-correct-api-key"
```

**Permission denied errors**:

```bash
# Fix npm permissions (macOS/Linux)
sudo chown -R $(whoami) $(npm config get prefix)

# Or use nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
```

**Session not persisting**:

```bash
# Check working directory permissions
ls -la .nexus/

# Fix permissions if needed
chmod 755 .nexus/
chmod 644 .nexus/*.json
```

### Getting Help

**Check installation status**:

```bash
# Run diagnostic
nexus --version
nexus --help

# Check provider status
nexus --check-providers  # (if available)
```

**Documentation**:

- [Getting Started Guide](./cli/getting-started.md)
- [Troubleshooting Guide](./troubleshooting.md)
- [Configuration Guide](./cli/configuration.md)

**Support**:

- GitHub Issues: Report problems on the project repository
- Documentation: Browse `/docs/` directory
- Community: Join discussions

## Post-Installation

After successful installation:

1. **Read Getting Started**: Check the [Getting Started Guide](./cli/getting-started.md)
2. **Learn Keyboard Shortcuts**: Review [Keyboard Shortcuts](./cli/keyboard-shortcuts.md)
3. **Explore Features**: Read the [Complete Features Guide](./cli/features.md)
4. **Configure Settings**: Use `/dashboard` to configure Auto Opus and MCP servers
5. **Set Up Custom Commands**: Create project-specific commands in `.claude/commands/`

Your Nexus CLI installation is now complete and ready for unified AI assistance!
