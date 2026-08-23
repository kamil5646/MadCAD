import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PANEL_LAYOUT,
  isDockableCommand,
  normalizePanelLayout,
  panelScreenKey,
  readPanelLayout,
  writePanelLayout,
} from './panel-layout.js';

describe('panel layout persistence', () => {
  it('uses a separate key for each monitor work area', () => {
    expect(panelScreenKey({ availWidth: 1728, availHeight: 1117 })).toContain('1728x1117');
    expect(panelScreenKey({ availWidth: 1920, availHeight: 1080 })).not.toBe(panelScreenKey({ availWidth: 1728, availHeight: 1117 }));
  });

  it('normalizes corrupt or incomplete values', () => {
    expect(normalizePanelLayout({ commandDock: 'top', commandCollapsed: 1 })).toEqual({
      commandDock: 'right',
      commandCollapsed: true,
      printCollapsed: false,
    });
  });

  it('round-trips the layout through storage', () => {
    const values = new Map();
    const storage = {
      getItem: vi.fn((key) => values.get(key) ?? null),
      setItem: vi.fn((key, value) => values.set(key, value)),
    };
    const monitor = { availWidth: 1440, availHeight: 900 };
    const saved = writePanelLayout({ commandDock: 'left', commandCollapsed: true, printCollapsed: true }, storage, monitor);
    expect(readPanelLayout(storage, monitor)).toEqual(saved);
    expect(readPanelLayout(storage, { availWidth: 2560, availHeight: 1440 })).toEqual(DEFAULT_PANEL_LAYOUT);
  });

  it('falls back safely when storage is unavailable', () => {
    const brokenStorage = { getItem: () => { throw new Error('blocked'); } };
    expect(readPanelLayout(brokenStorage, { availWidth: 1000, availHeight: 700 })).toEqual(DEFAULT_PANEL_LAYOUT);
  });
});

describe('dockable command classification', () => {
  it('docks property-style tools and leaves canvas/modal tools alone', () => {
    expect(isDockableCommand({ type: 'line' })).toBe(true);
    expect(isDockableCommand({ type: 'extrude' })).toBe(true);
    expect(isDockableCommand({ type: 'measure' })).toBe(false);
    expect(isDockableCommand({ type: 'parameters' })).toBe(false);
    expect(isDockableCommand(null)).toBe(false);
  });
});
