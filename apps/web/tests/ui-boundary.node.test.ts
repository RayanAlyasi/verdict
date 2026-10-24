import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { expect, test } from "vitest";

const eslint = new ESLint({ cwd: fileURLToPath(new URL("..", import.meta.url)) });

async function boundaryErrors(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter((message) =>
    ["no-restricted-imports", "no-restricted-syntax"].includes(message.ruleId ?? ""),
  );
}

const importing = (source: string) =>
  `import thing from "${source}";\nexport const used = thing;\n`;

test("components/ui can't reach pages, feature components or the API", async () => {
  const forbidden = [
    "@/app/page",
    "@/components/practice/Session",
    "@/lib/api/client",
    "@/lib/api-fetch",
    // Ways round the rule through ".", ".." and empty path segments.
    "../app/page",
    "./../../app/page",
    "@/./app/page",
    "@//app/page",
    "@/components/ui/../practice/Session",
    "@/components/ui/../../lib/api/client",
  ];
  for (const source of forbidden) {
    expect(
      await boundaryErrors(importing(source), "components/ui/Example.tsx"),
      source,
    ).toHaveLength(1);
  }
});

test("components/ui can't load feature code with a dynamic import", async () => {
  for (const source of ['"@/app/page"', "`@/app/page`", "page"]) {
    const code = `const page = "@/app/page";\nexport const load = () => import(${source});\n`;
    expect(await boundaryErrors(code, "components/ui/Example.tsx"), source).toHaveLength(1);
  }
});

test("components/ui can import its own pieces and shared helpers, and features can import ui", async () => {
  for (const source of ["@/components/ui/Button", "./Button", "@/lib/cn", "react"]) {
    expect(
      await boundaryErrors(importing(source), "components/ui/forms/Field.tsx"),
      source,
    ).toEqual([]);
  }
  const feature = await boundaryErrors(
    importing("@/components/ui/Button"),
    "components/practice/Session.tsx",
  );
  expect(feature).toEqual([]);
});
