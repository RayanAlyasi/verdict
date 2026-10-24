// pnpm --dir apps/web contract: export the api's OpenAPI schema and regenerate the client in lib/api.
// With --check (CI's contract job), it fails if that changes anything, so the committed client always
// matches the api.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const api = new URL("../lib/api/", import.meta.url);
mkdirSync(api, { recursive: true });
const schema = execFileSync(
  "uv",
  ["run", "--directory", "../../services/api", "python", "-m", "verdict.openapi"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);
writeFileSync(new URL("openapi.json", api), schema);
execFileSync("pnpm", ["exec", "orval"], { stdio: "inherit" });

if (process.argv.includes("--check")) {
  const changed = execFileSync("git", ["status", "--porcelain", "--", "lib/api"], {
    encoding: "utf8",
  });
  if (changed) {
    console.error(
      `The generated API client is out of date. Run pnpm --dir apps/web contract and commit:\n${changed}`,
    );
    process.exit(1);
  }
}
