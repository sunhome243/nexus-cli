import { NexusTheme } from "../../themes/NexusTheme.js";
import { ProviderType } from "../../abstractions/providers/types.js";

export interface ColorUtils {
  getTierColor: (tier: "safe" | "cautious" | "dangerous", theme: NexusTheme, permissionMode?: string) => string;
  getProviderColor: (provider: ProviderType, theme: NexusTheme) => string;
  getStatusColor: (status: "success" | "warning" | "danger" | "info", theme: NexusTheme) => string;
}

export const colorUtils: ColorUtils = {
  getTierColor: (tier: "safe" | "cautious" | "dangerous", theme: NexusTheme, permissionMode?: string) => {
    const baseColors = {
      safe: theme.status.success,
      cautious: theme.status.warning,
      dangerous: theme.status.danger,
    };

    // In plan mode, make everything more cautious
    if (permissionMode === "plan") {
      return tier === "safe" ? theme.status.success : theme.status.danger;
    }

    return baseColors[tier];
  },

  getProviderColor: (provider: ProviderType, theme: NexusTheme) => {
    return provider === ProviderType.GEMINI ? theme.gemini.primary : theme.claude.primary;
  },

  getStatusColor: (status: "success" | "warning" | "danger" | "info", theme: NexusTheme) => {
    return theme.status[status];
  },
};

export const formatUtils = {
  formatTimestamp: (date?: Date): string => {
    return (date || new Date()).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  },

  truncatePath: (path: string, maxLength: number = 60): string => {
    if (!path || path.length <= maxLength) return path;
    const parts = path.split("/");
    if (parts.length <= 2) return path;

    // Show first and last parts with ... in between
    const first = parts.slice(0, 2).join("/");
    const last = parts[parts.length - 1];
    return `${first}/.../${last}`;
  },

  formatPath: (path: string): string => {
    if (path.startsWith("/Users/")) {
      return path.replace("/Users/", "~/").replace(/^~\/[^/]+/, "~");
    }
    return path;
  },

  // New utility for smart content truncation
  truncateContent: (content: string, maxLength: number = 100): string => {
    if (!content || content.length <= maxLength) return content;

    // Try to break at word boundaries
    const truncated = content.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");

    if (lastSpace > maxLength * 0.7) {
      return truncated.substring(0, lastSpace) + "...";
    }

    return truncated + "...";
  },

  // New utility for creating visual separators
  createSeparator: (length: number = 50, char: string = "─"): string => {
    return char.repeat(Math.max(1, length));
  },

  // New utility for formatting file sizes
  formatFileSize: (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  },

  // New utility for smart line counting display
  formatLineCount: (count: number): string => {
    if (count === 1) return "1 line";
    if (count < 1000) return `${count} lines`;
    return `${(count / 1000).toFixed(1)}k lines`;
  },

  // New utility for smart path display in permission prompts
  formatPermissionPath: (path: string): string => {
    if (!path) return "";

    // For permission prompts, show more context
    if (path.startsWith("/Users/")) {
      const userPart = path.match(/^\/Users\/([^\/]+)/);
      if (userPart) {
        const username = userPart[1];
        const rest = path.substring(`/Users/${username}`.length);

        // Show home directory as ~ and truncate intelligently
        if (rest.startsWith("/Desktop") || rest.startsWith("/Documents") || rest.startsWith("/Downloads")) {
          const parts = rest.split("/").filter(Boolean);
          if (parts.length > 3) {
            return `~/${parts[0]}/.../${parts[parts.length - 1]}`;
          }
          return `~${rest}`;
        }

        return `~${rest}`;
      }
    }

    return formatUtils.truncatePath(path, 70);
  },
};

export const labelUtils = {
  getTierLabel: (tier: "safe" | "cautious" | "dangerous"): string => {
    const labels = {
      safe: "SAFE",
      cautious: "CAUTIOUS",
      dangerous: "DANGEROUS",
    };
    return labels[tier] || "UNKNOWN";
  },

  getPermissionModeLabel: (mode: string): string => {
    const labels = {
      plan: "PLAN",
      default: "DEFAULT",
      acceptEdits: "ACCEPT-EDITS",
      bypassPermissions: "BYPASS",
    };
    return labels[mode as keyof typeof labels] || mode.toUpperCase();
  },
};
