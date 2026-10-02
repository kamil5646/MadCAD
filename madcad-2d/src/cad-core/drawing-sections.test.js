import { expect, it } from 'vitest';
import { sectionCurveSegments } from './drawing-sections.js';

it('flattens a B-Rep circle independently of any display mesh', () => {
  const radius = 10;
  const segments = sectionCurveSegments((t) => [radius * Math.cos(2 * Math.PI * t), 3, radius * Math.sin(2 * Math.PI * t)], 'front');
  expect(segments.length).toBeGreaterThan(100);
  for (const [first, last] of segments) {
    expect(Math.hypot(...first)).toBeCloseTo(radius, 7);
    expect(radius - Math.hypot((first[0] + last[0]) / 2, (first[1] + last[1]) / 2)).toBeLessThanOrEqual(0.001);
  }
});
