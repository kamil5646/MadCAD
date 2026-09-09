const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-solid-fea.png');
async function waitFor(window, expression, label, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}
async function setControl(window, selector, value, index = 0) {
  await window.webContents.executeJavaScript(`(() => { const control = document.querySelectorAll(${JSON.stringify(selector)})[${index}]; const prototype = control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(control, ${JSON.stringify(value)}); control.dispatchEvent(new Event('input', { bubbles: true })); control.dispatchEvent(new Event('change', { bubbles: true })); })()`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-solid-fea-${Date.now()}` } });
  window.setContentSize(1440, 837);
  let exitCode = 0;
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `window.__madcadVerifyLoadTimelineFixture && document.querySelector('[data-tool-label="Analiza"]')`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click(); window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.bodyIds?.length >= 2`, 'bryły fixture');
    const selectedFaces = await window.webContents.executeJavaScript(`(() => { const body = window.__madcadVerifyEngineState.bodies[0]; const faces = body.topology.faces.filter((face) => face.descriptor?.geometry === 'PLANE' && Math.abs(face.descriptor.normal?.[0] || 0) > 0.99).sort((first, second) => first.descriptor.center[0] - second.descriptor.center[0]); const support = faces[0]; const load = faces.at(-1); window.__madcadVerifyTopologySelection({ kind: 'face', id: support.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId }, 'replace'); window.__madcadVerifyTopologySelection({ kind: 'face', id: load.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId }, 'add'); return { support: support.id, load: load.id }; })()`);
    await window.webContents.executeJavaScript(`document.querySelector('[data-tool-label="Analiza"]').click()`);
    await waitFor(window, `document.querySelector('[data-tool-label="MES bryły 3D (beta)"]')`, 'polecenie MES bryły 3D');
    await window.webContents.executeJavaScript(`document.querySelector('[data-tool-label="MES bryły 3D (beta)"]').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.solidFea?.result && window.__madcadSolidFeaVisualState?.visible && document.querySelector('.solid-fea-panel')`, 'wynik i wizualizacja MES 3D', 60000);
    await setControl(window, 'select[aria-label="Materiał MES 3D"]', 'aluminum6061');
    await setControl(window, '.solid-fea-panel input[type="text"]', '750');
    await setControl(window, '.solid-fea-panel input[type="text"]', '7', 1);
    await waitFor(window, `window.__madcadVerifyDocumentState.command.solidFea.result?.material?.id === 'aluminum6061' && window.__madcadVerifyDocumentState.command.solidFea.result?.force === 750`, 'zmienione obciążenie i materiał', 60000);
    const result = await window.webContents.executeJavaScript(`(() => { const value = window.__madcadVerifyDocumentState.command.solidFea.result; const panel = document.querySelector('.solid-fea-panel').getBoundingClientRect(); return { material: value.material.id, force: value.force, nodes: value.nodeCount, elements: value.elementCount, fixed: value.fixedNodeCount, loaded: value.loadedNodeCount, supportFaceId: value.supportFaceId, loadFaceId: value.loadFaceId, displacement: value.maximumDisplacement, stress: value.maximumStress, safetyFactor: value.safetyFactor, volumeError: value.volumeErrorPercent, equilibriumError: value.equilibriumErrorPercent, convergence: value.convergence, iterations: value.iterationCount, residual: value.residualNorm, visual: window.__madcadSolidFeaVisualState, selectedFaceReferences: document.querySelectorAll('.solid-fea-face-reference').length, betaVisible: document.querySelector('.solid-fea-panel')?.textContent.includes('BETA'), limitations: value.limitations.length, insideViewport: panel.left >= 0 && panel.top >= 0 && panel.right <= innerWidth && panel.bottom <= innerHeight, horizontalOverflow: document.documentElement.scrollWidth > innerWidth }; })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    if (result.material !== 'aluminum6061' || result.force !== 750 || result.nodes < 20 || result.elements < 20 || result.fixed < 3 || result.loaded < 1 || result.supportFaceId !== selectedFaces.support || result.loadFaceId !== selectedFaces.load || result.selectedFaceReferences !== 2 || !(result.displacement > 0) || !(result.stress > 0) || !(result.safetyFactor > 0) || result.volumeError > 30 || result.equilibriumError > 0.01 || !result.convergence || !Number.isFinite(result.convergence.displacementChangePercent) || !Number.isFinite(result.convergence.stressChangePercent) || result.residual > 0.01 || !result.visual?.visible || result.visual.nodeCount !== result.nodes || result.visual.elementCount !== result.elements || !(result.visual.deformationScale >= 1) || !result.betaVisible || result.limitations !== 3 || !result.insideViewport || result.horizontalOverflow) throw new Error(`Niepoprawny MES bryły 3D: ${JSON.stringify(result)}`);
    process.stdout.write(`${JSON.stringify({ screenshotPath, ...result }, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
