/**
 * Test Infrastructure Index
 * Central entry point for test utilities and mocks
 */

// Export test utilities
export * from './utils/TestIsolation';
export * from './utils/render';
export * from './utils/test-container';

// Export mocks
export * from './mocks/MockDiffEngine';
export * from './mocks/MockLogger';
export * from './mocks/MockProviderManager';
export * from './mocks/MockProviderSwitchService';
export * from './mocks/MockProviderSyncHandler';
export * from './mocks/MockSessionManager';
export * from './mocks/MockSyncEngine';
export * from './mocks/MockSyncLockService';
export * from './mocks/MockSyncStateService';
export * from './mocks/handlers';
export * from './mocks/server';

// Export setup
export * from './setup';