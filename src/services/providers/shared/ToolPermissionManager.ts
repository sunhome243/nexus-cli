/**
 * Tool Permission Manager - Centralized tool classification and permission system
 * 
 * @module ToolPermissionManager
 * @description Centralized tool classification system for permission handling across all providers.
 * Eliminates duplication across providers (Claude, Gemini, MCP) with tiered security model.
 * Provides consistent tool categorization, permission tiers, and human-readable descriptions.
 */

export type ToolTier = 'safe' | 'cautious' | 'dangerous';

/**
 * Tools that are considered safe and typically don't require special permissions
 * These tools only read data or provide information without modifying system state
 */
export const SAFE_TOOLS = [
  'Read',
  'LS', 
  'Glob',
  'Grep',
  'NotebookRead',
  'TodoRead',
  'TodoWrite',
  'WebSearch',
  'exit_plan_mode'
] as const;

/**
 * Tools that require caution as they modify files or data
 * These tools can change system state but in controlled ways
 */
export const CAUTIOUS_TOOLS = [
  'Edit',
  'Write', 
  'MultiEdit',
  'NotebookEdit'
] as const;

/**
 * Tools that are potentially dangerous as they execute system commands
 * These tools can have significant system impact and require explicit permission
 */
export const DANGEROUS_TOOLS = [
  'Bash',
  'Execute',
  'Run'
] as const;

/**
 * All known tools for validation purposes
 */
export const ALL_TOOLS = [...SAFE_TOOLS, ...CAUTIOUS_TOOLS, ...DANGEROUS_TOOLS] as const;

/**
 * Determine the permission tier for a given tool name
 * 
 * @param {string} toolName - The name of the tool to classify
 * @returns {ToolTier} The permission tier (safe, cautious, or dangerous)
 * @description Used consistently across all providers for permission decisions.
 * Defaults to 'cautious' for unknown tools to err on the side of caution.
 */
export function getToolTier(toolName: string): ToolTier {
  if ((SAFE_TOOLS as readonly string[]).includes(toolName)) {
    return 'safe';
  }
  
  if ((CAUTIOUS_TOOLS as readonly string[]).includes(toolName)) {
    return 'cautious';
  }
  
  if ((DANGEROUS_TOOLS as readonly string[]).includes(toolName)) {
    return 'dangerous';
  }
  
  // Default to cautious for unknown tools to err on the side of caution
  return 'cautious';
}

/**
 * Check if a tool is in a specific tier
 * 
 * @param {string} toolName - The tool name to check
 * @param {ToolTier} tier - The tier to check against
 * @returns {boolean} True if the tool is in the specified tier
 * @description Utility function for tier-based tool validation and filtering.
 */
export function isToolInTier(toolName: string, tier: ToolTier): boolean {
  return getToolTier(toolName) === tier;
}

/**
 * Get all tools in a specific tier
 * 
 * @param {ToolTier} tier - The tier to get tools for
 * @returns {readonly string[]} Array of tool names in the specified tier
 * @description Retrieves all tools classified under a specific permission tier.
 */
export function getToolsInTier(tier: ToolTier): readonly string[] {
  switch (tier) {
    case 'safe':
      return SAFE_TOOLS;
    case 'cautious':
      return CAUTIOUS_TOOLS;
    case 'dangerous':
      return DANGEROUS_TOOLS;
    default:
      return [];
  }
}

/**
 * Tool descriptions for UI display
 * Used for generating human-readable permission prompts
 */
export const TOOL_DESCRIPTIONS: Record<string, string> = {
  // Safe tools
  'LS': 'List directory contents',
  'Read': 'Read file contents',
  'Grep': 'Search file contents',
  'Glob': 'Find files by pattern',
  'NotebookRead': 'Read Jupyter notebook',
  'TodoRead': 'Read todo list',
  'TodoWrite': 'Write todo list',
  'WebSearch': 'Search the web',
  'exit_plan_mode': 'Exit plan mode',
  
  // Cautious tools
  'Edit': 'Edit file contents',
  'Write': 'Write file contents',
  'MultiEdit': 'Edit multiple files',
  'NotebookEdit': 'Edit Jupyter notebook',
  
  // Dangerous tools
  'Bash': 'Execute shell command',
  'Execute': 'Execute system command',
  'Run': 'Run program or script'
};

/**
 * Get description for a tool, with fallback for unknown tools
 * 
 * @param {string} toolName - The tool name to get description for
 * @returns {string} Human-readable description of the tool
 * @description Provides user-friendly tool descriptions for permission prompts and UI display.
 */
export function getToolDescription(toolName: string): string {
  return TOOL_DESCRIPTIONS[toolName] || `Execute ${toolName} tool`;
}