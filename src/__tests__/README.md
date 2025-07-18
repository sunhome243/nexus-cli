# Test Organization

This directory contains all tests organized by type and scope for better management.

## Structure

```
src/__tests__/
├── unit/                   # Unit tests
│   ├── components/         # Component tests
│   ├── configs/           # Configuration tests
│   └── services/          # Service tests
│       ├── core/          # Core service tests
│       ├── providers/     # Provider tests
│       ├── session/       # Session management tests
│       └── sync/          # Synchronization tests
├── integration/           # Integration tests
│   ├── services/          # Service integration tests
│   └── ...
├── e2e/                   # End-to-end tests
├── mocks/                 # Test mocks and fixtures
├── suites/                # Test suite definitions
├── utils/                 # Test utilities
└── setup.ts              # Test setup configuration
```

## Benefits

1. **Centralized Management**: All tests are in one place
2. **Clear Organization**: Tests are grouped by type (unit/integration/e2e)
3. **Easy Navigation**: Logical folder structure mirrors source code
4. **Isolated Test Suites**: Prevents state pollution between tests
5. **Reusable Components**: Shared mocks, utilities, and suites

## Running Tests

```bash
# Run all tests
npm test

# Run specific test types
npm test src/__tests__/unit/
npm test src/__tests__/integration/
npm test src/__tests__/e2e/

# Run specific test files
npm test src/__tests__/unit/services/session/SessionManager.unit.test.ts
```

## Test Isolation

Tests use the centralized test suite system in `suites/` to ensure proper isolation and prevent state pollution between test runs.