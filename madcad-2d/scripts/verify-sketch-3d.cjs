const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const artifactPath = path.join(__dirname, '..', 'artifacts', 'sketch-3d-pipe.png');

async function waitFor(window, expression, label, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  const diagnostic = await window.webContents.executeJavaScript(`JSON.stringify({ document: window.__madcadVerifyDocumentState, engine: window.__madcadVerifyEngineState })`);
  throw new Error(`Nie osiągnięto stanu: ${label}. ${diagnostic}`);
}

async function clickTool(window, label) {
  const result = await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.ribbon-tool')].find((item) => item.querySelector('.ribbon-label')?.textContent.trim() === ${JSON.stringify(label)});
    if (!button) return { found: false };
    if (button.disabled) return { found: true, disabled: true };
    button.click();
    return { found: true, disabled: false };
  })()`);
  if (!result.found || result.disabled) throw new Error(`Niedostępne narzędzie: ${label}. ${JSON.stringify(result)}`);
}

async function setField(window, label, value) {
  await window.webContents.executeJavaScript(`(() => {
    const field = [...document.querySelectorAll('.command-dialog .command-field')].find((item) => item.querySelector(':scope > span')?.textContent.trim() === ${JSON.stringify(label)});
    const input = field?.querySelector('input');
    if (!input) throw new Error('Brak pola: ${label}');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: { partition: `madcad-sketch-3d-${Date.now()}` },
  });
  window.webContents.on('console-message', (_event, details) => {
    if (details.level === 'error') console.error(`Renderer: ${details.message}`);
  });
  let exitCode = 0;
  try {
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && document.querySelector('.modeling-shell')`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button[aria-label="Zamknij"]')?.click()`);

    console.log('Etap: uruchomienie szkicu 3D');
    await clickTool(window, 'Szkic 3D');
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'sketch3d' && window.__madcadVerifyDocumentState?.sketches?.[0]?.space === '3d'`, 'aktywny szkic 3D');
    console.log('Etap: pierwszy odcinek');
    await setField(window, 'Koniec X', '30');
    await setField(window, 'Koniec Y', '0');
    await setField(window, 'Koniec Z', '0');
    await clickTool(window, 'Dodaj odcinek');
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 3 && window.__madcadVerifyDocumentState?.command?.segments === 1`, 'pierwszy odcinek XYZ');

    console.log('Etap: drugi odcinek');
    await setField(window, 'Koniec X', '30');
    await setField(window, 'Koniec Y', '20');
    await setField(window, 'Koniec Z', '15');
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 5 && window.__madcadVerifyDocumentState?.command?.segments === 2`, 'drugi odcinek przestrzenny');
    await clickTool(window, 'Cofnij odcinek');
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 3 && window.__madcadVerifyDocumentState?.command?.segments === 1`, 'cofnięty drugi odcinek');
    await setField(window, 'Koniec X', '30');
    await setField(window, 'Koniec Y', '20');
    await setField(window, 'Koniec Z', '15');
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 5 && window.__madcadVerifyDocumentState?.command?.segments === 2`, 'ponownie dodany drugi odcinek');

    const sketch = await window.webContents.executeJavaScript(`structuredClone(window.__madcadVerifyDocumentState.sketches[0])`);
    const points = sketch.entityData.filter((entity) => entity.type === 'point').map((entity) => [Number(entity.geometry.x), Number(entity.geometry.y), Number(entity.geometry.z)]);
    if (JSON.stringify(points) !== JSON.stringify([[0, 0, 0], [30, 0, 0], [30, 20, 15]])) throw new Error(`Błędne punkty szkicu 3D: ${JSON.stringify(points)}`);

    console.log('Etap: Pipe');
    await clickTool(window, 'Rura');
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'pipe' && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 1`, 'podgląd Pipe po ścieżce 3D', 45000);
    await setField(window, 'Średnica zewnętrzna', '6');
    await setField(window, 'Grubość ścianki', '1');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume > 0`, 'przeliczony Pipe 3D', 45000);
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.type === 'pipe' && !window.__madcadVerifyDocumentState?.command && !document.querySelector('.command-dialog') && window.__madcadVerifyEngineState?.status === 'ready'`, 'zapisany Pipe 3D', 45000);

    await fs.mkdir(path.dirname(artifactPath), { recursive: true });
    await fs.writeFile(artifactPath, (await window.webContents.capturePage()).toPNG());
    const beforeReopen = await window.webContents.executeJavaScript(`({
      volume: window.__madcadVerifyEngineState.bodies[0].metrics.volume,
      dimensions: window.__madcadVerifyEngineState.bodies[0].metrics.dimensions,
      representation: window.__madcadVerifyEngineState.bodies[0].representation,
      pathSpace: window.__madcadVerifyDocumentState.sketches[0].space,
      pathEntityIds: window.__madcadVerifyDocumentState.featureData[0].pathEntityIds,
    })`);
    if (beforeReopen.representation !== 'brep' || beforeReopen.pathSpace !== '3d' || beforeReopen.pathEntityIds.length !== 2 || beforeReopen.volume <= 0) throw new Error(`Błędny Pipe 3D: ${JSON.stringify(beforeReopen)}`);

    await window.webContents.executeJavaScript(`window.__madcadVerifyReopenCurrentDocument()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.space === '3d' && window.__madcadVerifyDocumentState?.featureData?.[0]?.type === 'pipe' && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 1`, 'Pipe 3D po ponownym otwarciu', 45000);
    const afterReopen = await window.webContents.executeJavaScript(`({ volume: window.__madcadVerifyEngineState.bodies[0].metrics.volume, dimensions: window.__madcadVerifyEngineState.bodies[0].metrics.dimensions })`);
    if (Math.abs(afterReopen.volume - beforeReopen.volume) > 0.001 || JSON.stringify(afterReopen.dimensions) !== JSON.stringify(beforeReopen.dimensions)) throw new Error(`Pipe 3D zmienił się po otwarciu: ${JSON.stringify({ beforeReopen, afterReopen })}`);

    await clickTool(window, 'Szkic 3D');
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'sketch3d' && window.__madcadVerifyDocumentState?.activeSketchId`, 'drugi tryb szkicu 3D');
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
    await waitFor(window, `!window.__madcadVerifyDocumentState?.command && !window.__madcadVerifyDocumentState?.activeSketchId && window.__madcadVerifyDocumentState?.sketches?.length === 2`, 'bezpieczne zakończenie pustego szkicu 3D przez Esc');

    console.log(JSON.stringify({ ok: true, sketchSegments: 2, undoVerified: true, escapeVerified: true, points, pipe: afterReopen, screenshot: artifactPath }, null, 2));
  } catch (error) {
    exitCode = 1;
    console.error(error);
  } finally {
    window.destroy();
    app.exit(exitCode);
  }
});
