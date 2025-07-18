/**
 * Utility functions for formatting tool responses in Gemini API format
 * Based on patterns from gemini-cli
 */

/**
 * Creates a function response part for successful tool execution
 * @param callId - The tool call ID
 * @param toolName - The name of the tool
 * @param output - The output string from the tool
 * @returns Formatted function response part
 */
export function createFunctionResponsePart(
  callId: string,
  toolName: string,
  output: string
): { functionResponse: { id: string; name: string; response: { output: string } } } {
  return {
    functionResponse: {
      id: callId,
      name: toolName,
      response: { output }
    }
  };
}

/**
 * Creates a function response part for tool execution errors
 * @param callId - The tool call ID
 * @param toolName - The name of the tool
 * @param error - The error message
 * @returns Formatted error response part
 */
export function createErrorResponsePart(
  callId: string,
  toolName: string,
  error: string
): { functionResponse: { id: string; name: string; response: { error: string } } } {
  return {
    functionResponse: {
      id: callId,
      name: toolName,
      response: { error }
    }
  };
}

/**
 * Formats a tool response based on success/failure status
 * @param toolCallId - The tool call ID
 * @param toolName - The name of the tool
 * @param success - Whether the tool execution was successful
 * @param result - The result content (for success)
 * @param error - The error message (for failure)
 * @returns Formatted response part
 */
export function formatToolResponse(
  toolCallId: string,
  toolName: string,
  success: boolean,
  result?: unknown,
  error?: string
): { functionResponse: { id: string; name: string; response: { output?: string; error?: string } } } {
  // Check success flag first - if false, it's an error regardless of result
  if (!success) {
    // For failed execution, format as error
    const errorMessage = error || 'Tool execution failed';
    return createErrorResponsePart(toolCallId, toolName, errorMessage);
  }
  
  // For successful execution
  if (result !== undefined && result !== null) {
    // Handle responseParts which might be an array or object
    let outputString: string;
    if (typeof result === 'string') {
      outputString = result;
    } else if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'string') {
      // If responseParts is an array of strings, join them
      outputString = result.join('\n');
    } else {
      // For other types, stringify
      outputString = JSON.stringify(result);
    }
    return createFunctionResponsePart(toolCallId, toolName, outputString);
  } else {
    // Success but no result - this shouldn't happen, but handle gracefully
    return createFunctionResponsePart(toolCallId, toolName, 'Tool executed successfully');
  }
}