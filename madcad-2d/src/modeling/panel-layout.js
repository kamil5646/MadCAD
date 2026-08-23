const PANEL_LAYOUT_VERSION = 1;

export const DEFAULT_PANEL_LAYOUT = Object.freeze({
  commandDock: 'right',
  commandCollapsed: false,
  printCollapsed: false,
});

function positiveInteger(value, fallback) {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function panelScreenKey(screenLike = globalThis.screen) {
  const width = positiveInteger(screenLike?.availWidth, 0);
  const height = positiveInteger(screenLike?.availHeight, 0);
  const scale = Math.max(1, Number(globalThis.devicePixelRatio) || 1);
  return `madcad:panel-layout:v${PANEL_LAYOUT_VERSION}:${width}x${height}@${scale}`;
}

export function normalizePanelLayout(value) {
  return {
    commandDock: value?.commandDock === 'left' ? 'left' : 'right',
    commandCollapsed: Boolean(value?.commandCollapsed),
    printCollapsed: Boolean(value?.printCollapsed),
  };
}

export function readPanelLayout(storage = globalThis.localStorage, screenLike = globalThis.screen) {
  try {
    const stored = storage?.getItem(panelScreenKey(screenLike));
    return stored ? normalizePanelLayout(JSON.parse(stored)) : { ...DEFAULT_PANEL_LAYOUT };
  } catch {
    return { ...DEFAULT_PANEL_LAYOUT };
  }
}

export function writePanelLayout(layout, storage = globalThis.localStorage, screenLike = globalThis.screen) {
  const normalized = normalizePanelLayout(layout);
  try {
    storage?.setItem(panelScreenKey(screenLike), JSON.stringify(normalized));
  } catch {
    // A disabled or full localStorage must not block the CAD workspace.
  }
  return normalized;
}

export function isDockableCommand(command) {
  if (!command?.type) return false;
  return ![
    'plane',
    'parameters',
    'measure',
    'sectionAnalysis',
    'massProperties',
    'geometryInspection',
    'sketchDimension',
    'trimSketch',
    'extendSketch',
    'breakSketch',
    'projectSketch',
  ].includes(command.type);
}
