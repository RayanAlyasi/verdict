// Runs once as the server starts, before it takes requests.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkEnvironment } = await import("./lib/environment");
    checkEnvironment();
  }
}
