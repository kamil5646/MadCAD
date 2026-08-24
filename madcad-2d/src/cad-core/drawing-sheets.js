import { createId } from './ids.js';

export const DRAWING_PAGE_SIZES = Object.freeze({
  A4: Object.freeze({ width: 297, height: 210 }),
  A3: Object.freeze({ width: 420, height: 297 }),
});

export const DRAWING_VIEW_ORIENTATIONS = Object.freeze(['front', 'top', 'right', 'isometric']);

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

export function ensureDocumentDrawings(document) {
  if (!Array.isArray(document.drawings)) document.drawings = [];
  return document;
}

function projectPoint(point, orientation) {
  const [x, y, z] = point;
  if (orientation === 'top') return [x, -y];
  if (orientation === 'right') return [y, -z];
  if (orientation === 'isometric') {
    const cosine = Math.sqrt(3) / 2;
    return [(x - y) * cosine, -(z - (x + y) * 0.5)];
  }
  return [x, -z];
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

export function projectDrawingView(view, bodies = []) {
  const selectedIds = new Set(view?.bodyIds || []);
  const sourceBodies = selectedIds.size ? bodies.filter((body) => selectedIds.has(body.id)) : bodies;
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
  const views = (sheet?.views || []).map((view) => {
    const projection = projectDrawingView(view, bodies);
    const center = [
      (projection.bounds[0][0] + projection.bounds[1][0]) / 2,
      (projection.bounds[0][1] + projection.bounds[1][1]) / 2,
    ];
    const scale = Math.max(0.001, Number(view.scale) || 1);
    return {
      ...view,
      segments: projection.segments.map(([first, second]) => [
        [view.x + (first[0] - center[0]) * scale, view.y + (first[1] - center[1]) * scale],
        [view.x + (second[0] - center[0]) * scale, view.y + (second[1] - center[1]) * scale],
      ]),
      modelWidth: projection.width,
      modelHeight: projection.height,
    };
  });
  return { ...page, margin: PAGE_MARGIN, titleBlockHeight: TITLE_BLOCK_HEIGHT, views };
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
  const lineMarkup = scene.views.flatMap((view) => view.segments.map(([first, second]) => (
    `<line x1="${first[0]}" y1="${first[1]}" x2="${second[0]}" y2="${second[1]}" />`
  ))).join('');
  const viewLabels = scene.views.map((view) => `<text x="${view.x}" y="${Math.min(scene.height - scene.titleBlockHeight - 3, view.y + (view.modelHeight * view.scale) / 2 + 6)}" text-anchor="middle">${escapeHtml(view.name)} · ${escapeHtml(view.orientation)} · ${formatDrawingScale(view.scale)}</text>`).join('');
  const titleTop = scene.height - scene.titleBlockHeight;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(sheet?.name || 'Arkusz')}</title><style>@page{size:${escapeHtml(sheet?.pageSize || 'A4')} ${escapeHtml(sheet?.orientation || 'landscape')};margin:0}*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:white;font-family:Arial,sans-serif}svg{display:block;width:${scene.width}mm;height:${scene.height}mm}.border,.title{fill:none;stroke:#111;stroke-width:.35}.geometry{fill:none;stroke:#111;stroke-width:.28;stroke-linecap:round;stroke-linejoin:round}text{fill:#111;font-size:3px}.project{font-size:5px;font-weight:700}</style></head><body><svg viewBox="0 0 ${scene.width} ${scene.height}" xmlns="http://www.w3.org/2000/svg"><rect class="border" x="${scene.margin}" y="${scene.margin}" width="${scene.width - scene.margin * 2}" height="${scene.height - scene.margin * 2}"/><g class="geometry">${lineMarkup}</g>${viewLabels}<g class="title"><rect x="${scene.width - 132}" y="${titleTop}" width="122" height="14"/><line x1="${scene.width - 55}" y1="${titleTop}" x2="${scene.width - 55}" y2="${scene.height - 10}"/><line x1="${scene.width - 28}" y1="${titleTop}" x2="${scene.width - 28}" y2="${scene.height - 10}"/></g><text class="project" x="${scene.width - 129}" y="${titleTop + 6}">${escapeHtml(documentName)}</text><text x="${scene.width - 129}" y="${titleTop + 11}">${escapeHtml(sheet?.name || 'Arkusz')}</text><text x="${scene.width - 53}" y="${titleTop + 5}">Autor</text><text x="${scene.width - 53}" y="${titleTop + 11}">${escapeHtml(author || '—')}</text><text x="${scene.width - 26}" y="${titleTop + 5}">Rew.</text><text x="${scene.width - 26}" y="${titleTop + 11}">${escapeHtml(revision)}</text></svg></body></html>`;
}

export function drawingPageDimensions(sheet) {
  return pageDimensions(sheet?.pageSize, sheet?.orientation);
}
