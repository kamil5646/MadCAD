const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const artifactsDir = path.join(__dirname, '..', 'artifacts');
const screenshotPath = path.join(artifactsDir, process.env.MADCAD_SNAP_SCREENSHOT || 'madcad-snap-feedback.png');
const deleteScreenshotPath = path.join(artifactsDir, 'madcad-delete-action.png');
const baselineOnly = process.env.MADCAD_CAPTURE_BASELINE === '1';

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

function movePointer(window, point) {
  window.webContents.sendInputEvent({ type: 'mouseMove', x: point.x, y: point.y });
}

async function clickTool(window, label) {
  await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.ribbon-tool')]
      .find((item) => item.querySelector('.ribbon-label')?.textContent.trim() === ${JSON.stringify(label)});
    if (!button) throw new Error('Brak narzędzia: ${label}');
    button.click();
  })()`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1600,
    height: 980,
    show: true,
    webPreferences: { partition: `madcad-snap-verifier-${Date.now()}` },
  });
  window.setContentSize(1600, 917);

  try {
    await fs.mkdir(artifactsDir, { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'interfejs aplikacji');
    await window.webContents.executeJavaScript(`(() => {
      const dialog = document.querySelector('.license-info-dialog');
      const button = dialog?.querySelector('button.confirm');
      button?.click();
    })()`);
    await waitFor(window, `!document.querySelector('.license-info-dialog')`, 'zamknięcie informacji licencyjnej');

    await clickTool(window, 'Utwórz szkic');
    await waitFor(window, `document.querySelector('.plane-picker')`, 'wybór płaszczyzny');
    await window.webContents.executeJavaScript(`(() => {
      const button = [...document.querySelectorAll('.plane-options button')].find((item) => item.textContent.includes('XY'));
      if (!button) throw new Error('Brak płaszczyzny XY');
      button.click();
    })()`);
    await waitFor(window, `document.querySelector('.model-viewport.sketch-view') && window.__madcadSketchLocalToScreen`, 'aktywny szkic');

    sendKey(window, 'L');
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'line'`, 'polecenie linii');
    let state = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const origin = await window.webContents.executeJavaScript(`window.__madcadSketchLocalToScreen(0, 0)`);
      movePointer(window, origin);
      await new Promise((resolve) => setTimeout(resolve, 100));
      state = await window.webContents.executeJavaScript(`(() => {
        const marker = document.querySelector('.sketch-snap-marker');
        const canvas = document.querySelector('.model-viewport canvas');
        const markerRect = marker?.getBoundingClientRect();
        const canvasRect = canvas?.getBoundingClientRect();
        return {
          markerVisible: Boolean(marker && getComputedStyle(marker).visibility !== 'hidden' && markerRect?.width && markerRect?.height),
          text: marker?.textContent?.trim() || '',
          type: marker?.dataset.snapType || '',
          insideViewport: Boolean(markerRect && canvasRect && markerRect.left >= canvasRect.left && markerRect.top >= canvasRect.top && markerRect.right <= canvasRect.right && markerRect.bottom <= canvasRect.bottom),
        };
      })()`);
      if (state.markerVisible && state.text.includes('SNAP') && state.type && state.insideViewport) break;
    }

    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    if (!baselineOnly && (!state.markerVisible || !state.text.includes('SNAP') || !state.type || !state.insideViewport)) {
      throw new Error(`Niejednoznaczna informacja o aktywnym snapie: ${JSON.stringify(state)}`);
    }

    let deleteAction = null;
    if (!baselineOnly) {
      await window.webContents.executeJavaScript(`window.__madcadVerifyLoadPatternFixture('rectangular')`);
      await waitFor(window, `document.querySelector('.model-viewport.sketch-view') && window.__madcadPatternFixtureIds?.lineIds?.length === 4`, 'szkic testowy usuwania');
      const lineId = await window.webContents.executeJavaScript(`window.__madcadPatternFixtureIds.lineIds[0]`);
      await window.webContents.executeJavaScript(`window.__madcadVerifySketchSelection([${JSON.stringify(lineId)}], 'replace')`);
      await waitFor(window, `document.querySelector('.sketch-selection-actions button')?.textContent.includes('Usuń')`, 'widoczna akcja usuwania');
      deleteAction = await window.webContents.executeJavaScript(`(() => {
        const action = document.querySelector('.sketch-selection-actions');
        const button = action?.querySelector('button');
        return { visible: Boolean(action && button), text: action?.textContent?.trim() || '', title: button?.title || '' };
      })()`);
      await fs.writeFile(deleteScreenshotPath, (await window.webContents.capturePage()).toPNG());
      await window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }))`);
      await waitFor(window, `!window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entityData?.some((entity) => entity.id === ${JSON.stringify(lineId)})`, 'usunięcie linii klawiszem Backspace');
    }

    process.stdout.write(`${JSON.stringify({ screenshotPath, deleteScreenshotPath: baselineOnly ? null : deleteScreenshotPath, ...state, deleteAction }, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
