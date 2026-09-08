const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-beam-fea.png');
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
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-beam-fea-${Date.now()}` } });
  window.setContentSize(1440, 837);
  let exitCode = 0;
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `window.__madcadVerifyLoadTimelineFixture && document.querySelector('[data-tool-label="Analiza"]')`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click(); window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.bodyIds?.length >= 2`, 'bryły fixture');
    await window.webContents.executeJavaScript(`document.querySelector('[data-tool-label="Analiza"]').click()`);
    await waitFor(window, `document.querySelector('[data-tool-label="MES belki 1D"]')`, 'polecenie MES belki');
    await window.webContents.executeJavaScript(`document.querySelector('[data-tool-label="MES belki 1D"]').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.beamFea?.result && document.querySelector('.beam-fea-panel')`, 'wynik MES');
    await setControl(window, '.beam-fea-panel select[aria-label="Typ obciążenia MES"]', 'distributed');
    await setControl(window, '.beam-fea-panel input[type="text"]', '10', 0);
    await setControl(window, '.beam-fea-panel input[type="text"]', '12', 1);
    await waitFor(window, `window.__madcadVerifyDocumentState.command.beamFea.result.loadType === 'distributed' && window.__madcadVerifyDocumentState.command.beamFea.result.force === 10 && window.__madcadVerifyDocumentState.command.beamFea.result.elementCount === 12`, 'obciążenie rozłożone i zmieniona siatka');
    await waitFor(window, `window.__madcadBeamFeaVisualState?.loadType === 'distributed' && window.__madcadBeamFeaVisualState?.loadArrowCount === 6`, 'strzałki obciążenia rozłożonego');
    const distributed = await window.webContents.executeJavaScript(`(() => { const value = window.__madcadVerifyDocumentState.command.beamFea.result; return { totalLoad: value.totalLoad, length: value.length, reaction: value.reactionForce, moment: value.reactionMoment, error: value.convergenceError, unitVisible: document.querySelector('.beam-fea-panel')?.textContent.includes('N/mm'), arrows: window.__madcadBeamFeaVisualState?.loadArrowCount, support: window.__madcadBeamFeaVisualState?.support }; })()`);
    if (Math.abs(distributed.totalLoad - 10 * distributed.length) > 1e-6 || Math.abs(distributed.reaction - distributed.totalLoad) > 1e-4 || Math.abs(distributed.moment - distributed.totalLoad * distributed.length / 2) > 1e-3 || distributed.error > 1e-5 || !distributed.unitVisible || distributed.arrows !== 6 || !distributed.support) throw new Error(`Niepoprawne obciążenie rozłożone: ${JSON.stringify(distributed)}`);
    await setControl(window, '.beam-fea-panel select[aria-label="Typ obciążenia MES"]', 'tip');
    await waitFor(window, `Array.from(document.querySelectorAll('.beam-fea-panel .command-field')).some((label) => label.textContent.includes('Położenie od utwierdzenia'))`, 'położenie siły skupionej');
    await setControl(window, '.beam-fea-panel input[type="text"]', '500', 0);
    await setControl(window, '.beam-fea-panel input[type="text"]', '37', 2);
    await waitFor(window, `window.__madcadVerifyDocumentState.command.beamFea.result.loadType === 'tip' && window.__madcadVerifyDocumentState.command.beamFea.result.force === 500 && window.__madcadVerifyDocumentState.command.beamFea.result.loadPositionPercent === 37`, 'siła skupiona między węzłami');
    await setControl(window, '.beam-fea-panel input[type="text"]', '0', 1);
    await waitFor(window, `document.querySelector('.beam-fea-panel .measure-error')?.textContent.includes('od 1 do 100')`, 'walidacja siatki');
    await setControl(window, '.beam-fea-panel input[type="text"]', '12', 1);
    await waitFor(window, `window.__madcadVerifyDocumentState.command.beamFea.result?.nodeCount === 13 && window.__madcadBeamFeaVisualState?.nodeCount === 13`, 'wynik i wizualizacja MES');
    const deflectionDiagramVisible = await window.webContents.executeJavaScript(`Boolean(document.querySelector('[aria-label="Wykres ugięcia węzłów MES"]'))`);
    await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.beam-fea-chart-tabs button')).find((button) => button.textContent === 'Moment').click()`);
    await waitFor(window, `document.querySelector('[aria-label="Wykres momentu zginającego MES"]')`, 'diagram momentu');
    const momentDiagramVisible = await window.webContents.executeJavaScript(`Boolean(document.querySelector('[aria-label="Wykres momentu zginającego MES"]'))`);
    await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.beam-fea-chart-tabs button')).find((button) => button.textContent === 'Tnąca').click()`);
    await waitFor(window, `document.querySelector('[aria-label="Wykres siły tnącej MES"]')`, 'diagram siły tnącej');
    const shearDiagramVisible = await window.webContents.executeJavaScript(`Boolean(document.querySelector('[aria-label="Wykres siły tnącej MES"]'))`);
    await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.beam-fea-chart-tabs button')).find((button) => button.textContent === 'Naprężenie').click()`);
    await waitFor(window, `document.querySelector('[aria-label="Wykres naprężenia zginającego MES"]')`, 'diagram naprężenia');
    const result = await window.webContents.executeJavaScript(`(() => { const value = window.__madcadVerifyDocumentState.command.beamFea.result; const panel = document.querySelector('.beam-fea-panel').getBoundingClientRect(); return { loadType: value.loadType, force: value.force, loadPositionPercent: value.loadPositionPercent, loadPosition: value.loadPosition, totalLoad: value.totalLoad, length: value.length, elements: value.elementCount, nodes: value.nodeCount, momentNodes: value.bendingMoments?.length, stressNodes: value.bendingStresses?.length, shearNodes: value.shearForces?.length, diagramMaximum: Math.max(...(value.bendingMoments || []).map((node) => node.moment)), stressMaximum: Math.max(...(value.bendingStresses || []).map((node) => node.stress)), shearMaximum: Math.max(...(value.shearForces || []).map((node) => node.shear)), maximumStress: value.maximumStress, materialYield: value.material.yieldStrength, utilizationPercent: value.utilizationPercent, yieldExceededNodeCount: value.yieldExceededNodeCount, deflection: value.tipDeflection, error: value.convergenceError, reaction: value.reactionForce, moment: value.reactionMoment, limitations: value.limitations.length, positionVisible: Array.from(document.querySelectorAll('.beam-fea-panel .command-field')).some((label) => label.textContent.includes('Położenie od utwierdzenia')), legendVisible: Boolean(document.querySelector('.beam-fea-legend')), chartTabsVisible: document.querySelectorAll('.beam-fea-chart-tabs button').length === 4, stressDiagramVisible: Boolean(document.querySelector('.beam-fea-stress-chart polyline')), safeStressMarkers: document.querySelectorAll('.beam-fea-stress-chart circle.safe').length, viewportNodes: window.__madcadBeamFeaVisualState?.nodeCount, deformationScale: window.__madcadBeamFeaVisualState?.scale, viewportLoadPosition: window.__madcadBeamFeaVisualState?.loadPosition, viewportLoadPoint: window.__madcadBeamFeaVisualState?.loadPoint, loadArrowCount: window.__madcadBeamFeaVisualState?.loadArrowCount, support: window.__madcadBeamFeaVisualState?.support, insideViewport: panel.left >= 0 && panel.top >= 0 && panel.right <= innerWidth && panel.bottom <= innerHeight, horizontalOverflow: document.documentElement.scrollWidth > innerWidth, scopeVisible: document.querySelector('.beam-fea-panel .analysis-scope')?.textContent.includes('nie MES dowolnej bryły 3D') }; })()`);
    result.deflectionDiagramVisible = deflectionDiagramVisible;
    result.momentDiagramVisible = momentDiagramVisible;
    result.shearDiagramVisible = shearDiagramVisible;
    await setControl(window, '.beam-fea-panel input[type="text"]', '50000', 0);
    await waitFor(window, `window.__madcadVerifyDocumentState.command.beamFea.result?.yieldExceededNodeCount > 0 && document.querySelector('.beam-fea-stress-chart circle.failed')`, 'krytyczna strefa naprężenia');
    result.criticalYieldNodes = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.command.beamFea.result.yieldExceededNodeCount`);
    result.failedStressMarkers = await window.webContents.executeJavaScript(`document.querySelectorAll('.beam-fea-stress-chart circle.failed').length`);
    await setControl(window, '.beam-fea-panel input[type="text"]', '500', 0);
    await waitFor(window, `window.__madcadVerifyDocumentState.command.beamFea.result?.force === 500 && window.__madcadVerifyDocumentState.command.beamFea.result?.yieldExceededNodeCount === 0`, 'powrót bezpiecznego obciążenia');
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    if (result.loadType !== 'tip' || result.force !== 500 || result.loadPositionPercent !== 37 || Math.abs(result.loadPosition - result.length * 0.37) > 1e-6 || result.totalLoad !== 500 || result.elements !== 12 || result.nodes !== 13 || result.momentNodes !== 13 || result.stressNodes !== 13 || result.shearNodes !== 24 || Math.abs(result.diagramMaximum - result.moment) > 1e-3 || Math.abs(result.stressMaximum - result.maximumStress) > 1e-6 || Math.abs(result.utilizationPercent - result.maximumStress / result.materialYield * 100) > 1e-6 || result.yieldExceededNodeCount !== 0 || result.safeStressMarkers < 1 || result.criticalYieldNodes < 1 || result.failedStressMarkers < 1 || Math.abs(result.shearMaximum - result.reaction) > 1e-3 || !(result.deflection > 0) || result.error > 1e-5 || Math.abs(result.reaction - 500) > 1e-4 || Math.abs(result.moment - result.force * result.loadPosition) > 1e-3 || result.limitations !== 3 || !result.positionVisible || !result.legendVisible || !result.chartTabsVisible || !result.deflectionDiagramVisible || !result.momentDiagramVisible || !result.shearDiagramVisible || !result.stressDiagramVisible || result.viewportNodes !== 13 || Math.abs(result.viewportLoadPosition - result.loadPosition) > 1e-6 || result.viewportLoadPoint?.length !== 3 || result.loadArrowCount !== 1 || !result.support || !(result.deformationScale >= 1) || !result.insideViewport || result.horizontalOverflow || !result.scopeVisible) throw new Error(`Niepoprawny MES belki: ${JSON.stringify(result)}`);
    process.stdout.write(`${JSON.stringify({ screenshotPath, ...result }, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
