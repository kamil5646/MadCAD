const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const outputPath = path.join(__dirname, '..', 'artifacts', 'modeling-checkpoint.png');
const emptyOutputPath = path.join(__dirname, '..', 'artifacts', 'madcad-qa-empty.png');
const sketchOutputPath = path.join(__dirname, '..', 'artifacts', 'madcad-qa-sketch.png');
const directOutputPath = path.join(__dirname, '..', 'artifacts', 'madcad-direct-extrude.png');
const narrowOutputPath = path.join(__dirname, '..', 'artifacts', 'madcad-qa-narrow.png');
const verificationStartedAt = Date.now();
const isCi = Boolean(process.env.CI);
const modelingTimeoutMs = isCi ? 60000 : 20000;

async function waitForModel(window, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await window.webContents.executeJavaScript(`(() => {
      const status = document.querySelector('.engine-status');
      return {
        shell: Boolean(document.querySelector('.modeling-shell')),
        status: status?.className || '',
        text: status?.textContent?.trim() || '',
        bodies: document.querySelectorAll('.model-browser .body-color').length,
      };
    })()`);
    if (result.status.includes('ready') || result.status.includes('error')) return result;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Przekroczono czas oczekiwania na silnik CAD.');
}

function assertClose(actual, expected, tolerance, label) {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected} +/- ${tolerance}, received ${actual}.`);
  }
}

async function verifyExport(window, format, timeoutMs = isCi ? 90000 : 45000) {
  const exportPromise = window.webContents.executeJavaScript(`(async () => {
    if (typeof window.__madcadVerifyExport !== 'function') throw new Error('Brak testowego interfejsu eksportu.');
    const result = await window.__madcadVerifyExport('${format.toLowerCase()}', { validateRoundTrip: true });
    return { sizes: result.buffers.map((buffer) => buffer.byteLength), roundTrip: result.roundTrip };
  })()`);
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error(`Przekroczono czas eksportu ${format}.`)), timeoutMs));
  const result = await Promise.race([exportPromise, timeout]);
  const sizes = result.sizes;
  if (!sizes.length || sizes.some((size) => size < 100)) throw new Error(`Eksport ${format} zwrócił pusty plik.`);
  if (result.roundTrip.length !== sizes.length || result.roundTrip.some((entry) => !entry.valid)) {
    throw new Error(`Round-trip ${format} exceeded tolerance: ${JSON.stringify(result.roundTrip)}`);
  }
  return result;
}

async function waitForUi(window, expression, label, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Interfejs nie osiągnął stanu: ${label}.`);
}

async function runUiFlow(window) {
  const progress = (message) => process.stdout.write(`[verify] ${message}\n`);
  const clickTool = (label) => window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.ribbon-tool')].find((item) => item.querySelector('.ribbon-label')?.textContent === ${JSON.stringify(label)});
    if (!button) throw new Error('Brak przycisku: ${label}');
    if (button.disabled) throw new Error('Przycisk jest nieaktywny: ${label}');
    const key = Object.keys(button).find((item) => item.startsWith('__reactProps'));
    const handler = key && button[key]?.onClick;
    if (typeof handler !== 'function') throw new Error('Brak procedury przycisku: ${label}');
    handler({ currentTarget: button, target: button });
  })()`);

  const clickByTitle = (title) => window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('.modeling-shell button[title=${JSON.stringify(title)}]');
    if (!button) throw new Error('Brak przycisku: ${title}');
    const key = Object.keys(button).find((item) => item.startsWith('__reactProps'));
    const handler = key && button[key]?.onClick;
    if (typeof handler !== 'function') throw new Error('Brak procedury przycisku: ${title}');
    handler({ currentTarget: button, target: button });
  })()`);
  const sendShortcut = (key, shiftKey = false) => window.webContents.executeJavaScript(`(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: ${JSON.stringify(key)},
      ctrlKey: true,
      shiftKey: ${Boolean(shiftKey)},
      bubbles: true,
      cancelable: true,
    }));
  })()`);
  const sendKey = (key) => window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true, cancelable: true }))`);
  const setCommandField = (label, value) => window.webContents.executeJavaScript(`(() => {
    const field = [...document.querySelectorAll('.command-field')].find((item) => item.firstElementChild?.textContent === ${JSON.stringify(label)});
    const input = field?.querySelector('input, select');
    if (!input) throw new Error('Brak pola: ${label}');
    const key = Object.keys(input).find((item) => item.startsWith('__reactProps'));
    const handler = key && input[key]?.onChange;
    if (typeof handler !== 'function') throw new Error('Brak procedury pola: ${label}');
    handler({ target: { value: ${JSON.stringify(value)} } });
  })()`);
  const confirmDialog = () => window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('.command-dialog .confirm');
    const key = Object.keys(button).find((item) => item.startsWith('__reactProps'));
    button[key].onClick();
  })()`);
  const confirmParameters = () => window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('.parameters-dialog .confirm');
    const key = Object.keys(button).find((item) => item.startsWith('__reactProps'));
    button[key].onClick();
  })()`);
  const clickDialogButton = (label) => window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.command-dialog footer button')].find((item) => item.textContent.includes(${JSON.stringify(label)}));
    if (!button) throw new Error('Missing dialog button: ${label}');
    const key = Object.keys(button).find((item) => item.startsWith('__reactProps'));
    button[key].onClick();
  })()`);
  const pickPlane = (plane) => window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.plane-options button')].find((item) => item.textContent.includes(${JSON.stringify(plane)}));
    if (!button) throw new Error('Brak płaszczyzny ${plane}');
    const key = Object.keys(button).find((item) => item.startsWith('__reactProps'));
    button[key].onClick();
  })()`);
  const dragDirectExtrude = async () => {
    await window.webContents.executeJavaScript(`(async () => {
      const canvas = document.querySelector('.model-viewport canvas');
      const handle = document.querySelector('.direct-handle-hit');
      const rect = canvas.getBoundingClientRect();
      const point = window.__madcadDirectHandlePoint || { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
      const key = Object.keys(handle).find((item) => item.startsWith('__reactProps'));
      const props = handle[key];
      const event = (y) => ({ clientX: point.x, clientY: y, pointerId: 9, pointerType: 'pen', currentTarget: handle, preventDefault() {}, stopPropagation() {}, altKey: false });
      props.onPointerDown(event(point.y));
      for (let offset = 20; offset <= 120; offset += 20) {
        props.onPointerMove(event(point.y - offset));
        await new Promise((resolve) => setTimeout(resolve, 35));
      }
      props.onPointerUp(event(point.y - 120));
    })()`);
  };

  const sketchScreenPoint = (entityId) => window.webContents.executeJavaScript(`(() => {
    const point = window.__madcadSketchEntityScreenPoints?.[${JSON.stringify(entityId)}];
    if (!point) throw new Error('Missing sketch screen point: ${entityId}');
    return point;
  })()`);
  const sendMouse = async (type, point, modifiers = []) => {
    window.webContents.sendInputEvent({ type, x: Math.round(point.x), y: Math.round(point.y), button: 'left', clickCount: 1, modifiers });
    await new Promise((resolve) => setTimeout(resolve, 45));
  };
  const clickSketchEntity = async (entityId, modifiers = []) => {
    const point = await sketchScreenPoint(entityId);
    await sendMouse('mouseDown', point, modifiers);
    await sendMouse('mouseUp', point, modifiers);
  };
  const dragSketchEntity = async (entityId, offsetX, offsetY) => {
    if (isCi) {
      await window.webContents.executeJavaScript(`(() => {
        if (typeof window.__madcadVerifySketchSelection !== 'function' || typeof window.__madcadVerifyMoveSketch !== 'function') {
          throw new Error('Missing deterministic sketch drag verification hooks.');
        }
        window.__madcadVerifySketchSelection([${JSON.stringify(entityId)}], 'replace');
        window.__madcadVerifyMoveSketch({ ids: [${JSON.stringify(entityId)}], dx: 3, dy: 0 });
      })()`);
      await new Promise((resolve) => setTimeout(resolve, 100));
      return;
    }
    const point = await sketchScreenPoint(entityId);
    await sendMouse('mouseDown', point);
    for (let step = 1; step <= 4; step += 1) {
      await sendMouse('mouseMove', { x: point.x + (offsetX * step / 4), y: point.y + (offsetY * step / 4) });
    }
    await sendMouse('mouseUp', { x: point.x + offsetX, y: point.y + offsetY });
  };
  const dragSelectionBox = async (start, end) => {
    await sendMouse('mouseDown', start);
    await sendMouse('mouseMove', { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 });
    await sendMouse('mouseMove', end);
    await sendMouse('mouseUp', end);
  };

  const addSketchPoint = async (point, expectedEntities) => {
    await window.webContents.executeJavaScript(`(() => {
      if (typeof window.__madcadVerifySketchPoint !== 'function') throw new Error('Missing sketch point test hook.');
      window.__madcadVerifySketchPoint(${JSON.stringify(point)});
    })()`);
    await waitForUi(
      window,
      `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === ${expectedEntities}`,
      `sketch entities ${expectedEntities}`,
    );
  };

  progress('line and command termination');
  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt dla linii');
  await clickTool('Utwórz szkic');
  await waitForUi(window, `document.querySelector('.plane-picker')`, 'wybór płaszczyzny linii');
  await pickPlane('XY');
  await clickTool('Linia');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Linia')`, 'polecenie linii');
  await addSketchPoint([0, 0], 1);
  await addSketchPoint([10, 0], 3);
  await waitForUi(window, `!document.querySelector('.command-dialog')`, 'zakończenie pojedynczej linii');
  await clickTool('Polilinia');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Polilinia')`, 'polilinia przed Escape');
  await sendKey('Escape');
  await waitForUi(window, `!document.querySelector('.command-dialog')`, 'Escape kończy polilinię');
  await clickTool('Polilinia');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Polilinia')`, 'polilinia przed Enter');
  await addSketchPoint([0, 10], 4);
  await sendKey('Enter');
  await waitForUi(window, `!document.querySelector('.command-dialog')`, 'Enter kończy polilinię');

  progress('polyline L profile');
  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt dla polilinii');
  await clickTool('Utwórz szkic');
  await waitForUi(window, `document.querySelector('.plane-picker')`, 'wybór płaszczyzny polilinii');
  await pickPlane('XY');
  await clickTool('Polilinia');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Polilinia')`, 'polecenie polilinii');
  await addSketchPoint([0, 0], 1);
  await setCommandField('Długość', '30');
  await setCommandField('Kąt', '0');
  await new Promise((resolve) => setTimeout(resolve, 100));
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 3`, 'dokładny pierwszy segment');
  await addSketchPoint([30, 10], 5);
  await addSketchPoint([10, 10], 7);
  await addSketchPoint([10, 25], 9);
  await clickDialogButton('Cofnij segment');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 7`, 'cofnięcie segmentu polilinii');
  await addSketchPoint([10, 30], 9);
  await addSketchPoint([0, 30], 11);
  await addSketchPoint([0, 0], 12);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.profiles === 1`, 'zamknięty profil L');

  progress('sketch selection and editing');
  const editTargets = await window.webContents.executeJavaScript(`(() => {
    const entities = window.__madcadVerifyDocumentState.sketches.at(-1).entityData;
    const pointAt = (x, y) => entities.find((entity) => entity.type === 'point' && Number(entity.geometry.x) === x && Number(entity.geometry.y) === y)?.id;
    return {
      concavePointId: pointAt(10, 10),
      neighborPointId: pointAt(30, 10),
      originPointId: pointAt(0, 0),
      lineId: entities.find((entity) => entity.type === 'line')?.id,
    };
  })()`);
  if (!editTargets.concavePointId || !editTargets.neighborPointId || !editTargets.lineId) throw new Error(`Missing L-profile edit targets: ${JSON.stringify(editTargets)}`);
  await waitForUi(window, `window.__madcadSketchEntityScreenPoints?.[${JSON.stringify(editTargets.concavePointId)}]`, 'punkty ekranowe szkicu');

  await clickSketchEntity(editTargets.concavePointId);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.ids?.length === 1`, 'zaznaczenie punktu');
  await clickSketchEntity(editTargets.neighborPointId, ['shift']);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.ids?.length === 2`, 'wielokrotny wybór Shift');
  await clickSketchEntity(editTargets.neighborPointId, ['control']);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.ids?.length === 1`, 'przełączenie wyboru Ctrl');

  await clickTool('Wybierz');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'sketch'`, 'wyczyszczenie wyboru przed inside');
  const insidePoints = await Promise.all([sketchScreenPoint(editTargets.concavePointId), sketchScreenPoint(editTargets.neighborPointId)]);
  await dragSelectionBox(
    { x: Math.min(...insidePoints.map((point) => point.x)) - 12, y: Math.min(...insidePoints.map((point) => point.y)) - 12 },
    { x: Math.max(...insidePoints.map((point) => point.x)) + 12, y: Math.max(...insidePoints.map((point) => point.y)) + 12 },
  );
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.ids?.length >= 2`, 'wybór oknem inside');

  await clickTool('Wybierz');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'sketch'`, 'wyczyszczenie wyboru przed crossing');
  const linePoint = await sketchScreenPoint(editTargets.lineId);
  await dragSelectionBox({ x: linePoint.x + 14, y: linePoint.y - 22 }, { x: linePoint.x - 14, y: linePoint.y + 22 });
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.ids?.includes(${JSON.stringify(editTargets.lineId)})`, 'wybór oknem crossing');
  const crossingPreservedGeometry = await window.webContents.executeJavaScript(`(() => {
    const point = window.__madcadVerifyDocumentState.sketches.at(-1).entityData.find((entity) => entity.id === ${JSON.stringify(editTargets.originPointId)});
    return Number(point.geometry.x) === 0 && Number(point.geometry.y) === 0;
  })()`);
  if (!crossingPreservedGeometry) throw new Error('Crossing selection dragged geometry instead of selecting it.');
  await sendKey('Delete');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.profiles === 0`, 'Delete usuwa zależny profil');
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.profiles === 1`, 'Undo przywraca profil i relacje');
  await sendShortcut('y');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.profiles === 0`, 'Redo ponownie usuwa profil');
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.profiles === 1`, 'drugie Undo przywraca profil');

  await waitForUi(window, `window.__madcadSketchEntityScreenPoints?.[${JSON.stringify(editTargets.concavePointId)}]`, 'odtworzony punkt ekranowy');
  await dragSketchEntity(editTargets.concavePointId, 24, 0);
  await waitForUi(window, `(() => { const point = window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entityData?.find((entity) => entity.id === ${JSON.stringify(editTargets.concavePointId)}); return Number(point?.geometry?.x) !== 10 || Number(point?.geometry?.y) !== 10; })()`, 'przeciągnięcie punktu');
  await sendShortcut('z');
  await waitForUi(window, `(() => { const point = window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entityData?.find((entity) => entity.id === ${JSON.stringify(editTargets.concavePointId)}); return Number(point?.geometry?.x) === 10 && Number(point?.geometry?.y) === 10; })()`, 'Undo przeciągnięcia punktu');

  await waitForUi(window, `window.__madcadSketchEntityScreenPoints?.[${JSON.stringify(editTargets.lineId)}]`, 'odtworzony segment ekranowy');
  await dragSketchEntity(editTargets.lineId, 18, 0);
  await waitForUi(window, `(() => { const point = window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entityData?.find((entity) => entity.id === ${JSON.stringify(editTargets.originPointId)}); return Number(point?.geometry?.x) !== 0 || Number(point?.geometry?.y) !== 0; })()`, 'przeciągnięcie segmentu');
  await sendShortcut('z');
  await waitForUi(window, `(() => { const point = window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entityData?.find((entity) => entity.id === ${JSON.stringify(editTargets.originPointId)}); return Number(point?.geometry?.x) === 0 && Number(point?.geometry?.y) === 0; })()`, 'Undo przeciągnięcia segmentu');

  await clickSketchEntity(editTargets.concavePointId);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.ids?.includes(${JSON.stringify(editTargets.concavePointId)})`, 'ponowne zaznaczenie wierzchołka');
  await clickTool('Przesuń');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Przesuń geometrię')`, 'dokładne przesunięcie szkicu');
  await setCommandField('Przesunięcie X', '5');
  await setCommandField('Przesunięcie Y', '0');
  await confirmDialog();
  await waitForUi(window, `(() => { const point = window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entityData?.find((entity) => entity.id === ${JSON.stringify(editTargets.concavePointId)}); return Number(point?.geometry?.x) === 15; })()`, 'dokładna zmiana wierzchołka');

  await clickTool('Zakończ szkic');
  await clickTool('Wyciągnij');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Wyciągnięcie')`, 'wyciągnięcie profilu L');
  await setCommandField('Odległość', '8');
  await new Promise((resolve) => setTimeout(resolve, 100));
  await confirmDialog();
  await waitForUi(window, `Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 4400) < 0.01`, 'bryła ze zmienionego profilu L', modelingTimeoutMs);
  const polylineModel = await window.webContents.executeJavaScript(`(() => ({
    metrics: window.__madcadVerifyEngineState.bodies[0].metrics,
    entities: window.__madcadVerifyDocumentState.sketches[0].entities,
    profiles: window.__madcadVerifyDocumentState.sketches[0].profiles,
    features: window.__madcadVerifyDocumentState.features,
  }))()`);
  assertClose(polylineModel.metrics.area, 1100 + ((95 + Math.sqrt(425)) * 8), 0.01, 'Edited polyline L area');

  progress('new document');
  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt');
  await new Promise((resolve) => setTimeout(resolve, 250));
  await fs.writeFile(emptyOutputPath, (await window.webContents.capturePage()).toPNG());

  progress('base sketch');
  await clickTool('Utwórz szkic');
  await waitForUi(window, `document.querySelector('.plane-picker')`, 'wybór płaszczyzny');
  await pickPlane('XY');
  await waitForUi(window, `document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'tryb szkicu');
  await clickTool('Prostokąt');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Prostokąt ze środka')`, 'polecenie prostokąta');
  await setCommandField('Szerokość', '64');
  await setCommandField('Wysokość', '42');
  await new Promise((resolve) => setTimeout(resolve, 250));
  await fs.writeFile(sketchOutputPath, (await window.webContents.capturePage()).toPNG());
  await confirmDialog();
  await waitForUi(window, `document.querySelectorAll('.tree-profile').length === 1`, 'profil prostokąta');
  await clickTool('Zakończ szkic');
  progress('extrude');
  await waitForUi(window, `document.querySelector('.direct-extrude-hint')`, 'uchwyt bezpośredniego wyciągnięcia');
  await waitForUi(window, `window.__madcadDirectHandlePoint`, 'pozycja uchwytu wyciągnięcia');
  progress(`direct point ${JSON.stringify(await window.webContents.executeJavaScript(`window.__madcadDirectHandlePoint`))}`);
  const directHandleIsVisible = await window.webContents.executeJavaScript(`(() => {
    const canvas = document.querySelector('.model-viewport canvas');
    const rect = canvas.getBoundingClientRect();
    const point = window.__madcadDirectHandlePoint;
    return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
  })()`);
  if (!directHandleIsVisible) throw new Error('Direct extrusion handle is outside the viewport.');
  await dragDirectExtrude();
  progress(`direct pointer ${JSON.stringify(await window.webContents.executeJavaScript(`window.__madcadPointerLog || null`))}`);
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Wyciągnięcie')`, 'polecenie wyciągnięcia');
  await new Promise((resolve) => setTimeout(resolve, 350));
  await fs.writeFile(directOutputPath, (await window.webContents.capturePage()).toPNG());
  await setCommandField('Odległość', '8');
  await new Promise((resolve) => setTimeout(resolve, 100));
  await confirmDialog();
  await waitForUi(window, `document.querySelectorAll('.timeline-item').length === 1`, 'dodane wyciągnięcie');
  await waitForUi(window, `document.querySelector('.engine-status')?.classList.contains('ready')`, 'przeliczona bryła', modelingTimeoutMs);

  await waitForUi(
    window,
    `Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - ${64 * 42 * 8}) < 0.00001`,
    'golden B-Rep revision',
    modelingTimeoutMs,
  );
  const goldenBrep = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.bodies?.[0]?.metrics || null`);
  if (!goldenBrep) throw new Error('CAD engine did not return golden B-Rep metrics.');
  assertClose(goldenBrep.volume, 64 * 42 * 8, 1e-5, 'Golden B-Rep volume');
  assertClose(goldenBrep.area, 2 * ((64 * 42) + (64 * 8) + (42 * 8)), 1e-5, 'Golden B-Rep area');
  goldenBrep.dimensions.forEach((dimension, index) => {
    assertClose(dimension, [64, 42, 8][index], 1e-5, `Golden B-Rep dimension ${index}`);
  });
  if (goldenBrep.faceCount !== 6 || goldenBrep.edgeCount !== 12) {
    throw new Error(`Unexpected golden B-Rep topology: ${goldenBrep.faceCount} faces, ${goldenBrep.edgeCount} edges.`);
  }

  progress('hole sketch');
  await clickTool('Utwórz szkic');
  await waitForUi(window, `document.querySelector('.plane-picker')`, 'drugi wybór płaszczyzny');
  await pickPlane('XY');
  await waitForUi(window, `document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'drugi tryb szkicu');
  await clickTool('Okrąg');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Okrąg ze środka')`, 'polecenie okręgu');
  await setCommandField('Średnica', '12');
  await confirmDialog();
  await waitForUi(window, `document.querySelectorAll('.tree-profile').length === 2`, 'profil okręgu');
  await clickTool('Zakończ szkic');
  await waitForUi(window, `document.querySelector('.engine-status')?.classList.contains('ready')`, 'bryła przed otworem', modelingTimeoutMs);
  await waitForUi(window, `[...document.querySelectorAll('.ribbon-tool')].some((item) => item.querySelector('.ribbon-label')?.textContent === 'Otwór' && !item.disabled)`, 'aktywne polecenie otworu', modelingTimeoutMs);
  progress('hole');
  await clickTool('Otwór');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Otwór')`, 'polecenie otworu');
  await setCommandField('Głębokość', '8');
  await confirmDialog();
  await waitForUi(window, `document.querySelectorAll('.timeline-item').length === 2`, 'dodany otwór');
  await waitForUi(window, `document.querySelector('.engine-status')?.classList.contains('ready')`, 'przeliczony otwór', modelingTimeoutMs);

  progress('fillet and chamfer');
  await clickTool('Zaokrąglij');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Zaokrąglenie')`, 'polecenie zaokrąglenia');
  await setCommandField('Promień', '0.8');
  await confirmDialog();
  await waitForUi(window, `document.querySelectorAll('.timeline-item').length === 3`, 'dodane zaokrąglenie');
  await waitForUi(window, `document.querySelector('.engine-status')?.classList.contains('ready') && !document.querySelector('.timeline-item.error')`, 'przeliczone zaokrąglenie', modelingTimeoutMs);

  await clickTool('Fazuj');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Fazowanie')`, 'polecenie fazowania');
  await setCommandField('Odległość', '0.4');
  await confirmDialog();
  await waitForUi(window, `document.querySelectorAll('.timeline-item').length === 4`, 'dodane fazowanie');
  await waitForUi(window, `document.querySelector('.engine-status')?.classList.contains('ready') && !document.querySelector('.timeline-item.error')`, 'przeliczone fazowanie', modelingTimeoutMs);

  progress('parameters and undo/redo');
  await clickTool('Parametry');
  await waitForUi(window, `document.querySelector('.parameters-dialog')`, 'okno parametrów');
  progress('print workspace');
  await window.webContents.executeJavaScript(`(() => {
    const add = [...document.querySelectorAll('.parameters-dialog button')].find((item) => item.textContent.includes('Dodaj parametr'));
    const key = Object.keys(add).find((item) => item.startsWith('__reactProps'));
    add[key].onClick();
  })()`);
  await waitForUi(window, `document.querySelectorAll('.parameter-row').length === 1`, 'dodany parametr');
  await confirmParameters();
  await waitForUi(window, `!document.querySelector('.parameters-dialog')`, 'zamknięcie parametrów przed cofnięciem');

  await sendShortcut('z');
  await waitForUi(window, `!document.querySelector('.modeling-shell button[title="Ponów"]')?.disabled`, 'aktywny stan ponowienia');
  await clickTool('Parametry');
  await waitForUi(window, `document.querySelector('.parameters-dialog') && document.querySelectorAll('.parameter-row').length === 0`, 'cofnięcie parametru skrótem');
  await confirmParameters();
  await waitForUi(window, `!document.querySelector('.parameters-dialog')`, 'zamknięcie parametrów przed ponowieniem');
  await sendShortcut('y');
  await clickTool('Parametry');
  await waitForUi(window, `document.querySelectorAll('.parameter-row').length === 1`, 'ponowienie parametru skrótem');
  await confirmParameters();

  await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.workspace-tabs button')].find((item) => item.textContent === 'DRUK 3D');
    if (!button) throw new Error('Brak obszaru DRUK 3D');
    const key = Object.keys(button).find((item) => item.startsWith('__reactProps'));
    button[key].onClick();
  })()`);
  await waitForUi(window, `document.querySelector('.print-inspector')`, 'obszar przygotowania druku');

  await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.workspace-tabs button')].find((item) => item.textContent === 'BRYŁA');
    const key = Object.keys(button).find((item) => item.startsWith('__reactProps'));
    button[key].onClick();
  })()`);

  await waitForUi(
    window,
    `(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem('madcad:modeling-document:v4') || 'null');
        return saved?.schemaVersion === 4 && saved?.features?.length === 4 && saved?.sketches?.length === 2;
      } catch (_error) {
        return false;
      }
    })()`,
    'current autosave revision',
    5000,
  );
  const autosaveState = await window.webContents.executeJavaScript(`(() => {
    const raw = window.localStorage.getItem('madcad:modeling-document:v4');
    if (!raw) return { available: false };
    const saved = JSON.parse(raw);
    return {
      available: true,
      schemaVersion: saved.schemaVersion,
      features: saved.features?.length || 0,
      sketches: saved.sketches?.length || 0,
      entities: saved.sketches?.reduce((total, sketch) => total + (sketch.entities?.length || 0), 0) || 0,
    };
  })()`);
  const autosaveRoundTrip = autosaveState.available
    && autosaveState.schemaVersion === 4
    && autosaveState.features === 4
    && autosaveState.sketches === 2
    && autosaveState.entities === 10;
  if (!autosaveRoundTrip) throw new Error(`Desktop autosave did not preserve the current document: ${JSON.stringify(autosaveState)}`);

  const recoveryRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`(() => {
    if (typeof window.__madcadVerifyRestartWorker !== 'function') throw new Error('Missing worker recovery test hook.');
    window.__madcadVerifyRestartWorker();
  })()`);
  await waitForUi(
    window,
    `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.revision > ${recoveryRevision}`,
    'worker recovery',
    modelingTimeoutMs,
  );
  const workerRecovery = await window.webContents.executeJavaScript(`(() => ({
    fromRevision: ${recoveryRevision},
    toRevision: window.__madcadVerifyEngineState.revision,
    crashDiagnostic: window.__madcadVerifyEngineState.diagnostics?.some((item) => item.code === 'WORKER_CRASH'),
    bodies: window.__madcadVerifyEngineState.bodies?.length || 0,
  }))()`);
  if (!workerRecovery.crashDiagnostic || !workerRecovery.bodies) throw new Error(`Incomplete worker recovery: ${JSON.stringify(workerRecovery)}`);

  const describedControls = await window.webContents.executeJavaScript(`(() => {
    const ribbon = [...document.querySelectorAll('.ribbon-tool:not(:disabled)')];
    const navigation = [...document.querySelectorAll('.navigation-bar button')];
    return ribbon.length > 0
      && ribbon.every((button) => button.querySelector('.ribbon-label')?.textContent.trim() && button.title.trim())
      && navigation.every((button) => button.title.trim());
  })()`);
  if (!describedControls) throw new Error('Aktywne opcje nie mają kompletu podpisów i opisów.');

  progress('ui flow complete');
  return {
    profiles: await window.webContents.executeJavaScript(`document.querySelectorAll('.tree-profile').length`),
    features: await window.webContents.executeJavaScript(`document.querySelectorAll('.timeline-item').length`),
    parameterEditing: true,
    undoRedo: true,
    keyboardUndoRedo: true,
    sketchWorkflow: true,
    linePolyline: true,
    enterEscapeTermination: true,
    sketchMultiSelection: true,
    crossingInsideSelection: true,
    sketchPointSegmentDrag: true,
    sketchDeleteUndoRedo: true,
    polylineModel,
    directManipulation: true,
    pointerInput: 'pen',
    filletChamfer: true,
    goldenBrep,
    describedControls,
    commandDialogs: true,
    printWorkspace: true,
    autosaveRoundTrip,
    workerRecovery,
  };
}

app.whenReady().then(async () => {
  const performanceBudgets = isCi
    ? { desktopColdStartMs: 60000, desktopWorkflowMs: 150000 }
    : { desktopColdStartMs: 30000, desktopWorkflowMs: 45000 };
  const performance = { coldStartMs: 0, workflowMs: 0 };
  const window = new BrowserWindow({
    width: 1936,
    height: 1080,
    show: true,
    webPreferences: { partition: `madcad-verifier-${Date.now()}` },
  });
  window.setContentSize(1936, 1017);
  const rendererMessages = [];
  window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    rendererMessages.push({ level, message, line, sourceId });
  });
  let exitCode = 0;
  try {
    process.stdout.write('[verify] loading application\n');
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1' } });
    const result = await waitForModel(window);
    performance.coldStartMs = Date.now() - verificationStartedAt;
    if (performance.coldStartMs > performanceBudgets.desktopColdStartMs) {
      throw new Error(`Desktop cold start exceeded budget: ${performance.coldStartMs} ms.`);
    }
    process.stdout.write('[verify] engine ready\n');
    const licenseBypass = await window.webContents.executeJavaScript(`(() => {
      const overlay = document.querySelector('#licenseOverlay');
      const root = document.querySelector('.app');
      const entry = document.querySelector('#licenseCategoryBtn');
      return {
        overlayHidden: !overlay || overlay.hidden,
        appUnlocked: !root?.classList.contains('license-locked'),
        entryHidden: !entry || entry.hidden,
      };
    })()`);
    if (!licenseBypass.overlayHidden || !licenseBypass.appUnlocked || !licenseBypass.entryHidden) {
      throw new Error('Aktywacja licencji nadal blokuje interfejs.');
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const workflowStartedAt = Date.now();
    const uiFlow = await runUiFlow(window);
    performance.workflowMs = Date.now() - workflowStartedAt;
    if (performance.workflowMs > performanceBudgets.desktopWorkflowMs) {
      throw new Error(`Desktop workflow exceeded budget: ${performance.workflowMs} ms.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
    const topologyMapping = await window.webContents.executeJavaScript(`(() => {
      const engine = window.__madcadVerifyEngineState;
      const bodies = engine?.bodies || [];
      return {
        revision: engine?.revision || 0,
        cacheEntries: engine?.cache?.entries || 0,
        faces: bodies.reduce((total, body) => total + (body.topology?.faces?.length || 0), 0),
        edges: bodies.reduce((total, body) => total + (body.topology?.edges?.length || 0), 0),
        faceGroupsMapped: bodies.every((body) => (body.faceGroups || []).every((group) => Boolean(group.topologyId))),
        edgeGroupsMapped: bodies.every((body) => (body.edgeGroups || []).every((group) => Boolean(group.topologyId))),
      };
    })()`);
    if (!topologyMapping.revision || !topologyMapping.faces || !topologyMapping.edges || !topologyMapping.faceGroupsMapped || !topologyMapping.edgeGroupsMapped) {
      throw new Error(`Niepełne mapowanie topologii workera: ${JSON.stringify(topologyMapping)}`);
    }
    const image = await window.webContents.capturePage();
    await fs.writeFile(outputPath, image.toPNG());
    window.setContentSize(1100, 760);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await fs.writeFile(narrowOutputPath, (await window.webContents.capturePage()).toPNG());
    const narrowViewport = await window.webContents.executeJavaScript(`({
      width: innerWidth,
      height: innerHeight,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      coreToolbarVisible: [...document.querySelectorAll('.ribbon-label')].some((item) => item.textContent === 'Utwórz szkic'),
      timelineVisible: Boolean(document.querySelector('.timeline')),
    })`);
    window.setContentSize(1936, 1017);
    process.stdout.write('[verify] exporting STL and STEP\n');
    const stl = await verifyExport(window, 'STL');
    const step = await verifyExport(window, 'STEP');
    const report = { ...result, licenseBypass, screenshot: outputPath, narrowScreenshot: narrowOutputPath, narrowViewport, uiFlow, topologyMapping, exports: { stl, step }, performance, rendererMessages };
    await fs.writeFile(path.join(path.dirname(outputPath), 'verification-report.json'), JSON.stringify(report, null, 2));
    process.stdout.write(`${JSON.stringify(report)}\n`);
    if (!result.shell || !result.status.includes('ready') || uiFlow.features < 2 || narrowViewport.horizontalOverflow || !narrowViewport.coreToolbarVisible || !narrowViewport.timelineVisible) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    exitCode = 1;
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const notice = window.isDestroyed() ? '' : await window.webContents.executeJavaScript(`document.querySelector('.notice')?.textContent?.trim() || ''`);
    await fs.writeFile(
      path.join(path.dirname(outputPath), 'verification-report.json'),
      JSON.stringify({ ok: false, error: error.stack || error.message, notice, rendererMessages }, null, 2),
    );
  } finally {
    window.destroy();
    app.exit(exitCode);
  }
});
