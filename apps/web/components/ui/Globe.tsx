"use client";

import { useEffect, useRef } from "react";

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
// Neighbours on the sphere are 3, 5, 8 or 13 places apart, and this step sends those far apart in
// the sequence, so no kind gathers in a clump.
const SCATTER = 0.273;
const SPIN_SECONDS = 26;
const ORBIT_SECONDS = 9;
const PULSE_SECONDS = 2;

// As fractions of the canvas, from the approved designs.
const SPHERE_RADIUS = 0.357;
const POINT_RADIUS = 0.012;
const ORBIT_RADIUS = 0.478;
// The share of the sphere's radius by which its nearest points look larger.
const PERSPECTIVE = 0.131;

// The point count POINT_RADIUS is for. Fewer points are drawn larger, so the sphere still reads.
const BASE_POINTS = 180;
const SATELLITE_RADIUS_PX = 7;

const TILT = (-16 * Math.PI) / 180;
const ORBIT_ROLL = (-14 * Math.PI) / 180;
const ORBIT_SQUASH = Math.cos((74 * Math.PI) / 180);
const MAX_PIXEL_RATIO = 2;

export type PointKind = "mastered" | "progress" | "not-started";
export type GlobePoint = {
  x: number;
  y: number;
  z: number;
  kind: PointKind;
  place: number;
  pulses: boolean;
};

// Fewer points where memory is short; browsers without navigator.deviceMemory get them all.
export function pointsFor(requested: number, deviceMemory?: number) {
  return deviceMemory !== undefined && deviceMemory < 4 ? Math.round(requested / 2) : requested;
}

// A Fibonacci sphere spreads points evenly. A second sequence ranks them, and the ranks set each
// point's kind, so the shares are exact and a growing share lights points one at a time. A third
// of the mastered points pulse.
export function spherePoints(count: number, mastered: number, inProgress: number): GlobePoint[] {
  const placeOf = (index: number) => ((index + 1) * SCATTER) % 1;
  const ranks = new Map(
    Array.from({ length: count }, (_, index) => index)
      .sort((a, b) => placeOf(a) - placeOf(b))
      .map((index, rank) => [index, rank / count]),
  );
  return Array.from({ length: count }, (_, index) => {
    const y = 1 - (2 * (index + 0.5)) / count;
    const radius = Math.sqrt(1 - y * y);
    const angle = index * GOLDEN_ANGLE;
    const rank = ranks.get(index) ?? 0;
    const kind =
      rank < mastered ? "mastered" : rank < mastered + inProgress ? "progress" : "not-started";
    return {
      x: Math.cos(angle) * radius,
      y,
      z: Math.sin(angle) * radius,
      kind,
      place: placeOf(index),
      pulses: kind === "mastered" && index % 3 === 0,
    };
  });
}

// Drawn once, then only copied, so a frame never recalculates a blur.
function prepared(size: number, paint: (context: CanvasRenderingContext2D) => void) {
  const image = document.createElement("canvas");
  image.width = image.height = Math.ceil(size);
  const context = image.getContext("2d");
  if (context) paint(context);
  return image;
}

function disc(radius: number, color: string, glow: number) {
  const size = (radius + glow) * 2;
  return prepared(size, (context) => {
    context.fillStyle = color;
    context.shadowColor = color;
    context.shadowBlur = glow;
    context.beginPath();
    context.arc(size / 2, size / 2, radius, 0, TAU);
    context.fill();
  });
}

function scene(
  canvas: HTMLCanvasElement,
  points: GlobePoint[],
  orbit: boolean,
  pixelRatio: number,
) {
  const size = canvas.width;
  const color = (name: string) =>
    getComputedStyle(canvas).getPropertyValue(`--color-${name}`).trim();
  const pointRadius = size * POINT_RADIUS * Math.sqrt(BASE_POINTS / points.length);
  const sphere = size * SPHERE_RADIUS;
  const satelliteRadius = SATELLITE_RADIUS_PX * pixelRatio;
  const halo = prepared(size, (context) => {
    const center = size / 2;
    // Lit from the upper left, and cut off just outside the sphere, so its edge reads as a rim.
    context.beginPath();
    context.arc(center, center, sphere * 1.06, 0, TAU);
    context.clip();
    const lightX = center - sphere * 0.21;
    const lightY = center - sphere * 0.32;
    const gradient = context.createRadialGradient(lightX, lightY, 0, lightX, lightY, sphere * 1.22);
    gradient.addColorStop(0, color("glow"));
    gradient.addColorStop(1, `${color("glow")}00`);
    context.globalAlpha = 0.18;
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  });
  const ring = prepared(size, (context) => {
    context.strokeStyle = color("text-muted");
    context.globalAlpha = 0.3;
    context.lineWidth = size * 0.0045;
    // A circle stroked under the squash, so the line thins where the ring turns away.
    context.translate(size / 2, size / 2);
    context.rotate(ORBIT_ROLL);
    context.scale(1, ORBIT_SQUASH);
    context.beginPath();
    context.arc(0, 0, size * ORBIT_RADIUS, 0, TAU);
    context.stroke();
  });
  const sprites: Record<PointKind, HTMLCanvasElement> = {
    mastered: disc(pointRadius, color("glow"), pointRadius * 2),
    progress: disc(pointRadius, color("amber"), pointRadius * 1.5),
    "not-started": disc(pointRadius, color("dim"), 0),
  };
  return {
    size,
    sphere,
    points,
    orbit,
    halo,
    ring,
    sprites,
    pulse: disc(pointRadius, color("glow"), pointRadius * 3.5),
    satellite: disc(satelliteRadius, color("text"), satelliteRadius),
  };
}

function draw(context: CanvasRenderingContext2D, world: ReturnType<typeof scene>, seconds: number) {
  const { size, sphere, sprites, pulse, satellite } = world;
  const center = size / 2;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, size, size);
  context.drawImage(world.halo, 0, 0);

  const spin = (seconds / SPIN_SECONDS) * TAU;
  const [sinSpin, cosSpin] = [Math.sin(spin), Math.cos(spin)];
  const [sinTilt, cosTilt] = [Math.sin(TILT), Math.cos(TILT)];
  for (const point of world.points) {
    const x = point.x * cosSpin + point.z * sinSpin;
    const turned = point.z * cosSpin - point.x * sinSpin;
    const y = point.y * cosTilt - turned * sinTilt;
    const z = point.y * sinTilt + turned * cosTilt;
    if (z <= 0) continue;
    // A flat dot on the surface: squeezed along the line from the centre as it nears the edge.
    const fromCenter = Math.hypot(x, y) || 1;
    const [outX, outY] = [x / fromCenter, y / fromCenter];
    const near = 1 / (1 - z * PERSPECTIVE);
    context.setTransform(
      outX * z * near,
      outY * z * near,
      -outY * near,
      outX * near,
      center + x * sphere * near,
      center + y * sphere * near,
    );
    const sprite = sprites[point.kind];
    context.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
    if (point.pulses) {
      context.globalAlpha = (1 + Math.sin((seconds / PULSE_SECONDS + point.place) * TAU)) / 2;
      context.drawImage(pulse, -pulse.width / 2, -pulse.height / 2);
      context.globalAlpha = 1;
    }
  }

  if (!world.orbit) return;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.drawImage(world.ring, 0, 0);
  const around = (seconds / ORBIT_SECONDS) * TAU;
  const radius = size * ORBIT_RADIUS;
  const [ringX, ringY] = [Math.cos(around) * radius, Math.sin(around) * radius * ORBIT_SQUASH];
  const [sinRoll, cosRoll] = [Math.sin(ORBIT_ROLL), Math.cos(ORBIT_ROLL)];
  context.setTransform(
    cosRoll,
    sinRoll,
    -sinRoll * ORBIT_SQUASH,
    cosRoll * ORBIT_SQUASH,
    center + ringX * cosRoll - ringY * sinRoll,
    center + ringX * sinRoll + ringY * cosRoll,
  );
  context.drawImage(satellite, -satellite.width / 2, -satellite.height / 2);
}

// The course as a sphere of lights, on one canvas. It only shows mastery to people who can see it,
// so it's hidden from screen readers: always pair it with a plain-language line and <GlobeLegend>.
// `mastered` and `inProgress` are shares of the points, from 0 to 1.
export function Globe({
  points = 180,
  mastered,
  inProgress,
  orbit = false,
  className = "",
}: {
  points?: number;
  mastered: number;
  inProgress: number;
  orbit?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const lights = spherePoints(pointsFor(points, memory), mastered, inProgress);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let world: ReturnType<typeof scene> | undefined;
    let seconds = 0;
    let previous = 0;
    let frame = 0;
    let onScreen = false;
    let density: MediaQueryList | undefined;

    const tick = (now: number) => {
      seconds += (now - previous) / 1000;
      previous = now;
      if (world) draw(context, world, seconds);
      frame = requestAnimationFrame(tick);
    };
    const update = () => {
      const run = onScreen && !document.hidden && !reducedMotion.matches;
      if (run && !frame) {
        previous = performance.now();
        frame = requestAnimationFrame(tick);
      } else if (!run && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };
    const resize = () => {
      const pixelRatio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
      const size = Math.round(canvas.clientWidth * pixelRatio);
      if (!size) return;
      canvas.width = canvas.height = size;
      world = scene(canvas, lights, orbit, pixelRatio);
      draw(context, world, seconds);
    };
    // A new pixel ratio, on another screen or at another zoom, isn't a change of CSS size.
    const watchDensity = () => {
      density = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      density.addEventListener("change", densityChanged, { once: true });
    };
    const densityChanged = () => {
      resize();
      watchDensity();
    };

    const sized = new ResizeObserver(resize);
    const visible = new IntersectionObserver((entries) => {
      onScreen = entries.at(-1)?.isIntersecting ?? onScreen;
      update();
    });
    sized.observe(canvas);
    visible.observe(canvas);
    document.addEventListener("visibilitychange", update);
    reducedMotion.addEventListener("change", update);
    watchDensity();
    return () => {
      cancelAnimationFrame(frame);
      sized.disconnect();
      visible.disconnect();
      document.removeEventListener("visibilitychange", update);
      reducedMotion.removeEventListener("change", update);
      density?.removeEventListener("change", densityChanged);
    };
  }, [points, mastered, inProgress, orbit]);

  return (
    <canvas ref={ref} aria-hidden="true" className={`block aspect-square w-full ${className}`} />
  );
}
