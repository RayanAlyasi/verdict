import { expect, test } from "vitest";
import { pointsFor, spherePoints } from "../components/ui/Globe";

test("the points sit on the sphere, spread evenly", () => {
  const points = spherePoints(180, 0.5, 0.2);
  expect(points).toHaveLength(180);
  for (const { x, y, z } of points) expect(Math.hypot(x, y, z)).toBeCloseTo(1);
  const mean = (axis: "x" | "y" | "z") => points.reduce((sum, p) => sum + p[axis], 0) / 180;
  for (const axis of ["x", "y", "z"] as const) expect(Math.abs(mean(axis))).toBeLessThan(0.02);
});

test.each([
  [90, 0.3, 0.3],
  [180, 0.64, 0.16],
  [200, 0.25, 0.5],
  [260, 0.64, 0.16],
  [180, 0, 0],
  [180, 1, 0],
  [180, 0, 1],
])("%d points at %d mastered and %d in progress light exactly that share", (count, ...shares) => {
  const [mastered = 0, inProgress = 0] = shares;
  const points = spherePoints(count, mastered, inProgress);
  const lit = (kind: string) => points.filter((point) => point.kind === kind).length;
  expect(Math.abs(lit("mastered") - count * mastered)).toBeLessThanOrEqual(1);
  expect(Math.abs(lit("progress") - count * inProgress)).toBeLessThanOrEqual(1);
});

// The largest group of one kind in which each point touches another, going by its six nearest.
function largestClump(points: ReturnType<typeof spherePoints>, kind: string) {
  const distance = (a: number, b: number) => {
    const [p, q] = [points[a]!, points[b]!];
    return Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
  };
  const indexes = points.map((_, index) => index);
  const neighbours = indexes.map((index) =>
    [...indexes].sort((a, b) => distance(index, a) - distance(index, b)).slice(1, 7),
  );
  const seen = new Set<number>();
  let largest = 0;
  for (const start of indexes) {
    if (points[start]!.kind !== kind || seen.has(start)) continue;
    const stack = [start];
    seen.add(start);
    let size = 0;
    while (stack.length) {
      size += 1;
      for (const next of neighbours[stack.pop()!]!) {
        if (points[next]!.kind === kind && !seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    largest = Math.max(largest, size);
  }
  return largest;
}

test.each([90, 180, 260])("with %d points, no kind gathers in a clump", (count) => {
  const points = spherePoints(count, 0.64, 0.16);
  expect(largestClump(points, "progress")).toBeLessThanOrEqual(3);
  expect(largestClump(points, "not-started")).toBeLessThanOrEqual(3);
});

test("only mastered points pulse, about a third of them", () => {
  const points = spherePoints(180, 0.64, 0.16);
  const mastered = points.filter((point) => point.kind === "mastered");
  const pulsing = points.filter((point) => point.pulses);
  expect(pulsing.every((point) => point.kind === "mastered")).toBe(true);
  expect(pulsing.length / mastered.length).toBeCloseTo(1 / 3, 1);
});

test("a growing share only ever lights more points", () => {
  const before = spherePoints(180, 0.3, 0);
  const after = spherePoints(180, 0.4, 0);
  before.forEach((point, index) => {
    if (point.kind === "mastered") expect(after[index]?.kind).toBe("mastered");
  });
});

test("low-memory devices get half the points; unknown memory keeps them all", () => {
  expect(pointsFor(180, 2)).toBe(90);
  expect(pointsFor(180, 4)).toBe(180);
  expect(pointsFor(180, undefined)).toBe(180);
});
