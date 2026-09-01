const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-plastic-boss.png');

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
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-plastic-boss-${Date.now()}` } });
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
      const bodies = window.__madcadVerifyEngineState.bodies;
      const body = bodies.find((item) => item.representation === 'brep' && item.topology?.faces?.some((face) => face.descriptor?.geometry === 'PLANE'));
      const face = body?.topology.faces
        .filter((item) => item.descriptor?.geometry === 'PLANE' && item.descriptor?.normal?.[2] > 0.9)
        .sort((a, b) => b.descriptor.center[2] - a.descriptor.center[2])[0];
      if (!body || !face) throw new Error('Brak planarnej górnej ściany do testu Boss.');
      window.__madcadVerifyTopologySelection({ kind: 'face', id: face.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId }, 'replace');
      return { bodyId: body.id, volume: body.metrics.volume, bounds: body.metrics.bounds, faceId: face.id };
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'face'`, 'wybrana ściana');

    await window.webContents.executeJavaScript(`(() => {
      const trigger = [...document.querySelectorAll('.ribbon-tool-menu-trigger')].find((button) => button.textContent.trim() === 'Plastic');
      if (!trigger) throw new Error('Brak menu Plastic.');
      trigger.click();
    })()`);
    await waitFor(window, `[...document.querySelectorAll('.ribbon-tool-submenu button')].some((button) => button.querySelector('strong')?.textContent.trim() === 'Boss' && !button.disabled)`, 'aktywne narzędzie Boss');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-submenu button')].find((button) => button.querySelector('strong')?.textContent.trim() === 'Boss' && !button.disabled).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'plasticBoss' && document.querySelector('.command-dialog')?.textContent.includes('Głębokość otworu')`, 'panel Boss');

    await setField(window, 'Średnica zewnętrzna', '12');
    await setField(window, 'Średnica otworu', '4');
    await setField(window, 'Wysokość', '10');
    await setField(window, 'Głębokość otworu', '3');
    await setField(window, 'Przesunięcie X', '2');
    await setField(window, 'Przesunięcie Y', '-1');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.find((body) => body.id === ${JSON.stringify(source.bodyId)})?.plasticFeatures?.[0]?.outerDiameter === 12`, 'parametryczny podgląd Boss');

    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.at(-1)?.type === 'plasticBoss' && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.find((body) => body.id === ${JSON.stringify(source.bodyId)})?.plasticFeatures?.length === 1`, 'zapisany Boss');

    const result = await window.webContents.executeJavaScript(`(() => {
      const body = window.__madcadVerifyEngineState.bodies.find((item) => item.id === ${JSON.stringify(source.bodyId)});
      const boss = body.plasticFeatures[0];
      const feature = window.__madcadVerifyDocumentState.featureData.at(-1);
      const dialog = document.querySelector('.command-dialog');
      return {
        bodyCount: window.__madcadVerifyEngineState.bodies.length,
        volume: body.metrics.volume,
        bounds: body.metrics.bounds,
        boss,
        featureType: feature.type,
        referenceCount: feature.referenceIds?.length,
        dialogClosed: !dialog,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    if (result.bodyCount !== 2 || result.volume <= source.volume || result.bounds[1][2] <= source.bounds[1][2] || result.boss.outerDiameter !== 12 || result.boss.holeDiameter !== 4 || result.boss.height !== 10 || result.boss.holeDepth !== 3 || result.featureType !== 'plasticBoss' || result.referenceCount !== 1 || !result.dialogClosed || result.horizontalOverflow) {
      throw new Error(`Niepoprawny wynik Boss: ${JSON.stringify({ source, result })}`);
    }

    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && !window.__madcadVerifyEngineState?.bodies?.find((body) => body.id === ${JSON.stringify(source.bodyId)})?.plasticFeatures?.length`, 'cofnięty Boss');
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.find((body) => body.id === ${JSON.stringify(source.bodyId)})?.plasticFeatures?.[0]?.outerDiameter === 12`, 'ponowiony Boss');

    process.stdout.write(`${JSON.stringify({ screenshotPath, source, result }, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
