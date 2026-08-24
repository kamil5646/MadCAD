const { contextBridge, ipcRenderer } = require('electron');

function readArgument(name) {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => typeof value === 'string' && value.startsWith(prefix));
  return argument ? String(argument.slice(prefix.length)) : '';
}

contextBridge.exposeInMainWorld('desktopApp', {
  platform: process.platform,
  isDesktop: true,
  appLanguage: (() => {
    const langArg = readArgument('madcad-lang');
    if (langArg) {
      const value = langArg.toLowerCase();
      if (value === 'en' || value === 'pl') {
        return value;
      }
    }
    return 'pl';
  })(),
  saveTextFile: (payload) => ipcRenderer.invoke('madcad:save-text-file', payload),
  openProjectFile: () => ipcRenderer.invoke('madcad:open-project-file'),
  confirmUnsavedChanges: (payload) => ipcRenderer.invoke('madcad:confirm-unsaved-changes', payload),
  sendToSlicer: (payload) => ipcRenderer.invoke('madcad:send-to-slicer', payload),
  importDwgSketch: () => ipcRenderer.invoke('madcad:import-dwg-sketch'),
  autosaveWrite: (payload) => ipcRenderer.invoke('madcad:autosave-write', payload),
  autosaveRead: () => ipcRenderer.invoke('madcad:autosave-read'),
  autosaveClear: () => ipcRenderer.invoke('madcad:autosave-clear'),
  projectSnapshotList: () => ipcRenderer.invoke('madcad:project-snapshot-list'),
  projectSnapshotCreate: (payload) => ipcRenderer.invoke('madcad:project-snapshot-create', payload),
  projectSnapshotRead: (payload) => ipcRenderer.invoke('madcad:project-snapshot-read', payload),
  projectSnapshotDelete: (payload) => ipcRenderer.invoke('madcad:project-snapshot-delete', payload),
  selectLinkedProject: (payload) => ipcRenderer.invoke('madcad:select-linked-project', payload),
  readLinkedProject: (payload) => ipcRenderer.invoke('madcad:read-linked-project', payload),
  packAndGoProject: (payload) => ipcRenderer.invoke('madcad:pack-and-go', payload),
  checkForUpdates: () => ipcRenderer.invoke('madcad:check-for-updates'),
  downloadAndInstallUpdate: (payload) => ipcRenderer.invoke('madcad:download-and-install-update', payload),
  openPrintPreviewWindow: (payload) => ipcRenderer.invoke('madcad:open-print-preview', payload),
  saveDrawingPdf: (payload) => ipcRenderer.invoke('madcad:save-drawing-pdf', payload),
  setAppLanguage: (payload) => ipcRenderer.invoke('madcad:set-language', payload)
});
