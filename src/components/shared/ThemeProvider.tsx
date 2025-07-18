import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { NexusTheme, defaultNexusTheme } from "../../themes/NexusTheme.js";
import { nexusSpaceDark } from "../../themes/nexusSpaceDark.js";
import { nexusSpaceLight } from "../../themes/nexusSpaceLight.js";

export type ThemeMode = "dark" | "light";

interface ThemeContextValue {
  theme: NexusTheme;
  themeMode: ThemeMode;
  setTheme: (theme: NexusTheme) => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: NexusTheme;
  initialMode?: ThemeMode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, initialTheme, initialMode = "dark" }) => {
  // Load theme mode from localStorage or use initialMode
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nexus-theme-mode");
      return (saved as ThemeMode) || initialMode;
    }
    return initialMode;
  });

  // Get actual theme object based on mode
  const getThemeForMode = (mode: ThemeMode): NexusTheme => {
    switch (mode) {
      case "light":
        return nexusSpaceLight;
      case "dark":
      default:
        return nexusSpaceDark;
    }
  };

  const [theme, setTheme] = useState<NexusTheme>(initialTheme || getThemeForMode(themeMode));

  // Update theme when mode changes
  useEffect(() => {
    if (!initialTheme) {
      setTheme(getThemeForMode(themeMode));
    }
  }, [themeMode, initialTheme]);

  // Save theme mode to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nexus-theme-mode", themeMode);
    }
  }, [themeMode]);

  const toggleTheme = () => {
    const newMode = themeMode === "dark" ? "light" : "dark";
    setThemeMode(newMode);
  };

  const handleSetThemeMode = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  const contextValue: ThemeContextValue = {
    theme,
    themeMode,
    setTheme,
    setThemeMode: handleSetThemeMode,
    toggleTheme,
  };

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
