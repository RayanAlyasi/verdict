"use client";

import { useEffect, useRef } from "react";

// The nebula token as shapes a canvas can draw; tests/tokens.node.test.ts keeps the two equal.
export const NEBULA = [
  { x: 22, y: 28, width: 32, height: 26, rgb: "60,196,162", alpha: ".13" },
  { x: 78, y: 66, width: 30, height: 24, rgb: "88,118,255", alpha: ".12" },
  { x: 60, y: 18, width: 24, height: 20, rgb: "227,168,74", alpha: ".06" },
];

// A quarter of the size on a canvas, whose bitmap stays that small however far it's scaled up.
// A scaled-down element wouldn't help: the browser rasterises it at its size on screen.
function paintNebula(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const width = Math.ceil(canvas.clientWidth / 4);
  const height = Math.ceil(canvas.clientHeight / 4);
  canvas.width = width;
  canvas.height = height;
  for (const shape of NEBULA) {
    // A unit circle, stretched into the CSS gradient's ellipse.
    context.setTransform(
      (shape.width / 100) * width,
      0,
      0,
      (shape.height / 100) * height,
      (shape.x / 100) * width,
      (shape.y / 100) * height,
    );
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, `rgba(${shape.rgb},${shape.alpha})`);
    gradient.addColorStop(0.7, `rgba(${shape.rgb},0)`);
    context.fillStyle = gradient;
    context.fillRect(-1, -1, 2, 2);
  }
}

// One element's box-shadows, painted once and then only faded. A fixed seed, so the server and the
// browser agree on where the stars are.
function stars(seed: number, count: number) {
  let state = seed;
  const random = () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
  return Array.from({ length: count }, () => {
    const x = (random() * 100).toFixed(1);
    const y = (random() * 100).toFixed(1);
    const spread = [0, 0.25, 0.5][Math.floor(random() * 3)];
    const alpha = [0.5, 0.7, 0.9][Math.floor(random() * 3)];
    return `${x}vw ${y}lvh 0 ${spread}px rgba(255,255,255,${alpha})`;
  }).join(",");
}

const STARS_A = stars(11, 42);
const STARS_B = stars(29, 42);

// Behind everything, in the isolated stacking context the root layout gives it. Large viewport
// units keep the stars still when a phone's address bar collapses. Left to right in both
// languages: it's a picture, and the stars' offsets run from the left.
export function SpaceBackground() {
  const root = useRef<HTMLDivElement>(null);
  const nebula = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (nebula.current) paintNebula(nebula.current);
    const pause = () => root.current?.toggleAttribute("data-paused", document.hidden);
    pause();
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, []);

  return (
    <div
      ref={root}
      aria-hidden="true"
      dir="ltr"
      data-testid="space-background"
      className="pointer-events-none fixed inset-x-0 top-0 -z-1 h-lvh overflow-hidden bg-space-background data-paused:**:[animation-play-state:paused]"
    >
      <canvas
        ref={nebula}
        data-testid="nebula"
        className="absolute -start-1/4 -top-1/4 h-[150%] w-[150%] motion-safe:animate-nebula-drift"
      />
      <span
        className="absolute start-0 top-0 size-px rounded-pill motion-safe:animate-twinkle-a"
        style={{ boxShadow: STARS_A }}
      />
      <span
        className="absolute start-0 top-0 size-px rounded-pill motion-safe:animate-twinkle-b"
        style={{ boxShadow: STARS_B }}
      />
      <span className="absolute -end-[8%] top-[10%] h-0.5 w-37 rotate-[-24deg] rounded-pill bg-linear-to-r from-text/95 to-transparent opacity-0 motion-safe:animate-shooting-star" />
    </div>
  );
}
