const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-form.png');

async function waitFor(window, expression, label, timeoutMs = 60000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const diagnostic = await window.webContents.executeJavaScript(`JSON.stringify({
    engine: {
      status: window.__madcadVerifyEngineState?.status,
      revision: window.__madcadVerifyEngineState?.revision,
      form: window.__madcadVerifyEngineState?.bodies?.find((body) => body.form)?.form,
    },
    command: window.__madcadVerifyDocumentState?.command,
    cage: window.__madcadFormCageState && {
      selectedControlKind: window.__madcadFormCageState.selectedControlKind,
      selectedControlPoint: window.__madcadFormCageState.selectedControlPoint,
      selectedControlEdge: window.__madcadFormCageState.selectedControlEdge,
      selectedControlFace: window.__madcadFormCageState.selectedControlFace,
    },
    pointer: window.__madcadFormPointerDebug,
  })`);
  throw new Error(`Przekroczono czas oczekiwania: ${label}. ${diagnostic}`);
}

async function setField(window, label, value) {
  await window.webContents.executeJavaScript(`(() => {
    const field = [...document.querySelectorAll('.command-dialog .command-field')].find((item) => item.querySelector(':scope > span')?.textContent.trim() === ${JSON.stringify(label)});
    const input = field?.querySelector('input');
    if (!input) throw new Error('Brak pola: ${label}');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}

async function setSelect(window, label, value) {
  await window.webContents.executeJavaScript(`(() => {
    const field = [...document.querySelectorAll('.command-dialog .command-field')].find((item) => item.querySelector(':scope > span')?.textContent.trim() === ${JSON.stringify(label)});
    const select = field?.querySelector('select');
    if (!select) throw new Error('Brak listy: ${label}');
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(select, ${JSON.stringify(value)});
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-form-${Date.now()}` } });
  window.webContents.on('console-message', (event) => {
    const message = event?.message;
    if (/Gładka konwersja Form/.test(message || '')) console.log(`[form-worker] ${message}`);
  });
  window.setContentSize(1440, 837);
  let exitCode = 0;
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell') && window.__madcadVerifyLoadTimelineFixture`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 2`, 'model testowy');

    await window.webContents.executeJavaScript(`(() => {
      const trigger = [...document.querySelectorAll('.ribbon-tool-menu-trigger')].find((button) => button.textContent.trim() === 'Więcej brył');
      if (!trigger) throw new Error('Brak menu Więcej brył.');
      trigger.click();
    })()`);
    await waitFor(window, `[...document.querySelectorAll('.ribbon-tool-submenu button')].some((button) => button.querySelector('strong')?.textContent.trim() === 'Form' && !button.disabled)`, 'aktywne narzędzie Form');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.ribbon-tool-submenu button')].find((button) => button.querySelector('strong')?.textContent.trim() === 'Form' && !button.disabled).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'formBody' && document.querySelector('.command-dialog')?.textContent.includes('Poziom wygładzenia')`, 'panel Form');

    await setField(window, 'Szerokość klatki', '40');
    await setField(window, 'Głębokość klatki', '30');
    await setField(window, 'Wysokość klatki', '20');
    await setField(window, 'Poziom wygładzenia', '2');
    await setSelect(window, 'Symetria klatki', 'x');
    await setField(window, 'Przesunięcie punktu X', '8');
    await setField(window, 'Przesunięcie punktu Z', '5');
    await setField(window, 'Położenie X', '-25');
    await setField(window, 'Położenie Y', '35');
    await setField(window, 'Położenie Z', '12');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.find((body) => body.form?.subdivisions === 2)?.form?.brepMode === 'smooth-patches' && window.__madcadVerifyEngineState?.bodies?.find((body) => body.form)?.topology?.faces?.length <= 6 && window.__madcadFormCageState?.pointCount === 8 && window.__madcadFormCageState?.edgeCount === 12`, 'gładki podgląd Form B-Rep i klatki kontrolnej', 15000);
    await window.webContents.executeJavaScript(`(() => {
      const [clientX, clientY] = window.__madcadFormCageState.screenPoint(6);
      const canvas = document.querySelector('.model-viewport canvas');
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, clientX, clientY, pointerId: 41 }));
      canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX, clientY, pointerId: 41 }));
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const pointSelection = await window.webContents.executeJavaScript(`({ commandPoint: window.__madcadVerifyDocumentState?.command?.selectedControlPoint, cagePoint: window.__madcadFormCageState?.selectedControlPoint, pointer: window.__madcadFormPointerDebug })`);
    if (pointSelection.commandPoint !== 6 || pointSelection.cagePoint !== 6) throw new Error(`Nie udał się wybór punktu klatki bezpośrednio w widoku: ${JSON.stringify(pointSelection)}`);
    await window.webContents.executeJavaScript(`(() => {
      const [clientX, clientY] = window.__madcadFormCageState.screenPoint(6);
      const canvas = document.querySelector('.model-viewport canvas');
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, clientX, clientY, pointerId: 42 }));
      canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, button: 0, buttons: 1, clientX: clientX + 12, clientY: clientY - 6, pointerId: 42 }));
      canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: clientX + 12, clientY: clientY - 6, pointerId: 42 }));
    })()`);
    await waitFor(window, `(() => { const offsets = window.__madcadVerifyDocumentState?.command?.controlOffsets; return window.__madcadVerifyEngineState?.status === 'ready' && offsets?.[6]?.some((value) => Math.abs(Number(value)) >= 0.5) && Number(offsets[7][0]) === -Number(offsets[6][0]) && Number(offsets[7][1]) === Number(offsets[6][1]) && Number(offsets[7][2]) === Number(offsets[6][2]); })()`, 'przeciągnięcie punktu klatki z symetrią X');
    await setField(window, 'Przesunięcie punktu Y', '4');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.command?.controlOffsets?.[6]?.[1] === '4'`, 'deformacja drugiego punktu klatki');
    await window.webContents.executeJavaScript(`(() => {
      window.__madcadFormAxisBefore = window.__madcadVerifyDocumentState.command.controlOffsets[6].map(Number);
      window.__madcadFormAxisBeforeRevision = window.__madcadVerifyEngineState.revision;
      const axis = window.__madcadFormCageState.screenAxis(2);
      if (!axis) throw new Error('Brak manipulatora osi Z.');
      const [clientX, clientY] = axis.point;
      const [directionX, directionY] = axis.direction;
      const canvas = document.querySelector('.model-viewport canvas');
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, clientX, clientY, pointerId: 44 }));
      canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, button: 0, buttons: 1, clientX: clientX + directionX * 16, clientY: clientY + directionY * 16, pointerId: 44 }));
      canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: clientX + directionX * 16, clientY: clientY + directionY * 16, pointerId: 44 }));
    })()`);
    await waitFor(window, `(() => { const before = window.__madcadFormAxisBefore; const offsets = window.__madcadVerifyDocumentState?.command?.controlOffsets; return window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState.revision > window.__madcadFormAxisBeforeRevision && Number(offsets?.[6]?.[0]) === before[0] && Number(offsets?.[6]?.[1]) === before[1] && Number(offsets?.[6]?.[2]) !== before[2] && Number(offsets?.[7]?.[2]) === Number(offsets?.[6]?.[2]); })()`, 'przeciągnięcie punktu manipulatorem osi Z');
    await window.webContents.executeJavaScript(`(() => {
      const [clientX, clientY] = window.__madcadFormCageState.screenEdge(4);
      const canvas = document.querySelector('.model-viewport canvas');
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, clientX, clientY, pointerId: 43 }));
      canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX, clientY, pointerId: 43 }));
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.selectedControlKind === 'edge' && window.__madcadVerifyDocumentState?.command?.selectedControlEdge === 4 && window.__madcadFormCageState?.selectedControlKind === 'edge' && window.__madcadFormCageState?.selectedControlEdge === 4`, 'wybór krawędzi klatki bezpośrednio w widoku');
    await window.webContents.executeJavaScript(`(() => {
      window.__madcadFormEdgeBefore = window.__madcadVerifyDocumentState.command.controlOffsets.map((point) => point.map(Number));
      window.__madcadFormEdgeBeforeRevision = window.__madcadVerifyEngineState.revision;
      const axis = window.__madcadFormCageState.screenAxis(1);
      if (!axis) throw new Error('Brak manipulatora wybranej krawędzi.');
      const [clientX, clientY] = axis.point;
      const [directionX, directionY] = axis.direction;
      const canvas = document.querySelector('.model-viewport canvas');
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, clientX, clientY, pointerId: 45 }));
      canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, button: 0, buttons: 1, clientX: clientX + directionX * 14, clientY: clientY + directionY * 14, pointerId: 45 }));
      canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: clientX + directionX * 14, clientY: clientY + directionY * 14, pointerId: 45 }));
    })()`);
    await waitFor(window, `(() => { const before = window.__madcadFormEdgeBefore; const offsets = window.__madcadVerifyDocumentState?.command?.controlOffsets?.map((point) => point.map(Number)); const firstDelta = offsets?.[4]?.[1] - before[4][1]; const secondDelta = offsets?.[5]?.[1] - before[5][1]; return window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState.revision > window.__madcadFormEdgeBeforeRevision && Math.abs(firstDelta) >= 0.5 && firstDelta === secondDelta && offsets[4][0] === before[4][0] && offsets[4][2] === before[4][2] && offsets[0][1] === before[0][1]; })()`, 'przesunięcie obu końców wybranej krawędzi po osi Y');
    await setSelect(window, 'Charakter krawędzi', 'crease');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.command?.creaseEdges?.includes(4) && window.__madcadFormCageState?.creaseEdges?.includes(4) && window.__madcadVerifyEngineState?.bodies?.some((body) => body.form?.creaseEdges?.includes(4))`, 'ostra krawędź Crease w podglądzie Form');
    await window.webContents.executeJavaScript(`(() => {
      const [clientX, clientY] = window.__madcadFormCageState.screenFace(1);
      const canvas = document.querySelector('.model-viewport canvas');
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, clientX, clientY, pointerId: 46 }));
      canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX, clientY, pointerId: 46 }));
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.selectedControlKind === 'face' && window.__madcadVerifyDocumentState?.command?.selectedControlFace === 1 && window.__madcadFormCageState?.selectedControlKind === 'face'`, 'wybór ściany klatki bezpośrednio w widoku');
    await window.webContents.executeJavaScript(`(() => {
      window.__madcadFormFaceBefore = window.__madcadVerifyDocumentState.command.controlOffsets.map((point) => point.map(Number));
      window.__madcadFormFaceBeforeRevision = window.__madcadVerifyEngineState.revision;
      const axis = window.__madcadFormCageState.screenAxis(1);
      const [clientX, clientY] = axis.point;
      const [directionX, directionY] = axis.direction;
      const canvas = document.querySelector('.model-viewport canvas');
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, clientX, clientY, pointerId: 47 }));
      canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, button: 0, buttons: 1, clientX: clientX + directionX * 14, clientY: clientY + directionY * 14, pointerId: 47 }));
      canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: clientX + directionX * 14, clientY: clientY + directionY * 14, pointerId: 47 }));
    })()`);
    await waitFor(window, `(() => { const before = window.__madcadFormFaceBefore; const offsets = window.__madcadVerifyDocumentState?.command?.controlOffsets?.map((point) => point.map(Number)); const delta = offsets?.[4]?.[1] - before[4][1]; return window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState.revision > window.__madcadFormFaceBeforeRevision && Math.abs(delta) >= 0.5 && [4,5,6,7].every((index) => offsets[index][1] - before[index][1] === delta) && [0,1,2,3].every((index) => offsets[index][1] === before[index][1]); })()`, 'przesunięcie czterech punktów wybranej ściany po osi Y');
    await setSelect(window, 'Tryb edycji', 'edge');
    await setSelect(window, 'Insert Edge', 'enabled');
    await setField(window, 'Położenie pętli', '0.5');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.command?.insertEdgeEnabled === true && window.__madcadVerifyEngineState?.bodies?.find((body) => body.form)?.form?.controlVertexCount === 12 && window.__madcadVerifyEngineState?.bodies?.find((body) => body.form)?.form?.controlFaceCount === 10 && window.__madcadVerifyEngineState?.bodies?.find((body) => body.form)?.form?.brepMode === 'smooth-patches' && window.__madcadVerifyEngineState?.bodies?.find((body) => body.form)?.form?.brepPatchCount === 10 && window.__madcadFormCageState?.pointCount === 12 && window.__madcadFormCageState?.edgeCount === 20`, 'gładki podgląd pętli Insert Edge');
    await window.webContents.executeJavaScript(`(() => {
      const [clientX, clientY] = window.__madcadFormCageState.screenPoint(8);
      const canvas = document.querySelector('.model-viewport canvas');
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, clientX, clientY, pointerId: 48 }));
      canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX, clientY, pointerId: 48 }));
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.selectedControlKind === 'point' && window.__madcadVerifyDocumentState?.command?.selectedControlPoint === 8 && window.__madcadFormCageState?.selectedControlPoint === 8`, 'wybór nowego punktu Insert Edge');
    await window.webContents.executeJavaScript(`(() => {
      window.__madcadFormInsertedPointBeforeRevision = window.__madcadVerifyEngineState.revision;
      const axis = window.__madcadFormCageState.screenAxis(1);
      const [clientX, clientY] = axis.point;
      const [directionX, directionY] = axis.direction;
      const canvas = document.querySelector('.model-viewport canvas');
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, clientX, clientY, pointerId: 49 }));
      canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, button: 0, buttons: 1, clientX: clientX + directionX * 14, clientY: clientY + directionY * 14, pointerId: 49 }));
      canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: clientX + directionX * 14, clientY: clientY + directionY * 14, pointerId: 49 }));
    })()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState.revision > window.__madcadFormInsertedPointBeforeRevision && Math.abs(Number(window.__madcadVerifyDocumentState?.command?.insertEdgeOffsets?.[0]?.[1])) >= 0.5`, 'przesunięcie nowego punktu Insert Edge');
    await setSelect(window, 'Tryb edycji', 'face');
    await setSelect(window, 'Bridge', 'enabled');
    await setField(window, 'Wielkość otworu', '0.5');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.command?.bridgeEnabled === true && window.__madcadVerifyDocumentState?.command?.bridgeFirstFace === 6 && window.__madcadVerifyDocumentState?.command?.bridgeSecondFace === 9 && window.__madcadVerifyEngineState?.bodies?.find((body) => body.form)?.form?.controlVertexCount === 20 && window.__madcadVerifyEngineState?.bodies?.find((body) => body.form)?.form?.controlFaceCount === 20 && window.__madcadVerifyEngineState?.bodies?.find((body) => body.form)?.form?.brepMode === 'smooth-patches' && window.__madcadVerifyEngineState?.bodies?.find((body) => body.form)?.form?.brepPatchCount === 20 && window.__madcadFormCageState?.pointCount === 20 && window.__madcadFormCageState?.edgeCount === 40`, 'gładki podgląd tunelu Bridge zgodnego z symetrią');
    await window.webContents.executeJavaScript(`(() => {
      const [clientX, clientY] = window.__madcadFormCageState.screenPoint(12);
      const canvas = document.querySelector('.model-viewport canvas');
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, clientX, clientY, pointerId: 50 }));
      canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX, clientY, pointerId: 50 }));
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.selectedControlKind === 'point' && window.__madcadVerifyDocumentState?.command?.selectedControlPoint === 12`, 'wybór punktu utworzonego przez Bridge');
    await setField(window, 'Przesunięcie punktu Z', '1.5');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.command?.bridgeOffsets?.[0]?.[2] === '1.5' && window.__madcadVerifyDocumentState?.command?.bridgeOffsets?.[5]?.[2] === '1.5'`, 'edycja punktu Bridge z symetrią X');
    await setSelect(window, 'Tryb edycji', 'face');
    await setSelect(window, 'Fill Hole', 'enabled');
    await setSelect(window, 'Granica do zamknięcia', '0');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.command?.fillHoleEnabled === true && window.__madcadVerifyDocumentState?.command?.fillHoleFace === 0 && window.__madcadVerifyDocumentState?.command?.fillHoleOffsets?.length === 2 && window.__madcadVerifyEngineState?.bodies?.find((body) => body.form)?.form?.controlVertexCount === 22 && window.__madcadVerifyEngineState?.bodies?.find((body) => body.form)?.form?.controlFaceCount === 26 && window.__madcadVerifyEngineState?.bodies?.find((body) => body.form)?.form?.brepMode === 'smooth-patches' && window.__madcadVerifyEngineState?.bodies?.find((body) => body.form)?.form?.brepPatchCount === 20 && window.__madcadFormCageState?.pointCount === 22 && window.__madcadFormCageState?.edgeCount === 48`, 'gładki podgląd Fill Hole na parze symetrycznych granic');
    await window.webContents.executeJavaScript(`(() => {
      const [clientX, clientY] = window.__madcadFormCageState.screenPoint(20);
      const canvas = document.querySelector('.model-viewport canvas');
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, clientX, clientY, pointerId: 51 }));
      canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX, clientY, pointerId: 51 }));
    })()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.selectedControlKind === 'point' && window.__madcadVerifyDocumentState?.command?.selectedControlPoint === 20`, 'wybór środka Fill Hole');
    await setField(window, 'Przesunięcie punktu Z', '2');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.command?.fillHoleOffsets?.[0]?.[2] === '2' && window.__madcadVerifyDocumentState?.command?.fillHoleOffsets?.[1]?.[2] === '2'`, 'edycja środka Fill Hole z symetrią X');
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());

    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.at(-1)?.type === 'formBody' && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.some((body) => body.form?.surfaceFaceCount === 384 && body.form?.brepMode === 'smooth-patches' && body.form?.brepPatchCount === 20)`, 'zapisany gładki Form z Bridge i Fill Hole');
    const result = await window.webContents.executeJavaScript(`(() => {
      const body = window.__madcadVerifyEngineState.bodies.find((item) => item.form);
      return {
        bodyCount: window.__madcadVerifyEngineState.bodies.length,
        representation: body.representation,
        bodyKind: body.bodyKind,
        metrics: body.metrics,
        topologyFaces: body.topology.faces.length,
        surfaceTypes: [...new Set(body.topology.faces.map((face) => face.descriptor.geometry))],
        form: body.form,
        dialogClosed: !document.querySelector('.command-dialog'),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    const dimensions = result.metrics.dimensions;
    if (result.bodyCount !== 3 || result.representation !== 'brep' || result.bodyKind !== 'solid' || result.topologyFaces !== 20 || result.surfaceTypes.join(',') !== 'BSPLINE_SURFACE' || result.form.brepMode !== 'smooth-patches' || result.form.brepPatchCount !== 20 || result.form.controlVertexCount !== 22 || result.form.controlFaceCount !== 26 || result.form.controlVertices.length !== 66 || result.form.controlFaces.length !== 26 || result.form.surfaceFaceCount !== 384 || result.form.subdivisions !== 2 || result.form.symmetry !== 'x' || result.form.creaseEdges.length !== 2 || result.form.insertEdge?.edgeIndex !== 4 || result.form.bridge?.firstFaceIndex !== 6 || result.form.bridge?.secondFaceIndex !== 9 || result.form.bridge?.inset !== 0.5 || result.form.fillHole?.faceIndexes?.join(',') !== '0,1' || result.metrics.volume <= 0 || Math.abs(dimensions[0] - 40) > 2 || Math.abs(dimensions[1] - 30) > 2 || Math.abs(dimensions[2] - 20) > 2 || !result.dialogClosed || result.horizontalOverflow) {
      throw new Error(`Niepoprawny wynik Form: ${JSON.stringify(result)}`);
    }

    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && !window.__madcadVerifyEngineState?.bodies?.some((body) => body.form)`, 'cofnięty Form');
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.some((body) => body.form?.subdivisions === 2 && body.form?.insertEdge?.edgeIndex === 4 && body.form?.bridge?.firstFaceIndex === 6 && body.form?.fillHole?.faceIndexes?.length === 2 && body.form?.controlVertexCount === 22 && body.form?.brepMode === 'smooth-patches' && body.form?.brepPatchCount === 20)`, 'ponowiony gładki Form z Bridge i Fill Hole');
    await window.webContents.executeJavaScript(`window.__madcadVerifyReopenCurrentDocument()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.featureData?.at(-1)?.type === 'formBody' && window.__madcadVerifyDocumentState?.featureData?.at(-1)?.creaseEdges?.includes(4) && window.__madcadVerifyDocumentState?.featureData?.at(-1)?.insertEdgeEnabled === true && window.__madcadVerifyDocumentState?.featureData?.at(-1)?.bridgeEnabled === true && window.__madcadVerifyDocumentState?.featureData?.at(-1)?.bridgeOffsets?.[0]?.[2] === '1.5' && window.__madcadVerifyDocumentState?.featureData?.at(-1)?.fillHoleEnabled === true && window.__madcadVerifyDocumentState?.featureData?.at(-1)?.fillHoleOffsets?.[0]?.[2] === '2' && window.__madcadVerifyEngineState?.bodies?.some((body) => body.form?.surfaceFaceCount === 384 && body.form?.insertEdge?.edgeIndex === 4 && body.form?.bridge?.firstFaceIndex === 6 && body.form?.fillHole?.faceIndexes?.length === 2 && body.form?.brepMode === 'smooth-patches' && body.form?.brepPatchCount === 20)`, 'gładki Form z Bridge i Fill Hole po ponownym otwarciu projektu');

    process.stdout.write(`${JSON.stringify({ screenshotPath, result }, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
