const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-form.png');

async function waitFor(window, expression, label, timeoutMs = 60000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
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
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-form-${Date.now()}` } });
  window.setContentSize(1440, 837);
  let exitCode = 0;
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell') && window.__madcadVerifyLoadTimelineFixture`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 2`, 'model testowy');

    await window.webContents.executeJavaScript(`(() => {
      const trigger = [...document.querySelectorAll('.ribbon-tool-menu-trigger')].find((button) => button.textContent.trim() === 'Więcej brył');
      if (!trigger) throw new Error('Brak menu Więcej brył.');
      trigger.click();
    })()`);
    await waitFor(window, `[...document.querySelectorAll('.ribbon-tool-submenu button')].some((button) => button.querySelector('strong')?.textContent.trim() === 'Form' && !button.disabled)`, 'aktywne narzędzie Form');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-submenu button')].find((button) => button.querySelector('strong')?.textContent.trim() === 'Form' && !button.disabled).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'formBody' && document.querySelector('.command-dialog')?.textContent.includes('Poziom wygładzenia')`, 'panel Form');

    await setField(window, 'Szerokość klatki', '40');
    await setField(window, 'Głębokość klatki', '30');
    await setField(window, 'Wysokość klatki', '20');
    await setField(window, 'Poziom wygładzenia', '2');
    await setField(window, 'Położenie X', '-25');
    await setField(window, 'Położenie Y', '35');
    await setField(window, 'Położenie Z', '12');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.find((body) => body.form?.subdivisions === 2)?.topology?.faces?.length === 192`, 'podgląd Form B-Rep');

    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.at(-1)?.type === 'formBody' && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.some((body) => body.form?.surfaceFaceCount === 96)`, 'zapisany Form');
    const result = await window.webContents.executeJavaScript(`(() => {
      const body = window.__madcadVerifyEngineState.bodies.find((item) => item.form);
      return {
        bodyCount: window.__madcadVerifyEngineState.bodies.length,
        representation: body.representation,
        bodyKind: body.bodyKind,
        metrics: body.metrics,
        topologyFaces: body.topology.faces.length,
        form: body.form,
        dialogClosed: !document.querySelector('.command-dialog'),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    const dimensions = result.metrics.dimensions;
    if (result.bodyCount !== 3 || result.representation !== 'brep' || result.bodyKind !== 'solid' || result.topologyFaces !== 192 || result.form.controlVertexCount !== 8 || result.form.controlFaceCount !== 6 || result.form.surfaceFaceCount !== 96 || result.form.subdivisions !== 2 || result.metrics.volume <= 0 || Math.abs(dimensions[0] - 40) > 0.2 || Math.abs(dimensions[1] - 30) > 0.2 || Math.abs(dimensions[2] - 20) > 0.2 || !result.dialogClosed || result.horizontalOverflow) {
      throw new Error(`Niepoprawny wynik Form: ${JSON.stringify(result)}`);
    }

    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && !window.__madcadVerifyEngineState?.bodies?.some((body) => body.form)`, 'cofnięty Form');
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.some((body) => body.form?.subdivisions === 2)`, 'ponowiony Form');
    await window.webContents.executeJavaScript(`window.__madcadVerifyReopenCurrentDocument()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.featureData?.at(-1)?.type === 'formBody' && window.__madcadVerifyEngineState?.bodies?.some((body) => body.form?.surfaceFaceCount === 96)`, 'Form po ponownym otwarciu projektu');

    process.stdout.write(`${JSON.stringify({ screenshotPath, result }, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
