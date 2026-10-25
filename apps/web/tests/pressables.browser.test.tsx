import type { ReactElement } from "react";
import { describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { Button } from "../components/ui/Button";
import { Chip } from "../components/ui/Chip";
import { IconButton } from "../components/ui/IconButton";
import { nextFrames, point, press, render } from "./render";

type Props = { isDisabled?: boolean; onPress?: () => void };

const icon = <svg aria-hidden="true" viewBox="0 0 24 24" />;

const PRESSABLES: [string, (props: Props) => ReactElement][] = [
  ["primary Button", (props) => <Button {...props}>Save</Button>],
  [
    "secondary Button",
    (props) => (
      <Button variant="secondary" {...props}>
        Not now
      </Button>
    ),
  ],
  [
    "ghost Button",
    (props) => (
      <Button variant="ghost" {...props}>
        Skip
      </Button>
    ),
  ],
  [
    "IconButton",
    (props) => (
      <IconButton label="Close" variant="outline" {...props}>
        {icon}
      </IconButton>
    ),
  ],
  [
    "Chip",
    ({ onPress, ...props }) => (
      <Chip onChange={onPress} {...props}>
        Topic drill
      </Chip>
    ),
  ],
];

const button = (container: HTMLElement) => container.querySelector("button")!;
const style = (element: Element, pseudo?: string) => getComputedStyle(element, pseudo);

describe.each(PRESSABLES)("%s", (_, make) => {
  test("shows hover for a pointer, never for a finger", async () => {
    const element = button(render(make({})));
    // The test runner's real cursor may rest where this renders; move it away first.
    await userEvent.unhover(element);
    await nextFrames();
    expect(element.dataset.hovered).toBeUndefined();
    point(element, "pointerover", "touch");
    await nextFrames();
    expect(element.dataset.hovered).toBeUndefined();
    // The same event from a mouse, read the same way, does show hover.
    point(element, "pointerover", "mouse");
    await nextFrames();
    expect(element.dataset.hovered).toBe("true");
    point(element, "pointerout", "mouse");
    await nextFrames();
    expect(element.dataset.hovered).toBeUndefined();
    await userEvent.hover(element);
    expect(element.dataset.hovered).toBe("true");
    await expect.poll(() => style(element, "::before").opacity).toBe("1");
    await userEvent.unhover(element);
    expect(element.dataset.hovered).toBeUndefined();
  });

  test("scales down while pressed and back when let go", async () => {
    const element = button(render(make({})));
    point(element, "pointerdown", "mouse");
    await expect.poll(() => element.dataset.pressed).toBe("true");
    await expect.poll(() => style(element).scale).toBe("0.97");
    point(element, "pointerup", "mouse");
    await expect.poll(() => element.dataset.pressed).toBeUndefined();
    await expect.poll(() => style(element).scale).toBe("none");
  });

  test("shows a focus ring for the keyboard, not for a click", async () => {
    const container = render(
      <>
        <input aria-label="Before" />
        {make({})}
      </>,
    );
    const element = button(container);
    await userEvent.click(element);
    expect(element.dataset.focusVisible).toBeUndefined();
    expect(style(element).outlineStyle).toBe("none");
    container.querySelector("input")!.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(element);
    expect(element.dataset.focusVisible).toBe("true");
    expect(style(element)).toMatchObject({
      outlineStyle: "solid",
      outlineWidth: "2px",
      outlineOffset: "2px",
    });
  });

  test("when disabled, fades and ignores hover and presses", async () => {
    const onPress = vi.fn();
    const container = render(
      <>
        {make({ onPress })}
        {make({ isDisabled: true, onPress })}
      </>,
    );
    const [enabled, element] = [...container.querySelectorAll("button")] as HTMLButtonElement[];
    press(enabled!);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(element!.disabled).toBe(true);
    expect(style(element!).opacity).toBe("0.4");
    await userEvent.hover(element!);
    await nextFrames();
    expect(element!.dataset.hovered).toBeUndefined();
    press(element!);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test("is at least 44px tall", () => {
    const { height } = button(render(make({}))).getBoundingClientRect();
    expect(height).toBeGreaterThanOrEqual(44);
  });
});

describe.each([
  [
    "Button",
    (props: { isPending: boolean; onPress?: () => void }) => (
      <Button pendingLabel="Saving" {...props}>
        Save changes
      </Button>
    ),
  ],
  [
    "IconButton",
    (props: { isPending: boolean; onPress?: () => void }) => (
      <IconButton label="Close" pendingLabel="Saving" {...props}>
        {icon}
      </IconButton>
    ),
  ],
])("a pending %s", (_, make) => {
  test("keeps its size, says what it's doing and ignores presses", async () => {
    const onPress = vi.fn();
    const container = render(
      <>
        {make({ isPending: false, onPress })}
        {make({ isPending: true, onPress })}
      </>,
    );
    const [idle, pending] = [...container.querySelectorAll("button")];
    expect(pending!.getBoundingClientRect().width).toBe(idle!.getBoundingClientRect().width);
    expect(pending!.getBoundingClientRect().height).toBe(idle!.getBoundingClientRect().height);
    expect(pending!.querySelector('[role="progressbar"]')?.getAttribute("aria-label")).toBe(
      "Saving",
    );
    // Pressed directly: Playwright won't click a button React Aria marks aria-disabled.
    press(idle!);
    expect(onPress).toHaveBeenCalledTimes(1);
    press(pending!);
    press(pending!);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

test("every button leaves a 44px touch target, even with a one-letter label", () => {
  const container = render(
    <>
      <Button size="lg">Start</Button>
      <Button size="md">Start</Button>
      <Button size="sm">Start</Button>
      <Button variant="ghost" size="sm">
        A
      </Button>
    </>,
  );
  for (const element of container.querySelectorAll("button")) {
    const { width, height } = element.getBoundingClientRect();
    expect(height).toBeGreaterThanOrEqual(44);
    expect(width).toBeGreaterThanOrEqual(44);
  }
});

test("a chip turns on and off, and glows while on", async () => {
  const element = button(render(<Chip>Topic drill</Chip>));
  expect(element.getAttribute("aria-pressed")).toBe("false");
  await userEvent.click(element);
  expect(element.getAttribute("aria-pressed")).toBe("true");
  await expect.poll(() => style(element, "::after").opacity).toBe("1");
  await userEvent.click(element);
  expect(element.getAttribute("aria-pressed")).toBe("false");
});
