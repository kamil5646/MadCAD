const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-static-screening.png');

async function waitFor(window, expression, label, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

async function setControl(window, selector, value) {
  await window.webContents.executeJavaScript(`(() => {
    const control = document.querySelector(${JSON.stringify(selector)});
    const prototype = control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(control, ${JSON.stringify(value)});
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-static-screening-${Date.now()}` } });
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
    await waitFor(window, `document.querySelector('[data-tool-label="Szybka analiza statyczna"]')`, 'polecenie analizy statycznej');
    await window.webContents.executeJavaScript(`document.querySelector('[data-tool-label="Szybka analiza statyczna"]').click()`);
    await waitFor(window, `document.querySelector('.static-screening-panel')`, 'panel analizy statycznej');
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'staticScreening'`, 'stan polecenia analizy statycznej');
    const initial = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState?.command?.staticScreening`);
    if (!initial?.result) throw new Error(`Brak początkowego wyniku analizy: ${initial?.error || 'nieznany błąd'}`);
    await setControl(window, 'select[aria-label="Materiał analizy statycznej"]', 's355');
    await setControl(window, '.static-screening-panel input[type="text"]', '500');
    await waitFor(window, `window.__madcadVerifyDocumentState.command.staticScreening.result.material.id === 's355' && window.__madcadVerifyDocumentState.command.staticScreening.result.force === 500`, 'zmienione obciążenie i materiał');
    const spanAxis = await window.webContents.executeJavaScript(`document.querySelector('select[aria-label="Oś długości belki"]').value`);
    await setControl(window, 'select[aria-label="Kierunek siły"]', spanAxis);
    await waitFor(window, `document.querySelector('.static-screening-panel .measure-error')?.textContent.includes('muszą być różne')`, 'walidacja osi');
    const loadAxis = spanAxis === 'z' ? 'y' : 'z';
    await setControl(window, 'select[aria-label="Kierunek siły"]', loadAxis);
    await waitFor(window, `window.__madcadVerifyDocumentState.command.staticScreening.result?.maximumStress > 0`, 'przeliczony wynik');
    const result = await window.webContents.executeJavaScript(`(() => {
      const value = window.__madcadVerifyDocumentState.command.staticScreening.result;
      const panel = document.querySelector('.static-screening-panel').getBoundingClientRect();
      return { force: value.force, material: value.material.id, stress: value.maximumStress, deflection: value.tipDeflection, safetyFactor: value.safetyFactor, limitations: value.limitations.length, insideViewport: panel.left >= 0 && panel.top >= 0 && panel.right <= innerWidth && panel.bottom <= innerHeight, horizontalOverflow: document.documentElement.scrollWidth > innerWidth, scopeVisible: document.querySelector('.analysis-scope')?.textContent.includes('nie pełny solver MES') };
    })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    if (result.force !== 500 || result.material !== 's355' || !(result.stress > 0) || !(result.deflection > 0) || !(result.safetyFactor > 0) || result.limitations !== 3 || !result.insideViewport || result.horizontalOverflow || !result.scopeVisible) throw new Error(`Niepoprawna analiza statyczna: ${JSON.stringify(result)}`);
    process.stdout.write(`${JSON.stringify({ screenshotPath, ...result }, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
