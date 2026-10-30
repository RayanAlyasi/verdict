import { afterEach, expect, test, vi } from "vitest";
import { Globe } from "../components/ui/Globe";
import { GlobeLegend } from "../components/ui/GlobeLegend";
import { SpaceBackground } from "../components/ui/SpaceBackground";
import { nextFrames, render } from "./render";

afterEach(() => {
  vi.restoreAllMocks();
  delete (navigator as { deviceMemory?: number }).deviceMemory;
});

function globe(props: Partial<Parameters<typeof Globe>[0]> = {}, marginTop = "0") {
  return render(
    <div style={{ width: 300, marginTop }}>
      <Globe mastered={0.6} inProgress={0.2} {...props} />
    </div>,
  ).querySelector("canvas")!;
}

const pixels = (canvas: HTMLCanvasElement) =>
  canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;

const isBlank = (canvas: HTMLCanvasElement) => !pixels(canvas).some((value) => value > 0);

const painted = (canvas: HTMLCanvasElement) =>
  expect.poll(() => isBlank(canvas), { timeout: 2000 }).toBe(false);

// Solid pixels of a colour, ignoring the faint glows and the halo.
function solid(canvas: HTMLCanvasElement, [red, green, blue]: [number, number, number]) {
  const data = pixels(canvas);
  let count = 0;
  for (let index = 0; index < data.length; index += 4) {
    const near = (offset: number, value: number) =>
      Math.abs((data[index + offset] ?? 0) - value) < 16;
    if ((data[index + 3] ?? 0) > 200 && near(0, red) && near(1, green) && near(2, blue)) count += 1;
  }
  return count;
}

const GLOW: [number, number, number] = [60, 196, 162];
const AMBER: [number, number, number] = [227, 168, 74];

async function changesOverFrames(canvas: HTMLCanvasElement) {
  const before = canvas.toDataURL();
  await nextFrames(10);
  return canvas.toDataURL() !== before;
}

function reduceMotion() {
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as MediaQueryList);
}

test("the globe is one canvas, hidden from screen readers, and it turns", async () => {
  const container = render(
    <div style={{ width: 300 }}>
      <Globe mastered={0.6} inProgress={0.2} />
    </div>,
  );
  expect(container.querySelectorAll("canvas")).toHaveLength(1);
  const canvas = container.querySelector("canvas")!;
  expect(canvas.getAttribute("aria-hidden")).toBe("true");
  await painted(canvas);
  await expect.poll(() => changesOverFrames(canvas)).toBe(true);
});

test("the mastery split reaches the canvas", async () => {
  const mastered = globe({ mastered: 1, inProgress: 0 });
  const inProgress = globe({ mastered: 0, inProgress: 1 });
  const notStarted = globe({ mastered: 0, inProgress: 0 });
  await Promise.all([painted(mastered), painted(inProgress), painted(notStarted)]);
  expect(solid(mastered, GLOW)).toBeGreaterThan(100);
  expect(solid(mastered, AMBER)).toBe(0);
  expect(solid(inProgress, AMBER)).toBeGreaterThan(100);
  expect(solid(inProgress, GLOW)).toBe(0);
  expect(solid(notStarted, GLOW) + solid(notStarted, AMBER)).toBe(0);
});

test("low-memory devices draw half the points", async () => {
  reduceMotion();
  const draws = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage");
  const drawsWith = async (memory: number) => {
    Object.defineProperty(navigator, "deviceMemory", { value: memory, configurable: true });
    draws.mockClear();
    await painted(globe({ points: 200 }));
    return draws.mock.calls.length;
  };
  const plenty = await drawsWith(8);
  const short = await drawsWith(2);
  expect(short / plenty).toBeGreaterThan(0.4);
  expect(short / plenty).toBeLessThan(0.65);
});

test("the glow is an image prepared once, not redrawn each frame", async () => {
  const canvas = globe({ orbit: true });
  await painted(canvas);
  const created = vi.spyOn(document, "createElement");
  await nextFrames(10);
  expect(created).not.toHaveBeenCalled();
});

test("the device pixel ratio is capped at 2", async () => {
  vi.spyOn(window, "devicePixelRatio", "get").mockReturnValue(3);
  const canvas = globe();
  await expect.poll(() => canvas.width).toBe(600);
});

test("a new pixel ratio redraws the globe, and the next change is watched too", async () => {
  const ratio = vi.spyOn(window, "devicePixelRatio", "get").mockReturnValue(1);
  const listeners = new Map<string, () => void>();
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        matches: false,
        addEventListener: (_: string, listener: () => void) => listeners.set(query, listener),
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
  const canvas = globe();
  await painted(canvas);
  expect(canvas.width).toBe(300);
  ratio.mockReturnValue(2);
  listeners.get("(resolution: 1dppx)")?.();
  expect(canvas.width).toBe(600);
  expect(listeners.has("(resolution: 2dppx)")).toBe(true);
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
});

test("with reduced motion, the globe is a still frame", async () => {
  reduceMotion();
  const canvas = globe();
  await painted(canvas);
  await nextFrames(5);
  expect(await changesOverFrames(canvas)).toBe(false);
});

test("the orbit ring is optional", async () => {
  // Past the sphere's edge, only the ring and its satellite can draw.
  const beyondTheSphere = (canvas: HTMLCanvasElement) => {
    const data = pixels(canvas);
    const size = canvas.width;
    let total = 0;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size * 0.06; x += 1) total += data[(y * size + x) * 4 + 3] ?? 0;
    }
    return total;
  };
  const withRing = globe({ orbit: true });
  const without = globe({ orbit: false });
  await painted(withRing);
  await painted(without);
  await expect.poll(() => beyondTheSphere(withRing)).toBeGreaterThan(0);
  expect(beyondTheSphere(without)).toBe(0);
});

test("the legend stays in HTML, with its lights hidden behind their words", () => {
  const container = render(
    <GlobeLegend
      caption="Each light is one idea from your course"
      mastered="Mastered"
      progress="In progress"
      notStarted="Not started"
    />,
  );
  expect(container.querySelector("p")?.textContent).toBe("Each light is one idea from your course");
  expect([...container.querySelectorAll("li")].map((item) => item.textContent)).toEqual([
    "Mastered",
    "In progress",
    "Not started",
  ]);
  const lights = container.querySelectorAll("li span");
  expect(lights).toHaveLength(3);
  for (const light of lights) expect(light.getAttribute("aria-hidden")).toBe("true");
});

test("the nebula's bitmap is a quarter of its size on screen, and painted", () => {
  const nebula = render(<SpaceBackground />).querySelector<HTMLCanvasElement>(
    "[data-testid=nebula]",
  )!;
  expect(nebula.width).toBe(Math.ceil(nebula.clientWidth / 4));
  expect(nebula.height).toBe(Math.ceil(nebula.clientHeight / 4));
  expect(isBlank(nebula)).toBe(false);
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
