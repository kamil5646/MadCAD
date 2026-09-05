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

function squaredDistance(first, second) {
  return first.reduce((sum, value, axis) => sum + ((value - second[axis]) ** 2), 0);
}

export function bridgeFormFaces(cage, firstFaceIndex, secondFaceIndex, inset = 0.45) {
  if (!Number.isInteger(firstFaceIndex) || !Number.isInteger(secondFaceIndex) || firstFaceIndex < 0 || secondFaceIndex < 0 || firstFaceIndex >= cage.faces.length || secondFaceIndex >= cage.faces.length || firstFaceIndex === secondFaceIndex) throw new Error('Bridge wymaga dwóch różnych ścian klatki.');
  if (!Number.isFinite(inset) || inset <= 0.1 || inset >= 0.9) throw new Error('Wcięcie Bridge musi być większe od 0,1 i mniejsze od 0,9.');
  const firstFace = cage.faces[firstFaceIndex];
  const secondFace = cage.faces[secondFaceIndex];
  if (firstFace.length !== 4 || secondFace.length !== 4) throw new Error('Bridge obsługuje dwie ściany czworokątne.');
  if (firstFace.some((vertexIndex) => secondFace.includes(vertexIndex))) throw new Error('Bridge wymaga dwóch rozłącznych ścian bez wspólnych wierzchołków.');

  const vertices = cage.vertices.map((point) => [...point]);
  const createInsetLoop = (face) => {
    const center = average(face.map((index) => cage.vertices[index]));
    return face.map((sourceVertexIndex) => vertices.push(cage.vertices[sourceVertexIndex].map((value, axis) => center[axis] + ((value - center[axis]) * inset))) - 1);
  };
  const firstLoop = createInsetLoop(firstFace);
  const secondLoop = createInsetLoop(secondFace);

  // Opposite winding is required so every tube edge cancels the matching rim edge.
  const reversedSecond = [...secondFace].reverse();
  let correspondence = reversedSecond;
  let bestDistance = Infinity;
  for (let shift = 0; shift < reversedSecond.length; shift += 1) {
    const candidate = reversedSecond.map((_value, index) => reversedSecond[(index + shift) % reversedSecond.length]);
    const distance = firstFace.reduce((sum, vertexIndex, index) => sum + squaredDistance(cage.vertices[vertexIndex], cage.vertices[candidate[index]]), 0);
    if (distance < bestDistance) {
      correspondence = candidate;
      bestDistance = distance;
    }
  }
  const secondLoopBySource = new Map(secondFace.map((sourceVertexIndex, index) => [sourceVertexIndex, secondLoop[index]]));
  const matchedSecondLoop = correspondence.map((sourceVertexIndex) => secondLoopBySource.get(sourceVertexIndex));

  const faces = cage.faces.filter((_face, index) => index !== firstFaceIndex && index !== secondFaceIndex).map((face) => [...face]);
  const addRim = (face, loop) => face.forEach((outer, index) => faces.push([outer, face[(index + 1) % 4], loop[(index + 1) % 4], loop[index]]));
  addRim(firstFace, firstLoop);
  addRim(secondFace, secondLoop);
  firstLoop.forEach((point, index) => faces.push([point, firstLoop[(index + 1) % 4], matchedSecondLoop[(index + 1) % 4], matchedSecondLoop[index]]));

  return {
    vertices,
    faces,
    creaseEdges: (cage.creaseEdges || []).map((edge) => [...edge]),
    bridgeVertexIndexes: [...firstLoop, ...secondLoop],
    bridgeVertexSourcePoints: [...firstFace, ...secondFace],
    bridge: { firstFaceIndex, secondFaceIndex, inset },
  };
}

export function symmetricFormFaceIndexes(cage, symmetryPairs, faceIndex) {
  if (!Number.isInteger(faceIndex) || faceIndex < 0 || faceIndex >= cage.faces.length) throw new Error('Fill Hole wymaga poprawnej ściany granicznej.');
  const sourceFace = cage.faces[faceIndex];
  if (!symmetryPairs) return [faceIndex];
  const mirroredPoints = new Set(sourceFace.map((pointIndex) => symmetryPairs[pointIndex]));
  if ([...mirroredPoints].some((pointIndex) => !Number.isInteger(pointIndex))) throw new Error('Fill Hole nie może odtworzyć pary symetrycznej tej ściany.');
  const mirroredFaceIndex = cage.faces.findIndex((face) => face.length === sourceFace.length && face.every((pointIndex) => mirroredPoints.has(pointIndex)));
  if (mirroredFaceIndex < 0) throw new Error('Fill Hole nie znalazł symetrycznej granicy ściany.');
  return mirroredFaceIndex === faceIndex ? [faceIndex] : [faceIndex, mirroredFaceIndex];
}

export function fillFormHoles(cage, faceIndexes, centerOffsets = []) {
  const uniqueFaceIndexes = [...new Set(faceIndexes || [])];
  if (!uniqueFaceIndexes.length) throw new Error('Fill Hole wymaga co najmniej jednej ściany granicznej.');
  if (uniqueFaceIndexes.some((faceIndex) => !Number.isInteger(faceIndex) || faceIndex < 0 || faceIndex >= cage.faces.length)) throw new Error('Fill Hole wymaga poprawnej ściany granicznej.');
  const vertices = cage.vertices.map((point) => [...point]);
  const sourceFaces = uniqueFaceIndexes.map((faceIndex) => [...cage.faces[faceIndex]]);
  const faces = cage.faces.filter((_face, faceIndex) => !uniqueFaceIndexes.includes(faceIndex)).map((face) => [...face]);
  const filledVertexIndexes = sourceFaces.map((face, fillIndex) => {
    if (face.length < 3) throw new Error('Fill Hole wymaga granicy z co najmniej trzech krawędzi.');
    const center = average(face.map((pointIndex) => cage.vertices[pointIndex])).map((value, axis) => value + (Number(centerOffsets[fillIndex]?.[axis]) || 0));
    const centerIndex = vertices.push(center) - 1;
    face.forEach((pointIndex, index) => faces.push([pointIndex, face[(index + 1) % face.length], centerIndex]));
    return centerIndex;
  });
  return {
    vertices,
    faces,
    creaseEdges: (cage.creaseEdges || []).map((edge) => [...edge]),
    filledVertexIndexes,
    fillHole: { faceIndexes: uniqueFaceIndexes },
  };
}

export function formControlSymmetryPairs(insertEdge, symmetry, bridge = null, fillHole = null) {
  const basePairs = [...(SYMMETRY_PAIRS[symmetry] || Array.from({ length: 8 }, (_unused, index) => index))];
  if (!SYMMETRY_PAIRS[symmetry]) return basePairs;
  let cage = createBoxControlCage(2, 2, 2);
  if (insertEdge?.enabled) {
    cage = insertFormEdgeLoop(cage, FORM_CONTROL_EDGES[insertEdge.edgeIndex], insertEdge.position);
    const sourceIndexByKey = new Map(cage.insertedVertexSourceEdges.map(([first, second], index) => [edgeKey(first, second), index + 8]));
    for (const [first, second] of cage.insertedVertexSourceEdges) {
      const pointIndex = sourceIndexByKey.get(edgeKey(first, second));
      const pairedIndex = sourceIndexByKey.get(edgeKey(basePairs[first], basePairs[second]));
      basePairs[pointIndex] = pairedIndex;
    }
  }
  if (bridge?.enabled) {
    const sourcePointPairs = [...basePairs];
    cage = bridgeFormFaces(cage, bridge.firstFaceIndex, bridge.secondFaceIndex, bridge.inset);
    const bridgeIndexBySource = new Map(cage.bridgeVertexSourcePoints.map((sourcePoint, index) => [sourcePoint, cage.bridgeVertexIndexes[index]]));
    cage.bridgeVertexSourcePoints.forEach((sourcePoint, index) => {
      basePairs[cage.bridgeVertexIndexes[index]] = bridgeIndexBySource.get(sourcePointPairs[sourcePoint]);
    });
  }
  if (fillHole?.enabled) {
    const faceIndexes = symmetricFormFaceIndexes(cage, basePairs, fillHole.faceIndex);
    cage = fillFormHoles(cage, faceIndexes);
    if (cage.filledVertexIndexes.length === 1) basePairs[cage.filledVertexIndexes[0]] = cage.filledVertexIndexes[0];
    else {
      basePairs[cage.filledVertexIndexes[0]] = cage.filledVertexIndexes[1];
      basePairs[cage.filledVertexIndexes[1]] = cage.filledVertexIndexes[0];
    }
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
  const patches = [];
  cage.faces.forEach((face, faceIndex) => {
    face.forEach((vertexIndex, index) => {
      const previous = face[(index + face.length - 1) % face.length];
      const next = face[(index + 1) % face.length];
      faces.push([vertexIndex, edgeIndexes.get(edgeKey(vertexIndex, next)), faceIndexes[faceIndex], edgeIndexes.get(edgeKey(previous, vertexIndex))]);
      const parentPatch = cage.patches?.[faceIndex];
      if (!parentPatch || face.length !== 4) patches.push(null);
      else {
        const currentUv = parentPatch.uv[index];
        const nextUv = parentPatch.uv[(index + 1) % 4];
        const previousUv = parentPatch.uv[(index + 3) % 4];
        patches.push({
          sourceFaceIndex: parentPatch.sourceFaceIndex,
          uv: [currentUv, average([currentUv, nextUv]), average(parentPatch.uv), average([previousUv, currentUv])],
        });
      }
    });
  });
  const creaseEdges = [];
  creaseKeys.forEach((key) => {
    const edge = edges.get(key);
    const edgeIndex = edgeIndexes.get(key);
    if (!edge || !Number.isInteger(edgeIndex)) return;
    creaseEdges.push([edge.first, edgeIndex], [edgeIndex, edge.second]);
  });
  return { vertices, faces, creaseEdges, patches };
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

export function createRoundedBoxFormMesh({ width, depth, height, subdivisions = 2, controlOffsets = [], creaseEdges = [], insertEdge = null, insertEdgeOffsets = [], bridge = null, bridgeOffsets = [], fillHole = null, fillHoleOffsets = [] }) {
  let controlCage = createBoxControlCage(width, depth, height, controlOffsets, creaseEdges);
  if (insertEdge?.enabled) {
    controlCage = insertFormEdgeLoop(controlCage, FORM_CONTROL_EDGES[insertEdge.edgeIndex], insertEdge.position);
    controlCage.insertedVertexIndexes.forEach((vertexIndex, index) => {
      controlCage.vertices[vertexIndex] = controlCage.vertices[vertexIndex].map((value, axis) => value + (Number(insertEdgeOffsets[index]?.[axis]) || 0));
    });
  }
  if (bridge?.enabled) {
    controlCage = bridgeFormFaces(controlCage, bridge.firstFaceIndex, bridge.secondFaceIndex, bridge.inset);
    controlCage.bridgeVertexIndexes.forEach((vertexIndex, index) => {
      controlCage.vertices[vertexIndex] = controlCage.vertices[vertexIndex].map((value, axis) => value + (Number(bridgeOffsets[index]?.[axis]) || 0));
    });
  }
  const smoothControlCage = controlCage;
  if (fillHole?.enabled) controlCage = fillFormHoles(controlCage, fillHole.faceIndexes, fillHoleOffsets);
  let cage = controlCage;
  for (let iteration = 0; iteration < subdivisions; iteration += 1) cage = subdivideCatmullClark(cage);
  let patchCage = {
    ...smoothControlCage,
    patches: smoothControlCage.faces.map((face, sourceFaceIndex) => face.length === 4
      ? { sourceFaceIndex, uv: [[0, 0], [1, 0], [1, 1], [0, 1]] }
      : null),
  };
  for (let iteration = 0; iteration < subdivisions; iteration += 1) patchCage = subdivideCatmullClark(patchCage);
  const fitPoint = createBoundsFitter(cage.vertices, width, depth, height);
  const fittedVertices = cage.vertices.map(fitPoint);
  const patchFitPoint = createBoundsFitter(patchCage.vertices, width, depth, height);
  const fittedPatchVertices = patchCage.vertices.map(patchFitPoint);
  const fittedControlVertices = controlCage.vertices.map(fitPoint);
  const vertices = fittedVertices.flat();
  const triangles = cage.faces.flatMap((face) => {
    const result = [];
    for (let index = 1; index < face.length - 1; index += 1) result.push(face[0], face[index], face[index + 1]);
    return result;
  });
  const smoothPatches = [];
  if (smoothControlCage.faces.every((face) => face.length === 4) && patchCage.patches.every(Boolean)) {
    const span = 2 ** subdivisions;
    for (let sourceFaceIndex = 0; sourceFaceIndex < smoothControlCage.faces.length; sourceFaceIndex += 1) {
      const grid = Array.from({ length: span + 1 }, () => Array(span + 1));
      patchCage.faces.forEach((face, faceIndex) => {
        const patch = patchCage.patches[faceIndex];
        if (patch.sourceFaceIndex !== sourceFaceIndex) return;
        face.forEach((vertexIndex, cornerIndex) => {
          const [u, v] = patch.uv[cornerIndex];
          grid[Math.round(u * span)][Math.round(v * span)] = [...fittedPatchVertices[vertexIndex]];
        });
      });
      if (grid.every((row) => row.every((point) => Array.isArray(point)))) {
        const fillIndex = fillHole?.enabled ? fillHole.faceIndexes.indexOf(sourceFaceIndex) : -1;
        if (fillIndex >= 0) {
          const offset = fillHoleOffsets[fillIndex]?.map(Number) || [0, 0, 0];
          grid.forEach((row, uIndex) => row.forEach((point, vIndex) => {
            const u = uIndex / span;
            const v = vIndex / span;
            const influence = 16 * u * (1 - u) * v * (1 - v);
            row[vIndex] = point.map((value, axis) => value + ((Number.isFinite(offset[axis]) ? offset[axis] : 0) * influence));
          }));
        }
        smoothPatches.push(grid);
      }
    }
  }
  return {
    vertices,
    triangles,
    smoothPatches,
    controlVertexCount: controlCage.vertices.length,
    controlFaceCount: controlCage.faces.length,
    controlVertices: fittedControlVertices.flat(),
    controlFaces: controlCage.faces.map((face) => [...face]),
    creaseEdges: (controlCage.creaseEdges || []).map(([first, second]) => formControlEdges(controlCage.faces).findIndex((edge) => edgeKey(...edge) === edgeKey(first, second))).filter((index) => index >= 0),
    insertEdge: insertEdge?.enabled ? { edgeIndex: insertEdge.edgeIndex, position: insertEdge.position } : null,
    bridge: bridge?.enabled ? { firstFaceIndex: bridge.firstFaceIndex, secondFaceIndex: bridge.secondFaceIndex, inset: bridge.inset } : null,
    fillHole: fillHole?.enabled ? { faceIndexes: [...fillHole.faceIndexes] } : null,
    surfaceVertexCount: fittedVertices.length,
    surfaceFaceCount: cage.faces.length,
    subdivisions,
  };
}
