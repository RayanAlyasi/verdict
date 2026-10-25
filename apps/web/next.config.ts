import path from "node:path";
import { linguiMacroSwcPlugin } from "@lingui/swc-plugin/options";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function config(phase: string): NextConfig {
  // One .env for the whole repository, at its root (see .env.example). Only for next dev: a
  // production server reads its environment alone, as when deployed. Forced, because Next.js has
  // already looked for env files in apps/web, and would otherwise return that cached result.
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    loadEnvConfig(path.resolve(import.meta.dirname, "../.."), true, console, true);
  }
  return {
    reactCompiler: true,
    poweredByHeader: false,
    // A self-contained server for the image (apps/web/Dockerfile). Traced from the repository root,
    // because pnpm keeps the packages there.
    output: "standalone",
    outputFileTracingRoot: path.resolve(import.meta.dirname, "../.."),
    experimental: { swcPlugins: [linguiMacroSwcPlugin()] },
    turbopack: {
      rules: {
        "*.po": {
          loaders: [
            // The build fails on an untranslated Arabic message or a broken one.
            {
              loader: "@lingui/loader",
              options: { failOnMissing: "catalog", failOnCompileError: true },
            },
          ],
          as: "*.js",
        },
      },
    },
  };
}
