const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-layers.png');

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

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    webPreferences: { partition: `madcad-layers-verifier-${Date.now()}` },
  });
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
    await waitFor(window, `window.__madcadSketchVisibilityState?.entityIds?.length > 0`, 'wyrenderowany szkic');
    if (!(await clickByText(window, '.ribbon-tool, .ribbon-overflow-menu button', 'Warstwy'))) throw new Error('Nie znaleziono przycisku Warstwy.');
    await waitFor(window, `document.querySelector('.layers-panel')`, 'panel warstw');
    if (!(await clickByText(window, '.layers-toolbar button', 'Nowa warstwa'))) throw new Error('Nie znaleziono przycisku nowej warstwy.');
    await waitFor(window, `document.querySelectorAll('.layer-row').length === 2 && document.querySelector('.layer-row.active')`, 'nowa aktywna warstwa');

    const selectedId = await window.webContents.executeJavaScript(`(() => {
      const entity = window.__madcadVerifyDocumentState.sketches[0].entityData.find((item) => item.type === 'line');
      window.__madcadVerifySketchSelection([entity.id], 'replace');
      return entity.id;
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.selection?.ids?.includes(${JSON.stringify(selectedId)})`, 'zaznaczenie linii');

    await window.webContents.executeJavaScript(`(() => {
      const active = document.querySelector('.layer-row.active');
      const lineType = active.querySelectorAll('select')[0];
      lineType.value = 'dashed';
      lineType.dispatchEvent(new Event('change', { bubbles: true }));
      const layerSelect = document.querySelector('.layer-selection-properties label select');
      layerSelect.value = window.__madcadVerifyDocumentState.activeLayerId;
      layerSelect.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.sketches[0].entityData.find((item) => item.id === ${JSON.stringify(selectedId)})?.layerId === window.__madcadVerifyDocumentState.activeLayerId`, 'przypisanie do warstwy');
    await waitFor(window, `window.__madcadSketchVisibilityState.renderedEntities.find((item) => item.id === ${JSON.stringify(selectedId)})?.dashed`, 'kreskowe renderowanie ByLayer');

    await window.webContents.executeJavaScript(`document.querySelector('.layer-row.active button[aria-label^="Zablokuj"]')?.click()`);
    await waitFor(window, `!window.__madcadSketchVisibilityState.pickableEntityIds.includes(${JSON.stringify(selectedId)})`, 'blokada wyboru warstwy');
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());

    const result = await window.webContents.executeJavaScript(`(() => {
      const panel = document.querySelector('.layers-panel');
      const rect = panel.getBoundingClientRect();
      const entity = window.__madcadVerifyDocumentState.sketches[0].entityData.find((item) => item.id === ${JSON.stringify(selectedId)});
      const render = window.__madcadSketchVisibilityState.renderedEntities.find((item) => item.id === ${JSON.stringify(selectedId)});
      return {
        layers: window.__madcadVerifyDocumentState.layers.length,
        activeLayerId: window.__madcadVerifyDocumentState.activeLayerId,
        assignedLayerId: entity.layerId,
        lineType: window.__madcadVerifyDocumentState.layers.find((item) => item.id === entity.layerId)?.lineType,
        renderedDashed: render?.dashed,
        renderedLocked: render?.locked,
        pickable: window.__madcadSketchVisibilityState.pickableEntityIds.includes(entity.id),
        insideViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    if (result.layers !== 2 || result.assignedLayerId !== result.activeLayerId || result.lineType !== 'dashed' || !result.renderedDashed || !result.renderedLocked || result.pickable || !result.insideViewport || result.horizontalOverflow) {
      throw new Error(`Niepoprawny menedżer warstw: ${JSON.stringify(result)}`);
    }
    process.stdout.write(`${JSON.stringify({ screenshotPath, ...result }, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
