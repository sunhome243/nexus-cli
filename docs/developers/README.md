# Developer Documentation

Welcome to the Nexus CLI developer documentation. This guide covers everything you need to contribute to the project.

## 🚀 Quick Start for Developers

### Prerequisites

- **Node.js 20.0.0+** with npm
- **TypeScript 5.8+** experience
- **Git** for version control
- **Claude CLI** (for testing Claude integration)
- **Google API key** (for testing Gemini integration)

### Development Setup

```bash
git clone https://github.com/your-repo/nexus-cli.git
cd nexus-cli
npm install
npm run dev  # Start development mode
```

## 📚 Documentation Structure

### Essential Developer Guides

- **[Development Setup](./setup.md)** - Complete environment setup and tooling
- **[Contributing Guidelines](./contributing.md)** - Code standards, workflow, and submission process
- **[Core Features](./core-features.md)** - Core system logic and architecture patterns

## 🏗️ System Overview

Nexus CLI is a unified AI assistant interface that provides seamless switching between Claude and Gemini providers with shared conversation context.

### Key Features

- **Provider Switching**: Seamless `Ctrl+S` switching between Claude and Gemini
- **Session Management**: Universal conversation history with cross-provider sync
- **Permission System**: 4-tier security model with Auto Opus integration
- **MCP Integration**: Model Context Protocol for enhanced tool capabilities
- **Command System**: Slash commands for settings and provider management

### Technology Stack

- **Runtime**: Node.js 20+ with TypeScript 5.8+
- **UI**: React 19+ with Ink 6.0+ for terminal interface
- **Architecture**: Dependency injection with Inversify.js
- **Testing**: Vitest with React Testing Library

## 🔧 Development Workflow

### Essential Commands

```bash
npm run dev              # Development mode with hot reload
npm run build            # Production build
npm run typecheck        # TypeScript validation
npm run test             # Run test suite
```

### Code Standards

- **TypeScript**: Strict mode with full type coverage
- **React**: Functional components with hooks
- **Architecture**: SOLID principles with dependency injection
- **Testing**: Comprehensive test coverage for core features

## 🚦 Getting Started with Development

### Basic Contribution Workflow

1. **Fork** the repository and create a feature branch
2. **Install** dependencies: `npm install`
3. **Start** development: `npm run dev`
4. **Run** tests: `npm test` and `npm run typecheck`
5. **Submit** pull request with clear description

### Key Guidelines

- Follow existing code patterns and architecture
- Write tests for new functionality
- Use TypeScript strict mode throughout
- Implement proper error handling

## 🏭 Build & Testing

### Build Commands

```bash
npm run build           # Compile TypeScript to dist/
npm pack               # Create distribution package
```

### Testing

```bash
npm test                # Run full test suite
npm run test:watch      # Watch mode for development
npm run typecheck       # TypeScript validation
```

## 🔍 Understanding the System

For detailed information about how Nexus CLI works internally, see:

- **[Core Features](./core-features.md)** - Essential system logic and patterns
- **[Development Setup](./setup.md)** - Environment configuration and tools
- **[Contributing Guidelines](./contributing.md)** - Detailed contribution workflow

## 🤝 Getting Help

### Resources

- **[Core Features Documentation](./core-features.md)** - Deep dive into system architecture
- **GitHub Issues** - Report bugs and request features
- **Code Examples** - Check existing tests for usage patterns

---

This focused developer documentation provides the essential information needed to contribute effectively to Nexus CLI. For detailed implementation information, see the [Core Features](./core-features.md) documentation.
