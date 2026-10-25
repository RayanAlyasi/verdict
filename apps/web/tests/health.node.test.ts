import { afterEach, expect, test, vi } from "vitest";
import { GET } from "../app/api/health/route";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function api(answer: () => Response) {
  vi.stubEnv("API_URL", "http://api.test");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => answer()),
  );
}

const json = (body: object, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("all well: 200 with the running version and commit", async () => {
  vi.stubEnv("APP_VERSION", "v0.4.0");
  vi.stubEnv("APP_COMMIT", "abc123");
  api(() => json({ status: "ok", database: "ok", storage: "ok" }, 200));
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({
    status: "ok",
    web: "ok",
    api: "ok",
    database: "ok",
    storage: "ok",
    version: "v0.4.0",
    commit: "abc123",
  });
});

test("the api's own 503 says which part is down", async () => {
  api(() => json({ status: "unavailable", database: "ok", storage: "unavailable" }, 503));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({
    status: "unavailable",
    api: "ok",
    database: "ok",
    storage: "unavailable",
    version: null,
    commit: null,
  });
});

test.each([
  ["a proxy's error page", () => new Response("<html>Bad gateway</html>", { status: 502 })],
  ["a proxy's 503 page", () => new Response("<html>Down for maintenance</html>", { status: 503 })],
  ["a 503 that isn't the api's report", () => json({ detail: "Service unavailable" }, 503)],
  [
    "no answer",
    () => {
      throw new TypeError("fetch failed");
    },
  ],
])("%s: the api is unavailable and the rest unknown", async (_, answer) => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  api(answer);
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({
    status: "unavailable",
    web: "ok",
    api: "unavailable",
    database: "unknown",
    storage: "unknown",
  });
});
