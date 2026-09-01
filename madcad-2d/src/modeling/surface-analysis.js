const DEFAULT_POSITION_TOLERANCE = 1e-5;

function positionKey(vertices, index, tolerance) {
  const scale = 1 / tolerance;
  const offset = index * 3;
  return `${Math.round(vertices[offset] * scale)},${Math.round(vertices[offset + 1] * scale)},${Math.round(vertices[offset + 2] * scale)}`;
}

function normalizedAverageNormal(normals, firstIndex, secondIndex) {
  if (!normals?.length) return null;
  const firstOffset = firstIndex * 3;
  const secondOffset = secondIndex * 3;
  const vector = [
    normals[firstOffset] + normals[secondOffset],
    normals[firstOffset + 1] + normals[secondOffset + 1],
    normals[firstOffset + 2] + normals[secondOffset + 2],
  ];
  const length = Math.hypot(...vector);
  return length > 1e-9 ? vector.map((value) => value / length) : null;
}

function boundaryEdges(body, tolerance) {
  const result = new Map();
  for (const face of body.faceGroups || []) {
    const localEdges = new Map();
    const end = face.start + face.count;
    for (let cursor = face.start; cursor < end; cursor += 3) {
      const triangle = [body.triangles[cursor], body.triangles[cursor + 1], body.triangles[cursor + 2]];
      for (const [firstIndex, secondIndex] of [[triangle[0], triangle[1]], [triangle[1], triangle[2]], [triangle[2], triangle[0]]]) {
        const firstKey = positionKey(body.vertices, firstIndex, tolerance);
        const secondKey = positionKey(body.vertices, secondIndex, tolerance);
        const key = firstKey < secondKey ? `${firstKey}|${secondKey}` : `${secondKey}|${firstKey}`;
        const current = localEdges.get(key);
        if (current) current.count += 1;
        else localEdges.set(key, {
          count: 1,
          faceId: face.topologyId,
          normal: normalizedAverageNormal(body.normals, firstIndex, secondIndex),
        });
      }
    }
    for (const [key, edge] of localEdges) {
      if (edge.count !== 1) continue;
      if (!result.has(key)) result.set(key, []);
      result.get(key).push(edge);
    }
  }
  return result;
}

function angleBetweenNormals(first, second) {
  if (!first || !second) return null;
  const dot = Math.min(1, Math.max(-1, Math.abs(first[0] * second[0] + first[1] * second[1] + first[2] * second[2])));
  return Math.acos(dot) * 180 / Math.PI;
}

export function analyzeSurfaceContinuity(bodies, { tolerance = DEFAULT_POSITION_TOLERANCE, smoothAngle = 2, warningAngle = 8 } = {}) {
  const seamSegments = [];
  const unsupportedBodyIds = [];
  for (const body of bodies || []) {
    if (!body?.vertices?.length || !body?.triangles?.length || !body?.faceGroups?.length || !body?.normals?.length) {
      unsupportedBodyIds.push(body?.id);
      continue;
    }
    for (const [edgeKey, entries] of boundaryEdges(body, tolerance)) {
      const uniqueFaces = [...new Map(entries.map((entry) => [entry.faceId, entry])).values()];
      if (uniqueFaces.length !== 2) continue;
      const angle = angleBetweenNormals(uniqueFaces[0].normal, uniqueFaces[1].normal);
      if (angle === null) continue;
      seamSegments.push({
        bodyId: body.id,
        edgeKey,
        faceIds: uniqueFaces.map((entry) => entry.faceId),
        angle,
        classification: angle <= smoothAngle ? 'smooth' : angle <= warningAngle ? 'warning' : 'sharp',
      });
    }
  }
  const seamGroups = new Map();
  for (const segment of seamSegments) {
    const faceIds = [...segment.faceIds].sort();
    const key = `${segment.bodyId}:${faceIds.join('|')}`;
    const current = seamGroups.get(key) || { bodyId: segment.bodyId, faceIds, angleSum: 0, segmentCount: 0 };
    current.angleSum += segment.angle;
    current.segmentCount += 1;
    seamGroups.set(key, current);
  }
  const seams = [...seamGroups.values()].map((group) => {
    const angle = group.angleSum / group.segmentCount;
    return {
      bodyId: group.bodyId,
      faceIds: group.faceIds,
      angle,
      segmentCount: group.segmentCount,
      classification: angle <= smoothAngle ? 'smooth' : angle <= warningAngle ? 'warning' : 'sharp',
    };
  });
  const counts = seams.reduce((result, seam) => {
    result[seam.classification] += 1;
    return result;
  }, { smooth: 0, warning: 0, sharp: 0 });
  return { seams, counts, unsupportedBodyIds };
}

function normalAt(normals, index) {
  const offset = index * 3;
  return [normals[offset], normals[offset + 1], normals[offset + 2]];
}

function positionAt(vertices, index) {
  const offset = index * 3;
  return [vertices[offset], vertices[offset + 1], vertices[offset + 2]];
}

function normalAngle(first, second) {
  const dot = Math.min(1, Math.max(-1, first[0] * second[0] + first[1] * second[1] + first[2] * second[2]));
  return Math.acos(dot);
}

function distance(first, second) {
  return Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]);
}

export function calculateMeshCurvature(body) {
  const vertexCount = Math.floor((body?.vertices?.length || 0) / 3);
  if (!vertexCount || body.normals?.length !== body.vertices.length || !body.triangles?.length) return null;
  const totals = new Float64Array(vertexCount);
  const weights = new Uint32Array(vertexCount);
  for (let cursor = 0; cursor < body.triangles.length; cursor += 3) {
    const triangle = [body.triangles[cursor], body.triangles[cursor + 1], body.triangles[cursor + 2]];
    for (const [firstIndex, secondIndex] of [[triangle[0], triangle[1]], [triangle[1], triangle[2]], [triangle[2], triangle[0]]]) {
      const edgeLength = distance(positionAt(body.vertices, firstIndex), positionAt(body.vertices, secondIndex));
      if (edgeLength <= 1e-9) continue;
      const curvature = normalAngle(normalAt(body.normals, firstIndex), normalAt(body.normals, secondIndex)) / edgeLength;
      totals[firstIndex] += curvature;
      totals[secondIndex] += curvature;
      weights[firstIndex] += 1;
      weights[secondIndex] += 1;
    }
  }
  const values = new Float32Array(vertexCount);
  let maximum = 0;
  let sum = 0;
  for (let index = 0; index < vertexCount; index += 1) {
    values[index] = weights[index] ? totals[index] / weights[index] : 0;
    maximum = Math.max(maximum, values[index]);
    sum += values[index];
  }
  return { values, maximum, average: sum / vertexCount };
}

function curvatureColor(value) {
  const stops = [
    [0, [0.05, 0.20, 0.62]],
    [0.33, [0.05, 0.78, 0.90]],
    [0.66, [0.98, 0.82, 0.18]],
    [1, [0.91, 0.18, 0.16]],
  ];
  const upperIndex = stops.findIndex(([position]) => value <= position);
  if (upperIndex <= 0) return stops[0][1];
  const [lowerPosition, lowerColor] = stops[upperIndex - 1];
  const [upperPosition, upperColor] = stops[upperIndex];
  const ratio = (value - lowerPosition) / (upperPosition - lowerPosition);
  return lowerColor.map((channel, index) => channel + (upperColor[index] - channel) * ratio);
}

export function createCurvatureColors(body, maximumScale = 0.2) {
  const analysis = calculateMeshCurvature(body);
  if (!analysis) return null;
  const scale = Math.max(1e-6, Number(maximumScale) || 0.2);
  const colors = new Float32Array(analysis.values.length * 3);
  analysis.values.forEach((curvature, index) => {
    const color = curvatureColor(Math.min(1, curvature / scale));
    colors.set(color, index * 3);
  });
  return { ...analysis, colors, scale };
}

export function summarizeMeshCurvature(bodies) {
  const analyses = (bodies || []).map(calculateMeshCurvature).filter(Boolean);
  if (!analyses.length) return { bodyCount: 0, maximum: 0, average: 0 };
  return {
    bodyCount: analyses.length,
    maximum: Math.max(...analyses.map((analysis) => analysis.maximum)),
    average: analyses.reduce((sum, analysis) => sum + analysis.average, 0) / analyses.length,
  };
}

function samePoint(first, second, tolerance = 1e-6) {
  return distance(first, second) <= tolerance;
}

function unitDirection(first, second) {
  const vector = [second[0] - first[0], second[1] - first[1], second[2] - first[2]];
  const length = Math.hypot(...vector);
  return length > 1e-9 ? vector.map((value) => value / length) : null;
}

export function createCurvatureCombVertices(lineVertices, scale = 10) {
  if (!lineVertices?.length || lineVertices.length < 12) return new Float32Array();
  const result = [];
  const amplification = Math.max(0.01, Number(scale) || 10);
  for (let cursor = 0; cursor + 11 < lineVertices.length; cursor += 6) {
    const first = [lineVertices[cursor], lineVertices[cursor + 1], lineVertices[cursor + 2]];
    const shared = [lineVertices[cursor + 3], lineVertices[cursor + 4], lineVertices[cursor + 5]];
    const nextStart = [lineVertices[cursor + 6], lineVertices[cursor + 7], lineVertices[cursor + 8]];
    const last = [lineVertices[cursor + 9], lineVertices[cursor + 10], lineVertices[cursor + 11]];
    if (!samePoint(shared, nextStart)) continue;
    const incoming = unitDirection(first, shared);
    const outgoing = unitDirection(nextStart, last);
    if (!incoming || !outgoing) continue;
    const curvatureVector = [outgoing[0] - incoming[0], outgoing[1] - incoming[1], outgoing[2] - incoming[2]];
    const magnitude = Math.hypot(...curvatureVector);
    if (magnitude <= 1e-5) continue;
    result.push(
      ...shared,
      shared[0] + curvatureVector[0] * amplification,
      shared[1] + curvatureVector[1] * amplification,
      shared[2] + curvatureVector[2] * amplification,
    );
  }
  return new Float32Array(result);
}
