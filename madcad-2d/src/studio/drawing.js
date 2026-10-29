// Standard drawing sheet: the front view with the top view below it, the side view to
// its right and an isometric view in the free corner, laid out and scaled automatically.
import {
  createBaseDrawingView, createDrawingSheet, createLinearDrawingDimension, createProjectedDrawingView, drawingPageDimensions, projectDrawingView,
} from '../cad-core/drawing-sheets.js';

export const SCALES = Object.freeze([10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01]);
export const DEFAULT_LAYOUT = Object.freeze({ top: true, right: true, isometric: true, dimensions: true, scale: 'auto' });

const MARGIN = 10;
const TITLE_BLOCK = 24;
const GAP = 26;

export function layoutOf(sheet) {
  return { ...DEFAULT_LAYOUT, ...(sheet?.layout || {}) };
}

export function createStandardSheet(document) {
  const sheet = createDrawingSheet({ name: `Arkusz ${(document.drawings?.length || 0) + 1}` });
  sheet.layout = { ...DEFAULT_LAYOUT };
  sheet.titleBlock = { ...sheet.titleBlock, title: document.name };
  return sheet;
}

function size(bodies, orientation) {
  const projection = projectDrawingView({ orientation }, bodies);
  return { width: projection.width || 0, height: projection.height || 0 };
}

// Rebuilds the views and overall dimensions of a sheet from its layout options.
export function arrangeSheet(sheet, bodies) {
  const layout = layoutOf(sheet);
  const page = drawingPageDimensions(sheet);
  const front = size(bodies, 'front');
  const side = layout.right ? size(bodies, 'right') : { width: 0, height: 0 };
  const below = layout.top ? size(bodies, 'top') : { width: 0, height: 0 };
  const iso = layout.isometric ? size(bodies, 'isometric') : { width: 0, height: 0 };
  const columnWidth = Math.max(side.width, iso.width);
  const rowHeight = Math.max(below.height, iso.height);
  const usableWidth = page.width - 2 * MARGIN;
  const usableHeight = page.height - 2 * MARGIN - TITLE_BLOCK;
  const fits = (scale) => (front.width + columnWidth) * scale + GAP * (columnWidth ? 3 : 2) <= usableWidth
    && (front.height + rowHeight) * scale + GAP * (rowHeight ? 3 : 2) <= usableHeight;
  const scale = layout.scale === 'auto' ? SCALES.find(fits) || SCALES.at(-1) : Number(layout.scale) || 1;

  const left = MARGIN + GAP + (front.width * scale) / 2;
  const upper = MARGIN + GAP + (front.height * scale) / 2;
  const secondColumn = left + ((front.width + columnWidth) * scale) / 2 + GAP;
  const secondRow = upper + ((front.height + rowHeight) * scale) / 2 + GAP;

  const base = { ...createBaseDrawingView({ orientation: 'front', scale, x: left, y: upper, sheet }), name: 'Przód' };
  const views = [base];
  if (layout.top) views.push({ ...createProjectedDrawingView({ parentView: base, direction: 'bottom', distance: secondRow - upper }), name: 'Góra' });
  if (layout.right) views.push({ ...createProjectedDrawingView({ parentView: base, direction: 'right', distance: secondColumn - left }), name: 'Bok' });
  if (layout.isometric) views.push({ ...createBaseDrawingView({ orientation: 'isometric', scale, x: secondColumn, y: secondRow, sheet }), name: 'Izometria' });

  const annotations = [];
  if (layout.dimensions) {
    // Whole millimetres print without decimals; the horizontal one sits below the view label.
    const precision = (value) => (Math.abs(value - Math.round(value)) < 1e-3 ? 0 : 1);
    annotations.push(createLinearDrawingDimension({ viewId: base.id, axis: 'horizontal', offset: 13, precision: precision(front.width) }));
    annotations.push(createLinearDrawingDimension({ viewId: base.id, axis: 'vertical', offset: 8, precision: precision(front.height) }));
    const topView = views.find((view) => view.name === 'Góra');
    if (topView) annotations.push(createLinearDrawingDimension({ viewId: topView.id, axis: 'vertical', offset: 8, precision: precision(below.height) }));
  }
  return { ...sheet, layout, views, annotations };
}

// Screen preview of the print HTML: the sheet is centred and scaled to the frame,
// while print and PDF keep the 1:1 millimetre size.
export function previewHtml(html) {
  return html.replace('</head>', '<style>@media screen{html,body{background:#1b1f24;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden}svg{width:auto!important;height:auto!important;max-width:calc(100% - 32px);max-height:calc(100% - 32px);background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.45)}}</style></head>');
}
