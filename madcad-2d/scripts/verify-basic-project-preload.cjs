const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopApp', {
  platform: process.platform,
  isDesktop: true,
  appLanguage: 'pl',
  saveTextFile: (payload) => ipcRenderer.invoke('madcad:save-text-file', payload),
  openProjectFile: () => ipcRenderer.invoke('madcad:open-project-file'),
});
