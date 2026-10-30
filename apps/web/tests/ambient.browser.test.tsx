import { afterEach, expect, test, vi } from "vitest";
import { Globe } from "../components/ui/Globe";
import { SpaceBackground } from "../components/ui/SpaceBackground";
import { nextFrames, render } from "./render";

afterEach(() => {
  vi.restoreAllMocks();
});

function globe(props: Partial<Parameters<typeof Globe>[0]> = {}, marginTop = "0") {
  const canvas = render(
    <div style={{ width: 300, marginTop }}>
      <Globe mastered={0.6} inProgress={0.2} {...props} />
    </div>,
  ).querySelector("canvas")!;
  return canvas;
}

const painted = (canvas: HTMLCanvasElement) =>
  expect.poll(() => canvas.width, { timeout: 2000 }).toBeGreaterThan(300 - 1);

async function changesOverFrames(canvas: HTMLCanvasElement) {
  const before = canvas.toDataURL();
  await nextFrames(10);
  return canvas.toDataURL() !== before;
}

test("the globe is one canvas, hidden from screen readers, and it turns", async () => {
  const canvas = globe();
  expect(canvas.getAttribute("aria-hidden")).toBe("true");
  await painted(canvas);
  await expect.poll(() => changesOverFrames(canvas)).toBe(true);
});

test("the device pixel ratio is capped at 2", async () => {
  vi.spyOn(window, "devicePixelRatio", "get").mockReturnValue(3);
  const canvas = globe();
  await expect.poll(() => canvas.width).toBe(600);
});

test("a hidden tab stops the globe, and showing it starts again", async () => {
  const canvas = globe();
  await painted(canvas);
  await expect.poll(() => changesOverFrames(canvas)).toBe(true);
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  document.dispatchEvent(new Event("visibilitychange"));
  await nextFrames(2);
  expect(await changesOverFrames(canvas)).toBe(false);
  hidden.mockReturnValue(false);
  document.dispatchEvent(new Event("visibilitychange"));
  await expect.poll(() => changesOverFrames(canvas)).toBe(true);
});

test("off screen, the globe keeps a still frame", async () => {
  const canvas = globe({}, "400vh");
  await painted(canvas);
  await nextFrames(5);
  expect(await changesOverFrames(canvas)).toBe(false);
  const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
  expect(pixels.some((value) => value > 0)).toBe(true);
});

test("with reduced motion, the globe is a still frame", async () => {
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as MediaQueryList);
  const canvas = globe();
  await painted(canvas);
  await nextFrames(5);
  expect(await changesOverFrames(canvas)).toBe(false);
});

test("the orbit ring is optional", async () => {
  const opacityAtRingEdge = (canvas: HTMLCanvasElement) => {
    const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    // Past the sphere's edge, only the ring and its satellite can draw.
    let total = 0;
    const size = canvas.width;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size * 0.06; x += 1) total += data[(y * size + x) * 4 + 3] ?? 0;
    }
    return total;
  };
  const withRing = globe({ orbit: true });
  const without = globe({ orbit: false });
  await painted(withRing);
  await painted(without);
  await expect.poll(() => opacityAtRingEdge(withRing)).toBeGreaterThan(0);
  expect(opacityAtRingEdge(without)).toBe(0);
});

test("the nebula's bitmap is a quarter of its size on screen, and painted", async () => {
  const container = render(<SpaceBackground />);
  const nebula = container.querySelector<HTMLCanvasElement>("[data-testid=nebula]")!;
  expect(nebula.width).toBe(Math.ceil(nebula.clientWidth / 4));
  expect(nebula.height).toBe(Math.ceil(nebula.clientHeight / 4));
  const { data } = nebula.getContext("2d")!.getImageData(0, 0, nebula.width, nebula.height);
  expect(data.some((value) => value > 0)).toBe(true);
});

test("the background sits behind content and ignores the pointer", () => {
  const root = render(<SpaceBackground />).querySelector<HTMLElement>(
    "[data-testid=space-background]",
  )!;
  const style = getComputedStyle(root);
  expect(style.zIndex).toBe("-1");
  expect(style.pointerEvents).toBe("none");
  expect(root.getAttribute("aria-hidden")).toBe("true");
});

test("the background moves only transform and opacity, and pauses in a hidden tab", async () => {
  const root = render(<SpaceBackground />).querySelector<HTMLElement>(
    "[data-testid=space-background]",
  )!;
  const animations = root.getAnimations({ subtree: true });
  expect(animations).toHaveLength(4);
  const ignore = ["offset", "computedOffset", "easing", "composite"];
  for (const animation of animations) {
    for (const frame of (animation.effect as KeyframeEffect).getKeyframes()) {
      for (const property of Object.keys(frame)) {
        if (!ignore.includes(property)) {
          expect(["opacity", "transform", "translate", "scale", "rotate"]).toContain(property);
        }
      }
    }
  }
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  document.dispatchEvent(new Event("visibilitychange"));
  await expect
    .poll(() => animations.every((animation) => animation.playState === "paused"))
    .toBe(true);
});
