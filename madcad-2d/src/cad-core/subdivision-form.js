function average(points) {
  return points[0].map((_value, axis) => points.reduce((sum, point) => sum + point[axis], 0) / points.length);
}

function edgeKey(first, second) {
  return first < second ? `${first}:${second}` : `${second}:${first}`;
}

export function formControlEdges(faces) {
  const result = [];
  const seen = new Set();
  for (const face of faces) {
    face.forEach((first, index) => {
      const second = face[(index + 1) % face.length];
      const key = edgeKey(first, second);
      if (seen.has(key)) return;
      seen.add(key);
      result.push([first, second]);
    });
  }
  return result;
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

export const FORM_CONTROL_FACES = Object.freeze([
  [0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4],
  [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],
]);

export function updateFormControlOffset(controlOffsets, pointIndex, offset, symmetry = 'none', symmetryPairs = null) {
  const pointCount = Math.max(8, controlOffsets?.length || 0, pointIndex + 1);
  const next = Array.from({ length: pointCount }, (_unused, index) => Array.from({ length: 3 }, (_axis, axis) => controlOffsets?.[index]?.[axis] ?? '0'));
  next[pointIndex] = [...offset];
  const pairedIndex = (symmetryPairs || SYMMETRY_PAIRS[symmetry])?.[pointIndex];
  if (Number.isInteger(pairedIndex)) {
    const symmetryAxis = { x: 0, y: 1, z: 2 }[symmetry];
    next[pairedIndex] = offset.map((value, axis) => {
      if (axis !== symmetryAxis) return value;
      if (pairedIndex === pointIndex) return typeof value === 'number' ? 0 : '0';
      const numeric = Number(value);
      return Number.isFinite(numeric) ? String(-numeric) : `-(${value})`;
    });
  }
  return next;
}

export function translateFormControlPoints(controlOffsets, pointIndexes, axisIndex, delta, symmetry = 'none', symmetryPairs = null) {
  const pointCount = Math.max(8, controlOffsets?.length || 0, ...pointIndexes.map((index) => index + 1));
  let next = Array.from({ length: pointCount }, (_unused, index) => Array.from({ length: 3 }, (_axis, axis) => Number(controlOffsets?.[index]?.[axis]) || 0));
  const handled = new Set();
  for (const pointIndex of [...new Set(pointIndexes)]) {
    if (!Number.isInteger(pointIndex) || pointIndex < 0 || pointIndex >= pointCount || handled.has(pointIndex)) continue;
    const offset = [...next[pointIndex]];
    offset[axisIndex] += delta;
    next = updateFormControlOffset(next, pointIndex, offset, symmetry, symmetryPairs).map((point) => point.map((value) => Number(value)));
    handled.add(pointIndex);
    const pairedIndex = (symmetryPairs || SYMMETRY_PAIRS[symmetry])?.[pointIndex];
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
    faces: FORM_CONTROL_FACES.map((face) => [...face]),
    creaseEdges: creaseEdgeIndexes.map((index) => FORM_CONTROL_EDGES[index]).filter(Boolean).map((edge) => [...edge]),
  };
}

export function insertFormEdgeLoop(cage, selectedEdge, position = 0.5) {
  if (!Array.isArray(selectedEdge) || selectedEdge.length !== 2 || selectedEdge.some((index) => !Number.isInteger(index) || index < 0 || index >= cage.vertices.length)) throw new Error('Insert Edge wymaga poprawnej krawędzi klatki.');
  if (!Number.isFinite(position) || position <= 0.05 || position >= 0.95) throw new Error('Położenie Insert Edge musi być większe od 0,05 i mniejsze od 0,95.');
  if (cage.faces.some((face) => face.length !== 4)) throw new Error('Insert Edge obsługuje zamknięte klatki czworokątne.');
  const existingEdges = new Set(formControlEdges(cage.faces).map(([first, second]) => edgeKey(first, second)));
  if (!existingEdges.has(edgeKey(...selectedEdge))) throw new Error('Wskazana krawędź nie należy do klatki Form.');

  const orientedRingEdges = new Map([[edgeKey(...selectedEdge), [...selectedEdge]]]);
  const pending = [[...selectedEdge]];
  while (pending.length) {
    const current = pending.shift();
    const currentKey = edgeKey(...current);
    for (const face of cage.faces) {
      const edgeIndex = face.findIndex((vertexIndex, index) => edgeKey(vertexIndex, face[(index + 1) % 4]) === currentKey);
      if (edgeIndex < 0) continue;
      const boundaryForward = face[edgeIndex] === current[0] && face[(edgeIndex + 1) % 4] === current[1];
      const opposite = boundaryForward
        ? [face[(edgeIndex + 3) % 4], face[(edgeIndex + 2) % 4]]
        : [face[(edgeIndex + 2) % 4], face[(edgeIndex + 3) % 4]];
      const oppositeKey = edgeKey(...opposite);
      if (orientedRingEdges.has(oppositeKey)) continue;
      orientedRingEdges.set(oppositeKey, opposite);
      pending.push(opposite);
    }
  }

  const vertices = cage.vertices.map((point) => [...point]);
  const insertedVertices = new Map();
  orientedRingEdges.forEach(([first, second], key) => {
    insertedVertices.set(key, vertices.push(cage.vertices[first].map((value, axis) => value + ((cage.vertices[second][axis] - value) * position))) - 1);
  });
  const faces = [];
  for (const face of cage.faces) {
    const ringEdgeIndexes = face.map((first, index) => orientedRingEdges.has(edgeKey(first, face[(index + 1) % 4]))).map((inRing, index) => inRing ? index : -1).filter((index) => index >= 0);
    if (!ringEdgeIndexes.length) {
      faces.push([...face]);
      continue;
    }
    if (ringEdgeIndexes.length !== 2 || (ringEdgeIndexes[0] + 2) % 4 !== ringEdgeIndexes[1]) throw new Error('Pętla Insert Edge nie przecina ścian po przeciwległych krawędziach.');
    const firstEdge = ringEdgeIndexes[0];
    const oppositeEdge = ringEdgeIndexes[1];
    const firstPoint = insertedVertices.get(edgeKey(face[firstEdge], face[(firstEdge + 1) % 4]));
    const oppositePoint = insertedVertices.get(edgeKey(face[oppositeEdge], face[(oppositeEdge + 1) % 4]));
    faces.push(
      [face[(firstEdge + 1) % 4], face[(firstEdge + 2) % 4], oppositePoint, firstPoint],
      [face[(firstEdge + 3) % 4], face[firstEdge], firstPoint, oppositePoint],
    );
  }

  const creaseEdges = [];
  for (const [first, second] of cage.creaseEdges || []) {
    const insertedPoint = insertedVertices.get(edgeKey(first, second));
    if (Number.isInteger(insertedPoint)) creaseEdges.push([first, insertedPoint], [insertedPoint, second]);
    else creaseEdges.push([first, second]);
  }
  return {
    vertices,
    faces,
    creaseEdges,
    insertedVertexIndexes: [...insertedVertices.values()],
    insertedVertexSourceEdges: [...orientedRingEdges.values()].map((edge) => [...edge]),
    insertedEdgeLoop: { sourceEdge: [...selectedEdge], position },
  };
}

export function formControlSymmetryPairs(insertEdge, symmetry) {
  const basePairs = [...(SYMMETRY_PAIRS[symmetry] || Array.from({ length: 8 }, (_unused, index) => index))];
  if (!insertEdge?.enabled || !SYMMETRY_PAIRS[symmetry]) return basePairs;
  const cage = insertFormEdgeLoop(createBoxControlCage(2, 2, 2), FORM_CONTROL_EDGES[insertEdge.edgeIndex], insertEdge.position);
  const sourceIndexByKey = new Map(cage.insertedVertexSourceEdges.map(([first, second], index) => [edgeKey(first, second), index + 8]));
  for (const [first, second] of cage.insertedVertexSourceEdges) {
    const pointIndex = sourceIndexByKey.get(edgeKey(first, second));
    const pairedIndex = sourceIndexByKey.get(edgeKey(basePairs[first], basePairs[second]));
    basePairs[pointIndex] = pairedIndex;
  }
  return basePairs;
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

export function createRoundedBoxFormMesh({ width, depth, height, subdivisions = 2, controlOffsets = [], creaseEdges = [], insertEdge = null, insertEdgeOffsets = [] }) {
  let controlCage = createBoxControlCage(width, depth, height, controlOffsets, creaseEdges);
  if (insertEdge?.enabled) {
    controlCage = insertFormEdgeLoop(controlCage, FORM_CONTROL_EDGES[insertEdge.edgeIndex], insertEdge.position);
    controlCage.insertedVertexIndexes.forEach((vertexIndex, index) => {
      controlCage.vertices[vertexIndex] = controlCage.vertices[vertexIndex].map((value, axis) => value + (Number(insertEdgeOffsets[index]?.[axis]) || 0));
    });
  }
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
    controlVertexCount: controlCage.vertices.length,
    controlFaceCount: controlCage.faces.length,
    controlVertices: fittedControlVertices.flat(),
    controlFaces: controlCage.faces.map((face) => [...face]),
    creaseEdges: (controlCage.creaseEdges || []).map(([first, second]) => formControlEdges(controlCage.faces).findIndex((edge) => edgeKey(...edge) === edgeKey(first, second))).filter((index) => index >= 0),
    insertEdge: insertEdge?.enabled ? { edgeIndex: insertEdge.edgeIndex, position: insertEdge.position } : null,
    surfaceVertexCount: fittedVertices.length,
    surfaceFaceCount: cage.faces.length,
    subdivisions,
  };
}
