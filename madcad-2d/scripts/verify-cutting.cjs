const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-cutting-2d.png');

async function waitFor(window, expression, label, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

async function changeSelectByLabel(window, label, value) {
  await window.webContents.executeJavaScript(`(() => { const control = [...document.querySelectorAll('label')].find((item) => item.querySelector(':scope > span')?.textContent.trim() === ${JSON.stringify(label)})?.querySelector('select'); if (!control) throw new Error('Brak pola: ${label}'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(control, ${JSON.stringify(value)}); control.dispatchEvent(new Event('change', { bubbles: true })); })()`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-cutting-${Date.now()}` } });
  window.setContentSize(1440, 837);
  let exitCode = 0;
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `window.__madcadVerifyLoadTimelineFixture && document.querySelector('.workspace-tabs')`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click(); window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.bodyIds?.length >= 2`, 'bryły fixture');
    const selectedBoundary = await window.webContents.executeJavaScript(`(() => { const body = window.__madcadVerifyEngineState.bodies[0]; const face = body.topology.faces.filter((item) => item.descriptor.geometry === 'PLANE' && Math.abs(item.descriptor.normal?.[2] || 0) > 0.99).sort((a, b) => b.descriptor.center[2] - a.descriptor.center[2])[0]; window.__madcadVerifyTopologySelection({ kind: 'face', id: face.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId }, 'replace'); return { bodyId: body.id, faceId: face.id }; })()`);
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.workspace-tabs button')].find((button) => button.textContent.trim() === 'WYTWARZANIE').click()`);
    await waitFor(window, `document.querySelector('[data-tool-label="Nowy Setup"]')`, 'obszar wytwarzania');
    await window.webContents.executeJavaScript(`document.querySelector('[data-tool-label="Nowy Setup"]').click()`);
    await waitFor(window, `document.querySelector('.manufacturing-summary.valid')`, 'Setup bazowy');
    await changeSelectByLabel(window, 'Rodzaj obróbki', 'cut-2d');
    await waitFor(window, `JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[0].operationKind === 'cut-2d' && JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[0].machineId === 'laser-600'`, 'Setup cięcia 2D');
    await changeSelectByLabel(window, 'Obrabiarka', 'plasma-1250');
    await waitFor(window, `JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[0].machineId === 'plasma-1250'`, 'maszyna plazmowa');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.manufacturing-page-tabs button')].find((button) => button.textContent.includes('Operacje')).click()`);
    await waitFor(window, `[...document.querySelectorAll('.manufacturing-add-actions button')].some((button) => button.textContent.includes('Cięcie konturu'))`, 'narzędzie cięcia konturu');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.manufacturing-add-actions button')].find((button) => button.textContent.includes('Cięcie konturu')).click()`);
    await waitFor(window, `document.querySelector('.manufacturing-toolpath-summary.valid') && JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[0].operations[0].type === 'cut2d' && window.__madcadManufacturingVisualState?.segmentCount > 0`, 'ścieżka cięcia laserowego');
    const laserState = await window.webContents.executeJavaScript(`(() => { const saved = JSON.parse(window.__madcadGetSessionExport()); const operation = saved.manufacturing.setups[0].operations[0]; return { setup: saved.manufacturing.setups[0], operation, summary: document.querySelector('.manufacturing-toolpath-summary').textContent, visual: window.__madcadManufacturingVisualState }; })()`);
    if (laserState.operation.boundaryFaceId !== selectedBoundary.faceId || laserState.operation.postProcessorId !== 'linuxcnc-plasma' || !laserState.summary.includes('Podgląd')) throw new Error(`Niepoprawna operacja cięcia plazmowego: ${JSON.stringify(laserState)}`);
    await window.webContents.executeJavaScript(`document.querySelector('.manufacturing-toolpath-summary button').click()`);
    await waitFor(window, `document.querySelector('.manufacturing-gcode-preview pre')?.textContent.startsWith('%\\n') && document.querySelector('.manufacturing-gcode-preview pre')?.textContent.includes('\\nM3\\nG4 P0.5\\n')`, 'podgląd programu plazmowego');
    const layout = await window.webContents.executeJavaScript(`(() => { const panel = document.querySelector('.manufacturing-panel').getBoundingClientRect(); return { insideViewport: panel.left >= 0 && panel.top >= 0 && panel.right <= innerWidth && panel.bottom <= innerHeight, overflow: document.documentElement.scrollWidth > innerWidth, title: document.querySelector('.manufacturing-panel > header').textContent, code: document.querySelector('.manufacturing-gcode-preview pre').textContent }; })()`);
    if (!layout.insideViewport || layout.overflow || !layout.title.includes('Cięcie laserowe / plazmowe 2D') || !layout.code.includes('M2\n%')) throw new Error(`Niepoprawny interfejs cięcia: ${JSON.stringify(layout)}`);
    await new Promise((resolve) => setTimeout(resolve, 150));
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    process.stdout.write(`${JSON.stringify({ screenshotPath, selectedBoundary, operation: laserState.operation, segmentCount: laserState.visual.segmentCount, layoutVerified: true }, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
