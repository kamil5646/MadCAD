const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-turning.png');

async function waitFor(window, expression, label, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

async function changeSelectByLabel(window, label, value) {
  await window.webContents.executeJavaScript(`(() => { const control = [...document.querySelectorAll('label')].find((item) => item.querySelector(':scope > span')?.textContent.trim() === ${JSON.stringify(label)})?.querySelector('select'); if (!control) throw new Error('Brak pola: ${label}'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(control, ${JSON.stringify(value)}); control.dispatchEvent(new Event('change', { bubbles: true })); })()`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-turning-${Date.now()}` } });
  window.setContentSize(1440, 837);
  let exitCode = 0;
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `window.__madcadVerifyLoadTimelineFixture && document.querySelector('.workspace-tabs')`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click(); window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.bodyIds?.length >= 2`, 'bryły fixture');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.workspace-tabs button')].find((button) => button.textContent.trim() === 'WYTWARZANIE').click()`);
    await waitFor(window, `document.querySelector('[data-tool-label="Nowy Setup"]')`, 'obszar wytwarzania');
    await window.webContents.executeJavaScript(`document.querySelector('[data-tool-label="Nowy Setup"]').click()`);
    await waitFor(window, `document.querySelector('.manufacturing-summary.valid')`, 'Setup bazowy');
    await changeSelectByLabel(window, 'Rodzaj obróbki', 'turning-2axis');
    await waitFor(window, `JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[0].operationKind === 'turning-2axis' && JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[0].machineId === 'lathe-300'`, 'Setup tokarki');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.manufacturing-page-tabs button')].find((button) => button.textContent.includes('Operacje')).click()`);
    await waitFor(window, `[...document.querySelectorAll('.manufacturing-add-actions button')].some((button) => button.textContent.includes('Czoło'))`, 'narzędzia tokarskie');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.manufacturing-add-actions button')].find((button) => button.textContent.includes('Czoło')).click()`);
    await waitFor(window, `JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[0].operations.length === 1 && document.querySelectorAll('.manufacturing-toolpath-summary.valid').length === 1`, 'planowanie czoła');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.manufacturing-add-actions button')].find((button) => button.textContent.includes('Toczenie zewnętrzne')).click()`);
    await waitFor(window, `JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[0].operations.length === 2 && document.querySelectorAll('.manufacturing-toolpath-summary.valid').length === 2 && window.__madcadManufacturingVisualState?.segmentCount > 0`, 'toczenie zewnętrzne');
    const state = await window.webContents.executeJavaScript(`(() => { const saved = JSON.parse(window.__madcadGetSessionExport()); return { setup: saved.manufacturing.setups[0], summaries: [...document.querySelectorAll('.manufacturing-toolpath-summary')].map((item) => item.textContent), visual: window.__madcadManufacturingVisualState }; })()`);
    if (state.setup.operations[0].type !== 'turn-face' || state.setup.operations[1].type !== 'turn-profile' || state.setup.operations.some((operation) => operation.postProcessorId !== 'linuxcnc-turn')) throw new Error(`Niepoprawne operacje tokarskie: ${JSON.stringify(state)}`);
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.manufacturing-toolpath-summary')].at(-1).querySelector('button').click()`);
    await waitFor(window, `document.querySelector('.manufacturing-gcode-preview pre')?.textContent.includes('\\nG18\\nG95\\n') && document.querySelector('.manufacturing-gcode-preview pre')?.textContent.includes('\\nM5\\nM2\\n%')`, 'podgląd programu tokarskiego');
    const layout = await window.webContents.executeJavaScript(`(() => { const panel = document.querySelector('.manufacturing-panel').getBoundingClientRect(); return { insideViewport: panel.left >= 0 && panel.top >= 0 && panel.right <= innerWidth && panel.bottom <= innerHeight, overflow: document.documentElement.scrollWidth > innerWidth, title: document.querySelector('.manufacturing-panel > header').textContent, code: document.querySelector('.manufacturing-gcode-preview pre').textContent }; })()`);
    if (!layout.insideViewport || layout.overflow || !layout.title.includes('Toczenie 2-osiowe') || !layout.code.includes('T1 M6')) throw new Error(`Niepoprawny interfejs toczenia: ${JSON.stringify(layout)}`);
    await new Promise((resolve) => setTimeout(resolve, 150));
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'en' } });
    await waitFor(window, `window.__madcadVerifyLoadTimelineFixture && document.querySelector('.workspace-tabs')`, 'English UI ready');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click(); window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready'`, 'English fixture');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.workspace-tabs button')].find((button) => button.textContent.trim() === 'MANUFACTURE').click()`);
    await waitFor(window, `document.querySelector('[data-tool-label="Nowy Setup"]')`, 'English manufacturing workspace');
    await window.webContents.executeJavaScript(`document.querySelector('[data-tool-label="Nowy Setup"]').click()`);
    await waitFor(window, `document.querySelector('.manufacturing-summary.valid')`, 'English base setup');
    await changeSelectByLabel(window, 'Process type', 'turning-2axis');
    await waitFor(window, `document.querySelector('.manufacturing-panel > header')?.textContent.includes('2-axis turning')`, 'English turning setup');
    await window.webContents.executeJavaScript(`document.querySelectorAll('.manufacturing-page-tabs button')[1].click()`);
    await waitFor(window, `document.querySelector('.manufacturing-add-actions')?.textContent.includes('Outside turning')`, 'English turning operations');
    const untranslated = await window.webContents.executeJavaScript(`(() => { const values = []; const pattern = /(?:[ąćęłńóśźż]|\\b(?:Zaznacz|Wybierz|Pokaż|Ukryj|Nowy|Usuń|Cofnij|Ponów|Płaszczyzna|Utwórz|Dodaj|Sprawdź|Średnica|Toczenie|Cięcie|Nóż|Oś)\\b)/i; document.querySelector('.manufacturing-panel').querySelectorAll('*').forEach((element) => { if (!element.children.length && pattern.test(element.textContent.trim())) values.push(element.textContent.trim()); for (const attribute of ['aria-label', 'title', 'placeholder']) { const value = element.getAttribute(attribute); if (value && pattern.test(value)) values.push(value); } }); return [...new Set(values)]; })()`);
    if (untranslated.length) throw new Error(`English CAM contains untranslated Polish: ${JSON.stringify(untranslated)}`);
    process.stdout.write(`${JSON.stringify({ screenshotPath, operations: state.setup.operations, segmentCount: state.visual.segmentCount, layoutVerified: true, englishVerified: true }, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
