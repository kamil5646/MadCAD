import { describe, expect, it } from 'vitest';
import { inspectMesh } from './mesh-tools.js';

describe('mesh diagnostics', () => {
  it('reports duplicate vertices, triangles and degenerates', () => {
    const dirty = {
      vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 2, 2],
      triangles: [0, 1, 2, 3, 4, 5, 0, 0, 1],
    };
    expect(inspectMesh(dirty)).toMatchObject({ duplicateVertices: 3, duplicateTriangles: 1, degenerateTriangles: 1 });
  });
});
