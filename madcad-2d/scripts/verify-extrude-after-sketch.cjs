const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

const artifactPath = path.join(__dirname, '..', 'artifacts', 'extrude-after-sketch.png');
const thinArtifactPath = path.join(__dirname, '..', 'artifacts', 'thin-extrude-after-sketch.png');

async function waitFor(window, expression, label, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const state = await window.webContents.executeJavaScript(`({ status: window.__madcadVerifyEngineState?.status, revision: window.__madcadVerifyEngineState?.revision, command: window.__madcadVerifyDocumentState?.command, sketches: window.__madcadVerifyDocumentState?.sketches?.map((sketch) => ({ id: sketch.id, support: sketch.support, planeOffset: sketch.planeOffset })), timeline: window.__madcadVerifyEngineState?.timeline, volumes: window.__madcadVerifyEngineState?.bodies?.map((body) => body.metrics.volume) })`);
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
  ipcMain.handle('madcad-verify:save-project', async (_event, payload) => {
    if (typeof payload?.text !== 'string' || !payload.text || payload.atomic !== true) throw new Error('Nieprawidłowe żądanie zapisu projektu.');
    await fs.writeFile(projectPath, payload.text, 'utf8');
    return { ok: true, canceled: false, filePath: projectPath, backupPath: null };
  });
  ipcMain.handle('madcad-verify:open-project', async () => ({ ok: true, canceled: false, filePath: projectPath, text: await fs.readFile(projectPath, 'utf8') }));
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
    await window.webContents.executeJavaScript(`window.__madcadVerifyCanvasSketchPoint([0, 0])`);
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
    result.faceSketch.rebuiltVolume = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`);
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && Number(window.__madcadVerifyDocumentState?.sketches?.[1]?.planeOffset) === 15 && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${result.faceSketch.volume}) < 0.01`, 'Cofnij operację nadrzędną i położenie szkicu', 30000);
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && Number(window.__madcadVerifyDocumentState?.sketches?.[1]?.planeOffset) === 20 && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${result.faceSketch.rebuiltVolume}) < 0.01`, 'Ponów operację nadrzędną i położenie szkicu', 30000);
    result.faceSketch.undoRedo = true;
    await window.webContents.executeJavaScript(`document.querySelector('#saveProjectBtn')?.click()`);
    await waitFor(window, `document.querySelector('.workspace-notice')?.textContent.includes('Zapisano projekt atomowo:')`, 'zapis projektu z drugim szkicem');
    const savedFaceProject = JSON.parse(await fs.readFile(projectPath, 'utf8'));
    if (savedFaceProject.sketches?.[1]?.support?.kind !== 'face' || Number(savedFaceProject.sketches[1].planeOffset) !== 20 || savedFaceProject.features?.[1]?.operation !== 'cut') {
      throw new Error('Plik .madcad nie zachował szkicu na ścianie i zależnego wycięcia.');
    }
    await window.webContents.executeJavaScript(`document.querySelector('#newProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 0`, 'nowy projekt po wycięciu');
    await window.webContents.executeJavaScript(`document.querySelector('#openProjectBtn')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.features === 2 && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.timeline?.[1]?.status === 'ok' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${result.faceSketch.rebuiltVolume}) < 0.01`, 'odtworzony projekt z wycięciem', 30000);
    result.faceSketch.fileRoundTrip = true;
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
  } finally {
    window.destroy();
    ipcMain.removeHandler('madcad-verify:save-project');
    ipcMain.removeHandler('madcad-verify:open-project');
    await fs.rm(projectDirectory, { recursive: true, force: true });
    process.exit(exitCode);
  }
});
