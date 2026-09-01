const DEFAULT_TOLERANCE = 1e-5;

const point = (vertices, index) => vertices.slice(index * 3, index * 3 + 3);
const subtract = (a, b) => a.map((value, index) => value - b[index]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);

function compactMesh(vertices, triangles) {
  const used = [...new Set(triangles)].sort((a, b) => a - b);
  const remap = new Map(used.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  return {
    vertices: used.flatMap((index) => point(vertices, index)),
    triangles: triangles.map((index) => remap.get(index)),
  };
}

function cleanTriangles(vertices, triangles, tolerance) {
  const clean = [];
  const keys = new Set();
  for (let offset = 0; offset < triangles.length; offset += 3) {
    const indices = triangles.slice(offset, offset + 3);
    const [a, b, c] = indices.map((index) => point(vertices, index));
    if (new Set(indices).size < 3 || Math.hypot(...cross(subtract(b, a), subtract(c, a))) <= tolerance * tolerance) continue;
    const key = [...indices].sort((left, right) => left - right).join(':');
    if (keys.has(key)) continue;
    keys.add(key);
    clean.push(...indices);
  }
  return compactMesh(vertices, clean);
}

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
      const record = edges.get(key) || { count: 0, balance: 0 };
      record.count += 1;
      record.balance += from < to ? 1 : -1;
      edges.set(key, record);
    }
  }
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
  };
}

export function repairMesh(mesh, tolerance = DEFAULT_TOLERANCE) {
  const before = inspectMesh(mesh, tolerance);
  const welded = weldedMesh(mesh, tolerance);
  const repaired = cleanTriangles(welded.vertices, welded.triangles, tolerance);
  return { mesh: repaired, before, after: inspectMesh(repaired, tolerance) };
}

function clusterMesh(mesh, cellSize, tolerance) {
  const minimum = [Infinity, Infinity, Infinity];
  for (let index = 0; index < mesh.vertices.length / 3; index += 1) {
    const vertex = point(mesh.vertices, index);
    vertex.forEach((value, axis) => { minimum[axis] = Math.min(minimum[axis], value); });
  }
  const clusters = new Map();
  const remap = [];
  for (let index = 0; index < mesh.vertices.length / 3; index += 1) {
    const vertex = point(mesh.vertices, index);
    const key = vertex.map((value, axis) => Math.floor((value - minimum[axis]) / cellSize)).join(':');
    let cluster = clusters.get(key);
    if (!cluster) {
      cluster = { index: clusters.size, sum: [0, 0, 0], count: 0 };
      clusters.set(key, cluster);
    }
    vertex.forEach((value, axis) => { cluster.sum[axis] += value; });
    cluster.count += 1;
    remap[index] = cluster.index;
  }
  const vertices = [...clusters.values()].flatMap((cluster) => cluster.sum.map((value) => value / cluster.count));
  return cleanTriangles(vertices, mesh.triangles.map((index) => remap[index]), tolerance);
}

export function reduceMesh(mesh, ratio = 0.5, tolerance = DEFAULT_TOLERANCE) {
  const repaired = repairMesh(mesh, tolerance).mesh;
  const before = inspectMesh(repaired, tolerance);
  const safeRatio = Math.min(1, Math.max(0.05, Number(ratio) || 0.5));
  const targetTriangleCount = Math.max(1, Math.round(before.triangleCount * safeRatio));
  if (targetTriangleCount >= before.triangleCount || before.triangleCount < 2) {
    return { mesh: repaired, before, after: before, targetTriangleCount, ratio: safeRatio };
  }
  const coordinates = [[Infinity, -Infinity], [Infinity, -Infinity], [Infinity, -Infinity]];
  for (let index = 0; index < repaired.vertices.length / 3; index += 1) {
    point(repaired.vertices, index).forEach((value, axis) => {
      coordinates[axis][0] = Math.min(coordinates[axis][0], value);
      coordinates[axis][1] = Math.max(coordinates[axis][1], value);
    });
  }
  const diagonal = Math.hypot(...coordinates.map(([minimum, maximum]) => maximum - minimum));
  if (!diagonal) return { mesh: repaired, before, after: before, targetTriangleCount, ratio: safeRatio };
  let low = Math.max(tolerance * 2, diagonal / 1e6);
  let high = diagonal * 2;
  let best = repaired;
  let bestDistance = Math.abs(before.triangleCount - targetTriangleCount);
  for (let iteration = 0; iteration < 32; iteration += 1) {
    const cellSize = (low + high) / 2;
    const candidate = clusterMesh(repaired, cellSize, tolerance);
    const triangleCount = candidate.triangles.length / 3;
    if (triangleCount > 0 && Math.abs(triangleCount - targetTriangleCount) < bestDistance) {
      best = candidate;
      bestDistance = Math.abs(triangleCount - targetTriangleCount);
    }
    if (triangleCount > targetTriangleCount) low = cellSize;
    else high = cellSize;
  }
  return { mesh: best, before, after: inspectMesh(best, tolerance), targetTriangleCount, ratio: safeRatio };
}

function edgeTopology(mesh) {
  const edgeTriangles = new Map();
  const neighbors = Array.from({ length: mesh.vertices.length / 3 }, () => new Set());
  for (let triangle = 0; triangle < mesh.triangles.length / 3; triangle += 1) {
    const indices = mesh.triangles.slice(triangle * 3, triangle * 3 + 3);
    for (const [from, to] of [[indices[0], indices[1]], [indices[1], indices[2]], [indices[2], indices[0]]]) {
      neighbors[from].add(to);
      neighbors[to].add(from);
      const key = from < to ? `${from}:${to}` : `${to}:${from}`;
      if (!edgeTriangles.has(key)) edgeTriangles.set(key, []);
      edgeTriangles.get(key).push(triangle);
    }
  }
  return { edgeTriangles, neighbors };
}

export function smoothMesh(mesh, options = {}, tolerance = DEFAULT_TOLERANCE) {
  const repaired = repairMesh(mesh, tolerance).mesh;
  const before = inspectMesh(repaired, tolerance);
  const iterations = Math.min(20, Math.max(1, Math.round(Number(options.iterations) || 2)));
  const strength = Math.min(0.9, Math.max(0.01, Number(options.strength) || 0.25));
  const preserveBoundary = options.preserveBoundary !== false;
  const { edgeTriangles, neighbors } = edgeTopology(repaired);
  const fixed = new Set();
  if (preserveBoundary) {
    for (const [key, triangleIds] of edgeTriangles) {
      if (triangleIds.length !== 2) key.split(':').forEach((index) => fixed.add(Number(index)));
    }
  }
  let vertices = [...repaired.vertices];
  let maximumDisplacement = 0;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next = [...vertices];
    neighbors.forEach((vertexNeighbors, index) => {
      if (fixed.has(index) || !vertexNeighbors.size) return;
      const average = [0, 0, 0];
      vertexNeighbors.forEach((neighbor) => point(vertices, neighbor).forEach((value, axis) => { average[axis] += value; }));
      average.forEach((value, axis) => { average[axis] = value / vertexNeighbors.size; });
      const current = point(vertices, index);
      const updated = current.map((value, axis) => value + (average[axis] - value) * strength);
      maximumDisplacement = Math.max(maximumDisplacement, Math.hypot(...subtract(updated, current)));
      updated.forEach((value, axis) => { next[index * 3 + axis] = value; });
    });
    vertices = next;
  }
  const smoothed = cleanTriangles(vertices, repaired.triangles, tolerance);
  return {
    mesh: smoothed,
    before,
    after: inspectMesh(smoothed, tolerance),
    iterations,
    strength,
    preservedBoundaryVertices: fixed.size,
    maximumDisplacement,
  };
}

function triangleNormalAndArea(mesh, triangle) {
  const [a, b, c] = mesh.triangles.slice(triangle * 3, triangle * 3 + 3).map((index) => point(mesh.vertices, index));
  const raw = cross(subtract(b, a), subtract(c, a));
  const length = Math.hypot(...raw);
  return { normal: raw.map((value) => value / (length || 1)), area: length / 2 };
}

export function groupMeshFaces(mesh, featureAngle = 30, tolerance = DEFAULT_TOLERANCE) {
  const repaired = repairMesh(mesh, tolerance).mesh;
  const triangleCount = repaired.triangles.length / 3;
  const angle = Math.min(180, Math.max(0, Number(featureAngle) || 30));
  const threshold = Math.cos(angle * Math.PI / 180);
  const triangleData = Array.from({ length: triangleCount }, (_, triangle) => triangleNormalAndArea(repaired, triangle));
  const { edgeTriangles } = edgeTopology(repaired);
  const adjacency = Array.from({ length: triangleCount }, () => new Set());
  for (const triangleIds of edgeTriangles.values()) {
    for (const first of triangleIds) for (const second of triangleIds) if (first !== second) adjacency[first].add(second);
  }
  const assigned = new Int32Array(triangleCount).fill(-1);
  const groups = [];
  for (let seed = 0; seed < triangleCount; seed += 1) {
    if (assigned[seed] !== -1) continue;
    const group = { id: groups.length + 1, triangleIndices: [], area: 0 };
    const queue = [seed];
    let queueIndex = 0;
    assigned[seed] = group.id;
    while (queueIndex < queue.length) {
      const current = queue[queueIndex];
      queueIndex += 1;
      group.triangleIndices.push(current);
      group.area += triangleData[current].area;
      adjacency[current].forEach((neighbor) => {
        if (assigned[neighbor] !== -1 || dot(triangleData[current].normal, triangleData[neighbor].normal) < threshold) return;
        assigned[neighbor] = group.id;
        queue.push(neighbor);
      });
    }
    group.triangleCount = group.triangleIndices.length;
    groups.push(group);
  }
  groups.sort((a, b) => b.triangleCount - a.triangleCount || a.id - b.id);
  return { mesh: repaired, featureAngle: angle, groups, triangleGroups: [...assigned] };
}

export function meshToBinaryStl(mesh) {
  const triangleCount = mesh.triangles.length / 3;
  const buffer = new ArrayBuffer(84 + triangleCount * 50);
  const view = new DataView(buffer);
  view.setUint32(80, triangleCount, true);
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const indices = mesh.triangles.slice(triangle * 3, triangle * 3 + 3);
    const [a, b, c] = indices.map((index) => point(mesh.vertices, index));
    const rawNormal = cross(subtract(b, a), subtract(c, a));
    const length = Math.hypot(...rawNormal) || 1;
    const normal = rawNormal.map((value) => value / length);
    const output = 84 + triangle * 50;
    normal.forEach((value, axis) => view.setFloat32(output + axis * 4, value, true));
    [a, b, c].forEach((vertex, vertexIndex) => vertex.forEach((value, axis) => view.setFloat32(output + 12 + vertexIndex * 12 + axis * 4, value, true)));
  }
  return buffer;
}
