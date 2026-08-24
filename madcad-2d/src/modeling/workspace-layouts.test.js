import { describe, expect, it, vi } from 'vitest';
import { BUILT_IN_WORKSPACE_LAYOUTS, createCustomWorkspaceLayout, loadCustomWorkspaceLayouts, normalizeWorkspaceView, saveCustomWorkspaceLayouts } from './workspace-layouts.js';

describe('saved workspace layouts', () => {
  it('ships focused CAD, canvas, document, drawing and print presets', () => {
    expect(BUILT_IN_WORKSPACE_LAYOUTS.map((item) => item.id)).toEqual(['classic-cad', 'clean-canvas', 'document-tools', 'technical-drawing', 'export-print']);
    expect(BUILT_IN_WORKSPACE_LAYOUTS.find((item) => item.id === 'clean-canvas').view.browserOpen).toBe(false);
    expect(BUILT_IN_WORKSPACE_LAYOUTS.find((item) => item.id === 'technical-drawing').view.workspace).toBe('drawing');
    expect(BUILT_IN_WORKSPACE_LAYOUTS.find((item) => item.id === 'export-print').view.printPanelOpen).toBe(true);
  });

  it('captures, validates and persists up to eight custom layouts', () => {
    const values = new Map();
    const storage = { getItem: vi.fn((key) => values.get(key) ?? null), setItem: vi.fn((key, value) => values.set(key, value)) };
    const layout = createCustomWorkspaceLayout('Mój CAD', { workspace: 'tools', browserOpen: true, layersOpen: true, panelLayout: { commandDock: 'left' } });
    saveCustomWorkspaceLayouts([layout], storage);
    expect(loadCustomWorkspaceLayouts(storage)[0]).toMatchObject({ name: 'Mój CAD', view: { workspace: 'tools', browserOpen: true, layersOpen: true, panelLayout: { commandDock: 'left' } } });
    expect(() => createCustomWorkspaceLayout('mój cad', {}, [layout])).toThrow(/już istnieje/);
  });

  it('normalizes corrupt layout values without breaking the workspace', () => {
    expect(normalizeWorkspaceView({ workspace: 'unknown', blocksOpen: 1, panelLayout: { commandDock: 'top' } })).toEqual({
      workspace: 'solid', browserOpen: false, layersOpen: false, blocksOpen: true, commandCustomizationOpen: false, printPanelOpen: false,
      panelLayout: { commandDock: 'right', commandCollapsed: false, printCollapsed: false },
    });
    expect(loadCustomWorkspaceLayouts({ getItem: () => '{bad' })).toEqual([]);
  });
});
