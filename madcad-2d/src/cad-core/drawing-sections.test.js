import { expect, it } from 'vitest';
import { flattenDrawingCurve, sectionCurveSegments } from './drawing-sections.js';
import { drawingProjectionTolerance } from './drawing-projections.js';

it('flattens a B-Rep circle independently of any display mesh', () => {
  const radius = 10;
  const segments = sectionCurveSegments((t) => [radius * Math.cos(2 * Math.PI * t), 3, radius * Math.sin(2 * Math.PI * t)], 'front');
  expect(segments.length).toBeGreaterThan(100);
  for (const [first, last] of segments) {
    expect(Math.hypot(...first)).toBeCloseTo(radius, 7);
    expect(radius - Math.hypot((first[0] + last[0]) / 2, (first[1] + last[1]) / 2)).toBeLessThanOrEqual(0.001);
  }
});

it('keeps a 200 mm circle within paper-space tolerance even at 10x drawing scale', () => {
  const scale = 10;
  const tolerance = drawingProjectionTolerance([{ views: [{ scale }] }]);
  const segments = flattenDrawingCurve((t) => [100 * Math.cos(2 * Math.PI * t), 100 * Math.sin(2 * Math.PI * t)], tolerance);
  expect(segments.length).toBeGreaterThan(1000);
  for (const [first, last] of segments) {
    const sag = 100 - Math.hypot((first[0] + last[0]) / 2, (first[1] + last[1]) / 2);
    expect(sag * scale).toBeLessThanOrEqual(0.001);
  }
});

it('finds S-shaped deviation even when each initial interval midpoint is on its chord', () => {
  const point = (t) => [t, Math.sin(16 * Math.PI * t)];
  const segments = flattenDrawingCurve(point, 0.001);
  expect(segments.length).toBeGreaterThan(100);
  let segmentIndex = 0;
  for (let index = 0; index <= 10000; index += 1) {
    const t = index / 10000;
    while (segmentIndex < segments.length - 1 && segments[segmentIndex][1][0] < t) segmentIndex += 1;
    const [first, last] = segments[segmentIndex];
    const ratio = (t - first[0]) / (last[0] - first[0]);
    expect(Math.abs(point(t)[1] - (first[1] + (last[1] - first[1]) * ratio))).toBeLessThanOrEqual(0.001);
  }
});
