import { gzipSync } from "node:zlib";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { direction } from "../lib/locales";
import { LOCALES, localized, ROUTES } from "./routes";

// docs/UX-GUIDELINES.md: under 170 KB of compressed JavaScript per route.
const JAVASCRIPT_BUDGET_BYTES = 170 * 1024;

// Physical sides (margin-left, left, text-align: right...) stay put when Arabic mirrors the layout.
const PHYSICAL =
  /(^|[\s;{])((margin|padding|border|scroll-margin|scroll-padding)-(left|right)[a-z-]*|left|right|border-(top|bottom)-(left|right)-radius)\s*:|(text-align|float|clear)\s*:\s*(left|right)\b/;

async function open(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status(), `${path} answered`).toBeLessThan(400);
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
        await open(page, path);
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
        await open(page, path);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, "pixels wider than the screen").toBe(0);
      });

      test("has no serious or critical accessibility problems", async ({ page }) => {
        await open(page, path);
        const { violations } = await new AxeBuilder({ page }).analyze();
        const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      });

      test("declares its language and direction, and links its translations", async ({ page }) => {
        await open(page, path);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("html")).toHaveAttribute("dir", direction(locale));
        const alternates = await page
          .locator('link[rel="alternate"][hreflang]')
          .evaluateAll((links) => links.map((link) => link.getAttribute("hreflang")));
        expect(alternates.sort()).toEqual([...LOCALES, "x-default"].sort());
      });

      test("lays out with logical properties only", async ({ page }) => {
        await open(page, path);
        const physical = await page.evaluate((source) => {
          const pattern = new RegExp(source);
          const rules = [...document.styleSheets].flatMap((sheet) =>
            [...sheet.cssRules].map((rule) => rule.cssText),
          );
          const inline = [...document.querySelectorAll("[style]")].map(
            (element) => element.getAttribute("style") ?? "",
          );
          // Each rule on its own, not the whole @layer or @media block around it.
          return [...rules, ...inline]
            .flatMap((text) => text.split("}"))
            .filter((part) => pattern.test(part))
            .map((part) => part.trim());
        }, PHYSICAL.source);
        expect(physical).toEqual([]);
      });
    });
  }
}
