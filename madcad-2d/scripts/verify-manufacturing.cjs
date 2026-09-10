const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-manufacturing-setup.png');
const reportScreenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-manufacturing-report.png');
const gcodeScreenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-gcode-preview.png');
const gcodePath = path.join(__dirname, '..', 'artifacts', 'madcad-contour-linuxcnc.ngc');
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
    const { DOCUMENT_SCHEMA_VERSION } = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'cad-core', 'document.js')).href);
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `window.__madcadVerifyLoadTimelineFixture && document.querySelector('.workspace-tabs')`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click(); window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.bodyIds?.length >= 2`, 'bryły fixture');
    const selectedBoundary = await window.webContents.executeJavaScript(`(() => { const body = window.__madcadVerifyEngineState.bodies[0]; const face = body.topology.faces.filter((item) => item.descriptor.geometry === 'PLANE' && Math.abs(item.descriptor.normal?.[2] || 0) > 0.99).sort((a, b) => b.descriptor.center[2] - a.descriptor.center[2])[0]; if (!face) throw new Error('Brak poziomej ściany testowej'); window.__madcadVerifyTopologySelection({ kind: 'face', id: face.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId }, 'replace'); return { bodyId: body.id, faceId: face.id }; })()`);
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.workspace-tabs button')].find((button) => button.textContent.trim() === 'WYTWARZANIE').click()`);
    await waitFor(window, `document.querySelector('.manufacturing-panel') && document.querySelector('[data-tool-label="Nowy Setup"]')`, 'obszar wytwarzania');
    await window.webContents.executeJavaScript(`document.querySelector('[data-tool-label="Nowy Setup"]').click()`);
    await waitFor(window, `document.querySelector('.manufacturing-summary.valid') && JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups.length === 1`, 'poprawny Setup CAM');
    await setControl(window, '.manufacturing-field-grid label:nth-child(2) input', '5');
    await waitFor(window, `JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[0].stock.topOffset === 5`, 'zapis naddatku');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.manufacturing-page-tabs button')].find((button) => button.textContent.includes('Operacje')).click()`);
    await waitFor(window, `document.querySelector('.manufacturing-operation-list')`, 'zakładka operacji CAM');
    await window.webContents.executeJavaScript(`document.querySelectorAll('.manufacturing-add-actions button')[0].click()`);
    await waitFor(window, `document.querySelector('.manufacturing-toolpath-summary.valid') && JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[0].operations.length === 1 && window.__madcadManufacturingVisualState?.segmentCount > 0`, 'ścieżka planowania');
    await window.webContents.executeJavaScript(`document.querySelectorAll('.manufacturing-add-actions button')[1].click()`);
    await waitFor(window, `JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[0].operations.length === 2 && document.querySelectorAll('.manufacturing-toolpath-summary.valid').length === 2`, 'ścieżka Kieszeń 2D');
    await window.webContents.executeJavaScript(`document.querySelectorAll('.manufacturing-add-actions button')[2].click()`);
    await waitFor(window, `JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[0].operations.length === 3 && document.querySelectorAll('.manufacturing-toolpath-summary.valid').length === 3`, 'ścieżka Adaptacyjne 2D');
    await window.webContents.executeJavaScript(`document.querySelectorAll('.manufacturing-add-actions button')[3].click()`);
    await waitFor(window, `JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[0].operations.length === 4`, 'zapis operacji Kontur 2D');
    await waitFor(window, `document.querySelectorAll('.manufacturing-operation').length === 4 && [...document.querySelectorAll('.manufacturing-operation')].at(-1).querySelectorAll('select').length >= 2`, 'kontrolki operacji Kontur 2D');
    await window.webContents.executeJavaScript(`(() => { const control = [...document.querySelectorAll('.manufacturing-operation')].at(-1).querySelectorAll('select')[1]; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(control, 'linuxcnc'); control.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await waitFor(window, `JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[0].operations[3].postProcessorId === 'linuxcnc'`, 'postprocesor LinuxCNC');
    const contourDiagnostic = await window.webContents.executeJavaScript(`(() => { const saved = JSON.parse(window.__madcadGetSessionExport()); const bodyId = saved.manufacturing.setups[0].bodyId; const body = window.__madcadVerifyEngineState.bodies.find((item) => item.id === bodyId); const topZ = body.bounds[1][2]; let topTriangles = 0; for (let i = 0; i < body.triangles.length; i += 3) { if ([body.triangles[i], body.triangles[i + 1], body.triangles[i + 2]].every((index) => Math.abs(body.vertices[index * 3 + 2] - topZ) < 1e-3)) topTriangles += 1; } return { summaries: [...document.querySelectorAll('.manufacturing-toolpath-summary')].map((item) => ({ valid: item.classList.contains('valid'), text: item.textContent.trim() })), operation: saved.manufacturing.setups[0].operations[3], body: { id: body.id, bounds: body.bounds, vertices: body.vertices.length, triangles: body.triangles.length, topTriangles, faceGroups: body.faceGroups?.length }, visual: window.__madcadManufacturingVisualState }; })()`);
    if (contourDiagnostic.summaries.length !== 4 || !contourDiagnostic.summaries[3].valid) throw new Error(`Kontur 2D nie jest prawidłowy: ${JSON.stringify(contourDiagnostic)}`);
    const state = await window.webContents.executeJavaScript(`(() => { const panel = document.querySelector('.manufacturing-panel').getBoundingClientRect(); const saved = JSON.parse(window.__madcadGetSessionExport()); return { schemaVersion: saved.schemaVersion, setup: saved.manufacturing.setups[0], activeSetupId: saved.manufacturing.activeSetupId, valid: !document.querySelector('.manufacturing-toolpath-summary.invalid'), validToolpaths: document.querySelectorAll('.manufacturing-toolpath-summary.valid').length, toolpathSegments: window.__madcadManufacturingVisualState?.segmentCount, stockVisible: window.__madcadManufacturingVisualState?.stockVisible, insideViewport: panel.left >= 0 && panel.top >= 0 && panel.right <= innerWidth && panel.bottom <= innerHeight, horizontalOverflow: document.documentElement.scrollWidth > innerWidth }; })()`);
    if (state.schemaVersion !== DOCUMENT_SCHEMA_VERSION || !state.setup?.id || state.activeSetupId !== state.setup.id || state.setup.bodyId !== selectedBoundary.bodyId || state.setup.stock.topOffset !== 5 || state.setup.operations?.length !== 4 || state.setup.operations[1].type !== 'pocket' || state.setup.operations[1].boundaryFaceId !== selectedBoundary.faceId || state.setup.operations[2].type !== 'adaptive' || state.setup.operations[2].boundaryFaceId !== selectedBoundary.faceId || state.setup.operations[3].type !== 'contour' || state.setup.operations[3].boundaryFaceId !== selectedBoundary.faceId || state.setup.operations[3].postProcessorId !== 'linuxcnc' || !state.valid || state.validToolpaths !== 4 || !(state.toolpathSegments > 0) || !state.stockVisible || !state.insideViewport || state.horizontalOverflow) throw new Error(`Niepoprawny Setup CAM: ${JSON.stringify(state)}`);
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.manufacturing-toolpath-summary')].at(-1).querySelectorAll('button')[0].click()`);
    await waitFor(window, `document.querySelector('.manufacturing-gcode-preview pre')?.textContent.startsWith('%\\n') && document.querySelector('.manufacturing-gcode-preview pre')?.textContent.includes('G64 P0.01') && document.querySelector('.manufacturing-gcode-preview pre')?.textContent.includes('\\nM2\\n%')`, 'podgląd G-code LinuxCNC');
    await new Promise((resolve) => setTimeout(resolve, 150));
    await fs.writeFile(gcodeScreenshotPath, (await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`document.querySelector('[aria-label="Zamknij podgląd G-code"]').click()`);
    await waitFor(window, `document.querySelector('.manufacturing-operation-list') && !document.querySelector('.manufacturing-gcode-preview')`, 'zamknięcie podglądu G-code');
    const download = new Promise((resolve, reject) => window.webContents.session.once('will-download', (_event, item) => { item.setSavePath(gcodePath); item.once('done', (_downloadEvent, status) => status === 'completed' ? resolve() : reject(new Error(`Eksport G-code: ${status}`))); }));
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.manufacturing-toolpath-summary button')].at(-1).click()`);
    await download;
    const gcode = await fs.readFile(gcodePath, 'utf8');
    if (!gcode.startsWith('%\n') || !gcode.includes('\nG21\n') || !gcode.includes('\nG90\n') || !gcode.includes('\nG64 P0.01\n') || !gcode.includes('\nM5\nM2\n%')) throw new Error('Eksportowany G-code LinuxCNC nie zawiera bezpiecznego nagłówka lub zakończenia.');
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[0].operations[3].postProcessorId === 'grbl'`, 'Cofnij zmianę postprocesora');
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[0].operations.length === 3`, 'Cofnij dodanie Konturu 2D');
    const selectedProfile = await window.webContents.executeJavaScript(`(() => { const sketch = window.__madcadVerifyDocumentState.sketches.find((item) => item.plane === 'XY' && item.profileIds.length); if (!sketch) throw new Error('Brak profilu XY do testu CAM'); window.__madcadVerifyProfileSelection(sketch.id, sketch.profileIds[0]); return { sketchId: sketch.id, profileId: sketch.profileIds[0] }; })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.selection.kind === 'profile'`, 'zaznaczenie profilu CAM');
    await window.webContents.executeJavaScript(`document.querySelectorAll('.manufacturing-add-actions button')[1].click()`);
    await waitFor(window, `JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[0].operations.length === 4 && document.querySelectorAll('.manufacturing-toolpath-summary.valid').length === 4`, 'Pocket 2D z profilu szkicu');
    const profileState = await window.webContents.executeJavaScript(`(() => { const operation = JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[0].operations.at(-1); return { type: operation.type, sketchId: operation.boundarySketchId, profileId: operation.boundaryProfileId, label: [...document.querySelectorAll('.manufacturing-boundary small')].at(-1)?.textContent }; })()`);
    if (profileState.type !== 'pocket' || profileState.sketchId !== selectedProfile.sketchId || profileState.profileId !== selectedProfile.profileId || !profileState.label?.includes('profil szkicu')) throw new Error(`Profil szkicu nie został powiązany z CAM: ${JSON.stringify(profileState)}`);
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.manufacturing-page-tabs button')].find((button) => button.textContent.includes('Kontrola')).click()`);
    await waitFor(window, `document.querySelector('.manufacturing-program-report > header.valid') && document.querySelectorAll('.manufacturing-report-operations > div.valid').length === 4`, 'raport bezpieczeństwa i czasu CAM');
    const reportState = await window.webContents.executeJavaScript(`(() => ({ text: document.querySelector('.manufacturing-program-report').textContent, overflow: document.documentElement.scrollWidth > innerWidth }))()`);
    if (reportState.overflow || !reportState.text.includes('Szacowany czas') || !reportState.text.includes('Usuwany materiał') || !reportState.text.includes('Nie wykryto kolizji')) throw new Error(`Niepełny raport CAM: ${JSON.stringify(reportState)}`);
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.manufacturing-simulation-controls button')].find((button) => button.textContent.includes('Od początku')).click()`);
    await waitFor(window, `document.querySelector('.manufacturing-simulation-controls output').textContent === '0%' && window.__madcadManufacturingVisualState?.segmentCount === 0 && window.__madcadManufacturingVisualState?.removedColumnCount === 0`, 'wyzerowanie symulacji CAM');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.manufacturing-simulation-controls button')].find((button) => button.textContent.includes('Odtwórz')).click()`);
    await waitFor(window, `Number.parseInt(document.querySelector('.manufacturing-simulation-controls output').textContent, 10) > 0 && document.querySelector('.manufacturing-simulation-controls button')?.parentElement?.textContent.includes('Pauza')`, 'odtwarzanie symulacji CAM');
    await setControl(window, '.manufacturing-simulation-controls input', '35');
    await waitFor(window, `document.querySelector('.manufacturing-simulation-controls output').textContent === '35%' && window.__madcadManufacturingVisualState?.segmentCount > 0 && window.__madcadManufacturingVisualState?.removedColumnCount > 0 && window.__madcadManufacturingVisualState?.cutterVisible`, 'postęp usuwania materiału CAM');
    const simulationState = await window.webContents.executeJavaScript(`({ progress: document.querySelector('.manufacturing-simulation-controls output').textContent, ...window.__madcadManufacturingVisualState })`);
    if (simulationState.segmentCount >= state.toolpathSegments) throw new Error(`Symulacja nie ograniczyła widocznej ścieżki: ${JSON.stringify(simulationState)}`);
    await new Promise((resolve) => setTimeout(resolve, 150));
    await fs.writeFile(reportScreenshotPath, (await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.manufacturing-page-tabs button')].find((button) => button.textContent.includes('Operacje')).click()`);
    await window.webContents.executeJavaScript(`document.querySelector('.manufacturing-panel').scrollTop = document.querySelector('.manufacturing-panel').scrollHeight`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[0].operations.length === 3`, 'Cofnij operację profilu CAM');
    process.stdout.write(`${JSON.stringify({ screenshotPath, reportScreenshotPath, gcodeScreenshotPath, gcodePath, gcodeBytes: Buffer.byteLength(gcode), profileBoundary: profileState, simulation: simulationState, reportVerified: true, ...state }, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
