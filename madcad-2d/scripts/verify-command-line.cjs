const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-command-line.png');

async function waitFor(window, expression, label, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

async function enterCommand(window, value) {
  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('#madcad-command-line');
    if (!input) throw new Error('Brak linii poleceń');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  })()`);
}

async function setCommandValue(window, value) {
  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('#madcad-command-line');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  })()`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    webPreferences: { partition: `madcad-command-verifier-${Date.now()}` },
  });
  window.setContentSize(1440, 837);

  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'interfejs aplikacji');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await waitFor(window, `!document.querySelector('.license-info-dialog')`, 'zamknięcie informacji licencyjnej');
    await waitFor(window, `document.querySelector('#madcad-command-line')`, 'linia poleceń');

    await window.webContents.executeJavaScript(`(() => {
      const button = [...document.querySelectorAll('.ribbon-tool')]
        .find((item) => item.querySelector('.ribbon-label')?.textContent.trim() === 'Utwórz szkic');
      button?.click();
    })()`);
    await waitFor(window, `document.querySelector('.plane-picker')`, 'wybór płaszczyzny');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.plane-options button')].find((item) => item.textContent.includes('XY'))?.click()`);
    await waitFor(window, `document.querySelector('.model-viewport.sketch-view') && window.__madcadSketchLocalToScreen`, 'aktywny szkic');

    await enterCommand(window, 'LINE');
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'line'`, 'alias LINE');
    await window.webContents.executeJavaScript(`(() => {
      if (typeof window.__madcadVerifySketchPoint !== 'function') throw new Error('Brak deterministycznego haka punktu szkicu');
      window.__madcadVerifySketchPoint([0, 0]);
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.points === 1`, 'pierwszy punkt linii');

    await setCommandValue(window, '25');
    await new Promise((resolve) => setTimeout(resolve, 150));
    const visual = await window.webContents.executeJavaScript(`(() => {
      const bar = document.querySelector('.command-line');
      const input = document.querySelector('#madcad-command-line');
      const rect = bar.getBoundingClientRect();
      return {
        visible: Boolean(bar && rect.width > 0 && rect.height > 0),
        insideViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
        value: input.value,
        prompt: document.querySelector('.command-line-prompt')?.textContent.trim() || '',
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());

    await enterCommand(window, '25');
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 3 && !window.__madcadVerifyDocumentState?.command`, 'segment o długości 25');
    const geometry = await window.webContents.executeJavaScript(`(() => {
      const entities = window.__madcadVerifyDocumentState.sketches.at(-1).entityData;
      const points = entities.filter((entity) => entity.type === 'point');
      return { points: points.map((point) => [Number(point.geometry.x), Number(point.geometry.y)]), historyRows: document.querySelectorAll('.command-history button').length };
    })()`);
    const distance = Math.hypot(geometry.points[1][0] - geometry.points[0][0], geometry.points[1][1] - geometry.points[0][1]);

    await window.webContents.executeJavaScript(`document.querySelector('.command-history-toggle')?.click()`);
    await waitFor(window, `document.querySelector('.command-history')`, 'historia poleceń');
    const historyRows = await window.webContents.executeJavaScript(`document.querySelectorAll('.command-history button').length`);

    const result = { screenshotPath, ...visual, distance, historyRows };
    if (!visual.visible || !visual.insideViewport || visual.value !== '25' || !visual.prompt.includes('wpisz długość') || visual.horizontalOverflow || Math.abs(distance - 25) > 0.001 || historyRows < 2) {
      throw new Error(`Niepoprawna linia poleceń: ${JSON.stringify(result)}`);
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
