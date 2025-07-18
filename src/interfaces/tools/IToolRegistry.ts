/**
 * Tool Registry Interface
 * Manages available tools and their metadata with core integration
 */

import { ToolRegistry as CoreToolRegistry } from '@google/gemini-cli-core';

export interface IToolDefinition {
  name: string;
  description: string;
  category: 'file' | 'network' | 'system' | 'data' | 'user' | 'misc';
  permissionTier: 'safe' | 'cautious' | 'dangerous';
  parameters: Record<string, any>;
  examples?: string[];
}

export interface IToolRegistry {
  /**
   * Register a UI-specific tool definition
   */
  registerTool(definition: IToolDefinition): void;
  
  /**
   * Get tool definition by name (checks both UI and core tools)
   */
  getTool(name: string): IToolDefinition | null;
  
  /**
   * Get all registered tools (UI and core tools combined)
   */
  getAllTools(): IToolDefinition[];
  
  /**
   * Get tools by category
   */
  getToolsByCategory(category: IToolDefinition['category']): IToolDefinition[];
  
  /**
   * Get tools by permission tier
   */
  getToolsByPermissionTier(tier: IToolDefinition['permissionTier']): IToolDefinition[];
  
  /**
   * Check if tool exists (checks both UI and core tools)
   */
  hasTool(name: string): boolean;
  
  /**
   * Search tools by name or description
   */
  searchTools(query: string): IToolDefinition[];
  
  /**
   * Get access to the core tool registry for direct core tool operations
   */
  getCoreRegistry(): CoreToolRegistry;
}