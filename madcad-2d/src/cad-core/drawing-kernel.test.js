// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import init from 'replicad-opencascadejs';
import { makeBezierCurve, makeSphere, setOC } from 'replicad';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { kernelDrawingCurveSegments, projectExactSections } from './drawing-sections.js';

beforeAll(async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  vi.stubGlobal('require', createRequire(import.meta.url));
  vi.stubGlobal('__dirname', root);
  const oc = await init({ wasmBinary: fs.readFileSync(path.join(root, 'node_modules/replicad-opencascadejs/dist/replicad_single.wasm')) });
  setOC(oc);
});
afterAll(() => vi.unstubAllGlobals());

it('uses actual B-Rep sphere sections independently of display tessellation', () => {
  const shape = makeSphere(10);
  try {
    const sections = projectExactSections([{ id: 'sphere', shape }], [{ type: 'section', orientation: 'front', sectionPosition: 0.5 }]);
    const segments = Object.values(sections)[0].segments;
    expect(segments.length).toBeGreaterThan(100);
    for (const [first, last] of segments) {
      expect(Math.hypot(...first)).toBeCloseTo(10, 7);
      expect(10 - Math.hypot((first[0] + last[0]) / 2, (first[1] + last[1]) / 2)).toBeLessThanOrEqual(0.001);
    }
  } finally { shape.delete(); }
});

it('flattens an actual S-shaped Bezier through kernel deflection, not midpoint coincidence', () => {
  const edge = makeBezierCurve([[0, 0, 0], [1, 10, 0], [2, -10, 0], [3, 0, 0]]);
  try {
    const segments = kernelDrawingCurveSegments(edge, (point) => point.slice(0, 2), 0.001);
    expect(segments.length).toBeGreaterThan(20);
    let segmentIndex = 0;
    for (let index = 0; index <= 1000; index += 1) {
      const vector = edge.pointAt(index / 1000);
      try {
        while (segmentIndex < segments.length - 1 && segments[segmentIndex][1][0] < vector.x) segmentIndex += 1;
        const [first, last] = segments[segmentIndex];
        const dx = last[0] - first[0];
        const dy = last[1] - first[1];
        const error = Math.abs(dx * (vector.y - first[1]) - dy * (vector.x - first[0])) / Math.hypot(dx, dy);
        expect(error).toBeLessThanOrEqual(0.001);
      } finally { vector.delete(); }
    }
  } finally { edge.delete(); }
});
