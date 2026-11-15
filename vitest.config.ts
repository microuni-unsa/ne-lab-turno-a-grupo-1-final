import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const browserUiResolve = {
  conditions: ["browser"],
  alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
    "@lit/react": fileURLToPath(
      new URL("./node_modules/@lit/react/index.js", import.meta.url),
    ),
  },
};

const browserUiDeps = {
  inline: [/@ionic\/react/, /@stencil\/react-output-target/, /@lit\/react/],
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.unit.test.ts"],
          exclude: ["src/**/*.ui.unit.test.*"],
        },
      },
      {
        extends: true,
        resolve: browserUiResolve,
        test: {
          name: "unit-ui",
          environment: "jsdom",
          setupFiles: ["src/test/setup-dom.ts"],
          server: { deps: browserUiDeps },
          include: ["src/**/*.unit.test.tsx", "src/**/*.ui.unit.test.*"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          testTimeout: 30_000,
          hookTimeout: 30_000,
          include: ["test/integration/**/*.test.ts"],
          exclude: ["test/integration/**/*.ui.test.*"],
        },
      },
      {
        extends: true,
        resolve: browserUiResolve,
        test: {
          name: "integration-ui",
          environment: "jsdom",
          testTimeout: 30_000,
          hookTimeout: 30_000,
          setupFiles: ["src/test/setup-dom.ts"],
          server: { deps: browserUiDeps },
          include: [
            "test/integration/**/*.test.tsx",
            "test/integration/**/*.ui.test.*",
          ],
        },
      },
    ],
  },
});
