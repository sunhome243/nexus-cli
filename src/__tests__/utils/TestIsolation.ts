/**
 * Test Isolation Utilities
 * Provides centralized test management and isolation mechanisms
 */

import { beforeEach, afterEach, vi } from 'vitest';

export interface TestSuiteConfig {
  name: string;
  beforeEach?: () => void | Promise<void>;
  afterEach?: () => void | Promise<void>;
  beforeAll?: () => void | Promise<void>;
  afterAll?: () => void | Promise<void>;
}

/**
 * Creates an isolated test suite with proper cleanup
 */
export function createIsolatedTestSuite(config: TestSuiteConfig) {
  // Store original implementations to restore later
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  
  return {
    setup: () => {
      beforeEach(async () => {
        // Clear all mocks and timers
        vi.clearAllMocks();
        vi.clearAllTimers();
        
        // Reset module registry to prevent state pollution
        vi.resetModules();
        
        // Suppress console outputs during tests to reduce noise
        console.log = vi.fn();
        console.warn = vi.fn();
        console.error = vi.fn();
        
        // Run custom beforeEach if provided
        if (config.beforeEach) {
          await config.beforeEach();
        }
      });

      afterEach(async () => {
        // Run custom afterEach if provided
        if (config.afterEach) {
          await config.afterEach();
        }
        
        // Restore console functions
        console.log = originalConsoleLog;
        console.warn = originalConsoleWarn;
        console.error = originalConsoleError;
        
        // Clear all mocks and timers again
        vi.clearAllMocks();
        vi.clearAllTimers();
        vi.restoreAllMocks();
      });
    },
    
    cleanup: () => {
      // Additional cleanup if needed
      vi.resetModules();
      vi.clearAllMocks();
      vi.restoreAllMocks();
    }
  };
}

/**
 * Mock factory for creating fresh, isolated mocks
 */
export class MockFactory {
  private static instance: MockFactory;
  private mocks: Map<string, any> = new Map();

  static getInstance(): MockFactory {
    if (!MockFactory.instance) {
      MockFactory.instance = new MockFactory();
    }
    return MockFactory.instance;
  }

  createFreshMock<T>(name: string, mockImplementation: () => T): T {
    // Always create a fresh mock, don't reuse
    const mock = mockImplementation();
    this.mocks.set(`${name}-${Date.now()}-${Math.random()}`, mock);
    return mock;
  }

  clearAllMocks(): void {
    this.mocks.clear();
  }
}

/**
 * Logger mock factory with isolated state
 */
export function createIsolatedLoggerMock() {
  const logs: Array<{ level: string; message: string; data?: any }> = [];
  let currentLevel = 'info';
  
  return {
    info: vi.fn((message: string, data?: any) => {
      logs.push({ level: 'info', message, data });
    }),
    warn: vi.fn((message: string, data?: any) => {
      logs.push({ level: 'warn', message, data });
    }),
    error: vi.fn((message: string, data?: any) => {
      logs.push({ level: 'error', message, data });
    }),
    debug: vi.fn((message: string, data?: any) => {
      logs.push({ level: 'debug', message, data });
    }),
    setLevel: vi.fn((level: string) => {
      currentLevel = level;
    }),
    getLevel: vi.fn(() => currentLevel),
    getLogs: () => [...logs], // Return copy to prevent mutation
    clearLogs: () => logs.splice(0, logs.length)
  };
}

/**
 * Provider registry mock factory with isolated state
 */
export function createIsolatedProviderRegistryMock() {
  const availableTypes = ['claude', 'gemini'];
  
  return {
    getProvider: vi.fn(),
    getAvailableTypes: vi.fn(() => availableTypes),
    hasProvider: vi.fn((type: string) => {
      // Always return true for valid types, never throw
      return availableTypes.includes(type);
    }),
    createProviderInstance: vi.fn((type: string) => {
      // Return appropriate mock based on provider type
      if (type === 'claude' || type === 'claude') {
        return {
          createSession: vi.fn().mockResolvedValue(undefined),
          setSessionTag: vi.fn(),
          getCurrentSessionId: vi.fn().mockReturnValue('mock-claude-session-id'),
          getCurrentMemoryFile: vi.fn().mockReturnValue('mock-claude-memory.json')
        };
      } else if (type === 'gemini') {
        return {
          createSession: vi.fn().mockResolvedValue(undefined),
          getCheckpointPath: vi.fn((tag: string) => `mock-checkpoint-${tag}.json`)
        };
      }
      // Return basic mock for unknown types
      return {
        createSession: vi.fn().mockResolvedValue(undefined)
      };
    }),
    registerProvider: vi.fn()
  };
}

/**
 * Provider manager mock factory with isolated state
 */
export function createIsolatedProviderManagerMock() {
  const mockProvider = {
    sendMessage: vi.fn().mockResolvedValue({ content: 'Mock response to: Test message' })
  };
  
  const mockStreamingProvider = {
    streamMessage: vi.fn().mockImplementation(async (message: string, callbacks: any) => {
      // Simulate streaming
      callbacks.onChunk('Mock ');
      callbacks.onChunk('streaming ');
      callbacks.onChunk('response');
      callbacks.onComplete({ content: 'Mock streaming response' });
    })
  };
  
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    getProvider: vi.fn().mockImplementation((type: string) => {
      if (type === 'claude' || type === 'gemini') {
        return mockProvider;
      }
      return null;
    }),
    getStreamingProvider: vi.fn().mockImplementation((type: string) => {
      if (type === 'claude' || type === 'gemini') {
        return mockStreamingProvider;
      }
      return null;
    }),
    supportsStreaming: vi.fn().mockReturnValue(true),
    getAvailableProviders: vi.fn().mockReturnValue(['claude', 'gemini']),
    isProviderAvailable: vi.fn().mockReturnValue(true),
    setSessionTag: vi.fn(),
    cleanup: vi.fn().mockResolvedValue(undefined),
    hasProvider: vi.fn().mockReturnValue(true)
  };
}

/**
 * Provider switch service mock factory with isolated state
 */
export function createIsolatedProviderSwitchServiceMock() {
  let currentProvider = 'claude';
  
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    getCurrentProvider: vi.fn(() => currentProvider),
    switchProvider: vi.fn().mockImplementation(async (from: string, to: string) => {
      if (!['claude', 'gemini'].includes(to)) {
        throw new Error(`Invalid provider: ${to}`);
      }
      currentProvider = to;
    })
  };
}

/**
 * Sync engine mock factory with isolated state
 */
export function createIsolatedSyncEngineMock() {
  return {
    instantSync: vi.fn().mockResolvedValue(undefined)
  };
}