/**
 * Main Application Component
 * Provides unified AI CLI interface with cross-provider session management
 * Supports dynamic switching between Claude and Gemini providers
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { IGlobalAnimationManager } from "../../utils/GlobalAnimationManager.js";
import { Box, Text, useInput, useStdout } from "ink";
import { Input } from "../ui/interactive/Input.js";
import { Output } from "../ui/interactive/Output.js";
import { Header } from "../ui/display/Header.js";
import { StatusBar } from "../ui/display/StatusBar.js";
import { ProgressBar } from "../ui/display/ProgressBar.js";
import { ISessionManager } from "../../interfaces/core/ISessionManager.js";
import { AIProvider, AppState, RenderItem, Message, ToolExecution, ThinkingItem } from "./types.js";
import { ISlashCommandService, ISlashCommandListItem } from "../../interfaces/commands/index.js";
import { ISlashCommandParserService } from "../../interfaces/commands/ISlashCommandParserService.js";
import { IModelService } from "../../interfaces/core/IModelService.js";
import { ILoggerService } from "../../interfaces/core/ILoggerService.js";
import { DashboardOverlay } from "../overlays/DashboardOverlay.js";
import { useBracketedPaste } from "../../hooks/useBracketedPaste.js";
import { useTextBuffer } from "../../hooks/useTextBuffer.js";
import { useStdin } from "ink";
import { useGeminiStream } from "../../hooks/useGeminiStream.js";
import { useAppState } from "../../hooks/useAppState.js";
import { getProviderAdapter } from "../providers/factory/ProviderAdapterFactory.js";
import { useMessageHandler } from "../../hooks/useMessageHandler.js";
import { useTheme } from "../shared/ThemeProvider.js";
import { ProviderType, ModelName, IModelConfigManager } from "../../abstractions/providers/index.js";
import { IClaudeSettingsService } from "../../services/mcp/config/ClaudeSettingsService.js";
import { PermissionResponseService } from "../../services/providers/claude/services/PermissionResponseService.js";
import { ProviderPermissionCoordinator } from "../../services/permissions/ProviderPermissionCoordinator.js";

/**
 * Props interface for App component - receives services via dependency injection
 */
interface AppProps {
  sessionManager: ISessionManager;
  slashCommandService: ISlashCommandService;
  slashCommandParserService: ISlashCommandParserService;
  modelService: IModelService;
  modelConfigManager: IModelConfigManager;
  globalAnimationManager: IGlobalAnimationManager;
  logger: ILoggerService;
  claudeUsageTracker: any; // ClaudeUsageTracker type
  geminiUsageTracker: any; // GeminiUsageTracker type
  mcpService: any; // MCPService type
  appEventBusService: any; // IAppEventBusService type
  appInitializationService: any; // IAppInitializationService type
  providerSwitchService: any; // IProviderSwitchService type
  claudeSettingsService: IClaudeSettingsService;
  permissionResponseService: PermissionResponseService;
  providerPermissionCoordinator: ProviderPermissionCoordinator;
}

// Global EventEmitters removed - now using AppEventBusService

/**
 * Primary application component that orchestrates the CLI interface
 * Manages provider switching, session lifecycle, and message handling
 */
export function App({
  sessionManager: injectedSessionManager,
  slashCommandService: injectedSlashCommandService,
  slashCommandParserService: injectedSlashCommandParserService,
  modelService: injectedModelService,
  modelConfigManager,
  globalAnimationManager,
  logger,
  claudeUsageTracker,
  geminiUsageTracker,
  mcpService,
  appEventBusService,
  appInitializationService,
  providerSwitchService,
  claudeSettingsService,
  permissionResponseService,
  providerPermissionCoordinator,
}: AppProps) {
  // Enable bracketed paste mode for proper paste handling
  useBracketedPaste();

  // Use Gemini stream hook for enhanced Gemini functionality
  const geminiStream = useGeminiStream(injectedSessionManager as any);

  // Use centralized state management hook
  const { state, actions } = useAppState();

  // Use theme hook for consistent colors
  const { theme } = useTheme();

  // Get provider-specific UI components
  const providerAdapter = useMemo(() => getProviderAdapter(state.currentProvider as any), [state.currentProvider]);

  // Claude-specific state
  const [claudePermissionMode, setClaudePermissionMode] = useState<string>("default");

  // Slash command state
  const [slashCommandService, setSlashCommandService] = useState<ISlashCommandService | null>(null);
  const [availableCommands, setAvailableCommands] = useState<ISlashCommandListItem[]>([]);
  const [commandExecutionStatus, setCommandExecutionStatus] = useState<string | null>(null);

  // Dashboard and model service state
  const [showDashboard, setShowDashboard] = useState(false);
  const [modelService, setModelService] = useState<IModelService | null>(null);
  const [currentModel, setCurrentModel] = useState<ModelName>(modelConfigManager.getDefaultModel(ProviderType.CLAUDE));
  const [autoOpusEnabled, setAutoOpusEnabled] = useState(false);

  // Usage tracking
  const statsServiceRef = useRef<any>(null);

  const [initMessage, setInitMessage] = useState("Initializing Nexus...");
  const [initMicroProgress, setInitMicroProgress] = useState(0);

  // Initialize application services on component mount using AppInitializationService
  useEffect(() => {
    // Use AppInitializationService for centralized startup coordination
    appInitializationService.initialize({
      onProgressUpdate: (progress: any) => {
        setInitMessage(progress.message);
        setInitMicroProgress(progress.microProgress || 0);
        actions.setLoading(progress.isLoading);
        actions.setInitialized(progress.initialized, progress.error);

        // Service initialization completes
        if (progress.initialized && !progress.error) {
          // Set up local state
          setSlashCommandService(injectedSlashCommandService);
          if (injectedModelService) {
            const modelSvc = injectedModelService;
            setModelService(modelSvc);
            setCurrentModel(modelSvc.getCurrentModel() as ModelName);
            setAutoOpusEnabled(modelSvc.getAutoOpusEnabled());

            // Listen for model changes
            modelSvc.onModelChanged((model) => {
              logger.debug(`Model change callback received: ${model}`, { component: "App" });
              setCurrentModel(model as ModelName);
            });

            // Listen for auto Opus changes
            modelSvc.onAutoOpusChanged((enabled) => {
              logger.debug(`Auto Opus change callback received: ${enabled}`, { component: "App" });
              setAutoOpusEnabled(enabled);
            });
          }

          // Set up stats service
          if (
            injectedSlashCommandService &&
            typeof (injectedSlashCommandService as any).getStatsService === "function"
          ) {
            statsServiceRef.current = (injectedSlashCommandService as any).getStatsService();
          }
        }
      },
    });

    // Listen for permission mode change events (from exit_plan_mode approval)
    const handlePermissionModeChange = async (newMode: string) => {
      logger.info(`Permission mode change event received: ${newMode}`, { component: "App" });
      setClaudePermissionMode(newMode);

      // Update permission mode through unified coordinator
      try {
        providerPermissionCoordinator.setPermissionMode(newMode);
        logger.info(`Permission mode updated to: ${newMode}`, { component: "App" });
      } catch (error) {
        logger.warn("Failed to update permission mode", { component: "App", error: error?.toString() });
      }

      // Handle Auto Opus feature - update permission mode tracking
      logger.debug(`Checking modelService availability: ${!!modelService}`, { component: "App" });
      try {
        // Use injected ModelService
        const modelSvc = injectedModelService;
        logger.debug(`Using modelService: ${!!modelSvc}`, { component: "App" });

        if (modelSvc) {
          const autoOpusEnabled = modelSvc.getAutoOpusEnabled();
          const currentModel = modelSvc.getCurrentModel();
          logger.debug(`Permission mode change: "${newMode}"`, { component: "App" });
          logger.debug(`Auto Opus enabled: ${autoOpusEnabled}, Current model: ${currentModel}`, { component: "App" });
          logger.debug(`About to call modelService.onPermissionModeChange("${newMode}")`, { component: "App" });

          // Update permission mode tracking and handle auto Opus logic
          await modelSvc.onPermissionModeChange(newMode);
          logger.debug(`modelService.onPermissionModeChange completed`, { component: "App" });
        } else {
          logger.warn("ModelService could not be obtained", { component: "App" });
        }
      } catch (error) {
        logger.error("Error handling permission mode change for ModelService", {
          component: "App",
          error: error?.toString(),
        });
      }
    };

    appEventBusService.onPermissionModeChange(handlePermissionModeChange);

    // Initialize permission coordinator
    const initializePermissionCoordinator = async () => {
      try {
        await providerPermissionCoordinator.initialize();
        providerPermissionCoordinator.setupProviderCallbacks();
        logger.info('Provider permission coordinator initialized', { component: 'App' });
      } catch (error) {
        logger.error('Failed to initialize permission coordinator', { component: 'App', error: error?.toString() });
      }
    };

    initializePermissionCoordinator();

    // Listen for permission request events
    const handlePermissionRequestEvent = (data: any) => {
      logger.info('Permission request event received', { component: 'App', toolName: data.toolName });
      
      // Get pending permission from coordinator
      const pendingPermission = providerPermissionCoordinator.getPendingPermission();
      if (pendingPermission) {
        actions.setPendingPermission({
          request: {
            toolName: pendingPermission.request.toolName || pendingPermission.request.name,
            description: pendingPermission.request.description,
            args: pendingPermission.request.args,
            tier: pendingPermission.request.tier,
            timestamp: pendingPermission.timestamp,
            toolUseId: pendingPermission.request.toolUseId,
            tool: pendingPermission.request.tool || pendingPermission.request.toolName
          },
          resolve: async (response: any) => {
            actions.setPendingPermission(null);
            await providerPermissionCoordinator.handlePermissionResponse(response);
          }
        });
      }
    };

    appEventBusService.onPermissionRequest(handlePermissionRequestEvent);

    // Cleanup function to properly dispose of resources
    return () => {
      appEventBusService.offPermissionModeChange(handlePermissionModeChange);
      appEventBusService.offPermissionRequest(handlePermissionRequestEvent);
      
      providerPermissionCoordinator.cleanup().catch((error: any) => {
        logger.error("Error during permission coordinator cleanup", { component: "App", error: error?.toString() });
      });
      
      appInitializationService.cleanup().catch((error: any) => {
        logger.error("Error during cleanup", { component: "App", error: error?.toString() });
      });

      // Clean up animations on app unmount
      // Note: All components should unsubscribe themselves, this is just cleanup
    };
  }, []);

  // Permission callback is now handled by the unified coordinator

  // Update model info for providers that support dynamic model info
  useEffect(() => {
    if (state.initialized && state.currentProvider === ProviderType.GEMINI) {
      const updateModelInfo = () => {
        try {
          const sessionManager = appInitializationService.getSessionManager();
          const provider = sessionManager?.getCurrentProviderInstance();

          // Check if provider is initialized before accessing methods
          if (
            provider &&
            "isProviderInitialized" in provider &&
            typeof provider.isProviderInitialized === "function" &&
            provider.isProviderInitialized()
          ) {
            if (typeof (provider as any).getCurrentModelInfo === "function") {
              const modelInfo = (provider as any).getCurrentModelInfo();
              if (modelInfo && typeof modelInfo === "object") {
                // Only update if changed
                if (
                  state.modelInfo?.model !== modelInfo.model ||
                  state.modelInfo?.isUsingFallback !== modelInfo.isUsingFallback ||
                  state.modelInfo?.hasQuotaError !== modelInfo.hasQuotaError
                ) {
                  logger.debug(`Updating Gemini model info`, { component: "App", modelInfo });
                  actions.setModelInfo(modelInfo);
                }
              } else {
                logger.debug(`Invalid model info from Gemini provider`, { component: "App", modelInfo });
              }
            } else {
              logger.debug(`Gemini provider missing getCurrentModelInfo method`, { component: "App" });
            }
          } else {
            logger.debug(`Gemini provider not yet initialized`, { component: "App" });
          }
        } catch (error) {
          logger.error("Error updating model info", { component: "App", error: error?.toString() });
        }
      };

      // Add a small delay to ensure provider is fully initialized
      const timeoutId = setTimeout(() => {
        updateModelInfo();
      }, 500);

      // Note: Model changes (quota errors, fallbacks) are rare and happen during message streaming.
      // The onFlashFallback callback in streamingOptions already handles UI updates for those cases.
      // If we need to detect other model changes, we should implement an event system instead of polling.

      return () => clearTimeout(timeoutId);
    }
  }, [state.currentProvider, state.initialized]);

  // Terminal size and input buffer (following gemini-cli's App.tsx pattern)
  const { stdin, setRawMode } = useStdin();
  const { stdout } = useStdout();

  // Calculate viewport dimensions for text buffer based on actual terminal size
  const terminalWidth = stdout?.columns || 80;
  const inputWidth = Math.max(60, Math.floor(terminalWidth * 0.85) - 10); // Account for borders, padding, and prompt

  // Text buffer for input handling (like gemini-cli App.tsx:368)
  const buffer = useTextBuffer({
    initialText: "",
    viewport: { height: 10, width: inputWidth },
    stdin,
    setRawMode,
    onChange: (text: string) => {
      // Handle text changes if needed
    },
    isValidPath: (path: string) => {
      // Simple path validation - check if it looks like a file path
      try {
        return path.length > 0 && !path.includes("\n") && !path.includes("\r");
      } catch {
        return false;
      }
    },
  });

  // Extract message handling logic into dedicated hook
  const { sendMessage } = useMessageHandler({
    state,
    actions,
    sessionManager: appInitializationService.getSessionManager(),
    slashCommandService: slashCommandService || injectedSlashCommandService,
    slashCommandParserService: injectedSlashCommandParserService,
    buffer,
    setCommandExecutionStatus,
    setShowDashboard,
    statsServiceRef,
    appEventBusService,
  });

  /**
   * Handle slash command list request
   */
  const handleSlashCommandListRequest = useCallback(async () => {
    if (slashCommandService) {
      try {
        const commands = await slashCommandService.getAvailableCommands();
        setAvailableCommands(commands);
      } catch (error) {
        logger.error("Failed to load slash commands", { component: "App", error: error?.toString() });
      }
    }
  }, [slashCommandService]);

  // Handle global keyboard shortcuts for provider switching, permission mode cycling, and application exit
  useInput((input, key) => {
    // Debug logging to verify key events are received
    if (key.ctrl || key.shift || key.meta) {
      logger.debug("Global key event received", {
        component: "App",
        input,
        ctrl: key.ctrl,
        shift: key.shift,
        meta: key.meta,
        name: (key as any).name,
        sequence: (key as any).sequence,
      });
    }

    if (key.ctrl && input === "s") {
      // Switch between Claude and Gemini providers using session manager
      const sessionManager = appInitializationService.getSessionManager();
      if (sessionManager) {
        const newProvider = state.currentProvider === ProviderType.CLAUDE ? ProviderType.GEMINI : ProviderType.CLAUDE;
        sessionManager
          .switchProvider(newProvider)
          .then(() => {
            // End session for old provider and start session for new provider
            if (statsServiceRef.current) {
              statsServiceRef.current.endSession(state.currentProvider);
              statsServiceRef.current.startSession(newProvider);
            }

            // Clear model info immediately when switching providers
            actions.setModelInfo(undefined);
            actions.setCurrentProvider(newProvider);

            // Update model info based on new provider
            if (newProvider === ProviderType.GEMINI) {
              // Add delay to ensure Gemini provider is fully initialized after switch
              setTimeout(() => {
                try {
                  const provider = sessionManager?.getCurrentProviderInstance();

                  // Check if provider is initialized before accessing methods
                  if (
                    provider &&
                    "isProviderInitialized" in provider &&
                    typeof provider.isProviderInitialized === "function" &&
                    provider.isProviderInitialized()
                  ) {
                    if (typeof (provider as any).getCurrentModelInfo === "function") {
                      const modelInfo = (provider as any).getCurrentModelInfo();
                      logger.debug(`Got Gemini model info after provider switch`, { component: "App", modelInfo });
                      if (modelInfo && typeof modelInfo === "object") {
                        actions.setModelInfo(modelInfo);
                        logger.debug(`Set model info for Gemini`, { component: "App", modelInfo });
                      } else {
                        logger.debug(`Invalid model info from Gemini provider`, { component: "App", modelInfo });
                      }
                    } else {
                      logger.debug(`Gemini provider missing getCurrentModelInfo method`, { component: "App" });
                    }
                  } else {
                    logger.debug(`Gemini provider not yet initialized after switch`, { component: "App" });
                  }
                } catch (error) {
                  logger.error("Error updating model info after provider switch", {
                    component: "App",
                    error: error?.toString(),
                  });
                }
              }, 500);
            }
            // Note: For Claude, modelInfo stays undefined (uses currentModel prop instead)
          })
          .catch((error: any) => {
            logger.error("Failed to switch provider", { component: "App", error: error?.toString() });
          });
      }
    }

    // Shift+Tab: Cycle permission modes for providers that support it
    const sessionManager = appInitializationService.getSessionManager();
    const provider = sessionManager?.getCurrentProviderInstance();

    if (key.shift && key.tab && provider?.capabilities.supportsPermissionModeCycling) {
      const modes = ["default", "acceptEdits", "plan", "bypassPermissions"];
      const currentIndex = modes.indexOf(claudePermissionMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      const nextMode = modes[nextIndex];

      logger.info(`Shift+Tab pressed: ${claudePermissionMode} -> ${nextMode}`, { component: "App" });
      setClaudePermissionMode(nextMode);

      // Update permission mode through unified coordinator
      try {
        providerPermissionCoordinator.setPermissionMode(nextMode);
        logger.info(`Permission mode changed to: ${nextMode}`, { component: "App" });
      } catch (error) {
        logger.warn("Failed to update permission mode", { component: "App", error: error?.toString() });
      }

      // Emit permission mode change event for ModelService
      logger.debug(`Emitting permissionModeChange event: ${nextMode}`, { component: "App" });
      appEventBusService.emitPermissionModeChange(nextMode);
    }

    if (key.ctrl && input === "c") {
      // Trigger graceful shutdown with final save
      logger.info("User requested exit (Ctrl+C)", { component: "App" });
      process.exit(0);
    }
  });

  // sendMessage function extracted to useMessageHandler hook

  /**
   * Handle permission response through unified coordinator
   */
  const handlePermissionResponse = useCallback(
    async (response: any) => {
      if (state.pendingPermission?.resolve) {
        try {
          // The resolve function now calls the unified coordinator
          await state.pendingPermission.resolve(response);
          logger.info("Permission response handled through unified coordinator", {
            component: "App",
            approved: response.approved,
            autoApprove: response.autoApprove
          });
        } catch (error) {
          logger.error("Failed to handle permission response through coordinator", {
            component: "App",
            error: error?.toString()
          });
        }
      }
    },
    [state.pendingPermission, logger]
  );

  // Pause animations during permission requests
  useEffect(() => {
    if (state.pendingPermission) {
      globalAnimationManager.pause();
    } else {
      globalAnimationManager.resume();
    }
  }, [state.pendingPermission, globalAnimationManager]);

  // Show loading screen during initialization
  if (!state.initialized) {
    return (
      <Box flexDirection="column" height="100%" justifyContent="center" alignItems="center">
        <Header showFullHeader={false} data-testid="app-header" />
        <ProgressBar isLoading={state.isLoading} message={initMessage} microProgress={initMicroProgress} />
        {state.initError && (
          <Box marginTop={2}>
            <Text color={theme.status.danger}>[ERROR] Initialization failed: {state.initError}</Text>
          </Box>
        )}
      </Box>
    );
  }

  const currentProviderAvailable = appInitializationService.getSessionManager() !== null;

  // Debug logging for input state (can be removed later)
  if (typeof window !== "undefined") {
    logger.debug("Input State Debug", {
      component: "App",
      sessionManagerExists: appInitializationService.getSessionManager() !== null,
      isLoading: state.isLoading,
      showDashboard,
      currentProviderAvailable,
      inputDisabled: state.isLoading || !currentProviderAvailable || showDashboard,
      currentProvider: state.currentProvider,
    });
  }

  return (
    <Box flexDirection="column" height="100%">
      {/* Beautiful header with gradient logo */}
      <Header showFullHeader={state.items.length === 0} data-testid="app-header" />

      {/* Message history display area */}
      <Box flexGrow={1} flexDirection="column" paddingX={1}>
        <Output
          items={state.items}
          streamingText={state.streamingText}
          streamingChunks={state.streamingChunks}
          pendingPermission={state.pendingPermission}
          permissionMode={claudePermissionMode}
          onPermissionResponse={handlePermissionResponse}
          sessionId="default"
          currentThought={state.currentThought}
          currentProvider={state.currentProvider}
          data-testid="output-container"
        />
      </Box>

      {/* User input interface */}
      <Box paddingX={1} paddingBottom={1}>
        <Input
          buffer={buffer}
          onSubmit={(text: string) => {
            sendMessage(text);
            buffer.setText(""); // Clear buffer after submit
          }}
          placeholder={
            showDashboard
              ? "Dashboard open - ESC to close"
              : currentProviderAvailable
              ? `Type your message or @path/to/file`
              : `${state.currentProvider} not available`
          }
          disabled={state.isLoading || !currentProviderAvailable || showDashboard}
          currentProvider={state.currentProvider}
          claudePermissionMode={claudePermissionMode}
          availableCommands={availableCommands}
          onSlashCommandListRequest={handleSlashCommandListRequest}
          slashCommandParserService={injectedSlashCommandParserService}
          inputWidth={inputWidth}
          logger={logger}
        />
      </Box>

      {/* Command execution status */}
      {commandExecutionStatus && (
        <Box paddingX={1} paddingBottom={1}>
          <Text color={theme.status.warning}>{commandExecutionStatus}</Text>
        </Box>
      )}

      {/* Status bar at bottom */}
      <StatusBar
        currentProvider={state.currentProvider}
        isProviderAvailable={currentProviderAvailable}
        currentModel={currentModel}
        modelInfo={state.modelInfo || undefined}
        projectPath={process.cwd()}
        isStreaming={state.isStreaming}
        permissionMode={state.currentProvider === ProviderType.CLAUDE ? claudePermissionMode : undefined}
        autoOpusEnabled={autoOpusEnabled}
        modelConfigManager={modelConfigManager}
        data-testid="status-bar"
      />

      {/* Dashboard Overlay */}
      {modelService && (
        <DashboardOverlay
          isVisible={showDashboard}
          onClose={() => setShowDashboard(false)}
          modelService={modelService}
          claudeUsageTracker={claudeUsageTracker}
          geminiUsageTracker={geminiUsageTracker}
          mcpService={mcpService}
          logger={logger}
        />
      )}
    </Box>
  );
}
