const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const artifactPath = path.join(__dirname, '..', 'artifacts', 'sketch-3d-pipe.png');
const handleArtifactPath = path.join(__dirname, '..', 'artifacts', 'sketch-3d-handles.png');

async function waitFor(window, expression, label, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  const diagnostic = await window.webContents.executeJavaScript(`JSON.stringify({ document: window.__madcadVerifyDocumentState, engine: window.__madcadVerifyEngineState })`);
  throw new Error(`Nie osiągnięto stanu: ${label}. ${diagnostic}`);
}

async function clickTool(window, label) {
  const result = await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.ribbon-tool')].find((item) => item.querySelector('.ribbon-label')?.textContent.trim() === ${JSON.stringify(label)});
    if (!button) return { found: false };
    if (button.disabled) return { found: true, disabled: true };
    button.click();
    return { found: true, disabled: false };
  })()`);
  if (!result.found || result.disabled) throw new Error(`Niedostępne narzędzie: ${label}. ${JSON.stringify(result)}`);
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
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: { partition: `madcad-sketch-3d-${Date.now()}` },
  });
  window.webContents.on('console-message', (_event, details) => {
    if (details.level === 'error') console.error(`Renderer: ${details.message}`);
  });
  let exitCode = 0;
  try {
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && document.querySelector('.modeling-shell')`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button[aria-label="Zamknij"]')?.click()`);

    console.log('Etap: uruchomienie szkicu 3D');
    await clickTool(window, 'Szkic 3D');
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'sketch3d' && window.__madcadVerifyDocumentState?.sketches?.[0]?.space === '3d'`, 'aktywny szkic 3D');
    console.log('Etap: pierwszy odcinek');
    await setField(window, 'Koniec X', '30');
    await setField(window, 'Koniec Y', '0');
    await setField(window, 'Koniec Z', '0');
    await clickTool(window, 'Dodaj krzywą');
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 3 && window.__madcadVerifyDocumentState?.command?.segments === 1`, 'pierwszy odcinek XYZ');

    console.log('Etap: drugi odcinek');
    await setField(window, 'Koniec X', '50');
    await setField(window, 'Koniec Y', '0');
    await setField(window, 'Koniec Z', '0');
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 5 && window.__madcadVerifyDocumentState?.command?.segments === 2`, 'drugi odcinek przestrzenny');
    await clickTool(window, 'Cofnij krzywą');
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 3 && window.__madcadVerifyDocumentState?.command?.segments === 1`, 'cofnięty drugi odcinek');
    await setField(window, 'Koniec X', '50');
    await setField(window, 'Koniec Y', '0');
    await setField(window, 'Koniec Z', '0');
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 5 && window.__madcadVerifyDocumentState?.command?.segments === 2`, 'ponownie dodany drugi odcinek');

    console.log('Etap: łuk przez trzy punkty');
    await setSelect(window, 'Typ krzywej', 'arc');
    await setField(window, 'Punkt łuku X', '57.071067812');
    await setField(window, 'Punkt łuku Y', '2.928932188');
    await setField(window, 'Punkt łuku Z', '0');
    await setField(window, 'Koniec X', '60');
    await setField(window, 'Koniec Y', '10');
    await setField(window, 'Koniec Z', '0');
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 7 && window.__madcadVerifyDocumentState?.command?.segments === 3`, 'łuk przestrzenny');

    console.log('Etap: spline Béziera');
    await setSelect(window, 'Typ krzywej', 'spline');
    await setSelect(window, 'Ciągłość początku', 'g2');
    await setField(window, 'Długość uchwytu', '5');
    await setField(window, 'Koniec X', '75');
    await setField(window, 'Koniec Y', '25');
    await setField(window, 'Koniec Z', '10');
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 9 && window.__madcadVerifyDocumentState?.command?.segments === 4`, 'spline przestrzenny');

    const sketch = await window.webContents.executeJavaScript(`structuredClone(window.__madcadVerifyDocumentState.sketches[0])`);
    const points = sketch.entityData.filter((entity) => entity.type === 'point').map((entity) => [Number(entity.geometry.x), Number(entity.geometry.y), Number(entity.geometry.z)]);
    if (JSON.stringify(points) !== JSON.stringify([[0, 0, 0], [30, 0, 0], [50, 0, 0], [60, 10, 0], [75, 25, 10]])) throw new Error(`Błędne punkty szkicu 3D: ${JSON.stringify(points)}`);
    const curveTypes = sketch.entityData.filter((entity) => entity.type !== 'point').map((entity) => entity.type);
    if (JSON.stringify(curveTypes) !== JSON.stringify(['line', 'line', 'arc3d', 'spline3d'])) throw new Error(`Błędne krzywe szkicu 3D: ${JSON.stringify(curveTypes)}`);
    const spline = sketch.entityData.find((entity) => entity.type === 'spline3d');
    const splineContinuity = {
      continuity: spline.geometry.continuity,
      handleLength: Number(spline.geometry.handleLength),
      control1: ['X', 'Y', 'Z'].map((axis) => Number(spline.geometry[`control1${axis}`])),
      control2: ['X', 'Y', 'Z'].map((axis) => Number(spline.geometry[`control2${axis}`])),
    };
    const near = (actual, expected) => actual.length === expected.length && actual.every((value, index) => Math.abs(value - expected[index]) < 1e-7);
    if (splineContinuity.continuity !== 'g2' || splineContinuity.handleLength !== 5 || !near(splineContinuity.control1, [60, 15, 0]) || !near(splineContinuity.control2, [56.25, 20, 0])) throw new Error(`Błędna ciągłość G2 spline: ${JSON.stringify(splineContinuity)}`);

    console.log('Etap: edycja istniejącego spline 3D');
    await window.webContents.executeJavaScript(`window.__madcadVerifySketchSelection([${JSON.stringify(spline.id)}], 'replace')`);
    await waitFor(window, `window.__madcadSketch3DHandleState?.length === 4 && window.__madcadSketch3DHandleState.some((handle) => handle.kind === 'control2' && handle.locked)`, 'uchwyty bezpośrednie spline G2 w widoku');
    await fs.mkdir(path.dirname(handleArtifactPath), { recursive: true });
    await fs.writeFile(handleArtifactPath, (await window.webContents.capturePage()).toPNG());
    const endHandle = await window.webContents.executeJavaScript(`window.__madcadSketch3DHandleState.find((handle) => handle.kind === 'end')`);
    window.webContents.sendInputEvent({ type: 'mouseMove', x: endHandle.x, y: endHandle.y });
    window.webContents.sendInputEvent({ type: 'mouseDown', x: endHandle.x, y: endHandle.y, button: 'left', clickCount: 1 });
    window.webContents.sendInputEvent({ type: 'mouseMove', x: endHandle.x + 30, y: endHandle.y - 20, button: 'left' });
    window.webContents.sendInputEvent({ type: 'mouseUp', x: endHandle.x + 30, y: endHandle.y - 20, button: 'left', clickCount: 1 });
    await waitFor(window, `(() => {
      const point = window.__madcadVerifyDocumentState?.sketches?.[0]?.entityData?.find((entity) => entity.id === ${JSON.stringify(spline.pointIds[1])});
      return point && ['x', 'y', 'z'].some((axis, index) => Math.abs(Number(point.geometry[axis]) - [75, 25, 10][index]) > 0.01);
    })()`, 'przeciągnięcie końca spline myszą');
    await window.webContents.executeJavaScript(`new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    const cancelState = await window.webContents.executeJavaScript(`({
      handle: window.__madcadSketch3DHandleState.find((handle) => handle.kind === 'end'),
      geometry: window.__madcadVerifyDocumentState.sketches[0].entityData.find((entity) => entity.id === ${JSON.stringify(spline.pointIds[1])}).geometry,
    })`);
    window.webContents.sendInputEvent({ type: 'mouseDown', x: cancelState.handle.x, y: cancelState.handle.y, button: 'left', clickCount: 1 });
    window.webContents.sendInputEvent({ type: 'mouseMove', x: cancelState.handle.x + 25, y: cancelState.handle.y - 15, button: 'left' });
    await window.webContents.executeJavaScript(`document.querySelector('.model-viewport canvas').dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', clientX: ${cancelState.handle.x + 25}, clientY: ${cancelState.handle.y - 15}, bubbles: true }))`);
    window.webContents.sendInputEvent({ type: 'mouseUp', x: cancelState.handle.x + 25, y: cancelState.handle.y - 15, button: 'left', clickCount: 1 });
    await window.webContents.executeJavaScript(`new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    const cancelledGeometry = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.sketches[0].entityData.find((entity) => entity.id === ${JSON.stringify(spline.pointIds[1])}).geometry`);
    if (JSON.stringify(cancelledGeometry) !== JSON.stringify(cancelState.geometry)) throw new Error('Przerwanie przeciągania zapisało zmianę szkicu.');
    await window.webContents.executeJavaScript(`window.__madcadVerifyMoveSketch3DHandle({ curveId: ${JSON.stringify(spline.id)}, kind: 'end', pointId: ${JSON.stringify(spline.pointIds[1])}, coordinates: [74, 25, 10], handleLength: null })`);
    await waitFor(window, `(() => { const sketch = window.__madcadVerifyDocumentState?.sketches?.[0]; const curve = sketch?.entityData?.find((entity) => entity.id === ${JSON.stringify(spline.id)}); const end = sketch?.entityData?.find((entity) => entity.id === curve?.pointIds?.[1]); return Number(end?.geometry?.x) === 74 && Number(end?.geometry?.y) === 25 && Number(end?.geometry?.z) === 10; })()`, 'bezpośrednie przesunięcie końca spline 3D');
    await clickTool(window, 'Edytuj krzywą');
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'editSketch3d' && document.querySelector('.command-dialog')?.textContent.includes('Edytuj krzywą 3D')`, 'panel edycji spline 3D');
    await setField(window, 'Długość uchwytu', '6');
    await setField(window, 'Koniec X', '78');
    await setField(window, 'Koniec Y', '27');
    await setField(window, 'Koniec Z', '12');
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'sketch3d' && window.__madcadVerifyDocumentState?.selection?.ids?.length === 4`, 'powrót do aktywnej ścieżki po edycji');
    const editedSpline = await window.webContents.executeJavaScript(`(() => {
      const sketch = window.__madcadVerifyDocumentState.sketches[0];
      const spline = sketch.entityData.find((entity) => entity.id === ${JSON.stringify(spline.id)});
      const end = sketch.entityData.find((entity) => entity.id === spline.pointIds[1]);
      return {
        continuity: spline.geometry.continuity,
        handleLength: Number(spline.geometry.handleLength),
        control1: ['X', 'Y', 'Z'].map((axis) => Number(spline.geometry['control1' + axis])),
        control2: ['X', 'Y', 'Z'].map((axis) => Number(spline.geometry['control2' + axis])),
        end: ['x', 'y', 'z'].map((axis) => Number(end.geometry[axis])),
      };
    })()`);
    if (editedSpline.continuity !== 'g2' || editedSpline.handleLength !== 6 || !near(editedSpline.control1, [60, 16, 0]) || !near(editedSpline.control2, [54.6, 22, 0]) || !near(editedSpline.end, [78, 27, 12])) throw new Error(`Błędna edycja spline 3D: ${JSON.stringify(editedSpline)}`);

    console.log('Etap: Pipe');
    await clickTool(window, 'Rura');
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'pipe' && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 1`, 'podgląd Pipe po ścieżce 3D', 45000);
    await setField(window, 'Średnica zewnętrzna', '6');
    await setField(window, 'Grubość ścianki', '1');
    const parameterRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.revision > ${parameterRevision} && window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume > 0`, 'przeliczony Pipe 3D', 45000);
    const previewRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.type === 'pipe' && !window.__madcadVerifyDocumentState?.command && !document.querySelector('.command-dialog') && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.revision > ${previewRevision}`, 'zapisany Pipe 3D', 45000);

    await fs.mkdir(path.dirname(artifactPath), { recursive: true });
    await fs.writeFile(artifactPath, (await window.webContents.capturePage()).toPNG());
    const curvedTopologyAudit = await window.webContents.executeJavaScript(`(() => {
      const descriptors = window.__madcadVerifyEngineState.bodies[0].topology.edges.map((edge) => edge.descriptor).filter((descriptor) => descriptor.geometry !== 'LINE' && !descriptor.closed);
      return {
        count: descriptors.length,
        types: Object.fromEntries([...new Set(descriptors.map((descriptor) => descriptor.geometry))].map((type) => [type, descriptors.filter((descriptor) => descriptor.geometry === type).length])),
        everyMidpoint: descriptors.every((descriptor) => Array.isArray(descriptor.midpoint) && descriptor.midpoint.length === 3),
      };
    })()`);
    if (!curvedTopologyAudit.count || !curvedTopologyAudit.everyMidpoint) throw new Error(`Krzywoliniowa topologia nie zachowała punktów pośrednich: ${JSON.stringify(curvedTopologyAudit)}`);
    const surfaceProjection = await window.webContents.executeJavaScript(`(async () => {
      const body = window.__madcadVerifyEngineState.bodies[0];
      const face = body.topology.faces.find((item) => !['PLANE', 'UNKNOWN_FACE'].includes(item.descriptor.geometry));
      if (!face) throw new Error('Brak zakrzywionej ściany do Project to Surface.');
      const center = face.descriptor.center;
      const normal = face.descriptor.normal;
      const base = Math.abs(normal[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
      const tangent = [normal[1] * base[2] - normal[2] * base[1], normal[2] * base[0] - normal[0] * base[2], normal[0] * base[1] - normal[1] * base[0]];
      const tangentLength = Math.hypot(...tangent);
      const points = [-1, -0.5, 0, 0.5, 1].map((position) => center.map((value, index) => value + normal[index] * (2 + position * position) + tangent[index] / tangentLength * position));
      const descriptor = await window.__madcadVerifyProjectPointsToSurface({ bodyId: body.id, faceId: face.id, points });
      return { faceId: face.id, descriptor };
    })()`);
    if (surfaceProjection.descriptor.geometry !== 'BSPLINE_CURVE' || !surfaceProjection.descriptor.bspline || surfaceProjection.descriptor.samples.length !== 25 || JSON.stringify(surfaceProjection.descriptor.surfaceFaceIds) !== JSON.stringify([surfaceProjection.faceId])) throw new Error(`Błędny Project to Surface: ${JSON.stringify(surfaceProjection)}`);
    const beforeReopen = await window.webContents.executeJavaScript(`({
      volume: window.__madcadVerifyEngineState.bodies[0].metrics.volume,
      dimensions: window.__madcadVerifyEngineState.bodies[0].metrics.dimensions,
      representation: window.__madcadVerifyEngineState.bodies[0].representation,
      pathSpace: window.__madcadVerifyDocumentState.sketches[0].space,
      pathEntityIds: window.__madcadVerifyDocumentState.featureData[0].pathEntityIds,
    })`);
    if (beforeReopen.representation !== 'brep' || beforeReopen.pathSpace !== '3d' || beforeReopen.pathEntityIds.length !== 4 || beforeReopen.volume <= 0) throw new Error(`Błędny Pipe 3D: ${JSON.stringify(beforeReopen)}`);

    await window.webContents.executeJavaScript(`window.__madcadVerifyReopenCurrentDocument()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.space === '3d' && window.__madcadVerifyDocumentState?.featureData?.[0]?.type === 'pipe' && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 1`, 'Pipe 3D po ponownym otwarciu', 45000);
    const afterReopen = await window.webContents.executeJavaScript(`({ volume: window.__madcadVerifyEngineState.bodies[0].metrics.volume, dimensions: window.__madcadVerifyEngineState.bodies[0].metrics.dimensions })`);
    if (Math.abs(afterReopen.volume - beforeReopen.volume) > 0.001 || JSON.stringify(afterReopen.dimensions) !== JSON.stringify(beforeReopen.dimensions)) throw new Error(`Pipe 3D zmienił się po otwarciu: ${JSON.stringify({ beforeReopen, afterReopen })}`);

    console.log('Etap: skojarzona ścieżka 3D z krawędzi modelu');
    await clickTool(window, 'Szkic 3D');
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'sketch3d' && window.__madcadVerifyDocumentState?.activeSketchId`, 'drugi tryb szkicu 3D');
    await clickTool(window, 'Pobierz krawędzie');
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'projectSketch' && document.querySelector('.command-dialog button.confirm')?.textContent.includes('Pobierz')`, 'wybór skojarzonej krawędzi 3D');
    const associatedSource = await window.webContents.executeJavaScript(`(() => {
      const body = window.__madcadVerifyEngineState.bodies[0];
      const edge = body?.topology?.edges?.find((candidate) => candidate.descriptor?.geometry === 'LINE' && !candidate.descriptor?.closed);
      if (!body || !edge) throw new Error('Brak prostej krawędzi Pipe do testu skojarzenia.');
      window.__madcadVerifyTopologySelection({ kind: 'edge', id: edge.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId }, 'replace');
      return { edgeId: edge.id, bodyId: body.id, endpoints: edge.descriptor.endpoints };
    })()`);
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'sketch3d' && window.__madcadVerifyDocumentState?.sketches?.[1]?.entities === 3 && window.__madcadVerifyDocumentState?.sketches?.[1]?.entityData?.some((entity) => entity.type === 'line' && entity.role === 'projected')`, 'skojarzona linia ścieżki 3D');
    await clickTool(window, 'Pobierz krawędzie');
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'projectSketch'`, 'ponowny wybór skojarzonego łuku 3D');
    const associatedArcSource = await window.webContents.executeJavaScript(`(() => {
      const body = window.__madcadVerifyEngineState.bodies[0];
      const edge = body?.topology?.edges?.find((candidate) => candidate.descriptor?.geometry === 'CIRCLE' && !candidate.descriptor?.closed);
      if (!body || !edge || !Array.isArray(edge.descriptor.midpoint)) throw new Error('Brak otwartego łuku kołowego Pipe do testu skojarzenia.');
      window.__madcadVerifyTopologySelection({ kind: 'edge', id: edge.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId }, 'replace');
      return { edgeId: edge.id, endpoints: edge.descriptor.endpoints, midpoint: edge.descriptor.midpoint };
    })()`);
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'sketch3d' && window.__madcadVerifyDocumentState?.sketches?.[1]?.entityData?.some((entity) => entity.type === 'arc3d' && entity.role === 'projected')`, 'skojarzony łuk kołowy ścieżki 3D');
    const associatedPath = await window.webContents.executeJavaScript(`(() => {
      const sketch = window.__madcadVerifyDocumentState.sketches[1];
      const line = sketch.entityData.find((entity) => entity.type === 'line' && entity.role === 'projected');
      const arc = sketch.entityData.find((entity) => entity.type === 'arc3d' && entity.role === 'projected');
      const points = line.pointIds.map((pointId) => {
        const point = sketch.entityData.find((entity) => entity.id === pointId);
        return ['x', 'y', 'z'].map((axis) => Number(point.geometry[axis]));
      });
      const arcPoints = arc.pointIds.map((pointId) => {
        const point = sketch.entityData.find((entity) => entity.id === pointId);
        return ['x', 'y', 'z'].map((axis) => Number(point.geometry[axis]));
      });
      const arcThrough = ['X', 'Y', 'Z'].map((axis) => Number(arc.geometry['through' + axis]));
      const pipeButton = [...document.querySelectorAll('.ribbon-tool')].find((item) => item.querySelector('.ribbon-label')?.textContent.trim() === 'Rura');
      return { lineId: line.id, referenceId: line.projectionReferenceId, points, arcId: arc.id, arcReferenceId: arc.projectionReferenceId, arcPoints, arcThrough, pipeEnabled: !pipeButton?.disabled };
    })()`);
    if (!associatedPath.referenceId || !associatedPath.arcReferenceId || !associatedPath.pipeEnabled || !near(associatedPath.points.flat(), associatedSource.endpoints.flat()) || !near(associatedPath.arcPoints.flat(), associatedArcSource.endpoints.flat()) || !near(associatedPath.arcThrough, associatedArcSource.midpoint)) throw new Error(`Błędna skojarzona ścieżka 3D: ${JSON.stringify({ associatedSource, associatedArcSource, associatedPath })}`);
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
    await waitFor(window, `!window.__madcadVerifyDocumentState?.command && !window.__madcadVerifyDocumentState?.activeSketchId && window.__madcadVerifyDocumentState?.sketches?.length === 2`, 'bezpieczne zakończenie skojarzonego szkicu 3D przez Esc');

    console.log('Etap: dokładna B-spline z modelu i Pipe');
    await clickTool(window, 'Szkic 3D');
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'sketch3d'`, 'trzeci szkic 3D');
    await clickTool(window, 'Pobierz krawędzie');
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'projectSketch'`, 'pobieranie B-spline');
    const bsplineSource = await window.webContents.executeJavaScript(`(() => {
      const body = window.__madcadVerifyEngineState.bodies[0];
      const edge = body.topology.edges.filter((item) => item.descriptor?.bspline).sort((a, b) => b.descriptor.length - a.descriptor.length)[0];
      if (!edge) throw new Error('Brak B-spline do testu.');
      window.__madcadVerifyTopologySelection({ kind: 'edge', id: edge.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId }, 'replace');
      return { bspline: edge.descriptor.bspline, surfaceFaceIds: edge.descriptor.surfaceFaceIds };
    })()`);
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[2]?.entityData?.some((entity) => entity.type === 'bspline3d')`, 'skojarzona B-spline');
    const projectedSpline = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.sketches[2].entityData.find((entity) => entity.type === 'bspline3d')`);
    if (JSON.stringify(projectedSpline.geometry.bspline) !== JSON.stringify(bsplineSource.bspline)) throw new Error('Projekcja zmieniła dokładne dane B-spline.');
    if (!bsplineSource.surfaceFaceIds?.length || JSON.stringify(projectedSpline.surfaceFaceIds) !== JSON.stringify(bsplineSource.surfaceFaceIds)) throw new Error('Projekcja nie zachowała powierzchni prowadzących B-spline.');
    await window.webContents.executeJavaScript(`window.__madcadVerifySketchSelection([${JSON.stringify(projectedSpline.id)}], 'replace')`);
    await clickTool(window, 'Rura');
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'pipe'`, 'Pipe po B-spline');
    await setField(window, 'Średnica zewnętrzna', '1');
    await setField(window, 'Grubość ścianki', '0.2');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 2`, 'dokładny Pipe po B-spline', 45000);
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm')?.click()`);
    await waitFor(window, `!window.__madcadVerifyDocumentState?.command && window.__madcadVerifyDocumentState?.featureData?.length === 2 && window.__madcadVerifyEngineState?.status === 'ready'`, 'zapis Pipe po B-spline');
    const splinePipeVolume = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[1].metrics.volume`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyReopenCurrentDocument()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 2`, 'ponowne otwarcie B-spline Pipe', 45000);
    const reopenedSplineVolume = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[1].metrics.volume`);
    if (!(splinePipeVolume > 0) || Math.abs(reopenedSplineVolume - splinePipeVolume) > 0.001) throw new Error('Pipe po B-spline zmienił się po otwarciu.');
    const reopenedSurfaceFaceIds = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.sketches[2].entityData.find((entity) => entity.type === 'bspline3d').surfaceFaceIds`);
    if (JSON.stringify(reopenedSurfaceFaceIds) !== JSON.stringify(bsplineSource.surfaceFaceIds)) throw new Error('Po otwarciu projektu ścieżka utraciła skojarzenie z powierzchnią.');

    console.log('Etap: polecenie Project to Surface w interfejsie');
    await clickTool(window, 'Szkic 3D');
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'sketch3d' && window.__madcadVerifyDocumentState?.sketches?.length === 4`, 'czwarty szkic 3D');
    await setField(window, 'Koniec X', '12');
    await setField(window, 'Koniec Y', '8');
    await setField(window, 'Koniec Z', '6');
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[3]?.entityData?.some((entity) => entity.type === 'line')`, 'źródłowa linia Project to Surface');
    const surfaceCommandSource = await window.webContents.executeJavaScript(`(() => {
      const sketch = window.__madcadVerifyDocumentState.sketches[3];
      const curve = sketch.entityData.find((entity) => entity.type === 'line');
      window.__madcadVerifySketchSelection([curve.id], 'replace');
      return { id: curve.id, endPointId: curve.pointIds[1] };
    })()`);
    await clickTool(window, 'Na powierzchnię');
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'projectSurface' && document.querySelector('.command-dialog')?.textContent.includes('Project to Surface')`, 'panel Project to Surface');
    const surfaceCommandFace = await window.webContents.executeJavaScript(`(() => {
      const body = window.__madcadVerifyEngineState.bodies[0];
      const face = body.topology.faces.find((item) => !['PLANE', 'UNKNOWN_FACE'].includes(item.descriptor.geometry));
      if (!face) throw new Error('Brak zakrzywionej ściany dla polecenia Project to Surface.');
      window.__madcadVerifyTopologySelection({ kind: 'face', id: face.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId }, 'replace');
      return face.id;
    })()`);
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm')?.click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'sketch3d' && window.__madcadVerifyDocumentState?.sketches?.[3]?.entityData?.some((entity) => entity.type === 'bspline3d' && entity.surfaceProjection)`, 'wynik polecenia Project to Surface', 45000);
    const surfaceCommandResult = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.sketches[3].entityData.find((entity) => entity.type === 'bspline3d')`);
    if (JSON.stringify(surfaceCommandResult.surfaceFaceIds) !== JSON.stringify([surfaceCommandFace]) || JSON.stringify(surfaceCommandResult.surfaceProjection.sourceEntityIds) !== JSON.stringify([surfaceCommandSource.id])) throw new Error('Polecenie Project to Surface nie zachowało pełnego skojarzenia.');
    const initialSurfaceSamples = JSON.stringify(surfaceCommandResult.geometry.samples);
    const projectionRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyMoveSketch3DHandle({ curveId: ${JSON.stringify(surfaceCommandSource.id)}, kind: 'end', pointId: ${JSON.stringify(surfaceCommandSource.endPointId)}, coordinates: [16, 11, 8], handleLength: null })`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.revision > ${projectionRevision} && JSON.stringify(window.__madcadVerifyDocumentState?.sketches?.[3]?.entityData?.find((entity) => entity.id === ${JSON.stringify(surfaceCommandResult.id)})?.geometry?.samples) !== ${JSON.stringify(initialSurfaceSamples)}`, 'automatyczna przebudowa Project to Surface', 45000);
    const rebuiltSurfaceCommand = await window.webContents.executeJavaScript(`(() => {
      const sketch = window.__madcadVerifyDocumentState.sketches[3];
      const source = sketch.entityData.find((entity) => entity.id === ${JSON.stringify(surfaceCommandSource.id)});
      const endpoint = sketch.entityData.find((entity) => entity.id === source.pointIds[1]);
      const result = sketch.entityData.find((entity) => entity.id === ${JSON.stringify(surfaceCommandResult.id)});
      window.__madcadVerifySketchSelection([result.id], 'replace');
      const pipeButton = [...document.querySelectorAll('.ribbon-tool')].find((item) => item.querySelector('.ribbon-label')?.textContent.trim() === 'Rura');
      return { endpoint: ['x', 'y', 'z'].map((axis) => Number(endpoint.geometry[axis])), sampleCount: result.geometry.samples.length, pipeEnabled: !pipeButton?.disabled };
    })()`);
    if (!near(rebuiltSurfaceCommand.endpoint, [16, 11, 8]) || rebuiltSurfaceCommand.sampleCount !== 25 || !rebuiltSurfaceCommand.pipeEnabled) throw new Error(`Project to Surface nie współpracuje poprawnie po przebudowie: ${JSON.stringify(rebuiltSurfaceCommand)}`);
    console.log('Etap: zależny Pipe po Project to Surface');
    await clickTool(window, 'Rura');
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'pipe'`, 'Pipe po Project to Surface');
    await setField(window, 'Średnica zewnętrzna', '0.8');
    await setField(window, 'Grubość ścianki', '0.15');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 3`, 'podgląd Pipe po Project to Surface', 45000);
    await window.webContents.executeJavaScript(`document.querySelector('.command-dialog button.confirm')?.click()`);
    await waitFor(window, `!window.__madcadVerifyDocumentState?.command && window.__madcadVerifyDocumentState?.featureData?.length === 3 && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 3`, 'zapis Pipe po Project to Surface', 45000);
    const surfacePipeBefore = await window.webContents.executeJavaScript(`({ revision: window.__madcadVerifyEngineState.revision, volume: window.__madcadVerifyEngineState.bodies[2].metrics.volume, samples: JSON.stringify(window.__madcadVerifyDocumentState.sketches[3].entityData.find((entity) => entity.id === ${JSON.stringify(surfaceCommandResult.id)}).geometry.samples) })`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyEditSketch(${JSON.stringify(surfaceCommandResult.surfaceProjection.sourceSketchId)})`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.activeSketchId === ${JSON.stringify(surfaceCommandResult.surfaceProjection.sourceSketchId)} && window.__madcadVerifyDocumentState?.command?.type === 'sketch3d'`, 'ponowna edycja źródłowego szkicu 3D');
    await window.webContents.executeJavaScript(`window.__madcadVerifyMoveSketch3DHandle({ curveId: ${JSON.stringify(surfaceCommandSource.id)}, kind: 'end', pointId: ${JSON.stringify(surfaceCommandSource.endPointId)}, coordinates: [18, 13, 9], handleLength: null })`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.revision > ${surfacePipeBefore.revision} && window.__madcadVerifyEngineState?.bodies?.length === 3 && JSON.stringify(window.__madcadVerifyDocumentState.sketches[3].entityData.find((entity) => entity.id === ${JSON.stringify(surfaceCommandResult.id)}).geometry.samples) !== ${JSON.stringify(surfacePipeBefore.samples)} && Math.abs(window.__madcadVerifyEngineState.bodies[2].metrics.volume - ${surfacePipeBefore.volume}) > 0.0001`, 'automatyczna przebudowa zależnego Pipe', 45000);
    const dependentSurfacePipe = await window.webContents.executeJavaScript(`({ volumeBefore: ${surfacePipeBefore.volume}, volumeAfter: window.__madcadVerifyEngineState.bodies[2].metrics.volume, timelineStatus: window.__madcadVerifyEngineState.timeline.at(-1).status })`);
    if (dependentSurfacePipe.timelineStatus !== 'ok' || !(dependentSurfacePipe.volumeAfter > 0)) throw new Error(`Zależny Pipe po Project to Surface nie został poprawnie przebudowany: ${JSON.stringify(dependentSurfacePipe)}`);
    console.log(JSON.stringify({ ok: true, splinePipeVolume, sketchSegments: 4, curveTypes, splineContinuity, editedSpline, curvedTopologyAudit, associatedPath, surfaceCommand: { sourceEntityId: surfaceCommandSource.id, faceId: surfaceCommandFace, resultEntityId: surfaceCommandResult.id, rebuilt: rebuiltSurfaceCommand, dependentPipe: dependentSurfacePipe }, undoVerified: true, escapeVerified: true, points, pipe: afterReopen, screenshots: { handles: handleArtifactPath, pipe: artifactPath } }, null, 2));
  } catch (error) {
    exitCode = 1;
    console.error(error);
  } finally {
    window.destroy();
    app.exit(exitCode);
  }
});
