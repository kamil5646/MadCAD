const os = require('os');
const crypto = require('crypto');
const { contextBridge, ipcRenderer } = require('electron');

const LICENSE_PUBLIC_KEY_PEM = [
  '-----BEGIN PUBLIC KEY-----',
  'MCowBQYDK2VwAyEA5vwZA4c41mXP0grMhjY1Uwmg0tZH+L02qFi3GZC9CXY=',
  '-----END PUBLIC KEY-----'
].join('\n');

function resolveDeviceId() {
  try {
    const username = os.userInfo().username || 'unknown-user';
    const hostname = os.hostname() || 'unknown-host';
    const machine = `${process.platform}|${process.arch}|${hostname}|${username}`;
    return crypto.createHash('sha256').update(machine).digest('hex').slice(0, 32);
  } catch {
    return crypto
      .createHash('sha256')
      .update(`${process.platform}|${process.arch}|fallback`)
      .digest('hex')
      .slice(0, 32);
  }
}

function base64UrlToBuffer(value) {
  const raw = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (raw.length % 4)) % 4;
  return Buffer.from(raw + '='.repeat(pad), 'base64');
}

function verifyLicenseSignature(payloadJson, signatureBase64Url) {
  try {
    const publicKey = crypto.createPublicKey(LICENSE_PUBLIC_KEY_PEM);
    const payload = Buffer.from(String(payloadJson || ''), 'utf8');
    const signature = base64UrlToBuffer(signatureBase64Url);
    return crypto.verify(null, payload, publicKey, signature);
  } catch {
    return false;
  }
}

contextBridge.exposeInMainWorld('desktopApp', {
  platform: process.platform,
  isDesktop: true,
  appLanguage: (() => {
    const langArg = process.argv.find((arg) => typeof arg === 'string' && arg.startsWith('--madcad-lang='));
    if (langArg) {
      const value = String(langArg.split('=')[1] || '').toLowerCase();
      if (value === 'en' || value === 'pl') {
        return value;
      }
    }
    return process.env.APP_LANG === 'en' ? 'en' : 'pl';
  })(),
  deviceId: resolveDeviceId(),
  verifyLicenseSignature: (payloadJson, signatureBase64Url) =>
    verifyLicenseSignature(payloadJson, signatureBase64Url),
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
