const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const artifactsDir = path.join(__dirname, '..', 'artifacts');
const screenshotPath = path.join(artifactsDir, 'madcad-workspace-layouts.png');

async function waitFor(window, expression, label, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

async function openMenu(window) {
  await window.webContents.executeJavaScript(`document.querySelector('button[aria-label="Układy obszaru roboczego"]')?.click()`);
  await waitFor(window, `document.querySelector('.workspace-layout-menu')`, 'menu obszarów roboczych');
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-workspaces-${Date.now()}` } });
  window.setContentSize(1440, 837);
  try {
    await fs.mkdir(artifactsDir, { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'interfejs aplikacji');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await waitFor(window, `!document.querySelector('.license-info-dialog')`, 'zamknięcie informacji licencyjnej');
    await openMenu(window);
    await waitFor(window, `document.querySelectorAll('.workspace-layout-list > button').length === 4`, 'gotowe układy');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.workspace-layout-list > button')].find((button) => button.textContent.includes('Czyste płótno'))?.click()`);
    await waitFor(window, `document.querySelector('.modeling-content.without-browser')`, 'czyste płótno bez przeglądarki');
    await openMenu(window);
    await window.webContents.executeJavaScript(`(() => {
      const input = document.querySelector('.workspace-layout-menu form input');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'Układ testowy');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.closest('form').requestSubmit();
    })()`);
    await waitFor(window, `document.querySelector('.workspace-layout-saved')?.textContent.includes('Układ testowy')`, 'zapisany układ użytkownika');
    const state = await window.webContents.executeJavaScript(`(() => {
      const menu = document.querySelector('.workspace-layout-menu');
      const rect = menu.getBoundingClientRect();
      return {
        builtIns: [...document.querySelectorAll('.workspace-layout-list > button')].map((button) => button.querySelector('strong')?.textContent),
        custom: [...document.querySelectorAll('.workspace-layout-saved strong')].map((item) => item.textContent),
        active: document.querySelector('.workspace-layout-list button.active strong')?.textContent || '',
        insideWindow: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    await window.reload();
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'ponowne otwarcie aplikacji');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await openMenu(window);
    const persisted = await window.webContents.executeJavaScript(`[...document.querySelectorAll('.workspace-layout-saved strong')].some((item) => item.textContent === 'Układ testowy')`);
    if (state.builtIns.length !== 4 || state.custom[0] !== 'Układ testowy' || state.active !== 'Układ testowy' || !state.insideWindow || state.horizontalOverflow || !persisted) {
      throw new Error(`Niepoprawne zapisane obszary robocze: ${JSON.stringify({ state, persisted })}`);
    }
    process.stdout.write(`${JSON.stringify({ screenshotPath, ...state, persisted }, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});

