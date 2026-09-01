import { describe, expect, it } from 'vitest';
import { analyzeSurfaceContinuity, calculateMeshCurvature, createCurvatureColors, createCurvatureCombVertices } from './surface-analysis.js';

function twoFaceBody(secondNormal = [0, 0, 1]) {
  return {
    id: 'body-1',
    vertices: new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      1, 0, 0, 1, 1, 0, 0, 1, 0,
    ]),
    normals: new Float32Array([
      0, 0, 1, 0, 0, 1, 0, 0, 1,
      ...secondNormal, ...secondNormal, ...secondNormal,
    ]),
    triangles: new Uint32Array([0, 1, 2, 3, 4, 5]),
    faceGroups: [
      { topologyId: 'face-a', start: 0, count: 3 },
      { topologyId: 'face-b', start: 3, count: 3 },
    ],
  };
}

describe('surface continuity analysis', () => {
  it('recognizes a smooth shared tessellation seam', () => {
    const result = analyzeSurfaceContinuity([twoFaceBody()]);
    expect(result.counts).toEqual({ smooth: 1, warning: 0, sharp: 0 });
    expect(result.seams[0].faceIds).toEqual(['face-a', 'face-b']);
  });

  it('recognizes a sharp seam from the boundary normals', () => {
    const result = analyzeSurfaceContinuity([twoFaceBody([1, 0, 0])]);
    expect(result.counts).toEqual({ smooth: 0, warning: 0, sharp: 1 });
    expect(result.seams[0].angle).toBeCloseTo(90);
  });

  it('reports bodies without face tessellation separately', () => {
    const result = analyzeSurfaceContinuity([{ id: 'mesh', vertices: new Float32Array(), triangles: new Uint32Array() }]);
    expect(result.seams).toEqual([]);
    expect(result.unsupportedBodyIds).toEqual(['mesh']);
  });

  it('returns zero curvature for a planar face', () => {
    const body = twoFaceBody();
    const analysis = calculateMeshCurvature(body);
    expect(analysis.maximum).toBeCloseTo(0);
    expect([...createCurvatureColors(body).colors.slice(0, 3)]).toEqual(expect.arrayContaining([
      expect.closeTo(0.05, 5), expect.closeTo(0.2, 5), expect.closeTo(0.62, 5),
    ]));
  });

  it('detects normal change per unit length on a curved mesh', () => {
    const body = twoFaceBody();
    body.normals.set([0, Math.SQRT1_2, Math.SQRT1_2], 3);
    const analysis = calculateMeshCurvature(body);
    expect(analysis.maximum).toBeGreaterThan(0);
  });

  it('creates a comb spike where two curve segments change direction', () => {
    const vertices = createCurvatureCombVertices(new Float32Array([
      0, 0, 0, 1, 0, 0,
      1, 0, 0, 1, 1, 0,
    ]), 2);
    expect([...vertices.slice(0, 3)]).toEqual([1, 0, 0]);
    expect(vertices.length).toBe(6);
    expect(vertices[3]).toBeCloseTo(-1);
    expect(vertices[4]).toBeCloseTo(2);
  });
});
