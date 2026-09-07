const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-thermal-screening.png');

async function waitFor(window, expression, label, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

async function setControl(window, selector, value, index = 0) {
  await window.webContents.executeJavaScript(`(() => {
    const control = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
    const prototype = control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(control, ${JSON.stringify(value)});
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-thermal-screening-${Date.now()}` } });
  window.setContentSize(1440, 837);
  let exitCode = 0;
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `window.__madcadVerifyLoadTimelineFixture && document.querySelector('[data-tool-label="Analiza"]')`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.bodyIds?.length >= 2`, 'bryły fixture');
    await window.webContents.executeJavaScript(`document.querySelector('[data-tool-label="Analiza"]').click()`);
    await waitFor(window, `document.querySelector('[data-tool-label="Szybka analiza cieplna"]')`, 'polecenie analizy cieplnej');
    await window.webContents.executeJavaScript(`document.querySelector('[data-tool-label="Szybka analiza cieplna"]').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.thermalScreening?.result && document.querySelector('.thermal-screening-panel')`, 'wynik początkowy');
    await setControl(window, 'select[aria-label="Materiał analizy cieplnej"]', 'petg');
    await setControl(window, '.thermal-screening-panel input[type="text"]', '90', 0);
    await waitFor(window, `window.__madcadVerifyDocumentState.command.thermalScreening.result.material.id === 'petg' && window.__madcadVerifyDocumentState.command.thermalScreening.result.hotTemperature === 90`, 'zmieniony materiał i temperatura');
    await setControl(window, '.thermal-screening-panel input[type="text"]', '90', 1);
    await waitFor(window, `document.querySelector('.thermal-screening-panel .measure-error')?.textContent.includes('różne temperatury')`, 'walidacja temperatur');
    await setControl(window, '.thermal-screening-panel input[type="text"]', '20', 1);
    await waitFor(window, `window.__madcadVerifyDocumentState.command.thermalScreening.result?.heatFlow > 0`, 'przeliczony wynik');
    const result = await window.webContents.executeJavaScript(`(() => {
      const value = window.__madcadVerifyDocumentState.command.thermalScreening.result;
      const panel = document.querySelector('.thermal-screening-panel').getBoundingClientRect();
      return { material: value.material.id, hotTemperature: value.hotTemperature, coldTemperature: value.coldTemperature, heatFlow: value.heatFlow, heatFlux: value.heatFlux, expansion: value.freeExpansion, status: value.status, limitations: value.limitations.length, insideViewport: panel.left >= 0 && panel.top >= 0 && panel.right <= innerWidth && panel.bottom <= innerHeight, horizontalOverflow: document.documentElement.scrollWidth > innerWidth, scopeVisible: document.querySelector('.thermal-screening-panel .analysis-scope')?.textContent.includes('nie pełny solver termiczny MES') };
    })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    if (result.material !== 'petg' || result.hotTemperature !== 90 || result.coldTemperature !== 20 || !(result.heatFlow > 0) || !(result.heatFlux > 0) || !(result.expansion > 0) || result.status !== 'warning' || result.limitations !== 3 || !result.insideViewport || result.horizontalOverflow || !result.scopeVisible) throw new Error(`Niepoprawna analiza cieplna: ${JSON.stringify(result)}`);
    process.stdout.write(`${JSON.stringify({ screenshotPath, ...result }, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
