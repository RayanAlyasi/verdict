import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The @/ imports, as in tsconfig.json.
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          include: ["**/*.node.test.ts"],
          exclude: ["node_modules/**"],
        },
      },
      {
        extends: true,
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
