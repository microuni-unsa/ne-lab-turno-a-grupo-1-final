import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  tsconfig: "./tsconfig.tests.json",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
  webServer: {
    command:
      "bun run build && bunx vite preview --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL:
        process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54321",
      VITE_SUPABASE_PUBLISHABLE_KEY:
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "e2e-mock-publishable-key",
    },
  },
});
