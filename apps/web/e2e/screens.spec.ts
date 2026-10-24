import { test } from "@playwright/test";
import { ROUTES } from "./routes";

// For the ui-reviewer agent, which looks for artifacts/screens/<screen>-<390|1440>-<en|ar>.png.
const SIZES = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
];

for (const route of ROUTES) {
  for (const size of SIZES) {
    test(`${route.name} at ${size.width}px`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(route.path);
      await page.screenshot({
        path: `../../artifacts/screens/${route.name}-${size.width}-en.png`,
        fullPage: true,
      });
    });
  }
}
