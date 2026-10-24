import { defineConfig } from "orval";

export default defineConfig({
  api: {
    input: { target: "./lib/api/openapi.json" },
    output: {
      target: "./lib/api/client.ts",
      client: "fetch",
      mode: "single",
      override: { mutator: { path: "./lib/api-fetch.ts", name: "apiFetch" } },
    },
  },
});
