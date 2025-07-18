import { Container } from "inversify";
import { TYPES } from "../../infrastructure/di/types.js";
import { MockLogger } from "../mocks/MockLogger";
import { MockSessionManager } from "../mocks/MockSessionManager";
import { MockProviderManager } from "../mocks/MockProviderManager";
import { MockProviderSwitchService } from "../mocks/MockProviderSwitchService";
import { MockSyncEngine } from "../mocks/MockSyncEngine";
import { MockSyncLockService } from "../mocks/MockSyncLockService";
import { MockDiffEngine } from "../mocks/MockDiffEngine";
import { MockSyncStateService } from "../mocks/MockSyncStateService";
import { MockProviderSyncHandler } from "../mocks/MockProviderSyncHandler";

export function createTestContainer(): Container {
  const testContainer = new Container();

  testContainer.bind(TYPES.LoggerService).to(MockLogger);
  testContainer.bind(TYPES.SessionManager).to(MockSessionManager);
  testContainer.bind(TYPES.ProviderManager).to(MockProviderManager);
  testContainer.bind(TYPES.ProviderSwitchService).to(MockProviderSwitchService);
  testContainer.bind(TYPES.SyncEngine).to(MockSyncEngine);
  testContainer.bind(TYPES.SyncLockService).to(MockSyncLockService);
  testContainer.bind(TYPES.DiffEngine).to(MockDiffEngine);
  testContainer.bind(TYPES.SyncStateService).to(MockSyncStateService);
  testContainer.bind(TYPES.GeminiSyncHandler).to(MockProviderSyncHandler);
  testContainer.bind(TYPES.ClaudeSyncHandler).to(MockProviderSyncHandler);

  return testContainer;
}