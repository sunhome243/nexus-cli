# Nexus CLI

[![npm version](https://badge.fury.io/js/@wondermoveinc2Fnexus-cli.svg)](https://badge.fury.io/js/@wondermoveinc%2Fnexus-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Beta](https://img.shields.io/badge/status-beta-orange.svg)
![POC](https://img.shields.io/badge/stage-POC-blue.svg)

A unified command-line AI assistant that integrates multiple AI CLI providers with advanced session management, real-time provider switching, and comprehensive tool integration.

**Status**: This is a proof-of-concept (POC) beta version (v0.0.1).

## Current Providers

![Claude Code](https://img.shields.io/badge/claude%20code-CC785C?style=for-the-badge&logo=anthropic&logoColor=white)
![Gemini CLI](https://img.shields.io/badge/gemini%20cli-4796E3?style=for-the-badge&logo=google%20gemini&logoColor=white)

## Features

- **Seamless Provider Switching**: Switch between Claude and Gemini providers while maintaining conversation context
  ![Nexus CLI Demo](./assets/FocuSee%20Project%202025-07-19%2003-23-28.gif)
- **Universal Session Management**: Cross-provider synchronization using Myers diff algorithm
- **Auto Opus Integration**: Automatic model switching for complex planning tasks
- **Ask Model MCP Integration**: Cross-model consultation with full context sharing - ask other AI models for reviews, second opinions, or specialized analysis
- **MCP Wizard**: Unified MCP server management for both Claude and Gemini providers
- **Dashboard Interface**: Comprehensive settings and usage statistics management

## Installation

### Global Installation (Recommended)

```bash
npm install -g @wondermoveinc/nexus-cli
```

### Local Installation

```bash
npm install @wondermoveinc/nexus-cli
npx @wondermoveinc/nexus-cli
```

### Run Without Installing

```bash
npx @wondermoveinc/nexus-cli
```

## Prerequisites

- **Node.js 20.0.0+**
- **Claude CLI installed** or **Claude API Key**
- **Gemini CLI installed** or **Google API Key**

## Quick Start

1. **Install the package**:

   ```bash
   npm install -g @wondermoveinc/nexus-cli
   ```

2. **Set up Claude authentication** (choose one):

   Option A: Use Claude CLI authentication:

   ```bash
   npm install -g @anthropic-ai/claude-code
   claude migrate-installer # Migrate to local to avoid autoupdater npm permission issues and make Nexus to work properly.
   claude
   ```

   Option B: Set API key environment variable:

   ```bash
   export ANTHROPIC_API_KEY="your-api-key-here"
   ```

3. **Set up Gemini authentication** (choose one):

   Option A: Use Gemini CLI authentication:

   ```bash
   npm install -g @google/gemini-cli
   gemini
   ```

   Option B: Set API key environment variable:

   ```bash
   export GEMINI_API_KEY="your-api-key-here"
   ```

4. **Start Nexus**:

   ```bash
   nexus
   ```

## Usage Examples

### Basic Conversation

```bash
nexus
> Explain the concept of dependency injection
[Claude provides explanation]
```

### Provider Switching

```bash
> Explain microservices architecture
[Claude response]
Ctrl+S  # Switch to Gemini
> What are the potential drawbacks?
[Gemini builds on the conversation]
```

### Advanced Planning

```bash
/dashboard

# Turn on the Auto Opus mode
# Turn on plan mode in Claude

> Plan a scalable e-commerce architecture
[Enhanced planning response with Auto Opus]
Ctrl+S  # Switch to Gemini
> Is this plan accurate?
[Gemini validates on the plan]
```

Opus model is only available on Claude Max plan

### Cross-Model Consultation with Ask Model MCP

```bash
> Create a Python function to parse CSV files
[Claude provides implementation]

> Plan to fix this issue and get a review from Gemini using askmodel MCP
[Claude creates a plan and automatically asks Gemini for review with full context]

> Ask GPT-4 to suggest optimizations for this code using askmodel
[Current model consults GPT-4 with the conversation context]

> Get a second opinion from Gemini on this architectural decision
[Seamlessly requests Gemini's analysis while preserving conversation history]
```

### Token Usage Monitoring

```bash
/dashboard

# Wait until Usage Statistics is loaded

Usage Statistics
🤖 Claude Usage (5-hour windows)
Plus: ▓▓▓▓▓▓▓▓▓▓ 9,290/7,000 (132.7%) ⚠️
   Resets in: 4h 22m
Max 5x: ▓▓▓░░░░░░░ 9,290/35,000 (26.5%)
   Resets in: 4h 22m
Max 20x: ▓░░░░░░░░░ 9,290/140,000 (6.6%)
   Resets in: 4h 22m

Note: Token counts may differ from Claude's official calculation
(Cache tokens might be counted differently)

🔷 Gemini Usage
...
```

## Configuration

### Environment Variables

- `GEMINI_API_KEY` - Your Gemini API key (optional if using `gemini auth`)
- `ANTHROPIC_API_KEY` - Your Claude API key (optional if using `claude auth`)

## Commands

- `Ctrl+S` - Switch between Claude and Gemini providers
- `Shift+Tab` - Cycle through Claude permission modes
- `Shift+Enter` - Insert newline (multiline input)
- `/dashboard` - Open settings and statistics interface
- `/claude [model]` - Switch Claude models
- `ESC` - Cancel streaming or close overlays

### Ask Model Commands

- `ask [model] to [request]` - Consult another AI model with full conversation context
- `get review from [model]` - Request code/plan review from specified model
- `ask [model] using askmodel` - Explicitly invoke the askmodel MCP tool

## Development

### Setup

```bash
git clone https://github.com/username/nexus-cli.git
cd nexus-cli
npm install
```

### Scripts

```bash
npm run dev         # Start development mode
npm run build       # Build for production
npm run typecheck   # Run TypeScript checks
npm test            # Run test suite
npm run test:watch  # Run tests in watch mode
```

### Testing

```bash
npm test                    # Run all tests
npm run test:unit          # Run unit tests only
npm run test:integration   # Run integration tests only
npm run test:coverage      # Run tests with coverage
```

### Key Components

- **Provider Services**: Abstract interfaces for Claude and Gemini integration
- **Session Manager**: Universal session handling with cross-provider sync
- **Ask Model MCP**: Cross-model consultation system with context preservation
- **Permission System**: 4-tier security model for safe AI operations
- **MCP Integration**: Model Context Protocol server management
- **Dashboard**: Settings and statistics interface

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests for new functionality
5. Ensure tests pass: `npm test`
6. Run type checking: `npm run typecheck`
7. Commit your changes: `git commit -m 'Add amazing feature'`
8. Push to the branch: `git push origin feature/amazing-feature`
9. Open a Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Write tests for new features
- Update documentation for API changes
- Use conventional commit messages
- Run all tests and type checks before submitting

## Troubleshooting

### Common Issues

**Package not found after global install**

```bash
npm config get prefix  # Check npm global directory
export PATH="$(npm config get prefix)/bin:$PATH"
```

**Claude authentication issues**

```bash
claude  # Re-authenticate with Claude CLI
# OR
export ANTHROPIC_API_KEY="your-key"  # Set API key directly
```

**Gemini authentication issues**

```bash
gemini  # Re-authenticate with Gemini CLI
# OR
export GEMINI_API_KEY="your-key"  # Set API key directly
```

For more detailed troubleshooting, see the [troubleshooting guide](./docs/troubleshooting.md).

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Contributor

**Sunho Kim**  
Software Engineer Intern at Wondermove

## Support

- **Documentation**: [Full documentation](./docs/README.md)
- **Issues**: [GitHub Issues](https://github.com/nexus-cli/nexus-cli/issues)
- **Discussions**: [GitHub Discussions](https://github.com/nexus-cli/nexus-cli/discussions)

## Changelog

### v0.0.1 (Beta POC)

- Initial proof-of-concept release
- Core provider switching functionality (Claude ↔ Gemini)
- Basic session management
- MCP integration foundation
- Dashboard interface prototype

See [CHANGELOG.md](CHANGELOG.md) for detailed release history.
