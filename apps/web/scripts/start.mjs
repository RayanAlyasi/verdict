// pnpm start: the server the image runs (apps/web/Dockerfile), from the last pnpm build. The
// standalone build leaves its static files out, as the Dockerfile copies them in; this does too.
import { spawn } from "node:child_process";
import { cpSync } from "node:fs";

const flag = process.argv.indexOf("--port");
const port = flag === -1 ? "3000" : process.argv[flag + 1];
const standalone = new URL("../.next/standalone/", import.meta.url);
cpSync(
  new URL("../.next/static/", import.meta.url),
  new URL("apps/web/.next/static/", standalone),
  {
    recursive: true,
  },
);
const server = spawn(process.execPath, ["apps/web/server.js"], {
  cwd: standalone,
  // All interfaces, as next start did: the standalone server binds to $HOSTNAME, which some
  // systems and dev containers set to the machine's name.
  env: { ...process.env, PORT: port, HOSTNAME: "0.0.0.0" },
  stdio: "inherit",
});
server.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
