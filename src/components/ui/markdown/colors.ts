/**
 * Color mapping for markdown components
 * Maps gemini-cli colors to Nexus theme colors
 */
import { defaultNexusTheme } from "../../../themes/NexusTheme.js";

export const Colors = {
  // Header colors
  AccentCyan: defaultNexusTheme.syntax.heading,
  AccentBlue: defaultNexusTheme.gemini.primary,
  AccentPurple: defaultNexusTheme.syntax.code,

  // Text colors
  Gray: defaultNexusTheme.text.muted,

  // Default colors
  Default: defaultNexusTheme.text.primary,
};
