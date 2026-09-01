const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-sheet-metal-base.png');

async function waitFor(window, expression, label, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  throw new Error(`Nie osiągnięto stanu: ${label}`);
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
      const trigger = [...document.querySelectorAll('.ribbon-tool-menu-trigger')].find((button) => button.textContent.trim() === 'Więcej brył');
      if (!trigger) throw new Error('Brak menu Więcej brył.');
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

    process.stdout.write(`${JSON.stringify({ ok: true, screenshotPath, result })}\n`);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    exitCode = 1;
  } finally {
    window.destroy();
    app.exit(exitCode);
  }
});
