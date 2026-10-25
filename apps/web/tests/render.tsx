import "../app/globals.css";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach } from "vitest";

const mounted: (() => void)[] = [];

afterEach(() => {
  for (const unmount of mounted.splice(0)) unmount();
});

// Renders into the real page, with the app's CSS, so states can be checked as students see them.
export function render(ui: ReactNode): HTMLElement {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  flushSync(() => root.render(ui));
  mounted.push(() => {
    root.unmount();
    container.remove();
  });
  return container;
}

// A pointer event as a mouse or a finger sends it. React Aria tells the two apart by pointerType,
// and treats a 1×1 event without pressure as a screen reader's virtual click, hence the size.
export function point(element: Element, type: string, pointerType: "mouse" | "touch") {
  element.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerType,
      pointerId: 1,
      isPrimary: true,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      width: 10,
      height: 10,
      pressure: type === "pointerup" ? 0 : 0.5,
    }),
  );
}
