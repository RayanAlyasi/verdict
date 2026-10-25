import { useState } from "react";
import { afterEach, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Button } from "../components/ui/Button";
import { Sheet } from "../components/ui/Sheet";
import { showToast, Toasts, toastQueue } from "../components/ui/Toast";
import { render } from "./render";

afterEach(async () => {
  for (const toast of toastQueue.visibleToasts) toastQueue.close(toast.key);
  await page.viewport(414, 896);
});

function SheetExample({ paragraphs = 1 }: { paragraphs?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onPress={() => setOpen(true)}>Change the exam date</Button>
      <Sheet
        isOpen={open}
        onOpenChange={setOpen}
        title="Exam date"
        closeLabel="Close"
        actions={<Button onPress={() => setOpen(false)}>Save the date</Button>}
      >
        {Array.from({ length: paragraphs }, (_, index) => (
          <p key={index}>Your plan moves with the date.</p>
        ))}
        <Button variant="secondary">Keep it</Button>
      </Sheet>
    </>
  );
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

async function open(trigger: HTMLElement) {
  await userEvent.click(trigger);
  await expect.poll(dialog).not.toBeNull();
}

test("a sheet renders nothing until it opens, keeps focus inside and gives it back on Escape", async () => {
  const container = render(<SheetExample />);
  const trigger = container.querySelector("button")!;
  expect(dialog()).toBeNull();
  await open(trigger);
  const name = document.getElementById(dialog()!.getAttribute("aria-labelledby") ?? "");
  expect(name?.textContent).toBe("Exam date");
  await expect.poll(() => dialog()!.contains(document.activeElement)).toBe(true);
  // Close, Keep it and Save the date, then round again: Tab never leaves the sheet.
  for (let press = 0; press < 5; press++) {
    await userEvent.tab();
    expect(dialog()!.contains(document.activeElement)).toBe(true);
  }
  await userEvent.keyboard("{Escape}");
  await expect.poll(dialog).toBeNull();
  // Focus comes back as the closing dialog leaves, not before.
  await expect.poll(() => document.activeElement).toBe(trigger);
});

test("a sheet closes from its close button and from a tap outside", async () => {
  const container = render(<SheetExample />);
  const trigger = container.querySelector("button")!;
  await open(trigger);
  await userEvent.click(page.getByRole("button", { name: "Close" }));
  await expect.poll(dialog).toBeNull();
  await open(trigger);
  await userEvent.click(document.body, { position: { x: 5, y: 5 } });
  await expect.poll(dialog).toBeNull();
});

test("on a phone it's a sheet along the bottom; from 1024px a centred dialog", async () => {
  const container = render(<SheetExample />);
  const trigger = container.querySelector("button")!;
  const modal = () => dialog()!.parentElement!;
  await page.viewport(390, 844);
  await open(trigger);
  await expect.poll(() => Math.round(modal().getBoundingClientRect().bottom)).toBe(844);
  expect(modal().getBoundingClientRect().width).toBe(390);
  await userEvent.keyboard("{Escape}");
  await expect.poll(dialog).toBeNull();

  await page.viewport(1440, 900);
  await open(trigger);
  await expect
    .poll(() => {
      const box = modal().getBoundingClientRect();
      return Math.round(box.top + box.height / 2);
    })
    .toBe(450);
  expect(modal().getBoundingClientRect().width).toBeLessThan(1440);
});

test("a long sheet scrolls its content, keeping the title, close button and actions in view", async () => {
  await page.viewport(390, 844);
  const container = render(<SheetExample paragraphs={60} />);
  await open(container.querySelector("button")!);
  const sheet = dialog()!;
  const body = sheet.children[1] as HTMLElement;
  await expect.poll(() => body.scrollHeight > body.clientHeight).toBe(true);
  // Measured once the sheet has finished sliding in.
  await expect.poll(() => sheet.closest("[data-entering]")).toBeNull();
  body.scrollTop = body.scrollHeight;
  const within = (element: Element) => {
    const box = element.getBoundingClientRect();
    return box.top >= 0 && box.bottom <= window.innerHeight;
  };
  expect(within(page.getByRole("heading", { name: "Exam date" }).element())).toBe(true);
  expect(within(page.getByRole("button", { name: "Close" }).element())).toBe(true);
  expect(within(page.getByRole("button", { name: "Save the date" }).element())).toBe(true);
});

test("a toast appears in a labelled region, slides in, says its message and closes", async () => {
  render(<Toasts closeLabel="Close" />);
  const before = document.activeElement;
  showToast({ title: "We saved your course.", tone: "success" });
  await expect.poll(() => document.querySelector('[role="region"]')).not.toBeNull();
  const region = document.querySelector<HTMLElement>('[role="region"]')!;
  expect(region.getAttribute("aria-label")).toBeTruthy();
  await expect.poll(() => region.textContent).toContain("We saved your course.");
  const toast =
    region.querySelector('[role="alertdialog"], [role="alert"]') ?? region.firstElementChild!;
  expect(getComputedStyle(toast).transitionProperty).toBe("opacity, translate");
  // A toast never takes focus from what the student is doing.
  expect(document.activeElement).toBe(before);
  await userEvent.click(page.getByRole("button", { name: "Close" }));
  await expect.poll(() => toastQueue.visibleToasts.length).toBe(0);
});

test("F6 reaches the toasts and shows where focus is", async () => {
  const container = render(
    <>
      <button type="button">Next question</button>
      <Toasts closeLabel="Close" />
    </>,
  );
  showToast({ title: "We saved your course." });
  await expect.poll(() => document.querySelector('[role="region"]')).not.toBeNull();
  container.querySelector("button")!.focus();
  await userEvent.keyboard("{F6}");
  const region = document.querySelector<HTMLElement>('[role="region"]')!;
  await expect.poll(() => region.contains(document.activeElement)).toBe(true);
  const focused = document.activeElement!;
  expect(getComputedStyle(focused).outlineStyle).toBe("solid");
  expect(getComputedStyle(focused).outlineWidth).toBe("2px");
});

test("a toast leaves by itself after its timeout; an error stays until dismissed", async () => {
  render(<Toasts closeLabel="Close" />);
  toastQueue.add({ title: "We saved your course." }, { timeout: 300 });
  showToast({ title: "We couldn't save your course.", tone: "error" });
  await expect.poll(() => toastQueue.visibleToasts.length).toBe(2);
  // Timers pause while the pointer rests on a toast, so keep it away.
  await userEvent.hover(document.body, { position: { x: 5, y: 5 } });
  await expect
    .poll(() => toastQueue.visibleToasts.map((toast) => toast.content.title), { timeout: 3000 })
    .toEqual(["We couldn't save your course."]);
});
