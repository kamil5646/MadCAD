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

export function repairMesh(mesh, tolerance = DEFAULT_TOLERANCE) {
  const before = inspectMesh(mesh, tolerance);
  const welded = weldedMesh(mesh, tolerance);
  const repaired = cleanTriangles(welded.vertices, welded.triangles, tolerance);
  return { mesh: repaired, before, after: inspectMesh(repaired, tolerance) };
}

function directedEdgeRecords(mesh) {
  const edges = new Map();
  for (let triangle = 0; triangle < mesh.triangles.length / 3; triangle += 1) {
    const [a, b, c] = mesh.triangles.slice(triangle * 3, triangle * 3 + 3);
    for (const [from, to] of [[a, b], [b, c], [c, a]]) {
      const key = from < to ? `${from}:${to}` : `${to}:${from}`;
      if (!edges.has(key)) edges.set(key, []);
      edges.get(key).push({ triangle, from, to, key });
    }
  }
  return edges;
}

function triangleSignedVolume(mesh, triangle, flipped = false) {
  const indices = mesh.triangles.slice(triangle * 3, triangle * 3 + 3);
  if (flipped) [indices[1], indices[2]] = [indices[2], indices[1]];
  const [a, b, c] = indices.map((index) => point(mesh.vertices, index));
  return dot(a, cross(b, c)) / 6;
}

export function orientMeshFaces(mesh, tolerance = DEFAULT_TOLERANCE) {
  const repaired = repairMesh(mesh, tolerance).mesh;
  const before = inspectMesh(repaired, tolerance);
  const edges = directedEdgeRecords(repaired);
  const adjacent = Array.from({ length: repaired.triangles.length / 3 }, () => []);
  for (const records of edges.values()) {
    if (records.length !== 2) continue;
    adjacent[records[0].triangle].push([records[0], records[1]]);
    adjacent[records[1].triangle].push([records[1], records[0]]);
  }
  const flips = new Array(repaired.triangles.length / 3).fill(null);
  const components = [];
  let orientationConflicts = 0;
  for (let seed = 0; seed < flips.length; seed += 1) {
    if (flips[seed] !== null) continue;
    const component = [];
    const queue = [seed];
    flips[seed] = false;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const triangle = queue[cursor];
      component.push(triangle);
      for (const [current, neighbor] of adjacent[triangle]) {
        const currentFrom = flips[triangle] ? current.to : current.from;
        const currentTo = flips[triangle] ? current.from : current.to;
        const requiredFlip = neighbor.from === currentFrom && neighbor.to === currentTo;
        if (flips[neighbor.triangle] === null) {
          flips[neighbor.triangle] = requiredFlip;
          queue.push(neighbor.triangle);
        } else if (flips[neighbor.triangle] !== requiredFlip) orientationConflicts += 1;
      }
    }
    components.push(component);
  }
  let outwardComponents = 0;
  for (const component of components) {
    const componentSet = new Set(component);
    const closed = [...edges.values()].every((records) => !records.some((record) => componentSet.has(record.triangle)) || records.length === 2);
    if (!closed) continue;
    const signedVolume = component.reduce((sum, triangle) => sum + triangleSignedVolume(repaired, triangle, flips[triangle]), 0);
    if (signedVolume < -(tolerance ** 3)) {
      component.forEach((triangle) => { flips[triangle] = !flips[triangle]; });
      outwardComponents += 1;
    }
  }
  const triangles = [...repaired.triangles];
  flips.forEach((flipped, triangle) => {
    if (!flipped) return;
    const offset = triangle * 3;
    [triangles[offset + 1], triangles[offset + 2]] = [triangles[offset + 2], triangles[offset + 1]];
  });
  const oriented = { vertices: [...repaired.vertices], triangles };
  return {
    mesh: oriented,
    before,
    after: inspectMesh(oriented, tolerance),
    componentCount: components.length,
    flippedTriangles: flips.filter(Boolean).length,
    outwardComponents,
    orientationConflicts: Math.floor(orientationConflicts / 2),
  };
}

function boundaryLoops(mesh) {
  const records = [...directedEdgeRecords(mesh).values()].filter((items) => items.length === 1).map((items) => items[0]);
  const outgoing = new Map();
  const incoming = new Map();
  for (const record of records) {
    if (!outgoing.has(record.from)) outgoing.set(record.from, []);
    if (!incoming.has(record.to)) incoming.set(record.to, []);
    outgoing.get(record.from).push(record);
    incoming.get(record.to).push(record);
  }
  const invalidVertices = new Set([...new Set(records.flatMap((record) => [record.from, record.to]))].filter((vertex) => outgoing.get(vertex)?.length !== 1 || incoming.get(vertex)?.length !== 1));
  const visited = new Set();
  const loops = [];
  let invalidChains = 0;
  for (const seed of records) {
    if (visited.has(seed.key)) continue;
    const edges = [];
    let current = seed;
    let valid = true;
    while (!visited.has(current.key)) {
      visited.add(current.key);
      edges.push(current);
      if (invalidVertices.has(current.from) || invalidVertices.has(current.to)) { valid = false; break; }
      const next = outgoing.get(current.to)?.[0];
      if (!next) { valid = false; break; }
      current = next;
      if (current.from === seed.from) break;
      if (edges.length > records.length) { valid = false; break; }
    }
    if (valid && current.from === seed.from && edges.length >= 3) loops.push(edges);
    else invalidChains += 1;
  }
  return { loops, invalidChains };
}

export function fillMeshHoles(mesh, options = {}, tolerance = DEFAULT_TOLERANCE) {
  const oriented = orientMeshFaces(mesh, tolerance);
  if (oriented.after.nonManifoldEdges) throw new Error('Najpierw usuń krawędzie niemanifold; ich otoczenia nie można jednoznacznie uzupełnić.');
  if (oriented.orientationConflicts) throw new Error('Siatka ma konflikt orientacji, którego nie można bezpiecznie rozwiązać automatycznie.');
  const maximumDiameter = Number(options.maximumDiameter);
  if (!Number.isFinite(maximumDiameter) || maximumDiameter <= tolerance * 10) throw new Error('Maksymalna średnica otworu musi być dodatnia.');
  const maximumEdges = Math.min(256, Math.max(3, Math.round(Number(options.maximumEdges) || 64)));
  const { loops, invalidChains } = boundaryLoops(oriented.mesh);
  const vertices = [...oriented.mesh.vertices];
  const triangles = [...oriented.mesh.triangles];
  const filled = [];
  const skipped = [];
  for (const edges of loops) {
    const loopVertices = edges.map((edge) => edge.from);
    let diameter = 0;
    for (let first = 0; first < loopVertices.length; first += 1) for (let second = first + 1; second < loopVertices.length; second += 1) {
      diameter = Math.max(diameter, Math.hypot(...subtract(point(oriented.mesh.vertices, loopVertices[first]), point(oriented.mesh.vertices, loopVertices[second]))));
    }
    if (edges.length > maximumEdges || diameter > maximumDiameter) {
      skipped.push({ edgeCount: edges.length, diameter, reason: edges.length > maximumEdges ? 'edge-limit' : 'diameter-limit' });
      continue;
    }
    const center = [0, 0, 0];
    loopVertices.forEach((vertex) => point(oriented.mesh.vertices, vertex).forEach((value, axis) => { center[axis] += value; }));
    center.forEach((value, axis) => { center[axis] = value / loopVertices.length; });
    const centerIndex = vertices.length / 3;
    vertices.push(...center);
    edges.forEach((edge) => triangles.push(edge.to, edge.from, centerIndex));
    filled.push({ edgeCount: edges.length, diameter, insertedTriangles: edges.length });
  }
  const patched = cleanTriangles(vertices, triangles, tolerance);
  const finalOrientation = orientMeshFaces(patched, tolerance);
  return {
    mesh: finalOrientation.mesh,
    before: oriented.before,
    after: finalOrientation.after,
    holeCount: loops.length + invalidChains,
    filledHoles: filled.length,
    skippedHoles: skipped.length + invalidChains,
    insertedTriangles: filled.reduce((sum, hole) => sum + hole.insertedTriangles, 0),
    orientedTriangles: oriented.flippedTriangles + finalOrientation.flippedTriangles,
    maximumDiameter,
    maximumEdges,
    filled,
    skipped,
  };
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

function collapseShortEdges(mesh, targetEdgeLength, tolerance) {
  let current = mesh;
  let collapsedEdges = 0;
  for (let pass = 0; pass < 4; pass += 1) {
    const { edgeTriangles } = edgeTopology(current);
    const boundaryVertices = new Set();
    const edges = [];
    for (const [key, triangleIds] of edgeTriangles) {
      const [from, to] = key.split(':').map(Number);
      if (triangleIds.length !== 2) {
        boundaryVertices.add(from);
        boundaryVertices.add(to);
      }
      edges.push({ from, to, length: Math.hypot(...subtract(point(current.vertices, from), point(current.vertices, to))) });
    }
    edges.sort((a, b) => a.length - b.length);
    const remap = Array.from({ length: current.vertices.length / 3 }, (_, index) => index);
    const vertices = [...current.vertices];
    const locked = new Set();
    let collapsedThisPass = 0;
    for (const edge of edges) {
      if (edge.length >= targetEdgeLength * 0.55) break;
      if (boundaryVertices.has(edge.from) || boundaryVertices.has(edge.to) || locked.has(edge.from) || locked.has(edge.to)) continue;
      const midpoint = point(vertices, edge.from).map((value, axis) => (value + vertices[edge.to * 3 + axis]) / 2);
      midpoint.forEach((value, axis) => { vertices[edge.from * 3 + axis] = value; });
      remap[edge.to] = edge.from;
      locked.add(edge.from);
      locked.add(edge.to);
      collapsedThisPass += 1;
    }
    if (!collapsedThisPass) break;
    current = cleanTriangles(vertices, current.triangles.map((index) => remap[index]), tolerance);
    collapsedEdges += collapsedThisPass;
  }
  return { mesh: current, collapsedEdges };
}

function splitLongEdges(mesh, targetEdgeLength, tolerance, maximumTriangles) {
  let current = mesh;
  let insertedVertices = 0;
  for (let pass = 0; pass < 6; pass += 1) {
    const edgeMidpoints = new Map();
    const vertices = [...current.vertices];
    const midpointFor = (from, to) => {
      const key = from < to ? `${from}:${to}` : `${to}:${from}`;
      if (edgeMidpoints.has(key)) return edgeMidpoints.get(key);
      const a = point(vertices, from);
      const b = point(vertices, to);
      if (Math.hypot(...subtract(a, b)) <= targetEdgeLength * 1.5) return null;
      const index = vertices.length / 3;
      vertices.push(...a.map((value, axis) => (value + b[axis]) / 2));
      edgeMidpoints.set(key, index);
      return index;
    };
    for (let offset = 0; offset < current.triangles.length; offset += 3) {
      const [a, b, c] = current.triangles.slice(offset, offset + 3);
      midpointFor(a, b);
      midpointFor(b, c);
      midpointFor(c, a);
    }
    if (!edgeMidpoints.size) break;
    const triangles = [];
    for (let offset = 0; offset < current.triangles.length; offset += 3) {
      const [a, b, c] = current.triangles.slice(offset, offset + 3);
      const ab = edgeMidpoints.get(a < b ? `${a}:${b}` : `${b}:${a}`);
      const bc = edgeMidpoints.get(b < c ? `${b}:${c}` : `${c}:${b}`);
      const ca = edgeMidpoints.get(c < a ? `${c}:${a}` : `${a}:${c}`);
      const mask = (ab !== undefined ? 1 : 0) | (bc !== undefined ? 2 : 0) | (ca !== undefined ? 4 : 0);
      if (mask === 0) triangles.push(a, b, c);
      else if (mask === 1) triangles.push(a, ab, c, ab, b, c);
      else if (mask === 2) triangles.push(b, bc, a, bc, c, a);
      else if (mask === 4) triangles.push(c, ca, b, ca, a, b);
      else if (mask === 3) triangles.push(b, bc, ab, a, ab, c, ab, bc, c);
      else if (mask === 6) triangles.push(c, ca, bc, b, bc, a, bc, ca, a);
      else if (mask === 5) triangles.push(a, ab, ca, b, c, ab, c, ca, ab);
      else triangles.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
    }
    if (triangles.length / 3 > maximumTriangles) throw new Error(`Remesh przekroczył bezpieczny limit ${maximumTriangles.toLocaleString('pl-PL')} trójkątów. Zwiększ docelową długość krawędzi.`);
    insertedVertices += edgeMidpoints.size;
    current = cleanTriangles(vertices, triangles, tolerance);
  }
  return { mesh: current, insertedVertices };
}

export function remeshUniform(mesh, targetEdgeLength, options = {}, tolerance = DEFAULT_TOLERANCE) {
  const repaired = repairMesh(mesh, tolerance).mesh;
  const before = inspectMesh(repaired, tolerance);
  const target = Number(targetEdgeLength);
  if (!Number.isFinite(target) || target <= tolerance * 10) throw new Error('Docelowa długość krawędzi musi być dodatnia.');
  const maximumTriangles = Math.max(1000, Math.round(Number(options.maximumTriangles) || 500000));
  const collapsed = collapseShortEdges(repaired, target, tolerance);
  const split = splitLongEdges(collapsed.mesh, target, tolerance, maximumTriangles);
  return {
    mesh: split.mesh,
    before,
    after: inspectMesh(split.mesh, tolerance),
    targetEdgeLength: target,
    collapsedEdges: collapsed.collapsedEdges,
    insertedVertices: split.insertedVertices,
  };
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
