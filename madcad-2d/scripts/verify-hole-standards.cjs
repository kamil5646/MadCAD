const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-standard-hole.png');

async function waitFor(window, expression, label, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

async function selectByLabel(window, label, value) {
  await window.webContents.executeJavaScript(`(() => {
    const field = [...document.querySelectorAll('.command-field')].find((item) => item.querySelector(':scope > span')?.textContent.trim() === ${JSON.stringify(label)});
    const select = field?.querySelector('select');
    if (!select) throw new Error('Brak pola wyboru: ' + ${JSON.stringify(label)});
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, ${JSON.stringify(value)});
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-hole-standards-${Date.now()}` } });
  window.setContentSize(1440, 837);
  let exitCode = 0;
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell') && window.__madcadVerifyLoadTimelineFixture`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && document.querySelectorAll('.timeline-item').length === 3`, 'model testowy');
    await window.webContents.executeJavaScript(`document.querySelectorAll('.timeline-item')[1].click()`);
    await waitFor(window, `document.querySelectorAll('.timeline-item')[1]?.getAttribute('aria-pressed') === 'true'`, 'zaznaczenie otworu');
    await window.webContents.executeJavaScript(`document.querySelectorAll('.timeline-item')[1].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'hole' && document.querySelector('.command-dialog')`, 'edycja otworu');

    await selectByLabel(window, 'Zastosowanie', 'tapped');
    await selectByLabel(window, 'Rozmiar śruby / gwintu', 'M8');
    await waitFor(window, `document.querySelector('.command-field input[disabled][value="6.75"]') && window.__madcadVerifyDocumentState?.command?.previewReady`, 'podgląd M8');
    const layout = await window.webContents.executeJavaScript(`(() => {
      const panel = document.querySelector('.command-dialog');
      const rect = panel.getBoundingClientRect();
      return {
        drillDiameter: [...panel.querySelectorAll('.command-field')].find((field) => field.textContent.includes('Średnica wiertła'))?.querySelector('input')?.value,
        threadClass: [...panel.querySelectorAll('.command-field')].find((field) => field.textContent.includes('Klasa gwintu'))?.querySelector('select')?.value,
        insideViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog footer .confirm').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.holeStandard === 'iso-metric' && window.__madcadVerifyDocumentState.featureData[1].standardSize === 'M8' && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.manufacturingHoles?.[0]?.threadDesignation === 'M8×1.25'`, 'zapis M8 i opis produkcyjny');
    await waitFor(window, `JSON.parse(localStorage.getItem('madcad:modeling-document:v4'))?.features?.[1]?.threadDesignation === 'M8×1.25'`, 'autozapis M8');
    await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.threadDesignation === 'M8×1.25' && window.__madcadVerifyEngineState?.status === 'ready'`, 'ponowne otwarcie M8');

    const result = { screenshotPath, ...layout, designation: 'M8×1.25', persisted: true, brepReady: true };
    if (layout.drillDiameter !== '6.75' || layout.threadClass !== '6H' || !layout.insideViewport || layout.horizontalOverflow) throw new Error(`Niepoprawny standardowy otwór: ${JSON.stringify(result)}`);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
