const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-timeline-management.png');

async function waitFor(window, expression, label, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

async function clickAction(window, action) {
  await window.webContents.executeJavaScript(`document.querySelector('[data-timeline-action=${JSON.stringify(action)}]')?.click()`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    webPreferences: { partition: `madcad-timeline-verifier-${Date.now()}` },
  });
  window.setContentSize(1440, 837);

  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'interfejs aplikacji');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await waitFor(window, `typeof window.__madcadVerifyLoadTimelineFixture === 'function'`, 'fixture osi czasu');
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 3 && document.querySelectorAll('.timeline-item').length === 3`, 'trzy operacje osi czasu');

    await window.webContents.executeJavaScript(`document.querySelectorAll('.timeline-item')[2].click()`);
    await waitFor(window, `document.querySelector('.timeline-selection-tools')`, 'narzędzia wybranej operacji');
    const actionCount = await window.webContents.executeJavaScript(`document.querySelectorAll('.timeline-selection-tools [data-timeline-action]').length`);

    await clickAction(window, 'rename');
    await waitFor(window, `document.querySelector('.timeline-rename input')`, 'zmiana nazwy');
    await window.webContents.executeJavaScript(`(() => {
      const input = document.querySelector('.timeline-rename input');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'Korpus pomocniczy');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.[2]?.name === 'Korpus pomocniczy'`, 'zapis nazwy');

    await window.webContents.executeJavaScript(`document.querySelectorAll('.timeline-item')[1].click()`);
    await clickAction(window, 'suppress');
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.suppressed === true && document.querySelectorAll('.timeline-item')[1].classList.contains('suppressed')`, 'wyłączenie operacji');
    await clickAction(window, 'suppress');
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.suppressed === false`, 'ponowne włączenie operacji');

    const orderBeforeRejectedMove = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.featureIds.join(',')`);
    await clickAction(window, 'move-left');
    await waitFor(window, `document.querySelector('.workspace-notice')?.textContent.includes('Nie można zmienić kolejności')`, 'blokada zerwanej zależności');
    const orderAfterRejectedMove = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.featureIds.join(',')`);

    await window.webContents.executeJavaScript(`document.querySelectorAll('.timeline-item')[2].click()`);
    await clickAction(window, 'move-left');
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.type === 'primitive'`, 'przeniesienie niezależnej operacji');
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());

    await window.webContents.executeJavaScript(`document.querySelectorAll('.timeline-item')[0].click()`);
    await clickAction(window, 'delete');
    await waitFor(window, `document.querySelector('.timeline-delete-confirm')?.textContent.includes('2 operacje')`, 'potwierdzenie usuwania zależności');
    await clickAction(window, 'confirm-delete');
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 1 && window.__madcadVerifyDocumentState?.featureData?.[0]?.type === 'primitive'`, 'kaskadowe usunięcie');
    await window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Z', modifiers: ['control'] });
    await window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Z', modifiers: ['control'] });
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 3`, 'Undo usunięcia osi czasu');

    const result = await window.webContents.executeJavaScript(`(() => {
      const toolbar = document.querySelector('.timeline-selection-tools');
      const rect = toolbar?.getBoundingClientRect();
      return {
        features: window.__madcadVerifyDocumentState.features,
        featureOrder: window.__madcadVerifyDocumentState.featureData.map((feature) => feature.type),
        toolbarVisible: Boolean(toolbar && rect.width > 0 && rect.height > 0),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    Object.assign(result, { screenshotPath, actionCount, dependencyMoveRejected: orderBeforeRejectedMove === orderAfterRejectedMove });
    if (actionCount < 6 || !result.dependencyMoveRejected || !result.toolbarVisible || result.horizontalOverflow || result.features !== 3) {
      throw new Error(`Niepoprawne zarządzanie osią czasu: ${JSON.stringify(result)}`);
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
