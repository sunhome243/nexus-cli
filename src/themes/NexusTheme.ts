// Nexus Theme System - Clean terminal UI colors
export interface NexusTheme {
  // Text colors
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };

  // Interactive colors
  interaction: {
    primary: string;
    secondary: string;
  };

  // Status colors
  status: {
    success: string;
    warning: string;
    danger: string;
    info: string;
  };

  // Border colors
  border: {
    default: string;
    subtle: string;
    accent: string; // For highlighted borders
    separator: string; // For visual separators
  };

  // Provider brand colors
  claude: {
    primary: string; // Claude brand orange/gold
    secondary: string; // Secondary Claude color
    accent: string; // Accent Claude color
  };

  // Gemini brand colors
  gemini: {
    primary: string; // Gemini brand blue
    secondary: string; // Secondary Gemini color
    accent: string; // Accent Gemini color
    thoughtIndicator: string; // Light grey for ⏺
    thoughtText: string; // Light grey for thought text
  };

  // Permission mode colors
  permission: {
    dangerous: string; // Red - dangerous operations
    moderate: string; // Blue - moderate operations
    safe: string; // Green - safe operations
    neutral: string; // Grey - neutral/default
  };

  // Todo status colors
  todo: {
    completed: string; // Grey for completed todos
    inProgress: string; // Green for active todos
    pending: string; // Light grey for pending todos
    background: string; // Background for todo items
  };

  // Syntax highlighting colors
  syntax: {
    code: string; // Code block text
    codeBackground: string; // Code block background
    language: string; // Language label
    heading: string; // Markdown headings
    link: string; // Links
    error: string; // Error text
  };
}

export const defaultNexusTheme: NexusTheme = {
  text: {
    primary: "#F1F3F4", // Softer white
    secondary: "#D0D7DE", // Muted but readable
    muted: "#7D8590", // Better contrast
  },

  interaction: {
    primary: "#708CA9", // Soft Blue Gray - primary interactions (You prompt)
    secondary: "#3C4043", // Neutral
  },

  status: {
    success: "#52C41A",
    warning: "#FAAD14",
    danger: "#FF4D4F",
    info: "#13C2C2",
  },

  border: {
    default: "#3A3F4B",
    subtle: "#2A2D33",
    accent: "#4285F4", // Highlighted borders
    separator: "#404040", // Visual separators
  },

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
    dangerous: "#FF4D4F", // Red - dangerous operations
    moderate: "#4285F4", // Blue - moderate operations
    safe: "#52C41A", // Green - safe operations
    neutral: "#7D8590", // Grey - neutral/default
  },

  todo: {
    completed: "#7D8590", // Grey for completed todos
    inProgress: "#52C41A", // Green for active todos
    pending: "#D0D7DE", // Light grey for pending todos
    background: "#2A2D33", // Background for todo items
  },

  syntax: {
    code: "#52C41A", // Green for code blocks
    codeBackground: "#4285F4", // Blue background for code highlights
    language: "#FAAD14", // Yellow for language labels
    heading: "#DE7356", // Orange for headings
    link: "#13C2C2", // Cyan for links
    error: "#FF4D4F", // Red for errors
  },
};

export default defaultNexusTheme;
