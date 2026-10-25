import { useState } from "react";
import { expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { EmptyState } from "../components/ui/EmptyState";
import { Light, type LightStatus } from "../components/ui/Light";
import { Panel } from "../components/ui/Panel";
import { ProgressLights } from "../components/ui/ProgressLights";
import { Skeleton } from "../components/ui/Skeleton";
import { render } from "./render";

const style = (element: Element, pseudo?: string) => getComputedStyle(element, pseudo);

test.each([
  ["mastered", "0", "1"],
  ["progress", "1", "0"],
  ["not-started", "0", "0"],
] as [LightStatus, string, string][])(
  "a %s light shows its own glow layer",
  async (status, amber, glow) => {
    const light = render(<Light status={status} />).querySelector("span")!;
    expect(light.getAttribute("aria-hidden")).toBe("true");
    await expect.poll(() => style(light, "::before").opacity).toBe(amber);
    await expect.poll(() => style(light, "::after").opacity).toBe(glow);
  },
);

function TurningGreen() {
  const [status, setStatus] = useState<LightStatus>("progress");
  return (
    <>
      <Light status={status} />
      <button type="button" onClick={() => setStatus("mastered")}>
        Master it
      </button>
    </>
  );
}

test("a light turning green crossfades its glow layers instead of repainting a shadow", async () => {
  const container = render(<TurningGreen />);
  const light = container.querySelector("span")!;
  // Each glow is drawn once; only the layers' opacity moves.
  for (const pseudo of ["::before", "::after"]) {
    expect(style(light, pseudo).transitionProperty).toBe("opacity");
    expect(style(light, pseudo).boxShadow).not.toBe("none");
  }
  await userEvent.click(container.querySelector("button")!);
  expect(light.dataset.status).toBe("mastered");
  await expect.poll(() => style(light, "::after").opacity).toBe("1");
  await expect.poll(() => style(light, "::before").opacity).toBe("0");
});

test("the current light is a ring, and lights come in two sizes", () => {
  const container = render(
    <>
      <Light status="current" />
      <Light status="mastered" size="sm" />
    </>,
  );
  const [current, small] = [...container.querySelectorAll("span")];
  expect(style(current!).borderTopWidth).toBe("2px");
  expect(current!.getBoundingClientRect().width).toBe(10);
  expect(small!.getBoundingClientRect().width).toBe(8);
});

test("progress lights read as a progress bar, with one light per item", () => {
  const container = render(<ProgressLights label="Question 4 of 10" completed={3} total={10} />);
  const bar = container.querySelector('[role="progressbar"]')!;
  expect(bar.getAttribute("aria-valuenow")).toBe("3");
  expect(bar.getAttribute("aria-valuemax")).toBe("10");
  expect(bar.getAttribute("aria-valuetext")).toBe("Question 4 of 10");
  const name = document.getElementById(bar.getAttribute("aria-labelledby") ?? "");
  expect(name?.textContent).toBe("Question 4 of 10");
  const lights = [...bar.querySelectorAll("[data-status]")].map((light) =>
    light.getAttribute("data-status"),
  );
  expect(lights).toEqual([
    "mastered",
    "mastered",
    "mastered",
    "current",
    ...Array(6).fill("not-started"),
  ]);
});

test("a panel is solid; a toned one is a light tint of its colour", () => {
  const container = render(
    <>
      <Panel as="section">Content</Panel>
      <Panel tone="coral">Content</Panel>
    </>,
  );
  const [solid, tinted] = [
    container.querySelector("section")!,
    container.querySelector("div div")!,
  ];
  expect(style(solid).backgroundColor).toBe("rgb(16, 27, 46)");
  expect(style(solid).borderRadius).toBe("18px");
  expect(style(tinted).backgroundColor).toMatch(/\/ 0\.08\)$/);
});

test("a skeleton stays out of the accessibility tree and pulses its opacity", () => {
  const skeleton = render(<Skeleton className="h-4 w-20" />).querySelector("span")!;
  expect(skeleton.getAttribute("aria-hidden")).toBe("true");
  expect(style(skeleton).animationName).toBe("pulse");
});

test("an empty state names what's missing and offers one step", () => {
  const container = render(
    <EmptyState
      headingLevel={3}
      title="No courses yet"
      description="Add a course and its files."
      action={<button type="button">Add your first course</button>}
    />,
  );
  expect(container.querySelector("h3")?.textContent).toBe("No courses yet");
  expect(container.querySelector("button")?.textContent).toBe("Add your first course");
});
