import { ESLint } from "eslint";
import { expect, test } from "vitest";

const eslint = new ESLint({ cwd: new URL("..", import.meta.url).pathname });

async function restrictedImports(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter((message) => message.ruleId === "no-restricted-imports");
}

test("components/ui can't import pages, feature components or the API client", async () => {
  for (const source of [
    "@/app/page",
    "@/components/practice/Session",
    "@/lib/api/client",
    "../app/page",
  ]) {
    const code = `import thing from "${source}";\nexport const used = thing;\n`;
    expect(await restrictedImports(code, "components/ui/Example.tsx"), source).toHaveLength(1);
  }
});

test("components/ui can import its own pieces, and features can import ui", async () => {
  const code = 'import { Button } from "@/components/ui/Button";\nexport const used = Button;\n';
  expect(await restrictedImports(code, "components/ui/Example.tsx")).toEqual([]);
  expect(await restrictedImports(code, "components/practice/Session.tsx")).toEqual([]);
});
