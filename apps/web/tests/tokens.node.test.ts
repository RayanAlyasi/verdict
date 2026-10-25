import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { compile } from "tailwindcss";
import { expect, test } from "vitest";
import { themeCss } from "../scripts/tokens.mjs";

const tokens = JSON.parse(
  readFileSync(new URL("../../../docs/brand/tokens.json", import.meta.url), "utf8"),
);
const css: string = themeCss(tokens);

async function classesFor(candidates: string[]): Promise<string> {
  const tailwind = path.dirname(createRequire(import.meta.url).resolve("tailwindcss/package.json"));
  const compiler = await compile(`@import "tailwindcss";\n${css}`, {
    loadStylesheet: async (id: string, base: string) => ({
      content: readFileSync(path.join(tailwind, "index.css"), "utf8"),
      base,
      path: id,
    }),
  });
  return compiler.build(candidates);
}

test("every token becomes a theme variable", () => {
  const expected = [
    ...Object.entries(tokens.color.dark).map(([name, value]) => `--color-${name}: ${value};`),
    ...Object.entries(tokens.color.light).map(
      ([name, value]) => `--color-light-${name}: ${value};`,
    ),
    ...Object.entries(tokens.radius).map(([name, value]) => `--radius-${name}: ${value};`),
    ...Object.entries(tokens.shadow).map(([name, value]) => `--shadow-${name}: ${value};`),
    ...Object.entries(tokens.background).map(
      ([name, value]) => `--background-image-${name}: ${value};`,
    ),
    `--spacing: ${tokens.spacing["space-1"]};`,
    `--spacing-touch-target: ${tokens["touch-target-min"]};`,
    `--ease-standard: ${tokens.motion.easing};`,
    `--transition-duration-fast: ${tokens.motion.fast};`,
    `--default-transition-duration: ${tokens.motion.base};`,
    `--font-sans: ${tokens.type.family.replace('"Readex Pro"', "var(--font-readex-pro)")};`,
    `--text-body: ${tokens.type.styles.body.size};`,
    `--text-body--line-height: ${tokens.type.styles.body.lineHeight};`,
  ];
  for (const line of expected) expect(css).toContain(line);
});

test("brand classes exist and Tailwind's stock ones don't", async () => {
  const brand = [
    "bg-space-900",
    "text-caption",
    "rounded-lg",
    "shadow-glow-primary",
    "bg-nebula",
    "bg-space-background",
    "duration-fast",
    "ease-standard",
    "min-h-touch-target",
    "p-6",
  ];
  const stock = ["bg-red-500", "text-sm", "rounded-2xl", "shadow-md", "ease-in"];
  const built = await classesFor([...brand, ...stock]);
  for (const name of brand) expect(built, name).toContain(`.${name} {`);
  for (const name of stock) expect(built, name).not.toContain(`.${name} {`);
  // The spacing base makes the numeric classes the brand scale: space-5 (24px) is p-6.
  expect(Number.parseInt(tokens.spacing["space-5"], 10)).toBe(
    6 * Number.parseInt(tokens.spacing["space-1"], 10),
  );
});

test("the committed theme matches the tokens", () => {
  expect(readFileSync(new URL("../app/theme.css", import.meta.url), "utf8")).toBe(css);
});
