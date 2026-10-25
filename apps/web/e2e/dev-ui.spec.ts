import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

test("in Arabic, the arrow keys move through a segmented control from right to left", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "a keyboard check");
  await page.goto("/ar/dev/ui");
  const segments = page.getByRole("radiogroup").first().getByRole("radio");
  await segments.first().focus();
  await page.keyboard.press("ArrowLeft");
  await expect(segments.nth(1)).toBeFocused();
});

const LABELS = {
  en: {
    sheet: "Change the exam date",
    toast: "Show a confirmation",
    saved: "Course saved.",
    error: "Show an error",
    failed: "We couldn't save your course.",
  },
  ar: {
    sheet: "غيّر تاريخ الامتحان",
    toast: "اعرض تأكيدًا",
    saved: "حفظنا مقررك.",
    error: "اعرض خطأً",
    failed: "لم نتمكن من حفظ مقررك.",
  },
};

// Records every CSS property any animation or transition changes, frame by frame, from now on.
async function recordMotion(page: Page) {
  await page.evaluate(() => {
    const seen = new Set<string>();
    Object.assign(window, { motionSeen: seen });
    const ignore = new Set(["offset", "computedOffset", "easing", "composite"]);
    const tick = () => {
      for (const animation of document.getAnimations()) {
        for (const frame of (animation.effect as KeyframeEffect | null)?.getKeyframes() ?? []) {
          for (const key of Object.keys(frame)) if (!ignore.has(key)) seen.add(key);
        }
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
  return () =>
    page.evaluate(() => [...(window as unknown as { motionSeen: Set<string> }).motionSeen]);
}

async function openSheet(page: Page, locale: keyof typeof LABELS) {
  await page.getByRole("button", { name: LABELS[locale].sheet }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // Settled: checks run on the sheet as it rests, not halfway through its entrance.
  await expect(page.locator("[data-entering]")).toHaveCount(0);
}

async function showToast(page: Page, locale: keyof typeof LABELS) {
  await page.getByRole("button", { name: LABELS[locale].toast }).click();
  const toast = page.getByRole("region").getByText(LABELS[locale].saved);
  await expect(toast).toBeVisible();
  await expect
    .poll(() =>
      page.getByRole("region").evaluate((region) => region.getAnimations({ subtree: true }).length),
    )
    .toBe(0);
}

for (const locale of ["en", "ar"] as const) {
  test.describe(`the gallery's overlays (${locale})`, () => {
    test("have no serious accessibility problems, open or showing", async ({ page }) => {
      await page.goto(`/${locale}/dev/ui/overlays`);
      const serious = async () =>
        (await new AxeBuilder({ page }).analyze()).violations
          .filter((v) => v.impact === "serious" || v.impact === "critical")
          .map((v) => `${v.id}: ${v.help}`);
      await openSheet(page, locale);
      expect(await serious(), "with the sheet open").toEqual([]);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
      await showToast(page, locale);
      expect(await serious(), "with a toast showing").toEqual([]);
    });

    test("move only with transform and opacity", async ({ page }) => {
      await page.goto(`/${locale}/dev/ui/overlays`);
      const moved = await recordMotion(page);
      await openSheet(page, locale);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
      await showToast(page, locale);
      const properties = await moved();
      // The sheet's slide (translate) and the toast's entrance were both seen.
      expect(properties).toContain("translate");
      for (const property of properties) {
        expect(["opacity", "transform", "translate", "scale", "rotate"]).toContain(property);
      }
    });

    test("don't slide or scale with reduced motion", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`/${locale}/dev/ui/overlays`);
      const moved = await recordMotion(page);
      await openSheet(page, locale);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
      await showToast(page, locale);
      expect((await moved()).filter((property) => property !== "opacity")).toEqual([]);
    });
  });
}

test.describe("offline", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "a network check");
  });

  test("a sheet whose code can't load leaves the page working, and opens once back online", async ({
    page,
    context,
  }) => {
    await page.goto("/en/dev/ui/overlays");
    await context.setOffline(true);
    await page.getByRole("button", { name: LABELS.en.sheet }).click();
    await expect(page.getByRole("heading", { name: "Toasts and sheets", level: 1 })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await context.setOffline(false);
    await page.getByRole("button", { name: LABELS.en.sheet }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("an error toast still shows with the network down", async ({ page, context }) => {
    await page.goto("/en/dev/ui/overlays");
    await context.setOffline(true);
    await page.getByRole("button", { name: LABELS.en.error }).click();
    await expect(page.getByRole("region").getByText(LABELS.en.failed)).toBeVisible();
  });
});
