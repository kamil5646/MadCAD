export const VIEWPORT_NAVIGATION_MODES = Object.freeze({
  SELECT: 'select',
  ORBIT: 'orbit',
  PAN: 'pan',
});

export function configureCadMouseNavigation(controls, mouseActions, {
  navigationMode = VIEWPORT_NAVIGATION_MODES.SELECT,
  activeSketch = false,
} = {}) {
  if (!controls || !mouseActions) return controls;

  // AutoCAD-compatible defaults: the left button selects, pressing the wheel
  // pans, Shift + wheel press orbits, and the wheel zooms at the cursor.
  controls.mouseButtons.LEFT = activeSketch
    ? null
    : navigationMode === VIEWPORT_NAVIGATION_MODES.ORBIT
      ? mouseActions.ROTATE
      : navigationMode === VIEWPORT_NAVIGATION_MODES.PAN
        ? mouseActions.PAN
        : null;
  controls.mouseButtons.MIDDLE = mouseActions.PAN;
  controls.mouseButtons.RIGHT = null;
  controls.screenSpacePanning = true;
  controls.zoomToCursor = true;
  controls.zoomSpeed = 1.1;
  return controls;
}

export function shouldHandlePrimaryViewportPointer(event, {
  navigationMode = VIEWPORT_NAVIGATION_MODES.SELECT,
  activeSketch = false,
} = {}) {
  if (event?.button !== 0) return false;
  return activeSketch || navigationMode === VIEWPORT_NAVIGATION_MODES.SELECT;
}

export function viewportCursor(navigationMode = VIEWPORT_NAVIGATION_MODES.SELECT) {
  if (navigationMode === VIEWPORT_NAVIGATION_MODES.ORBIT) return 'grab';
  if (navigationMode === VIEWPORT_NAVIGATION_MODES.PAN) return 'move';
  return 'crosshair';
}
