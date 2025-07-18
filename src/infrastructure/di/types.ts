/**
 * Dependency Injection Types
 * Contains all service identifier symbols for dependency injection
 */

export const TYPES = {
  // Core Providers
  ClaudeProvider: Symbol.for("ClaudeProvider"),
  GeminiProvider: Symbol.for("GeminiProvider"),

  // Gemini Services
  GeminiQuotaService: Symbol.for("GeminiQuotaService"),
  GeminiSessionService: Symbol.for("GeminiSessionService"),
  GeminiModelService: Symbol.for("GeminiModelService"),
  GeminiStreamingService: Symbol.for("GeminiStreamingService"),
  GeminiToolExecutionService: Symbol.for("GeminiToolExecutionService"),
  GeminiConfigurationService: Symbol.for("GeminiConfigurationService"),
  GeminiCallbackAdapterService: Symbol.for("GeminiCallbackAdapterService"),
  GeminiBackupService: Symbol.for("GeminiBackupService"),
  GeminiSessionManagementService: Symbol.for("GeminiSessionManagementService"),
  // Claude Services
  ClaudeSessionService: Symbol.for("ClaudeSessionService"),
  ClaudeProcessService: Symbol.for("ClaudeProcessService"),
  ClaudePermissionService: Symbol.for("ClaudePermissionService"),
  ClaudeStreamingService: Symbol.for("ClaudeStreamingService"),
  PermissionResponseService: Symbol.for("PermissionResponseService"),

  // Shared Provider Services
  ErrorHandlerService: Symbol.for("ErrorHandlerService"),

  // Permission Services
  ClaudePermissionOrchestrator: Symbol.for("ClaudePermissionOrchestrator"),
  GeminiPermissionOrchestrator: Symbol.for("GeminiPermissionOrchestrator"),
  ProviderPermissionCoordinator: Symbol.for("ProviderPermissionCoordinator"),

  // Session Management
  SessionManager: Symbol.for("SessionManager"),
  ProviderManager: Symbol.for("ProviderManager"),
  ProviderSwitchService: Symbol.for("ProviderSwitchService"),

  // Core Services
  LoggerService: Symbol.for("LoggerService"),
  MCPService: Symbol.for("MCPService"),

  // Handlers
  StreamingHandler: Symbol.for("StreamingHandler"),
  PermissionHandler: Symbol.for("PermissionHandler"),

  // Controllers
  ApplicationController: Symbol.for("ApplicationController"),

  // Factories
  ProviderFactory: Symbol.for("ProviderFactory"),

  // Provider Registry
  ProviderRegistry: Symbol.for("ProviderRegistry"),

  // Provider Abstractions
  ModelConfigManager: Symbol.for("ModelConfigManager"),
  StrategyRegistry: Symbol.for("StrategyRegistry"),

  // Animation Management
  GlobalAnimationManager: Symbol.for("GlobalAnimationManager"),

  // Sync Services
  SyncEngine: Symbol.for("SyncEngine"),
  SyncLockService: Symbol.for("SyncLockService"),
  DiffEngine: Symbol.for("DiffEngine"),
  SyncStateService: Symbol.for("SyncStateService"),
  SessionRegistryManager: Symbol.for("SessionRegistryManager"),
  GeminiSyncHandler: Symbol.for("GeminiSyncHandler"),
  ClaudeSyncHandler: Symbol.for("ClaudeSyncHandler"),
  ClaudeFileHandler: Symbol.for("ClaudeFileHandler"),
  GeminiFileHandler: Symbol.for("GeminiFileHandler"),

  // State Managers
  MessageStateManager: Symbol.for("MessageStateManager"),
  ToolStateManager: Symbol.for("ToolStateManager"),
  ThinkingStateManager: Symbol.for("ThinkingStateManager"),
  AppStateManager: Symbol.for("AppStateManager"),

  // Message Pipeline
  SendMessageCommandHandler: Symbol.for("SendMessageCommandHandler"),
  StreamMessageCommandHandler: Symbol.for("StreamMessageCommandHandler"),
  MessageHistoryQueryHandler: Symbol.for("MessageHistoryQueryHandler"),
  MessageValidationQueryHandler: Symbol.for("MessageValidationQueryHandler"),
  ValidationRegistry: Symbol.for("ValidationRegistry"),
  MessagePipeline: Symbol.for("MessagePipeline"),

  // Tool Execution Pipeline
  ToolRegistry: Symbol.for("ToolRegistry"),
  LocalToolExecutionStrategy: Symbol.for("LocalToolExecutionStrategy"),
  RemoteToolExecutionStrategy: Symbol.for("RemoteToolExecutionStrategy"),
  CrossProviderToolExecutionStrategy: Symbol.for("CrossProviderToolExecutionStrategy"),
  ToolExecutionPipeline: Symbol.for("ToolExecutionPipeline"),
  ToolHandler: Symbol.for("ToolHandler"),

  // Slash Commands
  SlashCommandService: Symbol.for("SlashCommandService"),
  SlashCommandParserService: Symbol.for("SlashCommandParserService"),
  CommandRegistry: Symbol.for("CommandRegistry"),
  FileSystemCommandLoaderService: Symbol.for("FileSystemCommandLoaderService"),

  // Model Management
  ModelService: Symbol.for("ModelService"),

  // Storage Services
  LocalStorageService: Symbol.for("LocalStorageService"),

  // Usage Services
  ClaudeUsageTracker: Symbol.for("ClaudeUsageTracker"),
  GeminiUsageTracker: Symbol.for("GeminiUsageTracker"),
  UnifiedStatsService: Symbol.for("UnifiedStatsService"),
  UiTelemetryService: Symbol.for("UiTelemetryService"),
  UsageTrackerRegistry: Symbol.for("UsageTrackerRegistry"),

  // Event Services
  AppEventBusService: Symbol.for("AppEventBusService"),

  // Initialization Services
  AppInitializationService: Symbol.for("AppInitializationService"),

  // MCP Services
  MCPConfigurationService: Symbol.for("MCPConfigurationService"),
  MCPConfigPathResolverService: Symbol.for("MCPConfigPathResolverService"),
  MCPSocketManager: Symbol.for("MCPSocketManager"),
  MCPConfigLoaderService: Symbol.for("MCPConfigLoaderService"),
  MCPConfigSaverService: Symbol.for("MCPConfigSaverService"),
  MCPServerRemoverService: Symbol.for("MCPServerRemoverService"),
  MCPConfigValidatorService: Symbol.for("MCPConfigValidatorService"),
  AskModelSocketService: Symbol.for("AskModelSocketService"),
  ClaudeSettingsService: Symbol.for("ClaudeSettingsService"),
} as const;

export type ServiceType = (typeof TYPES)[keyof typeof TYPES];
