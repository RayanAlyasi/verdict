import { expect, type Page, test } from "@playwright/test";

const isPhone = (projectName: string) => projectName === "phone";

// What moves the old and new pages, read frame by frame while `act` runs. Not the groups around
// them: those are the browser's own bookkeeping and draw nothing.
async function transitionsDuring(page: Page, act: () => Promise<void>) {
  await page.evaluate(() => {
    const seen = { pseudo: new Set<string>(), properties: new Set<string>(), longest: 0 };
    const ignore = new Set(["offset", "computedOffset", "easing", "composite"]);
    Object.assign(window, { transitionsSeen: seen, watching: true });
    const tick = () => {
      for (const animation of document.getAnimations()) {
        const effect = animation.effect as KeyframeEffect | null;
        if (!/^::view-transition-(old|new)/.test(effect?.pseudoElement ?? "")) continue;
        seen.pseudo.add(effect!.pseudoElement!);
        seen.longest = Math.max(seen.longest, Number(effect!.getTiming().duration) || 0);
        for (const frame of effect!.getKeyframes()) {
          for (const key of Object.keys(frame)) if (!ignore.has(key)) seen.properties.add(key);
        }
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
      transitionsSeen: { pseudo: Set<string>; properties: Set<string>; longest: number };
    };
    state.watching = false;
    const { pseudo, properties, longest } = state.transitionsSeen;
    return { pseudo: [...pseudo], properties: [...properties], longest };
  });
}

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

test("pages fade and slide, moving only transform and opacity", async ({ page }) => {
  await page.goto("/en");
  const main = page.getByRole("navigation", { name: "Main" }).locator("visible=true");
  const seen = await transitionsDuring(page, () =>
    main.getByRole("link", { name: "Course" }).click(),
  );
  await expect(page.getByRole("heading", { name: "Course", level: 1 })).toBeVisible();
  expect(seen.pseudo.length, "a transition ran").toBeGreaterThan(0);
  expect(seen.longest).toBe(320);
  for (const property of seen.properties) {
    expect(["opacity", "transform", "translate", "scale", "rotate"]).toContain(property);
  }
});

test("with reduced motion, a page change is instant", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en");
  const main = page.getByRole("navigation", { name: "Main" }).locator("visible=true");
  const seen = await transitionsDuring(page, () =>
    main.getByRole("link", { name: "Course" }).click(),
  );
  await expect(page.getByRole("heading", { name: "Course", level: 1 })).toBeVisible();
  expect(seen.longest).toBe(0);
});

test("the sky keeps moving through a page change", async ({ page }) => {
  await page.goto("/en");
  const main = page.getByRole("navigation", { name: "Main" }).locator("visible=true");
  await main.getByRole("link", { name: "Course" }).click();
  await expect(page.getByRole("heading", { name: "Course", level: 1 })).toBeVisible();
  const running = await page.evaluate(
    () =>
      document
        .querySelector("[data-testid=space-background]")!
        .getAnimations({ subtree: true })
        .filter((animation) => animation.playState === "running").length,
  );
  expect(running).toBe(4);
  const name = await page.evaluate(
    () => getComputedStyle(document.documentElement).viewTransitionName,
  );
  expect(name).toBe("none");
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

test("on phones, toasts sit above the bottom navigation", async ({ page }, testInfo) => {
  await page.goto("/en");
  const offset = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--toast-offset"),
  );
  if (isPhone(testInfo.project.name)) expect(offset).toContain("4.5625rem");
  else expect(offset.trim()).toBe("");
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
