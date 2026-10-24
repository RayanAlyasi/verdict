import { gzipSync } from "node:zlib";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ROUTES } from "./routes";

// docs/UX-GUIDELINES.md: under 170 KB of compressed JavaScript per route.
const JAVASCRIPT_BUDGET_BYTES = 170 * 1024;

for (const route of ROUTES) {
  test.describe(route.name, () => {
    test("stays within the JavaScript budget", async ({ page }) => {
      const sizes: Promise<number>[] = [];
      page.on("response", (response) => {
        if (response.request().resourceType() === "script" && response.ok()) {
          sizes.push(response.body().then((body) => gzipSync(body).length));
        }
      });
      await page.goto(route.path, { waitUntil: "load" });
      const total = (await Promise.all(sizes)).reduce((sum, size) => sum + size, 0);
      expect(
        total,
        `${route.path} loads ${(total / 1024).toFixed(1)} KB of compressed JavaScript`,
      ).toBeLessThanOrEqual(JAVASCRIPT_BUDGET_BYTES);
    });

    test("has no serious or critical accessibility problems", async ({ page }) => {
      await page.goto(route.path);
      const { violations } = await new AxeBuilder({ page }).analyze();
      const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  });
}
