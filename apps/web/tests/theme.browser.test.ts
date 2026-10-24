import "../app/globals.css";
import { expect, test } from "vitest";

test("the brand tokens reach the browser as CSS variables", () => {
  const root = getComputedStyle(document.documentElement);
  expect(root.getPropertyValue("--color-glow").trim().toUpperCase()).toBe("#3CC4A2");
  expect(root.getPropertyValue("--transition-duration-base").trim()).toBe("200ms");
  expect(root.getPropertyValue("--spacing-touch-target").trim()).toBe("44px");
});
