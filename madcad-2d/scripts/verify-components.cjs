const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-components.png');

async function waitFor(window, expression, label, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

async function clickByText(window, selector, text) {
  return window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll(${JSON.stringify(selector)})].find((item) => item.textContent.trim().includes(${JSON.stringify(text)}));
    if (!button) return false;
    button.click();
    return true;
  })()`);
}

async function setInput(window, selector, value) {
  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!input) throw new Error('Brak pola: ' + ${JSON.stringify(selector)});
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-components-verifier-${Date.now()}` } });
  window.setContentSize(1440, 837);
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'interfejs aplikacji');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await waitFor(window, `typeof window.__madcadVerifyLoadTimelineFixture === 'function'`, 'fixture modelu');
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.bodyIds?.length >= 2`, 'bryły fixture');
    await window.webContents.executeJavaScript(`(() => { const bodyId = window.__madcadVerifyDocumentState.bodyIds[0]; window.__madcadVerifyTopologySelection({ kind: 'body', id: bodyId, bodyId }); })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'body'`, 'zaznaczona bryła');

    if (!(await clickByText(window, '.ribbon-tool, .ribbon-overflow-menu button', 'Nowa część'))) throw new Error('Nie znaleziono polecenia Nowa część.');
    await waitFor(window, `window.__madcadVerifyDocumentState?.components?.length === 1 && window.__madcadVerifyDocumentState.components[0].bodyIds.length === 1 && document.querySelector('.component-panel')`, 'część z bryły');
    const partId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.components[0].id`);
    await setInput(window, 'input[aria-label="Nazwa komponentu"]', 'Rama główna');
    await waitFor(window, `window.__madcadVerifyDocumentState.components.find((item) => item.id === ${JSON.stringify(partId)})?.name === 'Rama główna'`, 'nazwa części');
    await setInput(window, 'input[aria-label="Numer części komponentu"]', 'MC-RAMA-001');
    await waitFor(window, `window.__madcadVerifyDocumentState.components.find((item) => item.id === ${JSON.stringify(partId)})?.partNumber === 'MC-RAMA-001'`, 'numer części');
    await setInput(window, 'input[aria-label="Materiał komponentu"]', 'S355');
    await waitFor(window, `window.__madcadVerifyDocumentState.components.find((item) => item.id === ${JSON.stringify(partId)})?.material === 'S355'`, 'materiał części');

    if (!(await clickByText(window, '.component-toolbar button', 'Nowe złożenie'))) throw new Error('Nie znaleziono tworzenia złożenia.');
    await waitFor(window, `window.__madcadVerifyDocumentState.components.length === 2 && window.__madcadVerifyDocumentState.selection.kind === 'component'`, 'nowe złożenie');
    const assemblyId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.components.find((item) => item.type === 'assembly').id`);
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.component-list > button')].find((button) => button.textContent.includes('Rama główna')).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.selection.id === ${JSON.stringify(partId)}`, 'ponowne zaznaczenie części');
    await window.webContents.executeJavaScript(`(() => {
      const select = document.querySelector('select[aria-label="Złożenie nadrzędne"]');
      select.value = ${JSON.stringify(assemblyId)};
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.components.find((item) => item.id === ${JSON.stringify(assemblyId)})?.componentIds.includes(${JSON.stringify(partId)})`, 'hierarchia złożenia');
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `!window.__madcadVerifyDocumentState.components.find((item) => item.id === ${JSON.stringify(assemblyId)})?.componentIds.includes(${JSON.stringify(partId)})`, 'undo hierarchii');
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.components.find((item) => item.id === ${JSON.stringify(assemblyId)})?.componentIds.includes(${JSON.stringify(partId)})`, 'redo hierarchii');

    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    const result = await window.webContents.executeJavaScript(`(() => {
      const state = window.__madcadVerifyDocumentState;
      const panel = document.querySelector('.component-panel').getBoundingClientRect();
      const assembly = state.components.find((item) => item.type === 'assembly');
      const part = state.components.find((item) => item.type === 'part');
      return {
        schemaVersion: state.schemaVersion,
        components: state.components.length,
        assemblyChildren: assembly.componentIds.length,
        partNumber: part.partNumber,
        material: part.material,
        ownedBodies: part.bodyIds.length,
        browserRows: document.querySelectorAll('.tree-component').length,
        panelInsideViewport: panel.left >= 0 && panel.top >= 0 && panel.right <= innerWidth && panel.bottom <= innerHeight,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    if (result.schemaVersion !== 10 || result.components !== 2 || result.assemblyChildren !== 1 || result.partNumber !== 'MC-RAMA-001' || result.material !== 'S355' || result.ownedBodies !== 1 || result.browserRows !== 2 || !result.panelInsideViewport || result.horizontalOverflow) {
      throw new Error(`Niepoprawny przepływ komponentów: ${JSON.stringify(result)}`);
    }
    process.stdout.write(`${JSON.stringify({ screenshotPath, ...result }, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
