#!/usr/bin/env node

/**
 * Nexus Clean CLI Entry Point
 * Cross-provider session management for AI chat interfaces
 */

import React from "react";
import { render } from "ink";
import { App } from "./components/core/App.js";
import { ErrorBoundary } from "./components/core/ErrorBoundary.js";
import { PermissionProvider } from "./components/providers/claude/index.js";
import { ThemeProvider } from "./components/shared/ThemeProvider.js";
import { ServiceProvider } from "./components/providers/ServiceProvider.js";
import { createApplicationContainer } from "./infrastructure/di/composition.js";
import { TYPES } from "./infrastructure/di/types.js";
import { IMCPService } from "./services/core/MCPService.js";
import { ISessionManager } from "./interfaces/core/ISessionManager.js";
import { ISlashCommandService } from "./interfaces/commands/index.js";
import { ISlashCommandParserService } from "./interfaces/commands/ISlashCommandParserService.js";
import { IModelService } from "./interfaces/core/IModelService.js";
import { IModelConfigManager } from "./abstractions/providers/model-config.js";
import { IGlobalAnimationManager } from "./utils/GlobalAnimationManager.js";
import { IAppEventBusService } from "./interfaces/events/IAppEventBusService.js";
import { IAppInitializationService } from "./interfaces/initialization/IAppInitializationService.js";
import { IAskModelSocketService } from "./services/mcp/AskModelSocketService.js";
import { ILoggerService } from "./interfaces/core/ILoggerService.js";
import { PermissionResponseService } from "./services/providers/claude/services/PermissionResponseService.js";
import { ProviderPermissionCoordinator } from "./services/permissions/ProviderPermissionCoordinator.js";

// Initialize the dependency injection container
const diContainer = createApplicationContainer();
const logger = diContainer.get<ILoggerService>(TYPES.LoggerService);

logger.info("Initializing DI container", { component: "CLI" });

// Initialize MCP configuration and services
logger.info("Ensuring standard MCP configuration", { component: "CLI" });
await initializeMCPServices();

// Clean startup - header is now handled by the React component

async function initializeMCPServices(): Promise<void> {
  try {
    const mcpService = diContainer.get<IMCPService>(TYPES.MCPService);
    await mcpService.initialize();
    logger.info("MCP configuration initialized", { component: "CLI" });

    // Initialize askModel socket service
    const askModelSocketService = diContainer.get<IAskModelSocketService>(TYPES.AskModelSocketService);
    await askModelSocketService.initialize();
    logger.info("AskModel socket service initialized", { component: "CLI" });

    // Initialize permission response service
    const permissionResponseService = diContainer.get<PermissionResponseService>(TYPES.PermissionResponseService);
    await permissionResponseService.initialize();
    logger.info("Permission response service initialized", { component: "CLI" });
  } catch (error) {
    logger.error("Failed to initialize MCP configuration", { component: "CLI", error: error?.toString() });

    // Attempt cleanup before exit
    try {
      await globalCleanup();
    } catch (cleanupError) {
      logger.error("Failed to cleanup after initialization error", {
        component: "CLI",
        error: cleanupError?.toString(),
      });
    }

    process.exit(1);
  }
}

// Global cleanup function for MCP servers and session management
async function globalCleanup() {
  try {
    logger.info("Shutting down gracefully", { component: "CLI" });

    // Perform final save for session manager before cleanup
    try {
      const sessionManager = diContainer.get<ISessionManager>(TYPES.SessionManager);
      if (sessionManager && sessionManager.performFinalSave) {
        logger.info("Saving final session state", { component: "CLI" });
        await sessionManager.performFinalSave();
        logger.info("Final session save completed", { component: "CLI" });
      }
    } catch (error) {
      logger.warn("Failed to save final session state", { component: "CLI", error: error?.toString() });
    }

    // Clean up askModel socket service
    try {
      const askModelSocketService = diContainer.get<IAskModelSocketService>(TYPES.AskModelSocketService);
      await askModelSocketService.cleanup();
      logger.info("AskModel socket service cleanup completed", { component: "CLI" });
    } catch (error) {
      logger.warn("Failed to cleanup askModel socket service", { component: "CLI", error: error?.toString() });
    }

    // Clean up event listeners to prevent memory leaks
    try {
      const appEventBusService = diContainer.get<IAppEventBusService>(TYPES.AppEventBusService);
      if (appEventBusService) {
        appEventBusService.removeAllListeners();
        logger.info("Event bus cleanup completed", { component: "CLI" });
      }
    } catch (error) {
      logger.warn("Failed to cleanup event bus service", { component: "CLI", error: error?.toString() });
    }

    // Clean up session manager
    try {
      const sessionManager = diContainer.get<ISessionManager>(TYPES.SessionManager);
      if (sessionManager) {
        await sessionManager.cleanup();
        logger.info("Session manager cleanup completed", { component: "CLI" });
      }
    } catch (error) {
      logger.warn("Failed to cleanup session manager", { component: "CLI", error: error?.toString() });
    }

    // Kill all MCP server processes using secure process tracking
    const { ProcessTracker, FileCleanupUtil } = await import("./utils/processTracker.js");

    try {
      const processTracker = ProcessTracker.getInstance();
      await processTracker.killTrackedProcesses("mcp-permission-server");
      logger.info("Cleaned up MCP server processes", { component: "CLI" });
    } catch (error) {
      logger.warn("Failed to cleanup MCP processes", { component: "CLI", error: error?.toString() });
    }

    // Clean up socket files using secure file operations
    try {
      await FileCleanupUtil.cleanupAllMCPSockets();
      logger.info("Cleaned up MCP socket files", { component: "CLI" });
    } catch (error) {
      logger.warn("Failed to cleanup socket files", { component: "CLI", error: error?.toString() });
    }

    logger.info("Cleanup complete", { component: "CLI" });
  } catch (error) {
    logger.error("Error during cleanup", { component: "CLI", error: error?.toString() });
  }
}

// Handle process signals for graceful shutdown
process.on("SIGINT", async () => {
  await globalCleanup();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await globalCleanup();
  process.exit(0);
});

// Handle process exit to ensure final save
process.on("beforeExit", async (code) => {
  // Only perform cleanup if not already done
  if (!global.cleanupPerformed) {
    global.cleanupPerformed = true;
    await globalCleanup();
  }
});

// Declare global cleanup flag
declare global {
  var cleanupPerformed: boolean;
}
global.cleanupPerformed = false;

// Get services from DI container for proper injection
const sessionManager = diContainer.get<ISessionManager>(TYPES.SessionManager);
const slashCommandService = diContainer.get<ISlashCommandService>(TYPES.SlashCommandService);
const slashCommandParserService = diContainer.get<ISlashCommandParserService>(TYPES.SlashCommandParserService);
const modelService = diContainer.get<IModelService>(TYPES.ModelService);
const modelConfigManager = diContainer.get<IModelConfigManager>(TYPES.ModelConfigManager);
const globalAnimationManager = diContainer.get<IGlobalAnimationManager>(TYPES.GlobalAnimationManager);
const claudeUsageTracker = diContainer.get(TYPES.ClaudeUsageTracker);
const geminiUsageTracker = diContainer.get(TYPES.GeminiUsageTracker);
const mcpService = diContainer.get(TYPES.MCPService);
const appEventBusService = diContainer.get<IAppEventBusService>(TYPES.AppEventBusService);
const appInitializationService = diContainer.get<IAppInitializationService>(TYPES.AppInitializationService);
const providerSwitchService = diContainer.get(TYPES.ProviderSwitchService);
const permissionResponseService = diContainer.get<PermissionResponseService>(TYPES.PermissionResponseService);
const providerPermissionCoordinator = diContainer.get<ProviderPermissionCoordinator>(TYPES.ProviderPermissionCoordinator);

// Check if TTY is available for raw mode support
const isTTY = process.stdin.isTTY;
const hasSetRawMode = typeof process.stdin.setRawMode === "function";
const isRawModeSupported = isTTY && hasSetRawMode;

if (!isRawModeSupported) {
  logger.error("This application requires a TTY environment with raw mode support", {
    component: "CLI",
    details:
      "This typically happens when running in a non-interactive environment, piping input/output, or in certain CI/CD environments. Please run this application in a proper terminal environment.",
  });
  process.exit(1);
}

// Initialize and render the React-based CLI interface with MCP permission support
try {
  render(
    <ErrorBoundary
      logger={logger}
      fallbackMessage="The application encountered an error. Please restart the CLI."
      onError={(error, errorInfo) => {
        // Log critical errors that crash the React app
        logger.error("React application crashed", {
          error: error.toString(),
          stack: error.stack,
          componentStack: errorInfo.componentStack,
        });
      }}
    >
      <ServiceProvider container={diContainer}>
        <ThemeProvider>
          <PermissionProvider>
            <App
              sessionManager={sessionManager}
              slashCommandService={slashCommandService}
              slashCommandParserService={slashCommandParserService}
              modelService={modelService}
              modelConfigManager={modelConfigManager}
              globalAnimationManager={globalAnimationManager}
              logger={logger}
              claudeUsageTracker={claudeUsageTracker}
              geminiUsageTracker={geminiUsageTracker}
              mcpService={mcpService}
              appEventBusService={appEventBusService}
              appInitializationService={appInitializationService}
              providerSwitchService={providerSwitchService}
              claudeSettingsService={diContainer.get(TYPES.ClaudeSettingsService)}
              permissionResponseService={permissionResponseService}
              providerPermissionCoordinator={providerPermissionCoordinator}
            />
          </PermissionProvider>
        </ThemeProvider>
      </ServiceProvider>
    </ErrorBoundary>,
    {
      exitOnCtrlC: false, // Handle Ctrl+C gracefully
    }
  );
} catch (error) {
  if (error instanceof Error && error.message.includes("Raw mode is not supported")) {
    logger.error("Raw mode is not supported on the current input stream", {
      component: "CLI",
      details:
        "This application requires an interactive terminal environment. Please run this application directly in a terminal, not through pipes or redirects.",
    });
    process.exit(1);
  } else {
    // Re-throw other errors
    throw error;
  }
}
