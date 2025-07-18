# Nexus CLI Documentation

This documentation provides a comprehensive guide to installing, using, and developing Nexus CLI. This tool provides a unified command-line interface for interacting with multiple AI providers (Claude and Gemini) with advanced session management and tool integration.

## Overview

Nexus CLI is a terminal-based AI assistant that integrates Claude and Gemini providers through a unified interface. The system features cross-provider session synchronization, internal multi provider communication MCP server, and extensive tool and memory integration.

## Navigating the documentation

This documentation is organized into the following sections:

- **[Installation](./installation.md):** Information for installing and setting up Nexus CLI.
- **[Architecture Overview](./architecture.md):** Understand the high-level design of Nexus CLI, including its components and how they interact.
- **CLI Usage:** Documentation for command-line interface operations.
  - **[CLI Introduction](./cli/index.md):** Overview of the command-line interface.
  - **[Commands](./cli/commands.md):** Description of available CLI commands.
  - **[Configuration](./cli/configuration.md):** Information on configuring the CLI.
  - **[Getting Started](./cli/getting-started.md):** Initial setup and basic usage patterns.
  - **[Features](./cli/features.md):** Complete feature reference and capabilities.
  - **[Usage](./cli/usage.md):** Basic operation and workflow patterns.
  - **[Provider Switching](./cli/provider-switching.md):** Multi-provider workflow management.
  - **[Keyboard Shortcuts](./cli/keyboard-shortcuts.md):** Interface navigation and shortcuts.
- **[Session Management](./cli/session-management.md):** Session persistence and cross-provider synchronization using Myers diff algorithm.
- **Tools:**
  - **[Tools Overview](./tools/index.md):** Overview of available tools and integrations.
  - **[Dashboard](./tools/dashboard.md):** Configuration and statistics interface.
- **Development:** Information for contributors and developers.
  - **[Development Guide](./developers/README.md):** Setup, building, testing, and coding conventions.
  - **[Core Features](./developers/core-features.md):** High-level architecture and system design.
  - **[Permission System](./developers/permission-system.md):** How permission requests work for providers.
  - **[Session Memory Sync](./developers/session-memory-sync.md):** Cross-provider session synchronization.
  - **[Cross-Provider MCP](./developers/cross-provider-mcp.md):** MCP tool integration across providers.
- **[Troubleshooting Guide](./troubleshooting.md):** Find solutions to common problems and error messages.
- **[KNOWN_ISSUES](./KNOWN_ISSUES.md)** Currently identified issues

We hope this documentation helps you make the most of Nexus CLI.
