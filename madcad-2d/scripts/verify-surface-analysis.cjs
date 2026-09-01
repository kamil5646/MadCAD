const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-surface-analysis.png');
const curvatureScreenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-surface-curvature.png');
const isocurveScreenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-surface-isocurves.png');
const combScreenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-surface-comb.png');

async function waitFor(window, expression, label, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-surface-analysis-${Date.now()}` } });
  window.setContentSize(1440, 837);
  const renderErrors = [];
  window.webContents.on('console-message', (_event, _level, message) => {
    if (/shader|webgl|three\.webglprogram|error/i.test(message)) renderErrors.push(message);
  });
  let exitCode = 0;
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell') && window.__madcadVerifyLoadTimelineFixture`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 2`, 'model testowy');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'PROJEKTUJ')?.click()`);
    await waitFor(window, `[...document.querySelectorAll('.ribbon-tool-menu-trigger')].some((button) => button.textContent.trim() === 'Analiza')`, 'menu analizy');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-menu-trigger')].find((button) => button.textContent.trim() === 'Analiza').click()`);
    await waitFor(window, `[...document.querySelectorAll('.ribbon-tool-submenu button')].some((button) => button.querySelector('strong')?.textContent.trim() === 'Analiza powierzchni' && !button.disabled)`, 'przycisk analizy powierzchni');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-submenu button')].find((button) => button.querySelector('strong')?.textContent.trim() === 'Analiza powierzchni' && !button.disabled).click()`);
    await waitFor(window, `document.querySelector('.surface-analysis-panel') && window.__madcadVerifyDocumentState?.command?.surfaceAnalysis?.mode === 'zebra'`, 'panel zebra');
    await new Promise((resolve) => setTimeout(resolve, 500));
    const result = await window.webContents.executeJavaScript(`(() => {
      const panel = document.querySelector('.surface-analysis-panel');
      const canvas = document.querySelector('.model-viewport canvas');
      const rect = panel.getBoundingClientRect();
      const state = window.__madcadVerifyDocumentState.command.surfaceAnalysis;
      return {
        mode: state.mode,
        bands: state.bands,
        counts: state.continuity.counts,
        legendEntries: panel.querySelectorAll('.surface-continuity-row').length,
        panelInsideViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
        canvasVisible: Boolean(canvas && canvas.getBoundingClientRect().width > 300 && canvas.getBoundingClientRect().height > 250),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`(() => {
      const select = document.querySelector('.surface-analysis-panel select');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'curvature');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.surfaceAnalysis?.mode === 'curvature' && document.querySelector('.curvature-map-legend')`, 'mapa krzywizny');
    await new Promise((resolve) => setTimeout(resolve, 350));
    const curvature = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.command.surfaceAnalysis.curvature`);
    await fs.writeFile(curvatureScreenshotPath, (await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`(() => {
      const select = document.querySelector('.surface-analysis-panel select');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'isocurves');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.surfaceAnalysis?.mode === 'isocurves' && document.querySelector('.surface-analysis-panel input')`, 'izolinie powierzchni');
    await new Promise((resolve) => setTimeout(resolve, 350));
    await fs.writeFile(isocurveScreenshotPath, (await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`(() => {
      const select = document.querySelector('.surface-analysis-panel select');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'comb');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.surfaceAnalysis?.mode === 'comb'`, 'grzebień krzywizny');
    await new Promise((resolve) => setTimeout(resolve, 350));
    await fs.writeFile(combScreenshotPath, (await window.webContents.capturePage()).toPNG());
    if (result.mode !== 'zebra' || Number(result.bands) !== 12 || result.legendEntries !== 3 || !result.panelInsideViewport || !result.canvasVisible || result.horizontalOverflow || renderErrors.length) {
      throw new Error(`Niepoprawna analiza powierzchni: ${JSON.stringify({ result, renderErrors })}`);
    }
    if (!(curvature.bodyCount > 0) || !(curvature.maximum >= 0)) throw new Error(`Niepoprawna mapa krzywizny: ${JSON.stringify(curvature)}`);
    process.stdout.write(`${JSON.stringify({ screenshotPath, curvatureScreenshotPath, isocurveScreenshotPath, combScreenshotPath, ...result, curvature }, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
