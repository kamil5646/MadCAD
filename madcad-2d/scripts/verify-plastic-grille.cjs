const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-plastic-grille.png');

async function waitFor(window, expression, label, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  const diagnostic = await window.webContents.executeJavaScript(`JSON.stringify({ engine: window.__madcadVerifyEngineState, document: window.__madcadVerifyDocumentState })`);
  throw new Error(`Przekroczono czas oczekiwania: ${label}. ${diagnostic}`);
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
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-plastic-grille-${Date.now()}` } });
  window.setContentSize(1440, 837);
  let exitCode = 0;
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell') && window.__madcadVerifyLoadTimelineFixture`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 2`, 'model testowy');

    const source = await window.webContents.executeJavaScript(`(() => {
      const body = [...window.__madcadVerifyEngineState.bodies]
        .filter((item) => item.representation === 'brep' && item.topology?.faces?.some((face) => face.descriptor?.geometry === 'PLANE'))
        .sort((a, b) => b.metrics.volume - a.metrics.volume)[0];
      const face = body?.topology.faces
        .filter((item) => item.descriptor?.geometry === 'PLANE' && item.descriptor?.normal?.[2] > 0.9)
        .sort((a, b) => b.descriptor.center[2] - a.descriptor.center[2])[0];
      if (!body || !face) throw new Error('Brak planarnej górnej ściany do testu Grille.');
      window.__madcadVerifyTopologySelection({ kind: 'face', id: face.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId }, 'replace');
      return { bodyId: body.id, volume: body.metrics.volume, bounds: body.metrics.bounds, faceId: face.id };
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'face'`, 'wybrana ściana');

    await window.webContents.executeJavaScript(`(() => {
      const trigger = [...document.querySelectorAll('.ribbon-tool-menu-trigger')].find((button) => button.textContent.trim() === 'Plastic');
      if (!trigger) throw new Error('Brak menu Plastic.');
      trigger.click();
    })()`);
    await waitFor(window, `[...document.querySelectorAll('.ribbon-tool-submenu button')].some((button) => button.querySelector('strong')?.textContent.trim() === 'Grille' && !button.disabled)`, 'aktywne narzędzie Grille');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-submenu button')].find((button) => button.querySelector('strong')?.textContent.trim() === 'Grille' && !button.disabled).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'plasticGrille' && document.querySelector('.command-dialog')?.textContent.includes('Liczba żeber')`, 'panel Grille');

    await setField(window, 'Liczba żeber', '4');
    await setField(window, 'Szerokość żebra', '2');
    await setField(window, 'Prześwit', '2');
    await setField(window, 'Długość szczelin', '20');
    await setField(window, 'Głębokość', '4');
    await setField(window, 'Przesunięcie X', '0');
    await setField(window, 'Przesunięcie Y', '18');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.find((body) => body.id === ${JSON.stringify(source.bodyId)})?.plasticFeatures?.[0]?.ribCount === 4`, 'parametryczny podgląd Grille');

    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.at(-1)?.type === 'plasticGrille' && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.find((body) => body.id === ${JSON.stringify(source.bodyId)})?.plasticFeatures?.length === 1`, 'zapisane Grille');

    const result = await window.webContents.executeJavaScript(`(() => {
      const body = window.__madcadVerifyEngineState.bodies.find((item) => item.id === ${JSON.stringify(source.bodyId)});
      const grille = body.plasticFeatures[0];
      const feature = window.__madcadVerifyDocumentState.featureData.at(-1);
      return {
        bodyCount: window.__madcadVerifyEngineState.bodies.length,
        volume: body.metrics.volume,
        bounds: body.metrics.bounds,
        grille,
        featureType: feature.type,
        referenceCount: feature.referenceIds?.length,
        dialogClosed: !document.querySelector('.command-dialog'),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    if (result.bodyCount !== 2 || result.volume >= source.volume || result.grille.ribCount !== 4 || result.grille.ribWidth !== 2 || result.grille.gap !== 2 || result.grille.length !== 20 || result.grille.depth !== 4 || result.featureType !== 'plasticGrille' || result.referenceCount !== 1 || !result.dialogClosed || result.horizontalOverflow) {
      throw new Error(`Niepoprawny wynik Grille: ${JSON.stringify({ source, result })}`);
    }

    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && !window.__madcadVerifyEngineState?.bodies?.find((body) => body.id === ${JSON.stringify(source.bodyId)})?.plasticFeatures?.length`, 'cofnięte Grille');
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.find((body) => body.id === ${JSON.stringify(source.bodyId)})?.plasticFeatures?.[0]?.ribCount === 4`, 'ponowione Grille');
    await window.webContents.executeJavaScript(`window.__madcadVerifyReopenCurrentDocument()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.featureData?.at(-1)?.type === 'plasticGrille' && window.__madcadVerifyEngineState?.bodies?.find((body) => body.id === ${JSON.stringify(source.bodyId)})?.plasticFeatures?.[0]?.depth === 4`, 'Grille po ponownym otwarciu projektu');

    process.stdout.write(`${JSON.stringify({ screenshotPath, source, result }, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
