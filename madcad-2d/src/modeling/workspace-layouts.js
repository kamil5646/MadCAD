import { normalizePanelLayout } from './panel-layout.js';

export const WORKSPACE_LAYOUTS_KEY = 'madcad:workspace-layouts:v1';

const BASE_VIEW = Object.freeze({
  workspace: 'solid',
  browserOpen: true,
  layersOpen: false,
  blocksOpen: false,
  commandCustomizationOpen: false,
  printPanelOpen: false,
  panelLayout: { commandDock: 'right', commandCollapsed: false, printCollapsed: false },
});

export const BUILT_IN_WORKSPACE_LAYOUTS = Object.freeze([
  { id: 'classic-cad', name: 'Klasyczny CAD', description: 'Drzewo projektu po lewej i właściwości polecenia po prawej.', builtIn: true, view: BASE_VIEW },
  { id: 'clean-canvas', name: 'Czyste płótno', description: 'Maksymalny obszar rysowania bez paneli bocznych.', builtIn: true, view: { ...BASE_VIEW, browserOpen: false, panelLayout: { ...BASE_VIEW.panelLayout, commandCollapsed: true } } },
  { id: 'document-tools', name: 'Dokument i warstwy', description: 'Narzędzia dokumentu, drzewo projektu i menedżer warstw.', builtIn: true, view: { ...BASE_VIEW, workspace: 'tools', layersOpen: true } },
  { id: 'technical-drawing', name: 'Dokumentacja techniczna', description: 'Arkusze, skojarzone widoki modelu i eksport PDF.', builtIn: true, view: { ...BASE_VIEW, workspace: 'drawing', browserOpen: false } },
  { id: 'export-print', name: 'Eksport i druk', description: 'Eksport CAD z panelem przygotowania druku jako dodatkiem.', builtIn: true, view: { ...BASE_VIEW, workspace: 'print', browserOpen: false, printPanelOpen: true } },
]);

export function normalizeWorkspaceView(value) {
  return {
    workspace: ['solid', 'drawing', 'tools', 'print'].includes(value?.workspace) ? value.workspace : 'solid',
    browserOpen: Boolean(value?.browserOpen),
    layersOpen: Boolean(value?.layersOpen),
    blocksOpen: Boolean(value?.blocksOpen),
    commandCustomizationOpen: Boolean(value?.commandCustomizationOpen),
    printPanelOpen: Boolean(value?.printPanelOpen),
    panelLayout: normalizePanelLayout(value?.panelLayout),
  };
}

export function captureWorkspaceView(value) {
  return normalizeWorkspaceView(value);
}

export function loadCustomWorkspaceLayouts(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(WORKSPACE_LAYOUTS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 8).filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string').map((item) => ({
      id: item.id,
      name: item.name.trim().slice(0, 40) || 'Własny układ',
      description: 'Zapisany układ użytkownika.',
      builtIn: false,
      view: normalizeWorkspaceView(item.view),
    }));
  } catch {
    return [];
  }
}

export function saveCustomWorkspaceLayouts(layouts, storage = globalThis.localStorage) {
  const normalized = (Array.isArray(layouts) ? layouts : []).slice(0, 8).map((item) => ({
    id: String(item.id),
    name: String(item.name || 'Własny układ').trim().slice(0, 40) || 'Własny układ',
    view: normalizeWorkspaceView(item.view),
  }));
  try {
    storage?.setItem(WORKSPACE_LAYOUTS_KEY, JSON.stringify(normalized));
  } catch {
    // Brak localStorage nie może blokować obszaru CAD.
  }
  return normalized.map((item) => ({ ...item, description: 'Zapisany układ użytkownika.', builtIn: false }));
}

export function createCustomWorkspaceLayout(name, view, existing = []) {
  const normalizedName = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!normalizedName) throw new Error('Podaj nazwę układu obszaru roboczego.');
  if (existing.some((item) => item.name.toLocaleLowerCase('pl-PL') === normalizedName.toLocaleLowerCase('pl-PL'))) throw new Error(`Układ „${normalizedName}” już istnieje.`);
  return {
    id: `workspace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: normalizedName,
    description: 'Zapisany układ użytkownika.',
    builtIn: false,
    view: captureWorkspaceView(view),
  };
}
