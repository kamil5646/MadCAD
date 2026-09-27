const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopApp', {
  platform: process.platform,
  isDesktop: true,
  appLanguage: 'pl',
  saveTextFile: (payload) => ipcRenderer.invoke('madcad-verify:save-project', payload),
  openProjectFile: () => ipcRenderer.invoke('madcad-verify:open-project'),
});
