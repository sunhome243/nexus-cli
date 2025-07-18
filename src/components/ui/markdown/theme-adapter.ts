/**
 * Theme adapter for markdown components
 * Provides integration between gemini-cli's theme system and Nexus's theme
 */
import { defaultNexusTheme } from "../../../themes/NexusTheme.js";

export interface Theme {
  colors: {
    Gray: string;
  };
  defaultColor: string;
  getInkColor: (className: string) => string | undefined;
}

// Create a markdown theme that maps syntax highlighting classes to Nexus theme colors
const createMarkdownTheme = (): Theme => {
  return {
    colors: {
      Gray: defaultNexusTheme.text.muted,
    },
    defaultColor: defaultNexusTheme.text.primary,
    getInkColor: (className: string) => {
      // Map lowlight/highlight.js classes to Nexus theme colors
      const colorMap: Record<string, string> = {
        // Keywords (if, else, function, return, etc.)
        "hljs-keyword": defaultNexusTheme.syntax.code,
        "hljs-built_in": defaultNexusTheme.syntax.code,

        // Strings
        "hljs-string": defaultNexusTheme.status.success,
        "hljs-regexp": defaultNexusTheme.status.success,

        // Numbers and literals
        "hljs-number": defaultNexusTheme.status.info,
        "hljs-literal": defaultNexusTheme.status.info,

        // Comments
        "hljs-comment": defaultNexusTheme.text.muted,
        "hljs-doctag": defaultNexusTheme.text.muted,

        // Functions and methods
        "hljs-function": defaultNexusTheme.gemini.primary,
        "hljs-title": defaultNexusTheme.syntax.heading,
        "hljs-title.function": defaultNexusTheme.gemini.primary,
        "hljs-title.class": defaultNexusTheme.syntax.heading,

        // Variables and properties
        "hljs-variable": defaultNexusTheme.text.secondary,
        "hljs-property": defaultNexusTheme.text.secondary,
        "hljs-attr": defaultNexusTheme.text.secondary,
        "hljs-attribute": defaultNexusTheme.status.warning,
        "hljs-params": defaultNexusTheme.text.secondary,

        // Types
        "hljs-type": defaultNexusTheme.gemini.accent,
        "hljs-class": defaultNexusTheme.gemini.accent,

        // Tags (HTML/XML)
        "hljs-tag": defaultNexusTheme.syntax.code,
        "hljs-name": defaultNexusTheme.syntax.code,
        "hljs-selector-tag": defaultNexusTheme.syntax.code,
        "hljs-selector-class": defaultNexusTheme.status.success,
        "hljs-selector-id": defaultNexusTheme.status.info,

        // Meta
        "hljs-meta": defaultNexusTheme.text.muted,
        "hljs-meta-keyword": defaultNexusTheme.syntax.code,
        "hljs-meta-string": defaultNexusTheme.status.success,

        // Other
        "hljs-symbol": defaultNexusTheme.status.warning,
        "hljs-bullet": defaultNexusTheme.text.muted,
        "hljs-link": defaultNexusTheme.syntax.link,
        "hljs-emphasis": defaultNexusTheme.text.secondary,
        "hljs-strong": defaultNexusTheme.text.primary,
      };

      return colorMap[className];
    },
  };
};

// Export a singleton theme manager
export const themeManager = {
  getActiveTheme: () => createMarkdownTheme(),
};
