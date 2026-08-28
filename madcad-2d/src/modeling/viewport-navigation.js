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

  // CAD defaults: the left button selects, pressing the wheel pans, the right
  // button orbits the 3D model, and the wheel zooms at the cursor. A sketch
  // stays perpendicular to its drawing plane, so orbit is disabled in 2D.
  controls.mouseButtons.LEFT = navigationMode === VIEWPORT_NAVIGATION_MODES.PAN
    ? mouseActions.PAN
    : navigationMode === VIEWPORT_NAVIGATION_MODES.ORBIT && !activeSketch
      ? mouseActions.ROTATE
      : null;
  controls.mouseButtons.MIDDLE = mouseActions.PAN;
  controls.mouseButtons.RIGHT = activeSketch ? null : mouseActions.ROTATE;
  controls.screenSpacePanning = true;
  controls.zoomToCursor = true;
  controls.zoomSpeed = 1.1;
  controls.rotateSpeed = 0.45;
  return controls;
}

export function shouldHandlePrimaryViewportPointer(event, {
  navigationMode = VIEWPORT_NAVIGATION_MODES.SELECT,
} = {}) {
  if (event?.button !== 0) return false;
  return navigationMode === VIEWPORT_NAVIGATION_MODES.SELECT;
}

export function viewportCursor(navigationMode = VIEWPORT_NAVIGATION_MODES.SELECT) {
  if (navigationMode === VIEWPORT_NAVIGATION_MODES.ORBIT) return 'grab';
  if (navigationMode === VIEWPORT_NAVIGATION_MODES.PAN) return 'move';
  return 'crosshair';
}
