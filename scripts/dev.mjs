// pnpm dev: the web app (port 3000) and the api (port 8000) together, both reading the root .env.
// Ctrl+C stops both, and so does either one exiting.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline";

if (!existsSync(".env")) {
  console.error("No .env: copy .env.example to .env and fill in the values marked required.");
  process.exit(1);
}

const services = [
  {
    name: "web",
    color: 36,
    command: "pnpm",
    args: ["--dir", "apps/web", "dev"],
  },
  {
    name: "api",
    color: 35,
    command: "uv",
    args: [
      "run",
      "--directory",
      "services/api",
      "--env-file",
      "../../.env",
      "uvicorn",
      "verdict.main:app",
      "--reload",
      "--port",
      "8000",
    ],
  },
];

const children = services.map(({ name, color, command, args }) => {
  const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
  const label = `\x1b[${color}m${name}\x1b[0m`;
  for (const stream of [child.stdout, child.stderr]) {
    createInterface({ input: stream }).on("line", (line) => console.log(`${label} | ${line}`));
  }
  child.on("error", (error) => {
    console.error(
      `${label} | can't start ${command}: ${error.message}. See the requirements in README.md.`,
    );
    stop(1);
  });
  child.on("exit", (code) => {
    console.log(`${label} | exited with code ${code ?? "signal"}`);
    stop(code ?? 1);
  });
  return child;
});

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
