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
  [0.64, 0.16],
  [0, 0],
  [1, 0],
  [0, 1],
  [0.25, 0.5],
])("%d mastered and %d in progress light that share of the points", (mastered, inProgress) => {
  const points = spherePoints(200, mastered, inProgress);
  const count = (kind: string) => points.filter((point) => point.kind === kind).length;
  expect(Math.abs(count("mastered") - 200 * mastered)).toBeLessThanOrEqual(2);
  expect(Math.abs(count("progress") - 200 * inProgress)).toBeLessThanOrEqual(2);
});

test("each kind scatters over the globe instead of filling a slice of it", () => {
  const points = spherePoints(180, 0.64, 0.16);
  const quadrants = [0, 1, 2, 3].map((quadrant) =>
    points.filter(
      ({ x, z }) => Math.floor(((Math.atan2(z, x) + Math.PI) / (2 * Math.PI)) * 4) === quadrant,
    ),
  );
  for (const quadrant of quadrants) {
    const share = quadrant.filter((point) => point.kind === "mastered").length / quadrant.length;
    expect(share).toBeGreaterThan(0.45);
    expect(share).toBeLessThan(0.83);
  }
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
