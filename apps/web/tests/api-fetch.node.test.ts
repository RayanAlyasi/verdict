import { afterEach, expect, test, vi } from "vitest";
import { apiFetch } from "../lib/api-fetch";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function answer(body: string, status: number, contentType: string) {
  const fetch = vi.fn(
    async () => new Response(body, { status, headers: { "content-type": contentType } }),
  );
  vi.stubGlobal("fetch", fetch);
  vi.stubEnv("API_URL", "http://api.test");
  return fetch;
}

test("a JSON answer is parsed, from the api's address", async () => {
  const fetch = answer('{"status":"ok"}', 200, "application/json");
  const result = await apiFetch<{ data: unknown; status: number }>("/health", { method: "GET" });
  expect(fetch).toHaveBeenCalledWith("http://api.test/health", { method: "GET" });
  expect(result).toMatchObject({ data: { status: "ok" }, status: 200 });
});

test("an error page that isn't JSON keeps its status", async () => {
  answer("<html>Bad gateway</html>", 502, "text/html");
  const result = await apiFetch<{ data: unknown; status: number }>("/health", { method: "GET" });
  expect(result).toMatchObject({ data: "<html>Bad gateway</html>", status: 502 });
});
