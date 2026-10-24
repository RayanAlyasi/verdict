import path from "node:path";
import { expect, test } from "@playwright/test";
import { LOCALES, localized, ROUTES } from "./routes";

// For the ui-reviewer agent, which looks for artifacts/screens/<screen>-<390|1440>-<en|ar>.png.
const SCREENS = path.resolve(import.meta.dirname, "../../../artifacts/screens");

const DEVICES = [
  {
    width: 390,
    // A phone, not a narrow desktop window: touch, no hover, and 2x pixels like the designs.
    use: {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
  },
  { width: 1440, use: { viewport: { width: 1440, height: 900 } } },
];

for (const device of DEVICES) {
  test.describe(`${device.width}px`, () => {
    test.use(device.use);

    for (const route of ROUTES) {
      for (const locale of LOCALES) {
        test(`${route.name} (${locale})`, async ({ page }) => {
          const address = localized(locale, route.path);
          const response = await page.goto(address);
          expect(response?.status(), `${address} answered`).toBeLessThan(400);
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({
            path: path.join(SCREENS, `${route.name}-${device.width}-${locale}.png`),
            fullPage: true,
            animations: "disabled",
          });
        });
      }
    }
  });
}
