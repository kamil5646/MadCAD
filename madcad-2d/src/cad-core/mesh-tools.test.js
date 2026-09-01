import { describe, expect, it } from 'vitest';
import { groupMeshFaces, inspectMesh, meshToBinaryStl, reduceMesh, remeshUniform, repairMesh, smoothMesh } from './mesh-tools.js';
import { parseStlMesh } from './model-import.js';

describe('mesh diagnostics and safe repair', () => {
  const dirty = {
    vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 2, 2],
    triangles: [0, 1, 2, 3, 4, 5, 0, 0, 1],
  };

  it('reports duplicate vertices, triangles and degenerates', () => {
    expect(inspectMesh(dirty)).toMatchObject({ duplicateVertices: 3, duplicateTriangles: 1, degenerateTriangles: 1 });
  });

  it('welds and removes unsafe triangles without changing the valid surface', () => {
    const result = repairMesh(dirty);
    expect(result.after).toMatchObject({ vertexCount: 3, triangleCount: 1, duplicateTriangles: 0, degenerateTriangles: 0 });
    expect(result.mesh.triangles).toEqual([0, 1, 2]);
  });

  it('writes a repaired mesh back to binary STL', () => {
    const repaired = repairMesh(dirty).mesh;
    const parsed = parseStlMesh(meshToBinaryStl(repaired));
    expect(parsed.triangles).toHaveLength(3);
    expect(parsed.vertices).toHaveLength(9);
  });

  it('reduces a regular mesh toward the requested triangle ratio', () => {
    const vertices = [];
    const triangles = [];
    for (let y = 0; y <= 8; y += 1) for (let x = 0; x <= 8; x += 1) vertices.push(x, y, 0);
    for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) {
      const a = y * 9 + x;
      const b = a + 1;
      const c = a + 9;
      const d = c + 1;
      triangles.push(a, b, d, a, d, c);
    }
    const result = reduceMesh({ vertices, triangles }, 0.5);
    expect(result.before.triangleCount).toBe(128);
    expect(result.after.triangleCount).toBeLessThan(result.before.triangleCount);
    expect(result.after.triangleCount).toBeGreaterThan(20);
    expect(result.after.degenerateTriangles).toBe(0);
  });

  it('smooths the interior while protecting open boundary vertices', () => {
    const mesh = {
      vertices: [0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 1, 0, 1, 1, 1, 2, 1, 0, 0, 2, 0, 1, 2, 0, 2, 2, 0],
      triangles: [0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 3, 4, 7, 3, 7, 6, 4, 5, 8, 4, 8, 7],
    };
    const result = smoothMesh(mesh, { iterations: 2, strength: 0.5, preserveBoundary: true });
    expect(result.mesh.vertices.slice(0, 3)).toEqual([0, 0, 0]);
    expect(result.mesh.vertices[4 * 3 + 2]).toBeLessThan(1);
    expect(result.preservedBoundaryVertices).toBe(8);
  });

  it('groups connected faces using their feature angle', () => {
    const mesh = {
      vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
      triangles: [0, 1, 2, 0, 3, 1],
    };
    expect(groupMeshFaces(mesh, 30).groups).toHaveLength(2);
    expect(groupMeshFaces(mesh, 100).groups).toHaveLength(1);
  });

  it('remeshes long edges to a controlled uniform target', () => {
    const mesh = {
      vertices: [0, 0, 0, 20, 0, 0, 20, 20, 0, 0, 20, 0],
      triangles: [0, 1, 2, 0, 2, 3],
    };
    const result = remeshUniform(mesh, 5);
    expect(result.after.triangleCount).toBeGreaterThan(result.before.triangleCount);
    expect(result.after.maximumEdgeLength).toBeLessThanOrEqual(7.5 + 1e-6);
    expect(Math.abs(result.after.averageEdgeLength - 5)).toBeLessThan(Math.abs(result.before.averageEdgeLength - 5));
    expect(result.after.degenerateTriangles).toBe(0);
  });
});
