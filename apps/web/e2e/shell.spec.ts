import { expect, type Page, test } from "@playwright/test";

const isPhone = (projectName: string) => projectName === "phone";

// What a page transition does, read frame by frame while `act` runs. Old and new pages only: the
// groups around them are the browser's own bookkeeping and draw nothing.
async function transitionsDuring(page: Page, act: () => Promise<void>) {
  await page.evaluate(() => {
    const seen = {
      properties: new Set<string>(),
      longest: 0,
      oldSlide: 0,
      newSlide: 0,
      overlayWidth: "",
      skyRunning: 0,
    };
    const ignore = new Set(["offset", "computedOffset", "easing", "composite"]);
    Object.assign(window, { transitionsSeen: seen, watching: true });
    const root = document.documentElement;
    const tick = () => {
      for (const animation of document.getAnimations()) {
        const effect = animation.effect as KeyframeEffect | null;
        const pseudo = effect?.pseudoElement ?? "";
        if (!/^::view-transition-(old|new)/.test(pseudo)) continue;
        seen.longest = Math.max(seen.longest, Number(effect!.getTiming().duration) || 0);
        for (const frame of effect!.getKeyframes()) {
          for (const key of Object.keys(frame)) if (!ignore.has(key)) seen.properties.add(key);
        }
        const slide = Number.parseFloat(getComputedStyle(root, pseudo).translate) || 0;
        const side = pseudo.includes("old") ? "oldSlide" : "newSlide";
        if (Math.abs(slide) > Math.abs(seen[side])) seen[side] = slide;
        seen.overlayWidth = getComputedStyle(root, "::view-transition").width;
        seen.skyRunning = document
          .querySelector("[data-testid=space-background]")!
          .getAnimations({ subtree: true })
          .filter((sky) => sky.playState === "running").length;
      }
      if ((window as unknown as { watching: boolean }).watching) requestAnimationFrame(tick);
    };
    tick();
  });
  await act();
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const state = window as unknown as {
      watching: boolean;
      transitionsSeen: {
        properties: Set<string>;
        longest: number;
        oldSlide: number;
        newSlide: number;
        overlayWidth: string;
        skyRunning: number;
      };
    };
    state.watching = false;
    return { ...state.transitionsSeen, properties: [...state.transitionsSeen.properties] };
  });
}

const mainNav = (page: Page, name: string) =>
  page.getByRole("navigation", { name }).locator("visible=true");

test("phones get bottom navigation, and wide screens a sidebar", async ({ page }, testInfo) => {
  await page.goto("/en");
  const bottom = page.locator("nav.fixed");
  const sidebar = page.locator("aside");
  if (isPhone(testInfo.project.name)) {
    await expect(bottom).toBeVisible();
    await expect(sidebar).toBeHidden();
  } else {
    await expect(bottom).toBeHidden();
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole("img", { name: "Verdict" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Ask Verdict" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Add a course" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Profile and settings" })).toBeVisible();
  }
});

test("the switch between them is at 1024px", async ({ page }) => {
  await page.setViewportSize({ width: 1023, height: 800 });
  await page.goto("/en");
  await expect(page.locator("aside")).toBeHidden();
  await expect(page.locator("nav.fixed")).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(page.locator("aside")).toBeVisible();
  await expect(page.locator("nav.fixed")).toBeHidden();
});

test("the navigation marks the open page and moves without reloading", async ({ page }) => {
  await page.goto("/en");
  await page.evaluate(() => Object.assign(window, { samePage: true }));
  const main = page.getByRole("navigation", { name: "Main" }).locator("visible=true");
  await expect(main.getByRole("link", { name: "Today" })).toHaveAttribute("aria-current", "page");
  for (const name of ["Course", "Practice", "Progress"]) {
    await main.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await expect(main.getByRole("link", { name })).toHaveAttribute("aria-current", "page");
    await expect(main.locator("[aria-current=page]")).toHaveCount(1);
  }
  await main.getByRole("link", { name: "Today" }).click();
  await expect(page).toHaveURL(/\/en$/);
  expect(await page.evaluate(() => "samePage" in window)).toBe(true);
});

test("Today has a dark globe with no invented mastery, and says the next step", async ({
  page,
}) => {
  await page.goto("/en");
  await expect(page.getByText("No course yet. Add one and its ideas appear")).toBeVisible();
  await expect(page.locator("main canvas")).toBeVisible();
  await expect(page.getByText(/\d+%/)).toHaveCount(0);
  const add = page.getByRole("main").getByRole("link", { name: "Add a course" });
  await add.click();
  await expect(page.getByRole("heading", { name: "Add a course", level: 1 })).toBeVisible();
});

test("the source code link is there at every width", async ({ page }) => {
  await page.goto("/en/course");
  const link = page.getByRole("link", { name: "Source code" }).locator("visible=true");
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute("href", "https://github.com/RayanAlyasi/verdict");
});

for (const [locale, nav, course, heading, sign] of [
  ["en", "Main", "Course", "Course", -1],
  ["ar", "القائمة الرئيسية", "المقرر", "المقرر", 1],
] as const) {
  test(`pages fade and slide the right way, with the sky moving behind them (${locale})`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);
    const seen = await transitionsDuring(page, () =>
      mainNav(page, nav).getByRole("link", { name: course }).click(),
    );
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    expect(seen.longest).toBe(320);
    for (const property of seen.properties) {
      expect(["opacity", "transform", "translate", "scale", "rotate"]).toContain(property);
    }
    expect(Math.sign(seen.oldSlide), "the old page leaves against the direction of travel").toBe(
      sign,
    );
    expect(Math.sign(seen.newSlide), "the new page arrives from the far side").toBe(-sign);
    expect(Math.abs(seen.oldSlide)).toBeLessThanOrEqual(8);
    expect(Number.parseFloat(seen.overlayWidth), "the transition layer is on screen").toBe(
      page.viewportSize()!.width,
    );
    expect(seen.skyRunning).toBe(4);
  });
}

test("leaving Ask Verdict for a main page moves back", async ({ page }, testInfo) => {
  test.skip(isPhone(testInfo.project.name), "the sidebar's link");
  await page.goto("/en/course");
  const sidebar = page.locator("aside");
  const opening = await transitionsDuring(page, () =>
    sidebar.getByRole("link", { name: "Ask Verdict" }).click(),
  );
  expect(Math.sign(opening.newSlide)).toBe(1);
  const leaving = await transitionsDuring(page, () =>
    sidebar.getByRole("link", { name: "Course", exact: true }).click(),
  );
  expect(Math.sign(leaving.newSlide)).toBe(-1);
});

test("with reduced motion, a page change is instant", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en");
  const seen = await transitionsDuring(page, () =>
    mainNav(page, "Main").getByRole("link", { name: "Course" }).click(),
  );
  await expect(page.getByRole("heading", { name: "Course", level: 1 })).toBeVisible();
  expect(seen.longest).toBe(0);
});

test("without View Transitions, pages still change", async ({ page }) => {
  await page.addInitScript(() => {
    delete (Document.prototype as { startViewTransition?: unknown }).startViewTransition;
  });
  await page.goto("/en");
  await mainNav(page, "Main").getByRole("link", { name: "Course" }).click();
  await expect(page.getByRole("heading", { name: "Course", level: 1 })).toBeVisible();
});

test("each page has its own title, which screen readers hear on arrival", async ({ page }) => {
  await page.goto("/en");
  await expect(page).toHaveTitle("Today · Verdict");
  await mainNav(page, "Main").getByRole("link", { name: "Practice" }).click();
  await expect(page).toHaveTitle("Practice · Verdict");
  await expect(page.locator("next-route-announcer [aria-live]")).toHaveText("Practice · Verdict");
  await page.goto("/ar/progress");
  await expect(page).toHaveTitle("التقدّم · Verdict");
});

test("the main action opens its page without a reload, and shows it's working", async ({
  page,
}) => {
  await page.goto("/en");
  await page.evaluate(() => Object.assign(window, { samePage: true }));
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/en/add-course**", async (route) => {
    await held;
    await route.continue();
  });
  const add = page.getByRole("main").getByRole("link", { name: "Add a course" });
  await add.click();
  await expect(add.getByRole("progressbar", { name: "Opening" })).toBeVisible();
  release();
  await expect(page.getByRole("heading", { name: "Add a course", level: 1 })).toBeVisible();
  expect(await page.evaluate(() => "samePage" in window)).toBe(true);
});

test("on a short phone, the main action stays above the navigation", async ({ page }, testInfo) => {
  test.skip(!isPhone(testInfo.project.name), "a phone check");
  for (const height of [640, 568]) {
    await page.setViewportSize({ width: 360, height });
    await page.goto("/en");
    const action = await page
      .getByRole("main")
      .getByRole("link", { name: "Add a course" })
      .boundingBox();
    const nav = await page.locator("nav.fixed").boundingBox();
    expect(action!.y + action!.height, `at ${height}px`).toBeLessThanOrEqual(nav!.y);
  }
});

test("content clears a notch in landscape", async ({ page }, testInfo) => {
  test.skip(!isPhone(testInfo.project.name), "a phone check");
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/en/course");
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setSafeAreaInsetsOverride", { insets: { left: 47, right: 47 } });
  await expect
    .poll(async () => (await page.getByRole("heading", { level: 1 }).boundingBox())!.x)
    .toBeGreaterThanOrEqual(47);
});

test("Back still works after using the skip link", async ({ page }, testInfo) => {
  test.skip(isPhone(testInfo.project.name), "a keyboard check");
  await page.goto("/en");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/en$/);
  await page.locator("aside").getByRole("link", { name: "Course", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Course", level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  await expect(page.locator("aside [aria-current=page]")).toHaveText("Today");
});

test("in Arabic, the sidebar is on the right and the bottom navigation runs from the right", async ({
  page,
}, testInfo) => {
  await page.goto("/ar");
  if (isPhone(testInfo.project.name)) {
    const links = page.locator("nav.fixed a");
    const first = await links.first().boundingBox();
    const last = await links.last().boundingBox();
    expect(first!.x).toBeGreaterThan(last!.x);
  } else {
    const box = await page.locator("aside").boundingBox();
    expect(box!.x).toBeGreaterThan(1000);
  }
});

test("the skip link appears on focus and moves past the navigation", async ({ page }, testInfo) => {
  test.skip(isPhone(testInfo.project.name), "a keyboard check");
  await page.goto("/en");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});

test("content can scroll clear of the bottom navigation", async ({ page }, testInfo) => {
  test.skip(!isPhone(testInfo.project.name), "a phone check");
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/en");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const source = await page
    .getByRole("link", { name: "Source code" })
    .locator("visible=true")
    .boundingBox();
  const nav = await page.locator("nav.fixed").boundingBox();
  expect(source!.y + source!.height).toBeLessThanOrEqual(nav!.y);
});
