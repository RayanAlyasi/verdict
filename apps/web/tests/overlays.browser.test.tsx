import { useState } from "react";
import { afterEach, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Button } from "../components/ui/Button";
import { Sheet } from "../components/ui/Sheet";
import { Toasts, toastQueue } from "../components/ui/Toast";
import { render } from "./render";

afterEach(async () => {
  for (const toast of toastQueue.visibleToasts) toastQueue.close(toast.key);
  await page.viewport(414, 896);
});

function SheetExample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onPress={() => setOpen(true)}>Change the exam date</Button>
      <Sheet isOpen={open} onOpenChange={setOpen} title="Exam date" closeLabel="Close">
        <p>Your plan moves with it.</p>
        <Button variant="secondary">Keep it</Button>
      </Sheet>
    </>
  );
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

test("a sheet loads nothing until it opens, then traps focus and gives it back on Escape", async () => {
  const container = render(<SheetExample />);
  const trigger = container.querySelector("button")!;
  expect(dialog()).toBeNull();
  await userEvent.click(trigger);
  await expect.poll(dialog).not.toBeNull();
  const name = document.getElementById(dialog()!.getAttribute("aria-labelledby") ?? "");
  expect(name?.textContent).toBe("Exam date");
  await expect.poll(() => dialog()!.contains(document.activeElement)).toBe(true);
  await userEvent.keyboard("{Escape}");
  await expect.poll(dialog).toBeNull();
  // Focus comes back as the closing dialog leaves, not before.
  await expect.poll(() => document.activeElement).toBe(trigger);
});

test("a sheet closes from its close button and from a tap outside", async () => {
  const container = render(<SheetExample />);
  const trigger = container.querySelector("button")!;
  await userEvent.click(trigger);
  await expect.poll(dialog).not.toBeNull();
  await userEvent.click(page.getByRole("button", { name: "Close" }));
  await expect.poll(dialog).toBeNull();
  await userEvent.click(trigger);
  await expect.poll(dialog).not.toBeNull();
  await userEvent.click(document.body, { position: { x: 5, y: 5 } });
  await expect.poll(dialog).toBeNull();
});

test("on a phone it's a sheet along the bottom; from 1024px a centred dialog", async () => {
  const container = render(<SheetExample />);
  const trigger = container.querySelector("button")!;
  await page.viewport(390, 844);
  await userEvent.click(trigger);
  await expect.poll(dialog).not.toBeNull();
  const modal = () => dialog()!.parentElement!;
  await expect.poll(() => Math.round(modal().getBoundingClientRect().bottom)).toBe(844);
  expect(modal().getBoundingClientRect().width).toBe(390);
  await userEvent.keyboard("{Escape}");
  await expect.poll(dialog).toBeNull();

  await page.viewport(1440, 900);
  await userEvent.click(trigger);
  await expect.poll(dialog).not.toBeNull();
  await expect
    .poll(() => {
      const box = modal().getBoundingClientRect();
      return Math.round(box.top + box.height / 2);
    })
    .toBe(450);
  expect(modal().getBoundingClientRect().width).toBeLessThan(1440);
});

test("a toast appears in a labelled region, says its message and closes", async () => {
  render(<Toasts closeLabel="Close" />);
  expect(document.querySelector('[role="region"]')).toBeNull();
  const before = document.activeElement;
  toastQueue.add({ title: "Course saved.", tone: "success" }, { timeout: 6000 });
  await expect.poll(() => document.querySelector('[role="region"]')).not.toBeNull();
  const region = document.querySelector('[role="region"]')!;
  expect(region.getAttribute("aria-label")).toBeTruthy();
  await expect.poll(() => region.textContent).toContain("Course saved.");
  // A toast never takes focus from what the student is doing.
  expect(document.activeElement).toBe(before);
  await userEvent.click(page.getByRole("button", { name: "Close" }));
  await expect.poll(() => toastQueue.visibleToasts.length).toBe(0);
});

test("a toast with a timeout leaves by itself; one without stays", async () => {
  render(<Toasts closeLabel="Close" />);
  toastQueue.add({ title: "Course saved." }, { timeout: 300 });
  toastQueue.add({ title: "We couldn't save your course.", tone: "error" });
  await expect.poll(() => toastQueue.visibleToasts.length).toBe(2);
  // Timers pause while the pointer rests on a toast, so keep it away.
  await userEvent.hover(document.body, { position: { x: 5, y: 5 } });
  await expect
    .poll(() => toastQueue.visibleToasts.map((toast) => toast.content.title), { timeout: 3000 })
    .toEqual(["We couldn't save your course."]);
});
