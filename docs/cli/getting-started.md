# Getting Started with Nexus CLI

Welcome to Nexus CLI! This guide will help you install, configure, and start using the unified AI assistant interface for Claude and Gemini.

## Quick Overview

Nexus CLI provides a single terminal interface to interact with both Claude and Gemini AI providers. You can seamlessly switch between them, maintain conversation history across providers, and access advanced features like tool execution, session management, and real-time collaboration.

## Prerequisites

Before installing Nexus CLI, ensure you have the following:

### Required Software

**Node.js 20.0.0 or higher**

```bash
# Check your Node.js version
node --version

# If you need to install or upgrade Node.js:
# Visit https://nodejs.org/ or use a version manager like nvm
```

**Claude CLI (for Claude provider)**

```bash
# Install Claude CLI from Anthropic
# Visit: https://docs.anthropic.com/en/docs/claude-code

# Verify installation
claude --version

# Authenticate with Claude
claude auth
```

**Gemini API Access (for Gemini provider)**

- Gemini CLI Core is automatically installed as a dependency
- You'll need a valid Google API key for Gemini
- Set up authentication through the Gemini CLI

## Installation

### Option 1: Global Installation (Recommended)

Install Nexus CLI globally for easy access from anywhere:

```bash
npm install -g @wondermoveinc/nexus-cli
```

Verify installation:

```bash
nexus --version
```

### Option 2: Direct Execution

Run Nexus CLI without installing:

```bash
npx @wondermoveinc/nexus-cli
```

### Option 3: Development Setup

For developers or contributors:

```bash
# Clone the repository
git clone https://github.com/your-repo/nexus-cli.git
cd nexus-cli

# Install dependencies
npm install

# Run in development mode
npm run dev
```

## First-Time Setup

### 1. Verify Claude CLI Integration

Ensure Claude CLI is properly installed and authenticated:

```bash
# Test Claude CLI
claude --version

# If not authenticated, run:
claude auth
```

### 2. Configure Gemini Authentication

Set up your Gemini API key (if not already configured):

```bash
# Set environment variable
export GEMINI_API_KEY="your-api-key-here"

# Or configure through the Gemini CLI
```

### 3. Launch Nexus CLI

Start the application:

```bash
nexus
```

You should see the Nexus CLI interface with:

- Gradient "Nexus" header
- Status bar showing current provider
- Input prompt ready for your message

## Basic Usage

### Your First Conversation

1. **Start a conversation**:

   ```
   > Hello! Can you help me understand how to use Nexus CLI?
   ```

2. **Watch the streaming response** as it appears in real-time

3. **Continue the conversation** by typing your next message

### Essential Commands

**Switch between providers**:

```
Press Ctrl+S to switch between Claude and Gemini
```

**Access the dashboard**:

```
/dashboard
```

**Get help with slash commands**:

```
/help
```

**Force Claude model selection**:

```
/claude sonnet
/claude opus
```

### Essential Keyboard Shortcuts

| Shortcut      | Action                           |
| ------------- | -------------------------------- |
| `Ctrl+S`      | Switch between Claude and Gemini |
| `Shift+Tab`   | Cycle Claude permission modes    |
| `Ctrl+C`      | Exit application                 |
| `Enter`       | Send message                     |
| `Shift+Enter` | Add newline in multiline input   |
| `↑/↓`         | Navigate message history         |

## Common Workflows

### 1. Simple Q&A Session

Perfect for quick questions and information gathering:

1. Launch Nexus CLI
2. Ask your question
3. Read the streaming response
4. Follow up with additional questions

**Example:**

```
> What's the difference between async and await in JavaScript?
[Streaming response appears...]
> Can you show me an example of error handling with async/await?
```

### 2. Code Review and Analysis

Use file references to include code in your conversations:

1. Include file content with `@` syntax:

   ```
   > Please review @src/components/Button.tsx
   ```

2. Get detailed analysis and suggestions

3. Make edits based on recommendations

### 3. Provider Comparison

Compare responses from different AI providers:

1. Start with Claude:

   ```
   > Explain quantum computing in simple terms
   ```

2. Press `Ctrl+S` to switch to Gemini

3. Ask the same question:

   ```
   > Explain quantum computing in simple terms
   ```

4. Compare the different perspectives and explanations

### 4. Complex Task Planning

Use Claude's plan mode for sophisticated task breakdown:

1. Press `Shift+Tab` to cycle to plan mode (green border)
2. Describe a complex task:
   ```
   > I need to build a REST API with authentication, database integration, and real-time features. Help me plan this project.
   ```
3. If Auto Opus is enabled, it will automatically switch to the most powerful model
4. Get comprehensive planning and step-by-step guidance

### 5. Development Workflow

Integrate Nexus CLI into your development process:

1. **Code analysis**:

   ```
   > Analyze @src/utils/helpers.js for potential improvements
   ```

2. **Documentation generation**:

   ```
   > Generate documentation for @src/api/routes.js
   ```

3. **Debugging assistance**:

   ```
   > This error is occurring: [paste error]. Here's the relevant code: @src/components/Form.jsx
   ```

4. **Test creation**:
   ```
   > Create unit tests for @src/services/UserService.js
   ```

## Understanding the Interface

### Status Bar Elements

The status bar shows important information:

```
Claude (Available) | Permission: default | Model: Sonnet | MCP: Connected
```

- **Provider**: Current AI provider (Claude/Gemini)
- **Availability**: Provider connection status
- **Permission Mode**: Current Claude permission level (Claude only)
- **Model**: Active model (Sonnet/Opus for Claude, 2.5 Pro/Flash for Gemini)
- **MCP Status**: Model Context Protocol connection status

### Permission Mode Indicators

Claude permission modes are indicated by border colors:

- **Grey border**: Default mode (standard operation)
- **Blue border**: Accept Edits mode (auto-accepts file modifications)
- **Green border**: Plan mode (enhanced planning context)
- **Red border**: Bypass Permissions mode (maximum automation)

### Visual Cues

- **Streaming indicator**: Shows when responses are being generated
- **Tool execution**: Visual feedback when tools are running
- **File diffs**: Syntax-highlighted changes when files are modified
- **Progress bars**: Usage statistics in dashboard

## Advanced Getting Started

### Custom Commands

Create project-specific commands by adding files to `.claude/commands/`:

**Example: `.claude/commands/deploy.md`**

```markdown
# Deploy Application

Deploys the current application to production

## Usage

/deploy [environment]

## Description

This command triggers the deployment pipeline for the specified environment.
```

### MCP Server Setup

Configure Model Context Protocol servers for advanced tool integration:

1. Access dashboard: `/dashboard`
2. Navigate to MCP Server management
3. Add server configurations
4. Enable tool integrations

### Session Management

Nexus CLI automatically manages sessions:

- **Session Creation**: New sessions created at startup
- **Session Persistence**: Conversations saved automatically
- **Cross-provider Sync**: Session history synchronized between providers
- **Session Resumption**: Previous conversations resumed on restart

## Troubleshooting Quick Start

### Common Issues

**Claude CLI not found:**

```bash
# Verify Claude CLI installation
which claude
claude --version

# If not installed, visit:
# https://docs.anthropic.com/en/docs/claude-code
```

**Gemini authentication issues:**

```bash
# Check API key
echo $GEMINI_API_KEY

# Reconfigure if needed
export GEMINI_API_KEY="your-api-key"
```

**Permission denied errors:**

- Ensure proper file permissions in your working directory
- Check that you have write access for session storage

**Provider switching not working:**

- Verify both providers are properly configured
- Check network connectivity
- Review authentication status

## Next Steps

Now that you're up and running:

1. **Explore Advanced Features**: Check out the [Complete Features Guide](./features.md)
2. **Master Keyboard Shortcuts**: Review the [Keyboard Shortcuts Reference](./keyboard-shortcuts.md)
3. **Learn Slash Commands**: Dive into the [Slash Commands Guide](./commands.md)
4. **Understand Provider Switching**: Read the [Provider Switching Guide](./provider-switching.md)
5. **Configure Dashboard**: Explore the [Dashboard Guide](../tools/dashboard.md)

## Getting Help

- **In-app help**: Type `/help` for slash commands reference
- **Dashboard**: Access `/dashboard` for settings and statistics
- **Documentation**: Browse the complete documentation in `/docs/`
- **Issues**: Report problems on the project repository

Welcome to the unified AI assistant experience with Nexus CLI!
