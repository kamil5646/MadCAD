const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-ribbon-overflow.png');

async function waitFor(window, expression, label, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 820,
    height: 760,
    show: true,
    webPreferences: { partition: `madcad-ribbon-verifier-${Date.now()}` },
  });
  window.setContentSize(820, 697);

  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'interfejs aplikacji');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await waitFor(window, `!document.querySelector('.license-info-dialog')`, 'zamknięcie informacji licencyjnej');
    window.setContentSize(810, 697);
    await new Promise((resolve) => setTimeout(resolve, 100));
    window.setContentSize(820, 697);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const layoutSnapshot = await window.webContents.executeJavaScript(`({
      innerWidth,
      ribbonWidth: document.querySelector('.modeling-ribbon')?.clientWidth || 0,
      groups: [...document.querySelectorAll('.ribbon-group')].map((item) => ({ label: item.getAttribute('aria-label'), width: item.getBoundingClientRect().width, hidden: item.hidden })),
      trigger: Boolean(document.querySelector('.ribbon-overflow-trigger')),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    })`);
    process.stdout.write(`[ribbon] ${JSON.stringify(layoutSnapshot)}\n`);
    if (layoutSnapshot.groups.some((group) => group.hidden) || layoutSnapshot.trigger || layoutSnapshot.horizontalOverflow) {
      throw new Error(`Pusty projekt nie powinien wymagać menu przepełnienia: ${JSON.stringify(layoutSnapshot)}`);
    }
    await window.webContents.executeJavaScript(`(async () => {
      const stl = new ArrayBuffer(134);
      const view = new DataView(stl);
      view.setUint32(80, 1, true);
      [[0, 0, 0], [20, 0, 0], [0, 20, 0]].forEach((vertex, vertexIndex) => vertex.forEach((value, axis) => view.setFloat32(96 + vertexIndex * 12 + axis * 4, value, true)));
      const input = [...document.querySelectorAll('input[type="file"]')].find((item) => item.accept.includes('.stl'));
      const key = input && Object.keys(input).find((item) => item.startsWith('__reactProps'));
      await input[key].onChange({ target: { files: [new File([stl], 'ribbon-fixture.stl', { type: 'model/stl' })], value: '' } });
    })()`);
    await waitFor(window, `document.querySelector('.import-model-dialog .confirm')`, 'potwierdzenie importu');
    await window.webContents.executeJavaScript(`document.querySelector('.import-model-dialog .confirm').click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 1`, 'pełny kontekst modelowania');
    await waitFor(window, `document.querySelectorAll('.ribbon-group[hidden]').length > 0 && document.querySelector('.ribbon-overflow-trigger')`, 'responsywna wstążka');
    await window.webContents.executeJavaScript(`document.querySelector('.ribbon-overflow-trigger').click()`);
    await waitFor(window, `document.querySelector('.ribbon-overflow-menu')`, 'menu przepełnienia');
    await new Promise((resolve) => setTimeout(resolve, 150));

    const result = await window.webContents.executeJavaScript(`(() => {
      const menu = document.querySelector('.ribbon-overflow-menu');
      const trigger = document.querySelector('.ribbon-overflow-trigger');
      const rect = menu.getBoundingClientRect();
      return {
        expanded: trigger.getAttribute('aria-expanded') === 'true',
        groups: [...menu.querySelectorAll('.ribbon-overflow-section > strong')].map((item) => item.textContent.trim()),
        tools: menu.querySelectorAll('[role="menuitem"]').length,
        hiddenGroups: document.querySelectorAll('.ribbon-group[hidden]').length,
        insideViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    if (!result.expanded || !result.groups.length || !result.tools || !result.hiddenGroups || !result.insideViewport || result.horizontalOverflow) {
      throw new Error(`Niepoprawne menu przepełnienia wstążki: ${JSON.stringify(result)}`);
    }
    process.stdout.write(`${JSON.stringify({ screenshotPath, ...result }, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
