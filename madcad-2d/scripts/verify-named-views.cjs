const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-named-views.png');
const viewCubeScreenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-view-cube.png');

async function waitFor(window, expression, label, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-named-views-${Date.now()}` } });
  window.setContentSize(1440, 837);
  let exitCode = 0;
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell') && window.__madcadVerifyLoadTimelineFixture`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadCameraState`, 'model i kamera testowa');
    for (const [selector, expression, label] of [
      ['.cube-left', 'window.__madcadCameraState.position[0] < window.__madcadCameraState.target[0]', 'lewy'],
      ['.cube-right', 'window.__madcadCameraState.position[0] > window.__madcadCameraState.target[0]', 'prawy'],
      ['.cube-back', 'window.__madcadCameraState.position[1] > window.__madcadCameraState.target[1]', 'tylny'],
      ['.cube-front', 'window.__madcadCameraState.position[1] < window.__madcadCameraState.target[1]', 'przedni'],
      ['.cube-bottom', 'window.__madcadCameraState.position[2] < window.__madcadCameraState.target[2]', 'dolny'],
      ['.cube-top', 'window.__madcadCameraState.position[2] > window.__madcadCameraState.target[2]', 'górny'],
    ]) {
      await window.webContents.executeJavaScript(`document.querySelector('${selector}').click()`);
      await waitFor(window, expression, `ViewCube: ${label}`);
    }
    await window.webContents.executeJavaScript(`document.querySelector('.cube-main').click()`);
    await fs.writeFile(viewCubeScreenshotPath, (await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.workspace-tabs button')].find((item) => item.textContent.trim() === 'ZARZĄDZAJ')?.click()`);
    await waitFor(window, `document.querySelector('#projectNamedViewsBtn')`, 'polecenie zapisanych widoków w Zarządzaj');
    await window.webContents.executeJavaScript(`document.querySelector('#projectNamedViewsBtn').click()`);
    await waitFor(window, `document.querySelector('.named-views-panel')`, 'panel zapisanych widoków');
    await waitFor(window, `document.querySelector('.workspace-tabs button.active')?.textContent.trim() === 'PROJEKTUJ'`, 'powrót do modelu z panelem widoków');
    await window.webContents.executeJavaScript(`(() => {
      const input = document.querySelector('input[aria-label="Nazwa nowego widoku"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Montaż prawy');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(window, `!document.querySelector('.named-views-panel form button').disabled`, 'aktywne zapisanie kamery');
    await window.webContents.executeJavaScript(`document.querySelector('.named-views-panel form button').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.namedViews?.length === 1`, 'zapisany widok');
    const savedCamera = await window.webContents.executeJavaScript(`structuredClone(window.__madcadVerifyDocumentState.namedViews[0].camera)`);
    await window.webContents.executeJavaScript(`document.querySelector('.cube-top').click()`);
    await waitFor(window, `Math.abs(window.__madcadCameraState.position[0] - ${savedCamera.position[0]}) > 1`, 'zmieniona kamera');
    await window.webContents.executeJavaScript(`document.querySelector('.named-view-row > button:first-child').click()`);
    await waitFor(window, `window.__madcadCameraState.position.every((value, index) => Math.abs(value - ${JSON.stringify(savedCamera.position)}[index]) < 1e-6)`, 'przywrócona kamera');
    await window.webContents.executeJavaScript(`document.querySelector('.named-view-row > button:last-child').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.namedViews.length === 0`, 'usunięty widok');
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.namedViews.length === 1`, 'undo usunięcia widoku');
    const result = await window.webContents.executeJavaScript(`(() => {
      const panel = document.querySelector('.named-views-panel').getBoundingClientRect();
      return {
        views: window.__madcadVerifyDocumentState.namedViews.length,
        viewCubeDirections: document.querySelectorAll('.view-cube button').length,
        cameraRestored: window.__madcadCameraState.position.every((value, index) => Math.abs(value - window.__madcadVerifyDocumentState.namedViews[0].camera.position[index]) < 1e-6),
        insideViewport: panel.left >= 0 && panel.top >= 0 && panel.right <= innerWidth && panel.bottom <= innerHeight,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    if (result.views !== 1 || result.viewCubeDirections !== 7 || !result.cameraRestored || !result.insideViewport || result.horizontalOverflow) throw new Error(`Niepoprawne zapisane widoki: ${JSON.stringify(result)}`);
    process.stdout.write(`${JSON.stringify({ screenshotPath, viewCubeScreenshotPath, ...result }, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
