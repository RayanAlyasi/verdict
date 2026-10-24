import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { defineConfig, globalIgnores } from "eslint/config";

// What components/ui may not import: anything under @/ but ui itself and lib/, the API client and
// its fetch, and any path with a "..", "." or empty segment, which could lead back out of ui.
const UI_FORBIDDEN =
  "^@/(?!(components/ui|lib)/)|^@/lib/api(-fetch)?([/.]|$)|(^|/)\\.\\.(/|$)|/\\.(/|$)|//";
const UI_MESSAGE =
  "components/ui holds shared building blocks: no pages, feature components or API calls. Reach other ui folders through @/components/ui/.";

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
        { patterns: [{ regex: UI_FORBIDDEN, message: UI_MESSAGE }] },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: `ImportExpression[source.value=/${UI_FORBIDDEN.replaceAll("/", "\\/")}/]`,
          message: UI_MESSAGE,
        },
        {
          selector: "ImportExpression[source.type!='Literal']",
          message: "In components/ui, import() takes a plain string, so the boundary can check it.",
        },
      ],
    },
  },
]);
