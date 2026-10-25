import { gzipSync } from "node:zlib";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { direction } from "../lib/locales";
import { LOCALES, localized, ROUTES } from "./routes";

// docs/UX-GUIDELINES.md: under 200 KB of compressed JavaScript per route.
const JAVASCRIPT_BUDGET_BYTES = 200 * 1024;

// What changes when Arabic mirrors the layout, read from the browser's own parsed CSS. Shorthands
// arrive as longhands, so margin: 0 8px 0 0 shows as margin-right differing from margin-left, while
// margin: 4px or margin-inline passes. Transforms, positions (the build turns origin-left into
// transform-origin: 0) and directional icons can't be told apart this way; the Arabic screenshots
// show them.
function physicalSides() {
  const pairs = [
    ["left", "right"],
    ...["margin", "padding", "scroll-margin", "scroll-padding"].map((p) => [
      `${p}-left`,
      `${p}-right`,
    ]),
    ...["width", "style", "color"].map((p) => [`border-left-${p}`, `border-right-${p}`]),
    ["border-top-left-radius", "border-top-right-radius"],
    ["border-bottom-left-radius", "border-bottom-right-radius"],
  ];
  const sided = [
    "text-align",
    "float",
    "clear",
    "justify-content",
    "justify-items",
    "justify-self",
  ];
  const problems: string[] = [];
  const check = (where: string, style: CSSStyleDeclaration) => {
    for (const [left = "", right = ""] of pairs) {
      const [a, b] = [style.getPropertyValue(left), style.getPropertyValue(right)];
      if (a !== b)
        problems.push(`${where} { ${left}: ${a || "unset"}; ${right}: ${b || "unset"} }`);
    }
    for (const name of sided) {
      const value = style.getPropertyValue(name);
      if (/\b(left|right)\b/.test(value)) problems.push(`${where} { ${name}: ${value} }`);
    }
  };
  const walk = (rules: CSSRuleList) => {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) check(rule.selectorText, rule.style);
      if (rule instanceof CSSKeyframeRule) check(`@keyframes ${rule.keyText}`, rule.style);
      if ("cssRules" in rule) walk(rule.cssRules as CSSRuleList);
    }
  };
  for (const sheet of document.styleSheets) walk(sheet.cssRules);
  for (const element of document.querySelectorAll<HTMLElement>("[style]")) {
    check(`<${element.localName} style>`, element.style);
  }
  return problems;
}

async function open(page: Page, path: string, status: number) {
  const response = await page.goto(path);
  expect(response?.status(), `${path} answered`).toBe(status);
}

for (const route of ROUTES) {
  for (const locale of LOCALES) {
    const path = localized(locale, route.path);

    test.describe(`${route.name} (${locale})`, () => {
      test("stays within the JavaScript budget", async ({ page }) => {
        const sizes: Promise<number>[] = [];
        page.on("response", (response) => {
          if (response.request().resourceType() === "script" && response.ok()) {
            sizes.push(response.body().then((body) => gzipSync(body).length));
          }
        });
        await open(page, path, route.status);
        // After load as well: lazy scripts and dynamic chunks count against the route.
        await page.waitForLoadState("networkidle");
        const total = (await Promise.all(sizes)).reduce((sum, size) => sum + size, 0);
        expect(
          total,
          `${path} loads ${(total / 1024).toFixed(1)} KB of compressed JavaScript`,
        ).toBeLessThanOrEqual(JAVASCRIPT_BUDGET_BYTES);
      });

      test("fits a 360px screen without sideways scrolling", async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== "phone", "a phone-width check");
        await page.setViewportSize({ width: 360, height: 640 });
        await open(page, path, route.status);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, "pixels wider than the screen").toBe(0);
      });

      test("has no serious or critical accessibility problems", async ({ page }) => {
        await open(page, path, route.status);
        const { violations } = await new AxeBuilder({ page }).analyze();
        const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      });

      test("declares its language and direction, and links its translations", async ({ page }) => {
        await open(page, path, route.status);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("html")).toHaveAttribute("dir", direction(locale));
        const alternates = await page
          .locator('link[rel="alternate"][hreflang]')
          .evaluateAll((links) => links.map((link) => link.getAttribute("hreflang")));
        // A missing page has no translations to point to.
        const expected = route.status === 200 ? [...LOCALES, "x-default"] : [];
        expect(alternates.sort()).toEqual(expected.sort());
      });

      test("lays out with logical properties only", async ({ page }) => {
        await open(page, path, route.status);
        expect(await page.evaluate(physicalSides)).toEqual([]);
      });

      test("downloads only Readex Pro's Latin and Arabic files", async ({ page }) => {
        const fonts: string[] = [];
        page.on("response", (response) => {
          if (response.request().resourceType() === "font") fonts.push(response.url());
        });
        await open(page, path, route.status);
        await page.waitForLoadState("networkidle");
        await page.evaluate(() => document.fonts.ready);
        // Both are preloaded on every page; the other scripts' files load only for text that uses them.
        expect(fonts, "font files").toHaveLength(2);
        const loaded = await page.evaluate(() =>
          [...document.fonts]
            .filter((font) => font.status === "loaded")
            .map((font) => `${font.family} ${font.unicodeRange}`),
        );
        expect(loaded.length, loaded.join("\n")).toBeGreaterThan(0);
        for (const face of loaded) expect(face).toMatch(/^"?Readex Pro"? U\+(0-FF|600-6FF)\b/);
      });
    });
  }
}
