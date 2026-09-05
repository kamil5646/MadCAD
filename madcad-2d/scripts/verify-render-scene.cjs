const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const artifactDirectory = path.join(__dirname, '..', 'artifacts');
const screenshotPath = path.join(artifactDirectory, 'madcad-render-scene.png');
const renderPath = path.join(artifactDirectory, 'madcad-render-scene-export.png');

async function waitFor(window, expression, label, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-render-scene-${Date.now()}` } });
  window.setContentSize(1440, 837);
  let exitCode = 0;
  try {
    await fs.mkdir(artifactDirectory, { recursive: true });
    await fs.rm(renderPath, { force: true });
    window.webContents.session.on('will-download', (_event, item) => item.setSavePath(renderPath));
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell') && window.__madcadVerifyLoadTimelineFixture`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadRenderSceneState`, 'model i scena testowa');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.workspace-tabs button')].find((item) => item.textContent.trim() === 'ZARZĄDZAJ')?.click()`);
    await waitFor(window, `document.querySelector('#projectRenderSceneBtn')`, 'polecenie sceny w Zarządzaj');
    await window.webContents.executeJavaScript(`document.querySelector('#projectRenderSceneBtn').click()`);
    await waitFor(window, `document.querySelector('.render-scene-panel') && window.__madcadRenderSceneState`, 'panel sceny nad modelem');
    await window.webContents.executeJavaScript(`(() => {
      const select = document.querySelector('#renderScenePreset');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'daylight');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.renderScene?.preset === 'daylight' && window.__madcadRenderSceneState?.background === '#b9cad8'`, 'preset dzienny zapisany w projekcie i zastosowany');
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.renderScene.preset === 'studio' && window.__madcadRenderSceneState.background === '#202936'`, 'cofnięcie ustawień sceny');
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.renderScene.preset === 'daylight' && window.__madcadRenderSceneState?.preset === 'daylight'`, 'ponowienie i zastosowanie ustawień sceny');
    await window.webContents.executeJavaScript(`document.querySelector('#saveLocalRenderBtn').click()`);
    const startedAt = Date.now();
    while (Date.now() - startedAt < 10000) {
      try { if ((await fs.stat(renderPath)).size > 1000) break; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const renderBytes = (await fs.stat(renderPath)).size;
    const result = await window.webContents.executeJavaScript(`(() => {
      const panel = document.querySelector('.render-scene-panel').getBoundingClientRect();
      return {
        preset: window.__madcadVerifyDocumentState.renderScene.preset,
        appliedPreset: window.__madcadRenderSceneState.preset,
        insideViewport: panel.left >= 0 && panel.top >= 0 && panel.right <= innerWidth && panel.bottom <= innerHeight,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    if (result.preset !== 'daylight' || result.appliedPreset !== 'daylight' || !result.insideViewport || result.horizontalOverflow || renderBytes <= 100000) throw new Error(`Niepoprawna lub pusta scena renderu: ${JSON.stringify({ ...result, renderBytes })}`);
    process.stdout.write(`${JSON.stringify({ screenshotPath, renderPath, renderBytes, ...result }, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    try {
      const debug = await window.webContents.executeJavaScript(`({ selected: document.querySelector('#renderScenePreset')?.value, project: window.__madcadVerifyDocumentState?.renderScene, applied: window.__madcadRenderSceneState, notice: document.querySelector('.workspace-notice')?.textContent })`);
      process.stderr.write(`Stan sceny: ${JSON.stringify(debug)}\n`);
    } catch {}
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
