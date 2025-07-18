# Known Issues & Roadmap

![Beta](https://img.shields.io/badge/status-beta-orange.svg)
![POC](https://img.shields.io/badge/stage-POC-blue.svg)

## Known Issues

### Error Handling

- [ ] Only tested in Unix Shell. Need testing in other platforms
- [ ] Provider authentication failures not gracefully handled
- [ ] Network timeout errors during provider switching
- [ ] Corrupted session file recovery incomplete
- [ ] MCP server connection failures cause app crashes
- [ ] Invalid JSON responses not properly caught
- [ ] File permission errors on session creation
- [ ] Concurrent session access conflicts

### Session Management

- [ ] Session sync can fail silently between providers
- [ ] Orphaned session files accumulate over time
- [ ] Memory leaks in long-running sessions
- [ ] Cross-platform file path compatibility issues

### User Interface

- [ ] Gemini usage is not updated
- [ ] Error messages not user-friendly
- [ ] Terminal resize handling incomplete
- [ ] No progress indicators for long operations
- [ ] Permission request UI shows up even when it's auto approved
- [ ] Gemini's permission request UI arugment doesn't show up properly
- [ ] Streaming does not stop when esc key is pressed (needs to be implemented)

### Provider Integration

- [ ] Claude API rate limit handling insufficient
- [ ] Gemini response streaming occasionally drops
- [ ] Provider model switching doesn't preserve context

## Roadmap

### v0.1.0 - Stability & Error Handling

- [ ] Comprehensive error handling for all edge cases
- [ ] Graceful degradation when providers are unavailable
- [ ] Better session corruption recovery
- [ ] Improved logging and debugging capabilities
- [ ] Connection retry logic with exponential backoff

### v0.2.0 - Code Quality & Testing

- [ ] Complete unit test coverage (>90%)
- [ ] Integration tests for provider switching
- [ ] End-to-end test automation
- [ ] Code complexity reduction in sync engine
- [ ] Simplify session management architecture
- [ ] Refactor overly complex service dependencies

### v0.3.0 - Performance & UX

- [ ] Optimize memory usage for large conversations
- [ ] Implement proper loading states and progress bars
- [ ] Add configuration validation
- [ ] Improve startup time
- [ ] Better keyboard navigation

### v0.4.0 - Features & Extensibility

- [ ] Plugin architecture for custom providers
- [ ] Advanced MCP server management
- [ ] Conversation export/import functionality
- [ ] Custom themes and styling
- [ ] Multi-workspace support

### v1.0.0 - Production Ready

- [ ] Security audit and hardening
- [ ] Performance benchmarking
- [ ] Documentation completeness
- [ ] Windows/macOS/Linux compatibility testing
- [ ] Production deployment guides

## Contributing

Priority areas for contributors:

1. **Error Handling**: Implement proper error boundaries and recovery
2. **Testing**: Add missing test coverage for critical paths
3. **Code Simplification**: Refactor complex modules for maintainability
4. **Documentation**: Improve setup and troubleshooting guides

See [CONTRIBUTING.md](./developers/contributing.md) for development setup and guidelines.
