import { describe, expect, it } from 'vitest';
import { DRAFT_DIRECTIONS, analyzeDraftAngles } from './geometry-inspection.js';

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
