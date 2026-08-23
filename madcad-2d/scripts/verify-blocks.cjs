const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-blocks.png');

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
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-blocks-verifier-${Date.now()}` } });
  window.setContentSize(1440, 837);
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'interfejs aplikacji');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await waitFor(window, `typeof window.__madcadVerifyLoadTopologyFixture === 'function'`, 'fixture szkicu');
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTopologyFixture('XY')`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entityData?.length > 0`, 'dokument fixture');
    await window.webContents.executeJavaScript(`window.__madcadVerifyOpenFirstSketch()`);
    await waitFor(window, `window.__madcadSketchVisibilityState?.entityIds?.length > 0`, 'widok szkicu');
    await window.webContents.executeJavaScript(`(() => {
      const lines = window.__madcadVerifyDocumentState.sketches[0].entityData.filter((entity) => entity.type === 'line').slice(0, 4).map((entity) => entity.id);
      window.__madcadVerifySketchSelection(lines, 'replace');
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.selection?.ids?.length === 4`, 'wybór obrysu');
    if (!(await clickByText(window, '.ribbon-tool, .ribbon-overflow-menu button', 'Bloki'))) throw new Error('Nie znaleziono przycisku Bloki.');
    await waitFor(window, `document.querySelector('.blocks-panel')`, 'panel bloków');
    await setInput(window, 'input[aria-label="Nazwa nowego bloku"]', 'Obrys 40x30');
    if (!(await clickByText(window, '.block-create-section button', 'Utwórz blok'))) throw new Error('Nie znaleziono tworzenia bloku.');
    await waitFor(window, `window.__madcadVerifyDocumentState.blocks?.length === 1 && window.__madcadVerifyDocumentState.sketches[0].blockInstances?.length === 1`, 'definicja i pierwsze wystąpienie');

    await setInput(window, 'input[aria-label="Tag nowego atrybutu"]', 'NUMER');
    await setInput(window, 'input[aria-label="Wartość domyślna atrybutu"]', 'A-01');
    if (!(await clickByText(window, '.block-attribute-add button', 'Atrybut'))) throw new Error('Nie znaleziono dodawania atrybutu.');
    await waitFor(window, `window.__madcadVerifyDocumentState.blocks[0].attributeDefinitions?.[0]?.tag === 'NUMER'`, 'atrybut definicji');

    await setInput(window, '.block-insert-section .block-coordinate-row input', '60');
    if (!(await clickByText(window, '.block-insert-section > button', 'Wstaw wystąpienie'))) throw new Error('Nie znaleziono wstawiania bloku.');
    await waitFor(window, `window.__madcadVerifyDocumentState.sketches[0].blockInstances?.length === 2`, 'drugie wystąpienie');
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.sketches[0].blockInstances?.length === 1`, 'undo wstawienia bloku');
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.sketches[0].blockInstances?.length === 2`, 'redo wstawienia bloku');
    await waitFor(window, `document.querySelector('.block-instance-section input')`, 'edycja atrybutu wystąpienia');
    await setInput(window, '.block-instance-section input', 'A-02');
    await waitFor(window, `window.__madcadVerifyDocumentState.sketches[0].blockInstances.find((instance) => instance.id === window.__madcadVerifyDocumentState.sketches[0].blockInstances.at(-1).id)?.attributes?.NUMER === 'A-02'`, 'wartość atrybutu wystąpienia');
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());

    const beforeExplode = await window.webContents.executeJavaScript(`(() => {
      const state = window.__madcadVerifyDocumentState;
      const instance = state.sketches[0].blockInstances.at(-1);
      const panel = document.querySelector('.blocks-panel').getBoundingClientRect();
      return {
        blocks: state.blocks.length,
        instances: state.sketches[0].blockInstances.length,
        instanceEntities: instance.entityIds.length,
        selectedEntities: state.selection.ids.length,
        attribute: instance.attributes.NUMER,
        insideViewport: panel.left >= 0 && panel.top >= 0 && panel.right <= innerWidth && panel.bottom <= innerHeight,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    if (!(await clickByText(window, '.block-instance-section button', 'Rozbij'))) throw new Error('Nie znaleziono polecenia Rozbij.');
    await waitFor(window, `window.__madcadVerifyDocumentState.sketches[0].blockInstances?.length === 1`, 'rozbicie drugiego wystąpienia');
    const exploded = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.selection.ids.every((id) => !window.__madcadVerifyDocumentState.sketches[0].entityData.find((entity) => entity.id === id)?.blockInstanceId)`);
    if (beforeExplode.blocks !== 1 || beforeExplode.instances !== 2 || beforeExplode.instanceEntities !== 8 || beforeExplode.selectedEntities !== 8 || beforeExplode.attribute !== 'A-02' || !beforeExplode.insideViewport || beforeExplode.horizontalOverflow || !exploded) {
      throw new Error(`Niepoprawny przepływ bloków: ${JSON.stringify({ ...beforeExplode, exploded })}`);
    }
    process.stdout.write(`${JSON.stringify({ screenshotPath, ...beforeExplode, exploded }, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
