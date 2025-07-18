import React from "react";
import { Box, Text } from "ink";
import { AIProvider } from "../../core/types.js";
import { useTheme } from "../../shared/ThemeProvider.js";
import { usePermissions } from "../../providers/claude/index.js";
import { ProviderRegistry } from "../../shared/ProviderRegistry.js";
import { ProviderType, IModelConfigManager } from "../../../abstractions/providers/index.js";
import { ModelInfo } from "../../core/types.js";

interface StatusBarProps {
  currentProvider: AIProvider;
  isProviderAvailable: boolean;
  currentModel?: string | null;
  modelInfo?: ModelInfo;
  projectPath?: string;
  isStreaming?: boolean;
  permissionMode?: string;
  autoOpusEnabled?: boolean;
  modelConfigManager: IModelConfigManager;
  "data-testid"?: string;
}

export function StatusBar({
  currentProvider,
  isProviderAvailable,
  currentModel,
  modelInfo,
  projectPath,
  isStreaming = false,
  permissionMode,
  autoOpusEnabled = false,
  modelConfigManager,
  "data-testid": testId,
}: StatusBarProps) {
  const { theme } = useTheme();
  const { isConnected: mcpConnected } = usePermissions();

  const getProviderDisplay = () => {
    if (!isProviderAvailable) {
      return <Text color={theme.status.danger}>{currentProvider} (unavailable)</Text>;
    }

    const providerTheme = ProviderRegistry.getTheme(currentProvider as ProviderType);
    const displayInfo = ProviderRegistry.getDisplayInfo(currentProvider as ProviderType);

    return <Text color={providerTheme.primary}>{displayInfo.name}</Text>;
  };

  const getModeDisplay = () => {
    // Show permission mode for providers that support permission mode cycling
    if (permissionMode) {
      return <Text color={theme.text.muted}>({permissionMode})</Text>;
    }
    // When no mode is available, show placeholder
    return <Text color={theme.text.muted}>(-)</Text>;
  };

  const getModelDisplay = () => {
    const providerTheme = ProviderRegistry.getTheme(currentProvider as ProviderType);

    // Handle Auto Opus indicator for supported providers
    const showAutoModelIndicator = () => {
      if (!autoOpusEnabled || !currentModel) return "";

      const opusModel =
        modelConfigManager.getModelNames(currentProvider as ProviderType).find((m) => m === "opus") || "opus";
      const isAutoActive = autoOpusEnabled && permissionMode === "plan" && currentModel === opusModel;
      return isAutoActive ? " 🤖" : "";
    };

    // Use currentModel if available, otherwise check modelInfo
    if (currentModel) {
      const displayName = currentModel.charAt(0).toUpperCase() + currentModel.slice(1);
      return (
        <Text color={providerTheme.primary}>
          [{displayName}]{showAutoModelIndicator()}
        </Text>
      );
    }

    // For Gemini and other providers
    if (!modelInfo) {
      // Show loading state when modelInfo is not yet available
      return <Text color={theme.text.muted}>[Loading...]</Text>;
    }

    const displayModel = modelInfo.model;

    // Defensive validation: prevent wrong provider model names from appearing
    const currentProviderModels = modelConfigManager.getModelNames(currentProvider as ProviderType);
    if (currentProviderModels.length > 0 && !currentProviderModels.includes(displayModel.toLowerCase())) {
      return <Text color={theme.text.muted}>[Loading...]</Text>;
    }
    const isFlashModel = displayModel.toLowerCase().includes("flash");
    const isProModel = displayModel.toLowerCase().includes("pro");
    const fallbackIndicator = modelInfo.isUsingFallback ? " (fallback)" : "";
    const quotaWarning = modelInfo.hasQuotaError ? " ⚠️" : "";

    // Format model name for better display
    let formattedName = displayModel;
    if (displayModel.startsWith("gemini-")) {
      // Keep the full model name but format it nicely
      // gemini-2.5-pro -> Gemini 2.5 Pro
      // gemini-2.5-flash -> Gemini 2.5 Flash
      // gemini-2.5-pro -> Gemini 2.5 Pro
      // gemini-2.0-flash-exp -> Gemini 2.0 Flash Exp
      const withoutPrefix = displayModel.replace("gemini-", "");

      // Handle version numbers that contain dots (e.g., "2.5", "2.5")
      // Split by '-' but be careful about version numbers with dots
      const parts = withoutPrefix.split("-");

      if (parts.length >= 2) {
        // Check if the first part is a version number (contains digit)
        const firstPart = parts[0];

        // If the first part looks like a version (contains digits), treat it as version
        if (/^\d+(\.\d+)?$/.test(firstPart)) {
          const version = firstPart;
          const modelType = parts
            .slice(1)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join(" ");

          formattedName = `Gemini ${version} ${modelType}`;
        } else {
          // If no clear version pattern, just capitalize all parts
          formattedName = `Gemini ${parts
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join(" ")}`;
        }
      } else {
        // Fallback: just capitalize and clean up
        formattedName = displayModel.replace("gemini-", "Gemini ");
      }
    }

    return (
      <Text color={isFlashModel ? theme.status.warning : providerTheme.primary}>
        [{formattedName}]{isFlashModel && " ⚡"}
        {isProModel && " 🚀"}
        {fallbackIndicator}
        {quotaWarning}
      </Text>
    );
  };

  return (
    <Box justifyContent="space-between" paddingX={1} width="100%" {...(testId ? { "data-testid": testId } : {})}>
      {/* Left: Provider */}
      <Box flexBasis="33%" justifyContent="flex-start">
        {getProviderDisplay()}
      </Box>

      {/* Center: Mode */}
      <Box flexBasis="33%" justifyContent="center">
        {getModeDisplay()}
      </Box>

      {/* Right: Model */}
      <Box flexBasis="33%" justifyContent="flex-end">
        {getModelDisplay()}
      </Box>
    </Box>
  );
}
