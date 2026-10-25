import path from "node:path";
// A CommonJS package, which Playwright loads as Node does: no named imports.
import nextEnv from "@next/env";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const API_PORT = 8100;

// Locally, the repository's .env, as pnpm dev uses it; CI sets the environment itself.
nextEnv.loadEnvConfig(path.resolve(import.meta.dirname, "../.."));
const environment = (overrides: Record<string, string>) =>
  ({ ...process.env, ...overrides }) as Record<string, string>;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  projects: [
    {
      name: "phone",
      testIgnore: /screens\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "desktop",
      testIgnore: /screens\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "screens",
      testMatch: /screens\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Ports of their own, so a running pnpm dev doesn't stand in for the servers under test.
  webServer: [
    {
      command: `uv run --directory ../../services/api uvicorn verdict.main:app --host 127.0.0.1 --port ${API_PORT}`,
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // A production build: the JavaScript budget means nothing against development bundles.
      command: `pnpm build && pnpm start --port ${PORT}`,
      url: `http://127.0.0.1:${PORT}/en`,
      env: environment({
        API_URL: `http://127.0.0.1:${API_PORT}`,
        WEB_URL: `http://127.0.0.1:${PORT}`,
      }),
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
});
