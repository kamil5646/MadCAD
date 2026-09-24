// A fixture body is tessellated by the CAD kernel. Each leaf stores a small
// group of triangle bounds; testing those bounds is conservative (it may
// report a collision outside the triangle, but cannot miss its surface).
const meshIndexCache = new WeakMap();
const LEAF_TRIANGLES = 8;

const unionBounds = (first, second) => [
  first[0].map((value, axis) => Math.min(value, second[0][axis])),
  first[1].map((value, axis) => Math.max(value, second[1][axis])),
];

const validMeshArray = (value) => (Array.isArray(value) || ArrayBuffer.isView(value)) && value.length > 0 && value.length % 3 === 0;
const sameValues = (first, second) => first?.length === second?.length && first.every((value, index) => value === second[index]);

function triangleBounds(vertices, indices, offset) {
  const bounds = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
  for (let corner = 0; corner < 3; corner += 1) {
    const vertex = indices[offset + corner] * 3;
    for (let axis = 0; axis < 3; axis += 1) {
      const value = vertices[vertex + axis];
      bounds[0][axis] = Math.min(bounds[0][axis], value);
      bounds[1][axis] = Math.max(bounds[1][axis], value);
    }
  }
  return bounds;
}

function createNode(triangles) {
  const bounds = triangles.reduce((union, triangle) => unionBounds(union, triangle.bounds), triangles[0].bounds);
  if (triangles.length <= LEAF_TRIANGLES) return { bounds, triangles };
  const spans = bounds[0].map((value, axis) => bounds[1][axis] - value);
  const axis = spans.indexOf(Math.max(...spans));
  triangles.sort((first, second) => (first.bounds[0][axis] + first.bounds[1][axis]) - (second.bounds[0][axis] + second.bounds[1][axis]));
  const middle = Math.floor(triangles.length / 2);
  return { bounds, children: [createNode(triangles.slice(0, middle)), createNode(triangles.slice(middle))] };
}

export function createManufacturingFixtureMeshIndex(body) {
  if (!body || !validMeshArray(body.vertices) || !validMeshArray(body.triangles)) return null;
  const cached = meshIndexCache.get(body);
  if (cached && sameValues(body.vertices, cached.vertices) && sameValues(body.triangles, cached.indices)) return cached.index;
  const vertices = body.vertices;
  const indices = body.triangles;
  const vertexCount = vertices.length / 3;
  if (vertices.some((value) => !Number.isFinite(value)) || indices.some((value) => !Number.isInteger(value) || value < 0 || value >= vertexCount)) return null;
  const triangles = [];
  for (let offset = 0; offset < indices.length; offset += 3) triangles.push({ bounds: triangleBounds(vertices, indices, offset) });
  const index = createNode(triangles);
  meshIndexCache.set(body, { vertices: Float64Array.from(vertices), indices: Uint32Array.from(indices), index });
  return index;
}

const pointInsideBounds = (point, bounds) => point.every((value, axis) => value >= bounds[0][axis] && value <= bounds[1][axis]);

export function fixtureMeshPotentialCollision(index, segment, radius, clearance, lowerOffset, upperOffset, intersectsPrism) {
  if (!index) return true;
  const intersects = (bounds) => intersectsPrism(
    segment, bounds[0], bounds[1], radius, clearance,
    Number.isFinite(upperOffset) ? bounds[0][2] - clearance - upperOffset : -Infinity,
    bounds[1][2] + clearance - lowerOffset,
  );
  if (!intersects(index.bounds)) return false;
  const pending = [index];
  while (pending.length) {
    const node = pending.pop();
    if (!intersects(node.bounds)) continue;
    if (node.triangles) {
      if (node.triangles.some((triangle) => intersects(triangle.bounds))) return true;
    } else pending.push(...node.children);
  }
  // A path wholly inside a closed solid need not cross any surface triangle.
  // Without a watertightness proof, an endpoint inside the mesh envelope is
  // uncertain and therefore blocks export rather than becoming a false safe.
  return pointInsideBounds(segment.from, index.bounds) || pointInsideBounds(segment.to, index.bounds);
}
