import { expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { Input } from "../components/ui/Input";
import { LocaleProvider } from "../components/ui/LocaleProvider";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { point, render } from "./render";

const style = (element: Element, pseudo?: string) => getComputedStyle(element, pseudo);

test("a text field is labelled, 52px tall and at least 16px, so iOS doesn't zoom", () => {
  const container = render(<Input label="Course name" />);
  const input = container.querySelector("input")!;
  expect(input.labels?.[0]?.textContent).toBe("Course name");
  expect(input.getBoundingClientRect().height).toBe(52);
  expect(Number.parseFloat(style(input).fontSize)).toBeGreaterThanOrEqual(16);
});

test("a text field shows hover for a pointer and a focus ring however it's focused", async () => {
  const input = render(<Input label="Course name" />).querySelector("input")!;
  point(input, "pointerover", "touch");
  expect(input.dataset.hovered).toBeUndefined();
  await userEvent.hover(input);
  expect(input.dataset.hovered).toBe("true");
  await userEvent.click(input);
  expect(style(input)).toMatchObject({ outlineStyle: "solid", outlineWidth: "2px" });
});

test("a disabled text field fades and can't be typed in", async () => {
  const input = render(
    <Input label="Instructor" defaultValue="Dr. Haddad" isDisabled />,
  ).querySelector("input")!;
  expect(input.disabled).toBe(true);
  expect(style(input).opacity).toBe("0.4");
});

test("an invalid text field says why, and the message is tied to the field", () => {
  const container = render(
    <Input label="Exam date" isInvalid errorMessage="Pick a date after today." />,
  );
  const input = container.querySelector("input")!;
  expect(input.getAttribute("aria-invalid")).toBe("true");
  const described = (input.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent);
  expect(described).toContain("Pick a date after today.");
});

const OPTIONS = [
  { id: "simply", label: "Simply" },
  { id: "depth", label: "In depth" },
  { id: "revision", label: "Revision" },
];

test("a segmented control keeps exactly one segment selected", async () => {
  const container = render(
    <SegmentedControl aria-label="Explain it" defaultSelected="simply" options={OPTIONS} />,
  );
  const [simply, depth] = [...container.querySelectorAll("button")];
  expect(simply!.getAttribute("aria-checked") ?? simply!.getAttribute("aria-pressed")).toBe("true");
  await userEvent.click(depth!);
  expect(depth!.dataset.selected).toBe("true");
  expect(simply!.dataset.selected).toBeUndefined();
  await userEvent.click(depth!);
  expect(depth!.dataset.selected).toBe("true");
});

test("a segment's touch target reaches the control's edges, 48px tall", () => {
  const container = render(
    <SegmentedControl aria-label="Explain it" defaultSelected="simply" options={OPTIONS} />,
  );
  const group = container.querySelector('[role="radiogroup"], [role="toolbar"]')!;
  const segment = container.querySelectorAll("button")[1]!;
  const box = group.getBoundingClientRect();
  const middle = segment.getBoundingClientRect().left + segment.getBoundingClientRect().width / 2;
  // Just inside the group's 1px border, in its 4px padding.
  for (const y of [box.top + 2, box.bottom - 2]) {
    expect(segment.contains(document.elementFromPoint(middle, y))).toBe(true);
  }
  expect(segment.getBoundingClientRect().height + 8).toBeGreaterThanOrEqual(48);
});

test("in Arabic, the arrow keys follow the right-to-left order", async () => {
  const container = render(
    <LocaleProvider locale="ar">
      <div dir="rtl">
        <SegmentedControl aria-label="اشرحه لي" defaultSelected="simply" options={OPTIONS} />
      </div>
    </LocaleProvider>,
  );
  const [simply, depth] = [...container.querySelectorAll("button")];
  await userEvent.tab();
  expect(document.activeElement).toBe(simply);
  await userEvent.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(depth);
});
