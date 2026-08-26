import { describe, expect, it } from 'vitest';
import {
  configureCadMouseNavigation,
  shouldHandlePrimaryViewportPointer,
  VIEWPORT_NAVIGATION_MODES,
  viewportCursor,
} from './viewport-navigation.js';

const MOUSE = Object.freeze({ ROTATE: 0, DOLLY: 1, PAN: 2 });

describe('AutoCAD-compatible viewport navigation', () => {
  it('keeps the left button for selection and maps wheel press to pan', () => {
    const controls = { mouseButtons: {} };
    configureCadMouseNavigation(controls, MOUSE);

    expect(controls.mouseButtons).toEqual({ LEFT: null, MIDDLE: MOUSE.PAN, RIGHT: null });
    expect(controls.screenSpacePanning).toBe(true);
    expect(controls.zoomToCursor).toBe(true);
    expect(controls.zoomSpeed).toBe(1.1);
    expect(controls.rotateSpeed).toBe(0.45);
  });

  it('only assigns the left button while an explicit orbit or pan tool is active', () => {
    const orbit = { mouseButtons: {} };
    const pan = { mouseButtons: {} };
    configureCadMouseNavigation(orbit, MOUSE, { navigationMode: VIEWPORT_NAVIGATION_MODES.ORBIT });
    configureCadMouseNavigation(pan, MOUSE, { navigationMode: VIEWPORT_NAVIGATION_MODES.PAN });

    expect(orbit.mouseButtons.LEFT).toBe(MOUSE.ROTATE);
    expect(pan.mouseButtons.LEFT).toBe(MOUSE.PAN);
  });

  it('lets explicit pan work in a sketch without letting orbit steal sketch drawing', () => {
    const controls = { mouseButtons: {} };
    configureCadMouseNavigation(controls, MOUSE, { navigationMode: VIEWPORT_NAVIGATION_MODES.ORBIT, activeSketch: true });
    const pan = { mouseButtons: {} };
    configureCadMouseNavigation(pan, MOUSE, { navigationMode: VIEWPORT_NAVIGATION_MODES.PAN, activeSketch: true });

    expect(controls.mouseButtons.LEFT).toBeNull();
    expect(pan.mouseButtons.LEFT).toBe(MOUSE.PAN);
    expect(shouldHandlePrimaryViewportPointer({ button: 1 })).toBe(false);
    expect(shouldHandlePrimaryViewportPointer({ button: 0 }, { navigationMode: VIEWPORT_NAVIGATION_MODES.ORBIT })).toBe(false);
    expect(shouldHandlePrimaryViewportPointer({ button: 0 }, { navigationMode: VIEWPORT_NAVIGATION_MODES.ORBIT, activeSketch: true })).toBe(false);
    expect(shouldHandlePrimaryViewportPointer({ button: 0 }, { navigationMode: VIEWPORT_NAVIGATION_MODES.PAN, activeSketch: true })).toBe(false);
    expect(shouldHandlePrimaryViewportPointer({ button: 0 }, { navigationMode: VIEWPORT_NAVIGATION_MODES.SELECT, activeSketch: true })).toBe(true);
  });

  it('uses a selection crosshair until a temporary navigation tool is selected', () => {
    expect(viewportCursor()).toBe('crosshair');
    expect(viewportCursor(VIEWPORT_NAVIGATION_MODES.ORBIT)).toBe('grab');
    expect(viewportCursor(VIEWPORT_NAVIGATION_MODES.PAN)).toBe('move');
  });
});
