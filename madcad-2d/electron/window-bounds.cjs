'use strict';

function finiteInteger(value) {
  return Number.isFinite(Number(value)) ? Math.round(Number(value)) : null;
}

function normalizeArea(area) {
  if (!area || typeof area !== 'object') return null;
  const x = finiteInteger(area.x);
  const y = finiteInteger(area.y);
  const width = finiteInteger(area.width);
  const height = finiteInteger(area.height);
  return x === null || y === null || !width || !height || width < 1 || height < 1 ? null : { x, y, width, height };
}

function overlapArea(left, right) {
  const width = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const height = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  return width * height;
}

function normalizeWindowBounds(savedBounds, displays, fallback = { width: 1680, height: 980 }) {
  const areas = (Array.isArray(displays) ? displays : [])
    .map((display) => ({ area: normalizeArea(display?.workArea || display?.bounds || display), primary: Boolean(display?.primary) }))
    .filter((entry) => entry.area);
  const fallbackArea = areas.find((entry) => entry.primary)?.area || areas[0]?.area || { x: 0, y: 0, width: 1920, height: 1080 };
  const saved = normalizeArea(savedBounds);
  const targetArea = saved
    ? areas.map((entry) => ({ ...entry, overlap: overlapArea(saved, entry.area) })).sort((left, right) => right.overlap - left.overlap)[0]
    : null;
  const hasVisibleSavedBounds = Boolean(targetArea?.overlap > 0);
  const workArea = hasVisibleSavedBounds ? targetArea.area : fallbackArea;
  const requestedWidth = saved?.width || finiteInteger(fallback.width) || 1680;
  const requestedHeight = saved?.height || finiteInteger(fallback.height) || 980;
  const width = Math.min(Math.max(640, requestedWidth), workArea.width);
  const height = Math.min(Math.max(480, requestedHeight), workArea.height);
  const centeredX = workArea.x + Math.round((workArea.width - width) / 2);
  const centeredY = workArea.y + Math.round((workArea.height - height) / 2);
  const x = hasVisibleSavedBounds ? Math.min(Math.max(saved.x, workArea.x), workArea.x + workArea.width - width) : centeredX;
  const y = hasVisibleSavedBounds ? Math.min(Math.max(saved.y, workArea.y), workArea.y + workArea.height - height) : centeredY;
  return { x, y, width, height };
}

module.exports = { normalizeWindowBounds, overlapArea };
