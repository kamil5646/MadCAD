const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-surface-modeling.png');

async function waitFor(window, expression, label, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-surface-${Date.now()}` } });
  window.setContentSize(1440, 837);
  let exitCode = 0;
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell') && window.__madcadVerifyLoadSurfaceFixture`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadSurfaceFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.bodyKinds?.[0] === 'surface'`, 'dokładna powierzchnia Patch');
    await window.webContents.executeJavaScript(`(() => {
      const bodyId = window.__madcadVerifyDocumentState.bodyIds[0];
      window.__madcadVerifyTopologySelection({ kind: 'body', id: bodyId, bodyId });
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'body'`, 'zaznaczona powierzchnia');
    await window.webContents.executeJavaScript(`(() => {
      const trigger = [...document.querySelectorAll('.ribbon-tool-menu-trigger')].find((button) => button.textContent.trim() === 'Powierzchnie');
      if (!trigger) throw new Error('Brak menu Powierzchnie.');
      trigger.click();
    })()`);
    await waitFor(window, `[...document.querySelectorAll('.ribbon-tool-submenu button')].some((button) => button.querySelector('strong')?.textContent.trim() === 'Pogrub powierzchnię' && !button.disabled)`, 'aktywne polecenie Pogrub');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-submenu button')].find((button) => button.querySelector('strong')?.textContent.trim() === 'Pogrub powierzchnię' && !button.disabled).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'thickenSurface' && document.querySelector('.command-dialog')`, 'panel Pogrub');
    await window.webContents.executeJavaScript(`(() => { const select = [...document.querySelectorAll('.command-field')].find((label) => label.querySelector('span')?.textContent.trim() === 'Strona')?.querySelector('select'); if (!select) throw new Error('Brak wyboru strony pogrubienia.'); select.value = 'symmetric'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.previewReady && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.bodyKind === 'solid'`, 'symetryczny podgląd bryły po pogrubieniu');
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.length === 2 && window.__madcadVerifyDocumentState.featureData[1].type === 'thickenSurface' && window.__madcadVerifyDocumentState.bodyKinds[0] === 'solid' && window.__madcadVerifyEngineState?.status === 'ready'`, 'zapisane pogrubienie');
    const patchMetrics = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics`);

    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadSurfaceFixture('extrude-transformed')`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.featureData?.[0]?.type === 'surfaceExtrude' && window.__madcadVerifyDocumentState?.featureData?.[1]?.type === 'transform' && window.__madcadVerifyDocumentState?.bodyKinds?.[0] === 'surface'`, 'przesunięta powierzchnia wyciągnięta');
    await window.webContents.executeJavaScript(`(() => { const bodyId = window.__madcadVerifyDocumentState.bodyIds[0]; window.__madcadVerifyTopologySelection({ kind: 'body', id: bodyId, bodyId }); })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'body'`, 'zaznaczona powierzchnia wyciągnięta');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-menu-trigger')].find((button) => button.textContent.trim() === 'Powierzchnie').click()`);
    await waitFor(window, `[...document.querySelectorAll('.ribbon-tool-submenu button')].some((button) => button.querySelector('strong')?.textContent.trim() === 'Pogrub powierzchnię' && !button.disabled)`, 'Pogrub dla powierzchni wyciągniętej');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-submenu button')].find((button) => button.querySelector('strong')?.textContent.trim() === 'Pogrub powierzchnię' && !button.disabled).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.previewReady && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.bodyKind === 'solid'`, 'podgląd pogrubionej powierzchni wyciągniętej');
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.length === 3 && window.__madcadVerifyDocumentState.featureData[2].type === 'thickenSurface' && window.__madcadVerifyDocumentState.bodyKinds[0] === 'solid'`, 'zapisane pogrubienie przesuniętej powierzchni wyciągniętej');
    const extrudeMetrics = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics`);

    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadSurfaceFixture('revolve-source')`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.activeSketchId && window.__madcadVerifyDocumentState?.featureData?.length === 0`, 'otwarty szkic Surface Revolve');
    await window.webContents.executeJavaScript(`(() => {
      const line = window.__madcadVerifyDocumentState.sketches[0].entityData.find((entity) => entity.type === 'line');
      if (!line) throw new Error('Brak tworzącej Surface Revolve.');
      window.__madcadVerifySketchSelection([line.id], 'replace');
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'sketchEntities' && window.__madcadVerifyDocumentState.selection.ids?.length === 1`, 'zaznaczona tworząca Surface Revolve');
    await window.webContents.executeJavaScript(`(() => {
      const trigger = [...document.querySelectorAll('.ribbon-tool-menu-trigger')].find((button) => button.textContent.trim() === 'Utwórz 3D');
      if (!trigger) throw new Error('Brak menu Utwórz 3D.');
      trigger.click();
    })()`);
    await waitFor(window, `[...document.querySelectorAll('.ribbon-tool-submenu button')].some((button) => button.querySelector('strong')?.textContent.trim() === 'Obróć powierzchnię' && !button.disabled)`, 'aktywne polecenie Surface Revolve');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-submenu button')].find((button) => button.querySelector('strong')?.textContent.trim() === 'Obróć powierzchnię' && !button.disabled).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'surfaceRevolve' && window.__madcadVerifyDocumentState.command.previewReady && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.bodyKind === 'surface'`, 'podgląd obrotu powierzchni');
    const revolveSurfaceMetrics = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics`);
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.length === 1 && window.__madcadVerifyDocumentState.featureData[0].type === 'surfaceRevolve' && window.__madcadVerifyDocumentState.bodyKinds[0] === 'surface'`, 'zapisany Surface Revolve');
    await window.webContents.executeJavaScript(`(() => { const bodyId = window.__madcadVerifyDocumentState.bodyIds[0]; window.__madcadVerifyTopologySelection({ kind: 'body', id: bodyId, bodyId }); })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'body'`, 'zaznaczona powierzchnia obrotowa');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-menu-trigger')].find((button) => button.textContent.trim() === 'Powierzchnie').click()`);
    await waitFor(window, `[...document.querySelectorAll('.ribbon-tool-submenu button')].some((button) => button.querySelector('strong')?.textContent.trim() === 'Pogrub powierzchnię' && !button.disabled)`, 'Pogrub dla Surface Revolve');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-submenu button')].find((button) => button.querySelector('strong')?.textContent.trim() === 'Pogrub powierzchnię' && !button.disabled).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.previewReady && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.bodyKind === 'solid'`, 'podgląd pogrubionej powierzchni obrotowej');
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.length === 2 && window.__madcadVerifyDocumentState.featureData[1].type === 'thickenSurface' && window.__madcadVerifyDocumentState.bodyKinds[0] === 'solid'`, 'zapisane pogrubienie Surface Revolve');
    const revolveSolidMetrics = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics`);

    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadSurfaceFixture('sweep-source')`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.activeSketchId && window.__madcadVerifyDocumentState?.sketches?.length === 2 && window.__madcadVerifyDocumentState?.featureData?.length === 0`, 'otwarty szkic Surface Sweep');
    await window.webContents.executeJavaScript(`(() => {
      const line = window.__madcadVerifyDocumentState.sketches[0].entityData.find((entity) => entity.type === 'line');
      if (!line) throw new Error('Brak profilu Surface Sweep.');
      window.__madcadVerifySketchSelection([line.id], 'replace');
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'sketchEntities' && window.__madcadVerifyDocumentState.selection.ids?.length === 1`, 'zaznaczony profil Surface Sweep');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-menu-trigger')].find((button) => button.textContent.trim() === 'Utwórz 3D').click()`);
    await waitFor(window, `[...document.querySelectorAll('.ribbon-tool-submenu button')].some((button) => button.querySelector('strong')?.textContent.trim() === 'Powierzchnia po ścieżce' && !button.disabled)`, 'aktywne polecenie Surface Sweep');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-submenu button')].find((button) => button.querySelector('strong')?.textContent.trim() === 'Powierzchnia po ścieżce' && !button.disabled).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'surfaceSweep' && window.__madcadVerifyDocumentState.command.previewReady && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.bodyKind === 'surface'`, 'podgląd Surface Sweep');
    const sweepSurfaceMetrics = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics`);
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.length === 1 && window.__madcadVerifyDocumentState.featureData[0].type === 'surfaceSweep' && window.__madcadVerifyDocumentState.bodyKinds[0] === 'surface'`, 'zapisany Surface Sweep');
    await window.webContents.executeJavaScript(`(() => { const bodyId = window.__madcadVerifyDocumentState.bodyIds[0]; window.__madcadVerifyTopologySelection({ kind: 'body', id: bodyId, bodyId }); })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'body'`, 'zaznaczona powierzchnia Sweep');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-menu-trigger')].find((button) => button.textContent.trim() === 'Powierzchnie').click()`);
    await waitFor(window, `[...document.querySelectorAll('.ribbon-tool-submenu button')].some((button) => button.querySelector('strong')?.textContent.trim() === 'Pogrub powierzchnię' && !button.disabled)`, 'Pogrub dla Surface Sweep');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-submenu button')].find((button) => button.querySelector('strong')?.textContent.trim() === 'Pogrub powierzchnię' && !button.disabled).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.previewReady && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.bodyKind === 'solid'`, 'podgląd pogrubionej powierzchni Sweep');
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.length === 2 && window.__madcadVerifyDocumentState.featureData[1].type === 'thickenSurface' && window.__madcadVerifyDocumentState.bodyKinds[0] === 'solid'`, 'zapisane pogrubienie Surface Sweep');

    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadSurfaceFixture('loft-source')`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'profile' && window.__madcadVerifyDocumentState?.sketches?.length === 2 && window.__madcadVerifyDocumentState?.featureData?.length === 0`, 'wybrany profil Surface Loft');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-menu-trigger')].find((button) => button.textContent.trim() === 'Powierzchnie').click()`);
    await waitFor(window, `[...document.querySelectorAll('.ribbon-tool-submenu button')].some((button) => button.querySelector('strong')?.textContent.trim() === 'Powierzchnia przejściowa' && !button.disabled)`, 'aktywne polecenie Surface Loft');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-submenu button')].find((button) => button.querySelector('strong')?.textContent.trim() === 'Powierzchnia przejściowa' && !button.disabled).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'surfaceLoft' && window.__madcadVerifyDocumentState.command.previewReady && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.bodyKind === 'surface'`, 'podgląd Surface Loft');
    const loftSurfaceMetrics = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics`);
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.length === 1 && window.__madcadVerifyDocumentState.featureData[0].type === 'surfaceLoft' && window.__madcadVerifyDocumentState.bodyKinds[0] === 'surface'`, 'zapisany Surface Loft');
    await window.webContents.executeJavaScript(`(() => { const bodyId = window.__madcadVerifyDocumentState.bodyIds[0]; window.__madcadVerifyTopologySelection({ kind: 'body', id: bodyId, bodyId }); })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'body'`, 'zaznaczona powierzchnia Loft');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-menu-trigger')].find((button) => button.textContent.trim() === 'Powierzchnie').click()`);
    await waitFor(window, `[...document.querySelectorAll('.ribbon-tool-submenu button')].some((button) => button.querySelector('strong')?.textContent.trim() === 'Pogrub powierzchnię' && !button.disabled)`, 'Pogrub dla Surface Loft');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-submenu button')].find((button) => button.querySelector('strong')?.textContent.trim() === 'Pogrub powierzchnię' && !button.disabled).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.previewReady && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.bodyKind === 'solid'`, 'podgląd pogrubionej powierzchni Loft');
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.length === 2 && window.__madcadVerifyDocumentState.featureData[1].type === 'thickenSurface' && window.__madcadVerifyDocumentState.bodyKinds[0] === 'solid'`, 'zapisane pogrubienie Surface Loft');
    const loftSolidMetrics = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics`);

    const result = await window.webContents.executeJavaScript(`(() => ({
      featureTypes: window.__madcadVerifyDocumentState.featureData.map((feature) => feature.type),
      bodyKinds: window.__madcadVerifyDocumentState.bodyKinds,
      volume: window.__madcadVerifyEngineState.bodies[0].metrics.volume,
      surfaceFolder: [...document.querySelectorAll('.tree-folder span')].some((item) => item.textContent.trim() === 'Powierzchnie'),
      solidFolder: [...document.querySelectorAll('.tree-folder span')].some((item) => item.textContent.trim() === 'Bryły'),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    }))()`);
    result.patchVolume = patchMetrics.volume;
    result.patchBoundsZ = [patchMetrics.bounds[0][2], patchMetrics.bounds[1][2]];
    result.revolveSurfaceArea = revolveSurfaceMetrics.area;
    result.revolveSurfaceVolume = revolveSurfaceMetrics.volume;
    result.revolveSolidVolume = revolveSolidMetrics.volume;
    result.sweepSurfaceArea = sweepSurfaceMetrics.area;
    result.loftSurfaceArea = loftSurfaceMetrics.area;
    result.loftSolidVolume = loftSolidMetrics.volume;
    result.extrudeCenterX = (extrudeMetrics.bounds[0][0] + extrudeMetrics.bounds[1][0]) / 2;
    result.extrudeVolume = extrudeMetrics.volume;
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    if (result.patchVolume <= 0 || Math.abs(result.patchBoundsZ[0] + 1) > 0.01 || Math.abs(result.patchBoundsZ[1] - 1) > 0.01 || result.extrudeVolume <= 0 || Math.abs(result.extrudeCenterX - 35) > 0.01 || result.revolveSolidVolume <= 0 || result.revolveSurfaceArea <= 0 || result.volume <= 0 || result.sweepSurfaceArea <= 0 || result.loftSurfaceArea <= 0 || result.loftSolidVolume <= 0 || !result.surfaceFolder || !result.solidFolder || result.horizontalOverflow) throw new Error(`Niepoprawny przepływ powierzchniowy: ${JSON.stringify(result)}`);
    process.stdout.write(`${JSON.stringify({ screenshotPath, ...result }, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    try {
      const diagnostic = await window.webContents.executeJavaScript(`({ command: window.__madcadVerifyDocumentState?.command, engineStatus: window.__madcadVerifyEngineState?.status, bodies: window.__madcadVerifyEngineState?.bodies, timeline: window.__madcadVerifyEngineState?.timeline, diagnostics: window.__madcadVerifyEngineState?.diagnostics, featureTypes: window.__madcadVerifyDocumentState?.featureData?.map((feature) => feature.type) })`);
      process.stderr.write(`${JSON.stringify(diagnostic, null, 2)}\n`);
    } catch {}
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
