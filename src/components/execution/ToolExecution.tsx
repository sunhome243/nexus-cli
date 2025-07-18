import React from "react";
import { Box } from "ink";
import { NexusTheme } from "../../themes/NexusTheme.js";
import { TodoRenderer } from "../ui/renderers/TodoRenderer.js";
import { getProviderAdapter, ProviderType } from "../providers/factory/index.js";
import { ThemeProvider } from "../shared/ThemeProvider.js";
import { ToolExecutionData } from "../ui/interactive-base/BaseToolRenderer.js";
import { DiffRenderer } from "../ui/renderers/DiffRenderer.js";

// Core tool execution types
interface CoreToolResult {
  llmContent: any;
  returnDisplay: string | FileDiff;
}

interface FileDiff {
  fileDiff: string;
  fileName: string;
}

type ToolStatus = "validating" | "scheduled" | "executing" | "awaiting_approval" | "success" | "error" | "cancelled";

interface ToolExecutionProps {
  theme: NexusTheme;
  toolName: string;
  args: any;
  isExecuting?: boolean;
  result?: string | CoreToolResult;
  provider: ProviderType;
  isError?: boolean;
  errorMessage?: string;
  status?: ToolStatus;
  liveOutput?: string;
  durationMs?: number;
  callId?: string;
}

/**
 * Tool execution display component
 */
const ToolExecution: React.FC<ToolExecutionProps> = React.memo(
  ({
    theme,
    toolName,
    args,
    isExecuting = false,
    result,
    provider,
    isError = false,
    errorMessage,
    status,
    liveOutput,
    durationMs,
    callId,
  }) => {
    // Process result for display and diff rendering
    const { displayResult, hasDiff, diffData } = React.useMemo(() => {
      if (!result) return { displayResult: undefined, hasDiff: false, diffData: null };

      // If it's a core tool result with returnDisplay
      if (typeof result === "object" && "returnDisplay" in result) {
        const coreResult = result as CoreToolResult;
        if (typeof coreResult.returnDisplay === "string") {
          return { displayResult: coreResult.returnDisplay, hasDiff: false, diffData: null };
        } else if (coreResult.returnDisplay && "fileDiff" in coreResult.returnDisplay) {
          // Handle FileDiff format - return structured data for diff rendering
          const fileDiff = coreResult.returnDisplay as FileDiff;
          return {
            displayResult: undefined,
            hasDiff: true,
            diffData: { fileDiff: fileDiff.fileDiff, fileName: fileDiff.fileName },
          };
        }
      }

      // Fallback for simple string results
      const fallbackResult = typeof result === "string" ? result : JSON.stringify(result);
      return { displayResult: fallbackResult, hasDiff: false, diffData: null };
    }, [result]);

    // Determine execution status
    const actualIsExecuting = React.useMemo(() => {
      if (status) {
        return status === "executing" || status === "validating" || status === "scheduled";
      }
      return isExecuting;
    }, [status, isExecuting]);

    // Determine error status
    const actualIsError = React.useMemo(() => {
      if (status) {
        return status === "error";
      }
      return isError;
    }, [status, isError]);

    const toolData: ToolExecutionData = {
      toolName,
      args,
      isExecuting: actualIsExecuting,
      result: displayResult,
      provider,
      isError: actualIsError,
      errorMessage,
      timestamp: new Date(),
      // Add core-specific fields
      status,
      liveOutput,
      durationMs,
      callId,
    };

    const renderTodoContent = (todos: any) => (
      <Box marginTop={1}>
        <TodoRenderer theme={theme} todos={todos} />
      </Box>
    );

    // Custom diff renderer for FileDiff results
    const renderDiffContent = () => {
      if (!hasDiff || !diffData) return null;

      return (
        <Box marginTop={1}>
          <DiffRenderer
            fileDiff={diffData.fileDiff}
            fileName={diffData.fileName}
            showFileName={true}
            showStats={true}
          />
        </Box>
      );
    };

    const ProviderToolRenderer = getProviderAdapter(provider).ToolRenderer;

    return (
      <>
        <ProviderToolRenderer toolData={toolData} renderTodoContent={renderTodoContent} />
        {/* Add diff rendering after tool renderer */}
        {renderDiffContent()}
      </>
    );
  }
);

export default ToolExecution;
