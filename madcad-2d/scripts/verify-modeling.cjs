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

async function verifyThreeMfExport(window) {
  const result = await window.webContents.executeJavaScript(`(async () => {
    if (typeof window.__madcadVerifyExport !== 'function') throw new Error('Brak testowego interfejsu eksportu.');
    const exported = await window.__madcadVerifyExport('3mf');
    const bytes = new Uint8Array(exported[0]);
    return { size: bytes.byteLength, signature: Array.from(bytes.slice(0, 4)) };
  })()`);
  if (result.size < 300 || result.signature[0] !== 0x50 || result.signature[1] !== 0x4b) throw new Error(`Invalid 3MF archive: ${JSON.stringify(result)}`);
  return result;
}

async function verifyThreeMfImport(window) {
  const before = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.bodies?.length || 0`);
  await window.webContents.executeJavaScript(`(async () => {
    const exported = await window.__madcadVerifyExport('3mf');
    const input = [...document.querySelectorAll('input[type="file"]')].find((item) => item.accept.includes('.3mf'));
    const key = input && Object.keys(input).find((item) => item.startsWith('__reactProps'));
    const handler = key && input[key]?.onChange;
    if (!handler) throw new Error('Brak interfejsu importu modelu.');
    await handler({ target: { files: [new File([exported[0]], 'roundtrip.3mf', { type: 'model/3mf' })], value: '' } });
  })()`);
  await waitForUi(window, `Boolean(document.querySelector('.import-model-dialog .confirm'))`, '3MF import dialog', modelingTimeoutMs);
  await window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('.import-model-dialog .confirm');
    const key = button && Object.keys(button).find((item) => item.startsWith('__reactProps'));
    if (!key || typeof button[key]?.onClick !== 'function') throw new Error('Brak potwierdzenia importu 3MF.');
    button[key].onClick();
  })()`);
  await waitForUi(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === ${before + 1}`, '3MF imported body', isCi ? 90000 : 45000);
  return window.webContents.executeJavaScript(`(() => {
    const body = window.__madcadVerifyEngineState.bodies.at(-1);
    return { bodies: window.__madcadVerifyEngineState.bodies.length, dimensions: body.metrics.dimensions, volume: body.metrics.volume };
  })()`);
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
    return new Promise((resolve, reject) => requestAnimationFrame(() => setTimeout(() => {
      const updatedField = [...document.querySelectorAll('.command-field')].find((item) => item.firstElementChild?.textContent === ${JSON.stringify(label)});
      const updatedInput = updatedField?.querySelector('input, select');
      if (String(updatedInput?.value) !== ${JSON.stringify(String(value))}) reject(new Error('Pole nie przyjęło wartości: ${label}'));
      else resolve();
    }, 30)));
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
  const toggleSketchOption = (label) => window.webContents.executeJavaScript(`(() => {
    const row = [...document.querySelectorAll('.sketch-palette label')].find((item) => item.querySelector('span')?.textContent === ${JSON.stringify(label)});
    const input = row?.querySelector('input[type="checkbox"]');
    if (!input) throw new Error('Brak opcji szkicu: ${label}');
    const key = Object.keys(input).find((item) => item.startsWith('__reactProps'));
    input[key].onChange({ target: { checked: !input.checked } });
  })()`);
  const editTimelineFeature = async (index, title = 'Wyciągnięcie') => {
    await window.webContents.executeJavaScript(`(() => {
      const button = document.querySelectorAll('.timeline-item')[${index}];
      if (!button) throw new Error('Brak operacji osi czasu: ${index}');
      button.click();
    })()`);
    await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'feature'`, `wybór operacji ${index + 1}`);
    await clickTool('Edytuj');
    await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes(${JSON.stringify(title)})`, `edycja ${title} ${index + 1}`);
  };
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
  await clickTool('Wybierz');
  const profileInterior = await window.webContents.executeJavaScript(`window.__madcadSketchLocalToScreen?.(5, 5)`);
  await sendMouse('mouseDown', profileInterior);
  await sendMouse('mouseUp', profileInterior);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'profile'`, 'wybór wypełnionego profilu');

  progress('sketch selection and editing');
  const editTargets = await window.webContents.executeJavaScript(`(() => {
    const entities = window.__madcadVerifyDocumentState.sketches.at(-1).entityData;
    const pointAt = (x, y) => entities.find((entity) => entity.type === 'point' && Number(entity.geometry.x) === x && Number(entity.geometry.y) === y)?.id;
    const originPointId = pointAt(0, 0);
    return {
      concavePointId: pointAt(10, 10),
      neighborPointId: pointAt(30, 10),
      originPointId,
      originCornerLineIds: entities.filter((entity) => entity.type === 'line' && entity.pointIds?.includes(originPointId)).map((entity) => entity.id),
      allLineIds: entities.filter((entity) => entity.type === 'line').map((entity) => entity.id),
      lineId: entities.find((entity) => entity.type === 'line')?.id,
    };
  })()`);
  if (!editTargets.concavePointId || !editTargets.neighborPointId || !editTargets.lineId || editTargets.originCornerLineIds.length !== 2) throw new Error(`Missing L-profile edit targets: ${JSON.stringify(editTargets)}`);
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

  progress('sketch fillet and chamfer commands');
  await window.webContents.executeJavaScript(`window.__madcadVerifySketchSelection?.(${JSON.stringify(editTargets.originCornerLineIds)}, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.ids?.length === 2`, 'dwie linie narożnika Fillet');
  await clickTool('Fillet szkicu');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Fillet szkicu')`, 'okno Fillet szkicu');
  await setCommandField('Promień', '2');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 15`, 'utworzenie Fillet szkicu');
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 12`, 'Undo Fillet szkicu');
  await window.webContents.executeJavaScript(`window.__madcadVerifySketchSelection?.(${JSON.stringify(editTargets.originCornerLineIds)}, 'replace')`);
  await clickTool('Faza szkicu');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Chamfer szkicu')`, 'okno Chamfer szkicu');
  await setCommandField('Odległość', '3');
  await clickDialogButton('Anuluj');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 12`, 'anulowanie Chamfer szkicu');
  await clickTool('Faza szkicu');
  await setCommandField('Odległość', '3');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 14`, 'utworzenie Chamfer szkicu');
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 12`, 'Undo Chamfer szkicu');

  progress('sketch offset command, cancel and undo');
  await clickSketchEntity(editTargets.lineId);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.ids?.includes(${JSON.stringify(editTargets.lineId)})`, 'zaznaczenie linii Offset');
  await clickTool('Offset');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Offset szkicu')`, 'okno Offset');
  await setCommandField('Odległość', '-2');
  await clickDialogButton('Anuluj');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 12`, 'anulowanie Offset bez zmiany');
  await clickTool('Offset');
  await setCommandField('Odległość', '-2');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 15`, 'utworzenie Offset linii');
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 12`, 'Undo Offset');

  progress('sketch copy transform command');
  await window.webContents.executeJavaScript(`window.__madcadVerifySketchSelection?.(${JSON.stringify(editTargets.allLineIds)}, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.ids?.length === ${editTargets.allLineIds.length}`, 'pełny profil do Copy');
  await clickTool('Transformuj');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Transformuj szkic')`, 'okno transformacji szkicu');
  await setCommandField('Operacja', 'copy');
  await waitForUi(window, `[...document.querySelectorAll('.command-field')].some((item) => item.firstElementChild?.textContent === 'Kopia ΔX')`, 'pola Copy');
  await setCommandField('Kopia ΔX', '50');
  await setCommandField('Kopia ΔY', '0');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 24 && window.__madcadVerifyDocumentState?.sketches?.at(-1)?.profiles === 2`, 'Copy tworzy niezależny profil');
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 12 && window.__madcadVerifyDocumentState?.sketches?.at(-1)?.profiles === 1`, 'Undo Copy');

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

  progress('topology profiles XY XZ YZ');
  for (const plane of ['XY', 'XZ', 'YZ']) {
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTopologyFixture?.(${JSON.stringify(plane)})`);
    await waitForUi(window, `Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 5520) < 0.01`, `profil z otworem ${plane}`, modelingTimeoutMs);
  }

  progress('mechanical profiles and exact curved B-Rep');
  const mechanicalFixtures = [
    ['ellipse', Math.PI * 20 * 10 * 3],
    ['ellipticalArc', Math.PI * 20 * 10 * 1.5],
    ['slot', ((30 * 10) + (Math.PI * 25)) * 3],
    ['slotArc', (((Math.PI / 2) * 25 * 10) + (Math.PI * 25)) * 3],
    ['bracket', ((60 * 50) + (Math.PI * 25 * 25 / 2) - ((20 * 8) + (Math.PI * 4 * 4)) - (2 * Math.PI * 4 * 4)) * 3],
    ['spline', null],
    ['conic', null],
  ];
  for (const [kind, expectedVolume] of mechanicalFixtures) {
    const previousRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadMechanicalFixture?.(${JSON.stringify(kind)})`);
    await waitForUi(window, `(window.__madcadVerifyEngineState?.revision || 0) > ${previousRevision} && window.__madcadVerifyEngineState?.status === 'ready'`, `rewizja dokładnej figury ${kind}`, modelingTimeoutMs);
    const actualVolume = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume`);
    progress(`${kind} volume ${actualVolume}`);
    if (expectedVolume === null) {
      if (!(actualVolume > 100)) throw new Error(`Mechanical ${kind} returned invalid volume ${actualVolume}.`);
    } else assertClose(actualVolume, expectedVolume, 0.05, `Mechanical ${kind} volume`);
  }
  progress('fully constrained parametric bracket');
  let previousRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyLoadParametricBracketFixture?.()`);
  await waitForUi(window, `(window.__madcadVerifyEngineState?.revision || 0) > ${previousRevision} && Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 6000) < 0.05`, 'początkowa bryła parametrycznego wspornika', modelingTimeoutMs);
  await waitForUi(window, `document.querySelector('.sketch-solver-status')?.textContent.includes('W pełni związany')`, 'status w pełni związanego wspornika');
  const bracketIds = await window.webContents.executeJavaScript(`window.__madcadParametricBracketIds`);
  previousRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyUpdateConstraint?.(window.__madcadParametricBracketIds.widthConstraintId, '60')`);
  await waitForUi(window, `(window.__madcadVerifyEngineState?.revision || 0) > ${previousRevision} && Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 9000) < 0.05`, 'bryła po zmianie szerokości', modelingTimeoutMs);
  previousRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyUpdateConstraint?.(window.__madcadParametricBracketIds.heightConstraintId, '25')`);
  await waitForUi(window, `(window.__madcadVerifyEngineState?.revision || 0) > ${previousRevision} && Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 7500) < 0.05`, 'bryła po zmianie wysokości', modelingTimeoutMs);
  await waitForUi(window, `(() => { const saved = JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null'); return saved?.sketches?.[0]?.constraints?.some((item) => item.id === window.__madcadParametricBracketIds.heightConstraintId && item.value === '25'); })()`, 'autozapis zmienionych wymiarów');
  previousRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave?.()`);
  await waitForUi(window, `(window.__madcadVerifyEngineState?.revision || 0) > ${previousRevision} && Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 7500) < 0.05`, 'ponownie otwarta bryła wspornika', modelingTimeoutMs);
  const reopenedBracketIds = await window.webContents.executeJavaScript(`(() => ({
    entityIds: window.__madcadVerifyDocumentState.sketches[0].entityData.map((entity) => entity.id),
    profileId: window.__madcadVerifyDocumentState.sketches[0].profileIds[0],
    featureId: window.__madcadVerifyDocumentState.featureIds[0],
  }))()`);
  if (JSON.stringify(reopenedBracketIds.entityIds) !== JSON.stringify(bracketIds.entityIds)
    || reopenedBracketIds.profileId !== bracketIds.profileId
    || reopenedBracketIds.featureId !== bracketIds.featureId) throw new Error(`Parametric bracket lost stable IDs: ${JSON.stringify({ bracketIds, reopenedBracketIds })}`);
  const pointHoleRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyLoadPointHoleFixture?.()`);
  await waitForUi(window, `(window.__madcadVerifyEngineState?.revision || 0) > ${pointHoleRevision} && window.__madcadVerifyEngineState?.status === 'ready'`, 'otwór z punktu referencyjnego', modelingTimeoutMs);
  const pointHoleVolume = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume`);
  assertClose(pointHoleVolume, (40 * 30 * 10) - (Math.PI * 3 * 3 * 10), 0.05, 'Point reference hole volume');

  progress('hole on face positioned from two edges');
  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt dla otworu od krawędzi');
  await clickTool('Prymityw');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Prymityw 3D')`, 'baza otworu od krawędzi');
  await setCommandField('Szerokość', '40');
  await setCommandField('Głębokość', '30');
  await setCommandField('Wysokość', '10');
  await confirmDialog();
  await waitForUi(window, `Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 12000) < 0.05`, 'baza otworu od krawędzi gotowa', modelingTimeoutMs);
  const faceEdgeHoleSelection = await window.webContents.executeJavaScript(`(() => {
    const body = window.__madcadVerifyEngineState.bodies[0];
    const face = body.topology.faces.filter((item) => item.descriptor.geometry === 'PLANE').sort((a, b) => b.descriptor.center[2] - a.descriptor.center[2])[0];
    const edges = body.topology.edges.filter((item) => item.descriptor.geometry === 'LINE' && item.descriptor.endpoints.every((point) => Math.abs(point[2] - 10) < 0.001));
    let pair = null;
    for (let first = 0; first < edges.length && !pair; first += 1) for (let second = first + 1; second < edges.length && !pair; second += 1) {
      const shared = edges[first].descriptor.endpoints.some((left) => edges[second].descriptor.endpoints.some((right) => Math.hypot(...left.map((value, axis) => value - right[axis])) < 0.001));
      if (shared) pair = [edges[first], edges[second]];
    }
    if (!face || !pair) throw new Error('Nie znaleziono ściany i narożnika testowego Box.');
    const selection = (kind, record) => ({ kind, id: record.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId });
    return [selection('face', face), selection('edge', pair[0]), selection('edge', pair[1])];
  })()`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify(faceEdgeHoleSelection[0])}, 'replace')`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify(faceEdgeHoleSelection[1])}, 'add')`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify(faceEdgeHoleSelection[2])}, 'add')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.items?.length === 3`, 'ściana i dwie krawędzie otworu');
  await clickTool('Zmierz');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.command?.type === 'measure' && Math.abs(window.__madcadVerifyDocumentState.command.measurement?.angle - 90) < 0.001 && window.__madcadVerifyDocumentState.command.measurement?.length > 0 && window.__madcadVerifyDocumentState.command.measurement?.distance > 0`, 'Measure dwóch prostopadłych krawędzi');
  await waitForUi(window, `document.querySelector('.measure-panel')?.textContent.includes('Długość') && document.querySelector('.measure-panel')?.textContent.includes('Odległość') && document.querySelector('.measure-panel')?.textContent.includes('Kąt')`, 'panel wyniku Measure');
  await window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('.measure-panel header button');
    const key = button && Object.keys(button).find((item) => item.startsWith('__reactProps'));
    if (!key || typeof button[key]?.onClick !== 'function') throw new Error('Brak zamknięcia Measure.');
    button[key].onClick();
  })()`);
  await waitForUi(window, `!document.querySelector('.measure-panel')`, 'zamknięty Measure');
  await clickTool('Przekrój');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.command?.type === 'sectionAnalysis' && document.querySelector('.section-panel')`, 'otwarty Section Analysis');
  await setCommandField('Płaszczyzna', 'XZ');
  await setCommandField('Przesunięcie', '15');
  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('.section-toggle input');
    const key = input && Object.keys(input).find((item) => item.startsWith('__reactProps'));
    if (!key || typeof input[key]?.onChange !== 'function') throw new Error('Brak przełącznika strony przekroju.');
    input[key].onChange({ target: { checked: true } });
  })()`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.command?.sectionAnalysis?.plane === 'XZ' && window.__madcadVerifyDocumentState.command.sectionAnalysis.offset === '15' && window.__madcadVerifyDocumentState.command.sectionAnalysis.flip === true && window.__madcadSectionViewState?.enabled && window.__madcadSectionViewState.plane === 'XZ' && window.__madcadSectionViewState.offset === 15 && window.__madcadSectionViewState.clippingPlanes === 1`, 'aktywny przekrój XZ');
  await window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('.section-panel header button');
    const key = button && Object.keys(button).find((item) => item.startsWith('__reactProps'));
    if (!key || typeof button[key]?.onClick !== 'function') throw new Error('Brak zamknięcia Section Analysis.');
    button[key].onClick();
  })()`);
  await waitForUi(window, `!document.querySelector('.section-panel') && !window.__madcadSectionViewState?.enabled`, 'wyłączony Section Analysis');
  await clickTool('Masa');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.command?.type === 'massProperties' && document.querySelector('.mass-properties-panel')`, 'otwarte właściwości masowe');
  await setCommandField('Gęstość', '1.2');
  await waitForUi(window, `Math.abs(window.__madcadVerifyDocumentState?.command?.massProperties?.result?.volume - 12000) < 0.05 && Math.abs(window.__madcadVerifyDocumentState.command.massProperties.result.area - 3800) < 0.05 && Math.abs(window.__madcadVerifyDocumentState.command.massProperties.result.mass - 14.4) < 0.001 && Math.abs(window.__madcadVerifyDocumentState.command.massProperties.result.centerOfMass[2] - 5) < 0.001`, 'objętość pole masa i środek masy Box');
  await waitForUi(window, `document.querySelector('.mass-properties-panel')?.textContent.includes('14,4 g') && document.querySelector('.mass-properties-panel')?.textContent.includes('12 000 mm³')`, 'wynik właściwości masowych');
  await window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('.mass-properties-panel header button');
    const key = button && Object.keys(button).find((item) => item.startsWith('__reactProps'));
    if (!key || typeof button[key]?.onClick !== 'function') throw new Error('Brak zamknięcia właściwości masowych.');
    button[key].onClick();
  })()`);
  await waitForUi(window, `!document.querySelector('.mass-properties-panel')`, 'zamknięte właściwości masowe');
  await clickTool('Otwór');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Od krawędzi 1')`, 'pozycjonowanie otworu od krawędzi');
  await setCommandField('Od krawędzi 1', '6');
  await setCommandField('Od krawędzi 2', '8');
  await setCommandField('Średnica', '5');
  await setCommandField('Głębokość', '10');
  const faceEdgeHoleVolume = 12000 - (Math.PI * 2.5 * 2.5 * 10);
  await waitForUi(window, `Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - ${faceEdgeHoleVolume}) < 0.05`, 'podgląd otworu od krawędzi', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.placement === 'face-edges' && window.__madcadVerifyDocumentState.featureData[1].referenceIds?.length === 3`, 'zapisany otwór od krawędzi', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), faceEdgeHoleVolume, 0.05, 'Face-edge hole volume');

  await editTimelineFeature(1, 'Otwór');
  await setCommandField('Typ otworu', 'counterbore');
  await setCommandField('Zakres', 'through-all');
  await setCommandField('Średnica Counterbore', '9');
  await setCommandField('Głębokość Counterbore', '3');
  const counterboreVolume = 12000 - (Math.PI * 2.5 ** 2 * 10) - (Math.PI * ((4.5 ** 2) - (2.5 ** 2)) * 3);
  await waitForUi(window, `Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - ${counterboreVolume}) < 0.05`, 'podgląd Counterbore Through All', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.holeType === 'counterbore' && window.__madcadVerifyDocumentState.featureData[1].extent === 'through-all'`, 'zapisany Counterbore Through All', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), counterboreVolume, 0.05, 'Counterbore Through All volume');

  await editTimelineFeature(1, 'Otwór');
  const countersinkRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await setCommandField('Typ otworu', 'countersink');
  await setCommandField('Zakres', 'distance');
  await setCommandField('Głębokość', '10');
  await setCommandField('Średnica Countersink', '10');
  await setCommandField('Kąt Countersink', '90');
  const sinkDepth = (5 - 2.5) / Math.tan(Math.PI / 4);
  const countersinkExtra = (Math.PI * sinkDepth / 3) * ((5 ** 2) + (5 * 2.5) - (2 * (2.5 ** 2)));
  const countersinkVolume = 12000 - (Math.PI * 2.5 ** 2 * 10) - countersinkExtra;
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${countersinkRevision} && (window.__madcadVerifyEngineState?.status === 'ready' || window.__madcadVerifyEngineState?.status === 'error')`, 'wynik Countersink', modelingTimeoutMs);
  const countersinkPreview = await window.webContents.executeJavaScript(`({ status: window.__madcadVerifyEngineState?.status, error: document.querySelector('.engine-status')?.textContent, volume: window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume, timeline: window.__madcadVerifyEngineState?.timeline })`);
  if (countersinkPreview.status !== 'ready') throw new Error(`Countersink kernel error: ${JSON.stringify(countersinkPreview)}`);
  if (Math.abs(countersinkPreview.volume - countersinkVolume) > 0.05) throw new Error(`Countersink preview mismatch: ${JSON.stringify({ expected: countersinkVolume, ...countersinkPreview })}`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.holeType === 'countersink' && window.__madcadVerifyDocumentState.featureData[1].extent === 'distance'`, 'zapisany Countersink', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), countersinkVolume, 0.05, 'Countersink volume');

  await editTimelineFeature(1, 'Otwór');
  await setCommandField('Typ otworu', 'simple');
  await setCommandField('Gwint', 'cosmetic');
  await setCommandField('Średnica gwintu', '6');
  await setCommandField('Skok gwintu', '1');
  await setCommandField('Długość gwintu', '8');
  await setCommandField('Kierunek gwintu', 'right');
  await waitForUi(window, `Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - ${faceEdgeHoleVolume}) < 0.05`, 'gwint kosmetyczny bez zmiany B-Rep', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.threadMode === 'cosmetic' && window.__madcadVerifyDocumentState.featureData[1].threadDirection === 'right'`, 'zapisany gwint kosmetyczny', modelingTimeoutMs);

  await editTimelineFeature(1, 'Otwór');
  const modeledThreadRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await setCommandField('Gwint', 'modeled');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.command?.previewThreadMode === 'modeled'`, 'parametry modelowanego gwintu');
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${modeledThreadRevision} && ['ok', 'error'].includes(window.__madcadVerifyEngineState?.timeline?.[1]?.status)`, 'modelowany gwint prawy', modelingTimeoutMs);
  await new Promise((resolve) => setTimeout(resolve, 500));
  const modeledThreadState = await window.webContents.executeJavaScript(`({ volume: window.__madcadVerifyEngineState.bodies[0].metrics.volume, timeline: window.__madcadVerifyEngineState.timeline })`);
  if (modeledThreadState.timeline?.[1]?.status !== 'ok') throw new Error(`Modeled thread kernel error: ${JSON.stringify(modeledThreadState)}`);
  const rightThreadVolume = modeledThreadState.volume;
  if (!(rightThreadVolume < faceEdgeHoleVolume - 0.1 && rightThreadVolume > faceEdgeHoleVolume - 100)) throw new Error(`Modeled right thread volume is invalid: ${rightThreadVolume}.`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.threadMode === 'modeled'`, 'zapisany gwint modelowany');

  await editTimelineFeature(1, 'Otwór');
  await setCommandField('Kierunek gwintu', 'left');
  await waitForUi(window, `window.__madcadVerifyEngineState?.timeline?.[1]?.status === 'ok'`, 'modelowany gwint lewy', modelingTimeoutMs);
  const leftThreadVolume = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`);
  assertClose(leftThreadVolume, rightThreadVolume, 0.1, 'Left/right modeled thread volume');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.threadDirection === 'left'`, 'zapisany lewy gwint modelowany');

  await editTimelineFeature(1, 'Otwór');
  await setCommandField('Gwint', 'none');
  await setCommandField('Profil luzu', 'fff');
  await setCommandField('Luz promieniowy FFF', '0.2');
  const fffHoleVolume = 12000 - (Math.PI * 2.7 * 2.7 * 10);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.command?.previewClearanceProfile === 'fff' && Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - ${fffHoleVolume}) < 0.05`, 'podgląd kompensacji FFF', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.clearanceProfile === 'fff' && window.__madcadVerifyDocumentState.featureData[1].diameter === '5' && window.__madcadVerifyDocumentState.featureData[1].clearance === '0.2'`, 'nominalny wymiar i profil FFF', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), fffHoleVolume, 0.05, 'FFF compensated hole volume');

  progress('box cylinder sphere torus primitives');
  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt dla prymitywów');
  const primitiveFixtures = [
    { type: 'box', fields: { Szerokość: '10', Głębokość: '12', Wysokość: '14', 'Położenie X': '0' }, volume: 10 * 12 * 14 },
    { type: 'cylinder', fields: { Promień: '5', Wysokość: '10', 'Położenie X': '30' }, volume: Math.PI * 5 * 5 * 10 },
    { type: 'sphere', fields: { Promień: '6', 'Położenie X': '60' }, volume: (4 / 3) * Math.PI * 6 ** 3 },
    { type: 'torus', fields: { 'Promień główny': '12', 'Promień przekroju': '3', 'Położenie X': '100' }, volume: 2 * Math.PI ** 2 * 12 * 3 ** 2 },
  ];
  for (const [index, fixture] of primitiveFixtures.entries()) {
    await clickTool('Prymityw');
    await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Prymityw 3D')`, `okno prymitywu ${fixture.type}`);
    await setCommandField('Typ', fixture.type);
    for (const [label, value] of Object.entries(fixture.fields)) await setCommandField(label, value);
    const primitiveRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
    await confirmDialog();
    await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${primitiveRevision} && window.__madcadVerifyEngineState?.bodies?.length === ${index + 1} && window.__madcadVerifyEngineState?.status === 'ready'`, `przeliczony prymityw ${fixture.type}`, modelingTimeoutMs);
    const volume = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[${index}].metrics.volume`);
    assertClose(volume, fixture.volume, 0.05, `${fixture.type} volume`);
  }

  await clickTool('Analiza');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.command?.type === 'geometryInspection' && Math.abs(window.__madcadVerifyDocumentState.command.geometryInspection.minimumRadius - 3) < 0.001 && window.__madcadVerifyDocumentState.command.geometryInspection.collisions.length === 0`, 'minimalny promień i brak kolizji prymitywów', modelingTimeoutMs);
  await waitForUi(window, `document.querySelector('.geometry-inspection-panel')?.textContent.includes('3 mm') && document.querySelector('.geometry-inspection-panel')?.textContent.includes('Nie wykryto wspólnej objętości')`, 'panel analizy geometrii');
  await window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('.geometry-inspection-panel header button');
    const key = button && Object.keys(button).find((item) => item.startsWith('__reactProps'));
    if (!key || typeof button[key]?.onClick !== 'function') throw new Error('Brak zamknięcia analizy geometrii.');
    button[key].onClick();
  })()`);
  await waitForUi(window, `!document.querySelector('.geometry-inspection-panel')`, 'zamknięta analiza geometrii');

  progress('shared move rotate offset face manipulator');
  const primitiveBoxId = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].id`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection({ kind: 'body', bodyId: ${JSON.stringify(primitiveBoxId)} }, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'body'`, 'bryła wskazana do przesunięcia');
  await clickTool('Przesuń bryłę');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Przesuń bryłę') && document.querySelector('.direct-handle-hit')`, 'wspólny manipulator przesunięcia');
  await dragDirectExtrude();
  await setCommandField('Przesunięcie X', '5');
  await waitForUi(window, `Math.abs(window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(primitiveBoxId)}).metrics.bounds[0][0] - 5) < 0.001 && window.__madcadVerifyEngineState.timeline.at(-1)?.status === 'ok'`, 'podgląd przesuniętej bryły', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.at(-1)?.type === 'transform' && window.__madcadVerifyDocumentState.featureData.at(-1).x === '5'`, 'zapisane przesunięcie bryły', modelingTimeoutMs);
  let boxBounds = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(primitiveBoxId)}).metrics.bounds`);
  if (Math.abs(boxBounds[0][0] - 5) > 0.001) {
    const moveDiagnostic = await window.webContents.executeJavaScript(`({ feature: window.__madcadVerifyDocumentState.featureData.at(-1), bodies: window.__madcadVerifyEngineState.bodies.map((body) => ({ id: body.id, bounds: body.metrics.bounds })) })`);
    throw new Error(`Move body minimum X: expected 5, received ${boxBounds[0][0]}; ${JSON.stringify(moveDiagnostic)}`);
  }

  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection({ kind: 'body', bodyId: ${JSON.stringify(primitiveBoxId)} }, 'replace')`);
  await clickTool('Obróć bryłę');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Obróć bryłę') && document.querySelector('.direct-handle-hit')`, 'wspólny manipulator obrotu');
  await setCommandField('Kąt Z', '90');
  await waitForUi(window, `Math.abs((window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(primitiveBoxId)}).metrics.dimensions[0]) - 12) < 0.001 && window.__madcadVerifyEngineState.timeline.at(-1)?.status === 'ok'`, 'podgląd obróconej bryły', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.at(-1)?.mode === 'rotate'`, 'zapisany obrót bryły', modelingTimeoutMs);
  boxBounds = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(primitiveBoxId)}).metrics.bounds`);
  assertClose(boxBounds[1][0] - boxBounds[0][0], 12, 0.001, 'Rotate body X dimension');

  const offsetSelection = await window.webContents.executeJavaScript(`(() => { const body = window.__madcadVerifyEngineState.bodies.find((item) => item.id === ${JSON.stringify(primitiveBoxId)}); const face = body.topology.faces.filter((item) => item.descriptor.geometry === 'PLANE').sort((left, right) => right.descriptor.center[2] - left.descriptor.center[2])[0]; return { kind: 'face', id: face.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId }; })()`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify(offsetSelection)}, 'replace')`);
  await clickTool('Offset Face');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Offset Face') && document.querySelector('.direct-handle-hit')`, 'wspólny manipulator Offset Face');
  await setCommandField('Odległość', '2');
  await waitForUi(window, `Math.abs(window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(primitiveBoxId)}).metrics.volume - ${10 * 12 * 16}) < 0.05 && window.__madcadVerifyEngineState.timeline.at(-1)?.status === 'ok'`, 'podgląd odsuniętej ściany', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.at(-1)?.type === 'offsetFace'`, 'zapisany Offset Face', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(primitiveBoxId)}).metrics.volume`), 10 * 12 * 16, 0.05, 'Offset Face volume');

  progress('text profile extrude emboss deboss');
  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt dla tekstu');
  await clickTool('Tekst 3D');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Tekst 3D')`, 'okno nowej bryły tekstowej');
  await setCommandField('Tekst', 'HI');
  await setCommandField('Rozmiar', '7');
  await setCommandField('Głębokość', '2');
  const newTextRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${newTextRevision} && window.__madcadVerifyEngineState?.bodies?.length === 1 && window.__madcadVerifyDocumentState?.featureData?.[0]?.type === 'textSolid'`, 'wyciągnięty tekst jako nowa bryła', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), 32 * 2, 0.05, 'Text extrusion volume');

  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt dla Emboss');
  await clickTool('Prymityw');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Prymityw 3D')`, 'baza tekstu');
  await setCommandField('Szerokość', '40');
  await setCommandField('Głębokość', '20');
  await setCommandField('Wysokość', '5');
  await confirmDialog();
  await waitForUi(window, `Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 4000) < 0.05`, 'bryła bazowa tekstu', modelingTimeoutMs);
  const textBaseId = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].id`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection({ kind: 'body', bodyId: ${JSON.stringify(textBaseId)} }, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'body'`, 'bryła wskazana dla Emboss');
  await clickTool('Tekst 3D');
  await setCommandField('Tekst', 'HI');
  await setCommandField('Rozmiar', '7');
  await setCommandField('Głębokość', '2');
  await setCommandField('Położenie X', '2');
  await setCommandField('Położenie Y', '2');
  await waitForUi(window, `Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 4064) < 0.05`, 'podgląd Emboss', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.operation === 'emboss'`, 'zapisany Emboss', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), 4064, 0.05, 'Text emboss volume');

  await editTimelineFeature(1, 'Tekst 3D');
  await setCommandField('Operacja', 'deboss');
  await waitForUi(window, `Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 3936) < 0.05`, 'podgląd Deboss', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.operation === 'deboss'`, 'zapisany Deboss', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), 3936, 0.05, 'Text deboss volume');
  await sendShortcut('z');
  await waitForUi(window, `Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 4064) < 0.05`, 'undo tekstu', modelingTimeoutMs);
  await sendShortcut('z', true);
  await waitForUi(window, `Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 3936) < 0.05`, 'redo tekstu', modelingTimeoutMs);
  await waitForUi(window, `(() => { const saved = JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null'); return saved?.features?.[1]?.type === 'textSolid' && saved.features[1].operation === 'deboss'; })()`, 'autozapis tekstu 3D');
  const reopenTextRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave?.()`);
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${reopenTextRevision} && Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 3936) < 0.05`, 'ponownie otwarty Deboss', modelingTimeoutMs);

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
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Prostokąt')`, 'polecenie prostokąta');
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

  progress('B-Rep hover, multi-select and box select');
  await new Promise((resolve) => setTimeout(resolve, 500));
  const selectionRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  const topologyIds = await window.webContents.executeJavaScript(`(() => {
    const body = window.__madcadVerifyEngineState.bodies[0];
    return { face: body.topology.faces[0].id, edge: body.topology.edges[0].id, body: body.id };
  })()`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection({ kind: 'face', id: ${JSON.stringify(topologyIds.face)}, bodyId: ${JSON.stringify(topologyIds.body)} }, 'replace')`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection({ kind: 'edge', id: ${JSON.stringify(topologyIds.edge)}, bodyId: ${JSON.stringify(topologyIds.body)} }, 'add')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.items?.length === 2`, 'wielokrotny wybór topologii');
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection({ kind: 'face', id: ${JSON.stringify(topologyIds.face)}, bodyId: ${JSON.stringify(topologyIds.body)} }, 'toggle')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.items?.length === 1 && window.__madcadVerifyDocumentState.selection.items[0].kind === 'edge'`, 'przełączenie topologii Ctrl');
  await waitForUi(window, `window.__madcadModelScreenState?.topologyPoints?.[${JSON.stringify(topologyIds.face)}]`, 'punkt ekranowy ściany');
  const facePoint = await window.webContents.executeJavaScript(`window.__madcadModelScreenState.topologyPoints[${JSON.stringify(topologyIds.face)}]`);
  await sendMouse('mouseMove', facePoint);
  await waitForUi(window, `window.__madcadModelHover?.kind === 'face'`, 'hover ściany');
  await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.selection-filter-bar button')].find((item) => item.textContent === 'Ściana');
    button.click();
  })()`);
  await sendMouse('mouseMove', facePoint);
  await sendMouse('mouseDown', facePoint);
  await sendMouse('mouseUp', facePoint);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'face'`, 'pierwsza ściana cyklu');
  const firstCycledFace = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.selection.id`);
  await sendMouse('mouseMove', facePoint);
  await sendMouse('mouseDown', facePoint, ['alt']);
  await sendMouse('mouseUp', facePoint, ['alt']);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'face' && window.__madcadVerifyDocumentState.selection.id !== ${JSON.stringify(firstCycledFace)}`, 'cykliczny wybór nakładającej się ściany');
  await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.selection-filter-bar button')].find((item) => item.textContent === 'Bryła');
    button.click();
  })()`);
  await waitForUi(window, `document.querySelector('.selection-filter-bar button.active')?.textContent === 'Bryła'`, 'filtr bryły');
  const bodyBounds = await window.webContents.executeJavaScript(`window.__madcadModelScreenState.bodyBounds[${JSON.stringify(topologyIds.body)}]`);
  const canvasBounds = await window.webContents.executeJavaScript(`(() => { const rect = document.querySelector('.model-viewport canvas').getBoundingClientRect(); return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }; })()`);
  const boxStart = { x: Math.max(canvasBounds.left + 2, bodyBounds.left - 12), y: Math.max(canvasBounds.top + 2, bodyBounds.top - 12) };
  const boxEnd = { x: Math.min(canvasBounds.right - 2, bodyBounds.right + 12), y: Math.min(canvasBounds.bottom - 2, bodyBounds.bottom + 12) };
  await sendMouse('mouseDown', boxStart, ['shift']);
  await sendMouse('mouseMove', boxEnd, ['shift']);
  await sendMouse('mouseUp', boxEnd, ['shift']);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.items?.some((item) => item.kind === 'body')`, 'wybór bryły obszarem');
  const revisionAfterSelection = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  if (revisionAfterSelection !== selectionRevision) throw new Error('Picking uruchomił ponowne przeliczenie bryły.');
  const lostReferenceId = await window.webContents.executeJavaScript(`window.__madcadVerifyCreateLostTopologyReference()`);
  await waitForUi(window, `document.querySelector('.reference-repair-panel')?.textContent.includes('Źródło: Wyciągnięcie 1')`, 'komunikat utraconej referencji ze źródłowym feature', modelingTimeoutMs);
  await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.reference-repair-panel button')].find((item) => item.textContent === 'Kandydat 1');
    if (!button) throw new Error('Brak kandydata naprawy referencji.');
    button.click();
  })()`);
  await waitForUi(window, `!document.querySelector('.reference-repair-panel') && window.__madcadVerifyDocumentState?.references?.find((item) => item.id === ${JSON.stringify(lostReferenceId)})?.topologyId !== window.__madcadVerifyEngineState.bodies[0].topology.edges[0].id + '-lost'`, 'ponowne przypisanie referencji', modelingTimeoutMs);

  progress('parametric offset construction plane');
  await clickTool('Płaszczyzna offset');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Płaszczyzna odsunięta')`, 'okno płaszczyzny odsuniętej');
  await setCommandField('Nazwa', 'Płaszczyzna montażowa');
  await setCommandField('Płaszczyzna bazowa', 'YZ');
  await setCommandField('Odległość', '15');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.references?.some((item) => item.kind === 'construction-plane' && item.name === 'Płaszczyzna montażowa' && item.basePlane === 'YZ' && item.offset === '15')`, 'zapis płaszczyzny konstrukcyjnej');
  const constructionPlaneId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.references.find((item) => item.kind === 'construction-plane').id`);
  await waitForUi(window, `(() => { const plane = window.__madcadConstructionPlaneState?.find((item) => item.id === ${JSON.stringify(constructionPlaneId)}); return plane?.status === 'ok' && plane.visible && plane.origin[0] === 15 && plane.origin[1] === 0 && plane.origin[2] === 0; })()`, 'dokładne położenie płaszczyzny YZ');
  await window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('.tree-reference-row .tree-reference-visibility');
    if (!button) throw new Error('Brak przełącznika widoczności płaszczyzny.');
    button.click();
  })()`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.references?.find((item) => item.id === ${JSON.stringify(constructionPlaneId)})?.visible === false`, 'ukrycie płaszczyzny');
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.references?.find((item) => item.id === ${JSON.stringify(constructionPlaneId)})?.visible === true`, 'undo widoczności płaszczyzny');
  await sendShortcut('y');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.references?.find((item) => item.id === ${JSON.stringify(constructionPlaneId)})?.visible === false`, 'redo widoczności płaszczyzny');
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.references?.find((item) => item.id === ${JSON.stringify(constructionPlaneId)})?.visible === true`, 'przywrócenie widoczności płaszczyzny');
  await clickTool('Midplane');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Płaszczyzna środkowa')`, 'okno midplane');
  await setCommandField('Nazwa', 'Środek korpusu');
  await setCommandField('Płaszczyzna bazowa', 'XY');
  await setCommandField('Położenie A', '-4');
  await setCommandField('Położenie B', '20');
  await confirmDialog();
  await waitForUi(window, `(() => { const plane = window.__madcadConstructionPlaneState?.find((item) => item.name === 'Środek korpusu'); return plane?.status === 'ok' && plane.origin[2] === 8; })()`, 'dokładna płaszczyzna środkowa');
  await clickTool('Plane 3 punkty');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Płaszczyzna przez trzy punkty')`, 'okno plane przez trzy punkty');
  await setCommandField('Nazwa', 'Płaszczyzna punktów');
  await setCommandField('Punkt 1 Z', '6');
  await setCommandField('Punkt 2 Z', '6');
  await setCommandField('Punkt 3 Z', '6');
  await confirmDialog();
  await waitForUi(window, `(() => { const plane = window.__madcadConstructionPlaneState?.find((item) => item.name === 'Płaszczyzna punktów'); return plane?.status === 'ok' && plane.origin[2] === 6 && plane.normal[2] === 1; })()`, 'płaszczyzna przez trzy niewspółliniowe punkty');

  progress('construction axes');
  await clickTool('Oś z krawędzi');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Oś z krawędzi')`, 'okno osi z krawędzi');
  await setCommandField('Nazwa', 'Oś krawędzi testowej');
  await setCommandField('Punkt 2 X', '25');
  await confirmDialog();
  await waitForUi(window, `(() => { const axis = window.__madcadConstructionAxisState?.find((item) => item.name === 'Oś krawędzi testowej'); return axis?.status === 'ok' && axis.direction[0] === 1; })()`, 'oś z krawędzi');
  await clickTool('Oś walca');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Oś walca')`, 'okno osi walca');
  await setCommandField('Nazwa', 'Oś walca testowego');
  await setCommandField('Środek X', '4');
  await setCommandField('Kierunek Z', '3');
  await confirmDialog();
  await waitForUi(window, `(() => { const axis = window.__madcadConstructionAxisState?.find((item) => item.name === 'Oś walca testowego'); return axis?.status === 'ok' && axis.origin[0] === 4 && axis.direction[2] === 1; })()`, 'oś walca');
  await clickTool('Oś 2 punkty');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Oś przez dwa punkty')`, 'okno osi przez dwa punkty');
  await setCommandField('Nazwa', 'Oś przekątna');
  await setCommandField('Punkt 2 Y', '10');
  await setCommandField('Punkt 2 Z', '10');
  await confirmDialog();
  await waitForUi(window, `(() => { const axis = window.__madcadConstructionAxisState?.find((item) => item.name === 'Oś przekątna'); return axis?.status === 'ok' && Math.abs(axis.direction[1] - Math.SQRT1_2) < 1e-9 && Math.abs(axis.direction[2] - Math.SQRT1_2) < 1e-9; })()`, 'oś przez dwa punkty');
  await clickTool('Oś przecięcia');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Oś przecięcia płaszczyzn')`, 'okno osi przecięcia');
  await setCommandField('Nazwa', 'Oś przecięcia testowa');
  await setCommandField('Płaszczyzna A', constructionPlaneId);
  const midplaneId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.references.find((item) => item.name === 'Środek korpusu').id`);
  await setCommandField('Płaszczyzna B', midplaneId);
  await confirmDialog();
  await waitForUi(window, `(() => { const axis = window.__madcadConstructionAxisState?.find((item) => item.name === 'Oś przecięcia testowa'); return axis?.status === 'ok' && axis.origin[0] === 15 && axis.origin[2] === 8 && Math.abs(axis.direction[1]) === 1; })()`, 'oś przecięcia dwóch płaszczyzn');

  progress('construction points');
  await clickTool('Punkt wierzchołka');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Punkt na wierzchołku')`, 'okno punktu wierzchołka');
  await setCommandField('Nazwa', 'Punkt bazowy');
  await setCommandField('X', '2');
  await setCommandField('Y', '3');
  await setCommandField('Z', '4');
  await confirmDialog();
  await waitForUi(window, `(() => { const point = window.__madcadConstructionPointState?.find((item) => item.name === 'Punkt bazowy'); return point?.status === 'ok' && point.position.join(',') === '2,3,4'; })()`, 'punkt na wierzchołku');
  await clickTool('Punkt centrum');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Punkt środka')`, 'okno punktu centrum');
  await setCommandField('Nazwa', 'Punkt środka testowy');
  await setCommandField('X', '5');
  await setCommandField('Y', '6');
  await setCommandField('Z', '7');
  await confirmDialog();
  await waitForUi(window, `(() => { const point = window.__madcadConstructionPointState?.find((item) => item.name === 'Punkt środka testowy'); return point?.status === 'ok' && point.position.join(',') === '5,6,7'; })()`, 'punkt centrum');
  await clickTool('Punkt przecięcia');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Punkt przecięcia')`, 'okno punktu przecięcia');
  await setCommandField('Nazwa', 'Punkt przecięcia testowy');
  const edgeAxisId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.references.find((item) => item.name === 'Oś krawędzi testowej').id`);
  await setCommandField('Oś', edgeAxisId);
  await setCommandField('Płaszczyzna', constructionPlaneId);
  await confirmDialog();
  await waitForUi(window, `(() => { const point = window.__madcadConstructionPointState?.find((item) => item.name === 'Punkt przecięcia testowy'); return point?.status === 'ok' && point.position.join(',') === '15,0,0'; })()`, 'punkt przecięcia osi i płaszczyzny');

  progress('sketch on planar model face');
  const supportFace = await window.webContents.executeJavaScript(`(() => {
    const body = window.__madcadVerifyEngineState.bodies[0];
    const face = body.topology.faces.find((item) => item.descriptor.geometry === 'PLANE' && Math.abs(item.descriptor.normal?.[2] || 0) > 0.99 && item.descriptor.center?.[2] > 7.9);
    return face && { id: face.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId };
  })()`);
  if (!supportFace) throw new Error('Brak górnej planarnej ściany do testu szkicu na modelu.');
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify({ kind: 'face', ...supportFace })}, 'replace')`);
  await clickTool('Utwórz szkic');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.length === 2 && window.__madcadVerifyDocumentState.sketches[1].support?.kind === 'face' && Number(window.__madcadVerifyDocumentState.sketches[1].planeOffset) > 7.9 && document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'szkic założony bezpośrednio na ścianie modelu', modelingTimeoutMs);
  await clickTool('Zakończ szkic');
  await waitForUi(window, `!document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'zakończenie szkicu na ścianie');

  progress('sketch on named construction plane');
  await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.tree-reference-row .tree-row')].find((item) => item.textContent.includes('Płaszczyzna montażowa'));
    if (!button) throw new Error('Brak płaszczyzny konstrukcyjnej w przeglądarce.');
    button.click();
  })()`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'constructionPlane'`, 'wybór płaszczyzny konstrukcyjnej');
  await clickTool('Utwórz szkic');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.length === 3 && window.__madcadVerifyDocumentState.sketches[2].support?.kind === 'construction-plane' && Number(window.__madcadVerifyDocumentState.sketches[2].planeOffset) === 15 && document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'szkic na nazwanej płaszczyźnie konstrukcyjnej', modelingTimeoutMs);
  await clickTool('Zakończ szkic');
  await waitForUi(window, `!document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'zakończenie szkicu na płaszczyźnie konstrukcyjnej');

  progress('hole sketch');
  await clickTool('Utwórz szkic');
  await waitForUi(window, `document.querySelector('.plane-picker')`, 'drugi wybór płaszczyzny');
  await pickPlane('XY');
  await waitForUi(window, `document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'drugi tryb szkicu');
  await clickTool('Project');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.command?.type === 'projectSketch'`, 'tryb Project');
  const projectionEdge = await window.webContents.executeJavaScript(`(() => {
    const body = window.__madcadVerifyEngineState.bodies[0];
    const edge = body.topology.edges.find((item) => { const [first, second] = item.descriptor.endpoints || []; return first && second && Math.hypot(second[0] - first[0], second[1] - first[1]) > 1; });
    return edge && { id: edge.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId };
  })()`);
  if (!projectionEdge) throw new Error('Brak niezerowej krawędzi do Project.');
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify({ kind: 'edge', ...projectionEdge })}, 'replace')`);
  await clickTool('Project');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.[3]?.entityData?.some((entity) => entity.role === 'projected' && entity.fixed && entity.projectionReferenceId)`, 'projekcja krawędzi z trwałym linkiem');
  const brokenProject = await window.webContents.executeJavaScript(`window.__madcadVerifyBreakProjectedReference()`);
  await waitForUi(window, `document.querySelector('.reference-repair-panel')?.textContent.includes('Project') && window.__madcadSketchEntityScreenPoints?.[${JSON.stringify(brokenProject.entityId)}]?.state === 'error'`, 'czytelny stan utraconego źródła Project', modelingTimeoutMs);
  await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.reference-repair-panel button')].find((item) => item.textContent === 'Kandydat 1');
    if (!button) throw new Error('Brak kandydata naprawy Project.');
    button.click();
  })()`);
  await waitForUi(window, `!document.querySelector('.reference-repair-panel') && window.__madcadSketchEntityScreenPoints?.[${JSON.stringify(brokenProject.entityId)}]?.state === 'projected' && !window.__madcadVerifyDocumentState.references.find((item) => item.id === ${JSON.stringify(brokenProject.referenceId)})?.topologyId.endsWith('-lost')`, 'naprawa i odświeżenie Project', modelingTimeoutMs);
  await toggleSketchOption('Geometria Project');
  await waitForUi(window, `window.__madcadSketchVisibilityState?.showProjectedGeometry === false && !window.__madcadSketchVisibilityState.entityIds.includes(${JSON.stringify(brokenProject.entityId)})`, 'ukrycie geometrii Project');
  await toggleSketchOption('Geometria Project');
  await waitForUi(window, `window.__madcadSketchVisibilityState?.showProjectedGeometry === true && window.__madcadSketchVisibilityState.entityIds.includes(${JSON.stringify(brokenProject.entityId)})`, 'pokazanie geometrii Project');
  await toggleSketchOption('Slice modelu');
  await waitForUi(window, `window.__madcadSketchVisibilityState?.sliceModel === true && document.querySelector('.sketch-slice-badge')?.textContent.includes('XY')`, 'Slice modelu na płaszczyźnie szkicu');
  await toggleSketchOption('Slice modelu');
  await waitForUi(window, `window.__madcadSketchVisibilityState?.sliceModel === false && !document.querySelector('.sketch-slice-badge')`, 'wyłączenie Slice');
  await clickTool('Okrąg');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Okrąg')`, 'polecenie okręgu');
  await setCommandField('Średnica', '12');
  await confirmDialog();
  await waitForUi(window, `document.querySelectorAll('.tree-profile').length === 2`, 'profil okręgu');
  await toggleSketchOption('Profile');
  await waitForUi(window, `window.__madcadSketchVisibilityState?.showSketchProfiles === false && window.__madcadSketchVisibilityState.profileCount === 0`, 'ukrycie profili szkicu');
  await toggleSketchOption('Profile');
  await waitForUi(window, `window.__madcadSketchVisibilityState?.showSketchProfiles === true && window.__madcadSketchVisibilityState.profileCount > 0`, 'pokazanie profili szkicu');
  await toggleSketchOption('Wiązania');
  await waitForUi(window, `window.__madcadSketchVisibilityState?.showSketchConstraints === false`, 'ukrycie więzów szkicu');
  await toggleSketchOption('Wiązania');
  await toggleSketchOption('Wymiary');
  await waitForUi(window, `window.__madcadSketchVisibilityState?.showSketchConstraints === true && window.__madcadSketchVisibilityState?.showSketchDimensions === false`, 'niezależna kontrola wymiarów i więzów');
  await toggleSketchOption('Wymiary');
  await toggleSketchOption('Geometrie konstrukcyjne');
  await waitForUi(window, `window.__madcadSketchVisibilityState?.showSketchDimensions === true && window.__madcadSketchVisibilityState?.showConstructionGeometry === false`, 'ukrycie geometrii konstrukcyjnej');
  await toggleSketchOption('Geometrie konstrukcyjne');
  await clickTool('Zakończ szkic');
  await waitForUi(window, `document.querySelector('.engine-status')?.classList.contains('ready')`, 'bryła przed wycięciem Through All', modelingTimeoutMs);
  await waitForUi(window, `[...document.querySelectorAll('.ribbon-tool')].some((item) => item.querySelector('.ribbon-label')?.textContent === 'Wyciągnij' && !item.disabled)`, 'aktywne polecenie Extrude', modelingTimeoutMs);
  progress('extrude cut through all');
  await clickTool('Wyciągnij');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Wyciągnięcie')`, 'polecenie Extrude Cut');
  await setCommandField('Operacja', 'cut');
  await setCommandField('Kierunek', 'through-all');
  const throughAllRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.type === 'extrude' && window.__madcadVerifyDocumentState.featureData[1].operation === 'cut' && window.__madcadVerifyDocumentState.featureData[1].extent === 'through-all'`, 'dodany Extrude Cut Through All');
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${throughAllRevision} && document.querySelector('.engine-status')?.classList.contains('ready')`, 'przeliczony Extrude Cut Through All', modelingTimeoutMs);
  const throughAllVolume = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume`);
  assertClose(throughAllVolume, (64 * 42 * 8) - (Math.PI * 6 * 6 * 8), 0.05, 'Extrude Cut Through All volume');

  await editTimelineFeature(1);
  await setCommandField('Operacja', 'join');
  await setCommandField('Kierunek', 'two-sides');
  await setCommandField('Odległość', '3');
  await setCommandField('Druga strona', '2');
  const twoSidesRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.operation === 'join' && window.__madcadVerifyDocumentState.featureData[1].extent === 'two-sides' && window.__madcadVerifyEngineState?.revision > ${twoSidesRevision} && document.querySelector('.engine-status')?.classList.contains('ready')`, 'Extrude Join na dwie strony', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), (64 * 42 * 8) + (Math.PI * 6 * 6 * 2), 0.05, 'Extrude Join two sides volume');

  await editTimelineFeature(1);
  await setCommandField('Operacja', 'cut');
  await setCommandField('Kierunek', 'symmetric');
  await setCommandField('Długość całkowita', '4');
  const symmetricRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.operation === 'cut' && window.__madcadVerifyDocumentState.featureData[1].extent === 'symmetric' && window.__madcadVerifyEngineState?.revision > ${symmetricRevision} && document.querySelector('.engine-status')?.classList.contains('ready')`, 'Extrude Cut symetryczny', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), (64 * 42 * 8) - (Math.PI * 6 * 6 * 2), 0.05, 'Extrude Cut symmetric volume');

  await editTimelineFeature(1);
  await setCommandField('Operacja', 'intersect');
  await setCommandField('Kierunek', 'through-all');
  const intersectRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.operation === 'intersect' && window.__madcadVerifyDocumentState.featureData[1].extent === 'through-all' && window.__madcadVerifyEngineState?.revision > ${intersectRevision} && document.querySelector('.engine-status')?.classList.contains('ready')`, 'Extrude Intersect Through All', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), Math.PI * 6 * 6 * 8, 0.05, 'Extrude Intersect Through All volume');

  await editTimelineFeature(1);
  await setCommandField('Operacja', 'new');
  await setCommandField('Kierunek', 'one-side');
  await setCommandField('Odległość', '8');
  const secondBodyRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.operation === 'new' && window.__madcadVerifyEngineState?.revision > ${secondBodyRevision} && window.__madcadVerifyEngineState?.bodies?.length === 2`, 'druga niezależna bryła do Boolean', modelingTimeoutMs);

  const booleanBodyIds = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies.map((body) => body.id)`);
  await window.webContents.executeJavaScript(`(() => {
    window.__madcadVerifyTopologySelection({ kind: 'body', bodyId: ${JSON.stringify(booleanBodyIds[0])} }, 'replace');
    window.__madcadVerifyTopologySelection({ kind: 'body', bodyId: ${JSON.stringify(booleanBodyIds[1])} }, 'add');
  })()`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.items?.length === 2`, 'dwie bryły zaznaczone do Boolean');
  await clickTool('Boolean');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Boolean')`, 'polecenie Boolean Union');
  const unionRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[2]?.type === 'boolean' && window.__madcadVerifyDocumentState.featureData[2].operation === 'union' && window.__madcadVerifyEngineState?.revision > ${unionRevision} && window.__madcadVerifyEngineState?.bodies?.length === 1`, 'Boolean Union', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), 64 * 42 * 8, 0.05, 'Boolean Union volume');

  await editTimelineFeature(2, 'Boolean');
  await setCommandField('Operacja', 'subtract');
  const subtractRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[2]?.operation === 'subtract' && window.__madcadVerifyEngineState?.revision > ${subtractRevision} && document.querySelector('.engine-status')?.classList.contains('ready')`, 'Boolean Subtract', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), (64 * 42 * 8) - (Math.PI * 6 * 6 * 8), 0.05, 'Boolean Subtract volume');

  await editTimelineFeature(2, 'Boolean');
  await setCommandField('Operacja', 'intersect');
  const booleanIntersectRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[2]?.operation === 'intersect' && window.__madcadVerifyEngineState?.revision > ${booleanIntersectRevision} && document.querySelector('.engine-status')?.classList.contains('ready')`, 'Boolean Intersect', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), Math.PI * 6 * 6 * 8, 0.05, 'Boolean Intersect volume');

  await editTimelineFeature(2, 'Boolean');
  await setCommandField('Operacja', 'subtract');
  const restoredSubtractRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[2]?.operation === 'subtract' && window.__madcadVerifyEngineState?.revision > ${restoredSubtractRevision} && document.querySelector('.engine-status')?.classList.contains('ready')`, 'przywrócony Boolean Subtract', modelingTimeoutMs);

  progress('fillet and chamfer');
  const filletEdge = await window.webContents.executeJavaScript(`(() => { const body = window.__madcadVerifyEngineState.bodies[0]; const edge = body.topology.edges.find((item) => item.descriptor.geometry === 'LINE' && item.descriptor.length > 5); return { kind: 'edge', id: edge.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId }; })()`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify(filletEdge)}, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'edge'`, 'krawędź wskazana do Fillet');
  await clickTool('Zaokrąglij');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Zaokrąglenie')`, 'polecenie zaokrąglenia');
  await setCommandField('Promień', '0.8');
  const filletRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `document.querySelectorAll('.timeline-item').length === 4`, 'dodane zaokrąglenie');
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${filletRevision} && document.querySelector('.engine-status')?.classList.contains('ready') && !document.querySelector('.timeline-item.error')`, 'przeliczone zaokrąglenie', modelingTimeoutMs);

  const chamferEdge = await window.webContents.executeJavaScript(`(() => { const body = window.__madcadVerifyEngineState.bodies[0]; const edge = body.topology.edges.find((item) => item.descriptor.geometry === 'LINE' && item.descriptor.length > 5); return { kind: 'edge', id: edge.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId }; })()`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify(chamferEdge)}, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'edge'`, 'krawędź wskazana do Chamfer');
  await clickTool('Fazuj');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Fazowanie')`, 'polecenie fazowania');
  await setCommandField('Odległość', '0.4');
  const chamferRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `document.querySelectorAll('.timeline-item').length === 5`, 'dodane fazowanie');
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${chamferRevision} && document.querySelector('.engine-status')?.classList.contains('ready') && !document.querySelector('.timeline-item.error')`, 'przeliczone fazowanie', modelingTimeoutMs);

  progress('shell selected face');
  const shellInput = await window.webContents.executeJavaScript(`(() => {
    const body = window.__madcadVerifyEngineState.bodies[0];
    const face = body.topology.faces.filter((item) => item.descriptor.geometry === 'PLANE').sort((left, right) => right.descriptor.center[2] - left.descriptor.center[2])[0];
    return { selection: { kind: 'face', id: face.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId }, volume: body.metrics.volume };
  })()`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify(shellInput.selection)}, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'face'`, 'ściana wskazana do Shell');
  await clickTool('Shell');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Shell')`, 'polecenie Shell');
  await setCommandField('Grubość', '1');
  const shellRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `document.querySelectorAll('.timeline-item').length === 6`, 'dodany Shell');
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${shellRevision} && document.querySelector('.engine-status')?.classList.contains('ready') && !document.querySelector('.timeline-item.error')`, 'przeliczony Shell', modelingTimeoutMs);
  const shellVolume = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`);
  if (!(shellVolume > 0 && shellVolume < shellInput.volume)) throw new Error(`Shell powinien zmniejszyć objętość: ${shellInput.volume} -> ${shellVolume}`);
  await waitForUi(window, `(() => { try { const saved = JSON.parse(window.localStorage.getItem('madcad:modeling-document:v4') || 'null'); return saved?.features?.length === 6 && saved.features[5]?.type === 'shell' && saved.features[5]?.referenceIds?.length === 1; } catch (_error) { return false; } })()`, 'Shell zapisany automatycznie', 5000);
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.length === 5 && document.querySelectorAll('.timeline-item').length === 5`, 'cofnięcie Shell przed kontrolą eksportu');

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
        return saved?.schemaVersion === 4 && saved?.features?.length === 5 && saved?.sketches?.length === 4 && saved?.references?.some((item) => item.kind === 'construction-plane' && item.name === 'Płaszczyzna montażowa');
      } catch (_error) {
        return false;
      }
    })()`,
    'current autosave revision',
    5000,
  );
  const selectionFilters = await window.webContents.executeJavaScript(`(() => {
    const buttons = [...document.querySelectorAll('.selection-filter-bar button')];
    const vertex = buttons.find((button) => button.textContent === 'Wierzchołek');
    const automatic = buttons.find((button) => button.textContent === 'Auto');
    if (!vertex || !automatic || vertex.disabled) return { count: buttons.length, switched: false };
    const vertexKey = Object.keys(vertex).find((item) => item.startsWith('__reactProps'));
    vertex[vertexKey].onClick();
    const autoKey = Object.keys(automatic).find((item) => item.startsWith('__reactProps'));
    automatic[autoKey].onClick();
    return { count: buttons.length, switched: true };
  })()`);
  if (selectionFilters.count !== 6 || !selectionFilters.switched) throw new Error(`Niepełne filtry wyboru B-Rep: ${JSON.stringify(selectionFilters)}`);
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
      constructionPlanes: saved.references?.filter((item) => item.kind === 'construction-plane').length || 0,
      constructionAxes: saved.references?.filter((item) => item.kind === 'construction-axis').length || 0,
      constructionPoints: saved.references?.filter((item) => item.kind === 'construction-point').length || 0,
    };
  })()`);
  const autosaveRoundTrip = autosaveState.available
    && autosaveState.schemaVersion === 4
    && autosaveState.features === 5
    && autosaveState.sketches === 4
    && autosaveState.entities === 13
    && autosaveState.constructionPlanes === 3
    && autosaveState.constructionAxes === 4
    && autosaveState.constructionPoints === 3;
  if (!autosaveRoundTrip) throw new Error(`Desktop autosave did not preserve the current document: ${JSON.stringify(autosaveState)}`);

  const recoveryRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`(() => {
    if (typeof window.__madcadVerifyRestartWorker !== 'function') throw new Error('Missing worker recovery test hook.');
    window.__madcadVerifyRestartWorker();
  })()`);
  try {
    await waitForUi(
      window,
      `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.revision > ${recoveryRevision}`,
      'worker recovery',
      modelingTimeoutMs,
    );
  } catch (error) {
    const recoveryState = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState`);
    throw new Error(`${error.message}: ${JSON.stringify(recoveryState)}`);
  }
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
    sketchProfileFillSelection: true,
    linePolyline: true,
    enterEscapeTermination: true,
    sketchMultiSelection: true,
    crossingInsideSelection: true,
    sketchPointSegmentDrag: true,
    sketchDeleteUndoRedo: true,
    polylineModel,
    topologyProfiles: true,
    parametricBracket: true,
    directManipulation: true,
    pointerInput: 'pen',
    filletChamfer: true,
    constructionPlane: true,
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
    ? { desktopColdStartMs: 60000, desktopWorkflowMs: 150000, displayMeshPerBodyMs: 15000, displayEvaluationMs: 45000 }
    : { desktopColdStartMs: 30000, desktopWorkflowMs: 45000, displayMeshPerBodyMs: 5000, displayEvaluationMs: 15000 };
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
        vertices: bodies.reduce((total, body) => total + (body.topology?.vertices?.length || 0), 0),
        faceGroupsMapped: bodies.every((body) => (body.faceGroups || []).every((group) => Boolean(group.topologyId))),
        edgeGroupsMapped: bodies.every((body) => (body.edgeGroups || []).every((group) => Boolean(group.topologyId))),
      };
    })()`);
    if (!topologyMapping.revision || !topologyMapping.faces || !topologyMapping.edges || !topologyMapping.vertices || !topologyMapping.faceGroupsMapped || !topologyMapping.edgeGroupsMapped) {
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
    process.stdout.write('[verify] exporting STL, STEP and 3MF\n');
    const stl = await verifyExport(window, 'STL');
    const step = await verifyExport(window, 'STEP');
    const threeMf = await verifyThreeMfExport(window);
    const threeMfImport = await verifyThreeMfImport(window);
    const workerPerformance = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.performance || null`);
    if (!workerPerformance || workerPerformance.totalMs > performanceBudgets.displayEvaluationMs) {
      throw new Error(`Worker evaluation exceeded budget: ${JSON.stringify(workerPerformance)}.`);
    }
    const slowBody = workerPerformance.bodies?.find((body) => body.durationMs > performanceBudgets.displayMeshPerBodyMs);
    if (slowBody) throw new Error(`Body meshing exceeded budget: ${JSON.stringify(slowBody)}.`);
    performance.worker = workerPerformance;
    const report = { ...result, licenseBypass, screenshot: outputPath, narrowScreenshot: narrowOutputPath, narrowViewport, uiFlow, topologyMapping, exports: { stl, step, threeMf }, imports: { threeMf: threeMfImport }, performance, rendererMessages };
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
