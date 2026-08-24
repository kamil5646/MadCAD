const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-project-snapshots.png');

async function waitFor(window, expression, label, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

async function click(window, selector) {
  await window.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(selector)})?.click()`);
}

async function setField(window, selector, value) {
  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'verify-project-snapshots-preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      partition: `madcad-snapshots-verifier-${Date.now()}`,
    },
  });
  window.setContentSize(1440, 837);
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `typeof window.__madcadVerifyLoadTimelineFixture === 'function'`, 'fixture projektu');
    await click(window, '.license-info-dialog button.confirm');
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 3`, 'projekt z trzema operacjami');

    await click(window, '#projectSnapshotsBtn');
    await waitFor(window, `document.querySelector('.project-snapshots-panel') && !document.querySelector('.project-snapshots-empty')?.textContent.includes('Wczytywanie')`, 'panel punktów zapisu');
    await setField(window, '.project-snapshots-panel input', 'Przed zmianą korpusu');
    await setField(window, '.project-snapshots-panel textarea', 'Sprawdzona baza i otwór');
    await click(window, '[data-snapshot-action="create"]');
    await waitFor(window, `window.__madcadVerifyDocumentState?.projectSnapshots?.length === 1 && document.querySelector('.project-snapshot-item')?.textContent.includes('Przed zmianą korpusu')`, 'utworzony punkt zapisu');

    await window.webContents.executeJavaScript(`document.querySelectorAll('.timeline-item')[0].click()`);
    await click(window, '[data-timeline-action="delete"]');
    await click(window, '[data-timeline-action="confirm-delete"]');
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 1`, 'zmieniony projekt po punkcie zapisu');

    await click(window, '[data-snapshot-action="restore"]');
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 3 && window.__madcadHasUnsavedChanges?.() && document.querySelector('.workspace-notice')?.textContent.includes('Undo')`, 'przywrócony punkt zapisu');
    await click(window, '#undoProjectBtn');
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 1`, 'Undo przywrócenia');
    await click(window, '#redoProjectBtn');
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 3 && window.__madcadVerifyDocumentState?.bodyIds?.length === 2 && document.querySelector('.engine-status.ready')`, 'Redo i przeliczenie przywróconej wersji');
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());

    await click(window, '[data-snapshot-action="delete"]');
    await waitFor(window, `document.querySelector('[data-snapshot-action="confirm-delete"]')`, 'potwierdzenie usunięcia punktu');
    await click(window, '[data-snapshot-action="confirm-delete"]');
    await waitFor(window, `window.__madcadVerifyDocumentState?.projectSnapshots?.length === 0 && !document.querySelector('.project-snapshot-item')`, 'usunięty punkt zapisu');

    const result = await window.webContents.executeJavaScript(`(() => {
      const panel = document.querySelector('.project-snapshots-panel');
      const stage = document.querySelector('.modeling-stage');
      const panelRect = panel?.getBoundingClientRect();
      const stageRect = stage?.getBoundingClientRect();
      return {
        features: window.__madcadVerifyDocumentState.features,
        snapshots: window.__madcadVerifyDocumentState.projectSnapshots.length,
        panelInsideStage: Boolean(panelRect && stageRect && panelRect.left >= stageRect.left && panelRect.right <= stageRect.right && panelRect.top >= stageRect.top && panelRect.bottom <= stageRect.bottom),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    Object.assign(result, { screenshotPath });
    if (result.features !== 3 || result.snapshots !== 0 || !result.panelInsideStage || result.horizontalOverflow) throw new Error(`Niepoprawny przepływ punktów zapisu: ${JSON.stringify(result)}`);

    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'en' } });
    await waitFor(window, `typeof window.__madcadVerifyFindUntranslatedText === 'function'`, 'angielski interfejs');
    await click(window, '.license-info-dialog button.confirm');
    await click(window, '#projectSnapshotsBtn');
    await waitFor(window, `document.querySelector('.project-snapshots-panel')?.textContent.includes('SAVE POINTS')`, 'angielski panel punktów zapisu');
    const englishPanel = await window.webContents.executeJavaScript(`(() => {
      const panel = document.querySelector('.project-snapshots-panel');
      const attributes = [...panel.querySelectorAll('*')].flatMap((node) => ['title', 'aria-label', 'placeholder'].map((name) => node.getAttribute(name) || ''));
      return !/(PUNKTY ZAPISU|Nazwa wersji|Opis zmian|Utwórz|Przywróć|Brak punktów|Zamknij punkty)/i.test([panel.textContent, ...attributes].join(' '));
    })()`);
    result.englishPanel = englishPanel;
    if (!englishPanel) throw new Error('Panel punktów zapisu zawiera nieprzetłumaczony tekst.');
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
