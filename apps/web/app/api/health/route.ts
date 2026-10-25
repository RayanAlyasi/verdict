import { health as apiHealth } from "@/lib/api/client";

type Status = "ok" | "unavailable" | "unknown";

const isReport = (value: unknown): value is "ok" | "unavailable" =>
  value === "ok" || value === "unavailable";

// The smoke test and the uptime checks call this. The api reports the database and storage.
export async function GET() {
  let api: Status = "unavailable";
  let database: Status = "unknown";
  let storage: Status = "unknown";
  try {
    // Longer than the api's 3-second database connect timeout, so a database outage is reported
    // as one, and shorter than the smoke test's 5 seconds.
    const { status, data } = await apiHealth({ signal: AbortSignal.timeout(4000) });
    // Only the api's own report counts: a proxy in between can answer 503 with an error page.
    const report: unknown = data;
    if (
      (status === 200 || status === 503) &&
      typeof report === "object" &&
      report !== null &&
      "database" in report &&
      "storage" in report &&
      isReport(report.database) &&
      isReport(report.storage)
    ) {
      ({ database, storage } = report);
      api = "ok";
    } else {
      console.warn(`Health check: the api answered ${status} without its report`);
    }
  } catch (error) {
    console.warn(`Health check: the api is unreachable (${String(error)})`);
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
