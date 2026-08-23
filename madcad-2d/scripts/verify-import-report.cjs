const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const artifactsDir = path.join(__dirname, '..', 'artifacts');
const screenshotPath = path.join(artifactsDir, 'madcad-import-repair-report.png');

async function waitFor(window, expression, label, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-import-report-${Date.now()}` } });
  window.setContentSize(1440, 837);
  try {
    await fs.mkdir(artifactsDir, { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell') && window.__madcadVerifyShowImportRepairReport`, 'interfejs aplikacji');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await waitFor(window, `!document.querySelector('.license-info-dialog')`, 'zamknięcie informacji licencyjnej');
    const report = await window.webContents.executeJavaScript(`window.__madcadVerifyShowImportRepairReport()`);
    await waitFor(window, `document.querySelectorAll('.import-report-entry').length === 3`, 'raport naprawy importu');
    await new Promise((resolve) => setTimeout(resolve, 200));
    const state = await window.webContents.executeJavaScript(`(() => {
      const dialog = document.querySelector('.import-repair-report');
      const stage = document.querySelector('.modeling-stage');
      const rect = dialog.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      return {
        title: dialog.querySelector('header')?.textContent.trim(),
        summary: dialog.querySelector('.import-report-summary')?.textContent.trim(),
        entries: [...dialog.querySelectorAll('.import-report-entry')].map((entry) => entry.textContent.trim()),
        hasSave: [...dialog.querySelectorAll('footer button')].some((button) => button.textContent.includes('Zapisz JSON')),
        insideStage: rect.left >= stageRect.left && rect.top >= stageRect.top && rect.right <= stageRect.right && rect.bottom <= stageRect.bottom,
      };
    })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    if (report.changed !== 1 || report.skipped !== 2 || !state.summary.includes('1') || !state.summary.includes('2') || !state.hasSave || !state.insideStage) {
      throw new Error(`Niepełny raport naprawy importu: ${JSON.stringify({ report, state })}`);
    }
    process.stdout.write(`${JSON.stringify({ screenshotPath, report, state }, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});

