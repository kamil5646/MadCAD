function average(points) {
  return points[0].map((_value, axis) => points.reduce((sum, point) => sum + point[axis], 0) / points.length);
}

function edgeKey(first, second) {
  return first < second ? `${first}:${second}` : `${second}:${first}`;
}

const SYMMETRY_PAIRS = {
  x: [1, 0, 3, 2, 5, 4, 7, 6],
  y: [3, 2, 1, 0, 7, 6, 5, 4],
  z: [4, 5, 6, 7, 0, 1, 2, 3],
};

export const FORM_CONTROL_EDGES = Object.freeze([
  [0, 3], [3, 2], [2, 1], [1, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [1, 5], [4, 0], [2, 6], [3, 7],
]);

export function updateFormControlOffset(controlOffsets, pointIndex, offset, symmetry = 'none') {
  const next = Array.from({ length: 8 }, (_unused, index) => Array.from({ length: 3 }, (_axis, axis) => controlOffsets?.[index]?.[axis] ?? '0'));
  next[pointIndex] = [...offset];
  const pairedIndex = SYMMETRY_PAIRS[symmetry]?.[pointIndex];
  if (Number.isInteger(pairedIndex)) {
    const symmetryAxis = { x: 0, y: 1, z: 2 }[symmetry];
    next[pairedIndex] = offset.map((value, axis) => {
      if (axis !== symmetryAxis) return value;
      const numeric = Number(value);
      return Number.isFinite(numeric) ? String(-numeric) : `-(${value})`;
    });
  }
  return next;
}

export function translateFormControlPoints(controlOffsets, pointIndexes, axisIndex, delta, symmetry = 'none') {
  let next = Array.from({ length: 8 }, (_unused, index) => Array.from({ length: 3 }, (_axis, axis) => Number(controlOffsets?.[index]?.[axis]) || 0));
  const handled = new Set();
  for (const pointIndex of [...new Set(pointIndexes)]) {
    if (!Number.isInteger(pointIndex) || pointIndex < 0 || pointIndex > 7 || handled.has(pointIndex)) continue;
    const offset = [...next[pointIndex]];
    offset[axisIndex] += delta;
    next = updateFormControlOffset(next, pointIndex, offset, symmetry).map((point) => point.map((value) => Number(value)));
    handled.add(pointIndex);
    const pairedIndex = SYMMETRY_PAIRS[symmetry]?.[pointIndex];
    if (Number.isInteger(pairedIndex)) handled.add(pairedIndex);
  }
  return next;
}

export function createBoxControlCage(width, depth, height, controlOffsets = [], creaseEdgeIndexes = []) {
  const x = width / 2;
  const y = depth / 2;
  const z = height / 2;
  const baseVertices = [
    [-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z],
    [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z],
  ];
  return {
    vertices: baseVertices.map((point, index) => point.map((value, axis) => value + (Number(controlOffsets[index]?.[axis]) || 0))),
    faces: [
      [0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4],
      [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],
    ],
    creaseEdges: creaseEdgeIndexes.map((index) => FORM_CONTROL_EDGES[index]).filter(Boolean).map((edge) => [...edge]),
  };
}

export function subdivideCatmullClark(cage) {
  const facePoints = cage.faces.map((face) => average(face.map((index) => cage.vertices[index])));
  const edges = new Map();
  const vertexFaces = cage.vertices.map(() => []);
  const vertexEdges = cage.vertices.map(() => []);
  const creaseKeys = new Set((cage.creaseEdges || []).map(([first, second]) => edgeKey(first, second)));
  cage.faces.forEach((face, faceIndex) => {
    face.forEach((vertexIndex, index) => {
      vertexFaces[vertexIndex].push(faceIndex);
      const next = face[(index + 1) % face.length];
      const key = edgeKey(vertexIndex, next);
      if (!edges.has(key)) edges.set(key, { first: vertexIndex, second: next, faces: [] });
      const edge = edges.get(key);
      if (!edge.faces.includes(faceIndex)) edge.faces.push(faceIndex);
      if (!vertexEdges[vertexIndex].includes(key)) vertexEdges[vertexIndex].push(key);
      if (!vertexEdges[next].includes(key)) vertexEdges[next].push(key);
    });
  });

  const vertices = cage.vertices.map((point, vertexIndex) => {
    const adjacentFaces = vertexFaces[vertexIndex];
    const adjacentEdges = vertexEdges[vertexIndex];
    const adjacentCreases = adjacentEdges.filter((key) => creaseKeys.has(key));
    if (adjacentCreases.length >= 3) return [...point];
    if (adjacentCreases.length === 2) {
      const neighbors = adjacentCreases.map((key) => {
        const edge = edges.get(key);
        return cage.vertices[edge.first === vertexIndex ? edge.second : edge.first];
      });
      return point.map((value, axis) => ((6 * value) + neighbors[0][axis] + neighbors[1][axis]) / 8);
    }
    const faceAverage = average(adjacentFaces.map((faceIndex) => facePoints[faceIndex]));
    const edgeAverage = average(adjacentEdges.map((key) => {
      const edge = edges.get(key);
      return average([cage.vertices[edge.first], cage.vertices[edge.second]]);
    }));
    const count = adjacentFaces.length;
    return point.map((value, axis) => (faceAverage[axis] + (2 * edgeAverage[axis]) + ((count - 3) * value)) / count);
  });
  const edgeIndexes = new Map();
  edges.forEach((edge, key) => {
    const points = creaseKeys.has(key)
      ? [cage.vertices[edge.first], cage.vertices[edge.second]]
      : [cage.vertices[edge.first], cage.vertices[edge.second], ...edge.faces.map((faceIndex) => facePoints[faceIndex])];
    edgeIndexes.set(key, vertices.push(average(points)) - 1);
  });
  const faceIndexes = facePoints.map((point) => vertices.push(point) - 1);
  const faces = [];
  cage.faces.forEach((face, faceIndex) => {
    face.forEach((vertexIndex, index) => {
      const previous = face[(index + face.length - 1) % face.length];
      const next = face[(index + 1) % face.length];
      faces.push([vertexIndex, edgeIndexes.get(edgeKey(vertexIndex, next)), faceIndexes[faceIndex], edgeIndexes.get(edgeKey(previous, vertexIndex))]);
    });
  });
  const creaseEdges = [];
  creaseKeys.forEach((key) => {
    const edge = edges.get(key);
    const edgeIndex = edgeIndexes.get(key);
    if (!edge || !Number.isInteger(edgeIndex)) return;
    creaseEdges.push([edge.first, edgeIndex], [edgeIndex, edge.second]);
  });
  return { vertices, faces, creaseEdges };
}

function createBoundsFitter(vertices, width, depth, height) {
  const targets = [width, depth, height];
  const mins = [Infinity, Infinity, Infinity];
  const maxs = [-Infinity, -Infinity, -Infinity];
  vertices.forEach((point) => point.forEach((value, axis) => {
    mins[axis] = Math.min(mins[axis], value);
    maxs[axis] = Math.max(maxs[axis], value);
  }));
  return (point) => point.map((value, axis) => {
    const span = maxs[axis] - mins[axis];
    return span ? (((value - mins[axis]) / span) - 0.5) * targets[axis] : 0;
  });
}

export function createRoundedBoxFormMesh({ width, depth, height, subdivisions = 2, controlOffsets = [], creaseEdges = [] }) {
  const controlCage = createBoxControlCage(width, depth, height, controlOffsets, creaseEdges);
  let cage = controlCage;
  for (let iteration = 0; iteration < subdivisions; iteration += 1) cage = subdivideCatmullClark(cage);
  const fitPoint = createBoundsFitter(cage.vertices, width, depth, height);
  const fittedVertices = cage.vertices.map(fitPoint);
  const fittedControlVertices = controlCage.vertices.map(fitPoint);
  const vertices = fittedVertices.flat();
  const triangles = cage.faces.flatMap((face) => {
    const result = [];
    for (let index = 1; index < face.length - 1; index += 1) result.push(face[0], face[index], face[index + 1]);
    return result;
  });
  return {
    vertices,
    triangles,
    controlVertexCount: 8,
    controlFaceCount: 6,
    controlVertices: fittedControlVertices.flat(),
    controlFaces: controlCage.faces.map((face) => [...face]),
    creaseEdges: [...creaseEdges],
    surfaceVertexCount: fittedVertices.length,
    surfaceFaceCount: cage.faces.length,
    subdivisions,
  };
}
