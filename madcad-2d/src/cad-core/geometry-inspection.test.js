import { describe, expect, it } from 'vitest';
import { DRAFT_DIRECTIONS, analyzeDraftAngles, analyzeWallThickness } from './geometry-inspection.js';

describe('draft angle analysis', () => {
  it('classifies positive, negative, neutral and mixed faces from tessellated normals', () => {
    const body = {
      id: 'body-1',
      triangles: Uint32Array.from([0, 1, 2, 3]),
      normals: Float32Array.from([0, 0, 1, 0, 0, -1, 1, 0, 0, 0.2, 0, 0.98]),
      faceGroups: [
        { topologyId: 'top', start: 0, count: 1 },
        { topologyId: 'bottom', start: 1, count: 1 },
        { topologyId: 'wall', start: 2, count: 1 },
        { topologyId: 'blend', start: 2, count: 2 },
      ],
    };
    const result = analyzeDraftAngles([body], { direction: DRAFT_DIRECTIONS['z-positive'], tolerance: 0.5 });
    expect(result.faces.map((face) => [face.faceId, face.classification])).toEqual([
      ['top', 'positive'], ['bottom', 'negative'], ['wall', 'neutral'], ['blend', 'mixed'],
    ]);
    expect(result.counts).toEqual({ positive: 1, neutral: 1, negative: 1, mixed: 1 });
  });

  it('validates direction and tolerance and reports mesh bodies without face groups', () => {
    expect(() => analyzeDraftAngles([], { direction: [0, 0, 0] })).toThrow(/niezerowym/);
    expect(() => analyzeDraftAngles([], { tolerance: 46 })).toThrow(/0–45/);
    expect(analyzeDraftAngles([{ id: 'mesh', faceGroups: [] }]).unsupportedBodies).toEqual(['mesh']);
  });
});

describe('wall thickness analysis', () => {
  it('measures opposing planes and concentric cylinders against a target', () => {
    const faces = [
      { id: 'outer-top', descriptor: { geometry: 'PLANE', center: [0, 0, 2], normal: [0, 0, 1] } },
      { id: 'inner-top', descriptor: { geometry: 'PLANE', center: [0, 0, 0], normal: [0, 0, -1] } },
      { id: 'outer-cylinder', descriptor: { geometry: 'CYLINDRE', radius: 8, axisOrigin: [0, 0, 0], axisDirection: [0, 0, 1] } },
      { id: 'inner-cylinder', descriptor: { geometry: 'CYLINDRE', radius: 6.4, axisOrigin: [0, 0, 0], axisDirection: [0, 0, 1] } },
    ];
    const result = analyzeWallThickness([{ id: 'shell', topology: { faces }, faceGroups: faces.map((face, index) => ({ topologyId: face.id, start: index * 3, count: 3 })) }], { target: 2, tolerance: 0.25 });
    expect(result.faces.map((face) => [face.faceId, face.thickness, face.classification])).toEqual([
      ['outer-top', 2, 'nominal'],
      ['inner-top', 2, 'nominal'],
      ['outer-cylinder', 1.5999999999999996, 'thin'],
      ['inner-cylinder', 1.5999999999999996, 'thin'],
    ]);
    expect(result.counts).toEqual({ thin: 2, nominal: 2, thick: 0, unknown: 0 });
    expect(result.minimum).toBeCloseTo(1.6);
    expect(result.method).toBe('opposing-surfaces');
  });

  it('reports unsupported faces and validates thresholds', () => {
    const result = analyzeWallThickness([{ id: 'mesh', topology: { faces: [] }, faceGroups: [{ topologyId: 'face-1', start: 0, count: 3 }] }]);
    expect(result.counts.unknown).toBe(1);
    expect(result.unsupportedBodies).toEqual(['mesh']);
    expect(() => analyzeWallThickness([], { target: 0 })).toThrow(/dodatnia/);
    expect(() => analyzeWallThickness([], { target: 2, tolerance: 2 })).toThrow(/mniejsza/);
  });
});
