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
  en: { sheet: "Change the exam date", toast: "Show a confirmation", saved: "Course saved." },
  ar: { sheet: "غيّر تاريخ الامتحان", toast: "اعرض تأكيدًا", saved: "حُفظ المقرر." },
};

// Opens the gallery's sample sheet, closes it, then raises a toast.
async function openOverlays(page: Page, locale: keyof typeof LABELS) {
  const labels = LABELS[locale];
  await page.goto(`/${locale}/dev/ui`);
  await page.getByRole("button", { name: labels.sheet }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  return async () => {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.getByRole("button", { name: labels.toast }).click();
    await expect(page.getByRole("region").getByText(labels.saved)).toBeVisible();
  };
}

// What moves on the page right now: the CSS properties each running animation changes. View
// transitions' own pseudo-elements are the browser's business, so they're left out.
function animatedProperties(page: Page) {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => {
        const effect = animation.effect as KeyframeEffect | null;
        return animation.playState === "running" && effect?.target && !effect.pseudoElement;
      })
      .flatMap((animation) =>
        (animation.effect as KeyframeEffect)
          .getKeyframes()
          .flatMap((frame) => Object.keys(frame))
          .filter((key) => !["offset", "computedOffset", "easing", "composite"].includes(key)),
      ),
  );
}

for (const locale of ["en", "ar"] as const) {
  test.describe(`the gallery's overlays (${locale})`, () => {
    test("have no serious accessibility problems, open or showing", async ({ page }) => {
      const thenToast = await openOverlays(page, locale);
      const serious = async () =>
        (await new AxeBuilder({ page }).analyze()).violations
          .filter((v) => v.impact === "serious" || v.impact === "critical")
          .map((v) => `${v.id}: ${v.help}`);
      expect(await serious(), "with the sheet open").toEqual([]);
      await thenToast();
      expect(await serious(), "with a toast showing").toEqual([]);
    });

    test("move only with transform and opacity", async ({ page }) => {
      const thenToast = await openOverlays(page, locale);
      const moving = new Set(await animatedProperties(page));
      await thenToast();
      for (const property of await animatedProperties(page)) moving.add(property);
      for (const property of moving) {
        expect(["opacity", "transform", "translate", "scale", "rotate"]).toContain(property);
      }
    });

    test("don't slide or scale with reduced motion", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      const thenToast = await openOverlays(page, locale);
      const moving = new Set(await animatedProperties(page));
      await thenToast();
      for (const property of await animatedProperties(page)) moving.add(property);
      expect([...moving].filter((property) => property !== "opacity")).toEqual([]);
    });
  });
}
