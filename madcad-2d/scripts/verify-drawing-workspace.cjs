const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const artifactsDir = path.join(__dirname, '..', 'artifacts');
const screenshotPath = path.join(artifactsDir, 'madcad-drawing-workspace.png');

async function waitFor(window, expression, label, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

async function clickText(window, selector, label) {
  return window.webContents.executeJavaScript(`(() => {
    const target = [...document.querySelectorAll(${JSON.stringify(selector)})].find((item) => item.textContent.trim() === ${JSON.stringify(label)} || item.querySelector('.ribbon-label')?.textContent.trim() === ${JSON.stringify(label)});
    target?.click();
    return Boolean(target);
  })()`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1500, height: 940, show: true, webPreferences: { partition: `madcad-drawing-${Date.now()}` } });
  window.setContentSize(1500, 877);
  try {
    await fs.mkdir(artifactsDir, { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'interfejs aplikacji');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await waitFor(window, `document.querySelector('.engine-status.ready') && typeof window.__madcadVerifyLoadTimelineFixture === 'function'`, 'gotowy silnik CAD', 45000);
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 2`, 'fixture modelu', 45000);

    if (!(await clickText(window, '.workspace-tabs button', 'DOKUMENTACJA'))) throw new Error('Brak obszaru DOKUMENTACJA.');
    await waitFor(window, `document.querySelector('.drawing-empty')`, 'pusty obszar dokumentacji');
    if (!(await clickText(window, '.ribbon-tool', 'Nowy arkusz'))) throw new Error('Brak polecenia Nowy arkusz.');
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.length === 1 && document.querySelector('.drawing-paper')`, 'utworzony arkusz');
    if (!(await clickText(window, '.ribbon-tool', 'Widok bazowy'))) throw new Error('Brak polecenia Widok bazowy.');
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.views?.length === 1 && document.querySelectorAll('.drawing-view line').length > 8`, 'skojarzony widok bazowy');
    await waitFor(window, `JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null')?.drawings?.[0]?.views?.length === 1`, 'autozapis arkusza');

    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.views?.length === 0`, 'undo widoku');
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.views?.length === 1`, 'redo widoku');

    if (!(await clickText(window, '.ribbon-tool', 'Rzut'))) throw new Error('Brak polecenia Rzut.');
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.views?.[1]?.type === 'projected'`, 'widok rzutowany');
    await window.webContents.executeJavaScript(`document.querySelectorAll('.drawing-view')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    if (!(await clickText(window, '.ribbon-tool', 'Przekrój'))) throw new Error('Brak polecenia Przekrój.');
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.views?.[2]?.type === 'section' && document.querySelectorAll('.drawing-hatch').length > 0`, 'przekrój i kreskowanie');
    await window.webContents.executeJavaScript(`document.querySelectorAll('.drawing-view')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    if (!(await clickText(window, '.ribbon-tool', 'Detal'))) throw new Error('Brak polecenia Detal.');
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.views?.[3]?.type === 'detail' && document.querySelector('.drawing-detail-border')`, 'powiększony detal');
    await waitFor(window, `JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null')?.drawings?.[0]?.views?.length === 4`, 'autozapis widoków pochodnych');

    await window.webContents.executeJavaScript(`document.querySelectorAll('.drawing-view')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`);

    await window.webContents.executeJavaScript(`(() => {
      const select = document.querySelector('.drawing-view-properties select');
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(select, 'top');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.views?.[0]?.orientation === 'top'`, 'zmiana orientacji widoku bazowego');

    for (const label of ['Wymiar X', 'Wymiar Y', 'Oś', 'Środek', 'Opis otworu', 'Opis gwintu', 'GD&T', 'Balon']) {
      await window.webContents.executeJavaScript(`document.querySelectorAll('.drawing-view')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
      if (!(await clickText(window, '.ribbon-tool', label))) throw new Error(`Brak polecenia ${label}.`);
    }
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.annotations?.length === 8 && document.querySelectorAll('.drawing-user-annotation').length === 8 && document.querySelector('.drawing-feature-control-frame rect') && document.querySelector('.drawing-balloon circle')`, 'skojarzone adnotacje rysunkowe, GD&T i balon pozycji');

    await window.webContents.executeJavaScript(`document.querySelectorAll('.drawing-view')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    if (!(await clickText(window, '.ribbon-tool', 'BOM'))) throw new Error('Brak polecenia BOM.');
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.tables?.length === 1 && document.querySelector('.drawing-table-bom')`, 'automatyczne zestawienie części');
    await window.webContents.executeJavaScript(`document.querySelectorAll('.drawing-view')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    if (!(await clickText(window, '.ribbon-tool', 'Tabela otworów'))) throw new Error('Brak polecenia Tabela otworów.');
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.tables?.length === 2 && document.querySelector('.drawing-table-hole-table')`, 'skojarzona tabela otworów');
    await waitFor(window, `(() => { const saved = JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null'); return saved?.drawings?.[0]?.annotations?.length === 8 && saved?.drawings?.[0]?.tables?.length === 2; })()`, 'autozapis oznaczeń i tabel');
    await window.webContents.executeJavaScript(`document.querySelector('.drawing-revisions summary')?.click()`);
    if (!(await clickText(window, '.drawing-add-revision', 'Dodaj rewizję'))) throw new Error('Brak polecenia Dodaj rewizję.');
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.revisions?.length === 1`, 'historia rewizji');
    await window.webContents.executeJavaScript(`(() => {
      document.querySelector('.drawing-sheet-details:not(.drawing-revisions) summary')?.click();
      const label = [...document.querySelectorAll('.drawing-sheet-details label')].find((item) => item.textContent.includes('Numer części'));
      const input = label?.querySelector('input');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      if (input) { setter.call(input, 'MC-VERIFY-001'); input.dispatchEvent(new Event('change', { bubbles: true })); }
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.titleBlock?.partNumber === 'MC-VERIFY-001'`, 'konfigurowalna tabliczka');

    const state = await window.webContents.executeJavaScript(`(() => {
      const workspace = document.querySelector('.drawing-workspace');
      const paper = document.querySelector('.drawing-paper');
      const pdfButton = [...document.querySelectorAll('.ribbon-tool')].find((item) => item.querySelector('.ribbon-label')?.textContent.trim() === 'PDF');
      const dxfButton = [...document.querySelectorAll('.ribbon-tool')].find((item) => item.querySelector('.ribbon-label')?.textContent.trim() === 'DXF');
      return {
        schemaVersion: window.__madcadVerifyDocumentState.schemaVersion,
        sheets: window.__madcadVerifyDocumentState.drawings.length,
        views: window.__madcadVerifyDocumentState.drawings[0].views.length,
        orientation: window.__madcadVerifyDocumentState.drawings[0].views[0].orientation,
        viewTypes: window.__madcadVerifyDocumentState.drawings[0].views.map((view) => view.type),
        lineCount: document.querySelectorAll('.drawing-view line').length,
        hatchCount: document.querySelectorAll('.drawing-hatch').length,
        annotationCount: document.querySelectorAll('.drawing-annotation').length,
        userAnnotationCount: document.querySelectorAll('.drawing-user-annotation').length,
        annotationTypes: window.__madcadVerifyDocumentState.drawings[0].annotations.map((annotation) => annotation.type),
        holeNote: document.querySelector('.drawing-hole-note text')?.textContent || '',
        threadNote: [...document.querySelectorAll('.drawing-hole-note text')].map((item) => item.textContent).find((text) => text.includes('M8')) || '',
        gdtFrame: Boolean(document.querySelector('.drawing-feature-control-frame rect')),
        balloonVisible: Boolean(document.querySelector('.drawing-balloon circle')),
        tables: window.__madcadVerifyDocumentState.drawings[0].tables.length,
        bomRows: document.querySelectorAll('.drawing-table-bom .drawing-table-row').length,
        holeRows: document.querySelectorAll('.drawing-table-hole-table .drawing-table-row').length,
        revisions: window.__madcadVerifyDocumentState.drawings[0].revisions.length,
        partNumber: window.__madcadVerifyDocumentState.drawings[0].titleBlock.partNumber,
        associatedViewCount: window.__madcadVerifyDocumentState.drawings[0].views.filter((view) => view.parentViewId).length,
        pdfEnabled: Boolean(pdfButton && !pdfButton.disabled),
        dxfEnabled: Boolean(dxfButton && !dxfButton.disabled),
        visibleRibbonGroups: [...document.querySelectorAll('.ribbon-group:not([hidden])')].map((item) => item.getAttribute('aria-label')),
        overflowVisible: Boolean(document.querySelector('.ribbon-overflow-trigger')),
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth || workspace.scrollWidth > workspace.clientWidth,
        paperInsideStage: paper.getBoundingClientRect().left >= workspace.getBoundingClientRect().left && paper.getBoundingClientRect().right <= workspace.getBoundingClientRect().right,
      };
    })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    if (state.schemaVersion !== 9 || state.sheets !== 1 || state.views !== 4 || state.orientation !== 'top' || state.viewTypes.join('|') !== 'base|projected|section|detail' || state.lineCount < 20 || state.hatchCount < 1 || state.annotationCount !== 10 || state.userAnnotationCount !== 8 || state.annotationTypes.join('|') !== 'linear-dimension|linear-dimension|centerline|center-mark|hole-note|hole-note|feature-control-frame|balloon' || !state.holeNote.includes('⌀') || !state.threadNote.includes('M8×1.25') || !state.gdtFrame || !state.balloonVisible || state.tables !== 2 || state.bomRows < 1 || state.holeRows < 1 || state.revisions !== 1 || state.partNumber !== 'MC-VERIFY-001' || state.associatedViewCount !== 3 || !state.pdfEnabled || !state.dxfEnabled || (!state.visibleRibbonGroups.includes('TABELE') && !state.overflowVisible) || state.horizontalOverflow || !state.paperInsideStage) {
      throw new Error(`Niepoprawny obszar dokumentacji: ${JSON.stringify(state)}`);
    }
    process.stdout.write(`${JSON.stringify({ screenshotPath, ...state }, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
