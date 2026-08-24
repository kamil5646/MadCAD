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

async function inputByLabel(window, label, value) {
  await window.webContents.executeJavaScript(`(() => {
    const field = [...document.querySelectorAll('.command-field')].find((item) => item.querySelector(':scope > span')?.textContent.trim() === ${JSON.stringify(label)});
    const input = field?.querySelector('input');
    if (!input) throw new Error('Brak pola: ' + ${JSON.stringify(label)});
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
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
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog footer .confirm').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.holeStandard === 'iso-metric' && window.__madcadVerifyDocumentState.featureData[1].standardSize === 'M8' && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.manufacturingHoles?.[0]?.threadDesignation === 'M8×1.25'`, 'zapis M8 i opis produkcyjny');
    await waitFor(window, `JSON.parse(localStorage.getItem('madcad:modeling-document:v4'))?.features?.[1]?.threadDesignation === 'M8×1.25'`, 'autozapis M8');
    await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.threadDesignation === 'M8×1.25' && window.__madcadVerifyEngineState?.status === 'ready'`, 'ponowne otwarcie M8');

    await window.webContents.executeJavaScript(`document.querySelectorAll('.timeline-item')[1].click()`);
    await waitFor(window, `document.querySelectorAll('.timeline-item')[1]?.getAttribute('aria-pressed') === 'true'`, 'ponowne zaznaczenie otworu');
    await window.webContents.executeJavaScript(`document.querySelectorAll('.timeline-item')[1].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'hole'`, 'ponowna edycja otworu');
    await selectByLabel(window, 'Zastosowanie', 'npt-tapped');
    await waitFor(window, `[...document.querySelectorAll('.command-field')].find((field) => field.querySelector(':scope > span')?.textContent.trim() === 'Rozmiar śruby / gwintu')?.querySelector('select')?.value === 'npt-1-8'`, 'wybór NPT 1/8');
    await inputByLabel(window, 'Odchyłka dolna Ø', '-0.05');
    await waitFor(window, `[...document.querySelectorAll('.command-field')].find((field) => field.querySelector(':scope > span')?.textContent.trim() === 'Odchyłka dolna Ø')?.querySelector('input')?.value === '-0.05'`, 'dolna tolerancja NPT');
    await inputByLabel(window, 'Odchyłka górna Ø', '0.1');
    await waitFor(window, `[...document.querySelectorAll('.command-field')].find((field) => field.querySelector(':scope > span')?.textContent.trim() === 'Odchyłka górna Ø')?.querySelector('input')?.value === '0.1'`, 'górna tolerancja NPT');
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.previewReady && window.__madcadVerifyEngineState?.status === 'ready'`, 'podgląd NPT 1/8');
    const pipeLayout = await window.webContents.executeJavaScript(`(() => {
      const panel = document.querySelector('.command-dialog');
      const value = (label) => [...panel.querySelectorAll('.command-field')].find((field) => field.querySelector(':scope > span')?.textContent.trim() === label)?.querySelector('input, select')?.value;
      return { diameter: value('Średnica przy wejściu'), taper: value('Stożek średnicy'), tpi: value('Zwoje na cal'), inspection: value('Sprawdzian'), lower: value('Odchyłka dolna Ø'), upper: value('Odchyłka górna Ø') };
    })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog footer .confirm').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.holeStandard === 'asme-b1.20.1' && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.manufacturingHoles?.[0]?.threadDesignation === '1/8-27 NPT' && window.__madcadVerifyEngineState.bodies[0].manufacturingHoles[0].threadTaper === 0.0625`, 'zapis stożkowego NPT');
    await waitFor(window, `JSON.parse(localStorage.getItem('madcad:modeling-document:v4'))?.features?.[1]?.diameterToleranceUpper === '0.1'`, 'autozapis tolerancji NPT');
    await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.threadDesignation === '1/8-27 NPT' && window.__madcadVerifyEngineState?.status === 'ready'`, 'ponowne otwarcie NPT');

    const result = { screenshotPath, metric: layout, pipe: pipeLayout, designation: '1/8-27 NPT', persisted: true, taperedBrepReady: true };
    if (layout.drillDiameter !== '6.75' || layout.threadClass !== '6H' || !layout.insideViewport || layout.horizontalOverflow || pipeLayout.diameter !== '8.74' || pipeLayout.taper !== '1:16' || pipeLayout.tpi !== '27' || pipeLayout.lower !== '-0.05' || pipeLayout.upper !== '0.1') throw new Error(`Niepoprawny standardowy otwór: ${JSON.stringify(result)}`);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
