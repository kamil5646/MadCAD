// Read-only diagnostics of an imported STL/3MF mesh (shown before converting it to a B-Rep body).
const DEFAULT_TOLERANCE = 1e-5;

const point = (vertices, index) => vertices.slice(index * 3, index * 3 + 3);
const subtract = (a, b) => a.map((value, index) => value - b[index]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function weldedMesh(mesh, tolerance) {
  const vertices = [];
  const lookup = new Map();
  const remap = [];
  for (let index = 0; index < mesh.vertices.length / 3; index += 1) {
    const current = point(mesh.vertices, index);
    const key = current.map((value) => Math.round(value / tolerance)).join(':');
    if (!lookup.has(key)) {
      lookup.set(key, vertices.length / 3);
      vertices.push(...current);
    }
    remap[index] = lookup.get(key);
  }
  return { vertices, triangles: mesh.triangles.map((index) => remap[index]) };
}

export function inspectMesh(mesh, tolerance = DEFAULT_TOLERANCE) {
  const welded = weldedMesh(mesh, tolerance);
  const edges = new Map();
  const duplicateKeys = new Set();
  let degenerateTriangles = 0;
  let duplicateTriangles = 0;
  for (let offset = 0; offset < welded.triangles.length; offset += 3) {
    const indices = welded.triangles.slice(offset, offset + 3);
    const [a, b, c] = indices.map((index) => point(welded.vertices, index));
    const area2 = Math.hypot(...cross(subtract(b, a), subtract(c, a)));
    if (new Set(indices).size < 3 || area2 <= tolerance * tolerance) degenerateTriangles += 1;
    const triangleKey = [...indices].sort((left, right) => left - right).join(':');
    if (duplicateKeys.has(triangleKey)) duplicateTriangles += 1;
    duplicateKeys.add(triangleKey);
    for (const [from, to] of [[indices[0], indices[1]], [indices[1], indices[2]], [indices[2], indices[0]]]) {
      const key = from < to ? `${from}:${to}` : `${to}:${from}`;
      const record = edges.get(key) || { count: 0, balance: 0, length: Math.hypot(...subtract(point(welded.vertices, from), point(welded.vertices, to))) };
      record.count += 1;
      record.balance += from < to ? 1 : -1;
      edges.set(key, record);
    }
  }
  const edgeLengths = [...edges.values()].map((edge) => edge.length);
  const edgeRange = edgeLengths.reduce((range, length) => [Math.min(range[0], length), Math.max(range[1], length)], [Infinity, -Infinity]);
  return {
    vertexCount: mesh.vertices.length / 3,
    weldedVertexCount: welded.vertices.length / 3,
    triangleCount: mesh.triangles.length / 3,
    duplicateVertices: mesh.vertices.length / 3 - welded.vertices.length / 3,
    degenerateTriangles,
    duplicateTriangles,
    boundaryEdges: [...edges.values()].filter((edge) => edge.count === 1).length,
    nonManifoldEdges: [...edges.values()].filter((edge) => edge.count > 2).length,
    inconsistentEdges: [...edges.values()].filter((edge) => edge.count === 2 && edge.balance !== 0).length,
    minimumEdgeLength: edgeLengths.length ? edgeRange[0] : 0,
    maximumEdgeLength: edgeLengths.length ? edgeRange[1] : 0,
    averageEdgeLength: edgeLengths.length ? edgeLengths.reduce((sum, length) => sum + length, 0) / edgeLengths.length : 0,
  };
}
