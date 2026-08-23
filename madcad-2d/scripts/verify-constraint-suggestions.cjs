const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const artifactsDir = path.join(__dirname, '..', 'artifacts');
const screenshotPath = path.join(artifactsDir, 'madcad-constraint-suggestions.png');

async function waitFor(window, expression, label, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

function sendKey(window, keyCode) {
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode });
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1600,
    height: 980,
    show: true,
    webPreferences: { partition: `madcad-constraint-verifier-${Date.now()}` },
  });
  window.setContentSize(1600, 917);

  try {
    await fs.mkdir(artifactsDir, { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'interfejs aplikacji');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await waitFor(window, `!document.querySelector('.license-info-dialog')`, 'zamknięcie informacji licencyjnej');
    await window.webContents.executeJavaScript(`(() => {
      const button = [...document.querySelectorAll('.ribbon-tool')].find((item) => item.querySelector('.ribbon-label')?.textContent.trim() === 'Utwórz szkic');
      button?.click();
    })()`);
    await waitFor(window, `document.querySelector('.plane-picker')`, 'wybór płaszczyzny');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.plane-options button')].find((item) => item.textContent.includes('XY'))?.click()`);
    await waitFor(window, `document.querySelector('.model-viewport.sketch-view') && window.__madcadSketchLocalToScreen`, 'aktywny szkic');
    sendKey(window, 'L');
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'line'`, 'polecenie linii');

    await window.webContents.executeJavaScript(`window.__madcadVerifySketchPoint([-20, 0])`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.points === 1`, 'punkt początkowy');
    const end = await window.webContents.executeJavaScript(`window.__madcadSketchLocalToScreen(25, 1)`);
    window.webContents.sendInputEvent({ type: 'mouseMove', x: end.x, y: end.y });
    await waitFor(window, `document.querySelector('.sketch-constraint-suggestion')?.dataset.constraintSuggestion === 'horizontal'`, 'podpowiedź więzu poziomego');
    const preview = await window.webContents.executeJavaScript(`(() => {
      const item = document.querySelector('.sketch-constraint-suggestion');
      const rect = item.getBoundingClientRect();
      const viewport = document.querySelector('.model-viewport').getBoundingClientRect();
      return {
        type: item.dataset.constraintSuggestion,
        text: item.textContent.trim(),
        insideViewport: rect.left >= viewport.left && rect.top >= viewport.top && rect.right <= viewport.right && rect.bottom <= viewport.bottom,
      };
    })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`window.__madcadVerifySketchPoint([25, 1])`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.constraints?.some((constraint) => constraint.type === 'horizontal' && constraint.automatic)`, 'automatyczny więz w dokumencie');
    const result = await window.webContents.executeJavaScript(`(() => {
      const sketch = window.__madcadVerifyDocumentState.sketches.at(-1);
      return { constraints: sketch.constraints, entities: sketch.entityData };
    })()`);
    if (!preview.insideViewport || !preview.text.includes('Poziomo') || !result.constraints.some((constraint) => constraint.type === 'horizontal' && constraint.automatic)) {
      throw new Error(`Niepoprawna automatyczna sugestia więzu: ${JSON.stringify({ preview, result })}`);
    }
    process.stdout.write(`${JSON.stringify({ screenshotPath, preview, automaticConstraint: result.constraints.find((constraint) => constraint.automatic) }, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
