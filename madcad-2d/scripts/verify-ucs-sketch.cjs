const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const artifactPath = path.join(__dirname, '..', 'artifacts', 'ucs-sketch.png');

async function waitFor(window, expression, label, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  throw new Error(`Nie osiagnieto stanu: ${label}`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: false, webPreferences: { partition: `madcad-ucs-${Date.now()}` } });
  let exitCode = 0;
  try {
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && typeof window.__madcadVerifyLoadUcsFixture === 'function'`, 'gotowy silnik UCS');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button[aria-label="Zamknij"]')?.click(); window.__madcadVerifyLoadUcsFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 1`, 'bryla wyciagnieta z obroconego szkicu');
    const solid = await window.webContents.executeJavaScript(`({
      volume: window.__madcadVerifyEngineState.bodies[0].metrics.volume,
      bounds: window.__madcadVerifyEngineState.bodies[0].metrics.bounds,
      frame: window.__madcadVerifyDocumentState.sketches[0].frame,
    })`);
    if (Math.abs(solid.volume - 2400) > 0.01 || !solid.frame || Math.abs(solid.frame.normal[1]) < 0.7 || Math.abs(solid.frame.normal[2]) < 0.7) {
      throw new Error(`Nieprawidlowe wyciagniecie UCS: ${JSON.stringify(solid)}`);
    }
    await window.webContents.executeJavaScript(`window.__madcadVerifyEditSketch(window.__madcadVerifyDocumentState.sketches[0].id)`);
    await waitFor(window, `document.querySelector('.model-viewport')?.classList.contains('sketch-view') && window.__madcadCameraState`, 'widok szkicu UCS');
    const camera = await window.webContents.executeJavaScript(`window.__madcadCameraState`);
    const viewDirection = camera.position.map((value, index) => value - camera.target[index]);
    const length = Math.hypot(...viewDirection);
    const normalized = viewDirection.map((value) => value / length);
    const alignment = Math.abs(normalized.reduce((sum, value, index) => sum + value * solid.frame.normal[index], 0));
    if (alignment < 0.995) throw new Error(`Kamera nie jest prostopadla do szkicu UCS: ${JSON.stringify({ camera, alignment })}`);
    await fs.mkdir(path.dirname(artifactPath), { recursive: true });
    await fs.writeFile(artifactPath, (await window.webContents.capturePage()).toPNG());
    process.stdout.write(`${JSON.stringify({ ok: true, artifactPath, volume: solid.volume, bounds: solid.bounds, cameraAlignment: alignment })}\n`);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    exitCode = 1;
  } finally {
    window.destroy();
    app.exit(exitCode);
  }
});
