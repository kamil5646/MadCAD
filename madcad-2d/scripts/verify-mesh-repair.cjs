const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-mesh-repair.png');
async function waitFor(window, expression, label, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-mesh-repair-${Date.now()}` } });
  window.setContentSize(1440, 837);
  let exitCode = 0;
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyTopologySelection`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await window.webContents.executeJavaScript(`(async () => {
      const triangles = [
        [[0, 0, 0], [20, 0, 0], [0, 20, 0]],
        [[0, 0, 0], [20, 0, 0], [0, 20, 0]],
        [[0, 0, 0], [0, 0, 0], [20, 0, 0]],
      ];
      const stl = new ArrayBuffer(84 + triangles.length * 50);
      const view = new DataView(stl);
      view.setUint32(80, triangles.length, true);
      triangles.forEach((face, faceIndex) => face.forEach((vertex, vertexIndex) => vertex.forEach((value, axis) => view.setFloat32(84 + faceIndex * 50 + 12 + vertexIndex * 12 + axis * 4, value, true))));
      const input = [...document.querySelectorAll('input[type="file"]')].find((item) => item.accept.includes('.stl'));
      const key = input && Object.keys(input).find((item) => item.startsWith('__reactProps'));
      await input[key].onChange({ target: { files: [new File([stl], 'dirty-scan.stl', { type: 'model/stl' })], value: '' } });
    })()`);
    await waitFor(window, `document.querySelector('.import-model-dialog .confirm')`, 'potwierdzenie importu');
    await window.webContents.executeJavaScript(`document.querySelector('.import-model-dialog .confirm').click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 1`, 'brudna siatka');
    await window.webContents.executeJavaScript(`(() => { const body = window.__madcadVerifyEngineState.bodies[0]; window.__madcadVerifyTopologySelection({ kind: 'body', id: body.id, bodyId: body.id }); })()`);
    await waitFor(window, `[...document.querySelectorAll('.adaptive-tool-shelf button')].some((button) => button.textContent.includes('Narzędzia siatki'))`, 'kontekst narzędzi siatki');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.adaptive-tool-shelf button')].find((button) => button.textContent.includes('Narzędzia siatki')).click()`);
    await waitFor(window, `document.querySelector('.mesh-tools-panel')`, 'panel diagnostyki');
    const before = await window.webContents.executeJavaScript(`document.querySelector('.mesh-tools-panel').textContent`);
    if (!before.includes('Zdegenerowane1') || !before.includes('Powtórzone1')) throw new Error(`Błędna diagnostyka: ${before}`);
    await window.webContents.executeJavaScript(`document.querySelector('.mesh-action-button').click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.triangles?.length === 3 && document.querySelector('.mesh-action-button')?.disabled`, 'naprawiona siatka');
    const result = await window.webContents.executeJavaScript(`(() => { const panel = document.querySelector('.mesh-tools-panel'); const rect = panel.getBoundingClientRect(); return { triangleCount: window.__madcadVerifyEngineState.bodies[0].triangles.length / 3, text: panel.textContent, insideViewport: rect.right <= innerWidth && rect.bottom <= innerHeight, horizontalOverflow: document.documentElement.scrollWidth > innerWidth }; })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    if (result.triangleCount !== 1 || !result.insideViewport || result.horizontalOverflow) throw new Error(`Niepoprawny wynik naprawy: ${JSON.stringify(result)}`);
    process.stdout.write(`${JSON.stringify({ screenshotPath, ...result }, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
