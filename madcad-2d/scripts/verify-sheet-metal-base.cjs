const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-sheet-metal-flat-pattern.png');

async function waitFor(window, expression, label, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  const diagnostic = await window.webContents.executeJavaScript(`JSON.stringify({ engine: window.__madcadVerifyEngineState, command: window.__madcadVerifyDocumentState?.command })`);
  throw new Error(`Nie osiągnięto stanu: ${label}. ${diagnostic}`);
}

async function clickTool(window, label) {
  await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.ribbon-tool')].find((item) => item.querySelector('.ribbon-label')?.textContent.trim() === ${JSON.stringify(label)});
    if (!button || button.disabled) throw new Error('Niedostępne narzędzie: ${label}');
    button.click();
  })()`);
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
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-sheet-metal-${Date.now()}` } });
  window.setContentSize(1440, 837);
  let exitCode = 0;
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && document.querySelector('.modeling-shell')`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button[aria-label="Zamknij"]')?.click()`);

    await clickTool(window, 'Utwórz szkic');
    await waitFor(window, `document.querySelector('.plane-options')`, 'wybór płaszczyzny');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.plane-options button')].find((button) => button.textContent.includes('XY')).click()`);
    await clickTool(window, 'Prostokąt');
    await window.webContents.executeJavaScript(`window.__madcadVerifyCanvasSketchPoint([0, 0])`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.gesturePoints === 1`, 'środek prostokąta');
    await window.webContents.executeJavaScript(`window.__madcadVerifyCanvasSketchPoint([20, 12])`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.profiles === 1`, 'zamknięty profil');
    await clickTool(window, 'Zakończ szkic');
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'profile' && !window.__madcadVerifyDocumentState?.activeSketchId`, 'profil gotowy do modelowania');

    await window.webContents.executeJavaScript(`(() => {
      const trigger = [...document.querySelectorAll('.ribbon-tool-menu-trigger')].find((button) => button.textContent.trim() === 'Blacha');
      if (!trigger) throw new Error('Brak menu Blacha.');
      trigger.click();
    })()`);
    await waitFor(window, `[...document.querySelectorAll('.ribbon-tool-submenu button')].some((button) => button.querySelector('strong')?.textContent.trim() === 'Baza blachowa' && !button.disabled)`, 'aktywna Baza blachowa');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-submenu button')].find((button) => button.querySelector('strong')?.textContent.trim() === 'Baza blachowa' && !button.disabled).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'sheetBase' && document.querySelector('.command-dialog')?.textContent.includes('Współczynnik K')`, 'panel reguły blachy');

    await setField(window, 'Grubość blachy', '2');
    await setField(window, 'Promień gięcia', '3');
    await setField(window, 'Współczynnik K', '0.45');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.sheetMetal?.thickness === 2 && window.__madcadVerifyEngineState?.bodies?.[0]?.sheetMetal?.bendRadius === 3 && window.__madcadVerifyEngineState?.bodies?.[0]?.sheetMetal?.kFactor === 0.45`, 'parametryczny podgląd bazy');
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.type === 'sheetBase' && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 1`, 'zapisana baza blachowa');

    const result = await window.webContents.executeJavaScript(`(() => {
      const body = window.__madcadVerifyEngineState.bodies[0];
      const badge = [...document.querySelectorAll('.model-browser .body-kind small')].find((item) => item.textContent.includes('BLACHA'))?.textContent.trim();
      return { feature: window.__madcadVerifyDocumentState.featureData[0], sheetMetal: body.sheetMetal, volume: body.metrics.volume, badge };
    })()`);
    if (result.feature.thickness !== '2' || result.sheetMetal.bendRadius !== 3 || result.sheetMetal.kFactor !== 0.45 || result.sheetMetal.side !== 'symmetric' || Math.abs(result.volume - 1920) > 0.01 || result.badge !== 'BLACHA · 2 mm') {
      throw new Error(`Błędny wynik bazy blachowej: ${JSON.stringify(result)}`);
    }

    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 0 && window.__madcadVerifyEngineState?.bodies?.length === 0`, 'cofnięta baza blachowa');
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 1 && window.__madcadVerifyEngineState?.bodies?.[0]?.sheetMetal?.thickness === 2`, 'ponowiona baza blachowa');

    const flangeEdge = await window.webContents.executeJavaScript(`(() => {
      const body = window.__madcadVerifyEngineState.bodies[0];
      const edge = body.topology.edges.find((item) => item.descriptor.geometry === 'LINE' && Math.abs(item.descriptor.length - 24) < 0.01 && item.descriptor.endpoints.every((point) => Math.abs(point[2] - 1) < 0.01));
      if (!edge) throw new Error('Nie znaleziono górnej krawędzi bazy blachowej.');
      window.__madcadVerifyTopologySelection({ kind: 'edge', id: edge.id, bodyId: body.id }, 'replace');
      return { id: edge.id, bodyId: body.id };
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'edge'`, 'wybrana krawędź blachy');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-menu-trigger')].find((button) => button.textContent.trim() === 'Blacha').click()`);
    await waitFor(window, `[...document.querySelectorAll('.ribbon-tool-submenu button')].some((button) => button.querySelector('strong')?.textContent.trim() === 'Kołnierz blachy' && !button.disabled)`, 'aktywny Kołnierz blachy');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-submenu button')].find((button) => button.querySelector('strong')?.textContent.trim() === 'Kołnierz blachy' && !button.disabled).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'sheetFlange' && document.querySelector('.command-dialog')?.textContent.includes('Kąt gięcia')`, 'panel kołnierza');
    await setField(window, 'Długość kołnierza', '10');
    await setField(window, 'Kąt gięcia', '90');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.sheetMetal?.bends?.length === 1`, 'podgląd kołnierza');
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.type === 'sheetFlange' && window.__madcadVerifyEngineState?.bodies?.[0]?.sheetMetal?.bends?.length === 1`, 'zapisany kołnierz');

    const flangeResult = await window.webContents.executeJavaScript(`(() => {
      const body = window.__madcadVerifyEngineState.bodies[0];
      return { feature: window.__madcadVerifyDocumentState.featureData[1], bend: body.sheetMetal.bends[0], volume: body.metrics.volume, bounds: body.metrics.bounds };
    })()`);
    if (flangeResult.feature.targetBodyId !== flangeEdge.bodyId || flangeResult.bend.length !== 10 || flangeResult.bend.angle !== 90 || flangeResult.bend.bendRadius !== 3 || flangeResult.volume <= 1920 || flangeResult.bounds[1][2] < 9.9) {
      throw new Error(`Błędny wynik kołnierza: ${JSON.stringify(flangeResult)}`);
    }
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 1 && window.__madcadVerifyEngineState?.bodies?.[0]?.sheetMetal?.bends?.length === 0`, 'cofnięty kołnierz');
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 2 && window.__madcadVerifyEngineState?.bodies?.[0]?.sheetMetal?.bends?.length === 1`, 'ponowiony kołnierz');

    await window.webContents.executeJavaScript(`(() => {
      const body = window.__madcadVerifyEngineState.bodies[0];
      const edge = body.topology.edges.find((item) => item.descriptor.geometry === 'LINE' && Math.abs(item.descriptor.length - 24) < 0.05 && item.descriptor.endpoints.every((point) => point[2] > 13));
      if (!edge) throw new Error('Nie znaleziono wolnej krawędzi kołnierza dla zawinięcia.');
      window.__madcadVerifyTopologySelection({ kind: 'edge', id: edge.id, bodyId: body.id }, 'replace');
    })()`);
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-menu-trigger')].find((button) => button.textContent.trim() === 'Blacha').click()`);
    await waitFor(window, `[...document.querySelectorAll('.ribbon-tool-submenu button')].some((button) => button.querySelector('strong')?.textContent.trim() === 'Zawinięcie blachy' && !button.disabled)`, 'aktywne Zawinięcie blachy');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-submenu button')].find((button) => button.querySelector('strong')?.textContent.trim() === 'Zawinięcie blachy' && !button.disabled).click()`);
    await setField(window, 'Długość zakładki', '6');
    await setField(window, 'Szczelina zawinięcia', '0.5');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.sheetMetal?.hems?.length === 1`, 'podgląd zawinięcia');
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.[2]?.type === 'sheetHem' && window.__madcadVerifyEngineState?.bodies?.[0]?.sheetMetal?.hems?.length === 1`, 'zapisane zawinięcie');
    const hemResult = await window.webContents.executeJavaScript(`(() => { const body = window.__madcadVerifyEngineState.bodies[0]; return { feature: window.__madcadVerifyDocumentState.featureData[2], hem: body.sheetMetal.hems[0], volume: body.metrics.volume }; })()`);
    if (hemResult.hem.length !== 6 || hemResult.hem.gap !== 0.5 || hemResult.volume <= flangeResult.volume) throw new Error(`Błędny wynik zawinięcia: ${JSON.stringify(hemResult)}`);

    await window.webContents.executeJavaScript(`(() => {
      const body = window.__madcadVerifyEngineState.bodies[0];
      const edge = body.topology.edges.find((item) => item.descriptor.geometry === 'LINE' && Math.abs(item.descriptor.length - 40) < 0.05 && item.descriptor.endpoints.every((point) => Math.abs(Math.abs(point[1]) - 12) < 0.05));
      if (!edge) throw new Error('Nie znaleziono wolnej krawędzi bazy dla szczeliny.');
      window.__madcadVerifyTopologySelection({ kind: 'edge', id: edge.id, bodyId: body.id }, 'replace');
    })()`);
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-menu-trigger')].find((button) => button.textContent.trim() === 'Blacha').click()`);
    await waitFor(window, `[...document.querySelectorAll('.ribbon-tool-submenu button')].some((button) => button.querySelector('strong')?.textContent.trim() === 'Szczelina blachy' && !button.disabled)`, 'aktywna Szczelina blachy');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-submenu button')].find((button) => button.querySelector('strong')?.textContent.trim() === 'Szczelina blachy' && !button.disabled).click()`);
    await setField(window, 'Szerokość szczeliny', '1');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.sheetMetal?.rips?.length === 1`, 'podgląd szczeliny');
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.[3]?.type === 'sheetRip' && window.__madcadVerifyEngineState?.bodies?.[0]?.sheetMetal?.rips?.length === 1`, 'zapisana szczelina');
    const ripResult = await window.webContents.executeJavaScript(`(() => { const body = window.__madcadVerifyEngineState.bodies[0]; return { feature: window.__madcadVerifyDocumentState.featureData[3], rip: body.sheetMetal.rips[0], volume: body.metrics.volume }; })()`);
    if (ripResult.rip.gap !== 1 || ripResult.volume >= hemResult.volume) throw new Error(`Błędny wynik szczeliny: ${JSON.stringify(ripResult)}`);

    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 3 && !window.__madcadVerifyEngineState?.bodies?.[0]?.sheetMetal?.rips?.length`, 'cofnięta szczelina');
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 4 && window.__madcadVerifyEngineState?.bodies?.[0]?.sheetMetal?.rips?.length === 1`, 'ponowiona szczelina');

    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-menu-trigger')].find((button) => button.textContent.trim() === 'Blacha').click()`);
    await waitFor(window, `[...document.querySelectorAll('.ribbon-tool-submenu button')].some((button) => button.querySelector('strong')?.textContent.trim() === 'Rozwiń blachę' && !button.disabled)`, 'aktywne rozwinięcie blachy');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-submenu button')].find((button) => button.querySelector('strong')?.textContent.trim() === 'Rozwiń blachę' && !button.disabled).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.[4]?.type === 'sheetUnfold' && window.__madcadVerifyEngineState?.bodies?.[0]?.sheetMetal?.unfolded === true`, 'wzór płaski');
    const flatResult = await window.webContents.executeJavaScript(`(() => { const body = window.__madcadVerifyEngineState.bodies[0]; const badge = [...document.querySelectorAll('.model-browser .body-kind small')].find((item) => item.textContent.includes('ROZWINIĘTA'))?.textContent.trim(); return { feature: window.__madcadVerifyDocumentState.featureData[4], sheetMetal: body.sheetMetal, volume: body.metrics.volume, bounds: body.metrics.bounds, badge }; })()`);
    if (!flatResult.sheetMetal.unfolded || flatResult.sheetMetal.flatSegments.length !== 2 || flatResult.volume <= ripResult.volume || flatResult.bounds[0][0] > -45 || Math.abs(flatResult.bounds[1][2] - flatResult.bounds[0][2] - 2) > 0.05 || flatResult.badge !== 'ROZWINIĘTA · 2 mm') throw new Error(`Błędny wzór płaski: ${JSON.stringify(flatResult)}`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());

    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-menu-trigger')].find((button) => button.textContent.trim() === 'Blacha').click()`);
    await waitFor(window, `[...document.querySelectorAll('.ribbon-tool-submenu button')].some((button) => button.querySelector('strong')?.textContent.trim() === 'Zagnij ponownie' && !button.disabled)`, 'aktywne ponowne zagięcie');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-submenu button')].find((button) => button.querySelector('strong')?.textContent.trim() === 'Zagnij ponownie' && !button.disabled).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.[5]?.type === 'sheetRefold' && window.__madcadVerifyEngineState?.bodies?.[0]?.sheetMetal?.unfolded === false`, 'ponownie zagięta blacha');
    const refoldResult = await window.webContents.executeJavaScript(`(() => { const body = window.__madcadVerifyEngineState.bodies[0]; return { feature: window.__madcadVerifyDocumentState.featureData[5], sheetMetal: body.sheetMetal, volume: body.metrics.volume, bounds: body.metrics.bounds }; })()`);
    if (refoldResult.sheetMetal.unfolded || Math.abs(refoldResult.volume - ripResult.volume) > 0.01 || refoldResult.bounds[1][2] < 13) throw new Error(`Błędne ponowne zagięcie: ${JSON.stringify(refoldResult)}`);

    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 5 && window.__madcadVerifyEngineState?.bodies?.[0]?.sheetMetal?.unfolded === true`, 'cofnięte ponowne zagięcie');
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 6 && window.__madcadVerifyEngineState?.bodies?.[0]?.sheetMetal?.unfolded === false`, 'ponowione zagięcie');

    process.stdout.write(`${JSON.stringify({ ok: true, screenshotPath, result, flangeResult, hemResult, ripResult, flatResult, refoldResult })}\n`);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    exitCode = 1;
  } finally {
    window.destroy();
    app.exit(exitCode);
  }
});
