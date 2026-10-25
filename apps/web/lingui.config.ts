import { defineConfig } from "@lingui/cli";
import { formatter } from "@lingui/format-po";
import { LOCALES } from "./lib/locales";

export default defineConfig({
  sourceLocale: "en",
  locales: [...LOCALES],
  catalogs: [
    {
      path: "<rootDir>/locales/{locale}",
      include: ["<rootDir>/app", "<rootDir>/components", "<rootDir>/lib"],
    },
  ],
  // Without line numbers, moving code doesn't rewrite every catalog.
  format: formatter({ lineNumbers: false }),
});
