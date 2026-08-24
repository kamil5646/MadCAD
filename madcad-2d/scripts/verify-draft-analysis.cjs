const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-draft-analysis.png');

async function waitFor(window, expression, label, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-draft-analysis-${Date.now()}` } });
  window.setContentSize(1440, 837);
  let exitCode = 0;
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell') && window.__madcadVerifyLoadTimelineFixture`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 2`, 'model testowy');
    await window.webContents.executeJavaScript(`(() => {
      [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'NARZĘDZIA')?.click();
    })()`);
    await waitFor(window, `[...document.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Analiza' && !button.disabled)`, 'przycisk analizy');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Analiza' && !button.disabled).click()`);
    await waitFor(window, `document.querySelector('.geometry-inspection-panel')`, 'panel analizy');
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.geometryInspection?.draft?.faces?.length > 0`, 'mapa pochylenia');
    await window.webContents.executeJavaScript(`(() => {
      const select = document.querySelector('.draft-analysis-section select');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'x-positive');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.geometryInspection?.draft?.direction?.[0] === 1`, 'zmiana kierunku');
    const result = await window.webContents.executeJavaScript(`(() => {
      const panel = document.querySelector('.geometry-inspection-panel');
      const draft = window.__madcadVerifyDocumentState.command.geometryInspection.draft;
      const rect = panel.getBoundingClientRect();
      return {
        faces: draft.faces.length,
        counts: draft.counts,
        direction: draft.direction,
        legendEntries: panel.querySelectorAll('.draft-analysis-legend > div').length,
        insideViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    if (Object.values(result.counts).reduce((sum, value) => sum + value, 0) !== result.faces || result.legendEntries !== 4 || !result.insideViewport || result.horizontalOverflow) throw new Error(`Niepoprawna analiza pochylenia: ${JSON.stringify(result)}`);
    process.stdout.write(`${JSON.stringify({ screenshotPath, ...result }, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
