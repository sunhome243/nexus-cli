import { NexusTheme } from "./NexusTheme.js";

// Nexus Space Dark Theme - Modern dark terminal theme
export const nexusSpaceDark: NexusTheme = {
  text: {
    primary: "#EAEAEA", // Light Gray - main text
    secondary: "#B8B8B8", // Medium Gray - secondary text
    muted: "#8A8A8A", // Muted Gray - muted text
  },

  interaction: {
    primary: "#708CA9", // Soft Blue Gray - primary interactions
    secondary: "#555555", // Dark Gray - secondary interactions
  },

  status: {
    success: "#4CAF50", // Green
    warning: "#FF9800", // Orange
    danger: "#F44336", // Red
    info: "#2196F3", // Blue
  },

  border: {
    default: "#555555", // Dark Gray - default borders
    subtle: "#3A3A3A", // Darker Gray - subtle borders
    accent: "#007ACC", // Electric Blue - accent borders
    separator: "#444444", // Medium Dark Gray - separators
  },

  // Provider brand colors (stable across themes)
  claude: {
    primary: "#f4c28e", // Claude brand orange/gold
    secondary: "#d4af37", // Secondary Claude color
    accent: "#ffd700", // Accent Claude color
  },

  gemini: {
    primary: "#4285f4", // Gemini brand blue
    secondary: "#1a73e8", // Secondary Gemini color
    accent: "#34a853", // Accent Gemini color
    thoughtIndicator: "#808080", // Light grey for ⏺
    thoughtText: "#B0B0B0", // Light grey for thought text
  },

  permission: {
    dangerous: "#F44336", // Red - dangerous operations
    moderate: "#007ACC", // Electric Blue - moderate operations
    safe: "#4CAF50", // Green - safe operations
    neutral: "#8A8A8A", // Muted Gray - neutral/default
  },

  todo: {
    completed: "#8A8A8A", // Muted Gray for completed todos
    inProgress: "#4CAF50", // Green for active todos
    pending: "#B8B8B8", // Medium Gray for pending todos
    background: "#2A2A2A", // Dark Surface for todo items
  },

  syntax: {
    code: "#4CAF50", // Green for code blocks
    codeBackground: "#007ACC", // Electric Blue background for code highlights
    language: "#FF9800", // Orange for language labels
    heading: "#E91E63", // Pink for headings
    link: "#00BCD4", // Cyan for links
    error: "#F44336", // Red for errors
  },
};

export default nexusSpaceDark;
