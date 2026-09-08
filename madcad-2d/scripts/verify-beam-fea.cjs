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
    await setControl(window, '.beam-fea-panel input[type="text"]', '500', 0);
    await setControl(window, '.beam-fea-panel input[type="text"]', '12', 1);
    await waitFor(window, `window.__madcadVerifyDocumentState.command.beamFea.result.force === 500 && window.__madcadVerifyDocumentState.command.beamFea.result.elementCount === 12`, 'zmieniona siatka i siła');
    await setControl(window, '.beam-fea-panel input[type="text"]', '0', 1);
    await waitFor(window, `document.querySelector('.beam-fea-panel .measure-error')?.textContent.includes('od 1 do 100')`, 'walidacja siatki');
    await setControl(window, '.beam-fea-panel input[type="text"]', '12', 1);
    await waitFor(window, `window.__madcadVerifyDocumentState.command.beamFea.result?.nodeCount === 13`, 'ponowny wynik MES');
    const result = await window.webContents.executeJavaScript(`(() => { const value = window.__madcadVerifyDocumentState.command.beamFea.result; const panel = document.querySelector('.beam-fea-panel').getBoundingClientRect(); return { force: value.force, elements: value.elementCount, nodes: value.nodeCount, deflection: value.tipDeflection, error: value.convergenceError, reaction: value.reactionForce, moment: value.reactionMoment, limitations: value.limitations.length, insideViewport: panel.left >= 0 && panel.top >= 0 && panel.right <= innerWidth && panel.bottom <= innerHeight, horizontalOverflow: document.documentElement.scrollWidth > innerWidth, scopeVisible: document.querySelector('.beam-fea-panel .analysis-scope')?.textContent.includes('nie MES dowolnej bryły 3D') }; })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    if (result.force !== 500 || result.elements !== 12 || result.nodes !== 13 || !(result.deflection > 0) || result.error > 1e-5 || Math.abs(result.reaction - 500) > 1e-4 || !(result.moment > 0) || result.limitations !== 3 || !result.insideViewport || result.horizontalOverflow || !result.scopeVisible) throw new Error(`Niepoprawny MES belki: ${JSON.stringify(result)}`);
    process.stdout.write(`${JSON.stringify({ screenshotPath, ...result }, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
