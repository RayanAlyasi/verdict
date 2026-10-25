// The settings the web server can't run without. Secrets have no default in code, so a missing one
// stops the server at startup instead of breaking a student's request later.
const REQUIRED = {
  API_URL: "the api's address, for example http://localhost:8000",
  WEB_URL: "this site's public address, for example http://localhost:3000",
  BETTER_AUTH_SECRET: "a random secret from openssl rand -base64 32",
};
const ADDRESSES = new Set(["API_URL", "WEB_URL"]);

function isAddress(value: string): boolean {
  return URL.canParse(value) && ["http:", "https:"].includes(new URL(value).protocol);
}

// Names each problem, never a value.
export function environmentProblems(env: Record<string, string | undefined>): string[] {
  return Object.entries(REQUIRED).flatMap(([name, hint]) => {
    const value = env[name]?.trim();
    if (!value) return [`${name} is missing or empty: set it to ${hint}.`];
    if (ADDRESSES.has(name) && !isAddress(value)) {
      return [`${name} isn't an http or https address: set it to ${hint}.`];
    }
    return [];
  });
}

export function checkEnvironment() {
  const problems = environmentProblems(process.env);
  if (problems.length === 0) return;
  console.error(
    [
      "The web server can't start until these settings are fixed.",
      ...problems.map((problem) => `  - ${problem}`),
      "Locally they come from .env (copy .env.example); deployed, from the environment's secrets.",
    ].join("\n"),
  );
  process.exit(1);
}
