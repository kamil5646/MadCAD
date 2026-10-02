const fs = require('fs/promises');
const path = require('path');
const { pathToFileURL } = require('node:url');
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
    const target = [...document.querySelectorAll(${JSON.stringify(selector)})].find((item) => item.textContent.trim() === ${JSON.stringify(label)} || item.querySelector('.ribbon-label')?.textContent.trim() === ${JSON.stringify(label)} || item.querySelector('strong')?.textContent.trim() === ${JSON.stringify(label)});
    target?.click();
    return Boolean(target);
  })()`);
}

async function selectWorkspace(window, value) {
  await window.webContents.executeJavaScript(`(() => {
    const labels = { solid: 'PROJEKTUJ', drawing: 'ARKUSZ 2D', tools: 'ZARZĄDZAJ' };
    const button = [...document.querySelectorAll('.workspace-tabs button')].find((item) => item.textContent.trim() === labels[${JSON.stringify(value)}]);
    if (!button) throw new Error('Brak głównego obszaru programu.');
    button.click();
  })()`);
}

const drawingCommandMenus = Object.freeze({
  Rzut: 'Widoki zależne',
  Przekrój: 'Widoki zależne',
  Detal: 'Widoki zależne',
  'Usuń widok': 'Widoki zależne',
  'Wymiar X': 'Wymiary',
  'Wymiar Y': 'Wymiary',
  'Wymiar między punktami': 'Wymiary',
  Oś: 'Osie i środki',
  Środek: 'Osie i środki',
  'Opis otworu': 'Opisy techniczne',
  'Opis gwintu': 'Opisy techniczne',
  Balon: 'Opisy techniczne',
  'GD&T': 'Opisy techniczne',
  'Usuń oznaczenie': 'Opisy techniczne',
  'Tabliczka rysunkowa': 'Ustawienia',
  'Rewizje arkusza': 'Ustawienia',
});

async function clickRibbonCommand(window, label) {
  if (await clickText(window, '.ribbon-tool:not(.ribbon-tool-menu-trigger)', label)) return true;
  const menuLabel = drawingCommandMenus[label];
  if (!menuLabel || !(await clickText(window, '.ribbon-tool-menu-trigger', menuLabel))) return false;
  await waitFor(window, `[...document.querySelectorAll('.ribbon-tool-submenu button strong')].some((item) => item.textContent.trim() === ${JSON.stringify(label)})`, `menu polecenia ${label}`);
  return clickText(window, '.ribbon-tool-submenu button', label);
}

app.whenReady().then(async () => {
  const { DOCUMENT_SCHEMA_VERSION } = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'cad-core', 'document.js')).href);
  const window = new BrowserWindow({ width: 1500, height: 940, show: true, webPreferences: { partition: `madcad-drawing-${Date.now()}` } });
  const executeJavaScript = window.webContents.executeJavaScript.bind(window.webContents);
  window.webContents.executeJavaScript = async (expression, ...args) => {
    try { return await executeJavaScript(expression, ...args); }
    catch (error) { throw new Error(`Nieudana akcja renderera: ${expression}\n${error.message}`, { cause: error }); }
  };
  window.webContents.on('console-message', (details) => {
    if (details.level === 'error') process.stderr.write(`[renderer] ${details.message}\n`);
  });
  window.setContentSize(1500, 877);
  try {
    await fs.mkdir(artifactsDir, { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'interfejs aplikacji');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await waitFor(window, `document.querySelector('.engine-status.ready') && typeof window.__madcadVerifyLoadTimelineFixture === 'function'`, 'gotowy silnik CAD', 45000);
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 2`, 'fixture modelu', 45000);

    await selectWorkspace(window, 'drawing');
    await waitFor(window, `document.querySelector('.drawing-empty')`, 'pusty obszar dokumentacji');
    await waitFor(window, `document.querySelector('.modeling-shell')?.classList.contains('drawing-mode') && !document.querySelector('.model-browser') && !document.querySelector('.timeline') && ![...document.querySelectorAll('.app-menu button')].some((button) => button.textContent.trim() === 'Panel')`, 'odseparowany obszar arkusza bez przeglądarki modelu i osi historii');
    if (!(await clickText(window, '.ribbon-tool', 'Nowy arkusz'))) throw new Error('Brak polecenia Nowy arkusz.');
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.length === 1 && document.querySelector('.drawing-paper')`, 'utworzony arkusz');
    if (!(await clickRibbonCommand(window, 'Tabliczka rysunkowa'))) throw new Error('Brak polecenia Tabliczka rysunkowa.');
    await waitFor(window, `document.querySelector('.drawing-sheet-details[open]:not(.drawing-revisions)')`, 'widoczna tabliczka rysunkowa');
    if (!(await clickRibbonCommand(window, 'Rewizje arkusza'))) throw new Error('Brak polecenia Rewizje arkusza.');
    await waitFor(window, `document.querySelector('.drawing-revisions[open]')`, 'widoczna historia rewizji');
    if (!(await clickText(window, '.ribbon-tool', 'Model 3D'))) throw new Error('Brak polecenia Model 3D.');
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.views?.length === 1 && document.querySelectorAll('.drawing-view line').length > 8`, 'skojarzony widok bazowy');
    await waitFor(window, `JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null')?.drawings?.[0]?.views?.length === 1`, 'autozapis arkusza');
    // The view switches to the kernel's hidden-line projection once it arrives for this model revision.
    await waitFor(window, `window.__madcadDrawingProjectionState?.bodies >= 1`, 'rzut arkusza z usuwaniem linii ukrytych', 30000);

    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.views?.length === 0`, 'undo widoku');
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.views?.length === 1`, 'redo widoku');

    if (!(await clickRibbonCommand(window, 'Rzut'))) throw new Error('Brak polecenia Rzut.');
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.views?.[1]?.type === 'projected'`, 'widok rzutowany');
    await window.webContents.executeJavaScript(`document.querySelectorAll('.drawing-view')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    if (!(await clickRibbonCommand(window, 'Przekrój'))) throw new Error('Brak polecenia Przekrój.');
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.views?.[2]?.type === 'section' && document.querySelectorAll('.drawing-hatch').length > 0`, 'przekrój i kreskowanie');
    await window.webContents.executeJavaScript(`document.querySelectorAll('.drawing-view')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    if (!(await clickRibbonCommand(window, 'Detal'))) throw new Error('Brak polecenia Detal.');
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.views?.[3]?.type === 'detail' && document.querySelector('.drawing-detail-border')`, 'powiększony detal');
    await waitFor(window, `JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null')?.drawings?.[0]?.views?.length === 4`, 'autozapis widoków pochodnych');

    await window.webContents.executeJavaScript(`document.querySelector('.app-help-trigger')?.click()`);
    await waitFor(window, `document.querySelector('.app-help-trigger')?.getAttribute('aria-expanded') === 'true'`, 'otwarte menu Pomoc');
    await window.webContents.executeJavaScript(`document.querySelector('.drawing-paper')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`);
    await waitFor(window, `document.querySelector('.app-help-trigger')?.getAttribute('aria-expanded') === 'false' && !document.querySelector('.app-help-menu [role="menu"]')`, 'menu Pomoc zamknięte po kliknięciu poza nim');

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
      if (!(await clickRibbonCommand(window, label))) throw new Error(`Brak polecenia ${label}.`);
    }
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.annotations?.length === 8 && document.querySelectorAll('.drawing-user-annotation').length === 8 && document.querySelector('.drawing-feature-control-frame rect') && document.querySelector('.drawing-balloon circle')`, 'skojarzone adnotacje rysunkowe, GD&T i balon pozycji');

    // Point-to-point dimension: pick two vertices of a horizontal edge in the first view.
    await window.webContents.executeJavaScript(`document.querySelectorAll('.drawing-view')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    if (!(await clickRibbonCommand(window, 'Wymiar między punktami'))) throw new Error('Brak polecenia Wymiar między punktami.');
    await waitFor(window, `document.querySelector('.drawing-paper[data-point-pick]')`, 'tryb wskazywania punktów wymiaru');
    await window.webContents.executeJavaScript(`(() => {
      const svg = document.querySelector('.drawing-paper');
      const edge = [...document.querySelectorAll('.drawing-view')[0].querySelectorAll('line')].find((line) => Math.abs(line.y1.baseVal.value - line.y2.baseVal.value) < 1e-6 && Math.abs(line.x1.baseVal.value - line.x2.baseVal.value) > 5);
      const matrix = svg.getScreenCTM();
      for (const [x, y] of [[edge.x1.baseVal.value, edge.y1.baseVal.value], [edge.x2.baseVal.value, edge.y2.baseVal.value]]) {
        const client = new DOMPoint(x, y).matrixTransform(matrix);
        svg.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: client.x, clientY: client.y }));
      }
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.annotations?.some((item) => item.type === 'point-dimension' && item.axis === 'horizontal') && document.querySelector('.drawing-point-dimension text') && !document.querySelector('.drawing-paper[data-point-pick]')`, 'wymiar między punktami na arkuszu');
    const pointDimensionText = await window.webContents.executeJavaScript(`document.querySelector('.drawing-point-dimension text').textContent`);
    if (!/^\d+\.\d{2}$/.test(pointDimensionText)) throw new Error(`Nieoczekiwany tekst wymiaru między punktami: ${pointDimensionText}`);

    // Dimension style: decimal comma and larger lettering apply to the rendered dimensions.
    await window.webContents.executeJavaScript(`(() => {
      const set = (selector, value) => { const select = document.querySelector(selector); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, value); select.dispatchEvent(new Event('change', { bubbles: true })); };
      set('[data-dimension-decimal]', ',');
      set('[data-dimension-text-height]', '5');
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.dimensionStyle?.decimalSeparator === ',' && [...document.querySelectorAll('.drawing-linear-dimension text')].some((item) => /\\d,\\d/.test(item.textContent) && item.style.fontSize === '5px')`, 'styl wymiarów z przecinkiem i tekstem 5 mm');
    await window.webContents.executeJavaScript(`(() => { const select = document.querySelector('[data-dimension-decimal]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, '.'); select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.dimensionStyle?.decimalSeparator === '.'`, 'powrót do kropki dziesiętnej');

    await window.webContents.executeJavaScript(`document.querySelectorAll('.drawing-view')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    if (!(await clickText(window, '.ribbon-tool', 'BOM'))) throw new Error('Brak polecenia BOM.');
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.tables?.length === 1 && document.querySelector('.drawing-table-bom')`, 'automatyczne zestawienie części');
    await window.webContents.executeJavaScript(`document.querySelectorAll('.drawing-view')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    if (!(await clickText(window, '.ribbon-tool', 'Tabela otworów'))) throw new Error('Brak polecenia Tabela otworów.');
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.tables?.length === 2 && document.querySelector('.drawing-table-hole-table')`, 'skojarzona tabela otworów');
    await waitFor(window, `(() => { const saved = JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null'); return saved?.drawings?.[0]?.annotations?.length === 9 && saved?.drawings?.[0]?.tables?.length === 2; })()`, 'autozapis oznaczeń i tabel');
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

    await window.webContents.executeJavaScript(`document.querySelector('button[aria-label="Powiększ arkusz"]')?.click()`);
    await waitFor(window, `document.querySelector('.drawing-canvas-toolbar output')?.textContent.trim() === '110%'`, 'powiększenie arkusza');
    await window.webContents.executeJavaScript(`document.querySelector('button[aria-label="Ukryj listę arkuszy"]')?.click()`);
    await waitFor(window, `document.querySelector('.drawing-workspace')?.classList.contains('sheets-collapsed') && !document.querySelector('.drawing-sheet-list')?.checkVisibility()`, 'zwinięta lista arkuszy');
    await window.webContents.executeJavaScript(`document.querySelector('button[aria-label="Pokaż listę arkuszy"]')?.click(); document.querySelector('button[aria-label="Ukryj właściwości"]')?.click()`);
    await waitFor(window, `!document.querySelector('.drawing-workspace')?.classList.contains('sheets-collapsed') && document.querySelector('.drawing-workspace')?.classList.contains('properties-collapsed') && !document.querySelector('.drawing-properties')?.checkVisibility()`, 'zwinięte właściwości');
    await window.webContents.executeJavaScript(`document.querySelector('button[aria-label="Pokaż właściwości"]')?.click(); document.querySelector('button[aria-label="Dopasuj arkusz do okna"]')?.click()`);
    await waitFor(window, `!document.querySelector('.drawing-workspace')?.classList.contains('properties-collapsed') && document.querySelector('.drawing-canvas-toolbar output')?.textContent.trim() === '100%'`, 'przywrócone panele i dopasowanie');

    await window.webContents.executeJavaScript(`document.querySelector('#fileMenuBtn')?.click()`);
    await waitFor(window, `document.querySelector('.file-backstage')`, 'menu Plik z eksportem rysunku');
    const state = await window.webContents.executeJavaScript(`(() => {
      const workspace = document.querySelector('.drawing-workspace');
      const paper = document.querySelector('.drawing-paper');
      const pdfButton = document.querySelector('#fileExportPdfBtn');
      const dxfButton = document.querySelector('#fileExportDxfBtn');
      return {
        schemaVersion: window.__madcadVerifyDocumentState.schemaVersion,
        sheets: window.__madcadVerifyDocumentState.drawings.length,
        views: window.__madcadVerifyDocumentState.drawings[0].views.length,
        orientation: window.__madcadVerifyDocumentState.drawings[0].views[0].orientation,
        viewTypes: window.__madcadVerifyDocumentState.drawings[0].views.map((view) => view.type),
        lineCount: document.querySelectorAll('.drawing-view line').length,
        visibleProjectionLines: [...document.querySelectorAll('.drawing-view line')].filter((line) => line.getTotalLength() > 0.5 && !['none', 'transparent'].includes(getComputedStyle(line).stroke)).length,
        projectedInkInsidePaper: [...document.querySelectorAll('.drawing-view line')].every((line) => {
          const lineRect = line.getBoundingClientRect();
          const paperRect = paper.getBoundingClientRect();
          return lineRect.left >= paperRect.left - 1 && lineRect.right <= paperRect.right + 1 && lineRect.top >= paperRect.top - 1 && lineRect.bottom <= paperRect.bottom + 1;
        }),
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
        outputInFileMenu: Boolean(pdfButton?.closest('.file-backstage') && dxfButton?.closest('.file-backstage')),
        visibleRibbonGroups: [...document.querySelectorAll('.ribbon-group:not([hidden])')].map((item) => item.getAttribute('aria-label')),
        overflowVisible: Boolean(document.querySelector('.ribbon-overflow-trigger')),
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth || workspace.scrollWidth > workspace.clientWidth,
        paperInsideStage: paper.getBoundingClientRect().left >= workspace.getBoundingClientRect().left && paper.getBoundingClientRect().right <= workspace.getBoundingClientRect().right,
        drawingMode: document.querySelector('.modeling-shell')?.classList.contains('drawing-mode') || false,
        projectBrowserHidden: !document.querySelector('.model-browser'),
        timelineHidden: !document.querySelector('.timeline'),
        zoomToolbar: document.querySelector('.drawing-canvas-toolbar output')?.textContent.trim() === '100%',
        panelToggles: Boolean(document.querySelector('button[aria-label="Ukryj listę arkuszy"]') && document.querySelector('button[aria-label="Ukryj właściwości"]')),
      };
    })()`);
    await window.webContents.executeJavaScript(`document.querySelector('.file-backstage-dismiss')?.click()`);
    await waitFor(window, `!document.querySelector('.file-backstage')`, 'zamknięte menu Plik przed kontrolą wizualną');
    await new Promise((resolve) => setTimeout(resolve, 120));
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    if (state.schemaVersion !== DOCUMENT_SCHEMA_VERSION || state.sheets !== 1 || state.views !== 4 || state.orientation !== 'top' || state.viewTypes.join('|') !== 'base|projected|section|detail' || state.lineCount < 20 || state.visibleProjectionLines < 20 || !state.projectedInkInsidePaper || state.hatchCount < 1 || state.annotationCount !== 11 || state.userAnnotationCount !== 9 || state.annotationTypes.join('|') !== 'linear-dimension|linear-dimension|centerline|center-mark|hole-note|hole-note|feature-control-frame|balloon|point-dimension' || !state.holeNote.includes('⌀') || !state.threadNote.includes('M8×1.25') || !state.gdtFrame || !state.balloonVisible || state.tables !== 2 || state.bomRows < 1 || state.holeRows < 1 || state.revisions !== 1 || state.partNumber !== 'MC-VERIFY-001' || state.associatedViewCount !== 3 || !state.pdfEnabled || !state.dxfEnabled || !state.outputInFileMenu || (!state.visibleRibbonGroups.includes('ZESTAWIENIA') && !state.overflowVisible) || state.horizontalOverflow || !state.paperInsideStage || !state.drawingMode || !state.projectBrowserHidden || !state.timelineHidden || !state.zoomToolbar || !state.panelToggles) {
      throw new Error(`Niepoprawny obszar dokumentacji: ${JSON.stringify(state)}`);
    }
    // Real kernel regression: the rear box is completely behind the front box.
    // Its four outline edges must be hidden, not another four solid lines.
    const core = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'cad-core', 'document.js')).href);
    const drawing = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'cad-core', 'drawing-sheets.js')).href);
    const fixture = core.createDocument('Wzajemne zasłanianie brył');
    fixture.features.push(
      core.createFeature('primitive', { primitiveType: 'box', x: '0', y: '0', z: '0', width: '20', depth: '2', height: '20' }),
      core.createFeature('primitive', { primitiveType: 'box', x: '5', y: '8', z: '5', width: '10', depth: '2', height: '10' }),
    );
    const sheet = drawing.createDrawingSheet();
    sheet.views.push(drawing.createBaseDrawingView({ bodyIds: fixture.features.map((feature) => `body-${feature.id}`), orientation: 'front', scale: 1, sheet }));
    fixture.drawings.push(sheet);
    await waitFor(window, `typeof window.__madcadVerifyLoadSerializedDocument === 'function' && (window.__madcadVerifyLoadSerializedDocument(${JSON.stringify(JSON.stringify(fixture))}), true)`, 'załadowanie fixture zasłaniania');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.evaluatedFeatureData?.at(-1)?.id === ${JSON.stringify(fixture.features.at(-1).id)}`, 'przebudowana nowa fixture');
    await window.webContents.executeJavaScript(`window.desktopApp = { saveDrawingPdf: async ({ html }) => { window.__drawingExportHtml = html; return { ok: true, filePath: 'test.pdf' }; } }; true;`);
    await selectWorkspace(window, 'drawing');
    await window.webContents.executeJavaScript(`document.querySelector('#fileMenuBtn').click()`);
    await waitFor(window, `Boolean(document.querySelector('#fileExportPdfBtn'))`, 'eksport świeżego arkusza');
    await window.webContents.executeJavaScript(`document.querySelector('#fileExportPdfBtn').click()`);
    await waitFor(window, `Boolean(window.__drawingExportHtml)`, 'dokładny rzut przed eksportem PDF');
    const occlusion = await window.webContents.executeJavaScript(`(() => {
      const html = new DOMParser().parseFromString(window.__drawingExportHtml, 'text/html');
      return { visible: html.querySelectorAll('g.geometry > line:not(.hidden)').length, hidden: html.querySelectorAll('g.geometry > line.hidden').length };
    })()`);
    if (occlusion.visible !== 4 || occlusion.hidden !== 4) throw new Error('Niepoprawne zasłanianie brył: ' + JSON.stringify(occlusion));
    state.compoundOcclusion = occlusion;
    const sectionFixture = core.createDocument('Dokładny przekrój kuli');
    sectionFixture.features.push(core.createFeature('primitive', { primitiveType: 'sphere', radius: '10', x: '0', y: '0', z: '0' }));
    const sectionSheet = drawing.createDrawingSheet();
    const sphereView = drawing.createBaseDrawingView({ bodyIds: [`body-${sectionFixture.features[0].id}`], orientation: 'front', scale: 1, sheet: sectionSheet });
    sectionSheet.views.push(sphereView, drawing.createSectionDrawingView({ parentView: sphereView, sectionPosition: 0.5 }));
    sectionFixture.drawings.push(sectionSheet);
    await window.webContents.executeJavaScript(`window.__drawingExportHtml = null; window.__madcadVerifyLoadSerializedDocument(${JSON.stringify(JSON.stringify(sectionFixture))}); true;`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.evaluatedFeatureData?.[0]?.id === ${JSON.stringify(sectionFixture.features[0].id)}`, 'dokładna kula do przekroju');
    await window.webContents.executeJavaScript(`document.querySelector('#fileMenuBtn').click()`);
    await waitFor(window, `Boolean(document.querySelector('#fileExportPdfBtn'))`, 'eksport przekroju');
    await window.webContents.executeJavaScript(`document.querySelector('#fileExportPdfBtn').click()`);
    await waitFor(window, `Boolean(window.__drawingExportHtml)`, 'dokładny przekrój B-Rep przed PDF');
    const exactSection = await window.webContents.executeJavaScript(`(() => {
      const html = new DOMParser().parseFromString(window.__drawingExportHtml, 'text/html');
      const lines = [...html.querySelectorAll('g.geometry.section > line:not(.hatch):not(.hidden)')];
      const points = lines.flatMap((line) => [[Number(line.getAttribute('x1')), Number(line.getAttribute('y1'))], [Number(line.getAttribute('x2')), Number(line.getAttribute('y2'))]]);
      const center = [Math.min(...points.map(p => p[0])) + 10, Math.min(...points.map(p => p[1])) + 10];
      return { count: lines.length, radiusError: Math.max(...points.map(p => Math.abs(Math.hypot(p[0] - center[0], p[1] - center[1]) - 10))) };
    })()`);
    if (exactSection.count < 100 || exactSection.radiusError > 0.002) throw new Error('Niepoprawny dokładny przekrój kuli: ' + JSON.stringify(exactSection));
    state.exactSphereSection = exactSection;
    // Windows pipes stdout asynchronously. Exiting Electron before the write
    // callback can leave its completion handle invalid despite passing checks.
    process.stdout.write(`${JSON.stringify({ screenshotPath, ...state }, null, 2)}\n`, () => app.exit(0));
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
