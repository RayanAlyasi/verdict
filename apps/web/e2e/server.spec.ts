import { spawn } from "node:child_process";
import { expect, test } from "@playwright/test";

// About the server, not a screen: once is enough.
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "runs in the desktop project only");
});

test("an address without a language goes to the browser's preferred one", async ({ request }) => {
  for (const [acceptLanguage, location] of [
    ["ar-SA,ar;q=0.9,en;q=0.8", "/ar/practice?from=home"],
    ["en-GB,en;q=0.9", "/en/practice?from=home"],
  ] as const) {
    const response = await request.get("/practice?from=home", {
      headers: { "Accept-Language": acceptLanguage },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toBe(location);
    expect(response.headers()["vary"]).toContain("Accept-Language");
  }
});

test("health reports the web, the api, the database and storage", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({
    status: "ok",
    web: "ok",
    api: "ok",
    database: "ok",
    storage: "ok",
  });
});

// Runs the build the suite already made, on a port of its own.
function startWeb(
  port: number,
  env: NodeJS.ProcessEnv,
): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    const server = spawn("pnpm", ["exec", "next", "start", "--port", String(port)], { env });
    let output = "";
    server.stdout.on("data", (chunk) => (output += chunk));
    server.stderr.on("data", (chunk) => (output += chunk));
    const timer = setTimeout(() => server.kill(), 20_000);
    server.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ code, output });
    });
  });
}

for (const [label, value, port] of [
  ["without", undefined, 3101],
  ["with an empty", "", 3102],
] as const) {
  test(`the web stops at startup ${label} BETTER_AUTH_SECRET`, async () => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      API_URL: "http://127.0.0.1:8100",
      WEB_URL: "http://x.test",
    };
    delete env.BETTER_AUTH_SECRET;
    if (value !== undefined) env.BETTER_AUTH_SECRET = value;
    const { code, output } = await startWeb(port, env);
    expect(code, output).toBe(1);
    expect(output).toContain("BETTER_AUTH_SECRET is missing or empty");
  });
}

// Serves the build on a port of its own for `check`, then stops it, whole process group included.
async function withWeb(
  port: number,
  env: NodeJS.ProcessEnv,
  check: (base: string) => Promise<void>,
) {
  const server = spawn("pnpm", ["exec", "next", "start", "--port", String(port)], {
    env,
    detached: true,
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    await expect
      .poll(async () => (await fetch(`${base}/en`).catch(() => null))?.status, { timeout: 20_000 })
      .toBe(200);
    await check(base);
  } finally {
    process.kill(-server.pid!, "SIGTERM");
  }
}

test("the component gallery is hidden in production and when APP_ENV is unset", async () => {
  test.setTimeout(90_000);
  for (const [appEnv, status, port] of [
    ["production", 404, 3103],
    [undefined, 404, 3104],
    ["staging", 200, 3105],
  ] as const) {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      API_URL: "http://127.0.0.1:8100",
      WEB_URL: `http://127.0.0.1:${port}`,
    };
    delete env.APP_ENV;
    if (appEnv) env.APP_ENV = appEnv;
    await withWeb(port, env, async (base) => {
      for (const path of ["/en/dev/ui", "/en/dev/ui/overlays"]) {
        expect((await fetch(`${base}${path}`)).status, `${path}, APP_ENV=${appEnv}`).toBe(status);
      }
    });
  }
});
