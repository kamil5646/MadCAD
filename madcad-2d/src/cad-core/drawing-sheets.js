import { createId } from './ids.js';

export const DRAWING_PAGE_SIZES = Object.freeze({
  A4: Object.freeze({ width: 297, height: 210 }),
  A3: Object.freeze({ width: 420, height: 297 }),
});

export const DRAWING_VIEW_ORIENTATIONS = Object.freeze(['front', 'top', 'right', 'isometric']);
export const DRAWING_VIEW_TYPES = Object.freeze(['base', 'projected', 'section', 'detail']);
export const DRAWING_VIEW_ALIGNMENTS = Object.freeze(['horizontal', 'vertical', 'free']);

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

export function drawingSheetScene(sheet, bodies = []) {
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
  const annotations = views.flatMap((view) => {
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
  return { ...page, margin: PAGE_MARGIN, titleBlockHeight: TITLE_BLOCK_HEIGHT, views, annotations };
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

export function drawingSheetHtml(sheet, bodies = [], { documentName = 'Projekt', author = '', revision = 'A' } = {}) {
  const scene = drawingSheetScene(sheet, bodies);
  const line = ([first, second], className = '') => `<line${className ? ` class="${className}"` : ''} x1="${first[0]}" y1="${first[1]}" x2="${second[0]}" y2="${second[1]}" />`;
  const lineMarkup = scene.views.map((view) => `<g class="geometry ${escapeHtml(view.type)}">${view.segments.map((segment) => line(segment)).join('')}${view.hatchSegments.map((segment) => line(segment, 'hatch')).join('')}${view.type === 'detail' ? `<circle class="detail-border" cx="${view.x}" cy="${view.y}" r="${Math.max(5, view.detailRadiusSheet)}" />` : ''}</g>`).join('');
  const annotationMarkup = scene.annotations.map((annotation) => annotation.type === 'section-line'
    ? `<g class="annotation section-callout"><line x1="${annotation.x1}" y1="${annotation.y1}" x2="${annotation.x2}" y2="${annotation.y2}"/><text x="${annotation.x1}" y="${annotation.y1 - 2}">${escapeHtml(annotation.label)}</text><text x="${annotation.x2}" y="${annotation.y2 - 2}">${escapeHtml(annotation.label)}</text></g>`
    : `<g class="annotation detail-callout"><circle cx="${annotation.x}" cy="${annotation.y}" r="${annotation.radius}"/><text x="${annotation.x + annotation.radius + 2}" y="${annotation.y}">${escapeHtml(annotation.label)}</text></g>`).join('');
  const viewLabels = scene.views.map((view) => `<text x="${view.x}" y="${Math.min(scene.height - scene.titleBlockHeight - 3, view.y + (view.modelHeight * view.scale) / 2 + 6)}" text-anchor="middle">${escapeHtml(view.name)} · ${formatDrawingScale(view.scale)}</text>`).join('');
  const titleTop = scene.height - scene.titleBlockHeight;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(sheet?.name || 'Arkusz')}</title><style>@page{size:${escapeHtml(sheet?.pageSize || 'A4')} ${escapeHtml(sheet?.orientation || 'landscape')};margin:0}*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:white;font-family:Arial,sans-serif}svg{display:block;width:${scene.width}mm;height:${scene.height}mm}.border,.title{fill:none;stroke:#111;stroke-width:.35}.geometry{fill:none;stroke:#111;stroke-width:.28;stroke-linecap:round;stroke-linejoin:round}.geometry.section{stroke-width:.5}.geometry .hatch{stroke-width:.16}.detail-border,.annotation circle{fill:none;stroke:#111;stroke-width:.25}.annotation line{stroke:#111;stroke-width:.25;stroke-dasharray:3 1}.annotation text{font-weight:700}text{fill:#111;font-size:3px}.project{font-size:5px;font-weight:700}</style></head><body><svg viewBox="0 0 ${scene.width} ${scene.height}" xmlns="http://www.w3.org/2000/svg"><rect class="border" x="${scene.margin}" y="${scene.margin}" width="${scene.width - scene.margin * 2}" height="${scene.height - scene.margin * 2}"/>${lineMarkup}${annotationMarkup}${viewLabels}<g class="title"><rect x="${scene.width - 132}" y="${titleTop}" width="122" height="14"/><line x1="${scene.width - 55}" y1="${titleTop}" x2="${scene.width - 55}" y2="${scene.height - 10}"/><line x1="${scene.width - 28}" y1="${titleTop}" x2="${scene.width - 28}" y2="${scene.height - 10}"/></g><text class="project" x="${scene.width - 129}" y="${titleTop + 6}">${escapeHtml(documentName)}</text><text x="${scene.width - 129}" y="${titleTop + 11}">${escapeHtml(sheet?.name || 'Arkusz')}</text><text x="${scene.width - 53}" y="${titleTop + 5}">Autor</text><text x="${scene.width - 53}" y="${titleTop + 11}">${escapeHtml(author || '—')}</text><text x="${scene.width - 26}" y="${titleTop + 5}">Rew.</text><text x="${scene.width - 26}" y="${titleTop + 11}">${escapeHtml(revision)}</text></svg></body></html>`;
}

export function drawingPageDimensions(sheet) {
  return pageDimensions(sheet?.pageSize, sheet?.orientation);
}
