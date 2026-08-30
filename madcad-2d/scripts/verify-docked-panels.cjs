const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-docked-panels.png');

async function waitFor(window, expression, label, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

async function prepare(window) {
  await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
  await waitFor(window, `document.querySelector('.modeling-shell')`, 'interfejs aplikacji');
  await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
  await waitFor(window, `!document.querySelector('.license-info-dialog')`, 'zamknięcie informacji licencyjnej');
}

function panelSnapshot(window) {
  return window.webContents.executeJavaScript(`(() => {
    const panel = document.querySelector('.command-dialog.docked');
    const stage = document.querySelector('.modeling-stage');
    const panelRect = panel?.getBoundingClientRect();
    const stageRect = stage?.getBoundingClientRect();
    return {
      panelWidth: panelRect?.width || 0,
      panelPosition: panel ? getComputedStyle(panel).position : '',
      collapsed: panel?.classList.contains('collapsed') || false,
      dock: panel?.classList.contains('dock-left') ? 'left' : 'right',
      besideCanvas: Boolean(panelRect && stageRect && (panelRect.right <= stageRect.left + 0.5 || panelRect.left >= stageRect.right - 0.5)),
      stageWidth: stageRect?.width || 0,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    };
  })()`);
}

function printPanelSnapshot(window) {
  return window.webContents.executeJavaScript(`(() => {
    const panel = document.querySelector('.print-panel');
    const stage = document.querySelector('.modeling-stage');
    const panelRect = panel?.getBoundingClientRect();
    const stageRect = stage?.getBoundingClientRect();
    return {
      panelWidth: panelRect?.width || 0,
      collapsed: panel?.classList.contains('collapsed') || false,
      besideCanvas: Boolean(panelRect && stageRect && panelRect.left >= stageRect.right - 0.5),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    };
  })()`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    webPreferences: { partition: `madcad-panel-verifier-${Date.now()}` },
  });
  window.setContentSize(1440, 837);

  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await prepare(window);
    await window.webContents.executeJavaScript(`(() => {
      [...document.querySelectorAll('.ribbon-tool')].find((item) => item.querySelector('.ribbon-label')?.textContent.trim() === 'Utwórz szkic')?.click();
    })()`);
    await waitFor(window, `document.querySelector('.plane-picker')`, 'wybór płaszczyzny');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.plane-options button')].find((item) => item.textContent.includes('XY'))?.click()`);
    await waitFor(window, `document.querySelector('.model-viewport.sketch-view')`, 'aktywny szkic');
    await window.webContents.executeJavaScript(`(() => {
      const input = document.querySelector('#madcad-command-line');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'L');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    })()`);
    await waitFor(window, `document.querySelector('.command-dialog.docked')`, 'dokowany panel polecenia');
    await new Promise((resolve) => setTimeout(resolve, 220));

    const initial = await panelSnapshot(window);
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog [data-panel-action="collapse"]')?.click()`);
    await waitFor(window, `document.querySelector('.command-dialog.docked.collapsed')`, 'zwinięty panel polecenia');
    await new Promise((resolve) => setTimeout(resolve, 220));
    const collapsed = await panelSnapshot(window);

    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog [data-panel-action="collapse"]')?.click()`);
    await waitFor(window, `document.querySelector('.command-dialog.docked:not(.collapsed)')`, 'rozwinięty panel polecenia');
    const dockControlAbsent = await window.webContents.executeJavaScript(`!document.querySelector('.command-dialog [data-panel-action="dock"]')`);
    const fixed = await panelSnapshot(window);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());

    await window.reload();
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'ponowne uruchomienie interfejsu');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    const storedRight = await window.webContents.executeJavaScript(`!Object.values(localStorage).some((value) => value.includes('"commandDock":"left"'))`);
    await window.webContents.executeJavaScript(`document.querySelector('#fileMenuBtn')?.click()`);
    await waitFor(window, `document.querySelector('.file-backstage')`, 'menu Plik');
    await window.webContents.executeJavaScript(`document.querySelector('#filePrint3dBtn')?.click()`);
    await waitFor(window, `document.querySelector('.print-panel')`, 'dokowany panel eksportu');
    await new Promise((resolve) => setTimeout(resolve, 220));
    const printInitial = await printPanelSnapshot(window);
    await window.webContents.executeJavaScript(`document.querySelector('.print-panel [data-panel-action="collapse"]')?.click()`);
    await waitFor(window, `document.querySelector('.print-panel.collapsed')`, 'zwinięty panel eksportu');
    await new Promise((resolve) => setTimeout(resolve, 220));
    const printCollapsed = await printPanelSnapshot(window);

    const result = { screenshotPath, initial, collapsed, fixed, dockControlAbsent, storedRight, printInitial, printCollapsed };
    if (initial.panelPosition === 'absolute' || initial.dock !== 'right' || !initial.besideCanvas || initial.panelWidth < 260 || collapsed.panelWidth > 40 || !collapsed.collapsed || !collapsed.besideCanvas || fixed.dock !== 'right' || !fixed.besideCanvas || fixed.horizontalOverflow || !dockControlAbsent || !storedRight || printInitial.panelWidth < 270 || !printInitial.besideCanvas || printCollapsed.panelWidth > 40 || !printCollapsed.collapsed || !printCollapsed.besideCanvas || printCollapsed.horizontalOverflow) {
      throw new Error(`Niepoprawny układ paneli: ${JSON.stringify(result)}`);
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
