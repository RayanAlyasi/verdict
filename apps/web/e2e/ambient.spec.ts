import { expect, test } from "@playwright/test";

test("at 4× CPU throttling, the globe and background cause no long frames", async ({ page }) => {
  await page.goto("/en/dev/ui");
  await page.getByRole("heading", { name: "Globe" }).scrollIntoViewIfNeeded();
  await page.waitForLoadState("networkidle");
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const longFrames = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const durations: number[] = [];
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) durations.push(entry.duration);
        });
        observer.observe({ type: "long-animation-frame" });
        setTimeout(() => {
          observer.disconnect();
          resolve(durations);
        }, 5000);
      }),
  );
  expect(longFrames).toEqual([]);
});

test("with reduced motion, nothing ambient runs", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/dev/ui");
  await page.getByRole("heading", { name: "Globe" }).scrollIntoViewIfNeeded();
  await page.waitForLoadState("networkidle");
  const ambient = await page.evaluate(
    () =>
      document.querySelector("[data-testid=space-background]")!.getAnimations({ subtree: true })
        .length,
  );
  expect(ambient).toBe(0);
  const canvas = page.locator("main canvas").first();
  const still = () => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
  const before = await still();
  await page.waitForTimeout(500);
  expect(await still()).toBe(before);
});

test("the background covers the page behind its content", async ({ page }) => {
  await page.goto("/en");
  const heading = page.getByRole("heading", { name: "Verdict" });
  await expect(heading).toBeVisible();
  const onTop = await heading.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === element;
  });
  expect(onTop).toBe(true);
});
