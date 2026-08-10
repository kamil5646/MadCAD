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
  deviceId: (() => {
    const value = readArgument('madcad-device-id');
    return /^[a-f0-9]{32}$/.test(value) ? value : '';
  })(),
  saveTextFile: (payload) => ipcRenderer.invoke('madcad:save-text-file', payload),
  sendToSlicer: (payload) => ipcRenderer.invoke('madcad:send-to-slicer', payload),
  autosaveWrite: (payload) => ipcRenderer.invoke('madcad:autosave-write', payload),
  autosaveRead: () => ipcRenderer.invoke('madcad:autosave-read'),
  autosaveClear: () => ipcRenderer.invoke('madcad:autosave-clear'),
  checkForUpdates: () => ipcRenderer.invoke('madcad:check-for-updates'),
  downloadAndInstallUpdate: (payload) => ipcRenderer.invoke('madcad:download-and-install-update', payload),
  openPrintPreviewWindow: (payload) => ipcRenderer.invoke('madcad:open-print-preview', payload),
  convertCadFile: (payload) => ipcRenderer.invoke('madcad:convert-cad-file', payload),
  getOdaStatus: () => ipcRenderer.invoke('madcad:get-oda-status'),
  installOdaAddon: () => ipcRenderer.invoke('madcad:install-oda-addon'),
  chooseOdaConverterPath: () => ipcRenderer.invoke('madcad:choose-oda-path'),
  openOdaDownload: () => ipcRenderer.invoke('madcad:open-oda-download'),
  appendLicenseAudit: (payload) => ipcRenderer.invoke('madcad:append-license-audit', payload),
  clearLicenseStorage: () => ipcRenderer.invoke('madcad:clear-license-storage'),
  setAppLanguage: (payload) => ipcRenderer.invoke('madcad:set-language', payload)
});
