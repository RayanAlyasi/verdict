import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { themeCss } from "../scripts/tokens.mjs";

const tokens = JSON.parse(
  readFileSync(new URL("../../../docs/brand/tokens.json", import.meta.url), "utf8"),
);
const css: string = themeCss(tokens);

test("every token becomes a theme variable", () => {
  const expected = [
    ...Object.entries(tokens.color.dark).map(([name, value]) => `--color-${name}: ${value};`),
    ...Object.entries(tokens.color.light).map(
      ([name, value]) => `--color-light-${name}: ${value};`,
    ),
    ...Object.entries(tokens.radius).map(([name, value]) => `--radius-${name}: ${value};`),
    ...Object.entries(tokens.spacing).map(([name, value]) => `--spacing-${name}: ${value};`),
    `--spacing-touch-target: ${tokens["touch-target-min"]};`,
    `--ease-standard: ${tokens.motion.easing};`,
    `--motion-fast: ${tokens.motion.fast};`,
    `--font-sans: ${tokens.type.family};`,
    `--text-body: ${tokens.type.styles.body.size};`,
    `--text-body--line-height: ${tokens.type.styles.body.lineHeight};`,
  ];
  for (const line of expected) expect(css).toContain(line);
});

test("the committed theme matches the tokens", () => {
  expect(readFileSync(new URL("../app/theme.css", import.meta.url), "utf8")).toBe(css);
});
