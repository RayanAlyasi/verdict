import { expect, test } from "@playwright/test";

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
