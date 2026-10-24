import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// One .env for the whole repository, at its root (see .env.example).
loadEnvConfig(path.resolve(import.meta.dirname, "../.."));

const config: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
};

export default config;
