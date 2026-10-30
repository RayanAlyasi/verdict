import { expect, type Page, test } from "@playwright/test";

// As on a phone: the globe's bitmap is four times the size it is at a ratio of 1.
test.use({ deviceScaleFactor: 2 });

async function openGlobe(page: Page) {
  await page.goto("/en/dev/ui");
  await page.getByRole("heading", { name: "Globe" }).scrollIntoViewIfNeeded();
  await page.waitForLoadState("networkidle");
  const canvas = page.locator("main canvas").first();
  await canvas.scrollIntoViewIfNeeded();
  return canvas;
}

test("at 4× CPU throttling, the globe and background cause no long frames", async ({ page }) => {
  // Counted, not read back: reading a canvas is slow, so the test would trip over itself.
  await page.addInitScript(() => {
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    Object.assign(window, { draws: 0 });
    CanvasRenderingContext2D.prototype.drawImage = function (
      this: CanvasRenderingContext2D,
      ...args: Parameters<typeof draw>
    ) {
      (window as unknown as { draws: number }).draws += 1;
      return draw.apply(this, args);
    } as typeof draw;
  });
  await openGlobe(page);
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.waitForTimeout(1000);
  const { longFrames, draws } = await page.evaluate(
    () =>
      new Promise<{ longFrames: unknown[]; draws: number }>((resolve) => {
        const count = () => (window as unknown as { draws: number }).draws;
        const before = count();
        const longFrames: unknown[] = [];
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as PerformanceEntry[] &
            {
              scripts?: { invoker: string; duration: number }[];
            }[]) {
            longFrames.push({
              duration: Math.round(entry.duration),
              scripts: entry.scripts?.map(({ invoker, duration }) => [invoker, duration]),
            });
          }
        });
        observer.observe({ type: "long-animation-frame" });
        setTimeout(() => {
          observer.disconnect();
          resolve({ longFrames, draws: count() - before });
        }, 5000);
      }),
  );
  expect(longFrames).toEqual([]);
  expect(draws, "the globe was drawing throughout").toBeGreaterThan(1000);
});

test("with reduced motion, nothing ambient runs and the globe is a still frame", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const canvas = await openGlobe(page);
  const ambient = await page.evaluate(
    () =>
      document.querySelector("[data-testid=space-background]")!.getAnimations({ subtree: true })
        .length,
  );
  expect(ambient).toBe(0);
  const read = () =>
    canvas.evaluate((element: HTMLCanvasElement) => ({
      image: element.toDataURL(),
      painted: element
        .getContext("2d")!
        .getImageData(0, 0, element.width, element.height)
        .data.some((value) => value > 0),
    }));
  const before = await read();
  expect(before.painted).toBe(true);
  await page.waitForTimeout(500);
  expect((await read()).image).toBe(before.image);
});

test("the background covers the page, behind its content", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: "Verdict" })).toBeVisible();
  const result = await page.evaluate(() => {
    const background = document.querySelector<HTMLElement>("[data-testid=space-background]")!;
    // elementFromPoint skips anything that ignores the pointer, so it would prove nothing.
    background.style.pointerEvents = "auto";
    const heading = document.querySelector("h1")!;
    const box = heading.getBoundingClientRect();
    const sky = background.getBoundingClientRect();
    return {
      headingOnTop:
        document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === heading,
      covers: sky.width >= window.innerWidth && sky.height >= window.innerHeight,
    };
  });
  expect(result).toEqual({ headingOnTop: true, covers: true });
});

test("Arabic text on the sky has a halo that hides stars, and filled surfaces don't", async ({
  page,
}) => {
  await page.goto("/ar/dev/ui");
  const shadow = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((element) => getComputedStyle(element).textShadow);
  expect(await shadow("h2")).toContain("0px 0px 8px");
  expect(await shadow("main [class*='bg-panel']")).toBe("none");
  await page.goto("/en/dev/ui");
  expect(await shadow("h2")).toBe("none");
});
