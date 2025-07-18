import React from "react";
import { render, RenderOptions } from "@testing-library/react";
import { container } from "../../infrastructure/di/container";
import { TYPES } from "../../infrastructure/di/types.js";
import { PermissionProvider } from "../../components/providers/claude/PermissionContext";
import { ThemeProvider } from "../../components/shared/ThemeProvider";

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider>
      <PermissionProvider>
        <div>{children}</div>
      </PermissionProvider>
    </ThemeProvider>
  );
};

const customRender = (ui: React.ReactElement, options?: Omit<RenderOptions, "wrapper">) =>
  render(ui, { wrapper: AllTheProviders, ...options });

export * from "@testing-library/react";
export { customRender as render };