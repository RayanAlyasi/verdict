import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    "lib/api/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
  {
    // Shared building blocks only: features import ui, never the other way round.
    files: ["components/ui/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // Pages, feature components (any components/ folder but ui), the API client, and
              // relative paths out of ui.
              regex: "^@/(app|lib/api)(/|$)|^@/components/(?!ui(/|$))|^\\.\\./",
              message:
                "components/ui holds shared building blocks: no pages, feature components or API calls.",
            },
          ],
        },
      ],
    },
  },
]);
