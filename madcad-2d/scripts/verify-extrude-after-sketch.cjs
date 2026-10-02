const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');
const { saveProjectTextFile, openProjectTextFile } = require('../electron/project-file-handlers.cjs');

const artifactPath = path.join(__dirname, '..', 'artifacts', 'extrude-after-sketch.png');
const thinArtifactPath = path.join(__dirname, '..', 'artifacts', 'thin-extrude-after-sketch.png');

async function waitFor(window, expression, label, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const state = await window.webContents.executeJavaScript(`({ status: window.__madcadVerifyEngineState?.status, revision: window.__madcadVerifyEngineState?.revision, command: window.__madcadVerifyDocumentState?.command, notice: document.querySelector('.workspace-notice')?.textContent, sketches: window.__madcadVerifyDocumentState?.sketches?.map((sketch) => ({ id: sketch.id, support: sketch.support, planeOffset: sketch.planeOffset })), timeline: window.__madcadVerifyEngineState?.timeline, volumes: window.__madcadVerifyEngineState?.bodies?.map((body) => body.metrics.volume), references: window.__madcadVerifyDocumentState?.references?.filter((reference) => reference.kind === 'topology').map((reference) => ({ id: reference.id, topologyId: reference.topologyId, center: reference.descriptor?.center, normal: reference.descriptor?.normal })), faces: window.__madcadVerifyEngineState?.bodies?.flatMap((body) => body.topology?.faces?.filter((face) => face.descriptor?.geometry === 'PLANE').map((face) => ({ id: face.id, center: face.descriptor.center, normal: face.descriptor.normal }))) })`);
  throw new Error(`Nie osiagnieto stanu: ${label}. ${JSON.stringify(state)}`);
}

async function clickTool(window, label) {
  await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.ribbon-tool')].find((item) => item.querySelector('.ribbon-label')?.textContent === ${JSON.stringify(label)});
    if (!button || button.disabled) throw new Error('Niedostepne narzedzie: ${label}');
    button.click();
  })()`);
}

async function setCommandField(window, label, value) {
  await window.webContents.executeJavaScript(`(() => {
    const field = [...document.querySelectorAll('.command-dialog .command-field')].find((item) => item.firstElementChild?.textContent.trim() === ${JSON.stringify(label)});
    const input = field?.querySelector('input, select');
    if (!input) throw new Error('Brak pola polecenia: ${label}');
    const key = Object.keys(input).find((item) => item.startsWith('__reactProps'));
    const handler = key && input[key]?.onChange;
    if (typeof handler !== 'function') throw new Error('Brak obsługi pola polecenia: ${label}');
    handler({ target: { value: ${JSON.stringify(String(value))} } });
  })()`);
}

app.whenReady().then(async () => {
  const projectDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'madcad-basic-project-'));
  const projectPath = path.join(projectDirectory, 'basic-design.madcad');
  const projectDialog = {
    showSaveDialog: async () => ({ canceled: false, filePath: projectPath }),
    showOpenDialog: async () => ({ canceled: false, filePaths: [projectPath] }),
  };
  ipcMain.handle('madcad:save-text-file', async (_event, payload) => saveProjectTextFile(payload, { dialog: projectDialog }));
  ipcMain.handle('madcad:open-project-file', async () => openProjectTextFile({ dialog: projectDialog }));
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'verify-basic-project-preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      partition: `madcad-extrude-sketch-${Date.now()}`,
    },
  });
  // Electron otherwise replaces renderer exceptions with a generic IPC error,
  // losing the failing action on CI. Keep the original message and expression.
  const executeJavaScript = window.webContents.executeJavaScript.bind(window.webContents);
  window.webContents.executeJavaScript = async (expression, ...args) => {
    try {
      return await executeJavaScript(expression, ...args);
    } catch (error) {
      throw new Error(`Renderer action failed: ${expression}\n${error.message}`, { cause: error });
    }
  };
  window.webContents.on('console-message', (details) => {
    if (details.level === 'error') process.stderr.write(`[renderer] ${details.message}\n`);
  });
  let exitCode = 0;
  try {
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready'`, 'gotowy silnik CAD');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button[aria-label="Zamknij"]')?.click()`);

    await clickTool(window, 'Utwórz szkic');
    await waitFor(window, `Boolean(document.querySelector('.plane-options'))`, 'wybor plaszczyzny');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.plane-options button')].find((button) => button.textContent.includes('XY'))?.click()`);
    await waitFor(window, `document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'aktywny szkic XY');

    await clickTool(window, 'Prostokąt');
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'rectangle'`, 'polecenie prostokata');
    await window.webContents.executeJavaScript(`window.__madcadVerifyCanvasSketchPoint([-20, -12])`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.gesturePoints === 1`, 'pierwszy punkt prostokata');
    await window.webContents.executeJavaScript(`window.__madcadVerifyCanvasSketchPoint([20, 12])`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.profiles === 1`, 'zamkniety profil prostokata');
    await window.webContents.executeJavaScript(`(() => {
      const pointIds = window.__madcadVerifyDocumentState.sketches[0].entityData.filter((entity) => entity.type === 'point').slice(0, 2).map((entity) => entity.id);
      if (pointIds.length !== 2) throw new Error('Brak narożników prostokąta');
      window.__madcadVerifySketchSelection(pointIds, 'replace');
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.ids?.length === 2`, 'dwa zaznaczone narożniki');
    await window.webContents.executeJavaScript(`document.querySelector('.ribbon-tool-menu-trigger[data-tool-label="Wymiary"]')?.click()`);
    await waitFor(window, `Boolean(document.querySelector('.ribbon-tool-submenu button[data-tool-label="Wymiar poziomy"]:not(:disabled)'))`, 'aktywny wymiar poziomy');
    await window.webContents.executeJavaScript(`document.querySelector('.ribbon-tool-submenu button[data-tool-label="Wymiar poziomy"]')?.click()`);
    await waitFor(window, `document.querySelector('.sketch-dimension-dialog')?.textContent.includes('Wymiar poziomy')`, 'okno wymiaru poziomego');
    await window.webContents.executeJavaScript(`document.querySelector('.sketch-dimension-dialog .confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.dimensions?.some((dimension) => dimension.type === 'horizontal')`, 'sterujący wymiar poziomy');
    await window.webContents.executeJavaScript(`(() => {
      const line = window.__madcadVerifyDocumentState.sketches[0].entityData.filter((entity) => entity.type === 'line')[1];
      if (!line) throw new Error('Brak pionowego odcinka prostokąta');
      window.__madcadVerifySketchSelection([line.id], 'replace');
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.ids?.length === 1`, 'zaznaczony odcinek');
    await window.webContents.executeJavaScript(`document.querySelector('.ribbon-tool-menu-trigger[data-tool-label="Wymiary"]')?.click()`);
    await waitFor(window, `Boolean(document.querySelector('.ribbon-tool-submenu button[data-tool-label="Wymiar pionowy"]:not(:disabled)'))`, 'aktywny wymiar pionowy odcinka');
    await window.webContents.executeJavaScript(`document.querySelector('.ribbon-tool-submenu button[data-tool-label="Wymiar pionowy"]')?.click()`);
    await waitFor(window, `document.querySelector('.sketch-dimension-dialog')?.textContent.includes('Wymiar pionowy')`, 'okno wymiaru pionowego');
    await window.webContents.executeJavaScript(`document.querySelector('.sketch-dimension-dialog .confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.dimensions?.some((dimension) => dimension.type === 'vertical')`, 'sterujący wymiar pionowy odcinka');

    await clickTool(window, 'Zakończ szkic');
    await waitFor(window, `window.__madcadCompletedSketchVisibilityState?.profileCount === 1 && window.__madcadCompletedSketchVisibilityState?.renderedObjects > 0`, 'widoczny ukonczony szkic');

    await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(null)`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'document'`, 'utracone zaznaczenie profilu');
    await clickTool(window, 'Wyciągnij');
    await waitFor(window, `document.querySelector('.command-dialog')?.textContent.includes('Wyciągnięcie') && !document.querySelector('.plane-options')`, 'wyciagniecie bez ponownego wyboru plaszczyzny');
    await waitFor(window, `document.querySelector('.direct-handle-hit[role="slider"]') && document.querySelector('.direct-extrude-hint')`, 'widoczny manipulator wyciagniecia');
    await fs.mkdir(path.dirname(artifactPath), { recursive: true });
    await fs.writeFile(artifactPath, (await window.webContents.capturePage()).toPNG());

    await window.webContents.executeJavaScript(`(() => {
      const field = [...document.querySelectorAll('.command-dialog .command-field')].find((item) => item.querySelector(':scope > span')?.textContent.trim() === 'Odległość');
      const input = field?.querySelector('input');
      if (!input) throw new Error('Brak pola odległości wyciągnięcia');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '12');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.distance === '12'`, 'odleglosc wyciagniecia zapisana w stanie polecenia');
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 1 && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 1 && window.__madcadVerifyEngineState.bodies[0].metrics.dimensions.some((value) => Math.abs(value - 12) < 0.01)`, 'utworzona bryla po zatwierdzeniu odległości', 30000);
    const result = await window.webContents.executeJavaScript(`({
      sketches: window.__madcadVerifyDocumentState.sketches.length,
      profiles: window.__madcadVerifyDocumentState.sketches[0].profiles,
      features: window.__madcadVerifyDocumentState.features,
      bodies: window.__madcadVerifyEngineState.bodies.length,
      volume: window.__madcadVerifyEngineState.bodies[0].metrics.volume,
      dimensions: window.__madcadVerifyEngineState.bodies[0].metrics.dimensions,
      planePickerVisible: Boolean(document.querySelector('.plane-options')),
    })`);
    if (result.sketches !== 1 || result.profiles !== 1 || result.features !== 1 || result.bodies !== 1 || result.planePickerVisible || Math.abs(result.volume - 11520) > 0.01 || !result.dimensions.some((value) => Math.abs(value - 12) < 0.01)) {
      throw new Error(`Bledny wynik przeplywu szkic -> Wyciagnij: ${JSON.stringify(result)}`);
    }

    // A dblclick must use the clicked timeline entry, not a stale selection.
    // Dispatch it without a preceding click, as can happen before React has
    // rendered the first click of a fast double-click.
    process.stdout.write('[verify] timeline double-click without prior feature selection\n');
    await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(null)`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'document'`, 'puste zaznaczenie przed dwuklikiem');
    await window.webContents.executeJavaScript(`(() => {
      const item = document.querySelector('.timeline-item');
      if (!item) throw new Error('Brak operacji na osi historii');
      item.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'extrude' && window.__madcadVerifyDocumentState?.command?.distance === '12'`, 'dwuklik otwiera wskazane wyciągnięcie', 3000);
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
    await waitFor(window, `!document.querySelector('.command-dialog') && window.__madcadVerifyDocumentState?.selection?.kind === 'feature' && window.__madcadVerifyDocumentState?.selection?.id === window.__madcadVerifyDocumentState?.featureData?.[0]?.id && window.__madcadVerifyEngineState?.status === 'ready' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 11520) < 0.01`, 'anulowanie dwukliku zachowuje bryłę i zaznaczenie operacji', 3000);
    result.timelineDoubleClick = true;

    await window.webContents.executeJavaScript(`window.__madcadVerifyEditSketch(window.__madcadVerifyDocumentState.sketches[0].id)`);
    await waitFor(window, `document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'ponownie edytowany szkic');
    await window.webContents.executeJavaScript(`(() => {
      const badge = document.querySelector('.sketch-constraint-badges button[title^="distanceX:"]');
      if (!badge) throw new Error('Brak widocznego wymiaru poziomego do edycji');
      badge.click();
    })()`);
    await waitFor(window, `Boolean(document.querySelector('.sketch-constraint-editor input[name="constraintValue"]'))`, 'widoczny edytor wymiaru');
    await window.webContents.executeJavaScript(`(() => {
      const input = document.querySelector('.sketch-constraint-editor input[name="constraintValue"]');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, '50');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('.sketch-constraint-editor button[type="submit"]').click();
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.dimensions?.some((dimension) => dimension.type === 'horizontal' && dimension.expression === '50')`, 'zmieniony wymiar szkicu');
    await clickTool(window, 'Zakończ szkic');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 14400) < 0.01`, 'bryła przebudowana po zmianie wymiaru szkicu', 30000);
    result.dimensionEditedVolume = 14400;

    // Exercise the same part through the timeline, history and document
    // round-trip before switching to the independent open-chain scenario.
    process.stdout.write('[verify] edit basic extrusion from timeline\n');
    await window.webContents.executeJavaScript(`document.querySelector('.timeline-item')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'feature'`, 'wybrana operacja w historii');
    process.stdout.write('[verify] timeline feature selected\n');
    await window.webContents.executeJavaScript(`document.querySelector('[data-timeline-action="edit"]')?.click()`);
    await waitFor(window, `document.querySelector('.command-dialog')?.textContent.includes('Wyciągnięcie')`, 'edytowane wyciągnięcie');
    process.stdout.write('[verify] extrusion editor open\n');
    await window.webContents.executeJavaScript(`(() => {
      const field = [...document.querySelectorAll('.command-dialog .command-field')].find((item) => item.querySelector(':scope > span')?.textContent.trim() === 'Odległość');
      const input = field?.querySelector('input');
      const propsKey = input && Object.keys(input).find((key) => key.startsWith('__reactProps'));
      if (typeof input?.[propsKey]?.onChange !== 'function') throw new Error('Brak edycji odległości w historii');
      input[propsKey].onChange({ target: { value: '15' } });
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.distance === '15'`, 'nowa odległość wyciągnięcia');
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog .confirm')?.click()`);
    process.stdout.write('[verify] edited extrusion, undo and redo\n');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 18000) < 0.01`, 'przebudowa po edycji historii', 30000);
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 14400) < 0.01`, 'Cofnij edycję wyciągnięcia', 30000);
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 18000) < 0.01`, 'Ponów edycję wyciągnięcia', 30000);
    await window.webContents.executeJavaScript(`window.__madcadVerifyReopenCurrentDocument()`);
    process.stdout.write('[verify] reopened edited extrusion\n');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.sketches?.length === 1 && window.__madcadVerifyDocumentState?.features === 1 && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 18000) < 0.01`, 'ponownie otwarty projekt z wyciągnięciem', 30000);
    await window.webContents.executeJavaScript(`document.querySelector('#saveProjectBtn')?.click()`);
    await waitFor(window, `document.querySelector('.workspace-notice')?.textContent.includes('Zapisano projekt atomowo:')`, 'zapis pliku .madcad');
    const savedProject = JSON.parse(await fs.readFile(projectPath, 'utf8'));
    if (savedProject.features?.length !== 1 || savedProject.sketches?.length !== 1 || savedProject.features[0].distance !== '15'
      || !savedProject.sketches[0].dimensions.some((dimension) => dimension.type === 'horizontal' && dimension.expression === '50')
      || !savedProject.sketches[0].dimensions.some((dimension) => dimension.type === 'vertical' && dimension.expression === '24')) {
      throw new Error('Plik .madcad nie zachował wymiarów szkicu i edytowanego wyciągnięcia.');
    }
    await window.webContents.executeJavaScript(`document.querySelector('#newProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 0 && window.__madcadVerifyDocumentState?.sketches?.length === 0`, 'nowy pusty projekt');
    await window.webContents.executeJavaScript(`document.querySelector('#openProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.features === 1 && window.__madcadVerifyDocumentState?.sketches?.length === 1 && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 18000) < 0.01`, 'plik .madcad otwarty przez interfejs', 30000);
    result.editedVolume = 18000;
    result.undoRedo = true;
    result.reopened = true;
    result.fileRoundTrip = true;

    process.stdout.write('[verify] top-face dependent cut\n');
    const supportFace = await window.webContents.executeJavaScript(`(() => {
      const body = window.__madcadVerifyEngineState.bodies[0];
      const face = body.topology.faces.find((item) => item.descriptor.geometry === 'PLANE' && (item.descriptor.normal?.[2] || 0) > 0.99 && item.descriptor.center?.[2] > 14.9);
      return face && { id: face.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId };
    })()`);
    if (!supportFace) throw new Error('Brak górnej ściany bryły do drugiego szkicu.');
    await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify({ kind: 'face', ...supportFace })}, 'replace')`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'face'`, 'wybrana ściana pierwszej bryły');
    await clickTool(window, 'Utwórz szkic');
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[1]?.support?.kind === 'face' && document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'szkic na ścianie', 30000);
    await clickTool(window, 'Okrąg');
    await waitFor(window, `document.querySelector('.command-dialog')?.textContent.includes('Okrąg')`, 'okrąg drugiego szkicu');
    await setCommandField(window, 'Średnica', '6');
    await setCommandField(window, 'Środek X', '10');
    await setCommandField(window, 'Środek Y', '10');
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog .confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[1]?.profiles === 1`, 'zamknięty profil otworu');
    await clickTool(window, 'Zakończ szkic');
    await clickTool(window, 'Wyciągnij');
    await waitFor(window, `document.querySelector('.command-dialog')?.textContent.includes('Wyciągnięcie')`, 'drugie wyciągnięcie');
    await setCommandField(window, 'Operacja', 'cut');
    await setCommandField(window, 'Kierunek', 'through-all');
    const faceCutRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog .confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 2 && window.__madcadVerifyEngineState?.revision > ${faceCutRevision} && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.timeline?.length === 2`, 'zależne wycięcie', 30000);
    result.faceSketch = await window.webContents.executeJavaScript(`({
      support: window.__madcadVerifyDocumentState.sketches[1].support.kind,
      operation: window.__madcadVerifyDocumentState.featureData[1].operation,
      volume: window.__madcadVerifyEngineState.bodies[0].metrics.volume,
      featureStatus: window.__madcadVerifyEngineState.timeline[1].status,
    })`);
    if (result.faceSketch.support !== 'face' || result.faceSketch.operation !== 'cut' || result.faceSketch.featureStatus !== 'ok' || !(result.faceSketch.volume < 17999)) {
      throw new Error(`Szkic na ścianie nie wyciął materiału: ${JSON.stringify(result.faceSketch)}`);
    }
    await window.webContents.executeJavaScript(`document.querySelectorAll('.timeline-item')[0]?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'feature'`, 'pierwsza operacja wybrana ponownie');
    await window.webContents.executeJavaScript(`document.querySelector('[data-timeline-action="edit"]')?.click()`);
    await waitFor(window, `document.querySelector('.command-dialog')?.textContent.includes('Wyciągnięcie')`, 'ponowna edycja pierwszej operacji');
    await setCommandField(window, 'Odległość', '20');
    const dependentRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog .confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.revision > ${dependentRevision} && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.timeline?.[1]?.status === 'ok' && Number(window.__madcadVerifyDocumentState?.sketches?.[1]?.planeOffset) > 19.9 && window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume > 23000`, 'szkic i wycięcie śledzą zmianę pierwszej bryły', 30000);
    await waitFor(window, `!document.querySelector('.reference-repair-panel')`, 'podpora szkicu podąża za ścianą bez kreatora naprawy', 30000);
    result.faceSketch.rebuiltVolume = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`);
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && Number(window.__madcadVerifyDocumentState?.sketches?.[1]?.planeOffset) === 15 && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${result.faceSketch.volume}) < 0.01`, 'Cofnij operację nadrzędną i położenie szkicu', 30000);
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && Number(window.__madcadVerifyDocumentState?.sketches?.[1]?.planeOffset) === 20 && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${result.faceSketch.rebuiltVolume}) < 0.01`, 'Ponów operację nadrzędną i położenie szkicu', 30000);
    await waitFor(window, `!document.querySelector('.reference-repair-panel')`, 'Ponów nie otwiera kreatora naprawy podpory', 30000);
    result.faceSketch.undoRedo = true;
    await window.webContents.executeJavaScript(`document.querySelector('#saveProjectBtn')?.click()`);
    await waitFor(window, `document.querySelector('.workspace-notice')?.textContent.includes('Zapisano projekt atomowo:')`, 'zapis projektu z drugim szkicem');
    const savedFaceProject = JSON.parse(await fs.readFile(projectPath, 'utf8'));
    const backupProject = JSON.parse(await fs.readFile(`${projectPath}.bak`, 'utf8'));
    if (savedFaceProject.sketches?.[1]?.support?.kind !== 'face' || Number(savedFaceProject.sketches[1].planeOffset) !== 20 || savedFaceProject.features?.[1]?.operation !== 'cut') {
      throw new Error('Plik .madcad nie zachował szkicu na ścianie i zależnego wycięcia.');
    }
    if (backupProject.features?.length !== 1 || backupProject.features[0].distance !== '15') {
      throw new Error('Kopia .bak nie zachowała ostatniego poprawnego projektu przed nadpisaniem.');
    }
    await window.webContents.executeJavaScript(`document.querySelector('#newProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 0`, 'nowy projekt po wycięciu');
    await window.webContents.executeJavaScript(`document.querySelector('#openProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 2 && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.timeline?.[1]?.status === 'ok' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${result.faceSketch.rebuiltVolume}) < 0.01`, 'odtworzony projekt z wycięciem', 30000);
    result.faceSketch.fileRoundTrip = true;
    result.faceSketch.atomicBackup = true;
    const brokenSupportReferenceId = await window.webContents.executeJavaScript(`window.__madcadVerifyBreakFaceSupportReference()`);
    await waitFor(window, `Boolean(document.querySelector('.reference-repair-panel'))`, 'widoczny kreator naprawy podpory ściany');
    await window.webContents.executeJavaScript(`document.querySelector('.reference-repair-panel.collapsed .reference-repair-toggle')?.click()`);
    await waitFor(window, `Boolean(document.querySelector('.reference-repair-panel button[data-reference-action="candidate-1"]'))`, 'kandydat naprawy podpory ściany');
    await window.webContents.executeJavaScript(`(() => {
      const candidate = document.querySelector('.reference-repair-panel button[data-reference-action="candidate-1"]');
      if (!candidate) throw new Error('Brak kandydata naprawy ściany');
      candidate.click();
    })()`);
    await waitFor(window, `!document.querySelector('.reference-repair-panel') && window.__madcadVerifyDocumentState?.references?.find((reference) => reference.id === ${JSON.stringify(brokenSupportReferenceId)})?.topologyId.endsWith('-lost') === false && Number(window.__madcadVerifyDocumentState?.sketches?.[1]?.planeOffset) === 20 && window.__madcadVerifyEngineState?.timeline?.[1]?.status === 'ok'`, 'naprawiona referencja podpory szkicu', 30000);
    result.faceSketch.referenceRepair = true;

    process.stdout.write('[verify] angled-face dependent cut\n');
    const angledProject = structuredClone(savedProject);
    const normal = [0, -Math.SQRT1_2, Math.SQRT1_2];
    angledProject.sketches[0].frame = {
      origin: [0, 0, 0],
      normal,
      u: [0, Math.SQRT1_2, Math.SQRT1_2],
      v: [-1, 0, 0],
    };
    const beforeAngledLoadRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadSerializedDocument(${JSON.stringify(JSON.stringify(angledProject))})`);
    await waitFor(window, `window.__madcadVerifyEngineState?.revision > ${beforeAngledLoadRevision}
      && window.__madcadVerifyEngineState?.status === 'ready'
      && window.__madcadVerifyDocumentState?.features === 1
      && window.__madcadVerifyEngineState?.bodies?.[0]?.topology?.faces?.some((face) => face.descriptor.normal?.[1] < -0.7 && face.descriptor.normal?.[2] > 0.7)`, 'skośna bryła bazowa', 30000);
    const angledFace = await window.webContents.executeJavaScript(`(() => {
      const body = window.__madcadVerifyEngineState.bodies[0];
      const face = body.topology.faces.find((item) => item.descriptor.geometry === 'PLANE'
        && item.descriptor.normal?.[1] < -0.7 && item.descriptor.normal?.[2] > 0.7
        && item.descriptor.center?.[2] > 10);
      return face && { id: face.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId };
    })()`);
    if (!angledFace) {
      const faces = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].topology.faces.map((face) => ({ normal: face.descriptor.normal, center: face.descriptor.center }))`);
      throw new Error(`Brak skośnej końcowej ściany bazowego Wyciągnięcia: ${JSON.stringify(faces)}`);
    }
    await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify({ kind: 'face', ...angledFace })}, 'replace')`);
    await clickTool(window, 'Utwórz szkic');
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[1]?.support?.kind === 'face' && Boolean(window.__madcadVerifyDocumentState.sketches[1].frame)`, 'szkic na skośnej ścianie');
    await clickTool(window, 'Okrąg');
    await waitFor(window, `document.querySelector('.command-dialog')?.textContent.includes('Okrąg')`, 'okrąg na skośnej ścianie');
    await setCommandField(window, 'Średnica', '6');
    await setCommandField(window, 'Środek X', '0');
    await setCommandField(window, 'Środek Y', '0');
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog .confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[1]?.profiles === 1`, 'profil wycięcia na skośnej ścianie');
    await clickTool(window, 'Zakończ szkic');
    await clickTool(window, 'Wyciągnij');
    await waitFor(window, `document.querySelector('.command-dialog')?.textContent.includes('Wyciągnięcie')`, 'wycięcie skośnej bryły');
    await setCommandField(window, 'Operacja', 'cut');
    await setCommandField(window, 'Kierunek', 'through-all');
    const angledCutRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog .confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 2 && window.__madcadVerifyEngineState?.revision > ${angledCutRevision} && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.timeline?.[1]?.status === 'ok'`, 'gotowe wycięcie skośnej bryły', 30000);
    const angledBefore = await window.webContents.executeJavaScript(`({ volume: window.__madcadVerifyEngineState.bodies[0].metrics.volume, origin: window.__madcadVerifyDocumentState.sketches[1].frame.origin, feature: window.__madcadVerifyDocumentState.featureData[1] })`);
    if (!(angledBefore.volume < 17999)) throw new Error(`Skośne wycięcie nie usunęło materiału: ${JSON.stringify(angledBefore)}`);
    await window.webContents.executeJavaScript(`document.querySelectorAll('.timeline-item')[0]?.click()`);
    await window.webContents.executeJavaScript(`document.querySelector('[data-timeline-action="edit"]')?.click()`);
    await waitFor(window, `document.querySelector('.command-dialog')?.textContent.includes('Wyciągnięcie')`, 'edycja skośnego wyciągnięcia');
    await setCommandField(window, 'Odległość', '20');
    const angledRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog .confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.revision > ${angledRevision} && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.timeline?.[1]?.status === 'ok' && window.__madcadVerifyDocumentState?.sketches?.[1]?.frame?.origin?.[2] > ${angledBefore.origin[2] + 3.5}`, 'skośny szkic śledzi zmianę bryły', 30000);
    const angledAfter = await window.webContents.executeJavaScript(`({ volume: window.__madcadVerifyEngineState.bodies[0].metrics.volume, origin: window.__madcadVerifyDocumentState.sketches[1].frame.origin })`);
    if (!(angledAfter.volume > angledBefore.volume && angledAfter.volume < 23999)
      || Math.abs(angledAfter.origin[1] - angledBefore.origin[1] + 5 * Math.SQRT1_2) > 0.01) {
      throw new Error(`Skośna podpora nie przebudowała wycięcia: ${JSON.stringify({ angledBefore, angledAfter })}`);
    }
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready'
      && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${angledBefore.volume}) < 0.01
      && Math.abs(window.__madcadVerifyDocumentState?.sketches?.[1]?.frame?.origin?.[2] - ${angledBefore.origin[2]}) < 0.01`, 'Cofnij przesunięcie skośnej podpory', 30000);
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready'
      && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${angledAfter.volume}) < 0.01
      && Math.abs(window.__madcadVerifyDocumentState?.sketches?.[1]?.frame?.origin?.[2] - ${angledAfter.origin[2]}) < 0.01`, 'Ponów przesunięcie skośnej podpory', 30000);
    await waitFor(window, `!document.querySelector('.reference-repair-panel')`, 'skośna podpora bez kreatora naprawy po Ponów', 30000);
    await window.webContents.executeJavaScript(`document.querySelector('#saveProjectBtn')?.click()`);
    await waitFor(window, `document.querySelector('.workspace-notice')?.textContent.includes('Zapisano projekt atomowo:')`, 'zapis skośnej bryły');
    const savedAngledProject = JSON.parse(await fs.readFile(projectPath, 'utf8'));
    if (savedAngledProject.sketches?.[1]?.support?.kind !== 'face'
      || Math.abs(savedAngledProject.sketches[1].frame.origin[2] - angledAfter.origin[2]) > 0.01) {
      throw new Error('Plik .madcad nie zachował skośnej podpory szkicu.');
    }
    await window.webContents.executeJavaScript(`document.querySelector('#newProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 0`, 'nowy projekt po skośnym wycięciu');
    await window.webContents.executeJavaScript(`document.querySelector('#openProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready'
      && window.__madcadVerifyDocumentState?.features === 2
      && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${angledAfter.volume}) < 0.01
      && Math.abs(window.__madcadVerifyDocumentState?.sketches?.[1]?.frame?.origin?.[2] - ${angledAfter.origin[2]}) < 0.01`, 'odtworzona skośna bryła', 30000);
    result.angledFaceSketch = { beforeVolume: angledBefore.volume, afterVolume: angledAfter.volume, tracked: true, undoRedo: true, fileRoundTrip: true };
    const brokenAngledReferenceId = await window.webContents.executeJavaScript(`window.__madcadVerifyBreakFaceSupportReference()`);
    await waitFor(window, `Boolean(document.querySelector('.reference-repair-panel'))`, 'naprawa skośnej podpory');
    await window.webContents.executeJavaScript(`document.querySelector('.reference-repair-panel.collapsed .reference-repair-toggle')?.click()`);
    await waitFor(window, `Boolean(document.querySelector('.reference-repair-panel button[data-reference-action="candidate-1"]'))`, 'kandydat skośnej ściany');
    await window.webContents.executeJavaScript(`document.querySelector('.reference-repair-panel button[data-reference-action="candidate-1"]')?.click()`);
    await waitFor(window, `!document.querySelector('.reference-repair-panel')
      && window.__madcadVerifyDocumentState?.references?.find((reference) => reference.id === ${JSON.stringify(brokenAngledReferenceId)})?.topologyId.endsWith('-lost') === false
      && window.__madcadVerifyEngineState?.timeline?.[1]?.status === 'ok'
      && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${angledAfter.volume}) < 0.01`, 'naprawione skośne wycięcie', 30000);
    result.angledFaceSketch.referenceRepair = true;

    process.stdout.write('[verify] side-face dependent cut\n');
    const sideLoadRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
    const sideProject = { ...savedProject, parameters: [...savedProject.parameters, { id: 'parameter-depth-regression', name: 'depth', expression: '5', unit: 'mm', label: 'Głębokość' }] };
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadSerializedDocument(${JSON.stringify(JSON.stringify(sideProject))})`);
    await waitFor(window, `window.__madcadVerifyEngineState?.revision > ${sideLoadRevision}
      && window.__madcadVerifyEngineState?.status === 'ready'
      && window.__madcadVerifyDocumentState?.features === 1
      && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 18000) < 0.01`, 'bryła bazowa dla ściany bocznej', 30000);
    const sideFace = await window.webContents.executeJavaScript(`(() => {
      const body = window.__madcadVerifyEngineState.bodies[0];
      const face = body.topology.faces.find((item) => item.descriptor.geometry === 'PLANE' && item.descriptor.normal?.[0] > 0.99);
      return face && { id: face.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId };
    })()`);
    if (!sideFace) throw new Error('Brak bocznej ściany bryły do zależnego szkicu.');
    await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify({ kind: 'face', ...sideFace })}, 'replace')`);
    await clickTool(window, 'Utwórz szkic');
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[1]?.support?.kind === 'face'`, 'szkic na ścianie bocznej');
    await clickTool(window, 'Okrąg');
    await waitFor(window, `document.querySelector('.command-dialog')?.textContent.includes('Okrąg')`, 'okrąg na ścianie bocznej');
    await setCommandField(window, 'Średnica', '6');
    await setCommandField(window, 'Środek X', '0');
    await setCommandField(window, 'Środek Y', '0');
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog .confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[1]?.profiles === 1`, 'profil na ścianie bocznej');
    await clickTool(window, 'Zakończ szkic');
    await clickTool(window, 'Wyciągnij');
    await waitFor(window, `document.querySelector('.command-dialog')?.textContent.includes('Wyciągnięcie')`, 'wycięcie od ściany bocznej');
    // A negative distance on a face sketch goes into the body and switches Join to Cut by itself.
    await setCommandField(window, 'Odległość', '-depth');
    await waitFor(window, `[...document.querySelectorAll('.command-dialog .command-field')].find((item) => item.firstElementChild?.textContent.trim() === 'Operacja')?.querySelector('select')?.value === 'cut'`, 'automatyczne Wytnij dla ujemnej odległości');
    await setCommandField(window, 'Odległość', 'depth');
    await waitFor(window, `[...document.querySelectorAll('.command-dialog .command-field')].find((item) => item.firstElementChild?.textContent.trim() === 'Operacja')?.querySelector('select')?.value === 'join'`, 'automatyczne Połącz dla dodatniego parametru');
    await setCommandField(window, 'Odległość', '0-depth');
    await waitFor(window, `[...document.querySelectorAll('.command-dialog .command-field')].find((item) => item.firstElementChild?.textContent.trim() === 'Operacja')?.querySelector('select')?.value === 'cut'`, 'automatyczne Wytnij dla wyrażenia parametrycznego');
    await setCommandField(window, 'Kierunek', 'through-all');
    const sideCutRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog .confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.revision > ${sideCutRevision}
      && window.__madcadVerifyEngineState?.status === 'ready'
      && window.__madcadVerifyDocumentState?.features === 2
      && window.__madcadVerifyEngineState?.timeline?.[1]?.status === 'ok'`, 'gotowe wycięcie ze ściany bocznej', 30000);
    const sideCutVolume = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`);
    if (!(sideCutVolume > 0 && sideCutVolume < 18000)) throw new Error(`Szkic na ścianie bocznej nie wyciął materiału: ${sideCutVolume}`);
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready'
      && window.__madcadVerifyDocumentState?.features === 1
      && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 18000) < 0.01`, 'Cofnij boczne wycięcie', 30000);
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready'
      && window.__madcadVerifyDocumentState?.features === 2
      && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${sideCutVolume}) < 0.01`, 'Ponów boczne wycięcie', 30000);
    await window.webContents.executeJavaScript(`document.querySelector('#saveProjectBtn')?.click()`);
    await waitFor(window, `document.querySelector('.workspace-notice')?.textContent.includes('Zapisano projekt atomowo:')`, 'zapis bocznego wycięcia');
    const savedSideProject = JSON.parse(await fs.readFile(projectPath, 'utf8'));
    if (savedSideProject.sketches?.[1]?.support?.kind !== 'face' || savedSideProject.features?.[1]?.operation !== 'cut') {
      throw new Error('Plik .madcad nie zachował bocznego wycięcia i jego podpory.');
    }
    await window.webContents.executeJavaScript(`document.querySelector('#newProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 0`, 'nowy projekt po bocznym wycięciu');
    await window.webContents.executeJavaScript(`document.querySelector('#openProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready'
      && window.__madcadVerifyDocumentState?.features === 2
      && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${sideCutVolume}) < 0.01`, 'odtworzone boczne wycięcie', 30000);
    const brokenSideReferenceId = await window.webContents.executeJavaScript(`window.__madcadVerifyBreakFaceSupportReference()`);
    await waitFor(window, `Boolean(document.querySelector('.reference-repair-panel'))`, 'naprawa bocznej podpory');
    await window.webContents.executeJavaScript(`document.querySelector('.reference-repair-panel.collapsed .reference-repair-toggle')?.click()`);
    await waitFor(window, `Boolean(document.querySelector('.reference-repair-panel button[data-reference-action="candidate-1"]'))`, 'kandydat bocznej ściany');
    await window.webContents.executeJavaScript(`document.querySelector('.reference-repair-panel button[data-reference-action="candidate-1"]')?.click()`);
    await waitFor(window, `!document.querySelector('.reference-repair-panel')
      && window.__madcadVerifyDocumentState?.references?.find((reference) => reference.id === ${JSON.stringify(brokenSideReferenceId)})?.topologyId.endsWith('-lost') === false
      && window.__madcadVerifyEngineState?.timeline?.[1]?.status === 'ok'
      && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${sideCutVolume}) < 0.01`, 'naprawione boczne wycięcie', 30000);
    result.sideFaceSketch = { volume: sideCutVolume, cut: true, undoRedo: true, fileRoundTrip: true, referenceRepair: true };

    process.stdout.write('[verify] side-face support after source dimension edit\n');
    const sideEditRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyEditSketch(window.__madcadVerifyDocumentState.sketches[0].id)`);
    await waitFor(window, `document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'edycja szkicu źródłowego bocznej ściany');
    await window.webContents.executeJavaScript(`document.querySelector('.sketch-constraint-badges button[title^="distanceX:"]')?.click()`);
    await waitFor(window, `Boolean(document.querySelector('.sketch-constraint-editor input[name="constraintValue"]'))`, 'wymiar źródłowego szkicu bocznej ściany');
    await window.webContents.executeJavaScript(`(() => {
      const input = document.querySelector('.sketch-constraint-editor input[name="constraintValue"]');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, '60');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('.sketch-constraint-editor button[type="submit"]').click();
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.dimensions?.some((dimension) => dimension.type === 'horizontal' && dimension.expression === '60')`, 'zmieniony wymiar źródłowy bocznej ściany');
    await clickTool(window, 'Zakończ szkic');
    await waitFor(window, `window.__madcadVerifyEngineState?.revision > ${sideEditRevision} && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.features === 2`, 'przebudowa po zmianie bocznej ściany', 30000);
    await window.webContents.executeJavaScript(`document.querySelector('#saveProjectBtn')?.click()`);
    await waitFor(window, `document.querySelector('.workspace-notice')?.textContent.includes('Zapisano projekt atomowo:')`, 'zapis po zmianie bocznej ściany');
    const changedSideProject = JSON.parse(await fs.readFile(projectPath, 'utf8'));
    const changedSide = await window.webContents.executeJavaScript(`(() => {
      const documentState = window.__madcadVerifyDocumentState;
      const body = window.__madcadVerifyEngineState.bodies[0];
      const face = body.topology.faces.find((item) => item.descriptor.geometry === 'PLANE' && item.descriptor.normal?.[0] > 0.99);
      return { faceCenter: face?.descriptor?.center, timeline: window.__madcadVerifyEngineState.timeline.map((item) => item.status), volume: body.metrics.volume };
    })()`);
    const changedSideSupport = changedSideProject.references.find((item) => item.id === changedSideProject.sketches[1].support.referenceId);
    if (changedSide.timeline[1] !== 'ok' || Math.abs((21600 - changedSide.volume) / (18000 - sideCutVolume) - 1.2) > 0.01
      || Math.abs(changedSide.faceCenter?.[0] - 30) > 0.001
      || Math.abs(changedSideSupport?.descriptor?.center?.[0] - changedSide.faceCenter[0]) > 0.001
      || Math.abs(Number(changedSideProject.sketches[1].planeOffset) - 30) > 0.001) {
      throw new Error(`Szkic boczny odłączył się od zmienionej ściany: ${JSON.stringify({ changedSide, referenceCenter: changedSideSupport?.descriptor?.center, planeOffset: changedSideProject.sketches[1].planeOffset })}`);
    }
    await window.webContents.executeJavaScript(`document.querySelector('#newProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 0`, 'nowy projekt po zmianie bocznej ściany');
    await window.webContents.executeJavaScript(`document.querySelector('#openProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready'
      && window.__madcadVerifyDocumentState?.features === 2
      && Math.abs(window.__madcadVerifyDocumentState?.sketches?.[1]?.planeOffset - 30) < 0.001
      && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${changedSide.volume}) < 0.02`, 'odtworzony szkic na przesuniętej ścianie', 30000);
    result.sideFaceSketch.sourceDimensionRebuild = true;

    process.stdout.write('[verify] repair a legacy side sketch with a stale plane but unchanged face ID\n');
    const staleSideProject = structuredClone(changedSideProject);
    const staleSideSupport = staleSideProject.references.find((item) => item.id === staleSideProject.sketches[1].support.referenceId);
    staleSideSupport.descriptor.center[0] = 25;
    staleSideSupport.descriptor.centerOfMass[0] = 25;
    staleSideProject.sketches[1].planeOffset = '25';
    const staleSideRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadSerializedDocument(${JSON.stringify(JSON.stringify(staleSideProject))})`);
    await waitFor(window, `window.__madcadVerifyEngineState?.revision > ${staleSideRevision}
      && window.__madcadVerifyEngineState?.status === 'ready'
      && Boolean(document.querySelector('.reference-repair-panel'))`, 'wykryty dryf ściany o niezmienionym ID', 30000);
    await window.webContents.executeJavaScript(`document.querySelector('.reference-repair-panel.collapsed .reference-repair-toggle')?.click()`);
    await waitFor(window, `Boolean(document.querySelector('.reference-repair-panel button[data-reference-action="candidate-1"]'))`, 'kandydat przesuniętej ściany');
    await window.webContents.executeJavaScript(`document.querySelector('.reference-repair-panel button[data-reference-action="candidate-1"]')?.click()`);
    await waitFor(window, `!document.querySelector('.reference-repair-panel')
      && window.__madcadVerifyEngineState?.status === 'ready'
      && Math.abs(window.__madcadVerifyDocumentState?.sketches?.[1]?.planeOffset - 30) < 0.001`, 'naprawiona płaszczyzna starego szkicu', 30000);
    await window.webContents.executeJavaScript(`document.querySelector('#saveProjectBtn')?.click()`);
    await waitFor(window, `document.querySelector('.workspace-notice')?.textContent.includes('Zapisano projekt atomowo:')`, 'zapis naprawionej płaszczyzny');
    await window.webContents.executeJavaScript(`document.querySelector('#newProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 0`, 'nowy projekt po naprawie płaszczyzny');
    await window.webContents.executeJavaScript(`document.querySelector('#openProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready'
      && window.__madcadVerifyDocumentState?.features === 2
      && Math.abs(window.__madcadVerifyDocumentState?.sketches?.[1]?.planeOffset - 30) < 0.001
      && !document.querySelector('.reference-repair-panel')`, 'trwale naprawiona płaszczyzna po otwarciu pliku', 30000);
    result.sideFaceSketch.stalePlaneRepair = true;

    process.stdout.write('[verify] rotating construction-plane dependent cut\n');
    const rotatingProject = structuredClone(savedProject);
    const rotatingPlane = {
      id: 'plane-rotating-support', kind: 'construction-plane', planeType: 'angle',
      name: 'Płaszczyzna obrotu', basePlane: 'XY', rotationAxis: 'u', angle: '30', offset: '0', visible: true,
    };
    rotatingProject.references.push(rotatingPlane);
    rotatingProject.sketches[0].support = { kind: 'construction-plane', referenceId: rotatingPlane.id };
    const rotatingLoadRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
    const rotatingLoad = await window.webContents.executeJavaScript(`(() => {
      try {
        window.__madcadVerifyLoadSerializedDocument(${JSON.stringify(JSON.stringify(rotatingProject))});
        return { ok: true };
      } catch (error) { return { ok: false, error: error?.stack || String(error) }; }
    })()`);
    if (!rotatingLoad.ok) throw new Error(`Nie udało się załadować projektu z obrotową płaszczyzną: ${rotatingLoad.error}`);
    process.stdout.write('[verify] rotating fixture loaded\n');
    await waitFor(window, `window.__madcadVerifyEngineState?.revision > ${rotatingLoadRevision}
      && window.__madcadVerifyEngineState?.status === 'ready'
      && window.__madcadVerifyDocumentState?.features === 1
      && window.__madcadVerifyEngineState?.bodies?.[0]?.topology?.faces?.some((face) => face.descriptor.normal?.[1] < -0.49 && face.descriptor.normal?.[2] > 0.86)`, 'bryła na płaszczyźnie 30°', 30000);
    const rotatingFace = await window.webContents.executeJavaScript(`(() => {
      const body = window.__madcadVerifyEngineState.bodies[0];
      const face = body.topology.faces.find((item) => item.descriptor.geometry === 'PLANE'
        && item.descriptor.normal?.[1] < -0.49 && item.descriptor.normal?.[2] > 0.86
        && item.descriptor.center?.[2] > 10);
      return face && { id: face.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId };
    })()`);
    if (!rotatingFace) throw new Error('Brak końcowej ściany bryły na płaszczyźnie 30°.');
    process.stdout.write('[verify] rotating face selected\n');
    await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify({ kind: 'face', ...rotatingFace })}, 'replace')`);
    await clickTool(window, 'Utwórz szkic');
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[1]?.support?.kind === 'face'`, 'zależny szkic na obrotowej ścianie');
    process.stdout.write('[verify] rotating face sketch created\n');
    await clickTool(window, 'Okrąg');
    await waitFor(window, `document.querySelector('.command-dialog')?.textContent.includes('Okrąg')`, 'profil na obrotowej ścianie');
    await setCommandField(window, 'Średnica', '6');
    await setCommandField(window, 'Środek X', '0');
    await setCommandField(window, 'Środek Y', '0');
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog .confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[1]?.profiles === 1`, 'profil zależny od płaszczyzny 30°');
    await clickTool(window, 'Zakończ szkic');
    await clickTool(window, 'Wyciągnij');
    await waitFor(window, `document.querySelector('.command-dialog')?.textContent.includes('Wyciągnięcie')`, 'wycięcie bryły z obrotowej płaszczyzny');
    await setCommandField(window, 'Operacja', 'cut');
    await setCommandField(window, 'Kierunek', 'through-all');
    const rotatingCutRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog .confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.revision > ${rotatingCutRevision}
      && window.__madcadVerifyEngineState?.status === 'ready'
      && window.__madcadVerifyEngineState?.timeline?.[1]?.status === 'ok'`, 'wycięcie na płaszczyźnie 30°', 30000);
    process.stdout.write('[verify] rotating face cut ready\n');
    const rotatingBefore = await window.webContents.executeJavaScript(`({
      volume: window.__madcadVerifyEngineState.bodies[0].metrics.volume,
      frame: window.__madcadVerifyDocumentState.sketches[1].frame,
    })`);
    if (!(rotatingBefore.volume > 0 && rotatingBefore.volume < 18000)) throw new Error('Wycięcie na obrotowej płaszczyźnie nie usunęło materiału.');
    await window.webContents.executeJavaScript(`window.__madcadVerifyConstructionPlaneSelection(${JSON.stringify(rotatingPlane.id)})`);
    process.stdout.write('[verify] rotating plane selection requested\n');
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'constructionPlane'`, 'wybrana płaszczyzna konstrukcyjna');
    await window.webContents.executeJavaScript(`(() => {
      const button = [...document.querySelectorAll('button')].find((item) => item.title === 'Edytuj' && !item.disabled);
      if (!button) throw new Error('Brak dostępnego przycisku Edytuj dla płaszczyzny.');
      button.click();
    })()`);
    process.stdout.write('[verify] rotating plane edit opened\n');
    await waitFor(window, `document.querySelector('.command-dialog')?.textContent.includes('Płaszczyzna pod kątem')`, 'edycja kąta płaszczyzny');
    await setCommandField(window, 'Kąt', '60');
    const rotatingEditRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog .confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.revision > ${rotatingEditRevision}
      && window.__madcadVerifyEngineState?.status === 'ready'
      && window.__madcadVerifyEngineState?.timeline?.[1]?.status === 'ok'
      && window.__madcadVerifyDocumentState?.sketches?.[1]?.frame?.normal?.[1] < -0.86
      && window.__madcadVerifyDocumentState?.sketches?.[1]?.frame?.normal?.[2] < 0.51`, 'zależne wycięcie po obrocie płaszczyzny', 30000);
    const rotatingAfter = await window.webContents.executeJavaScript(`({
      volume: window.__madcadVerifyEngineState.bodies[0].metrics.volume,
      frame: window.__madcadVerifyDocumentState.sketches[1].frame,
    })`);
    if (Math.abs(rotatingAfter.volume - rotatingBefore.volume) > 0.05
      || Math.abs(rotatingAfter.frame.origin[2] - 7.5) > 0.05) {
      throw new Error(`Zależny szkic nie podążył za obrotem płaszczyzny: ${JSON.stringify({ rotatingBefore, rotatingAfter })}`);
    }
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready'
      && window.__madcadVerifyDocumentState?.references?.find((reference) => reference.id === ${JSON.stringify(rotatingPlane.id)})?.angle === '30'
      && window.__madcadVerifyDocumentState?.sketches?.[1]?.frame?.normal?.[1] > -0.51
      && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${rotatingBefore.volume}) < 0.05`, 'Cofnij obrót podpory', 30000);
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready'
      && window.__madcadVerifyDocumentState?.references?.find((reference) => reference.id === ${JSON.stringify(rotatingPlane.id)})?.angle === '60'
      && window.__madcadVerifyDocumentState?.sketches?.[1]?.frame?.normal?.[1] < -0.86
      && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${rotatingAfter.volume}) < 0.05`, 'Ponów obrót podpory', 30000);
    await window.webContents.executeJavaScript(`document.querySelector('#saveProjectBtn')?.click()`);
    await waitFor(window, `document.querySelector('.workspace-notice')?.textContent.includes('Zapisano projekt atomowo:')`, 'zapis obróconej podpory');
    const savedRotatingProject = JSON.parse(await fs.readFile(projectPath, 'utf8'));
    if (savedRotatingProject.references?.find((reference) => reference.id === rotatingPlane.id)?.angle !== '60'
      || savedRotatingProject.sketches?.[1]?.frame?.normal?.[1] > -0.86) {
      throw new Error('Plik .madcad nie zachował obróconej podpory i zależnego szkicu.');
    }
    await window.webContents.executeJavaScript(`document.querySelector('#newProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 0`, 'nowy projekt po obrocie podpory');
    await window.webContents.executeJavaScript(`document.querySelector('#openProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready'
      && window.__madcadVerifyDocumentState?.features === 2
      && window.__madcadVerifyDocumentState?.sketches?.[1]?.frame?.normal?.[1] < -0.86
      && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${rotatingAfter.volume}) < 0.05`, 'odtworzone wycięcie na obróconej podporze', 30000);
    result.rotatedFaceSketch = { beforeVolume: rotatingBefore.volume, afterVolume: rotatingAfter.volume, tracked: true, undoRedo: true, fileRoundTrip: true };
    process.stdout.write(`[verify] rotated support ${JSON.stringify(result.rotatedFaceSketch)}\n`);

    // Stop the old renderer before clearing storage. Its delayed autosave can
    // otherwise repopulate the first sketch between clear() and the reload.
    await window.loadURL('about:blank');
    await window.webContents.session.clearStorageData({ storages: ['localstorage'] });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.sketches?.length === 0`, 'pusty dokument dla otwartego szkicu');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button[aria-label="Zamknij"]')?.click()`);
    await clickTool(window, 'Utwórz szkic');
    await waitFor(window, `Boolean(document.querySelector('.plane-options'))`, 'wybor plaszczyzny otwartego szkicu');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.plane-options button')].find((button) => button.textContent.includes('XY'))?.click()`);
    await waitFor(window, `document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'aktywny otwarty szkic XY');
    await window.webContents.executeJavaScript(`window.__madcadPreviousCanvasPointHandler = window.__madcadVerifyCanvasSketchPoint; true`);
    await clickTool(window, 'Linia');
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'line' && window.__madcadVerifyCanvasSketchPoint !== window.__madcadPreviousCanvasPointHandler`, 'aktywny uchwyt linii');
    await window.webContents.executeJavaScript(`window.__madcadPreviousCanvasPointHandler = window.__madcadVerifyCanvasSketchPoint; true`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyCanvasSketchPoint([0, 0])`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.points === 1 && window.__madcadVerifyCanvasSketchPoint !== window.__madcadPreviousCanvasPointHandler`, 'poczatek linii');
    await window.webContents.executeJavaScript(`window.__madcadVerifyCanvasSketchPoint([20, 0])`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 3`, 'gotowa linia');
    await window.webContents.executeJavaScript(`if (window.__madcadVerifyDocumentState?.command?.type === 'line') window.__madcadVerifyFinishCanvasSketchTool()`);
    await waitFor(window, `!window.__madcadVerifyDocumentState?.command`, 'zakończone narzędzie linii');
    await clickTool(window, 'Zakończ szkic');
    await waitFor(window, `window.__madcadCompletedSketchVisibilityState?.entityCount > 0 && window.__madcadCompletedSketchVisibilityState?.renderedObjects > 0`, 'widoczny otwarty szkic');
    await clickTool(window, 'Wyciągnij');
    await waitFor(window, `document.querySelector('.command-dialog')?.textContent.includes('Wyciągnięcie') && document.querySelector('.command-field input[type="checkbox"]')?.checked && !document.querySelector('.plane-options')`, 'cienkie wyciagniecie bez nowej plaszczyzny');
    await new Promise((resolve) => setTimeout(resolve, 250));
    await fs.writeFile(thinArtifactPath, (await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog .confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 1`, 'cienka bryla', 30000);
    const thinResult = await window.webContents.executeJavaScript(`({
      features: window.__madcadVerifyDocumentState.features,
      bodies: window.__madcadVerifyEngineState.bodies.length,
      thin: window.__madcadVerifyDocumentState.featureData[0].thin,
      openEntityIds: window.__madcadVerifyDocumentState.featureData[0].openEntityIds.length,
      volume: window.__madcadVerifyEngineState.bodies[0].metrics.volume,
      planePickerVisible: Boolean(document.querySelector('.plane-options')),
    })`);
    if (thinResult.features !== 1 || thinResult.bodies !== 1 || !thinResult.thin || thinResult.openEntityIds !== 1 || thinResult.planePickerVisible || Math.abs(thinResult.volume - 400) > 0.01) {
      throw new Error(`Bledny wynik otwartego szkicu: ${JSON.stringify(thinResult)}`);
    }
    process.stdout.write(`${JSON.stringify({ ok: true, artifactPath, thinArtifactPath, closedProfile: result, openChain: thinResult })}\n`);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    exitCode = 1;
    try {
      const state = await executeJavaScript(`({
        engine: { status: window.__madcadVerifyEngineState?.status, revision: window.__madcadVerifyEngineState?.revision },
        document: window.__madcadVerifyDocumentState,
        dialog: document.querySelector('.command-dialog')?.textContent,
        notice: document.querySelector('.workspace-notice')?.textContent,
      })`);
      await fs.writeFile(path.join(path.dirname(artifactPath), 'extrude-after-sketch-failure.json'), JSON.stringify(state, null, 2));
      const image = await window.webContents.capturePage();
      await fs.writeFile(path.join(path.dirname(artifactPath), 'extrude-after-sketch-failure.png'), image.toPNG());
    } catch (diagnosticError) {
      process.stderr.write(`[verify] Failure diagnostics unavailable: ${diagnosticError.message}\n`);
    }
  } finally {
    // Do the awaited cleanup first and never destroy the last window before
    // app.exit(): the default window-all-closed quit would win the race and
    // report exit code 0 for a failed scenario.
    ipcMain.removeHandler('madcad:save-text-file');
    ipcMain.removeHandler('madcad:open-project-file');
    await fs.rm(projectDirectory, { recursive: true, force: true });
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
