import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { useTheme } from "../../shared/ThemeProvider.js";
import { GeminiUsageStats } from "../../../utils/geminiStatsUtils.js";

interface UsageStatsDisplayProps {
  claudeStatsData?: string;
  geminiStats?: GeminiUsageStats;
  isLoading: boolean;
}

interface ParsedPlanUsage {
  name: string;
  used: number;
  limit: number;
  percentage: number;
  resetTime?: string;
  projection?: {
    tokens: number;
    percentage: number;
    remainingMinutes?: number;
    hasWarning: boolean;
  };
}

interface ParsedModelUsage {
  model: string;
  tokens: number;
  requests: number;
}

export const UsageStatsDisplay: React.FC<UsageStatsDisplayProps> = ({ claudeStatsData, geminiStats, isLoading }) => {
  const { theme } = useTheme();

  // Parse the stats data to extract structured information
  const parseStatsData = (data: string) => {
    const lines = data.split("\n");
    const claudePlans: ParsedPlanUsage[] = [];
    const geminiModels: ParsedModelUsage[] = [];
    let currentSection = "";
    let geminiSession = { tokens: 0, duration: "" };
    let claudeWindowReset = "";
    let claudeCost = "";
    let claudeBurnRate = "";
    let geminiTotalTokens = 0;
    let geminiTotalSessions = 0;
    let geminiCost = "";

    lines.forEach((line) => {
      // Claude section detection
      if (line.includes("Claude Usage")) {
        currentSection = "claude";
        return;
      }

      // Gemini section detection
      if (line.includes("Gemini Usage")) {
        currentSection = "gemini";
        return;
      }

      // Parse Claude plan usage (Plus, Max 5x, Max 20x, etc.)
      if (currentSection === "claude" && line.includes(":") && (line.includes("▓") || line.includes("░"))) {
        const match = line.match(/([^:]+):\s*[▓░]+\s*([\d,]+)\/([\d,]+)\s*\(([\d.]+)%\)/);
        if (match) {
          const [, name, used, limit, percentage] = match;
          claudePlans.push({
            name: name.trim(),
            used: parseInt(used.replace(/,/g, ""), 10),
            limit: parseInt(limit.replace(/,/g, ""), 10),
            percentage: parseFloat(percentage),
            resetTime: claudeWindowReset,
          });
        }
      }

      // Parse Claude projection data
      if (currentSection === "claude" && line.includes("Projected:")) {
        const match = line.match(/Projected:\s*([\d,]+)\/([\d,]+)\s*\(([\d.]+)%\)/);
        if (match && claudePlans.length > 0) {
          const [, projectedTokens, limit, projectedPercentage] = match;
          const lastPlan = claudePlans[claudePlans.length - 1];
          lastPlan.projection = {
            tokens: parseInt(projectedTokens.replace(/,/g, ""), 10),
            percentage: parseFloat(projectedPercentage),
            hasWarning: line.includes("⚠️"),
          };
        }
      }

      // Parse Claude reset time
      if (currentSection === "claude" && line.includes("Resets in:")) {
        claudeWindowReset = line.split("Resets in:")[1]?.trim() || "";
      }

      // Parse Claude cost and burn rate
      if (currentSection === "claude" && line.includes("Session Cost:")) {
        claudeCost = line.split("Session Cost:")[1]?.trim() || "";
      }

      if (currentSection === "claude" && line.includes("Burn Rate:")) {
        claudeBurnRate = line.split("Burn Rate:")[1]?.trim() || "";
      }

      // Parse Gemini current session
      if (currentSection === "gemini" && line.includes("Current Session:")) {
        const match = line.match(/([\d,]+)\s*tokens\s*\(([^)]+)\)/);
        if (match) {
          geminiSession = {
            tokens: parseInt(match[1].replace(/,/g, ""), 10),
            duration: match[2],
          };
        }
      }

      // Parse Gemini today's total
      if (currentSection === "gemini" && line.includes("Today's Total:")) {
        const match = line.match(/([\d,]+)\s*tokens\s*\((\d+)\s*sessions?\)/);
        if (match) {
          geminiTotalTokens = parseInt(match[1].replace(/,/g, ""), 10);
          geminiTotalSessions = parseInt(match[2], 10);
        }
      }

      // Parse Gemini estimated cost
      if (currentSection === "gemini" && line.includes("Estimated Cost:")) {
        geminiCost = line.split("Estimated Cost:")[1]?.trim() || "";
      }

      // Parse model usage (for both providers)
      if (line.includes("tokens") && line.includes("requests") && line.trim().match(/^\s+\w/)) {
        const match = line.match(/([^:]+):\s*([\d,]+)\s*tokens\s*\((\d+)\s*requests?\)/);
        if (match) {
          geminiModels.push({
            model: match[1].trim(),
            tokens: parseInt(match[2].replace(/,/g, ""), 10),
            requests: parseInt(match[3], 10),
          });
        }
      }
    });

    return {
      claudePlans,
      geminiModels,
      geminiSession,
      claudeWindowReset,
      claudeCost,
      claudeBurnRate,
      geminiTotalTokens,
      geminiTotalSessions,
      geminiCost,
    };
  };

  const createProgressBar = (percentage: number, width: number = 15): string => {
    // Ensure percentage is valid and clamp values to prevent negative repeats
    const safePercentage = Math.max(0, percentage);
    const filled = Math.min(width, Math.max(0, Math.round((safePercentage / 100) * width)));
    const empty = Math.max(0, width - filled);
    return "█".repeat(filled) + "░".repeat(empty);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return theme.status.danger;
    if (percentage >= 70) return theme.status.warning;
    return theme.status.success;
  };

  if (isLoading) {
    return (
      <Box flexDirection="column">
        <Text color={theme.interaction.primary}>
          <Spinner type="dots" /> Loading usage data...
        </Text>
      </Box>
    );
  }

  // Show Claude stats (parsed from existing string format)
  const { claudePlans, claudeWindowReset, claudeCost, claudeBurnRate } = claudeStatsData
    ? parseStatsData(claudeStatsData)
    : { claudePlans: [], claudeWindowReset: "", claudeCost: "", claudeBurnRate: "" };

  return (
    <Box flexDirection="column">
      {/* Claude Usage Section */}
      {claudePlans.length > 0 && (
        <Box flexDirection="column" marginBottom={2}>
          <Box marginBottom={1}>
            <Text color={theme.claude.primary} bold>
              ◇ Claude Usage
            </Text>
            <Text color={theme.text.muted}> (5-hour windows)</Text>
          </Box>

          {claudeWindowReset && (
            <Box marginLeft={2} marginBottom={1}>
              <Text color={theme.text.muted}>⏱ Resets in: {claudeWindowReset}</Text>
            </Box>
          )}

          {claudePlans.map((plan) => (
            <Box key={plan.name} flexDirection="column" marginLeft={2} marginBottom={1}>
              <Box>
                <Text color={theme.text.secondary}>{plan.name}: </Text>
                <Text color={getProgressColor(plan.percentage)}>{createProgressBar(plan.percentage)}</Text>
                <Text color={theme.text.muted}> {plan.percentage.toFixed(1)}%</Text>
                {plan.percentage > 100 && <Text color={theme.status.danger}> ⚠️</Text>}
              </Box>
              <Box marginLeft={2}>
                <Text color={theme.text.muted}>
                  {plan.used.toLocaleString()} / {plan.limit.toLocaleString()} tokens
                </Text>
              </Box>
              {plan.projection && (
                <Box marginLeft={2}>
                  <Text color={theme.text.muted}> ✦ Projected: </Text>
                  <Text color={plan.projection.hasWarning ? theme.status.danger : theme.text.primary}>
                    {plan.projection.tokens.toLocaleString()} tokens ({plan.projection.percentage.toFixed(1)}%)
                  </Text>
                  {plan.projection.hasWarning && <Text color={theme.status.danger}> ⚠️</Text>}
                </Box>
              )}
            </Box>
          ))}

          {/* Claude Cost Info */}
          {claudeCost && (
            <Box marginLeft={2} marginTop={1}>
              <Text color={theme.text.muted}>Cost: {claudeCost}</Text>
            </Box>
          )}
          {claudeBurnRate && (
            <Box marginLeft={2}>
              <Text color={theme.text.muted}>Burn Rate: {claudeBurnRate}</Text>
            </Box>
          )}
        </Box>
      )}

      {/* Gemini Usage Section - Using Structured Data */}
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color={theme.gemini.primary} bold>
            ◆ Gemini Usage
          </Text>
        </Box>

        {geminiStats ? (
          <Box flexDirection="column" marginLeft={2}>
            {/* Current Session */}
            <Box marginBottom={1}>
              <Text color={theme.text.secondary}>Session: </Text>
              <Text color={theme.text.primary}>{geminiStats.session.tokens.toLocaleString()} tokens</Text>
              <Text color={theme.text.muted}> ({geminiStats.session.duration})</Text>
            </Box>

            {/* Today's Total */}
            {geminiStats.daily.tokens > 0 && (
              <Box marginBottom={1}>
                <Text color={theme.text.secondary}>Today: </Text>
                <Text color={theme.text.primary}>{geminiStats.daily.tokens.toLocaleString()} tokens</Text>
                <Text color={theme.text.muted}> ({geminiStats.daily.sessions} sessions)</Text>
              </Box>
            )}

            {/* Estimated Cost */}
            <Box marginBottom={1}>
              <Text color={theme.text.muted}>Cost: ${geminiStats.daily.estimatedCost.toFixed(4)}</Text>
            </Box>

            {/* Model Usage */}
            {geminiStats.session.models.length > 0 && (
              <Box flexDirection="column" marginTop={1}>
                <Text color={theme.text.secondary}>Model Usage:</Text>
                {geminiStats.session.models.map((model) => (
                  <Box key={model.name} marginLeft={2}>
                    <Text color={theme.text.muted}>• {model.name}: </Text>
                    <Text color={theme.text.primary}>{model.tokens.total.toLocaleString()}</Text>
                    <Text color={theme.text.muted}> tokens ({model.requests} reqs)</Text>
                  </Box>
                ))}
              </Box>
            )}

            {/* Tool Usage */}
            {geminiStats.session.tools.length > 0 && (
              <Box flexDirection="column" marginTop={1}>
                <Text color={theme.text.secondary}>Tool Usage:</Text>
                {geminiStats.session.tools.map((tool) => (
                  <Box key={tool.name} marginLeft={2}>
                    <Text color={theme.text.muted}>• {tool.name}: </Text>
                    <Text color={theme.text.primary}>{tool.calls} calls</Text>
                    <Text color={theme.text.muted}> ({tool.successRate}% success)</Text>
                  </Box>
                ))}
              </Box>
            )}

            {/* Cache Efficiency */}
            {geminiStats.cacheEfficiency && geminiStats.cacheEfficiency.savedTokens > 0 && (
              <Box marginTop={1}>
                <Text color={theme.text.secondary}>Cache: </Text>
                <Text color={theme.status.success}>
                  {geminiStats.cacheEfficiency.savedTokens.toLocaleString()} tokens saved
                </Text>
                <Text color={theme.text.muted}> ({geminiStats.cacheEfficiency.percentage}%)</Text>
              </Box>
            )}
          </Box>
        ) : (
          <Box marginLeft={2}>
            <Text color={theme.text.muted}>No usage recorded yet</Text>
          </Box>
        )}
      </Box>

      {/* Fallback for Claude if no structured data */}
      {!claudePlans.length && claudeStatsData && (
        <Box flexDirection="column" marginTop={2}>
          <Text color={theme.text.secondary}>{claudeStatsData}</Text>
        </Box>
      )}
    </Box>
  );
};

export default UsageStatsDisplay;
