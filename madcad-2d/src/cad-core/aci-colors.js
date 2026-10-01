// AutoCAD color indices 1-9 as the app displays them (softened for the dark UI) and
// as AutoCAD defines them, so layer colors survive a DXF round trip.
export const ACI_UI_COLORS = Object.freeze({ 1: '#ff4d4d', 2: '#ffd84d', 3: '#4dff7a', 4: '#4de8ff', 5: '#4d7dff', 6: '#ff4dff', 7: '#e8eef2', 8: '#808080', 9: '#c0c0c0' });
const ACI_TRUE_COLORS = Object.freeze({ 1: [255, 0, 0], 2: [255, 255, 0], 3: [0, 255, 0], 4: [0, 255, 255], 5: [0, 0, 255], 6: [255, 0, 255], 7: [255, 255, 255], 8: [128, 128, 128], 9: [192, 192, 192] });

function rgbOf(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

// Nearest ACI index 1-9 for a hex color; unknown or missing colors map to 7 (white/black).
export function aciFromHex(hex) {
  const rgb = rgbOf(hex);
  if (!rgb) return 7;
  let best = 7;
  let bestDistance = Infinity;
  for (const index of Object.keys(ACI_UI_COLORS)) {
    for (const palette of [rgbOf(ACI_UI_COLORS[index]), ACI_TRUE_COLORS[index]]) {
      const distance = palette.reduce((total, channel, axis) => total + (channel - rgb[axis]) ** 2, 0);
      if (distance < bestDistance) { bestDistance = distance; best = Number(index); }
    }
  }
  return best;
}
