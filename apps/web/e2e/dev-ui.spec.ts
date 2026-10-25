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
// take() returns what moved since the last take() and starts afresh.
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
    page.evaluate(() => {
      const seen = (window as unknown as { motionSeen: Set<string> }).motionSeen;
      const moved = [...seen];
      seen.clear();
      return moved;
    });
}

// Waits until what's moving has finished. Two frames first: React Aria marks a sheet as entering
// a frame after it appears, so an immediate check would find nothing running yet.
function settle(page: Page) {
  return page.evaluate(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished),
    );
  });
}

async function openSheet(page: Page, locale: keyof typeof LABELS) {
  await page.getByRole("button", { name: LABELS[locale].sheet }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // Settled: checks run on the sheet as it rests, not halfway through its entrance.
  await settle(page);
}

async function showToast(page: Page, locale: keyof typeof LABELS) {
  await page.getByRole("button", { name: LABELS[locale].toast }).click();
  await expect(page.getByRole("region").getByText(LABELS[locale].saved)).toBeVisible();
  await settle(page);
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

    test("move only with transform and opacity", async ({ page }, testInfo) => {
      await page.goto(`/${locale}/dev/ui/overlays`);
      const take = await recordMotion(page);
      const allowed = ["opacity", "transform", "translate", "scale", "rotate"];
      await openSheet(page, locale);
      const sheet = await take();
      // Phones slide the sheet up; desktops fade and scale the dialog.
      expect(sheet).toContain(testInfo.project.name === "phone" ? "translate" : "scale");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
      await take();
      await showToast(page, locale);
      const toast = await take();
      expect(toast).toContain("translate");
      for (const property of [...sheet, ...toast]) expect(allowed).toContain(property);
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

  test("a sheet whose code can't load stays closed, says so and opens on the next try", async ({
    page,
  }) => {
    await page.goto("/en/dev/ui/overlays");
    const failed: string[] = [];
    page.on("requestfailed", (request) => failed.push(request.url()));
    await page.route("**/_next/static/chunks/**", (route) => route.abort());
    await page.getByRole("button", { name: LABELS.en.sheet }).click();
    // Both the fetch and Next.js's own retry fail before the sheet gives up.
    await expect.poll(() => failed.length).toBeGreaterThanOrEqual(2);
    await expect(
      page
        .getByRole("region")
        .getByText("We couldn't open this. Check your connection, then try again."),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Toasts and sheets", level: 1 })).toBeVisible();
    await page.unroute("**/_next/static/chunks/**");
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
