# Development Setup Guide

This guide provides step-by-step instructions for setting up a complete development environment for Nexus CLI.

## 🔧 Prerequisites

### Required Tools

**Node.js 20.0.0+**

```bash
# Check current version
node --version

# Install via Node Version Manager (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

**Git**

```bash
# Verify installation
git --version

# Configure for development
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

**TypeScript & TSX**

```bash
# Global installation for development tools
npm install -g typescript tsx

# Verify installations
tsc --version
tsx --version
```

### AI Provider Prerequisites

**Claude CLI**

```bash
# Install Claude CLI (required for Claude provider testing)
# Follow instructions at: https://docs.anthropic.com/en/docs/claude-code

# Verify installation
claude --version

# Authenticate (required for testing)
claude auth login
```

**Gemini API Access**

```bash
# Get API key from: https://aistudio.google.com/
# Set environment variable for development
export GEMINI_API_KEY="your_api_key_here"

# Add to your shell profile for persistence
echo 'export GEMINI_API_KEY="your_api_key_here"' >> ~/.bashrc
```

## 📦 Project Setup

### 1. Repository Clone and Setup

```bash
# Clone the repository
git clone https://github.com/your-repo/nexus-cli.git
cd nexus-cli

# Install dependencies
npm install

# Verify setup
npm run typecheck
npm test
```

### 2. Environment Configuration

1. **Set up Claude authentication** (choose one):

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

2. **Set up Gemini authentication** (choose one):

   Option A: Use Gemini CLI authentication:

   ```bash
   npm install -g @google/gemini-cli
   gemini
   ```

   Option B: Set API key environment variable:

   ```bash
   export GOOGLE_API_KEY="your-api-key-here"
   ```

**Update `.gitignore` (if needed):**

```gitignore
# Environment files
.env*
!.env.example

# Development artifacts
.vscode/settings.json
.idea/
*.log
coverage/
dist/

# OS files
.DS_Store
Thumbs.db
...
```

### 3. Development Scripts Overview

```bash
# Development
npm run dev              # Start development mode with tsx
npm run build            # Production TypeScript build
npm run typecheck        # TypeScript validation without emit

# Testing
npm test                 # Run all tests
npm run test:watch       # Test watch mode for development
npm run test:coverage    # Generate coverage report
npm run test:ui          # Visual test interface
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e         # End-to-end tests only

# Testing Variants
npm run test:smoke       # Quick smoke tests
npm run test:performance # Performance benchmarks
npm run test:security    # Security validation tests
npm run test:debug       # Debug mode with inspector
```

## 🏗️ Development Environment

### 1. IDE Configuration

**VS Code Setup (.vscode/settings.json):**

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.codeActionsOnSave": {
    "source.organizeImports": true,
    "source.fixAll.eslint": true
  },
  "typescript.suggest.autoImports": true,
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.git": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/coverage": true
  }
}
```

**Recommended VS Code Extensions:**

- TypeScript Importer
- Path Intellisense
- ES7+ React/Redux/React-Native snippets
- Error Lens
- Thunder Client (for API testing)

### 2. TypeScript Configuration

The project uses strict TypeScript configuration in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.test.tsx"]
}
```

### 3. Testing Configuration

**Vitest Setup (vitest.config.ts):**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      threshold: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
});
```

## 🚀 Development Workflow

### 1. Starting Development

```bash
# Start development mode (recommended)
npm run dev

# This will:
# - Start tsx in watch mode
# - Enable hot reloading
# - Show TypeScript errors in real-time
# - Launch the CLI for testing
```

### 2. Making Changes

**Code Organization:**

```
src/
├── cli.tsx                    # Entry point - modify for CLI behavior
├── components/               # React Ink components
│   ├── core/App.tsx         # Main application component
│   └── ui/                  # Reusable UI components
├── hooks/                   # React hooks
├── infrastructure/di/       # Dependency injection setup
├── interfaces/             # TypeScript interfaces
├── services/              # Business logic
└── __tests__/            # Test files
```

**Development Best Practices:**

- Use TypeScript strict mode
- Write tests for new functionality
- Follow existing patterns and architecture
- Use dependency injection for services
- Implement interfaces for loose coupling

### 3. Testing During Development

```bash
# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- src/components/App.test.tsx

# Run tests matching pattern
npm test -- --grep "provider switching"

# Debug failing tests
npm run test:debug

# Check coverage for specific file
npm run test:coverage -- src/services/providers/
```

## 🔍 Debugging Setup

### 1. Debug Configuration

**VS Code Debug Configuration (.vscode/launch.json):**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Nexus CLI",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/cli.tsx",
      "runtimeExecutable": "tsx",
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "nexus:*"
      },
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["--run", "--inspect-brk"],
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

### 2. Logging and Debugging

**Enable Debug Logging:**

```bash
# Enable all debug logs
DEBUG=nexus:* npm run dev

# Enable specific module logs
DEBUG=nexus:providers npm run dev

# Enable verbose logging
DEBUG=nexus:*,verbose npm run dev
```

**Add Debug Points in Code:**

```typescript
import { createDebugLogger } from "./infrastructure/logger";

const debug = createDebugLogger("providers:claude");

export class ClaudeProvider {
  async sendMessage(message: string) {
    debug("Sending message to Claude: %s", message);
    // ... implementation
  }
}
```

## 🧪 Testing Setup

### 1. Test Structure

```
src/__tests__/
├── setup.ts              # Test configuration and global setup
├── unit/                 # Unit tests
│   ├── components/       # Component unit tests
│   ├── services/         # Service unit tests
│   └── hooks/           # Hook unit tests
├── integration/         # Integration tests
│   ├── providers/       # Provider integration tests
│   └── session/        # Session management tests
├── e2e/                # End-to-end tests
├── performance/        # Performance benchmarks
└── security/          # Security validation tests
```

### 2. Test Utilities

**Custom Test Utilities (src/**tests**/utils.tsx):**

```typescript
import { render } from "@testing-library/react";
import { ReactElement } from "react";

// Mock providers for testing
export const mockProviders = {
  claude: {
    initialize: vi.fn(),
    sendMessage: vi.fn(),
    streamResponse: vi.fn(),
  },
  gemini: {
    initialize: vi.fn(),
    sendMessage: vi.fn(),
    streamResponse: vi.fn(),
  },
};

// Custom render with providers
export function renderWithProviders(ui: ReactElement) {
  return render(<TestProviderWrapper>{ui}</TestProviderWrapper>);
}
```

### 3. Mock Configuration

**Provider Mocking:**

```typescript
// Mock Claude CLI subprocess
vi.mock("child_process", () => ({
  spawn: vi.fn(() => ({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
  })),
}));

// Mock Gemini API
vi.mock("@google/gemini-cli-core", () => ({
  GeminiClient: vi.fn(() => ({
    generateContent: vi.fn(),
    streamContent: vi.fn(),
  })),
}));
```

## 🔧 Advanced Development

### 1. Custom Development Scripts

**Create development helpers (scripts/dev-helpers.js):**

```javascript
#!/usr/bin/env node

// Helper script for development tasks
const { spawn } = require("child_process");

const commands = {
  "test:provider": () => {
    // Run provider-specific tests
    spawn("npm", ["test", "--", "providers/"], { stdio: "inherit" });
  },

  "build:watch": () => {
    // Watch build for continuous compilation
    spawn("tsc", ["--watch"], { stdio: "inherit" });
  },
};

const command = process.argv[2];
if (commands[command]) {
  commands[command]();
} else {
  console.log("Available commands:", Object.keys(commands).join(", "));
}
```

### 2. Development Environment Variables

**Complete .env.development template:**

```bash
# Required: AI Provider APIs
GEMINI_API_KEY=your_gemini_api_key_here

# Development Configuration
NODE_ENV=development
DEBUG=nexus:*
LOG_LEVEL=debug

# Provider Configuration
CLAUDE_CLI_PATH=/usr/local/bin/claude
CLAUDE_PROJECT_ROOT=~/.claude/projects
GEMINI_MODEL=gemini-2.5-pro

# Testing Configuration
TEST_TIMEOUT=30000
MOCK_PROVIDERS=false
ENABLE_PERFORMANCE_TESTS=true

# Optional: Development Features
ENABLE_DEV_DASHBOARD=true
DEV_SERVER_PORT=3000
HOT_RELOAD=true
```

### 3. Performance Profiling

**Memory Profiling:**

```bash
# Generate heap snapshot
node --inspect --heap-prof dist/cli.js

# Monitor memory usage
node --trace-warnings --inspect dist/cli.js

# Profile startup performance
node --prof dist/cli.js
```

## 🚦 Quality Assurance

### 1. Pre-commit Hooks

**Setup Git hooks:**

```bash
# Install husky for git hooks
npm install --save-dev husky

# Setup pre-commit hook
npx husky add .husky/pre-commit "npm run typecheck && npm test"

# Setup pre-push hook
npx husky add .husky/pre-push "npm run test:integration"
```

### 2. Code Quality Tools

**ESLint Configuration (.eslintrc.js):**

```javascript
module.exports = {
  extends: ["@typescript-eslint/recommended", "plugin:react/recommended", "plugin:react-hooks/recommended"],
  rules: {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "react/react-in-jsx-scope": "off",
  },
};
```

### 3. Continuous Integration

**GitHub Actions Workflow (.github/workflows/ci.yml):**

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "20"
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run test:coverage
```

## 🛠️ Troubleshooting Development Issues

### Common Development Problems

**TypeScript Errors:**

```bash
# Clear TypeScript cache
rm -rf node_modules/.cache/
npm run typecheck

# Check for version mismatches
npm ls typescript
```

**Test Failures:**

```bash
# Clear test cache
rm -rf node_modules/.vitest/
npm test

# Run tests with verbose output
npm test -- --reporter=verbose
```

**Dependency Issues:**

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Audit and fix vulnerabilities
npm audit fix
```

**Provider Integration Issues:**

```bash
# Test Claude CLI independently
claude --version
claude auth status

# Test Gemini API directly
curl -H "Authorization: Bearer $GEMINI_API_KEY" \
  https://generativelanguage.googleapis.com/v1/models
```

This comprehensive development setup guide should get you started with effective Nexus CLI development. The environment is designed for productive development with hot reloading, comprehensive testing, and robust debugging capabilities.
