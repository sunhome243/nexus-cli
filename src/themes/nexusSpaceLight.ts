import { NexusTheme } from "./NexusTheme.js";

// Nexus Space Light Theme - Clean light terminal theme
export const nexusSpaceLight: NexusTheme = {
  text: {
    primary: "#2A2A2A", // Dark Surface - main text
    secondary: "#555555", // Dark Gray - secondary text
    muted: "#8A8A8A", // Muted Gray - muted text
  },

  interaction: {
    primary: "#708CA9", // Soft Blue Gray - primary interactions
    secondary: "#B8B8B8", // Medium Gray - secondary interactions
  },

  status: {
    success: "#388E3C", // Darker Green for light theme
    warning: "#F57C00", // Darker Orange for light theme
    danger: "#D32F2F", // Darker Red for light theme
    info: "#1976D2", // Darker Blue for light theme
  },

  border: {
    default: "#B8B8B8", // Medium Gray - default borders
    subtle: "#D0D0D0", // Light Gray - subtle borders
    accent: "#007ACC", // Electric Blue - accent borders
    separator: "#C0C0C0", // Light Gray - separators
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
    dangerous: "#D32F2F", // Darker Red - dangerous operations
    moderate: "#007ACC", // Electric Blue - moderate operations
    safe: "#388E3C", // Darker Green - safe operations
    neutral: "#8A8A8A", // Muted Gray - neutral/default
  },

  todo: {
    completed: "#8A8A8A", // Muted Gray for completed todos
    inProgress: "#388E3C", // Darker Green for active todos
    pending: "#555555", // Dark Gray for pending todos
    background: "#F5F5F5", // Light Surface for todo items
  },

  syntax: {
    code: "#388E3C", // Darker Green for code blocks
    codeBackground: "#007ACC", // Electric Blue background for code highlights
    language: "#F57C00", // Darker Orange for language labels
    heading: "#C2185B", // Darker Pink for headings
    link: "#0097A7", // Darker Cyan for links
    error: "#D32F2F", // Darker Red for errors
  },
};

export default nexusSpaceLight;
