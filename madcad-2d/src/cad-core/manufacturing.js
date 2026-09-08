import { createId } from './ids.js';
import { evaluateExpression, resolveParameters } from './expressions.js';

export const CAM_MACHINE_PRESETS = Object.freeze({
  'desktop-3018': Object.freeze({ id: 'desktop-3018', name: 'Frezarka biurkowa 3018', kind: 'mill-3axis', travel: [300, 180, 45], maxSpindleRpm: 10000 }),
  'mill-500': Object.freeze({ id: 'mill-500', name: 'Frezarka 3-osiowa 500', kind: 'mill-3axis', travel: [500, 400, 350], maxSpindleRpm: 12000 }),
  'mill-1000': Object.freeze({ id: 'mill-1000', name: 'Frezarka 3-osiowa 1000', kind: 'mill-3axis', travel: [1000, 600, 600], maxSpindleRpm: 18000 }),
});

export const CAM_WCS_ORIGINS = Object.freeze([
  Object.freeze({ id: 'stock-top-center', name: 'Środek górnej powierzchni półfabrykatu' }),
  Object.freeze({ id: 'stock-top-front-left', name: 'Lewy przedni narożnik półfabrykatu' }),
  Object.freeze({ id: 'model-origin', name: 'Początek układu modelu' }),
]);

export const CAM_TOOL_PRESETS = Object.freeze({
  'flat-3': Object.freeze({ id: 'flat-3', name: 'Frez palcowy płaski Ø3', type: 'flat-end-mill', diameter: 3, fluteLength: 12, flutes: 2 }),
  'flat-6': Object.freeze({ id: 'flat-6', name: 'Frez palcowy płaski Ø6', type: 'flat-end-mill', diameter: 6, fluteLength: 20, flutes: 2 }),
  'face-16': Object.freeze({ id: 'face-16', name: 'Frez do planowania Ø16', type: 'face-mill', diameter: 16, fluteLength: 8, flutes: 3 }),
});

export function normalizeFacingOperation(operation = {}, index = 0) {
  return {
    id: typeof operation.id === 'string' && operation.id ? operation.id : createId('cam-operation'),
    name: String(operation.name || `Planowanie ${index + 1}`).trim().slice(0, 80) || `Planowanie ${index + 1}`,
    type: 'face',
    toolId: CAM_TOOL_PRESETS[operation.toolId] ? operation.toolId : 'flat-6',
    stepover: Math.min(0.9, Math.max(0.1, Number(operation.stepover) || 0.6)),
    maxStepdown: Math.max(0.05, Number(operation.maxStepdown) || 1),
    feedRate: Math.max(1, Number(operation.feedRate) || 600),
    plungeRate: Math.max(1, Number(operation.plungeRate) || 180),
    spindleRpm: Math.max(1, Math.round(Number(operation.spindleRpm) || 8000)),
  };
}

export function normalizeContourOperation(operation = {}, index = 0) {
  return {
    id: typeof operation.id === 'string' && operation.id ? operation.id : createId('cam-operation'),
    name: String(operation.name || `Kontur 2D ${index + 1}`).trim().slice(0, 80) || `Kontur 2D ${index + 1}`,
    type: 'contour',
    toolId: CAM_TOOL_PRESETS[operation.toolId] ? operation.toolId : 'flat-6',
    targetDepth: Math.max(0.05, Number(operation.targetDepth) || 2),
    maxStepdown: Math.max(0.05, Number(operation.maxStepdown) || 1),
    feedRate: Math.max(1, Number(operation.feedRate) || 500),
    plungeRate: Math.max(1, Number(operation.plungeRate) || 150),
    spindleRpm: Math.max(1, Math.round(Number(operation.spindleRpm) || 8000)),
    compensation: 'outside',
    boundaryFaceId: typeof operation.boundaryFaceId === 'string' ? operation.boundaryFaceId : '',
    boundarySketchId: typeof operation.boundarySketchId === 'string' ? operation.boundarySketchId : '',
    boundaryProfileId: typeof operation.boundaryProfileId === 'string' ? operation.boundaryProfileId : '',
  };
}

export function normalizePocketOperation(operation = {}, index = 0) {
  return {
    id: typeof operation.id === 'string' && operation.id ? operation.id : createId('cam-operation'),
    name: String(operation.name || `Kieszeń 2D ${index + 1}`).trim().slice(0, 80) || `Kieszeń 2D ${index + 1}`,
    type: 'pocket',
    toolId: CAM_TOOL_PRESETS[operation.toolId] ? operation.toolId : 'flat-6',
    targetDepth: Math.max(0.05, Number(operation.targetDepth) || 2),
    maxStepdown: Math.max(0.05, Number(operation.maxStepdown) || 1),
    stepover: Math.min(0.8, Math.max(0.1, Number(operation.stepover) || 0.45)),
    feedRate: Math.max(1, Number(operation.feedRate) || 500),
    plungeRate: Math.max(1, Number(operation.plungeRate) || 150),
    spindleRpm: Math.max(1, Math.round(Number(operation.spindleRpm) || 8000)),
    boundary: 'body-top',
    boundaryFaceId: typeof operation.boundaryFaceId === 'string' ? operation.boundaryFaceId : '',
    boundarySketchId: typeof operation.boundarySketchId === 'string' ? operation.boundarySketchId : '',
    boundaryProfileId: typeof operation.boundaryProfileId === 'string' ? operation.boundaryProfileId : '',
  };
}

export function normalizeAdaptiveOperation(operation = {}, index = 0) {
  return {
    id: typeof operation.id === 'string' && operation.id ? operation.id : createId('cam-operation'),
    name: String(operation.name || `Adaptacyjne 2D ${index + 1}`).trim().slice(0, 80) || `Adaptacyjne 2D ${index + 1}`,
    type: 'adaptive',
    toolId: CAM_TOOL_PRESETS[operation.toolId] ? operation.toolId : 'flat-6',
    targetDepth: Math.max(0.05, Number(operation.targetDepth) || 2),
    maxStepdown: Math.max(0.05, Number(operation.maxStepdown) || 1),
    optimalLoad: Math.min(0.6, Math.max(0.1, Number(operation.optimalLoad) || 0.3)),
    feedRate: Math.max(1, Number(operation.feedRate) || 650),
    plungeRate: Math.max(1, Number(operation.plungeRate) || 160),
    spindleRpm: Math.max(1, Math.round(Number(operation.spindleRpm) || 9000)),
    boundary: 'body-top',
    boundaryFaceId: typeof operation.boundaryFaceId === 'string' ? operation.boundaryFaceId : '',
    boundarySketchId: typeof operation.boundarySketchId === 'string' ? operation.boundarySketchId : '',
    boundaryProfileId: typeof operation.boundaryProfileId === 'string' ? operation.boundaryProfileId : '',
  };
}

export function normalizeManufacturingOperation(operation = {}, index = 0) {
  if (operation?.type === 'contour') return normalizeContourOperation(operation, index);
  if (operation?.type === 'pocket') return normalizePocketOperation(operation, index);
  if (operation?.type === 'adaptive') return normalizeAdaptiveOperation(operation, index);
  return normalizeFacingOperation(operation, index);
}

const finiteNonNegative = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
};

export function normalizeManufacturingSetup(setup = {}, index = 0) {
  const machineId = CAM_MACHINE_PRESETS[setup.machineId] ? setup.machineId : 'mill-500';
  const wcsOrigin = CAM_WCS_ORIGINS.some((item) => item.id === setup.wcsOrigin) ? setup.wcsOrigin : 'stock-top-center';
  return {
    id: typeof setup.id === 'string' && setup.id ? setup.id : createId('cam-setup'),
    name: String(setup.name || `Setup ${index + 1}`).trim().slice(0, 80) || `Setup ${index + 1}`,
    operationKind: 'mill-3axis',
    bodyId: typeof setup.bodyId === 'string' ? setup.bodyId : '',
    machineId,
    stock: {
      sideOffset: finiteNonNegative(setup.stock?.sideOffset, 2),
      topOffset: finiteNonNegative(setup.stock?.topOffset, 2),
      bottomOffset: finiteNonNegative(setup.stock?.bottomOffset, 0),
    },
    wcsOrigin,
    safeHeight: finiteNonNegative(setup.safeHeight, 5),
    operations: Array.isArray(setup.operations) ? setup.operations.map(normalizeManufacturingOperation) : [],
  };
}

export function ensureDocumentManufacturing(document) {
  if (!document.manufacturing || typeof document.manufacturing !== 'object' || Array.isArray(document.manufacturing)) {
    document.manufacturing = { setups: [], activeSetupId: '' };
  }
  if (!Array.isArray(document.manufacturing.setups)) document.manufacturing.setups = [];
  document.manufacturing.setups = document.manufacturing.setups.map(normalizeManufacturingSetup);
  if (typeof document.manufacturing.activeSetupId !== 'string') document.manufacturing.activeSetupId = '';
  if (!document.manufacturing.setups.some((setup) => setup.id === document.manufacturing.activeSetupId)) {
    document.manufacturing.activeSetupId = document.manufacturing.setups[0]?.id || '';
  }
  return document;
}

export function createManufacturingSetup(options = {}) {
  return normalizeManufacturingSetup({ ...options, id: createId('cam-setup') });
}

export function calculateManufacturingSetup(setup, bodies = []) {
  const normalized = normalizeManufacturingSetup(setup);
  const machine = CAM_MACHINE_PRESETS[normalized.machineId];
  const body = bodies.find((item) => item.id === normalized.bodyId);
  if (!body) return { valid: false, machine, body: null, warnings: ['Wybierz istniejącą bryłę do obróbki.'] };
  const bounds = body.bounds || body.metrics?.bounds;
  if (!Array.isArray(bounds) || bounds.length !== 2 || bounds.flat().length !== 6 || bounds.flat().some((value) => !Number.isFinite(Number(value)))) {
    return { valid: false, machine, body, warnings: ['Silnik CAD nie zwrócił prawidłowych granic wybranej bryły.'] };
  }
  const minimum = bounds[0].map(Number);
  const maximum = bounds[1].map(Number);
  const side = normalized.stock.sideOffset;
  const stockBounds = [
    [minimum[0] - side, minimum[1] - side, minimum[2] - normalized.stock.bottomOffset],
    [maximum[0] + side, maximum[1] + side, maximum[2] + normalized.stock.topOffset],
  ];
  const dimensions = stockBounds[1].map((value, axis) => value - stockBounds[0][axis]);
  let origin;
  if (normalized.wcsOrigin === 'model-origin') origin = [0, 0, 0];
  else if (normalized.wcsOrigin === 'stock-top-front-left') origin = [stockBounds[0][0], stockBounds[0][1], stockBounds[1][2]];
  else origin = [(stockBounds[0][0] + stockBounds[1][0]) / 2, (stockBounds[0][1] + stockBounds[1][1]) / 2, stockBounds[1][2]];
  const warnings = [];
  const exceededAxes = dimensions.map((value, axis) => value > machine.travel[axis] ? ['X', 'Y', 'Z'][axis] : null).filter(Boolean);
  if (exceededAxes.length) warnings.push(`Półfabrykat przekracza przesuw maszyny w osi ${exceededAxes.join(', ')}.`);
  if (dimensions.some((value) => value <= 0)) warnings.push('Półfabrykat musi mieć dodatnie wymiary.');
  return {
    valid: warnings.length === 0,
    machine,
    body,
    stockBounds,
    dimensions,
    origin,
    clearancePlaneZ: origin[2] + normalized.safeHeight,
    warnings,
  };
}

export function createFacingOperation(options = {}) {
  return normalizeFacingOperation({ ...options, id: createId('cam-operation') });
}

export function createContourOperation(options = {}) {
  return normalizeContourOperation({ ...options, id: createId('cam-operation') });
}

export function createPocketOperation(options = {}) {
  return normalizePocketOperation({ ...options, id: createId('cam-operation') });
}

export function createAdaptiveOperation(options = {}) {
  return normalizeAdaptiveOperation({ ...options, id: createId('cam-operation') });
}

export function calculateFacingToolpath(setup, operation, bodies = []) {
  const setupResult = calculateManufacturingSetup(setup, bodies);
  const normalized = normalizeFacingOperation(operation);
  const tool = CAM_TOOL_PRESETS[normalized.toolId];
  if (!setupResult.stockBounds || !setupResult.body) return { valid: false, tool, segments: [], warnings: setupResult.warnings };
  const bodyBounds = setupResult.body.bounds || setupResult.body.metrics?.bounds;
  const stockTop = setupResult.stockBounds[1][2];
  const targetZ = Number(bodyBounds[1][2]);
  const depth = stockTop - targetZ;
  if (depth <= 1e-9) return { valid: false, tool, segments: [], warnings: ['Planowanie wymaga dodatniego naddatku na górze półfabrykatu.'] };
  if (normalized.spindleRpm > setupResult.machine.maxSpindleRpm) return { valid: false, tool, segments: [], warnings: [`Obroty przekraczają limit maszyny ${setupResult.machine.maxSpindleRpm} obr./min.`] };
  const radius = tool.diameter / 2;
  const [stockMin, stockMax] = setupResult.stockBounds;
  const xMin = stockMin[0] - radius;
  const xMax = stockMax[0] + radius;
  const yMin = stockMin[1] - radius;
  const yMax = stockMax[1] + radius;
  const layerCount = Math.max(1, Math.ceil(depth / normalized.maxStepdown));
  const rowStep = tool.diameter * normalized.stepover;
  const rowCount = Math.max(2, Math.ceil((yMax - yMin) / rowStep) + 1);
  const segments = [];
  let previous = [xMin, yMin, setupResult.clearancePlaneZ];
  const push = (kind, to, feed = null) => { segments.push({ kind, from: previous, to, ...(feed ? { feed } : {}) }); previous = to; };
  for (let layer = 1; layer <= layerCount; layer += 1) {
    const z = stockTop - Math.min(depth, layer * depth / layerCount);
    push('rapid', [xMin, yMin, setupResult.clearancePlaneZ]);
    push('plunge', [xMin, yMin, z], normalized.plungeRate);
    for (let row = 0; row < rowCount; row += 1) {
      const y = Math.min(yMax, yMin + row * (yMax - yMin) / (rowCount - 1));
      const x = row % 2 === 0 ? xMax : xMin;
      push('cut', [x, y, z], normalized.feedRate);
      if (row < rowCount - 1) {
        const nextY = Math.min(yMax, yMin + (row + 1) * (yMax - yMin) / (rowCount - 1));
        push('cut', [x, nextY, z], normalized.feedRate);
      }
    }
    push('rapid', [previous[0], previous[1], setupResult.clearancePlaneZ]);
  }
  const distance = segments.reduce((sum, segment) => sum + Math.hypot(...segment.to.map((value, axis) => value - segment.from[axis])), 0);
  const cuttingDistance = segments.filter((segment) => segment.kind !== 'rapid').reduce((sum, segment) => sum + Math.hypot(...segment.to.map((value, axis) => value - segment.from[axis])), 0);
  const durationMinutes = segments.reduce((sum, segment) => {
    const length = Math.hypot(...segment.to.map((value, axis) => value - segment.from[axis]));
    return sum + length / (segment.kind === 'rapid' ? 3000 : segment.feed);
  }, 0);
  return { valid: setupResult.valid, setup: setupResult, stockBounds: setupResult.stockBounds, origin: setupResult.origin, clearancePlaneZ: setupResult.clearancePlaneZ, operation: normalized, tool, segments, layerCount, rowCount, distance, cuttingDistance, durationMinutes, warnings: setupResult.warnings };
}

const pointKey = (point, tolerance) => `${Math.round(point[0] / tolerance)},${Math.round(point[1] / tolerance)}`;
const signedPolygonArea = (points) => points.reduce((area, point, index) => {
  const next = points[(index + 1) % points.length];
  return area + point[0] * next[1] - next[0] * point[1];
}, 0) / 2;

export function extractTopBoundaryLoops(body, faceId = '') {
  const vertices = Array.from(body?.vertices || []);
  const allTriangles = Array.from(body?.triangles || []);
  const bounds = body?.bounds || body?.metrics?.bounds;
  if (vertices.length < 9 || allTriangles.length < 3 || !Array.isArray(bounds?.[1])) return [];
  const faceGroup = faceId ? body?.faceGroups?.find((group) => group.topologyId === faceId) : null;
  if (faceId && !faceGroup) return [];
  const triangles = faceGroup ? allTriangles.slice(faceGroup.start, faceGroup.start + faceGroup.count) : allTriangles;
  const span = Math.max(1, ...bounds[1].map((value, axis) => Math.abs(Number(value) - Number(bounds[0]?.[axis] || 0))));
  const tolerance = Math.max(1e-7, span * 1e-6);
  const topZ = faceGroup
    ? vertices[triangles[0] * 3 + 2]
    : vertices.reduce((maximum, value, index) => index % 3 === 2 ? Math.max(maximum, value) : maximum, -Infinity);
  if (faceGroup && triangles.some((vertexIndex) => Math.abs(vertices[vertexIndex * 3 + 2] - topZ) > tolerance)) return [];
  const points = new Map();
  const edges = new Map();
  const addEdge = (a, b) => {
    const aKey = pointKey(a, tolerance);
    const bKey = pointKey(b, tolerance);
    if (aKey === bKey) return;
    points.set(aKey, [a[0], a[1]]);
    points.set(bKey, [b[0], b[1]]);
    const key = aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
    const entry = edges.get(key) || { a: aKey, b: bKey, count: 0 };
    entry.count += 1;
    edges.set(key, entry);
  };
  for (let index = 0; index + 2 < triangles.length; index += 3) {
    const triangle = triangles.slice(index, index + 3).map((vertexIndex) => vertices.slice(vertexIndex * 3, vertexIndex * 3 + 3));
    if (triangle.some((point) => point.length < 3 || Math.abs(point[2] - topZ) > tolerance)) continue;
    addEdge(triangle[0], triangle[1]);
    addEdge(triangle[1], triangle[2]);
    addEdge(triangle[2], triangle[0]);
  }
  const boundary = [...edges.values()].filter((edge) => edge.count === 1);
  const adjacency = new Map();
  for (const edge of boundary) {
    adjacency.set(edge.a, [...(adjacency.get(edge.a) || []), edge.b]);
    adjacency.set(edge.b, [...(adjacency.get(edge.b) || []), edge.a]);
  }
  const unused = new Set(boundary.map((edge) => edge.a < edge.b ? `${edge.a}|${edge.b}` : `${edge.b}|${edge.a}`));
  const loops = [];
  while (unused.size) {
    const firstEdge = unused.values().next().value;
    const [start, next] = firstEdge.split('|');
    const keys = [start];
    let previous = start;
    let current = next;
    unused.delete(firstEdge);
    while (current !== start && keys.length <= boundary.length + 1) {
      keys.push(current);
      const candidate = (adjacency.get(current) || []).find((item) => {
        const edgeKey = current < item ? `${current}|${item}` : `${item}|${current}`;
        return item !== previous && unused.has(edgeKey);
      });
      if (!candidate) break;
      const edgeKey = current < candidate ? `${current}|${candidate}` : `${candidate}|${current}`;
      unused.delete(edgeKey);
      previous = current;
      current = candidate;
    }
    if (current === start && keys.length >= 3) loops.push(keys.map((key) => points.get(key)));
  }
  return loops.sort((a, b) => Math.abs(signedPolygonArea(b)) - Math.abs(signedPolygonArea(a)));
}

export function offsetClosedContour(points, distance) {
  if (!Array.isArray(points) || points.length < 3 || !Number.isFinite(distance) || Math.abs(distance) <= 1e-9) return points?.map((point) => [...point]) || [];
  const orientation = Math.sign(signedPolygonArea(points)) || 1;
  const lineIntersection = (a, directionA, b, directionB) => {
    const cross = directionA[0] * directionB[1] - directionA[1] * directionB[0];
    if (Math.abs(cross) < 1e-9) return null;
    const delta = [b[0] - a[0], b[1] - a[1]];
    const t = (delta[0] * directionB[1] - delta[1] * directionB[0]) / cross;
    return [a[0] + t * directionA[0], a[1] + t * directionA[1]];
  };
  return points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const normalize = (vector) => {
      const length = Math.hypot(...vector) || 1;
      return vector.map((value) => value / length);
    };
    const incoming = normalize([point[0] - previous[0], point[1] - previous[1]]);
    const outgoing = normalize([next[0] - point[0], next[1] - point[1]]);
    const outward = (direction) => orientation > 0 ? [direction[1], -direction[0]] : [-direction[1], direction[0]];
    const normalA = outward(incoming);
    const normalB = outward(outgoing);
    const offsetA = [point[0] + normalA[0] * distance, point[1] + normalA[1] * distance];
    const offsetB = [point[0] + normalB[0] * distance, point[1] + normalB[1] * distance];
    const intersection = lineIntersection(offsetA, incoming, offsetB, outgoing);
    if (intersection && Math.hypot(intersection[0] - point[0], intersection[1] - point[1]) <= Math.abs(distance) * 5) return intersection;
    const bisector = normalize([normalA[0] + normalB[0], normalA[1] + normalB[1]]);
    return [point[0] + bisector[0] * distance, point[1] + bisector[1] * distance];
  });
}

function boundaryPlaneZ(body, faceId = '') {
  const vertices = Array.from(body?.vertices || []);
  const triangles = Array.from(body?.triangles || []);
  const faceGroup = faceId ? body?.faceGroups?.find((group) => group.topologyId === faceId) : null;
  if (faceGroup && Number.isInteger(triangles[faceGroup.start])) return vertices[triangles[faceGroup.start] * 3 + 2];
  return vertices.length >= 3
    ? vertices.reduce((maximum, value, index) => index % 3 === 2 ? Math.max(maximum, value) : maximum, -Infinity)
    : Number((body?.bounds || body?.metrics?.bounds)?.[1]?.[2]);
}

function resolveSketchProfileBoundary(document, operation) {
  if (!operation.boundarySketchId && !operation.boundaryProfileId) return null;
  if (!document) throw new Error('Dokument projektu jest wymagany do odtworzenia granicy profilu szkicu.');
  const sketch = document.sketches?.find((item) => item.id === operation.boundarySketchId);
  const profile = sketch?.profiles?.find((item) => item.id === operation.boundaryProfileId);
  if (!sketch || !profile) throw new Error('Wybrany profil szkicu już nie istnieje. Wskaż nową granicę operacji.');
  if (sketch.space === '3d' || sketch.plane !== 'XY') throw new Error('CAM 2D wymaga profilu szkicu na poziomej płaszczyźnie XY.');
  const parameters = resolveParameters(document.parameters || []);
  if (!parameters.valid) throw new Error('Nie można obliczyć profilu, ponieważ jego parametry zawierają błąd.');
  const read = (value) => evaluateExpression(value ?? 0, parameters.values);
  let points;
  if (profile.type === 'rectangle') {
    const x = read(profile.geometry?.x);
    const y = read(profile.geometry?.y);
    const halfWidth = read(profile.geometry?.width) / 2;
    const halfHeight = read(profile.geometry?.height) / 2;
    points = [[x - halfWidth, y - halfHeight], [x + halfWidth, y - halfHeight], [x + halfWidth, y + halfHeight], [x - halfWidth, y + halfHeight]];
  } else if (profile.type === 'circle') {
    const x = read(profile.geometry?.x);
    const y = read(profile.geometry?.y);
    const radius = read(profile.geometry?.diameter) / 2;
    points = Array.from({ length: 72 }, (_unused, index) => {
      const angle = index / 72 * Math.PI * 2;
      return [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius];
    });
  } else {
    points = (profile.geometry?.points || []).map((point) => [read(point.x), read(point.y)]);
    if (points.length > 3 && Math.hypot(points[0][0] - points.at(-1)[0], points[0][1] - points.at(-1)[1]) <= 1e-7) points.pop();
  }
  if (points.length < 3 || points.some((point) => !point.every(Number.isFinite)) || Math.abs(signedPolygonArea(points)) <= 1e-7) throw new Error('Wybrany profil nie tworzy prawidłowej zamkniętej granicy CAM.');
  return { loops: [points], planeZ: read(sketch.planeOffset || 0), source: 'sketch-profile' };
}

function resolveOperationBoundary(setupResult, operation, document) {
  const sketchBoundary = resolveSketchProfileBoundary(document, operation);
  if (sketchBoundary) {
    const [minimum, maximum] = setupResult.stockBounds;
    if (sketchBoundary.loops[0].some((point) => point[0] < minimum[0] || point[0] > maximum[0] || point[1] < minimum[1] || point[1] > maximum[1])) throw new Error('Wybrany profil szkicu wykracza poza półfabrykat.');
    return sketchBoundary;
  }
  const loops = extractTopBoundaryLoops(setupResult.body, operation.boundaryFaceId);
  if (!loops.length) throw new Error(operation.boundaryFaceId ? 'Wybrana ściana nie istnieje albo nie jest pozioma i płaska.' : 'Nie znaleziono zamkniętej górnej krawędzi bryły.');
  return { loops, planeZ: boundaryPlaneZ(setupResult.body, operation.boundaryFaceId), source: operation.boundaryFaceId ? 'selected-face' : 'body-top' };
}

function summarizeToolpath(segments) {
  const segmentLength = (segment) => Math.hypot(...segment.to.map((value, axis) => value - segment.from[axis]));
  return {
    distance: segments.reduce((sum, segment) => sum + segmentLength(segment), 0),
    cuttingDistance: segments.filter((segment) => segment.kind !== 'rapid').reduce((sum, segment) => sum + segmentLength(segment), 0),
    durationMinutes: segments.reduce((sum, segment) => sum + segmentLength(segment) / (segment.kind === 'rapid' ? 3000 : segment.feed), 0),
  };
}

export function calculateContourToolpath(setup, operation, bodies = [], document = null) {
  const setupResult = calculateManufacturingSetup(setup, bodies);
  const normalized = normalizeContourOperation(operation);
  const tool = CAM_TOOL_PRESETS[normalized.toolId];
  const fail = (warning) => ({ valid: false, setup: setupResult, tool, segments: [], warnings: [...(setupResult.warnings || []), warning].filter(Boolean) });
  if (!setupResult.body || !setupResult.stockBounds) return fail('Kontur wymaga poprawnego Setupu i bryły.');
  if (!setupResult.valid) return fail('Popraw Setup przed obliczeniem konturu.');
  if (normalized.spindleRpm > setupResult.machine.maxSpindleRpm) return fail(`Obroty przekraczają limit maszyny ${setupResult.machine.maxSpindleRpm} obr./min.`);
  const bodyBounds = setupResult.body.bounds || setupResult.body.metrics?.bounds;
  const bodyHeight = Number(bodyBounds[1][2]) - Number(bodyBounds[0][2]);
  if (normalized.targetDepth > tool.fluteLength) return fail(`Głębokość przekracza długość ostrza narzędzia (${tool.fluteLength} mm).`);
  if (normalized.targetDepth > bodyHeight + setupResult.stockBounds[0][2] - Number(bodyBounds[0][2]) + 1e-7) return fail('Głębokość konturu przekracza wysokość dostępnego materiału.');
  let resolvedBoundary;
  try { resolvedBoundary = resolveOperationBoundary(setupResult, normalized, document); } catch (error) { return fail(error.message); }
  const { loops } = resolvedBoundary;
  const contour = offsetClosedContour(loops[0], tool.diameter / 2);
  const topZ = resolvedBoundary.planeZ;
  const layerCount = Math.max(1, Math.ceil(normalized.targetDepth / normalized.maxStepdown));
  const segments = [];
  let previous = [contour[0][0], contour[0][1], setupResult.clearancePlaneZ];
  const push = (kind, to, feed = null) => {
    if (Math.hypot(...to.map((value, axis) => value - previous[axis])) <= 1e-9) return;
    segments.push({ kind, from: previous, to, ...(feed ? { feed } : {}) });
    previous = to;
  };
  for (let layer = 1; layer <= layerCount; layer += 1) {
    const z = topZ - Math.min(normalized.targetDepth, layer * normalized.targetDepth / layerCount);
    push('rapid', [contour[0][0], contour[0][1], setupResult.clearancePlaneZ]);
    push('plunge', [contour[0][0], contour[0][1], z], normalized.plungeRate);
    for (let index = 1; index <= contour.length; index += 1) {
      const point = contour[index % contour.length];
      push('cut', [point[0], point[1], z], normalized.feedRate);
    }
    push('rapid', [previous[0], previous[1], setupResult.clearancePlaneZ]);
  }
  return {
    valid: true,
    setup: setupResult,
    stockBounds: setupResult.stockBounds,
    origin: setupResult.origin,
    clearancePlaneZ: setupResult.clearancePlaneZ,
    operation: normalized,
    tool,
    segments,
    layerCount,
    contourPointCount: contour.length,
    ...summarizeToolpath(segments),
    warnings: [],
  };
}

function scanlineIntervals(polygon, y) {
  const intersections = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    if ((a[1] > y) === (b[1] > y)) continue;
    intersections.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
  }
  intersections.sort((a, b) => a - b);
  const intervals = [];
  for (let index = 0; index + 1 < intersections.length; index += 2) {
    if (intersections[index + 1] - intersections[index] > 1e-7) intervals.push([intersections[index], intersections[index + 1]]);
  }
  return intervals;
}

export function calculatePocketToolpath(setup, operation, bodies = [], document = null) {
  const setupResult = calculateManufacturingSetup(setup, bodies);
  const normalized = normalizePocketOperation(operation);
  const tool = CAM_TOOL_PRESETS[normalized.toolId];
  const fail = (warning) => ({ valid: false, setup: setupResult, tool, segments: [], warnings: [...(setupResult.warnings || []), warning].filter(Boolean) });
  if (!setupResult.body || !setupResult.stockBounds) return fail('Kieszeń wymaga poprawnego Setupu i bryły.');
  if (!setupResult.valid) return fail('Popraw Setup przed obliczeniem kieszeni.');
  if (normalized.spindleRpm > setupResult.machine.maxSpindleRpm) return fail(`Obroty przekraczają limit maszyny ${setupResult.machine.maxSpindleRpm} obr./min.`);
  if (normalized.targetDepth > tool.fluteLength) return fail(`Głębokość przekracza długość ostrza narzędzia (${tool.fluteLength} mm).`);
  const bodyBounds = setupResult.body.bounds || setupResult.body.metrics?.bounds;
  const bodyHeight = Number(bodyBounds[1][2]) - Number(bodyBounds[0][2]);
  if (normalized.targetDepth > bodyHeight + 1e-7) return fail('Głębokość kieszeni przekracza wysokość bryły.');
  let resolvedBoundary;
  try { resolvedBoundary = resolveOperationBoundary(setupResult, normalized, document); } catch (error) { return fail(error.message); }
  const { loops } = resolvedBoundary;
  const boundary = offsetClosedContour(loops[0], -tool.diameter / 2);
  const xs = boundary.map((point) => point[0]);
  const ys = boundary.map((point) => point[1]);
  const minimumY = Math.min(...ys);
  const maximumY = Math.max(...ys);
  if (!(Math.max(...xs) - Math.min(...xs) > 1e-7) || !(maximumY - minimumY > 1e-7)) return fail('Obrys jest za mały dla wybranego narzędzia.');
  const rowStep = tool.diameter * normalized.stepover;
  const rowCount = Math.max(2, Math.ceil((maximumY - minimumY) / rowStep) + 1);
  const rows = [];
  for (let row = 0; row < rowCount; row += 1) {
    const y = minimumY + (maximumY - minimumY) * row / (rowCount - 1);
    const intervals = scanlineIntervals(boundary, y);
    if (row % 2) intervals.reverse().forEach((interval) => interval.reverse());
    rows.push(...intervals.map((interval) => ({ y, interval })));
  }
  if (!rows.length) return fail('Nie udało się wyznaczyć bezpiecznych przejść wewnątrz kieszeni.');
  const topZ = resolvedBoundary.planeZ;
  const layerCount = Math.max(1, Math.ceil(normalized.targetDepth / normalized.maxStepdown));
  const segments = [];
  let previous = [rows[0].interval[0], rows[0].y, setupResult.clearancePlaneZ];
  const push = (kind, to, feed = null) => {
    if (Math.hypot(...to.map((value, axis) => value - previous[axis])) <= 1e-9) return;
    segments.push({ kind, from: previous, to, ...(feed ? { feed } : {}) });
    previous = to;
  };
  for (let layer = 1; layer <= layerCount; layer += 1) {
    const z = topZ - Math.min(normalized.targetDepth, layer * normalized.targetDepth / layerCount);
    for (const row of rows) {
      const start = [row.interval[0], row.y, z];
      const end = [row.interval[1], row.y, z];
      push('rapid', [start[0], start[1], setupResult.clearancePlaneZ]);
      push('plunge', start, normalized.plungeRate);
      push('cut', end, normalized.feedRate);
      push('rapid', [end[0], end[1], setupResult.clearancePlaneZ]);
    }
  }
  return {
    valid: true,
    setup: setupResult,
    stockBounds: setupResult.stockBounds,
    origin: setupResult.origin,
    clearancePlaneZ: setupResult.clearancePlaneZ,
    operation: normalized,
    tool,
    segments,
    layerCount,
    rowCount: rows.length,
    ...summarizeToolpath(segments),
    warnings: [],
  };
}

export function calculateAdaptiveToolpath(setup, operation, bodies = [], document = null) {
  const setupResult = calculateManufacturingSetup(setup, bodies);
  const normalized = normalizeAdaptiveOperation(operation);
  const tool = CAM_TOOL_PRESETS[normalized.toolId];
  const fail = (warning) => ({ valid: false, setup: setupResult, tool, segments: [], warnings: [...(setupResult.warnings || []), warning].filter(Boolean) });
  if (!setupResult.body || !setupResult.stockBounds) return fail('Obróbka adaptacyjna wymaga poprawnego Setupu i bryły.');
  if (!setupResult.valid) return fail('Popraw Setup przed obliczeniem obróbki adaptacyjnej.');
  if (normalized.spindleRpm > setupResult.machine.maxSpindleRpm) return fail(`Obroty przekraczają limit maszyny ${setupResult.machine.maxSpindleRpm} obr./min.`);
  if (normalized.targetDepth > tool.fluteLength) return fail(`Głębokość przekracza długość ostrza narzędzia (${tool.fluteLength} mm).`);
  const bodyBounds = setupResult.body.bounds || setupResult.body.metrics?.bounds;
  const bodyHeight = Number(bodyBounds[1][2]) - Number(bodyBounds[0][2]);
  if (normalized.targetDepth > bodyHeight + 1e-7) return fail('Głębokość adaptacyjna przekracza wysokość bryły.');
  let resolvedBoundary;
  try { resolvedBoundary = resolveOperationBoundary(setupResult, normalized, document); } catch (error) { return fail(error.message); }
  const { loops } = resolvedBoundary;
  const radialStep = tool.diameter * normalized.optimalLoad;
  const rings = [];
  let ring = offsetClosedContour(loops[0], -tool.diameter / 2);
  let previousArea = Math.abs(signedPolygonArea(ring));
  for (let index = 0; index < 200 && previousArea > tool.diameter * tool.diameter * 0.2; index += 1) {
    if (ring.some((point) => !point.every(Number.isFinite))) break;
    rings.push(ring);
    const next = offsetClosedContour(ring, -radialStep);
    const nextArea = Math.abs(signedPolygonArea(next));
    const xs = next.map((point) => point[0]);
    const ys = next.map((point) => point[1]);
    if (nextArea >= previousArea - 1e-7 || Math.max(...xs) - Math.min(...xs) < radialStep || Math.max(...ys) - Math.min(...ys) < radialStep) break;
    ring = next;
    previousArea = nextArea;
  }
  if (!rings.length) return fail('Obrys jest za mały dla wybranego narzędzia i obciążenia optymalnego.');
  const topZ = resolvedBoundary.planeZ;
  const layerCount = Math.max(1, Math.ceil(normalized.targetDepth / normalized.maxStepdown));
  const segments = [];
  let previous = [rings[0][0][0], rings[0][0][1], setupResult.clearancePlaneZ];
  const push = (kind, to, feed = null) => {
    if (Math.hypot(...to.map((value, axis) => value - previous[axis])) <= 1e-9) return;
    segments.push({ kind, from: previous, to, ...(feed ? { feed } : {}) });
    previous = to;
  };
  for (let layer = 1; layer <= layerCount; layer += 1) {
    const z = topZ - Math.min(normalized.targetDepth, layer * normalized.targetDepth / layerCount);
    const outer = rings[0];
    push('rapid', [outer[0][0], outer[0][1], setupResult.clearancePlaneZ]);
    push('plunge', [outer[0][0], outer[0][1], topZ], normalized.plungeRate);
    for (let index = 1; index <= outer.length; index += 1) {
      const point = outer[index % outer.length];
      const rampZ = topZ + (z - topZ) * index / outer.length;
      push('cut', [point[0], point[1], rampZ], normalized.feedRate);
    }
    for (let ringIndex = 1; ringIndex < rings.length; ringIndex += 1) {
      const current = rings[ringIndex];
      push('cut', [current[0][0], current[0][1], z], normalized.feedRate);
      for (let pointIndex = 1; pointIndex <= current.length; pointIndex += 1) {
        const point = current[pointIndex % current.length];
        push('cut', [point[0], point[1], z], normalized.feedRate);
      }
    }
    push('rapid', [previous[0], previous[1], setupResult.clearancePlaneZ]);
  }
  return {
    valid: true,
    setup: setupResult,
    stockBounds: setupResult.stockBounds,
    origin: setupResult.origin,
    clearancePlaneZ: setupResult.clearancePlaneZ,
    operation: normalized,
    tool,
    segments,
    layerCount,
    ringCount: rings.length,
    ...summarizeToolpath(segments),
    warnings: [],
  };
}

export function calculateOperationToolpath(setup, operation, bodies = [], document = null) {
  if (operation?.type === 'contour') return calculateContourToolpath(setup, operation, bodies, document);
  if (operation?.type === 'pocket') return calculatePocketToolpath(setup, operation, bodies, document);
  if (operation?.type === 'adaptive') return calculateAdaptiveToolpath(setup, operation, bodies, document);
  return calculateFacingToolpath(setup, operation, bodies);
}

function gcodeNumber(value) {
  if (!Number.isFinite(Number(value))) throw new Error('Ścieżka CAM zawiera nieprawidłową współrzędną.');
  return Number(Number(value).toFixed(4)).toString();
}

export function createGrblGcode(setup, operation, bodies = [], { projectName = 'MadCAD', document = null } = {}) {
  const toolpath = calculateOperationToolpath(setup, operation, bodies, document);
  if (!toolpath.valid || !toolpath.segments.length) throw new Error(toolpath.warnings.join(' ') || 'Ścieżka CAM nie jest gotowa do eksportu.');
  const origin = toolpath.origin;
  const safeLocalZ = toolpath.clearancePlaneZ - origin[2];
  const lines = [
    `; ${String(projectName).replace(/[\r\n;]/g, ' ').trim() || 'MadCAD'}`,
    `; ${operation.name} | ${toolpath.tool.name}`,
    '; Sprawdź punkt zerowy WCS i wykonaj symulację bez materiału przed obróbką.',
    'G21',
    'G90',
    'G17',
    `T${Object.keys(CAM_TOOL_PRESETS).indexOf(toolpath.tool.id) + 1} M6`,
    `S${toolpath.operation.spindleRpm} M3`,
    `G0 Z${gcodeNumber(safeLocalZ)}`,
  ];
  let lastFeed = null;
  for (const segment of toolpath.segments) {
    const local = segment.to.map((value, axis) => value - origin[axis]);
    if (segment.kind === 'rapid') lines.push(`G0 X${gcodeNumber(local[0])} Y${gcodeNumber(local[1])} Z${gcodeNumber(local[2])}`);
    else {
      const feed = segment.feed;
      const feedWord = feed !== lastFeed ? ` F${gcodeNumber(feed)}` : '';
      lines.push(`G1 X${gcodeNumber(local[0])} Y${gcodeNumber(local[1])} Z${gcodeNumber(local[2])}${feedWord}`);
      lastFeed = feed;
    }
  }
  lines.push(`G0 Z${gcodeNumber(safeLocalZ)}`, 'M5', 'M30', '');
  return { text: lines.join('\n'), lineCount: lines.length - 1, toolpath, postProcessor: 'grbl-mm-absolute' };
}

export function validateManufacturing(manufacturing) {
  const issues = [];
  if (!manufacturing || typeof manufacturing !== 'object' || Array.isArray(manufacturing)) return [{ path: 'manufacturing', message: 'Wymagane są dane wytwarzania.', code: 'TYPE' }];
  if (!Array.isArray(manufacturing.setups)) return [{ path: 'manufacturing.setups', message: 'Setupy CAM muszą być tablicą.', code: 'TYPE' }];
  const ids = new Set();
  const names = new Set();
  manufacturing.setups.forEach((setup, index) => {
    const base = `manufacturing.setups[${index}]`;
    if (!setup || typeof setup !== 'object' || Array.isArray(setup)) { issues.push({ path: base, message: 'Setup CAM musi być obiektem.', code: 'TYPE' }); return; }
    if (typeof setup.id !== 'string' || !setup.id) issues.push({ path: `${base}.id`, message: 'Setup CAM wymaga ID.', code: 'REQUIRED' });
    else if (ids.has(setup.id)) issues.push({ path: `${base}.id`, message: 'ID setupu CAM jest powtórzone.', code: 'DUPLICATE_ID' });
    else ids.add(setup.id);
    const name = typeof setup.name === 'string' ? setup.name.trim() : '';
    if (!name) issues.push({ path: `${base}.name`, message: 'Setup CAM wymaga nazwy.', code: 'REQUIRED' });
    else if (names.has(name.toLocaleLowerCase())) issues.push({ path: `${base}.name`, message: 'Nazwa setupu CAM jest powtórzona.', code: 'DUPLICATE' });
    else names.add(name.toLocaleLowerCase());
    if (setup.operationKind !== 'mill-3axis') issues.push({ path: `${base}.operationKind`, message: 'Obsługiwane jest frezowanie 3-osiowe.', code: 'UNSUPPORTED' });
    if (typeof setup.bodyId !== 'string') issues.push({ path: `${base}.bodyId`, message: 'Identyfikator bryły musi być tekstem.', code: 'TYPE' });
    if (!CAM_MACHINE_PRESETS[setup.machineId]) issues.push({ path: `${base}.machineId`, message: 'Nieznany profil obrabiarki.', code: 'UNSUPPORTED' });
    if (!CAM_WCS_ORIGINS.some((item) => item.id === setup.wcsOrigin)) issues.push({ path: `${base}.wcsOrigin`, message: 'Nieznany początek układu WCS.', code: 'UNSUPPORTED' });
    for (const key of ['sideOffset', 'topOffset', 'bottomOffset']) if (!Number.isFinite(Number(setup.stock?.[key])) || Number(setup.stock[key]) < 0) issues.push({ path: `${base}.stock.${key}`, message: 'Naddatek musi być liczbą nieujemną.', code: 'VALUE' });
    if (!Number.isFinite(Number(setup.safeHeight)) || Number(setup.safeHeight) < 0) issues.push({ path: `${base}.safeHeight`, message: 'Wysokość bezpieczna musi być liczbą nieujemną.', code: 'VALUE' });
    if (!Array.isArray(setup.operations)) issues.push({ path: `${base}.operations`, message: 'Operacje CAM muszą być tablicą.', code: 'TYPE' });
    else setup.operations.forEach((operation, operationIndex) => {
      const operationBase = `${base}.operations[${operationIndex}]`;
      if (!operation || typeof operation !== 'object') issues.push({ path: operationBase, message: 'Operacja CAM musi być obiektem.', code: 'TYPE' });
      else {
        if (!['face', 'contour', 'pocket', 'adaptive'].includes(operation.type)) issues.push({ path: `${operationBase}.type`, message: 'Nieobsługiwany typ operacji CAM.', code: 'UNSUPPORTED' });
        if (!CAM_TOOL_PRESETS[operation.toolId]) issues.push({ path: `${operationBase}.toolId`, message: 'Nieznane narzędzie CAM.', code: 'UNSUPPORTED' });
        for (const key of ['maxStepdown', 'feedRate', 'plungeRate', 'spindleRpm']) if (!Number.isFinite(Number(operation[key])) || Number(operation[key]) <= 0) issues.push({ path: `${operationBase}.${key}`, message: 'Parametr operacji musi być dodatni.', code: 'VALUE' });
        if (['contour', 'pocket', 'adaptive'].includes(operation.type) && (!Number.isFinite(Number(operation.targetDepth)) || Number(operation.targetDepth) <= 0)) issues.push({ path: `${operationBase}.targetDepth`, message: 'Głębokość obróbki musi być dodatnia.', code: 'VALUE' });
      }
    });
  });
  if (typeof manufacturing.activeSetupId !== 'string') issues.push({ path: 'manufacturing.activeSetupId', message: 'Aktywny setup musi być identyfikatorem tekstowym.', code: 'TYPE' });
  else if (manufacturing.activeSetupId && !ids.has(manufacturing.activeSetupId)) issues.push({ path: 'manufacturing.activeSetupId', message: 'Aktywny setup CAM nie istnieje.', code: 'BROKEN_REFERENCE' });
  return issues;
}
