const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-manufacturing-setup.png');
const gcodePath = path.join(__dirname, '..', 'artifacts', 'madcad-facing.nc');
async function waitFor(window, expression, label, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}
async function setControl(window, selector, value) {
  await window.webContents.executeJavaScript(`(() => { const control = document.querySelector(${JSON.stringify(selector)}); const prototype = control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(control, ${JSON.stringify(value)}); control.dispatchEvent(new Event('input', { bubbles: true })); control.dispatchEvent(new Event('change', { bubbles: true })); })()`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-manufacturing-${Date.now()}` } });
  window.setContentSize(1440, 837);
  let exitCode = 0;
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `window.__madcadVerifyLoadTimelineFixture && document.querySelector('.workspace-tabs')`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click(); window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.bodyIds?.length >= 2`, 'bryły fixture');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.workspace-tabs button')].find((button) => button.textContent.trim() === 'WYTWARZANIE').click()`);
    await waitFor(window, `document.querySelector('.manufacturing-panel') && document.querySelector('[data-tool-label="Nowy Setup"]')`, 'obszar wytwarzania');
    await window.webContents.executeJavaScript(`document.querySelector('[data-tool-label="Nowy Setup"]').click()`);
    await waitFor(window, `document.querySelector('.manufacturing-summary.valid') && JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups.length === 1`, 'poprawny Setup CAM');
    await setControl(window, '.manufacturing-field-grid label:nth-child(2) input', '5');
    await waitFor(window, `JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[0].stock.topOffset === 5`, 'zapis naddatku');
    await window.webContents.executeJavaScript(`document.querySelector('.manufacturing-operation-empty button').click()`);
    await waitFor(window, `document.querySelector('.manufacturing-toolpath-summary.valid') && JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[0].operations.length === 1 && window.__madcadManufacturingVisualState?.segmentCount > 0`, 'ścieżka planowania');
    const state = await window.webContents.executeJavaScript(`(() => { const panel = document.querySelector('.manufacturing-panel').getBoundingClientRect(); const saved = JSON.parse(window.__madcadGetSessionExport()); return { schemaVersion: saved.schemaVersion, setup: saved.manufacturing.setups[0], activeSetupId: saved.manufacturing.activeSetupId, valid: Boolean(document.querySelector('.manufacturing-summary.valid')), toolpathValid: Boolean(document.querySelector('.manufacturing-toolpath-summary.valid')), toolpathSegments: window.__madcadManufacturingVisualState?.segmentCount, stockVisible: window.__madcadManufacturingVisualState?.stockVisible, insideViewport: panel.left >= 0 && panel.top >= 0 && panel.right <= innerWidth && panel.bottom <= innerHeight, horizontalOverflow: document.documentElement.scrollWidth > innerWidth }; })()`);
    if (state.schemaVersion !== 17 || !state.setup?.id || state.activeSetupId !== state.setup.id || state.setup.stock.topOffset !== 5 || state.setup.operations?.length !== 1 || !state.valid || !state.toolpathValid || !(state.toolpathSegments > 0) || !state.stockVisible || !state.insideViewport || state.horizontalOverflow) throw new Error(`Niepoprawny Setup CAM: ${JSON.stringify(state)}`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    const download = new Promise((resolve, reject) => window.webContents.session.once('will-download', (_event, item) => { item.setSavePath(gcodePath); item.once('done', (_downloadEvent, status) => status === 'completed' ? resolve() : reject(new Error(`Eksport G-code: ${status}`))); }));
    await window.webContents.executeJavaScript(`document.querySelector('.manufacturing-toolpath-summary button').click()`);
    await download;
    const gcode = await fs.readFile(gcodePath, 'utf8');
    if (!gcode.includes('\nG21\n') || !gcode.includes('\nG90\n') || !gcode.includes('\nM5\nM30\n')) throw new Error('Eksportowany G-code nie zawiera bezpiecznego nagłówka lub zakończenia.');
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[0].operations.length === 0`, 'Cofnij dodanie operacji CAM');
    process.stdout.write(`${JSON.stringify({ screenshotPath, gcodePath, gcodeBytes: Buffer.byteLength(gcode), ...state }, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
