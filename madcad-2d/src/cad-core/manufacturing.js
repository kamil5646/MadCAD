import { createId } from './ids.js';
import { evaluateExpression, resolveParameters } from './expressions.js';

export const CAM_MACHINE_PRESETS = Object.freeze({
  'desktop-3018': Object.freeze({ id: 'desktop-3018', name: 'Frezarka biurkowa 3018', kind: 'mill-3axis', travel: [300, 180, 45], maxSpindleRpm: 10000 }),
  'mill-500': Object.freeze({ id: 'mill-500', name: 'Frezarka 3-osiowa 500', kind: 'mill-3axis', travel: [500, 400, 350], maxSpindleRpm: 12000 }),
  'mill-1000': Object.freeze({ id: 'mill-1000', name: 'Frezarka 3-osiowa 1000', kind: 'mill-3axis', travel: [1000, 600, 600], maxSpindleRpm: 18000 }),
  'laser-600': Object.freeze({ id: 'laser-600', name: 'Laser CNC 600 × 400', kind: 'cut-2d', process: 'laser', travel: [600, 400, 50], maxFeedRate: 6000 }),
  'plasma-1250': Object.freeze({ id: 'plasma-1250', name: 'Plazma CNC 1250 × 1250', kind: 'cut-2d', process: 'plasma', travel: [1250, 1250, 100], maxFeedRate: 12000 }),
  'lathe-300': Object.freeze({ id: 'lathe-300', name: 'Tokarka CNC Ø300 × 500', kind: 'turning-2axis', travel: [500, 300, 300], maxSpindleRpm: 3500 }),
});

export const CAM_WCS_ORIGINS = Object.freeze([
  Object.freeze({ id: 'stock-top-center', name: 'Środek górnej powierzchni półfabrykatu' }),
  Object.freeze({ id: 'stock-top-front-left', name: 'Lewy przedni narożnik półfabrykatu' }),
  Object.freeze({ id: 'model-origin', name: 'Początek układu modelu' }),
]);

export const CAM_TOOL_PRESETS = Object.freeze({
  'flat-3': Object.freeze({ id: 'flat-3', name: 'Frez palcowy płaski Ø3', type: 'flat-end-mill', diameter: 3, fluteLength: 12, stickout: 20, holderDiameter: 16, flutes: 2 }),
  'flat-6': Object.freeze({ id: 'flat-6', name: 'Frez palcowy płaski Ø6', type: 'flat-end-mill', diameter: 6, fluteLength: 20, stickout: 30, holderDiameter: 20, flutes: 2 }),
  'face-16': Object.freeze({ id: 'face-16', name: 'Frez do planowania Ø16', type: 'face-mill', diameter: 16, fluteLength: 8, stickout: 25, holderDiameter: 32, flutes: 3 }),
});

export const CAM_TURNING_TOOL_PRESETS = Object.freeze({
  'turn-rough-r08': Object.freeze({ id: 'turn-rough-r08', name: 'Nóż zewnętrzny R0,8', type: 'turning-rough', noseRadius: 0.8, stickout: 25 }),
  'turn-finish-r04': Object.freeze({ id: 'turn-finish-r04', name: 'Nóż wykańczający R0,4', type: 'turning-finish', noseRadius: 0.4, stickout: 20 }),
});

export const CAM_POST_PROCESSORS = Object.freeze({
  grbl: Object.freeze({ id: 'grbl', name: 'GRBL 1.1', extension: 'nc', commentStyle: 'semicolon', toolChange: false }),
  linuxcnc: Object.freeze({ id: 'linuxcnc', name: 'LinuxCNC', extension: 'ngc', commentStyle: 'parentheses', toolChange: true }),
  mach3: Object.freeze({ id: 'mach3', name: 'Mach3 / Mach4', extension: 'tap', commentStyle: 'parentheses', toolChange: true }),
  'grbl-laser': Object.freeze({ id: 'grbl-laser', name: 'GRBL Laser', extension: 'nc', commentStyle: 'semicolon', toolChange: false }),
  'linuxcnc-plasma': Object.freeze({ id: 'linuxcnc-plasma', name: 'LinuxCNC Plasma', extension: 'ngc', commentStyle: 'parentheses', toolChange: false }),
  'linuxcnc-turn': Object.freeze({ id: 'linuxcnc-turn', name: 'LinuxCNC Tokarka', extension: 'ngc', commentStyle: 'parentheses', toolChange: true }),
});

const normalizePostProcessorId = (value) => CAM_POST_PROCESSORS[value] ? value : 'grbl';

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
    postProcessorId: normalizePostProcessorId(operation.postProcessorId),
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
    postProcessorId: normalizePostProcessorId(operation.postProcessorId),
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
    postProcessorId: normalizePostProcessorId(operation.postProcessorId),
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
    postProcessorId: normalizePostProcessorId(operation.postProcessorId),
  };
}

export function normalizeCut2dOperation(operation = {}, index = 0) {
  return {
    id: typeof operation.id === 'string' && operation.id ? operation.id : createId('cam-operation'),
    name: String(operation.name || `Cięcie konturu ${index + 1}`).trim().slice(0, 80) || `Cięcie konturu ${index + 1}`,
    type: 'cut2d',
    kerfWidth: Math.max(0.01, Number(operation.kerfWidth) || 0.2),
    leadIn: Math.max(0, Number(operation.leadIn) || 2),
    feedRate: Math.max(1, Number(operation.feedRate) || 1200),
    powerPercent: Math.min(100, Math.max(1, Number(operation.powerPercent) || 80)),
    passes: Math.min(100, Math.max(1, Math.round(Number(operation.passes) || 1))),
    compensation: ['inside', 'center', 'outside'].includes(operation.compensation) ? operation.compensation : 'outside',
    boundaryFaceId: typeof operation.boundaryFaceId === 'string' ? operation.boundaryFaceId : '',
    boundarySketchId: typeof operation.boundarySketchId === 'string' ? operation.boundarySketchId : '',
    boundaryProfileId: typeof operation.boundaryProfileId === 'string' ? operation.boundaryProfileId : '',
    postProcessorId: ['grbl-laser', 'linuxcnc-plasma'].includes(operation.postProcessorId) ? operation.postProcessorId : 'grbl-laser',
  };
}

export function normalizeTurningOperation(operation = {}, index = 0) {
  const type = operation.type === 'turn-profile' ? 'turn-profile' : 'turn-face';
  return {
    id: typeof operation.id === 'string' && operation.id ? operation.id : createId('cam-operation'),
    name: String(operation.name || (type === 'turn-profile' ? `Toczenie zewnętrzne ${index + 1}` : `Planowanie czoła ${index + 1}`)).trim().slice(0, 80),
    type,
    toolId: CAM_TURNING_TOOL_PRESETS[operation.toolId] ? operation.toolId : 'turn-rough-r08',
    stockDiameter: Math.max(0.1, Number(operation.stockDiameter) || 50),
    targetDiameter: Math.max(0.1, Number(operation.targetDiameter) || 40),
    axialLength: Math.max(0.1, Number(operation.axialLength) || 20),
    maxDepthOfCut: Math.max(0.05, Number(operation.maxDepthOfCut) || 1),
    feedRate: Math.max(0.01, Number(operation.feedRate) || 0.2),
    spindleRpm: Math.max(1, Math.round(Number(operation.spindleRpm) || 1200)),
    postProcessorId: 'linuxcnc-turn',
  };
}

export function normalizeManufacturingOperation(operation = {}, index = 0) {
  if (operation?.type === 'contour') return normalizeContourOperation(operation, index);
  if (operation?.type === 'pocket') return normalizePocketOperation(operation, index);
  if (operation?.type === 'adaptive') return normalizeAdaptiveOperation(operation, index);
  if (operation?.type === 'cut2d') return normalizeCut2dOperation(operation, index);
  if (operation?.type === 'turn-face' || operation?.type === 'turn-profile') return normalizeTurningOperation(operation, index);
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
    operationKind: CAM_MACHINE_PRESETS[machineId].kind,
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
  if (machine.kind === 'turning-2axis') origin = [stockBounds[1][0], (stockBounds[0][1] + stockBounds[1][1]) / 2, (stockBounds[0][2] + stockBounds[1][2]) / 2];
  else if (normalized.wcsOrigin === 'model-origin') origin = [0, 0, 0];
  else if (normalized.wcsOrigin === 'stock-top-front-left') origin = [stockBounds[0][0], stockBounds[0][1], stockBounds[1][2]];
  else origin = [(stockBounds[0][0] + stockBounds[1][0]) / 2, (stockBounds[0][1] + stockBounds[1][1]) / 2, stockBounds[1][2]];
  const warnings = [];
  const exceededAxes = dimensions.map((value, axis) => value > machine.travel[axis] ? ['X', 'Y', 'Z'][axis] : null).filter(Boolean);
  if (exceededAxes.length) warnings.push(`Półfabrykat przekracza przesuw maszyny w osi ${exceededAxes.join(', ')}.`);
  if (dimensions.some((value) => value <= 0)) warnings.push('Półfabrykat musi mieć dodatnie wymiary.');
  const clearancePlaneZ = origin[2] + normalized.safeHeight;
  if (machine.kind !== 'turning-2axis' && clearancePlaneZ <= stockBounds[1][2] + 1e-7) warnings.push('Płaszczyzna bezpieczna musi znajdować się ponad górą półfabrykatu.');
  return {
    valid: warnings.length === 0,
    machine,
    body,
    stockBounds,
    dimensions,
    origin,
    clearancePlaneZ,
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

export function createCut2dOperation(options = {}) {
  return normalizeCut2dOperation({ ...options, id: createId('cam-operation') });
}

export function createTurningOperation(type = 'turn-face', options = {}) {
  return normalizeTurningOperation({ ...options, type, id: createId('cam-operation') });
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
  const estimatedRemovedVolume = Math.max(0, (stockMax[0] - stockMin[0]) * (stockMax[1] - stockMin[1]) * depth);
  return { valid: setupResult.valid, setup: setupResult, stockBounds: setupResult.stockBounds, origin: setupResult.origin, clearancePlaneZ: setupResult.clearancePlaneZ, operation: normalized, tool, segments, layerCount, rowCount, distance, cuttingDistance, durationMinutes, estimatedRemovedVolume, warnings: setupResult.warnings };
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
    estimatedRemovedVolume: contour.reduce((sum, point, index) => {
      const next = contour[(index + 1) % contour.length];
      return sum + Math.hypot(next[0] - point[0], next[1] - point[1]);
    }, 0) * tool.diameter * normalized.targetDepth,
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
    estimatedRemovedVolume: Math.abs(signedPolygonArea(boundary)) * normalized.targetDepth,
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
    estimatedRemovedVolume: Math.abs(signedPolygonArea(loops[0])) * normalized.targetDepth,
    ...summarizeToolpath(segments),
    warnings: [],
  };
}

export function calculateCut2dToolpath(setup, operation, bodies = [], document = null) {
  const setupResult = calculateManufacturingSetup(setup, bodies);
  const normalized = normalizeCut2dOperation(operation);
  const tool = { id: 'cutting-beam', name: setupResult.machine?.process === 'plasma' ? 'Łuk plazmowy' : 'Wiązka lasera', type: 'cutting-beam', diameter: normalized.kerfWidth, stickout: Infinity, holderDiameter: 0 };
  const fail = (warning) => ({ valid: false, setup: setupResult, tool, segments: [], warnings: [...(setupResult.warnings || []), warning].filter(Boolean) });
  if (!setupResult.body || !setupResult.stockBounds) return fail('Cięcie 2D wymaga poprawnego Setupu i bryły albo profilu szkicu.');
  if (!setupResult.valid) return fail('Popraw Setup przed obliczeniem cięcia.');
  if (setupResult.machine.kind !== 'cut-2d') return fail('Cięcie 2D wymaga maszyny laserowej albo plazmowej.');
  if (setupResult.machine.process === 'laser' && normalized.postProcessorId !== 'grbl-laser') return fail('Laser wymaga postprocesora GRBL Laser.');
  if (setupResult.machine.process === 'plasma' && normalized.postProcessorId !== 'linuxcnc-plasma') return fail('Plazma wymaga postprocesora LinuxCNC Plasma.');
  if (normalized.feedRate > setupResult.machine.maxFeedRate) return fail(`Posuw przekracza limit maszyny ${setupResult.machine.maxFeedRate} mm/min.`);
  let resolvedBoundary;
  try { resolvedBoundary = resolveOperationBoundary(setupResult, normalized, document); } catch (error) { return fail(error.message); }
  const offset = normalized.compensation === 'center' ? 0 : normalized.kerfWidth / 2 * (normalized.compensation === 'inside' ? -1 : 1);
  const contour = offsetClosedContour(resolvedBoundary.loops[0], offset);
  if (contour.length < 3 || contour.some((point) => !point.every(Number.isFinite))) return fail('Nie udało się skompensować szerokości szczeliny dla wybranego obrysu.');
  const planeZ = resolvedBoundary.planeZ;
  const first = contour[0];
  const second = contour[1];
  const direction = [second[0] - first[0], second[1] - first[1]];
  const length = Math.hypot(...direction) || 1;
  const leadStart = [first[0] - direction[0] / length * normalized.leadIn, first[1] - direction[1] / length * normalized.leadIn];
  const segments = [];
  let previous = [leadStart[0], leadStart[1], setupResult.clearancePlaneZ];
  const push = (kind, to, feed = null) => {
    if (Math.hypot(...to.map((value, axis) => value - previous[axis])) <= 1e-9) return;
    segments.push({ kind, from: previous, to, ...(feed ? { feed } : {}) });
    previous = to;
  };
  for (let pass = 0; pass < normalized.passes; pass += 1) {
    push('rapid', [leadStart[0], leadStart[1], setupResult.clearancePlaneZ]);
    push('rapid', [leadStart[0], leadStart[1], planeZ]);
    push('cut', [first[0], first[1], planeZ], normalized.feedRate);
    for (let index = 1; index <= contour.length; index += 1) {
      const point = contour[index % contour.length];
      push('cut', [point[0], point[1], planeZ], normalized.feedRate);
    }
    push('rapid', [previous[0], previous[1], setupResult.clearancePlaneZ]);
  }
  const bodyBounds = setupResult.body.bounds || setupResult.body.metrics?.bounds;
  const materialThickness = Math.max(0, Number(bodyBounds[1][2]) - Number(bodyBounds[0][2]));
  return {
    valid: true,
    setup: setupResult,
    stockBounds: setupResult.stockBounds,
    origin: setupResult.origin,
    clearancePlaneZ: setupResult.clearancePlaneZ,
    operation: normalized,
    tool,
    segments,
    layerCount: normalized.passes,
    contourPointCount: contour.length,
    estimatedRemovedVolume: contour.reduce((sum, point, index) => {
      const next = contour[(index + 1) % contour.length];
      return sum + Math.hypot(next[0] - point[0], next[1] - point[1]);
    }, 0) * normalized.kerfWidth * materialThickness * normalized.passes,
    ...summarizeToolpath(segments),
    warnings: [],
  };
}

export function calculateTurningToolpath(setup, operation, bodies = []) {
  const setupResult = calculateManufacturingSetup(setup, bodies);
  const normalized = normalizeTurningOperation(operation);
  const tool = CAM_TURNING_TOOL_PRESETS[normalized.toolId];
  const fail = (warning) => ({ valid: false, setup: setupResult, tool, segments: [], warnings: [...(setupResult.warnings || []), warning].filter(Boolean) });
  if (!setupResult.body || !setupResult.stockBounds) return fail('Toczenie wymaga poprawnego Setupu i bryły.');
  if (!setupResult.valid) return fail('Popraw Setup przed obliczeniem toczenia.');
  if (setupResult.machine.kind !== 'turning-2axis') return fail('Operacja wymaga Setupu tokarki.');
  if (normalized.spindleRpm > setupResult.machine.maxSpindleRpm) return fail(`Obroty przekraczają limit tokarki ${setupResult.machine.maxSpindleRpm} obr./min.`);
  if (normalized.targetDiameter >= normalized.stockDiameter) return fail('Średnica docelowa musi być mniejsza od średnicy półfabrykatu.');
  if (normalized.stockDiameter > setupResult.machine.travel[1]) return fail(`Średnica półfabrykatu przekracza zakres tokarki Ø${setupResult.machine.travel[1]} mm.`);
  const bodyBounds = setupResult.body.bounds || setupResult.body.metrics?.bounds;
  if (normalized.axialLength > setupResult.stockBounds[1][0] - setupResult.stockBounds[0][0] + 1e-7) return fail('Długość toczenia przekracza długość półfabrykatu w osi wrzeciona.');
  const centerY = setupResult.origin[1];
  const centerZ = setupResult.origin[2];
  const stockRadius = normalized.stockDiameter / 2;
  const targetRadius = normalized.targetDiameter / 2;
  const safeRadius = stockRadius + Math.max(2, setup.safeHeight);
  const stockFront = setupResult.stockBounds[1][0];
  const bodyFront = Number(bodyBounds[1][0]);
  const segments = [];
  let previous = [stockFront + 2, centerY + safeRadius, centerZ];
  const push = (kind, to, feed = null) => {
    if (Math.hypot(...to.map((value, axis) => value - previous[axis])) <= 1e-9) return;
    segments.push({ kind, from: previous, to, ...(feed ? { feed } : {}) });
    previous = to;
  };
  let passCount = 0;
  if (normalized.type === 'turn-face') {
    const allowance = Math.max(0.05, stockFront - bodyFront);
    passCount = Math.max(1, Math.ceil(allowance / normalized.maxDepthOfCut));
    for (let pass = 1; pass <= passCount; pass += 1) {
      const axial = stockFront - allowance * pass / passCount;
      push('rapid', [axial + 1, centerY + safeRadius, centerZ]);
      push('rapid', [axial, centerY + stockRadius + 1, centerZ]);
      push('cut', [axial, centerY, centerZ], normalized.feedRate);
      push('rapid', [axial + 1, centerY + safeRadius, centerZ]);
    }
  } else {
    passCount = Math.max(1, Math.ceil((stockRadius - targetRadius) / normalized.maxDepthOfCut));
    for (let pass = 1; pass <= passCount; pass += 1) {
      const radius = stockRadius - (stockRadius - targetRadius) * pass / passCount;
      push('rapid', [stockFront + 1, centerY + safeRadius, centerZ]);
      push('rapid', [stockFront, centerY + radius, centerZ]);
      push('cut', [stockFront - normalized.axialLength, centerY + radius, centerZ], normalized.feedRate);
      push('rapid', [stockFront + 1, centerY + safeRadius, centerZ]);
    }
  }
  const summary = summarizeToolpath(segments);
  const removedArea = Math.PI * (stockRadius ** 2 - targetRadius ** 2);
  return {
    valid: true,
    turning: true,
    setup: setupResult,
    stockBounds: setupResult.stockBounds,
    origin: setupResult.origin,
    clearancePlaneZ: setupResult.clearancePlaneZ,
    operation: normalized,
    tool: { ...tool, diameter: tool.noseRadius * 2, holderDiameter: 0 },
    segments,
    layerCount: passCount,
    passCount,
    estimatedRemovedVolume: normalized.type === 'turn-profile' ? removedArea * normalized.axialLength : Math.PI * stockRadius ** 2 * Math.max(0.05, stockFront - bodyFront),
    ...summary,
    durationMinutes: segments.reduce((sum, segment) => sum + Math.hypot(...segment.to.map((value, axis) => value - segment.from[axis])) / (segment.kind === 'rapid' ? 3000 : normalized.feedRate * normalized.spindleRpm), 0),
    warnings: [],
  };
}

export function calculateOperationToolpath(setup, operation, bodies = [], document = null) {
  if (operation?.type === 'contour') return calculateContourToolpath(setup, operation, bodies, document);
  if (operation?.type === 'pocket') return calculatePocketToolpath(setup, operation, bodies, document);
  if (operation?.type === 'adaptive') return calculateAdaptiveToolpath(setup, operation, bodies, document);
  if (operation?.type === 'cut2d') return calculateCut2dToolpath(setup, operation, bodies, document);
  if (operation?.type === 'turn-face' || operation?.type === 'turn-profile') return calculateTurningToolpath(setup, operation, bodies);
  return calculateFacingToolpath(setup, operation, bodies);
}

export function analyzeToolpathSafety(toolpath) {
  const issues = [];
  if (!toolpath?.valid) return (toolpath?.warnings || ['Ścieżka nie jest prawidłowa.']).map((message) => ({ code: 'INVALID_TOOLPATH', message }));
  const points = toolpath.segments.flatMap((segment) => [segment.from, segment.to]);
  if (points.some((point) => point.length !== 3 || point.some((value) => !Number.isFinite(value)))) issues.push({ code: 'NON_FINITE', message: 'Ścieżka zawiera nieprawidłową współrzędną.' });
  const machine = toolpath.setup.machine;
  for (let axis = 0; axis < 3; axis += 1) {
    const values = points.map((point) => point[axis]);
    if (Math.max(...values) - Math.min(...values) > machine.travel[axis] + 1e-7) issues.push({ code: 'MACHINE_TRAVEL', message: `Ścieżka przekracza przesuw maszyny w osi ${['X', 'Y', 'Z'][axis]}.` });
  }
  if (toolpath.turning) return issues;
  const stockTop = toolpath.stockBounds[1][2];
  for (const segment of toolpath.segments) {
    const horizontalDistance = Math.hypot(segment.to[0] - segment.from[0], segment.to[1] - segment.from[1]);
    if (segment.kind === 'rapid' && horizontalDistance > 1e-7 && Math.min(segment.from[2], segment.to[2]) < stockTop - 1e-7) {
      issues.push({ code: 'RAPID_IN_STOCK', message: 'Wykryto szybki przejazd poziomy poniżej góry półfabrykatu.' });
      break;
    }
  }
  const cuttingPoints = toolpath.segments.filter((segment) => segment.kind !== 'rapid').flatMap((segment) => [segment.from, segment.to]);
  const minimumCutZ = cuttingPoints.length ? Math.min(...cuttingPoints.map((point) => point[2])) : stockTop;
  if (stockTop - minimumCutZ > toolpath.tool.stickout + 1e-7) issues.push({ code: 'HOLDER_COLLISION', message: 'Głębokość ścieżki powoduje ryzyko kolizji oprawki z półfabrykatem.' });
  return issues;
}

export function analyzeManufacturingProgram(setup, bodies = [], document = null) {
  const normalized = normalizeManufacturingSetup(setup);
  const operations = normalized.operations.map((operation) => {
    const toolpath = calculateOperationToolpath(normalized, operation, bodies, document);
    const issues = analyzeToolpathSafety(toolpath);
    return {
      id: operation.id,
      name: operation.name,
      type: operation.type,
      valid: toolpath.valid && issues.length === 0,
      segmentCount: toolpath.segments.length,
      durationMinutes: toolpath.durationMinutes || 0,
      cuttingDistance: toolpath.cuttingDistance || 0,
      estimatedRemovedVolume: toolpath.estimatedRemovedVolume || 0,
      issues,
    };
  });
  const setupResult = calculateManufacturingSetup(normalized, bodies);
  const stockVolume = setupResult.dimensions?.reduce((volume, dimension) => volume * dimension, 1) || 0;
  const estimatedRemovedVolume = operations.reduce((sum, operation) => sum + operation.estimatedRemovedVolume, 0);
  return {
    valid: setupResult.valid && operations.length > 0 && operations.every((operation) => operation.valid),
    setupIssues: setupResult.warnings,
    operations,
    segmentCount: operations.reduce((sum, operation) => sum + operation.segmentCount, 0),
    durationMinutes: operations.reduce((sum, operation) => sum + operation.durationMinutes, 0),
    cuttingDistance: operations.reduce((sum, operation) => sum + operation.cuttingDistance, 0),
    stockVolume,
    estimatedRemovedVolume,
    estimatedRemovalPercent: stockVolume ? Math.min(100, estimatedRemovedVolume / stockVolume * 100) : 0,
  };
}

export function simulateMaterialRemoval(setup, bodies = [], document = null, progress = 1, resolution = 36) {
  const setupResult = calculateManufacturingSetup(setup, bodies);
  const report = analyzeManufacturingProgram(setup, bodies, document);
  if (!setupResult.valid || !report.operations.length) return { valid: false, progress: 0, columns: [], cutter: null, removedVolume: 0, warnings: setupResult.warnings };
  const toolpaths = normalizeManufacturingSetup(setup).operations
    .map((operation) => calculateOperationToolpath(setup, operation, bodies, document))
    .filter((toolpath) => toolpath.valid);
  const entries = toolpaths.flatMap((toolpath) => toolpath.segments.map((segment) => ({ segment, tool: toolpath.tool, operationId: toolpath.operation.id })));
  const normalizedProgress = Math.min(1, Math.max(0, Number(progress) || 0));
  const processedCount = Math.min(entries.length, Math.ceil(entries.length * normalizedProgress));
  const [minimum, maximum] = setupResult.stockBounds;
  const width = maximum[0] - minimum[0];
  const depth = maximum[1] - minimum[1];
  const baseResolution = Math.max(12, Math.min(64, Math.round(Number(resolution) || 36)));
  const xCount = width >= depth ? baseResolution : Math.max(12, Math.round(baseResolution * width / depth));
  const yCount = depth >= width ? baseResolution : Math.max(12, Math.round(baseResolution * depth / width));
  const cellWidth = width / xCount;
  const cellDepth = depth / yCount;
  const stockTop = maximum[2];
  const heights = new Float32Array(xCount * yCount).fill(stockTop);
  let cutter = entries[0] ? { position: [...entries[0].segment.from], diameter: entries[0].tool.diameter, operationId: entries[0].operationId } : null;
  for (const entry of entries.slice(0, processedCount)) {
    cutter = { position: [...entry.segment.to], diameter: entry.tool.diameter, operationId: entry.operationId };
    if (entry.segment.kind === 'rapid') continue;
    const length = Math.hypot(...entry.segment.to.map((value, axis) => value - entry.segment.from[axis]));
    const sampleStep = Math.max(0.1, Math.min(cellWidth, cellDepth, entry.tool.diameter / 2) / 2);
    const samples = Math.max(1, Math.ceil(length / sampleStep));
    const radius = entry.tool.diameter / 2;
    for (let sample = 0; sample <= samples; sample += 1) {
      const ratio = sample / samples;
      const point = entry.segment.from.map((value, axis) => value + (entry.segment.to[axis] - value) * ratio);
      const minX = Math.max(0, Math.floor((point[0] - radius - minimum[0]) / cellWidth));
      const maxX = Math.min(xCount - 1, Math.floor((point[0] + radius - minimum[0]) / cellWidth));
      const minY = Math.max(0, Math.floor((point[1] - radius - minimum[1]) / cellDepth));
      const maxY = Math.min(yCount - 1, Math.floor((point[1] + radius - minimum[1]) / cellDepth));
      for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) {
        const centerX = minimum[0] + (x + 0.5) * cellWidth;
        const centerY = minimum[1] + (y + 0.5) * cellDepth;
        if (Math.hypot(centerX - point[0], centerY - point[1]) <= radius + Math.hypot(cellWidth, cellDepth) / 2) {
          const index = y * xCount + x;
          heights[index] = Math.max(minimum[2], Math.min(heights[index], point[2]));
        }
      }
    }
  }
  const columns = [];
  let removedVolume = 0;
  for (let y = 0; y < yCount; y += 1) for (let x = 0; x < xCount; x += 1) {
    const top = heights[y * xCount + x];
    if (stockTop - top <= 1e-7) continue;
    const volume = (stockTop - top) * cellWidth * cellDepth;
    removedVolume += volume;
    columns.push({ x: minimum[0] + (x + 0.5) * cellWidth, y: minimum[1] + (y + 0.5) * cellDepth, bottom: top, top: stockTop, width: cellWidth, depth: cellDepth });
  }
  return { valid: report.valid, progress: normalizedProgress, columns, cutter, removedVolume, processedSegments: processedCount, totalSegments: entries.length, warnings: report.setupIssues };
}

function gcodeNumber(value) {
  if (!Number.isFinite(Number(value))) throw new Error('Ścieżka CAM zawiera nieprawidłową współrzędną.');
  return Number(Number(value).toFixed(4)).toString();
}

export function createMachineGcode(setup, operation, bodies = [], { projectName = 'MadCAD', document = null, postProcessorId = operation?.postProcessorId } = {}) {
  const toolpath = calculateOperationToolpath(setup, operation, bodies, document);
  if (!toolpath.valid || !toolpath.segments.length) throw new Error(toolpath.warnings.join(' ') || 'Ścieżka CAM nie jest gotowa do eksportu.');
  const safetyIssues = analyzeToolpathSafety(toolpath);
  if (safetyIssues.length) throw new Error(`Eksport zablokowany przez kontrolę bezpieczeństwa: ${safetyIssues.map((issue) => issue.message).join(' ')}`);
  const origin = toolpath.origin;
  const safeLocalZ = toolpath.clearancePlaneZ - origin[2];
  const postProcessor = CAM_POST_PROCESSORS[postProcessorId] || CAM_POST_PROCESSORS.grbl;
  const cleanComment = (value) => String(value).replace(/[\r\n;()]/g, ' ').trim();
  const comment = (value) => postProcessor.commentStyle === 'parentheses' ? `(${cleanComment(value)})` : `; ${cleanComment(value)}`;
  if (toolpath.turning) {
    if (postProcessor.id !== 'linuxcnc-turn') throw new Error('Toczenie wymaga postprocesora LinuxCNC Tokarka.');
    const toolNumber = Object.keys(CAM_TURNING_TOOL_PRESETS).indexOf(toolpath.operation.toolId) + 1;
    const lines = ['%', comment(cleanComment(projectName) || 'MadCAD'), comment(`${operation.name} | ${toolpath.tool.name}`), comment('Sprawdź mocowanie, zero osi Z i średnicę X przed uruchomieniem.'), 'G21', 'G90', 'G18', 'G95', 'G40', `T${toolNumber} M6`, `S${toolpath.operation.spindleRpm} M3`];
    let lastFeed = null;
    for (const segment of toolpath.segments) {
      const diameter = Math.abs(segment.to[1] - origin[1]) * 2;
      const axial = segment.to[0] - origin[0];
      if (segment.kind === 'rapid') lines.push(`G0 X${gcodeNumber(diameter)} Z${gcodeNumber(axial)}`);
      else {
        const feed = segment.feed || toolpath.operation.feedRate;
        lines.push(`G1 X${gcodeNumber(diameter)} Z${gcodeNumber(axial)}${feed !== lastFeed ? ` F${gcodeNumber(feed)}` : ''}`);
        lastFeed = feed;
      }
    }
    lines.push('M5', 'M2', '%', '');
    return { text: lines.join('\n'), lineCount: lines.length - 1, toolpath, postProcessor: postProcessor.id, extension: postProcessor.extension };
  }
  if (toolpath.operation.type === 'cut2d') {
    if (!['grbl-laser', 'linuxcnc-plasma'].includes(postProcessor.id)) throw new Error('Wybierz postprocesor przeznaczony do cięcia 2D.');
    const isPlasma = postProcessor.id === 'linuxcnc-plasma';
    const lines = [];
    if (isPlasma) lines.push('%');
    lines.push(comment(cleanComment(projectName) || 'MadCAD'), comment(`${operation.name} | ${toolpath.tool.name}`), comment('Sprawdź zero WCS, moc i przejazd bez materiału.'), 'G21', 'G90', 'G17', 'G94');
    if (isPlasma) lines.push('G40', 'G64 P0.01');
    let processOn = false;
    for (const segment of toolpath.segments) {
      const local = segment.to.map((value, axis) => value - origin[axis]);
      if (segment.kind === 'rapid') {
        if (processOn) { lines.push('M5'); processOn = false; }
        lines.push(`G0 X${gcodeNumber(local[0])} Y${gcodeNumber(local[1])} Z${gcodeNumber(local[2])}`);
      } else {
        if (!processOn) {
          lines.push(isPlasma ? 'M3' : `M4 S${Math.round(toolpath.operation.powerPercent * 10)}`);
          if (isPlasma) lines.push('G4 P0.5');
          processOn = true;
        }
        lines.push(`G1 X${gcodeNumber(local[0])} Y${gcodeNumber(local[1])} Z${gcodeNumber(local[2])} F${gcodeNumber(segment.feed || toolpath.operation.feedRate)}`);
      }
    }
    if (processOn) lines.push('M5');
    lines.push(isPlasma ? 'M2' : 'M30');
    if (isPlasma) lines.push('%');
    lines.push('');
    return { text: lines.join('\n'), lineCount: lines.length - 1, toolpath, postProcessor: postProcessor.id, extension: postProcessor.extension };
  }
  const toolNumber = Object.keys(CAM_TOOL_PRESETS).indexOf(toolpath.tool.id) + 1;
  const lines = [];
  if (postProcessor.id === 'linuxcnc') lines.push('%');
  lines.push(
    comment(cleanComment(projectName) || 'MadCAD'),
    comment(`${operation.name} | ${toolpath.tool.name}`),
    comment('Sprawdź punkt zerowy WCS i wykonaj symulację bez materiału przed obróbką.'),
    'G21', 'G90', 'G17', 'G94',
  );
  if (postProcessor.id === 'linuxcnc') lines.push('G40', 'G49', 'G64 P0.01');
  if (postProcessor.id === 'mach3') lines.push('G40', 'G49', 'G80');
  if (postProcessor.toolChange) lines.push(`T${toolNumber} M6`);
  else lines.push(comment(`Narzędzie T${toolNumber}: ${toolpath.tool.name} — zmień ręcznie przed startem`));
  lines.push(`S${toolpath.operation.spindleRpm} M3`, `G0 Z${gcodeNumber(safeLocalZ)}`);
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
  lines.push(`G0 Z${gcodeNumber(safeLocalZ)}`, 'M5', postProcessor.id === 'linuxcnc' ? 'M2' : 'M30');
  if (postProcessor.id === 'linuxcnc') lines.push('%');
  lines.push('');
  return { text: lines.join('\n'), lineCount: lines.length - 1, toolpath, postProcessor: postProcessor.id, extension: postProcessor.extension };
}

export function createGrblGcode(setup, operation, bodies = [], options = {}) {
  const output = createMachineGcode(setup, { ...operation, postProcessorId: 'grbl' }, bodies, { ...options, postProcessorId: 'grbl' });
  return { ...output, postProcessor: 'grbl-mm-absolute' };
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
    if (!['mill-3axis', 'cut-2d', 'turning-2axis'].includes(setup.operationKind)) issues.push({ path: `${base}.operationKind`, message: 'Nieobsługiwany rodzaj obróbki.', code: 'UNSUPPORTED' });
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
        if (!['face', 'contour', 'pocket', 'adaptive', 'cut2d', 'turn-face', 'turn-profile'].includes(operation.type)) issues.push({ path: `${operationBase}.type`, message: 'Nieobsługiwany typ operacji CAM.', code: 'UNSUPPORTED' });
        const isTurning = operation.type === 'turn-face' || operation.type === 'turn-profile';
        if (operation.type !== 'cut2d' && !isTurning && !CAM_TOOL_PRESETS[operation.toolId]) issues.push({ path: `${operationBase}.toolId`, message: 'Nieznane narzędzie CAM.', code: 'UNSUPPORTED' });
        if (isTurning && !CAM_TURNING_TOOL_PRESETS[operation.toolId]) issues.push({ path: `${operationBase}.toolId`, message: 'Nieznany nóż tokarski.', code: 'UNSUPPORTED' });
        if (!CAM_POST_PROCESSORS[operation.postProcessorId]) issues.push({ path: `${operationBase}.postProcessorId`, message: 'Nieznany postprocesor CAM.', code: 'UNSUPPORTED' });
        const positiveKeys = operation.type === 'cut2d' ? ['kerfWidth', 'feedRate', 'powerPercent', 'passes'] : isTurning ? ['stockDiameter', 'targetDiameter', 'axialLength', 'maxDepthOfCut', 'feedRate', 'spindleRpm'] : ['maxStepdown', 'feedRate', 'plungeRate', 'spindleRpm'];
        for (const key of positiveKeys) if (!Number.isFinite(Number(operation[key])) || Number(operation[key]) <= 0) issues.push({ path: `${operationBase}.${key}`, message: 'Parametr operacji musi być dodatni.', code: 'VALUE' });
        if (['contour', 'pocket', 'adaptive'].includes(operation.type) && (!Number.isFinite(Number(operation.targetDepth)) || Number(operation.targetDepth) <= 0)) issues.push({ path: `${operationBase}.targetDepth`, message: 'Głębokość obróbki musi być dodatnia.', code: 'VALUE' });
        if (setup.operationKind === 'cut-2d' && operation.type !== 'cut2d') issues.push({ path: `${operationBase}.type`, message: 'Setup cięcia może zawierać tylko operacje cięcia 2D.', code: 'INCOMPATIBLE' });
        if (setup.operationKind === 'mill-3axis' && operation.type === 'cut2d') issues.push({ path: `${operationBase}.type`, message: 'Operacja cięcia wymaga Setupu laserowego lub plazmowego.', code: 'INCOMPATIBLE' });
        if (setup.operationKind === 'turning-2axis' && !isTurning) issues.push({ path: `${operationBase}.type`, message: 'Setup tokarki może zawierać tylko operacje toczenia.', code: 'INCOMPATIBLE' });
        if (setup.operationKind !== 'turning-2axis' && isTurning) issues.push({ path: `${operationBase}.type`, message: 'Operacja toczenia wymaga Setupu tokarki.', code: 'INCOMPATIBLE' });
      }
    });
  });
  if (typeof manufacturing.activeSetupId !== 'string') issues.push({ path: 'manufacturing.activeSetupId', message: 'Aktywny setup musi być identyfikatorem tekstowym.', code: 'TYPE' });
  else if (manufacturing.activeSetupId && !ids.has(manufacturing.activeSetupId)) issues.push({ path: 'manufacturing.activeSetupId', message: 'Aktywny setup CAM nie istnieje.', code: 'BROKEN_REFERENCE' });
  return issues;
}
