# Architecture Overview

Nexus CLI is designed with a clean, modular architecture that emphasizes dependency injection, interface-driven design, and provider abstraction.

## Core Architecture Principles

### Dependency Injection Container

The application uses Inversify for DI with modular container composition:

- `src/infrastructure/di/core-container.ts` - Core services (Logger, MCP, Storage)
- `src/infrastructure/di/provider-container.ts` - AI provider services
- `src/infrastructure/di/sync-container.ts` - Synchronization services
- `src/infrastructure/di/command-container.ts` - Command services
- `src/infrastructure/di/composition.ts` - Container composition root

All services use Symbol-based identifiers defined in `src/infrastructure/di/types.ts`.

### Provider System

The application abstracts AI providers (Claude/Gemini) through interfaces:

- `IProvider` - Core provider contract in `src/interfaces/providers/`
- Providers are registered via `src/configs/providers.config.ts`
- Each provider is decomposed into focused services (Session, Process, Streaming)

### Application Flow

1. `src/cli.tsx` - Entry point, creates DI container, renders React app
2. `src/components/core/App.tsx` - Main orchestrator component
3. Providers handle messages through streaming callbacks
4. Session management enables cross-provider switching

## Key Services

### SessionManager

Coordinates provider sessions and lifecycle:

- Universal session ID generation
- Cross-provider conversation synchronization
- Session persistence and recovery

### ProviderManager

Manages available providers:

- Provider initialization and health checking
- Provider switching coordination
- Capability detection and routing

### AppEventBusService

Central event handling:

- Provider switch notifications
- Model change events
- Permission mode updates

### SlashCommandService

Command orchestration:

- Built-in command execution
- Custom command loading from `.claude/commands/`
- Command parsing and argument handling

### MCPManager

Model Context Protocol integration:

- MCP server lifecycle management
- Tool execution coordination
- Permission system integration

## Technology Stack

- **Runtime**: Node.js 20+ with TypeScript 5.8+
- **UI**: React 19+ with Ink 6.0+ for terminal interface
- **Architecture**: Dependency injection with Inversify.js
- **Testing**: Vitest with React Testing Library

## Data Flow

1. **User Input** → Input component captures text and keyboard events
2. **Command Parsing** → SlashCommandService identifies commands vs. messages
3. **Provider Routing** → Current provider processes the request
4. **Tool Execution** → MCP integration handles tool calls with permissions
5. **Response Streaming** → Real-time response display with provider-specific theming
6. **Session Sync** → Cross-provider synchronization maintains conversation continuity

### Session Isolation

- Process-based session isolation
- Secure file handling
- API key management through environment variables

This architecture enables the unified AI assistant experience while maintaining clean separation of concerns and extensibility for future providers and features.
