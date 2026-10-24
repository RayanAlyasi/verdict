import { health as apiHealth } from "@/lib/api/client";

type Status = "ok" | "unavailable" | "unknown";

// The smoke test and the uptime checks call this. The api reports the database and storage.
export async function GET() {
  let api: Status = "unavailable";
  let database: Status = "unknown";
  let storage: Status = "unknown";
  try {
    const response = await apiHealth({ signal: AbortSignal.timeout(5000) });
    // Typed as the api's own answers, but a proxy in between can answer anything.
    const answer: number = response.status;
    // A 503 still carries the api's report of what is down.
    if (answer === 200 || answer === 503) {
      ({ database, storage } = response.data);
      api = "ok";
    } else {
      console.warn(`Health check: the api answered ${answer}`);
    }
  } catch (error) {
    console.warn("Health check: the api is unreachable", error);
  }
  const status = api === "ok" && database === "ok" && storage === "ok" ? "ok" : "unavailable";
  return Response.json(
    {
      status,
      web: "ok",
      api,
      database,
      storage,
      // Set by the image build and the deploy; null in development.
      version: process.env.APP_VERSION || null,
      commit: process.env.APP_COMMIT || null,
    },
    { status: status === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
