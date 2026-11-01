import { expect, test, vi } from "vitest";
import { environmentProblems, sourceCodeUrl } from "../lib/environment";

const SECRET = "do-not-print-me";
const VALID = {
  API_URL: "http://localhost:8000",
  WEB_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: SECRET,
};

test("a complete environment has no problems", () => {
  expect(environmentProblems(VALID)).toEqual([]);
});

test.each(Object.keys(VALID))("%s missing, empty or blank is named", (name) => {
  for (const value of [undefined, "", "  "]) {
    const problems = environmentProblems({ ...VALID, [name]: value });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(`${name} is missing or empty`);
  }
});

test.each(["API_URL", "WEB_URL"])("%s must be an http or https address", (name) => {
  for (const value of ["verdict.example", "localhost:3000", "ftp://verdict.example"]) {
    expect(environmentProblems({ ...VALID, [name]: value })).toEqual([
      expect.stringContaining(`${name} isn't an http or https address`),
    ]);
  }
  expect(environmentProblems({ ...VALID, [name]: "https://verdict.example" })).toEqual([]);
});

test("a problem never shows a value", () => {
  const problems = environmentProblems({ ...VALID, API_URL: "", WEB_URL: `${SECRET}.example` });
  expect(problems).toHaveLength(2);
  expect(problems.join("\n")).not.toContain(SECRET);
});

test("the source link defaults to this repository, and a fork can change it", () => {
  vi.stubEnv("SOURCE_CODE_URL", "");
  expect(sourceCodeUrl()).toBe("https://github.com/RayanAlyasi/verdict");
  vi.stubEnv("SOURCE_CODE_URL", "https://example.com/fork");
  expect(sourceCodeUrl()).toBe("https://example.com/fork");
  vi.unstubAllEnvs();
});
