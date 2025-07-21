# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2025-07-21

### Fixed

- Fixed missing runtime dependency: Moved `strip-json-comments` from devDependencies to dependencies
- Fixed CLI argument support: Added `--version`/`-v` and `--help`/`-h` command line flags
- Fixed package dependency organization: Moved `@types/mime-types` to devDependencies where it belongs

### Added

- Command line argument parsing for version and help information
- Proper exit handling for CLI flags

## [0.1.0] - 2025-07-18

### Added

- Initial release of Nexus CLI
- Seamless provider switching between Claude and Gemini
- Universal session management with cross-provider synchronization
- Auto Opus integration for complex planning tasks
- Ask Model MCP integration for cross-model consultation
- MCP Wizard for unified server management
- Dashboard interface for settings and usage statistics
- Myers diff algorithm for context synchronization
- Clean architecture with dependency injection (Inversify)
- TypeScript support with strict type checking
- React/Ink-based terminal UI components
