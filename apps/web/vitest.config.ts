import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          include: ["**/*.node.test.ts"],
          exclude: ["node_modules/**"],
        },
      },
      {
        test: {
          name: "browser",
          include: ["**/*.browser.test.{ts,tsx}"],
          exclude: ["node_modules/**"],
          // Real Chromium, so hover, focus-visible and layout behave as they do for students.
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
