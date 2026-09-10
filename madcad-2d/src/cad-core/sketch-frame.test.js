import { describe, expect, it } from 'vitest';
import { createRectangleProfile, createSketch, validateDocument, createDocument, createFeature } from './document.js';
import { frameFromNormal, mapSketchPoint, normalizeSketchFrame, projectWorldPoint, resolveSketchFrame } from './sketch-frame.js';
import { prepareDocument, resolveProfile } from './evaluator.js';
import { createAnglePlane, createOffsetPlane, resolveConstructionPlane } from './construction-planes.js';

describe('arbitrary sketch frames', () => {
  it('maps and projects points on a rotated plane without losing coordinates', () => {
    const frame = frameFromNormal([10, -2, 5], [0, -Math.SQRT1_2, Math.SQRT1_2]);
    const world = mapSketchPoint(frame, 12, -7, 3);
    expect(projectWorldPoint(frame, world)).toEqual(expect.arrayContaining([
      expect.closeTo(12, 8),
      expect.closeTo(-7, 8),
      expect.closeTo(3, 8),
    ]));
  });

  it('orthonormalizes a supplied UCS and preserves right-handed axes', () => {
    const frame = normalizeSketchFrame({ origin: [0, 0, 0], normal: [0, 1, 1], u: [2, 0.1, -0.1], v: [0, 1, -1] });
    expect(Math.hypot(...frame.u)).toBeCloseTo(1, 8);
    expect(Math.hypot(...frame.v)).toBeCloseTo(1, 8);
    expect(frame.u.reduce((sum, value, index) => sum + value * frame.normal[index], 0)).toBeCloseTo(0, 8);
    const cross = [
      frame.u[1] * frame.v[2] - frame.u[2] * frame.v[1],
      frame.u[2] * frame.v[0] - frame.u[0] * frame.v[2],
      frame.u[0] * frame.v[1] - frame.u[1] * frame.v[0],
    ];
    expect(cross.reduce((sum, value, index) => sum + value * frame.normal[index], 0)).toBeCloseTo(1, 8);
  });

  it('stores and validates the frame and propagates it into an evaluated profile', () => {
    const frame = frameFromNormal([3, 4, 5], [0, -1, 1]);
    const profile = createRectangleProfile({ width: 20, height: 10 });
    const sketch = createSketch({ frame, profiles: [profile] });
    const document = createDocument('UCS');
    document.sketches.push(sketch);
    expect(validateDocument(document).valid).toBe(true);
    const evaluated = resolveProfile(sketch.profiles[0], {}, sketch).frame;
    const resolved = resolveSketchFrame(sketch);
    for (const key of ['origin', 'normal', 'u', 'v']) evaluated[key].forEach((value, index) => expect(value).toBeCloseTo(resolved[key][index], 8));
  });

  it('rebuilds an extrusion when its angled construction-plane support changes', () => {
    const document = createDocument('Skojarzony UCS');
    const support = createAnglePlane({ basePlane: 'XY', rotationAxis: 'u', angle: '30', offset: '4' });
    const initial = resolveConstructionPlane(support);
    const profile = createRectangleProfile({ width: 20, height: 10 });
    const sketch = createSketch({ frame: initial, support: { kind: 'construction-plane', referenceId: support.id }, profiles: [profile] });
    document.references.push(support);
    document.sketches.push(sketch);
    document.features.push(createFeature('extrude', { sketchId: sketch.id, profileIds: [sketch.profiles[0].id], distance: '8', operation: 'new' }));
    const before = prepareDocument(document).features[0].profiles[0].frame;
    support.angle = '60';
    support.offset = '12';
    const after = prepareDocument(document).features[0].profiles[0].frame;
    expect(before.normal[1]).toBeCloseTo(-0.5, 8);
    expect(after.normal[1]).toBeCloseTo(-Math.sin(Math.PI / 3), 8);
    expect(after.origin).toEqual([0, 0, 12]);
  });

  it('keeps an axis-aligned supported sketch associative without converting it to UCS', () => {
    const document = createDocument('Skojarzone odsunięcie');
    const support = createOffsetPlane({ basePlane: 'YZ', offset: '7' });
    const profile = createRectangleProfile({ width: 6, height: 4 });
    const sketch = createSketch({ plane: 'YZ', planeOffset: '7', support: { kind: 'construction-plane', referenceId: support.id }, profiles: [profile] });
    document.references.push(support);
    document.sketches.push(sketch);
    document.features.push(createFeature('extrude', { sketchId: sketch.id, profileIds: [sketch.profiles[0].id], distance: '3', operation: 'new' }));
    support.offset = '19';
    const prepared = prepareDocument(document).features[0].profiles[0];
    expect(prepared.frame).toBeUndefined();
    expect(prepared.plane).toBe('YZ');
    expect(prepared.planeOffset).toBe(19);
  });
});
