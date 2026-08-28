import { evaluateExpression, resolveParameters } from './expressions.js';
import { GEOMETRY_POLICY } from './geometry-policy.js';
import { createId } from './ids.js';

const EPSILON = GEOMETRY_POLICY.profileJoinTolerance;

function resolvedValues(parameters) {
  if (!Array.isArray(parameters)) return parameters || {};
  const result = resolveParameters(parameters);
  if (!result.valid) throw new Error(Object.values(result.errors).join(' '));
  return result.values;
}

function numeric(value, parameters) {
  const direct = Number(value);
  return Number.isFinite(direct) ? direct : evaluateExpression(value, parameters);
}

function distance(first, second) {
  return Math.hypot(first[0] - second[0], first[1] - second[1]);
}

function samePoint(first, second, tolerance = EPSILON) {
  return distance(first, second) <= tolerance;
}

function diagnostic(code, message, entityIds = [], point = null) {
  return { code, severity: 'error', message, entityIds: [...new Set(entityIds)], ...(point ? { point } : {}) };
}

function clusterPoints(points, tolerance) {
  const clusters = [];
  const pointToVertex = new Map();
  for (const point of points) {
    let cluster = clusters.find((candidate) => samePoint(candidate.coordinate, point.coordinate, tolerance));
    if (!cluster) {
      cluster = { id: `vertex-${clusters.length + 1}`, coordinate: [...point.coordinate], pointIds: [] };
      clusters.push(cluster);
    }
    cluster.pointIds.push(point.id);
    pointToVertex.set(point.id, cluster.id);
  }
  return { vertices: clusters, pointToVertex };
}

function sampleArc(center, start, end, direction, reversed = false, steps = 32) {
  const from = reversed ? end : start;
  const to = reversed ? start : end;
  const effectiveDirection = reversed ? (direction === 'cw' ? 'ccw' : 'cw') : direction;
  const radius = distance(center, from);
  let startAngle = Math.atan2(from[1] - center[1], from[0] - center[0]);
  let endAngle = Math.atan2(to[1] - center[1], to[0] - center[0]);
  if (effectiveDirection === 'cw' && endAngle >= startAngle) endAngle -= Math.PI * 2;
  if (effectiveDirection !== 'cw' && endAngle <= startAngle) endAngle += Math.PI * 2;
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = startAngle + ((endAngle - startAngle) * index) / steps;
    return [center[0] + (Math.cos(angle) * radius), center[1] + (Math.sin(angle) * radius)];
  });
}

function sampleCircle(center, radius, reversed = false, steps = 64) {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = ((reversed ? -index : index) / steps) * Math.PI * 2;
    return [center[0] + (Math.cos(angle) * radius), center[1] + (Math.sin(angle) * radius)];
  });
}

function sampleEllipse(center, majorRadius, minorRadius, rotation, reversed = false, steps = 72) {
  const angle = rotation * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return Array.from({ length: steps + 1 }, (_, index) => {
    const parameter = ((reversed ? -index : index) / steps) * Math.PI * 2;
    const x = Math.cos(parameter) * majorRadius;
    const y = Math.sin(parameter) * minorRadius;
    return [center[0] + (x * cosine) - (y * sine), center[1] + (x * sine) + (y * cosine)];
  });
}

function sampleEllipticalArc(edge, reversed = false, steps = 48) {
  const effectiveDirection = reversed ? (edge.direction === 'cw' ? 'ccw' : 'cw') : edge.direction;
  let startAngle = (reversed ? edge.endAngle : edge.startAngle) * Math.PI / 180;
  let endAngle = (reversed ? edge.startAngle : edge.endAngle) * Math.PI / 180;
  if (effectiveDirection === 'cw' && endAngle >= startAngle) endAngle -= Math.PI * 2;
  if (effectiveDirection !== 'cw' && endAngle <= startAngle) endAngle += Math.PI * 2;
  const rotation = edge.rotation * Math.PI / 180;
  return Array.from({ length: steps + 1 }, (_, index) => {
    const parameter = startAngle + ((endAngle - startAngle) * index) / steps;
    const x = Math.cos(parameter) * edge.majorRadius;
    const y = Math.sin(parameter) * edge.minorRadius;
    return [edge.center[0] + (x * Math.cos(rotation)) - (y * Math.sin(rotation)), edge.center[1] + (x * Math.sin(rotation)) + (y * Math.cos(rotation))];
  });
}

function bezierPoint(points, parameter) {
  let level = points.map((entry) => [...entry]);
  while (level.length > 1) level = level.slice(0, -1).map((entry, index) => [entry[0] + ((level[index + 1][0] - entry[0]) * parameter), entry[1] + ((level[index + 1][1] - entry[1]) * parameter)]);
  return level[0];
}

function sampleSpline(edge, reversed = false, steps = 16) {
  const points = reversed ? [...edge.controlPoints].reverse() : edge.controlPoints;
  if (edge.mode === 'control') return Array.from({ length: steps * 2 + 1 }, (_, index) => bezierPoint(points, index / (steps * 2)));
  const sampled = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    const controls = [p1, [p1[0] + ((p2[0] - p0[0]) / 6), p1[1] + ((p2[1] - p0[1]) / 6)], [p2[0] - ((p3[0] - p1[0]) / 6), p2[1] - ((p3[1] - p1[1]) / 6)], p2];
    for (let step = index ? 1 : 0; step <= steps; step += 1) sampled.push(bezierPoint(controls, step / steps));
  }
  return sampled;
}

function sampleConic(edge, reversed = false, steps = 32) {
  const points = reversed ? [...edge.controlPoints].reverse() : edge.controlPoints;
  const [start, control, end] = points;
  const rho = edge.rho;
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    const inverse = 1 - t;
    const denominator = (inverse * inverse) + (2 * rho * inverse * t) + (t * t);
    return [
      ((inverse * inverse * start[0]) + (2 * rho * inverse * t * control[0]) + (t * t * end[0])) / denominator,
      ((inverse * inverse * start[1]) + (2 * rho * inverse * t * control[1]) + (t * t * end[1])) / denominator,
    ];
  });
}

function edgeSamples(edge, reversed = false) {
  if (edge.type === 'line') return reversed ? [edge.end, edge.start] : [edge.start, edge.end];
  if (edge.type === 'arc') return sampleArc(edge.center, edge.start, edge.end, edge.direction, reversed);
  if (edge.type === 'ellipticalArc') return sampleEllipticalArc(edge, reversed);
  if (edge.type === 'spline') return sampleSpline(edge, reversed);
  if (edge.type === 'conic') return sampleConic(edge, reversed);
  if (edge.type === 'ellipse') return sampleEllipse(edge.center, edge.majorRadius, edge.minorRadius, edge.rotation, reversed);
  return sampleCircle(edge.center, edge.radius, reversed);
}

export function sketchDrawingSegments(sketch, parameters = [], { layers = [], includeConstruction = false } = {}) {
  const values = resolvedValues(parameters);
  const layerMap = new Map((layers || []).map((layer) => [layer.id, layer]));
  const entities = (sketch?.entities || []).filter((entity) => {
    if (entity.type === 'point' || entity.type === 'text') return false;
    if (!includeConstruction && entity.role === 'construction') return false;
    const layer = entity.layerId ? layerMap.get(entity.layerId) : null;
    return layer?.visible !== false && layer?.printable !== false;
  });
  const pointMap = new Map((sketch?.entities || [])
    .filter((entity) => entity.type === 'point')
    .map((point) => [point.id, [numeric(point.geometry.x, values), numeric(point.geometry.y, values)]]));
  const segments = [];
  const addSamples = (samples) => {
    for (let index = 0; index + 1 < samples.length; index += 1) {
      const first = samples[index];
      const second = samples[index + 1];
      if (first?.every(Number.isFinite) && second?.every(Number.isFinite) && distance(first, second) > GEOMETRY_POLICY.linearTolerance) segments.push([first, second]);
    }
  };

  for (const entity of entities) {
    const points = (entity.pointIds || []).map((pointId) => pointMap.get(pointId));
    if (entity.type === 'line' && points[0] && points[1]) addSamples(points.slice(0, 2));
    else if (entity.type === 'arc' && points[0] && points[1] && points[2]) addSamples(edgeSamples({ type: 'arc', center: points[0], start: points[1], end: points[2], direction: entity.geometry?.direction || 'ccw' }));
    else if (entity.type === 'circle' && points[0]) addSamples(edgeSamples({ type: 'circle', center: points[0], radius: numeric(entity.geometry?.radius, values) }));
    else if (entity.type === 'ellipse' && points[0]) addSamples(edgeSamples({ type: 'ellipse', center: points[0], majorRadius: numeric(entity.geometry?.majorRadius, values), minorRadius: numeric(entity.geometry?.minorRadius, values), rotation: numeric(entity.geometry?.rotation || '0', values) }));
    else if (entity.type === 'ellipticalArc' && points[0] && points[1] && points[2]) addSamples(edgeSamples({ type: 'ellipticalArc', center: points[0], start: points[1], end: points[2], majorRadius: numeric(entity.geometry?.majorRadius, values), minorRadius: numeric(entity.geometry?.minorRadius, values), rotation: numeric(entity.geometry?.rotation || '0', values), startAngle: numeric(entity.geometry?.startAngle, values), endAngle: numeric(entity.geometry?.endAngle, values), direction: entity.geometry?.direction || 'ccw' }));
    else if (entity.type === 'spline' && points.filter(Boolean).length >= 2) addSamples(edgeSamples({ type: 'spline', mode: entity.geometry?.mode === 'control' ? 'control' : 'fit', controlPoints: points.filter(Boolean) }));
    else if (entity.type === 'conic' && points.length === 3 && points.every(Boolean)) addSamples(edgeSamples({ type: 'conic', controlPoints: points, rho: numeric(entity.geometry?.rho || '1', values) }));
  }
  return segments;
}

function segmentIntersection(firstStart, firstEnd, secondStart, secondEnd, tolerance = EPSILON) {
  const firstVector = [firstEnd[0] - firstStart[0], firstEnd[1] - firstStart[1]];
  const secondVector = [secondEnd[0] - secondStart[0], secondEnd[1] - secondStart[1]];
  const denominator = (firstVector[0] * secondVector[1]) - (firstVector[1] * secondVector[0]);
  const offset = [secondStart[0] - firstStart[0], secondStart[1] - firstStart[1]];
  if (Math.abs(denominator) <= tolerance) {
    const collinear = Math.abs((offset[0] * firstVector[1]) - (offset[1] * firstVector[0])) <= tolerance;
    if (!collinear) return null;
    const axis = Math.abs(firstVector[0]) >= Math.abs(firstVector[1]) ? 0 : 1;
    const length = firstVector[axis];
    if (Math.abs(length) <= tolerance) return null;
    const values = [(secondStart[axis] - firstStart[axis]) / length, (secondEnd[axis] - firstStart[axis]) / length].sort((a, b) => a - b);
    const overlapStart = Math.max(0, values[0]);
    const overlapEnd = Math.min(1, values[1]);
    return overlapEnd - overlapStart > tolerance ? { kind: 'overlap' } : null;
  }
  const firstT = ((offset[0] * secondVector[1]) - (offset[1] * secondVector[0])) / denominator;
  const secondT = ((offset[0] * firstVector[1]) - (offset[1] * firstVector[0])) / denominator;
  if (firstT < -tolerance || firstT > 1 + tolerance || secondT < -tolerance || secondT > 1 + tolerance) return null;
  return {
    kind: 'point',
    point: [firstStart[0] + (firstT * firstVector[0]), firstStart[1] + (firstT * firstVector[1])],
    firstEndpoint: firstT <= tolerance || firstT >= 1 - tolerance,
    secondEndpoint: secondT <= tolerance || secondT >= 1 - tolerance,
  };
}

function edgeIntersections(first, second, tolerance) {
  const firstSamples = edgeSamples(first);
  const secondSamples = edgeSamples(second);
  const results = [];
  for (let firstIndex = 0; firstIndex < firstSamples.length - 1; firstIndex += 1) {
    for (let secondIndex = 0; secondIndex < secondSamples.length - 1; secondIndex += 1) {
      const result = segmentIntersection(firstSamples[firstIndex], firstSamples[firstIndex + 1], secondSamples[secondIndex], secondSamples[secondIndex + 1], tolerance);
      if (result) results.push(result);
    }
  }
  return results;
}

function analyzeCurvedEdge(edge, tolerance) {
  const samples = edgeSamples(edge);
  const curvatures = [];
  let singular = false;
  for (let index = 1; index < samples.length - 1; index += 1) {
    const first = samples[index - 1];
    const middle = samples[index];
    const last = samples[index + 1];
    const a = distance(first, middle);
    const b = distance(middle, last);
    const c = distance(first, last);
    const denominator = a * b * c;
    if (denominator <= tolerance ** 3) {
      singular = true;
      continue;
    }
    const cross = ((middle[0] - first[0]) * (last[1] - first[1])) - ((middle[1] - first[1]) * (last[0] - first[0]));
    curvatures.push((2 * cross) / denominator);
  }
  const selfIntersections = [];
  const segmentCount = samples.length - 1;
  const closed = samePoint(samples[0], samples.at(-1), tolerance);
  for (let firstIndex = 0; firstIndex < segmentCount; firstIndex += 1) {
    for (let secondIndex = firstIndex + 2; secondIndex < segmentCount; secondIndex += 1) {
      if (closed && firstIndex === 0 && secondIndex === segmentCount - 1) continue;
      const intersection = segmentIntersection(samples[firstIndex], samples[firstIndex + 1], samples[secondIndex], samples[secondIndex + 1], tolerance);
      if (intersection?.kind === 'overlap' || (intersection?.kind === 'point' && !(intersection.firstEndpoint && intersection.secondEndpoint))) {
        selfIntersections.push(intersection.point || samples[firstIndex]);
      }
    }
  }
  return {
    entityId: edge.id,
    type: edge.type,
    sampleCount: samples.length,
    curvature: {
      min: curvatures.length ? Math.min(...curvatures) : 0,
      max: curvatures.length ? Math.max(...curvatures) : 0,
      maxAbsolute: curvatures.length ? Math.max(...curvatures.map(Math.abs)) : 0,
    },
    singular,
    selfIntersections,
  };
}

function canonicalCycle(steps) {
  const tokens = steps.map((step) => step.edge.id);
  const variants = [];
  for (let index = 0; index < tokens.length; index += 1) variants.push([...tokens.slice(index), ...tokens.slice(0, index)].join('|'));
  const reversed = [...tokens].reverse();
  for (let index = 0; index < reversed.length; index += 1) variants.push([...reversed.slice(index), ...reversed.slice(0, index)].join('|'));
  return variants.sort()[0];
}

function findGraphCycles(vertices, edges) {
  const adjacency = new Map(vertices.map((vertex) => [vertex.id, []]));
  for (const edge of edges) {
    adjacency.get(edge.startVertex)?.push({ edge, next: edge.endVertex, reversed: false });
    adjacency.get(edge.endVertex)?.push({ edge, next: edge.startVertex, reversed: true });
  }
  const cycles = new Map();
  const vertexOrder = new Map(vertices.map((vertex, index) => [vertex.id, index]));
  const limit = Math.max(64, edges.length * edges.length * 4);

  for (const start of vertices) {
    const walk = (vertexId, visitedVertices, usedEdges, steps) => {
      if (cycles.size >= limit) return;
      for (const nextStep of adjacency.get(vertexId) || []) {
        if (usedEdges.has(nextStep.edge.id)) continue;
        if (nextStep.next === start.id && steps.length >= 1) {
          const cycleSteps = [...steps, nextStep];
          if (cycleSteps.length >= 2) cycles.set(canonicalCycle(cycleSteps), cycleSteps);
          continue;
        }
        if (visitedVertices.has(nextStep.next) || vertexOrder.get(nextStep.next) < vertexOrder.get(start.id)) continue;
        walk(nextStep.next, new Set([...visitedVertices, nextStep.next]), new Set([...usedEdges, nextStep.edge.id]), [...steps, nextStep]);
      }
    };
    walk(start.id, new Set([start.id]), new Set(), []);
  }
  return [...cycles.values()];
}

function pointsForCycle(steps) {
  const points = [];
  for (const step of steps) {
    const samples = edgeSamples(step.edge, step.reversed);
    points.push(...(points.length ? samples.slice(1) : samples));
  }
  if (points.length > 1 && samePoint(points[0], points.at(-1))) points.pop();
  return points;
}

function signedArea(points) {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length];
    return area + ((point[0] * next[1]) - (next[0] * point[1]));
  }, 0) / 2;
}

function polygonCentroid(points) {
  const area = signedArea(points);
  if (Math.abs(area) <= EPSILON) return points[0] || [0, 0];
  let x = 0;
  let y = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const next = points[(index + 1) % points.length];
    const cross = (point[0] * next[1]) - (next[0] * point[1]);
    x += (point[0] + next[0]) * cross;
    y += (point[1] + next[1]) * cross;
  }
  return [x / (6 * area), y / (6 * area)];
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const intersects = ((currentPoint[1] > point[1]) !== (previousPoint[1] > point[1]))
      && point[0] < ((previousPoint[0] - currentPoint[0]) * (point[1] - currentPoint[1])) / ((previousPoint[1] - currentPoint[1]) || Number.EPSILON) + currentPoint[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

function loopSignature(loop) {
  return [...loop.steps.map((step) => step.edge.id)].sort().join('|');
}

function profileSignature(outer, holes) {
  return `${loopSignature(outer)}::${holes.map(loopSignature).sort().join('::')}`;
}

function loopDocumentData(loop) {
  return {
    entityIds: loop.steps.map((step) => step.edge.id),
    entityDirections: loop.steps.map((step) => step.reversed ? -1 : 1),
  };
}

function geometryCache(loop) {
  const xs = loop.points.map((point) => point[0]);
  const ys = loop.points.map((point) => point[1]);
  return {
    x: String((Math.min(...xs) + Math.max(...xs)) / 2),
    y: String((Math.min(...ys) + Math.max(...ys)) / 2),
    width: String(Math.max(...xs) - Math.min(...xs)),
    height: String(Math.max(...ys) - Math.min(...ys)),
    points: loop.points.map(([x, y]) => ({ x: String(x), y: String(y) })),
  };
}

export function detectSketchProfiles(sketch, parameters = [], options = {}) {
  const tolerance = options.tolerance || GEOMETRY_POLICY.profileJoinTolerance;
  const values = resolvedValues(parameters);
  const entities = (sketch?.entities || []).filter((entity) => !['construction', 'centerline'].includes(entity.role));
  const pointEntities = entities.filter((entity) => entity.type === 'point').map((entity) => ({
    id: entity.id,
    coordinate: [numeric(entity.geometry.x, values), numeric(entity.geometry.y, values)],
  }));
  const pointMap = new Map(pointEntities.map((point) => [point.id, point.coordinate]));
  const { vertices, pointToVertex } = clusterPoints(pointEntities, tolerance);
  const diagnostics = [];
  const edges = [];
  const circleEdges = [];

  for (const entity of entities) {
    if (entity.type === 'line' || entity.type === 'arc' || entity.type === 'ellipticalArc' || entity.type === 'spline' || entity.type === 'conic') {
      const isCenteredCurve = entity.type === 'arc' || entity.type === 'ellipticalArc';
      const startPointId = isCenteredCurve ? entity.pointIds?.[1] : entity.pointIds?.[0];
      const endPointId = isCenteredCurve ? entity.pointIds?.[2] : entity.pointIds?.at(-1);
      const start = pointMap.get(startPointId);
      const end = pointMap.get(endPointId);
      if (!start || !end) continue;
      if (samePoint(start, end, GEOMETRY_POLICY.linearTolerance)) {
        diagnostics.push(diagnostic('ZERO_LENGTH', `Encja ${entity.id} ma zerową długość.`, [entity.id], start));
        continue;
      }
      const edge = {
        id: entity.id,
        type: entity.type,
        start,
        end,
        startVertex: pointToVertex.get(startPointId),
        endVertex: pointToVertex.get(endPointId),
      };
      if (entity.type === 'arc') {
        edge.center = pointMap.get(entity.pointIds?.[0]);
        edge.direction = entity.geometry?.direction || 'ccw';
        if (!edge.center || distance(edge.center, start) <= GEOMETRY_POLICY.linearTolerance) {
          diagnostics.push(diagnostic('ZERO_RADIUS', `Łuk ${entity.id} ma nieprawidłowy promień.`, [entity.id], edge.center || start));
          continue;
        }
      } else if (entity.type === 'ellipticalArc') {
        edge.center = pointMap.get(entity.pointIds?.[0]);
        edge.direction = entity.geometry?.direction || 'ccw';
        edge.majorRadius = numeric(entity.geometry?.majorRadius, values);
        edge.minorRadius = numeric(entity.geometry?.minorRadius, values);
        edge.rotation = numeric(entity.geometry?.rotation || '0', values);
        edge.startAngle = numeric(entity.geometry?.startAngle, values);
        edge.endAngle = numeric(entity.geometry?.endAngle, values);
        if (!edge.center || !(edge.majorRadius > GEOMETRY_POLICY.linearTolerance) || !(edge.minorRadius > GEOMETRY_POLICY.linearTolerance)) {
          diagnostics.push(diagnostic('ZERO_RADIUS', `Łuk eliptyczny ${entity.id} ma nieprawidłowe promienie.`, [entity.id], edge.center || start));
          continue;
        }
      } else if (entity.type === 'spline') {
        edge.mode = entity.geometry?.mode === 'control' ? 'control' : 'fit';
        edge.controlPoints = (entity.pointIds || []).map((pointId) => pointMap.get(pointId)).filter(Boolean);
        if (edge.controlPoints.length < (edge.mode === 'control' ? 3 : 2)) {
          diagnostics.push(diagnostic('ZERO_LENGTH', `Spline ${entity.id} ma za mało punktów.`, [entity.id], start));
          continue;
        }
      } else if (entity.type === 'conic') {
        edge.controlPoints = (entity.pointIds || []).map((pointId) => pointMap.get(pointId)).filter(Boolean);
        edge.rho = numeric(entity.geometry?.rho || '1', values);
        edge.continuity = entity.geometry?.continuity || 'free';
        if (edge.controlPoints.length !== 3 || !(edge.rho > 0)) {
          diagnostics.push(diagnostic('INVALID_CONIC', `Krzywa conic ${entity.id} wymaga trzech punktów i dodatniego rho.`, [entity.id], start));
          continue;
        }
      }
      edges.push(edge);
    } else if (entity.type === 'circle' || entity.type === 'ellipse') {
      const center = pointMap.get(entity.pointIds?.[0]);
      if (entity.type === 'circle') {
        const radius = numeric(entity.geometry?.radius, values);
        if (!center || !(radius > GEOMETRY_POLICY.linearTolerance)) {
          diagnostics.push(diagnostic('ZERO_RADIUS', `Okrąg ${entity.id} ma nieprawidłowy promień.`, [entity.id], center));
          continue;
        }
        circleEdges.push({ id: entity.id, type: 'circle', center, radius });
      } else {
        const majorRadius = numeric(entity.geometry?.majorRadius, values);
        const minorRadius = numeric(entity.geometry?.minorRadius, values);
        const rotation = numeric(entity.geometry?.rotation, values);
        if (!center || !(majorRadius > GEOMETRY_POLICY.linearTolerance) || !(minorRadius > GEOMETRY_POLICY.linearTolerance)) {
          diagnostics.push(diagnostic('ZERO_RADIUS', `Elipsa ${entity.id} ma nieprawidłowe promienie.`, [entity.id], center));
          continue;
        }
        circleEdges.push({ id: entity.id, type: 'ellipse', center, majorRadius, minorRadius, rotation });
      }
    }
  }

  const allEdges = [...edges, ...circleEdges];
  const curveAnalyses = allEdges.filter((edge) => ['arc', 'ellipticalArc', 'ellipse', 'circle', 'spline', 'conic'].includes(edge.type)).map((edge) => analyzeCurvedEdge(edge, tolerance));
  for (const analysis of curveAnalyses) {
    if (analysis.singular) diagnostics.push(diagnostic('CURVATURE_SINGULARITY', `Krzywa ${analysis.entityId} ma osobliwość krzywizny.`, [analysis.entityId]));
    analysis.selfIntersections.forEach((point) => diagnostics.push(diagnostic('SELF_INTERSECTION', `Krzywa ${analysis.entityId} przecina samą siebie.`, [analysis.entityId], point)));
  }
  for (let firstIndex = 0; firstIndex < allEdges.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < allEdges.length; secondIndex += 1) {
      const first = allEdges[firstIndex];
      const second = allEdges[secondIndex];
      for (const intersection of edgeIntersections(first, second, tolerance)) {
        if (intersection.kind === 'overlap') {
          diagnostics.push(diagnostic('OVERLAP', `Encje ${first.id} i ${second.id} nakładają się.`, [first.id, second.id]));
          break;
        }
        const sharedEndpoint = intersection.firstEndpoint && intersection.secondEndpoint
          && [first.startVertex, first.endVertex].some((vertex) => vertex && [second.startVertex, second.endVertex].includes(vertex));
        if (!sharedEndpoint) diagnostics.push(diagnostic('SELF_INTERSECTION', `Encje ${first.id} i ${second.id} przecinają się bez wspólnego wierzchołka.`, [first.id, second.id], intersection.point));
      }
    }
  }

  const degree = new Map(vertices.map((vertex) => [vertex.id, 0]));
  for (const edge of edges) {
    degree.set(edge.startVertex, (degree.get(edge.startVertex) || 0) + 1);
    degree.set(edge.endVertex, (degree.get(edge.endVertex) || 0) + 1);
  }
  for (const vertex of vertices) {
    const value = degree.get(vertex.id) || 0;
    const related = edges.filter((edge) => edge.startVertex === vertex.id || edge.endVertex === vertex.id).map((edge) => edge.id);
    if (value === 1) diagnostics.push(diagnostic('GAP', `Otwarty koniec obrysu w punkcie ${vertex.coordinate.map((value) => value.toFixed(3)).join(', ')}.`, related, vertex.coordinate));
    else if (value > 2) diagnostics.push(diagnostic('BRANCH', `Wierzchołek łączy ${value} krawędzie; profil jest niejednoznaczny.`, related, vertex.coordinate));
  }

  const cycles = [
    ...findGraphCycles(vertices, edges).map((steps) => ({ steps, points: pointsForCycle(steps) })),
    ...circleEdges.map((edge) => ({ steps: [{ edge, reversed: false }], points: edgeSamples(edge).slice(0, -1) })),
  ].filter((loop) => loop.points.length >= 3 && Math.abs(signedArea(loop.points)) > tolerance * tolerance);

  const blockingEntityIds = new Set(diagnostics.filter((entry) => ['ZERO_LENGTH', 'ZERO_RADIUS', 'OVERLAP', 'SELF_INTERSECTION', 'CURVATURE_SINGULARITY', 'BRANCH'].includes(entry.code)).flatMap((entry) => entry.entityIds));
  const validLoops = cycles.filter((loop) => !loop.steps.some((step) => blockingEntityIds.has(step.edge.id)));
  validLoops.forEach((loop) => {
    loop.area = signedArea(loop.points);
    loop.centroid = polygonCentroid(loop.points);
    loop.parent = null;
    loop.depth = 0;
  });
  const byArea = [...validLoops].sort((first, second) => Math.abs(second.area) - Math.abs(first.area));
  for (let index = 0; index < byArea.length; index += 1) {
    const loop = byArea[index];
    const containers = byArea.slice(0, index).filter((candidate) => pointInPolygon(loop.centroid, candidate.points));
    loop.parent = containers.sort((first, second) => Math.abs(first.area) - Math.abs(second.area))[0] || null;
    loop.depth = loop.parent ? loop.parent.depth + 1 : 0;
  }

  const existingBySignature = new Map((sketch?.profiles || []).map((profile) => {
    const outer = [...(profile.entityIds || [])].sort().join('|');
    const holes = (profile.innerLoops || []).map((loop) => [...(loop.entityIds || [])].sort().join('|')).sort().join('::');
    return [`${outer}::${holes}`, profile];
  }));
  const profiles = [];
  for (const outer of validLoops.filter((loop) => loop.depth % 2 === 0)) {
    const holes = validLoops.filter((loop) => loop.parent === outer && loop.depth % 2 === 1);
    const signature = profileSignature(outer, holes);
    const existing = existingBySignature.get(signature);
    const outerData = loopDocumentData(outer);
    profiles.push({
      id: existing?.id || createId('profile'),
      name: existing?.name || `Profil ${profiles.length + 1}`,
      type: 'closed',
      closed: true,
      source: 'detected',
      entityIds: outerData.entityIds,
      entityDirections: outerData.entityDirections,
      innerLoops: holes.map((hole) => ({ ...loopDocumentData(hole), role: 'hole' })),
      geometry: {
        ...geometryCache(outer),
        holes: holes.map((hole) => geometryCache(hole)),
      },
    });
  }

  return {
    profiles,
    diagnostics,
    graph: {
      vertices: vertices.map((vertex) => ({ id: vertex.id, coordinate: vertex.coordinate, pointIds: vertex.pointIds, degree: degree.get(vertex.id) || 0 })),
      edges: allEdges.map((edge) => ({ id: edge.id, type: edge.type, startVertex: edge.startVertex || null, endVertex: edge.endVertex || null })),
      curveAnalyses,
      loops: validLoops.map((loop) => ({ entityIds: loop.steps.map((step) => step.edge.id), depth: loop.depth, area: Math.abs(loop.area) })),
    },
  };
}

export function refreshDetectedSketchProfiles(sketch, parameters = []) {
  const primitiveProfiles = (sketch.profiles || []).filter((profile) => profile.source === 'primitive');
  const detectedProfilesBySignature = new Map((sketch.profiles || [])
    .filter((profile) => profile.source !== 'primitive')
    .map((profile) => [[...(profile.entityIds || [])].sort().join('|'), profile]));
  const result = detectSketchProfiles(sketch, parameters);
  const primitiveSignatures = new Set(primitiveProfiles.map((profile) => [...(profile.entityIds || [])].sort().join('|')));
  sketch.profiles = [
    ...primitiveProfiles,
    ...result.profiles
      .filter((profile) => !primitiveSignatures.has([...profile.entityIds].sort().join('|')))
      .map((profile) => {
        const previous = detectedProfilesBySignature.get([...profile.entityIds].sort().join('|'));
        return previous ? { ...profile, id: previous.id, name: previous.name || profile.name } : profile;
      }),
  ];
  sketch.diagnostics = result.diagnostics;
  return result;
}
