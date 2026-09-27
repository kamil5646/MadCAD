// A fixture body is tessellated by the CAD kernel. Each leaf stores a small
// group of triangles. Subdivision narrows conservative XY/Z bounds for a
// sloped face without ever assuming that an unresolved candidate is safe.
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

function hasClosedSurface(vertices, indices) {
  const coordinateBounds = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
  for (let offset = 0; offset < vertices.length; offset += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      coordinateBounds[0][axis] = Math.min(coordinateBounds[0][axis], vertices[offset + axis]);
      coordinateBounds[1][axis] = Math.max(coordinateBounds[1][axis], vertices[offset + axis]);
    }
  }
  const span = Math.max(...coordinateBounds[0].map((value, axis) => coordinateBounds[1][axis] - value));
  const dimensions = coordinateBounds[0].map((value, axis) => coordinateBounds[1][axis] - value);
  if (dimensions.some((value) => value <= 1e-7)) return false;
  // Float32 tessellation can duplicate a vertex at a face seam. Merge only
  // coordinates below the mesh's own geometric resolution.
  const grid = Math.max(1e-5, span * 1e-7);
  const vertexKeys = Array.from({ length: vertices.length / 3 }, (_unused, index) => [0, 1, 2]
    .map((axis) => Math.round(vertices[index * 3 + axis] / grid)).join(':'));
  const edgeCounts = new Map();
  const origin = [vertices[0], vertices[1], vertices[2]];
  let signedVolume6 = 0;
  for (let offset = 0; offset < indices.length; offset += 3) {
    const corners = [0, 1, 2].map((corner) => vertexKeys[indices[offset + corner]]);
    if (new Set(corners).size !== 3) return false;
    const [first, second, third] = [0, 1, 2].map((corner) => [0, 1, 2].map((axis) => vertices[indices[offset + corner] * 3 + axis] - origin[axis]));
    signedVolume6 += first[0] * (second[1] * third[2] - second[2] * third[1])
      + first[1] * (second[2] * third[0] - second[0] * third[2])
      + first[2] * (second[0] * third[1] - second[1] * third[0]);
    for (const [first, second] of [[0, 1], [1, 2], [2, 0]]) {
      const from = corners[first];
      const to = corners[second];
      const key = [from, to].sort().join('|');
      const edge = edgeCounts.get(key) || { count: 0, orientation: 0 };
      edge.count += 1;
      edge.orientation += from < to ? 1 : -1;
      if (edge.count > 2) return false;
      edgeCounts.set(key, edge);
    }
  }
  // Two faces sharing an edge must traverse it in opposite directions.
  // Counting only incidences accepts a locally flipped, non-orientable shell.
  return [...edgeCounts.values()].every((edge) => edge.count === 2 && edge.orientation === 0)
    && Math.abs(signedVolume6) > Math.max(1e-9, dimensions[0] * dimensions[1] * dimensions[2] * 1e-8) * 6;
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
  if (!hasClosedSurface(vertices, indices)) return null;
  const triangles = [];
  for (let offset = 0; offset < indices.length; offset += 3) {
    const xyz = [0, 1, 2].map((corner) => [0, 1, 2].map((axis) => vertices[indices[offset + corner] * 3 + axis]));
    triangles.push({ bounds: triangleBounds(vertices, indices, offset), xyz, xy: xyz.map((point) => point.slice(0, 2)) });
  }
  const index = createNode(triangles);
  meshIndexCache.set(body, { vertices: Float64Array.from(vertices), indices: Uint32Array.from(indices), index });
  return index;
}

const crossXY = (first, second, point) => (second[0] - first[0]) * (point[1] - first[1])
  - (second[1] - first[1]) * (point[0] - first[0]);

function pointSegmentDistanceSquaredXY(point, first, second) {
  const dx = second[0] - first[0];
  const dy = second[1] - first[1];
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((point[0] - first[0]) * dx + (point[1] - first[1]) * dy) / lengthSquared)) : 0;
  return (point[0] - first[0] - t * dx) ** 2 + (point[1] - first[1] - t * dy) ** 2;
}

function pointInTriangleXY(point, triangle, tolerance) {
  const [first, second, third] = triangle;
  const area = crossXY(first, second, third);
  const edgeSpan = Math.max(1, Math.hypot(second[0] - first[0], second[1] - first[1]),
    Math.hypot(third[0] - second[0], third[1] - second[1]), Math.hypot(first[0] - third[0], first[1] - third[1]));
  const epsilon = tolerance * edgeSpan * 4;
  // Only a truly collinear projection is a line. A very thin but nonzero
  // triangle may still contain a point far enough from its edges to matter.
  if (area === 0) return false;
  const sign = Math.sign(area);
  return crossXY(first, second, point) * sign >= -epsilon
    && crossXY(second, third, point) * sign >= -epsilon
    && crossXY(third, first, point) * sign >= -epsilon;
}

function segmentsIntersectXY(first, second, third, fourth, tolerance) {
  if ((first[0] - second[0]) ** 2 + (first[1] - second[1]) ** 2 <= tolerance ** 2
    || (third[0] - fourth[0]) ** 2 + (third[1] - fourth[1]) ** 2 <= tolerance ** 2) return false;
  const span = Math.max(1, Math.hypot(second[0] - first[0], second[1] - first[1]),
    Math.hypot(fourth[0] - third[0], fourth[1] - third[1]));
  const epsilon = tolerance * span * 4;
  const firstSide = crossXY(first, second, third);
  const secondSide = crossXY(first, second, fourth);
  const thirdSide = crossXY(third, fourth, first);
  const fourthSide = crossXY(third, fourth, second);
  return firstSide * secondSide <= epsilon ** 2 && thirdSide * fourthSide <= epsilon ** 2;
}

function segmentTriangleDistanceSquaredXY(segment, triangle, tolerance) {
  const first = segment.from;
  const second = segment.to;
  if (pointInTriangleXY(first, triangle, tolerance) || pointInTriangleXY(second, triangle, tolerance)) return 0;
  let distanceSquared = Infinity;
  for (let edge = 0; edge < 3; edge += 1) {
    const start = triangle[edge];
    const end = triangle[(edge + 1) % 3];
    if (segmentsIntersectXY(first, second, start, end, tolerance)) return 0;
    distanceSquared = Math.min(distanceSquared,
      pointSegmentDistanceSquaredXY(first, start, end), pointSegmentDistanceSquaredXY(second, start, end),
      pointSegmentDistanceSquaredXY(start, first, second), pointSegmentDistanceSquaredXY(end, first, second));
  }
  return distanceSquared;
}

function meshContainsPointOrUncertain(index, point, tolerance) {
  const pending = [index];
  const above = [];
  let surfaceCount = 0;
  while (pending.length) {
    const node = pending.pop();
    if (point[0] < node.bounds[0][0] - tolerance || point[0] > node.bounds[1][0] + tolerance
      || point[1] < node.bounds[0][1] - tolerance || point[1] > node.bounds[1][1] + tolerance) continue;
    if (node.triangles) {
      for (const triangle of node.triangles) {
        const [first, second, third] = triangle.xy;
        const area = crossXY(first, second, third);
        if (Math.abs(area) <= tolerance ** 2) {
          if (point[2] >= triangle.bounds[0][2] - tolerance && point[2] <= triangle.bounds[1][2] + tolerance
            && [0, 1, 2].some((edge) => pointSegmentDistanceSquaredXY(point, triangle.xy[edge], triangle.xy[(edge + 1) % 3]) <= tolerance ** 2)) return true;
          continue;
        }
        const weights = [crossXY(second, third, point) / area, crossXY(third, first, point) / area, crossXY(first, second, point) / area];
        const edgeSpan = Math.max(...[0, 1, 2].map((edge) => Math.hypot(...triangle.xy[edge].map((value, axis) => value - triangle.xy[(edge + 1) % 3][axis]))));
        const weightTolerance = Math.min(0.25, tolerance / Math.max(edgeSpan, tolerance));
        if (weights.some((weight) => weight < -weightTolerance)) continue;
        // A ray through a triangle edge/vertex has ambiguous parity. Keep it
        // blocked instead of relying on how the CAD kernel split that face.
        if (weights.some((weight) => weight <= weightTolerance)) return true;
        const surfaceZ = weights.reduce((sum, weight, corner) => sum + weight * triangle.xyz[corner][2], 0);
        surfaceCount += 1;
        if (Math.abs(point[2] - surfaceZ) <= tolerance) return true;
        if (surfaceZ > point[2]) above.push(surfaceZ);
      }
    } else pending.push(...node.children);
  }
  // For one ordinary closed shell the vertical ray crosses bottom and top.
  // Multiple overlapping shells or a degenerate ray remain uncertain.
  if (surfaceCount !== 2) return surfaceCount > 0;
  return above.length === 1;
}

function candidateTriangleCollision(triangle, segment, reach, tolerance, intersects, depth = 0) {
  if (!intersects(triangle.bounds) || segmentTriangleDistanceSquaredXY(segment, triangle.xy, tolerance) > reach ** 2) return false;
  if (depth >= 8 || triangle.bounds[1][2] - triangle.bounds[0][2] <= tolerance * 4) return true;
  const edges = [[0, 1], [1, 2], [2, 0]];
  const length = ([first, second]) => Math.hypot(...triangle.xyz[first].map((value, axis) => value - triangle.xyz[second][axis]));
  const [first, second] = edges.reduce((selected, edge) => {
    return length(edge) > length(selected) ? edge : selected;
  });
  const third = 3 - first - second;
  const midpoint = triangle.xyz[first].map((value, axis) => (value + triangle.xyz[second][axis]) / 2);
  const child = (xyz) => ({ xyz, xy: xyz.map((point) => point.slice(0, 2)), bounds: [
    [0, 1, 2].map((axis) => Math.min(...xyz.map((point) => point[axis]))),
    [0, 1, 2].map((axis) => Math.max(...xyz.map((point) => point[axis]))),
  ] });
  return candidateTriangleCollision(child([triangle.xyz[first], midpoint, triangle.xyz[third]]), segment, reach, tolerance, intersects, depth + 1)
    || candidateTriangleCollision(child([midpoint, triangle.xyz[second], triangle.xyz[third]]), segment, reach, tolerance, intersects, depth + 1);
}

export function fixtureMeshPotentialCollision(index, segment, radius, clearance, lowerOffset, upperOffset, intersectsPrism) {
  if (!index) return true;
  const coordinateScale = Math.max(1, ...index.bounds.flatMap((point) => point.map((value) => Math.abs(value))));
  const tolerance = Math.max(1e-6, coordinateScale * 1e-7);
  const reach = Math.max(0, Number(radius) || 0) + Math.max(0, Number(clearance) || 0) + tolerance;
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
      if (node.triangles.some((triangle) => candidateTriangleCollision(triangle, segment, reach, tolerance, intersects))) return true;
    } else pending.push(...node.children);
  }
  // A path wholly inside a closed solid need not cross any surface triangle.
  // A vertical ray gives an inside check; ambiguous edges stay blocked.
  return [segment.from, segment.to].some((point) => {
    if (point[0] < index.bounds[0][0] - reach || point[0] > index.bounds[1][0] + reach
      || point[1] < index.bounds[0][1] - reach || point[1] > index.bounds[1][1] + reach) return false;
    const lowerZ = point[2] + lowerOffset;
    const upperZ = point[2] + upperOffset;
    if (lowerZ > index.bounds[1][2] + clearance || upperZ < index.bounds[0][2] - clearance) return false;
    const clampZ = (value) => Math.max(index.bounds[0][2], Math.min(index.bounds[1][2], value));
    return [clampZ(lowerZ), clampZ(upperZ)].some((z) => meshContainsPointOrUncertain(index, [point[0], point[1], z], tolerance));
  });
}
