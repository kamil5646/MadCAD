const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const artifactPath = path.join(__dirname, '..', 'artifacts', 'extrude-after-sketch.png');
const thinArtifactPath = path.join(__dirname, '..', 'artifacts', 'thin-extrude-after-sketch.png');

async function waitFor(window, expression, label, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Nie osiagnieto stanu: ${label}`);
}

async function clickTool(window, label) {
  await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.ribbon-tool')].find((item) => item.querySelector('.ribbon-label')?.textContent === ${JSON.stringify(label)});
    if (!button || button.disabled) throw new Error('Niedostepne narzedzie: ${label}');
    button.click();
  })()`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: { partition: `madcad-extrude-sketch-${Date.now()}` },
  });
  let exitCode = 0;
  try {
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready'`, 'gotowy silnik CAD');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button[aria-label="Zamknij"]')?.click()`);

    await clickTool(window, 'Utwórz szkic');
    await waitFor(window, `Boolean(document.querySelector('.plane-options'))`, 'wybor plaszczyzny');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.plane-options button')].find((button) => button.textContent.includes('XY'))?.click()`);
    await waitFor(window, `document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'aktywny szkic XY');

    await clickTool(window, 'Prostokąt');
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'rectangle'`, 'polecenie prostokata');
    await window.webContents.executeJavaScript(`window.__madcadVerifyCanvasSketchPoint([0, 0])`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.gesturePoints === 1`, 'pierwszy punkt prostokata');
    await window.webContents.executeJavaScript(`window.__madcadVerifyCanvasSketchPoint([20, 12])`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.profiles === 1`, 'zamkniety profil prostokata');

    await clickTool(window, 'Zakończ szkic');
    await waitFor(window, `window.__madcadCompletedSketchVisibilityState?.profileCount === 1 && window.__madcadCompletedSketchVisibilityState?.renderedObjects > 0`, 'widoczny ukonczony szkic');

    await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(null)`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'document'`, 'utracone zaznaczenie profilu');
    await clickTool(window, 'Wyciągnij');
    await waitFor(window, `document.querySelector('.command-dialog')?.textContent.includes('Wyciągnięcie') && !document.querySelector('.plane-options')`, 'wyciagniecie bez ponownego wyboru plaszczyzny');
    await fs.mkdir(path.dirname(artifactPath), { recursive: true });
    await fs.writeFile(artifactPath, (await window.webContents.capturePage()).toPNG());

    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog .confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 1`, 'utworzona bryla', 30000);
    const result = await window.webContents.executeJavaScript(`({
      sketches: window.__madcadVerifyDocumentState.sketches.length,
      profiles: window.__madcadVerifyDocumentState.sketches[0].profiles,
      features: window.__madcadVerifyDocumentState.features,
      bodies: window.__madcadVerifyEngineState.bodies.length,
      volume: window.__madcadVerifyEngineState.bodies[0].metrics.volume,
      planePickerVisible: Boolean(document.querySelector('.plane-options')),
    })`);
    if (result.sketches !== 1 || result.profiles !== 1 || result.features !== 1 || result.bodies !== 1 || result.planePickerVisible || Math.abs(result.volume - 9600) > 0.01) {
      throw new Error(`Bledny wynik przeplywu szkic -> Wyciagnij: ${JSON.stringify(result)}`);
    }

    await window.webContents.executeJavaScript(`localStorage.clear()`);
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready'`, 'gotowy silnik dla otwartego szkicu');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button[aria-label="Zamknij"]')?.click()`);
    await clickTool(window, 'Utwórz szkic');
    await waitFor(window, `Boolean(document.querySelector('.plane-options'))`, 'wybor plaszczyzny otwartego szkicu');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.plane-options button')].find((button) => button.textContent.includes('XY'))?.click()`);
    await waitFor(window, `document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'aktywny otwarty szkic XY');
    await clickTool(window, 'Linia');
    await window.webContents.executeJavaScript(`window.__madcadVerifyCanvasSketchPoint([0, 0])`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.points === 1`, 'poczatek linii');
    await window.webContents.executeJavaScript(`window.__madcadVerifyCanvasSketchPoint([20, 0])`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 3 && !window.__madcadVerifyDocumentState?.command`, 'gotowa linia');
    await clickTool(window, 'Zakończ szkic');
    await waitFor(window, `window.__madcadCompletedSketchVisibilityState?.entityCount > 0 && window.__madcadCompletedSketchVisibilityState?.renderedObjects > 0`, 'widoczny otwarty szkic');
    await clickTool(window, 'Wyciągnij');
    await waitFor(window, `document.querySelector('.command-dialog')?.textContent.includes('Wyciągnięcie') && document.querySelector('.command-field input[type="checkbox"]')?.checked && !document.querySelector('.plane-options')`, 'cienkie wyciagniecie bez nowej plaszczyzny');
    await new Promise((resolve) => setTimeout(resolve, 250));
    await fs.writeFile(thinArtifactPath, (await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog .confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 1`, 'cienka bryla', 30000);
    const thinResult = await window.webContents.executeJavaScript(`({
      features: window.__madcadVerifyDocumentState.features,
      bodies: window.__madcadVerifyEngineState.bodies.length,
      thin: window.__madcadVerifyDocumentState.featureData[0].thin,
      openEntityIds: window.__madcadVerifyDocumentState.featureData[0].openEntityIds.length,
      volume: window.__madcadVerifyEngineState.bodies[0].metrics.volume,
      planePickerVisible: Boolean(document.querySelector('.plane-options')),
    })`);
    if (thinResult.features !== 1 || thinResult.bodies !== 1 || !thinResult.thin || thinResult.openEntityIds !== 1 || thinResult.planePickerVisible || Math.abs(thinResult.volume - 400) > 0.01) {
      throw new Error(`Bledny wynik otwartego szkicu: ${JSON.stringify(thinResult)}`);
    }
    process.stdout.write(`${JSON.stringify({ ok: true, artifactPath, thinArtifactPath, closedProfile: result, openChain: thinResult })}\n`);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    exitCode = 1;
  } finally {
    window.destroy();
    app.exit(exitCode);
  }
});
