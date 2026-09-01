import { describe, expect, it } from 'vitest';
import { inspectMesh, meshToBinaryStl, repairMesh } from './mesh-tools.js';
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
});
