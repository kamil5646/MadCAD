import { createId } from './ids.js';
import { componentBomEntries } from './components.js';

export const DRAWING_PAGE_SIZES = Object.freeze({
  A4: Object.freeze({ width: 297, height: 210 }),
  A3: Object.freeze({ width: 420, height: 297 }),
});

export const DRAWING_VIEW_ORIENTATIONS = Object.freeze(['front', 'top', 'right', 'isometric']);
export const DRAWING_VIEW_TYPES = Object.freeze(['base', 'projected', 'section', 'detail']);
export const DRAWING_VIEW_ALIGNMENTS = Object.freeze(['horizontal', 'vertical', 'free']);
export const DRAWING_ANNOTATION_TYPES = Object.freeze(['linear-dimension', 'centerline', 'center-mark', 'hole-note', 'feature-control-frame', 'balloon']);
export const DRAWING_TABLE_TYPES = Object.freeze(['bom', 'hole-table']);

const PAGE_MARGIN = 10;
const TITLE_BLOCK_HEIGHT = 24;

function pageDimensions(pageSize = 'A4', orientation = 'landscape') {
  const base = DRAWING_PAGE_SIZES[pageSize] || DRAWING_PAGE_SIZES.A4;
  return orientation === 'portrait'
    ? { width: Math.min(base.width, base.height), height: Math.max(base.width, base.height) }
    : { width: Math.max(base.width, base.height), height: Math.min(base.width, base.height) };
}

export function createDrawingSheet({ name = 'Arkusz 1', pageSize = 'A4', orientation = 'landscape' } = {}) {
  const normalizedPageSize = DRAWING_PAGE_SIZES[pageSize] ? pageSize : 'A4';
  const normalizedOrientation = orientation === 'portrait' ? 'portrait' : 'landscape';
  return {
    id: createId('sheet'),
    name: String(name || 'Arkusz 1').trim().slice(0, 80) || 'Arkusz 1',
    pageSize: normalizedPageSize,
    orientation: normalizedOrientation,
    views: [],
    annotations: [],
    titleBlock: { title: '', partNumber: '', material: '', author: '', company: '', revision: 'A' },
    revisions: [],
    tables: [],
  };
}

export function createDrawingRevision({ code = 'A', description = 'Wydanie początkowe', author = '', date = new Date().toISOString().slice(0, 10) } = {}) {
  return { id: createId('drawing-revision'), code: String(code || 'A').slice(0, 8), description: String(description || '').slice(0, 120), author: String(author || '').slice(0, 60), date: String(date || '').slice(0, 10) };
}

function normalizedPoint(point, fallback = [0.5, 0.5]) {
  return [0, 1].map((index) => {
    const value = Number(point?.[index]);
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : fallback[index]));
  });
}

export function createLinearDrawingDimension({ viewId, axis = 'horizontal', offset = 10, precision = 2, toleranceMode = 'none', upperTolerance = 0, lowerTolerance = 0 } = {}) {
  return {
    id: createId('drawing-annotation'),
    type: 'linear-dimension',
    viewId,
    axis: axis === 'vertical' ? 'vertical' : 'horizontal',
    offset: Math.max(-100, Math.min(100, Number(offset) || 10)),
    precision: Math.max(0, Math.min(4, Math.trunc(Number(precision) || 0))),
    toleranceMode: ['none', 'symmetric', 'deviation'].includes(toleranceMode) ? toleranceMode : 'none',
    upperTolerance: Math.max(0, Math.min(100, Number(upperTolerance) || 0)),
    lowerTolerance: Math.max(0, Math.min(100, Number(lowerTolerance) || 0)),
  };
}

export function createCenterlineDrawingAnnotation({ viewId, axis = 'horizontal', offset = 0 } = {}) {
  return {
    id: createId('drawing-annotation'),
    type: 'centerline',
    viewId,
    axis: axis === 'vertical' ? 'vertical' : 'horizontal',
    offset: Math.max(-1, Math.min(1, Number(offset) || 0)),
  };
}

export function createCenterMarkDrawingAnnotation({ viewId, center = [0.5, 0.5], size = 5 } = {}) {
  return {
    id: createId('drawing-annotation'),
    type: 'center-mark',
    viewId,
    center: normalizedPoint(center),
    size: Math.max(2, Math.min(20, Number(size) || 5)),
  };
}

export function createHoleNoteDrawingAnnotation({ viewId, center = [0.5, 0.5], labelOffset = [18, -12], noteMode = 'hole', diameterSource = 'model', diameter = 0, precision = 2, quantity = 1, through = true, threadDesignation = 'M8×1.25', threadClass = '6H' } = {}) {
  return {
    id: createId('drawing-annotation'),
    type: 'hole-note',
    viewId,
    center: normalizedPoint(center),
    labelOffset: [Number(labelOffset?.[0]) || 18, Number(labelOffset?.[1]) || -12],
    noteMode: noteMode === 'thread' ? 'thread' : 'hole',
    diameterSource: diameterSource === 'manual' ? 'manual' : 'model',
    diameter: Math.max(0, Number(diameter) || 0),
    precision: Math.max(0, Math.min(4, Math.trunc(Number(precision) || 0))),
    quantity: Math.max(1, Math.min(99, Math.trunc(Number(quantity) || 1))),
    through: through !== false,
    threadDesignation: String(threadDesignation || 'M8×1.25').trim().slice(0, 30) || 'M8×1.25',
    threadClass: String(threadClass || '6H').trim().slice(0, 12) || '6H',
  };
}

export function createFeatureControlFrameDrawingAnnotation({ viewId, center = [0.5, 0.5], labelOffset = [18, 16], symbol = 'position', tolerance = 0.1, datum = 'A' } = {}) {
  return {
    id: createId('drawing-annotation'),
    type: 'feature-control-frame',
    viewId,
    center: normalizedPoint(center),
    labelOffset: [Number(labelOffset?.[0]) || 18, Number(labelOffset?.[1]) || 16],
    symbol: ['position', 'flatness', 'parallelism', 'perpendicularity', 'circularity'].includes(symbol) ? symbol : 'position',
    tolerance: Math.max(0.001, Math.min(100, Number(tolerance) || 0.1)),
    datum: String(datum || '').trim().toUpperCase().slice(0, 8),
  };
}

export function createBalloonDrawingAnnotation({ viewId, bodyId = '', center = [0.5, 0.5], labelOffset = [16, -16], itemNumber = 1 } = {}) {
  return {
    id: createId('drawing-annotation'),
    type: 'balloon',
    viewId,
    bodyId: String(bodyId || ''),
    center: normalizedPoint(center),
    labelOffset: [Number(labelOffset?.[0]) || 16, Number(labelOffset?.[1]) || -16],
    itemNumber: Math.max(1, Math.min(999, Math.trunc(Number(itemNumber) || 1))),
  };
}

export function createDrawingTable({ type = 'bom', viewId = '', x, y, sheet } = {}) {
  const page = pageDimensions(sheet?.pageSize, sheet?.orientation);
  const normalizedType = type === 'hole-table' ? 'hole-table' : 'bom';
  const width = normalizedType === 'bom' ? 86 : 69;
  return {
    id: createId('drawing-table'),
    type: normalizedType,
    ...(normalizedType === 'hole-table' ? { viewId } : {}),
    x: Number.isFinite(Number(x)) ? Number(x) : normalizedType === 'bom' ? page.width - PAGE_MARGIN - width : PAGE_MARGIN + 2,
    y: Number.isFinite(Number(y)) ? Number(y) : PAGE_MARGIN + 2,
  };
}

export function createBaseDrawingView({ bodyIds = [], orientation = 'front', scale = 1, x, y, sheet } = {}) {
  const dimensions = pageDimensions(sheet?.pageSize, sheet?.orientation);
  return {
    id: createId('drawing-view'),
    name: 'Widok bazowy',
    type: 'base',
    orientation: DRAWING_VIEW_ORIENTATIONS.includes(orientation) ? orientation : 'front',
    bodyIds: [...new Set((Array.isArray(bodyIds) ? bodyIds : []).filter((id) => typeof id === 'string' && id))],
    scale: Math.max(0.001, Math.min(1000, Number(scale) || 1)),
    x: Number.isFinite(Number(x)) ? Number(x) : dimensions.width / 2,
    y: Number.isFinite(Number(y)) ? Number(y) : (dimensions.height - TITLE_BLOCK_HEIGHT) / 2,
  };
}

function inheritedViewOptions(parentView, overrides = {}) {
  return {
    bodyIds: [...(parentView?.bodyIds || [])],
    orientation: DRAWING_VIEW_ORIENTATIONS.includes(overrides.orientation) ? overrides.orientation : parentView?.orientation || 'front',
    scale: Math.max(0.001, Math.min(1000, Number(overrides.scale) || Number(parentView?.scale) || 1)),
  };
}

export function createProjectedDrawingView({ parentView, direction = 'right', distance = 60 } = {}) {
  if (!parentView?.id) throw new Error('Widok rzutowany wymaga widoku nadrzędnego.');
  const horizontal = direction === 'right' || direction === 'left';
  const orientation = horizontal ? 'right' : 'top';
  const sign = direction === 'left' || direction === 'top' ? -1 : 1;
  return {
    id: createId('drawing-view'),
    name: 'Widok rzutowany',
    type: 'projected',
    parentViewId: parentView.id,
    projectionDirection: ['right', 'left', 'top', 'bottom'].includes(direction) ? direction : 'right',
    alignment: horizontal ? 'horizontal' : 'vertical',
    ...inheritedViewOptions(parentView, { orientation }),
    x: Number(parentView.x || 0) + (horizontal ? sign * distance : 0),
    y: Number(parentView.y || 0) + (horizontal ? 0 : sign * distance),
  };
}

export function createSectionDrawingView({ parentView, sectionAxis = 'horizontal', sectionPosition = 0.5, distance = 55 } = {}) {
  if (!parentView?.id) throw new Error('Przekrój wymaga widoku nadrzędnego.');
  const verticalCut = sectionAxis !== 'horizontal';
  return {
    id: createId('drawing-view'),
    name: 'Przekrój A-A',
    type: 'section',
    parentViewId: parentView.id,
    sectionAxis: verticalCut ? 'vertical' : 'horizontal',
    sectionPosition: Math.max(0.05, Math.min(0.95, Number(sectionPosition) || 0.5)),
    alignment: verticalCut ? 'horizontal' : 'vertical',
    hatchSpacing: 4,
    ...inheritedViewOptions(parentView),
    x: Number(parentView.x || 0) + (verticalCut ? distance : 0),
    y: Number(parentView.y || 0) + (verticalCut ? 0 : distance),
  };
}

export function createDetailDrawingView({ parentView, center = [0.25, 0.25], radius = 0.1, magnification = 2, distance = 65 } = {}) {
  if (!parentView?.id) throw new Error('Detal wymaga widoku nadrzędnego.');
  return {
    id: createId('drawing-view'),
    name: 'Detal A',
    type: 'detail',
    parentViewId: parentView.id,
    alignment: 'free',
    detailCenter: [
      Math.max(0, Math.min(1, Number(center?.[0]) || 0.5)),
      Math.max(0, Math.min(1, Number(center?.[1]) || 0.5)),
    ],
    detailRadius: Math.max(0.05, Math.min(0.5, Number(radius) || 0.25)),
    magnification: Math.max(1.1, Math.min(10, Number(magnification) || 2)),
    ...inheritedViewOptions(parentView, { scale: (Number(parentView.scale) || 1) * Math.max(1.1, Number(magnification) || 2) }),
    x: Number(parentView.x || 0) - distance,
    y: Number(parentView.y || 0) + distance * 0.65,
  };
}

export function ensureDocumentDrawings(document) {
  if (!Array.isArray(document.drawings)) document.drawings = [];
  document.drawings = document.drawings.map((sheet) => sheet && typeof sheet === 'object' && !Array.isArray(sheet)
    ? {
      ...sheet,
      annotations: Array.isArray(sheet.annotations) ? sheet.annotations : [],
      titleBlock: sheet.titleBlock && typeof sheet.titleBlock === 'object' && !Array.isArray(sheet.titleBlock) ? sheet.titleBlock : { title: '', partNumber: '', material: '', author: '', company: '', revision: 'A' },
      revisions: Array.isArray(sheet.revisions) ? sheet.revisions : [],
      tables: Array.isArray(sheet.tables) ? sheet.tables : [],
    }
    : sheet);
  return document;
}

function viewCoordinates(point, orientation) {
  const [x, y, z] = point;
  if (orientation === 'top') return [x, -y, z];
  if (orientation === 'right') return [y, -z, x];
  if (orientation === 'isometric') {
    const cosine = Math.sqrt(3) / 2;
    return [(x - y) * cosine, -(z - (x + y) * 0.5), (x + y + z) / Math.sqrt(3)];
  }
  return [x, -z, y];
}

function projectPoint(point, orientation) {
  return viewCoordinates(point, orientation).slice(0, 2);
}

function bodyLineSegments(body) {
  const lines = body?.lines;
  if (lines?.length >= 6) {
    const segments = [];
    for (let index = 0; index + 5 < lines.length; index += 6) {
      segments.push([
        [Number(lines[index]), Number(lines[index + 1]), Number(lines[index + 2])],
        [Number(lines[index + 3]), Number(lines[index + 4]), Number(lines[index + 5])],
      ]);
    }
    return segments;
  }

  const [minimum, maximum] = body?.metrics?.bounds || body?.bounds || [];
  if (!minimum || !maximum) return [];
  const corners = [
    [minimum[0], minimum[1], minimum[2]], [maximum[0], minimum[1], minimum[2]],
    [maximum[0], maximum[1], minimum[2]], [minimum[0], maximum[1], minimum[2]],
    [minimum[0], minimum[1], maximum[2]], [maximum[0], minimum[1], maximum[2]],
    [maximum[0], maximum[1], maximum[2]], [minimum[0], maximum[1], maximum[2]],
  ];
  return [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]
    .map(([first, second]) => [corners[first], corners[second]]);
}

function segmentKey(segment) {
  const points = segment.map((point) => point.map((value) => Math.round(value * 10000) / 10000).join(',')).sort();
  return points.join('|');
}

function sourceBodiesForView(view, bodies) {
  const selectedIds = new Set(view?.bodyIds || []);
  return selectedIds.size ? bodies.filter((body) => selectedIds.has(body.id)) : bodies;
}

export function inferDrawingHoleDiameter(view, bodies = []) {
  const sourceBodies = sourceBodiesForView(view, bodies);
  const cylindricalFaces = sourceBodies.flatMap((body) => (body?.topology?.faces || [])
    .map((face) => face?.descriptor)
    .filter((descriptor) => descriptor?.geometry === 'CYLINDRE' && Number(descriptor.radius) > 0));
  const internalFaces = cylindricalFaces.filter((descriptor) => String(descriptor.orientation).toUpperCase().includes('REVERSED'));
  const cylindricalRadii = (internalFaces.length ? internalFaces : cylindricalFaces).map((descriptor) => Number(descriptor.radius));
  if (cylindricalRadii.length) return Math.min(...cylindricalRadii) * 2;
  const fallbackRadii = sourceBodies.map((body) => Number(body?.metrics?.minimumRadius)).filter((radius) => radius > 0);
  return fallbackRadii.length ? Math.min(...fallbackRadii) * 2 : null;
}

function pointFromBuffer(buffer, index) {
  return [Number(buffer[index * 3]), Number(buffer[index * 3 + 1]), Number(buffer[index * 3 + 2])];
}

function sectionSegments(view, bodies) {
  const sourceBodies = sourceBodiesForView(view, bodies);
  const coordinates = sourceBodies.flatMap((body) => {
    const bounds = body?.metrics?.bounds || body?.bounds;
    return bounds ? [viewCoordinates(bounds[0], view.orientation), viewCoordinates(bounds[1], view.orientation)] : [];
  });
  if (!coordinates.length) return [];
  const depths = coordinates.map((point) => point[2]);
  const depthMin = Math.min(...depths);
  const depthMax = Math.max(...depths);
  const planeDepth = depthMin + (depthMax - depthMin) * Math.max(0.05, Math.min(0.95, Number(view.sectionPosition) || 0.5));
  const segments = [];
  const seen = new Set();
  const epsilon = Math.max(1e-7, Math.abs(depthMax - depthMin) * 1e-7);

  for (const body of sourceBodies) {
    if (!body?.vertices?.length || !body?.triangles?.length) continue;
    for (let offset = 0; offset + 2 < body.triangles.length; offset += 3) {
      const triangle = [0, 1, 2].map((index) => viewCoordinates(pointFromBuffer(body.vertices, body.triangles[offset + index]), view.orientation));
      const intersections = [];
      for (const [firstIndex, secondIndex] of [[0, 1], [1, 2], [2, 0]]) {
        const first = triangle[firstIndex];
        const second = triangle[secondIndex];
        const firstDistance = first[2] - planeDepth;
        const secondDistance = second[2] - planeDepth;
        if (Math.abs(firstDistance) <= epsilon) intersections.push(first.slice(0, 2));
        if (firstDistance * secondDistance < -epsilon * epsilon) {
          const ratio = firstDistance / (firstDistance - secondDistance);
          intersections.push([
            first[0] + (second[0] - first[0]) * ratio,
            first[1] + (second[1] - first[1]) * ratio,
          ]);
        }
      }
      const unique = intersections.filter((point, index) => intersections.findIndex((candidate) => Math.hypot(candidate[0] - point[0], candidate[1] - point[1]) <= epsilon) === index);
      if (unique.length < 2) continue;
      const segment = [unique[0], unique[1]];
      const key = segmentKey(segment);
      if (!seen.has(key)) {
        seen.add(key);
        segments.push(segment);
      }
    }
  }
  return segments;
}

function clipSegmentToCircle(segment, center, radius) {
  const [first, second] = segment;
  const dx = second[0] - first[0];
  const dy = second[1] - first[1];
  const fx = first[0] - center[0];
  const fy = first[1] - center[1];
  const a = dx * dx + dy * dy;
  if (a <= 1e-12) return Math.hypot(fx, fy) <= radius ? segment : null;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const discriminant = b * b - 4 * a * c;
  const candidates = [0, 1];
  if (discriminant >= 0) {
    const root = Math.sqrt(discriminant);
    candidates.push((-b - root) / (2 * a), (-b + root) / (2 * a));
  }
  const inside = candidates.filter((value) => value >= 0 && value <= 1).sort((left, right) => left - right)
    .filter((value) => {
      const x = first[0] + dx * value - center[0];
      const y = first[1] + dy * value - center[1];
      return x * x + y * y <= radius * radius + 1e-7;
    });
  if (inside.length < 2) return null;
  const start = inside[0];
  const end = inside.at(-1);
  return [[first[0] + dx * start, first[1] + dy * start], [first[0] + dx * end, first[1] + dy * end]];
}

export function projectDrawingView(view, bodies = []) {
  const sourceBodies = sourceBodiesForView(view, bodies);
  const projected = [];
  const seen = new Set();
  for (const body of sourceBodies) {
    for (const segment of bodyLineSegments(body)) {
      const candidate = segment.map((point) => projectPoint(point, view?.orientation || 'front'));
      const key = segmentKey(candidate);
      if (seen.has(key)) continue;
      seen.add(key);
      projected.push(candidate);
    }
  }
  if (!projected.length) return { segments: [], bounds: [[0, 0], [0, 0]], width: 0, height: 0 };
  const points = projected.flat();
  const minimum = [Math.min(...points.map((point) => point[0])), Math.min(...points.map((point) => point[1]))];
  const maximum = [Math.max(...points.map((point) => point[0])), Math.max(...points.map((point) => point[1]))];
  return {
    segments: projected,
    bounds: [minimum, maximum],
    width: maximum[0] - minimum[0],
    height: maximum[1] - minimum[1],
  };
}

function projectionBounds(segments) {
  if (!segments.length) return { segments: [], bounds: [[0, 0], [0, 0]], width: 0, height: 0 };
  const points = segments.flat();
  const minimum = [Math.min(...points.map((point) => point[0])), Math.min(...points.map((point) => point[1]))];
  const maximum = [Math.max(...points.map((point) => point[0])), Math.max(...points.map((point) => point[1]))];
  return { segments, bounds: [minimum, maximum], width: maximum[0] - minimum[0], height: maximum[1] - minimum[1] };
}

function projectionForView(view, bodies) {
  if (view.type === 'section') {
    const section = sectionSegments(view, bodies);
    if (section.length) return projectionBounds(section);
  }
  const projection = projectDrawingView(view, bodies);
  if (view.type !== 'detail' || !projection.segments.length) return projection;
  const [minimum] = projection.bounds;
  const center = [
    minimum[0] + projection.width * Math.max(0, Math.min(1, Number(view.detailCenter?.[0]) || 0.5)),
    minimum[1] + projection.height * Math.max(0, Math.min(1, Number(view.detailCenter?.[1]) || 0.5)),
  ];
  const radius = Math.max(projection.width, projection.height) * Math.max(0.05, Math.min(0.5, Number(view.detailRadius) || 0.25));
  return { ...projectionBounds(projection.segments.map((segment) => clipSegmentToCircle(segment, center, radius)).filter(Boolean)), detailCenter: center, detailRadiusModel: radius };
}

function sectionHatchSegments(projection, spacing = 4) {
  if (!projection.segments.length) return [];
  const safeSpacing = Math.max(1, Math.min(20, Number(spacing) || 4));
  const [minimum, maximum] = projection.bounds;
  const start = Math.floor((minimum[1] - maximum[0]) / safeSpacing) * safeSpacing;
  const end = Math.ceil((maximum[1] - minimum[0]) / safeSpacing) * safeSpacing;
  const hatches = [];
  for (let constant = start; constant <= end; constant += safeSpacing) {
    const intersections = [];
    for (const [first, second] of projection.segments) {
      const firstValue = first[1] - first[0] - constant;
      const secondValue = second[1] - second[0] - constant;
      if ((firstValue < 0 && secondValue >= 0) || (secondValue < 0 && firstValue >= 0)) {
        const ratio = firstValue / (firstValue - secondValue);
        intersections.push([first[0] + (second[0] - first[0]) * ratio, first[1] + (second[1] - first[1]) * ratio]);
      }
    }
    intersections.sort((left, right) => left[0] - right[0]);
    for (let index = 0; index + 1 < intersections.length; index += 2) hatches.push([intersections[index], intersections[index + 1]]);
  }
  return hatches;
}

function projectedOrientation(parentOrientation, direction) {
  const horizontal = direction === 'left' || direction === 'right';
  if (parentOrientation === 'top') return horizontal ? 'right' : 'front';
  if (parentOrientation === 'right') return horizontal ? 'front' : 'top';
  return horizontal ? 'right' : 'top';
}

export function recommendedDrawingScale(sheet, bodies = [], orientation = 'front') {
  const dimensions = pageDimensions(sheet?.pageSize, sheet?.orientation);
  const projection = projectDrawingView({ orientation }, bodies);
  if (!projection.width && !projection.height) return 1;
  const usableWidth = dimensions.width - PAGE_MARGIN * 2;
  const usableHeight = dimensions.height - TITLE_BLOCK_HEIGHT - PAGE_MARGIN * 2;
  const fit = Math.min(
    projection.width ? usableWidth / projection.width : Infinity,
    projection.height ? usableHeight / projection.height : Infinity,
  );
  const standardScales = [20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01];
  return standardScales.find((scale) => scale <= fit) || Math.max(0.001, fit);
}

function dimensionText(value, annotation) {
  const precision = Math.max(0, Math.min(4, Math.trunc(Number(annotation.precision) || 0)));
  const main = Number(value || 0).toFixed(precision);
  const upper = Number(annotation.upperTolerance || 0).toFixed(precision);
  const lower = Number(annotation.lowerTolerance || 0).toFixed(precision);
  if (annotation.toleranceMode === 'symmetric' && Number(annotation.upperTolerance) > 0) return `${main} ±${upper}`;
  if (annotation.toleranceMode === 'deviation' && (Number(annotation.upperTolerance) > 0 || Number(annotation.lowerTolerance) > 0)) return `${main} +${upper}/−${lower}`;
  return main;
}

function arrowSegments(point, direction, size = 2.4) {
  const perpendicular = [-direction[1], direction[0]];
  return [
    [point, [point[0] + direction[0] * size + perpendicular[0] * size * 0.45, point[1] + direction[1] * size + perpendicular[1] * size * 0.45]],
    [point, [point[0] + direction[0] * size - perpendicular[0] * size * 0.45, point[1] + direction[1] * size - perpendicular[1] * size * 0.45]],
  ];
}

function renderedAnnotation(source, view, bodies) {
  if (!view) return null;
  const halfWidth = Math.max(0.01, view.modelWidth * view.scale / 2);
  const halfHeight = Math.max(0.01, view.modelHeight * view.scale / 2);
  if (source.type === 'linear-dimension') {
    const vertical = source.axis === 'vertical';
    const offset = Math.max(-100, Math.min(100, Number(source.offset) || 10));
    if (vertical) {
      const x = view.x + halfWidth + offset;
      const top = [x, view.y - halfHeight];
      const bottom = [x, view.y + halfHeight];
      return { ...source, value: view.modelHeight, text: dimensionText(view.modelHeight, source), textX: x + 2.2, textY: view.y, textRotation: -90, segments: [
        [[view.x + halfWidth, view.y - halfHeight], [x + 1.5, view.y - halfHeight]],
        [[view.x + halfWidth, view.y + halfHeight], [x + 1.5, view.y + halfHeight]],
        [top, bottom],
        ...arrowSegments(top, [0, 1]), ...arrowSegments(bottom, [0, -1]),
      ] };
    }
    const y = view.y + halfHeight + offset;
    const left = [view.x - halfWidth, y];
    const right = [view.x + halfWidth, y];
    return { ...source, value: view.modelWidth, text: dimensionText(view.modelWidth, source), textX: view.x, textY: y - 1.6, textRotation: 0, segments: [
      [[view.x - halfWidth, view.y + halfHeight], [view.x - halfWidth, y + 1.5]],
      [[view.x + halfWidth, view.y + halfHeight], [view.x + halfWidth, y + 1.5]],
      [left, right],
      ...arrowSegments(left, [1, 0]), ...arrowSegments(right, [-1, 0]),
    ] };
  }
  if (source.type === 'centerline') {
    const vertical = source.axis === 'vertical';
    const normalizedOffset = Math.max(-1, Math.min(1, Number(source.offset) || 0));
    return { ...source, segments: vertical
      ? [[[view.x + halfWidth * normalizedOffset, view.y - halfHeight - 4], [view.x + halfWidth * normalizedOffset, view.y + halfHeight + 4]]]
      : [[[view.x - halfWidth - 4, view.y + halfHeight * normalizedOffset], [view.x + halfWidth + 4, view.y + halfHeight * normalizedOffset]]] };
  }
  const center = normalizedPoint(source.center);
  const x = view.x + (center[0] - 0.5) * halfWidth * 2;
  const y = view.y + (center[1] - 0.5) * halfHeight * 2;
  if (source.type === 'center-mark') {
    const size = Math.max(2, Math.min(20, Number(source.size) || 5));
    return { ...source, x, y, segments: [[[x - size, y], [x + size, y]], [[x, y - size], [x, y + size]]] };
  }
  if (source.type === 'hole-note') {
    const modelDiameter = inferDrawingHoleDiameter(view, bodies);
    const diameter = source.diameterSource === 'manual' ? Number(source.diameter) : modelDiameter;
    const labelX = x + (Number(source.labelOffset?.[0]) || 18);
    const labelY = y + (Number(source.labelOffset?.[1]) || -12);
    const precision = Math.max(0, Math.min(4, Math.trunc(Number(source.precision) || 0)));
    const prefix = Number(source.quantity) > 1 ? `${Math.trunc(Number(source.quantity))}× ` : '';
    const text = source.noteMode === 'thread'
      ? `${prefix}${String(source.threadDesignation || 'M8×1.25')} - ${String(source.threadClass || '6H')}${source.through === false ? '' : ' THRU'}`
      : diameter > 0 ? `${prefix}⌀${diameter.toFixed(precision)}${source.through === false ? '' : ' THRU'}` : `${prefix}⌀—${source.through === false ? '' : ' THRU'}`;
    return { ...source, diameter: diameter || 0, text, textX: labelX, textY: labelY, segments: [[[x, y], [labelX - 2, labelY]], [[labelX - 2, labelY], [labelX + Math.max(14, text.length * 1.7), labelY]]] };
  }
  if (source.type === 'feature-control-frame') {
    const symbols = { position: '⌖', flatness: '⏥', parallelism: '∥', perpendicularity: '⊥', circularity: '○' };
    const labelX = x + (Number(source.labelOffset?.[0]) || 18);
    const labelY = y + (Number(source.labelOffset?.[1]) || 16);
    const cells = [symbols[source.symbol] || '⌖', `⌀${Number(source.tolerance || 0.1).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}`, String(source.datum || '').toUpperCase()].filter(Boolean);
    const cellWidth = 11;
    return { ...source, cells, frame: { x: labelX, y: labelY - 4, width: cells.length * cellWidth, height: 6, cellWidth }, segments: [[[x, y], [labelX, labelY - 1]]] };
  }
  if (source.type === 'balloon') {
    const labelX = x + (Number(source.labelOffset?.[0]) || 16);
    const labelY = y + (Number(source.labelOffset?.[1]) || -16);
    return { ...source, text: String(source.itemNumber || 1), textX: labelX, textY: labelY + 1, circle: { x: labelX, y: labelY, radius: 4.2 }, segments: [[[x, y], [labelX - 3, labelY + 3]]] };
  }
  return null;
}

function bomRows(bodies, components, componentInstances = []) {
  if (components?.length) return componentBomEntries(components, componentInstances).map((component, index) => {
    const ownedBodies = bodies.filter((body) => (component.bodyIds || []).includes(body.id));
    return [String(index + 1), component.partNumber || `C-${String(index + 1).padStart(3, '0')}`, component.name || `Komponent ${index + 1}`, String(component.effectiveQuantity || 1), component.material || '—', ownedBodies.map((body) => body.id)];
  });
  const groups = new Map();
  bodies.forEach((body) => {
    const key = `${body.name || body.id}|${body.representation || 'brep'}`;
    const group = groups.get(key) || { body, quantity: 0, bodyIds: [] };
    group.quantity += 1;
    group.bodyIds.push(body.id);
    groups.set(key, group);
  });
  return [...groups.values()].map(({ body, quantity, bodyIds }, index) => [String(index + 1), body.partNumber || `P-${String(index + 1).padStart(3, '0')}`, body.name || `Część ${index + 1}`, String(quantity), body.material || '—', bodyIds]);
}

export function drawingBomItemNumber(bodyId, bodies = [], components = [], componentInstances = []) {
  const index = bomRows(bodies, components, componentInstances).findIndex((row) => row.at(-1).includes(bodyId));
  return index < 0 ? null : index + 1;
}

function fitDrawingTableCell(value, width) {
  const text = String(value ?? '');
  const maximumLength = Math.max(2, Math.floor((Number(width) - 2) / 1.25));
  return text.length <= maximumLength ? text : `${text.slice(0, maximumLength - 1)}…`;
}

function holeTableRows(view, bodies) {
  const sourceBodies = sourceBodiesForView(view, bodies);
  const manufacturingHoles = sourceBodies.flatMap((body) => body?.manufacturingHoles || []);
  if (manufacturingHoles.length) {
    return manufacturingHoles.map((hole, index) => {
      const diameter = `⌀${Number(Number(hole.diameter).toFixed(3))}`;
      if (hole.holeApplication === 'tapped' && hole.threadDesignation) {
        return [String(index + 1), `${hole.threadDesignation} - ${hole.threadClass || '6H'}`, String(hole.quantity || 1), `Gwint wewnętrzny · wiertło ${diameter}${hole.through ? ' · przelotowy' : ''}`];
      }
      if (hole.holeStandard === 'iso-273') {
        const series = { fine: 'ciasna', medium: 'średnia', coarse: 'luźna' }[hole.clearanceClass] || hole.clearanceClass;
        return [String(index + 1), diameter, String(hole.quantity || 1), `ISO 273 · ${hole.standardSize} · seria ${series}${hole.through ? ' · przelotowy' : ''}`];
      }
      return [String(index + 1), diameter, String(hole.quantity || 1), `${hole.holeType === 'simple' ? 'Otwór walcowy' : hole.holeType}${hole.through ? ' · przelotowy' : ''}`];
    });
  }
  const descriptors = sourceBodies.flatMap((body) => (body?.topology?.faces || []).map((face) => ({ ...face?.descriptor, bodyId: body.id })))
    .filter((descriptor) => descriptor.geometry === 'CYLINDRE' && Number(descriptor.radius) > 0);
  const internal = descriptors.filter((descriptor) => String(descriptor.orientation).toUpperCase().includes('REVERSED'));
  const inferred = sourceBodies.flatMap((body) => Number(body?.metrics?.minimumRadius) > 0
    ? [{ geometry: 'CYLINDRE', radius: Number(body.metrics.minimumRadius), bodyId: body.id }]
    : []);
  const holes = internal.length ? internal : descriptors.length ? descriptors : inferred;
  const groups = new Map();
  holes.forEach((descriptor) => {
    const diameter = Number(descriptor.radius) * 2;
    const key = diameter.toFixed(4);
    const group = groups.get(key) || { diameter, count: 0 };
    group.count += 1;
    groups.set(key, group);
  });
  return [...groups.values()].sort((left, right) => left.diameter - right.diameter)
    .map((group, index) => [String(index + 1), `⌀${Number(group.diameter.toFixed(3))}`, String(group.count), 'Otwór walcowy']);
}

function renderedTable(source, resolvedViews, bodies, components, componentInstances) {
  const bom = source.type === 'bom';
  const columns = bom
    ? [{ label: 'Poz.', width: 8 }, { label: 'Nr części', width: 20 }, { label: 'Nazwa', width: 30 }, { label: 'Ilość', width: 8 }, { label: 'Materiał', width: 20 }]
    : [{ label: 'Poz.', width: 8 }, { label: 'Wymiar', width: 22 }, { label: 'Ilość', width: 10 }, { label: 'Opis', width: 68 }];
  const rawRows = bom ? bomRows(bodies, components, componentInstances) : holeTableRows(resolvedViews.get(source.viewId), bodies);
  return {
    ...source,
    title: bom ? 'ZESTAWIENIE CZĘŚCI' : 'TABELA OTWORÓW',
    columns,
    rows: rawRows.map((row) => row.slice(0, columns.length).map((cell, index) => fitDrawingTableCell(cell, columns[index].width))),
    rowMetadata: bom ? rawRows.map((row) => ({ bodyIds: row.at(-1) })) : [],
    width: columns.reduce((sum, column) => sum + column.width, 0),
    rowHeight: 5,
  };
}

export function drawingSheetScene(sheet, bodies = [], { components = [], componentInstances = [] } = {}) {
  const page = pageDimensions(sheet?.pageSize, sheet?.orientation);
  const resolved = new Map();
  const views = (sheet?.views || []).map((sourceView) => {
    const parent = resolved.get(sourceView.parentViewId);
    const view = { ...sourceView };
    if (parent) {
      view.bodyIds = [...parent.bodyIds];
      if (view.type === 'projected') view.orientation = projectedOrientation(parent.orientation, view.projectionDirection);
      else view.orientation = parent.orientation;
      view.scale = view.type === 'detail' ? parent.scale * Math.max(1.1, Number(view.magnification) || 2) : parent.scale;
      if (view.alignment === 'horizontal') view.y = parent.y;
      if (view.alignment === 'vertical') view.x = parent.x;
    }
    const projection = projectionForView(view, bodies);
    const center = [
      (projection.bounds[0][0] + projection.bounds[1][0]) / 2,
      (projection.bounds[0][1] + projection.bounds[1][1]) / 2,
    ];
    const scale = Math.max(0.001, Number(view.scale) || 1);
    const transformSegment = ([first, second]) => [
      [view.x + (first[0] - center[0]) * scale, view.y + (first[1] - center[1]) * scale],
      [view.x + (second[0] - center[0]) * scale, view.y + (second[1] - center[1]) * scale],
    ];
    const rendered = {
      ...view,
      segments: projection.segments.map(transformSegment),
      hatchSegments: view.type === 'section' ? sectionHatchSegments(projection, Number(view.hatchSpacing) || 4).map(transformSegment) : [],
      modelWidth: projection.width,
      modelHeight: projection.height,
      detailRadiusSheet: view.type === 'detail' ? Math.max(5, Number(projection.detailRadiusModel || 0) * scale) : 0,
    };
    resolved.set(view.id, rendered);
    return rendered;
  });
  const viewAnnotations = views.flatMap((view) => {
    const parent = resolved.get(view.parentViewId);
    if (!parent) return [];
    if (view.type === 'section') {
      const vertical = view.sectionAxis !== 'horizontal';
      const halfWidth = Math.max(12, parent.modelWidth * parent.scale / 2);
      const halfHeight = Math.max(12, parent.modelHeight * parent.scale / 2);
      const ratio = Math.max(0.05, Math.min(0.95, Number(view.sectionPosition) || 0.5));
      const position = vertical ? parent.x - halfWidth + halfWidth * 2 * ratio : parent.y - halfHeight + halfHeight * 2 * ratio;
      return [{ type: 'section-line', ownerViewId: view.id, parentViewId: parent.id, label: 'A', x1: vertical ? position : parent.x - halfWidth, y1: vertical ? parent.y - halfHeight : position, x2: vertical ? position : parent.x + halfWidth, y2: vertical ? parent.y + halfHeight : position }];
    }
    if (view.type === 'detail') {
      const ratioX = Math.max(0, Math.min(1, Number(view.detailCenter?.[0]) || 0.5));
      const ratioY = Math.max(0, Math.min(1, Number(view.detailCenter?.[1]) || 0.5));
      const radius = Math.min(18, Math.max(5, Math.max(parent.modelWidth, parent.modelHeight) * parent.scale * Math.max(0.05, Math.min(0.5, Number(view.detailRadius) || 0.25))));
      return [{ type: 'detail-callout', ownerViewId: view.id, parentViewId: parent.id, label: 'A', x: parent.x + (ratioX - 0.5) * parent.modelWidth * parent.scale, y: parent.y + (ratioY - 0.5) * parent.modelHeight * parent.scale, radius }];
    }
    return [];
  });
  const annotations = [...viewAnnotations, ...(sheet?.annotations || []).map((annotation) => renderedAnnotation(annotation, resolved.get(annotation.viewId), bodies)).filter(Boolean)];
  const tables = (sheet?.tables || []).map((table) => renderedTable(table, resolved, bodies, components, componentInstances));
  return { ...page, margin: PAGE_MARGIN, titleBlockHeight: TITLE_BLOCK_HEIGHT, views, annotations, tables };
}

export function formatDrawingScale(scale) {
  const normalized = Math.max(0.001, Number(scale) || 1);
  const format = (value) => Number(value.toFixed(4)).toLocaleString('en-US', { maximumFractionDigits: 4 });
  return normalized >= 1 ? `${format(normalized)}:1` : `1:${format(1 / normalized)}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

export function drawingSheetHtml(sheet, bodies = [], { documentName = 'Projekt', author = '', revision = 'A', components = [], componentInstances = [] } = {}) {
  const scene = drawingSheetScene(sheet, bodies, { components, componentInstances });
  const line = ([first, second], className = '') => `<line${className ? ` class="${className}"` : ''} x1="${first[0]}" y1="${first[1]}" x2="${second[0]}" y2="${second[1]}" />`;
  const lineMarkup = scene.views.map((view) => `<g class="geometry ${escapeHtml(view.type)}">${view.segments.map((segment) => line(segment)).join('')}${view.hatchSegments.map((segment) => line(segment, 'hatch')).join('')}${view.type === 'detail' ? `<circle class="detail-border" cx="${view.x}" cy="${view.y}" r="${Math.max(5, view.detailRadiusSheet)}" />` : ''}</g>`).join('');
  const annotationMarkup = scene.annotations.map((annotation) => {
    if (annotation.type === 'section-line') return `<g class="annotation section-callout"><line x1="${annotation.x1}" y1="${annotation.y1}" x2="${annotation.x2}" y2="${annotation.y2}"/><text x="${annotation.x1}" y="${annotation.y1 - 2}">${escapeHtml(annotation.label)}</text><text x="${annotation.x2}" y="${annotation.y2 - 2}">${escapeHtml(annotation.label)}</text></g>`;
    if (annotation.type === 'detail-callout') return `<g class="annotation detail-callout"><circle cx="${annotation.x}" cy="${annotation.y}" r="${annotation.radius}"/><text x="${annotation.x + annotation.radius + 2}" y="${annotation.y}">${escapeHtml(annotation.label)}</text></g>`;
    const segments = (annotation.segments || []).map((segment) => line(segment)).join('');
    const text = annotation.text ? `<text x="${annotation.textX}" y="${annotation.textY}"${annotation.textRotation ? ` transform="rotate(${annotation.textRotation} ${annotation.textX} ${annotation.textY})"` : ''}>${escapeHtml(annotation.text)}</text>` : '';
    const frame = annotation.frame ? `<rect x="${annotation.frame.x}" y="${annotation.frame.y}" width="${annotation.frame.width}" height="${annotation.frame.height}"/>${annotation.cells.slice(1).map((_, index) => `<line x1="${annotation.frame.x + (index + 1) * annotation.frame.cellWidth}" y1="${annotation.frame.y}" x2="${annotation.frame.x + (index + 1) * annotation.frame.cellWidth}" y2="${annotation.frame.y + annotation.frame.height}"/>`).join('')}${annotation.cells.map((cell, index) => `<text x="${annotation.frame.x + index * annotation.frame.cellWidth + annotation.frame.cellWidth / 2}" y="${annotation.frame.y + 4.2}" text-anchor="middle">${escapeHtml(cell)}</text>`).join('')}` : '';
    const circle = annotation.circle ? `<circle cx="${annotation.circle.x}" cy="${annotation.circle.y}" r="${annotation.circle.radius}"/>` : '';
    return `<g class="annotation drawing-${escapeHtml(annotation.type)}">${segments}${text}${frame}${circle}</g>`;
  }).join('');
  const tableMarkup = scene.tables.map((table) => {
    const headerY = table.y + 5;
    const columnStarts = table.columns.reduce((values, column) => [...values, values.at(-1) + column.width], [table.x]);
    const height = 10 + table.rows.length * table.rowHeight;
    const horizontal = Array.from({ length: table.rows.length + 2 }, (_, index) => `<line x1="${table.x}" y1="${table.y + index * table.rowHeight}" x2="${table.x + table.width}" y2="${table.y + index * table.rowHeight}"/>`).join('');
    const vertical = columnStarts.map((x) => `<line x1="${x}" y1="${headerY}" x2="${x}" y2="${table.y + height}"/>`).join('');
    const headers = table.columns.map((column, index) => `<text x="${columnStarts[index] + 1}" y="${table.y + 8.5}">${escapeHtml(column.label)}</text>`).join('');
    const rows = table.rows.flatMap((row, rowIndex) => row.map((cell, columnIndex) => `<text x="${columnStarts[columnIndex] + 1}" y="${table.y + 13.5 + rowIndex * table.rowHeight}">${escapeHtml(cell)}</text>`)).join('');
    return `<g class="drawing-table"><rect x="${table.x}" y="${table.y}" width="${table.width}" height="${height}"/>${horizontal}${vertical}<text class="table-title" x="${table.x + table.width / 2}" y="${table.y + 3.7}" text-anchor="middle">${escapeHtml(table.title)}</text>${headers}${rows}</g>`;
  }).join('');
  const viewLabels = scene.views.map((view) => `<text x="${view.x}" y="${Math.min(scene.height - scene.titleBlockHeight - 3, view.y + (view.modelHeight * view.scale) / 2 + 6)}" text-anchor="middle">${escapeHtml(view.name)} · ${formatDrawingScale(view.scale)}</text>`).join('');
  const titleTop = scene.height - scene.titleBlockHeight;
  const block = sheet?.titleBlock || {};
  const latestRevision = sheet?.revisions?.at(-1);
  const revisionValue = latestRevision?.code || block.revision || revision;
  const revisionRows = (sheet?.revisions || []).slice(-3).map((item, index) => `<text x="${scene.width - 191}" y="${titleTop + 4 + index * 4}">${escapeHtml(item.code)} · ${escapeHtml(item.date)}</text>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(sheet?.name || 'Arkusz')}</title><style>@page{size:${escapeHtml(sheet?.pageSize || 'A4')} ${escapeHtml(sheet?.orientation || 'landscape')};margin:0}*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:white;font-family:Arial,sans-serif}svg{display:block;width:${scene.width}mm;height:${scene.height}mm}.border,.title,.annotation rect,.drawing-table rect{fill:none;stroke:#111;stroke-width:.35}.geometry{fill:none;stroke:#111;stroke-width:.28;stroke-linecap:round;stroke-linejoin:round}.geometry.section{stroke-width:.5}.geometry .hatch{stroke-width:.16}.detail-border,.annotation circle{fill:none;stroke:#111;stroke-width:.25}.annotation line,.drawing-table line{stroke:#111;stroke-width:.25}.section-callout line,.detail-callout line,.drawing-centerline line,.drawing-center-mark line{stroke-dasharray:3 1}.drawing-linear-dimension line,.drawing-hole-note line{stroke-width:.2}.annotation text{font-weight:700}text{fill:#111;font-size:3px}.project{font-size:5px;font-weight:700}.drawing-table text{font-size:2.3px}.drawing-table .table-title{font-weight:700}</style></head><body><svg viewBox="0 0 ${scene.width} ${scene.height}" xmlns="http://www.w3.org/2000/svg"><rect class="border" x="${scene.margin}" y="${scene.margin}" width="${scene.width - scene.margin * 2}" height="${scene.height - scene.margin * 2}"/>${lineMarkup}${annotationMarkup}${tableMarkup}${viewLabels}<g class="title"><rect x="${scene.width - 192}" y="${titleTop}" width="60" height="14"/><rect x="${scene.width - 132}" y="${titleTop}" width="122" height="14"/><line x1="${scene.width - 55}" y1="${titleTop}" x2="${scene.width - 55}" y2="${scene.height - 10}"/><line x1="${scene.width - 28}" y1="${titleTop}" x2="${scene.width - 28}" y2="${scene.height - 10}"/></g>${revisionRows}<text class="project" x="${scene.width - 129}" y="${titleTop + 5}">${escapeHtml(block.title || documentName)}</text><text x="${scene.width - 129}" y="${titleTop + 9}">${escapeHtml(block.partNumber || sheet?.name || 'Arkusz')} · ${escapeHtml(block.material || '—')}</text><text x="${scene.width - 129}" y="${titleTop + 12.5}">${escapeHtml(block.company || '')}</text><text x="${scene.width - 53}" y="${titleTop + 5}">Autor</text><text x="${scene.width - 53}" y="${titleTop + 11}">${escapeHtml(block.author || author || '—')}</text><text x="${scene.width - 26}" y="${titleTop + 5}">Rew.</text><text x="${scene.width - 26}" y="${titleTop + 11}">${escapeHtml(revisionValue)}</text></svg></body></html>`;
}

function dxfNumber(value) {
  return Number(Number(value || 0).toFixed(6));
}

function dxfText(value) {
  return String(value || '').replaceAll('⌀', '%%c').replaceAll('±', '%%p').replaceAll('×', 'x').replaceAll('−', '-').replace(/[\r\n]/g, ' ');
}

export function drawingSheetDxf(sheet, bodies = [], { components = [], componentInstances = [] } = {}) {
  const scene = drawingSheetScene(sheet, bodies, { components, componentInstances });
  const entities = [];
  const addLine = ([first, second], layer = 'GEOMETRY') => entities.push(`0\nLINE\n8\n${layer}\n10\n${dxfNumber(first[0])}\n20\n${dxfNumber(scene.height - first[1])}\n30\n0\n11\n${dxfNumber(second[0])}\n21\n${dxfNumber(scene.height - second[1])}\n31\n0`);
  const addCircle = (x, y, radius, layer = 'ANNOTATION') => entities.push(`0\nCIRCLE\n8\n${layer}\n10\n${dxfNumber(x)}\n20\n${dxfNumber(scene.height - y)}\n30\n0\n40\n${dxfNumber(radius)}`);
  const addText = (value, x, y, height = 3, layer = 'TEXT') => entities.push(`0\nTEXT\n8\n${layer}\n10\n${dxfNumber(x)}\n20\n${dxfNumber(scene.height - y)}\n30\n0\n40\n${height}\n1\n${dxfText(value)}`);
  scene.views.forEach((view) => {
    view.segments.forEach((segment) => addLine(segment));
    view.hatchSegments.forEach((segment) => addLine(segment, 'HATCH'));
    if (view.type === 'detail') addCircle(view.x, view.y, view.detailRadiusSheet, 'GEOMETRY');
    addText(`${view.name} ${formatDrawingScale(view.scale)}`, view.x, view.y + view.modelHeight * view.scale / 2 + 6);
  });
  scene.annotations.forEach((annotation) => {
    if (annotation.type === 'section-line') addLine([[annotation.x1, annotation.y1], [annotation.x2, annotation.y2]], 'ANNOTATION');
    else if (annotation.type === 'detail-callout') addCircle(annotation.x, annotation.y, annotation.radius);
    else {
      (annotation.segments || []).forEach((segment) => addLine(segment, 'ANNOTATION'));
      if (annotation.text) addText(annotation.text, annotation.textX, annotation.textY);
      if (annotation.circle) addCircle(annotation.circle.x, annotation.circle.y, annotation.circle.radius, 'BALLOON');
      if (annotation.frame) {
        const { x, y, width, height, cellWidth } = annotation.frame;
        [[[x, y], [x + width, y]], [[x + width, y], [x + width, y + height]], [[x + width, y + height], [x, y + height]], [[x, y + height], [x, y]]].forEach((segment) => addLine(segment, 'GD&T'));
        annotation.cells.slice(1).forEach((_, index) => addLine([[x + (index + 1) * cellWidth, y], [x + (index + 1) * cellWidth, y + height]], 'GD&T'));
        annotation.cells.forEach((cell, index) => addText(cell, x + index * cellWidth + 2, y + 4, 2.5, 'GD&T'));
      }
    }
  });
  scene.tables.forEach((table) => {
    const height = 10 + table.rows.length * table.rowHeight;
    const starts = table.columns.reduce((values, column) => [...values, values.at(-1) + column.width], [table.x]);
    [[[table.x, table.y], [table.x + table.width, table.y]], [[table.x + table.width, table.y], [table.x + table.width, table.y + height]], [[table.x + table.width, table.y + height], [table.x, table.y + height]], [[table.x, table.y + height], [table.x, table.y]]].forEach((segment) => addLine(segment, 'TABLE'));
    Array.from({ length: table.rows.length + 1 }, (_, index) => table.y + (index + 1) * table.rowHeight).forEach((y) => addLine([[table.x, y], [table.x + table.width, y]], 'TABLE'));
    starts.slice(1, -1).forEach((x) => addLine([[x, table.y + 5], [x, table.y + height]], 'TABLE'));
    addText(table.title, table.x + 2, table.y + 3.7, 2.5, 'TABLE');
    table.columns.forEach((column, index) => addText(column.label, starts[index] + 1, table.y + 8.5, 2.2, 'TABLE'));
    table.rows.forEach((row, rowIndex) => row.forEach((cell, columnIndex) => addText(cell, starts[columnIndex] + 1, table.y + 13.5 + rowIndex * table.rowHeight, 2.2, 'TABLE')));
  });
  return `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1027\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities.join('\n')}\n0\nENDSEC\n0\nEOF\n`;
}

export function drawingPageDimensions(sheet) {
  return pageDimensions(sheet?.pageSize, sheet?.orientation);
}
