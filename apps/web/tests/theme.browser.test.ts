import "../app/globals.css";
import { expect, test } from "vitest";

test("the brand tokens reach the browser as CSS variables", () => {
  const root = getComputedStyle(document.documentElement);
  expect(root.getPropertyValue("--color-glow").trim().toUpperCase()).toBe("#3CC4A2");
  expect(root.getPropertyValue("--transition-duration-base").trim()).toBe("200ms");
  expect(root.getPropertyValue("--spacing-touch-target").trim()).toBe("44px");
});

test("Arabic headings get taller line heights, on Arabic pages and inside English ones", () => {
  const heading = document.createElement("h1");
  heading.className = "text-title-1";
  document.body.append(heading);
  try {
    expect(getComputedStyle(heading).lineHeight).toBe("36px");
    document.documentElement.lang = "ar";
    expect(getComputedStyle(heading).lineHeight).toBe("42px");
    document.documentElement.lang = "en";
    heading.lang = "ar";
    expect(getComputedStyle(heading).lineHeight).toBe("42px");
  } finally {
    document.documentElement.lang = "";
    heading.remove();
  }
});
