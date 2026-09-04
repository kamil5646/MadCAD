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
    const associatedPath = await window.webContents.executeJavaScript(`(() => {
      const sketch = window.__madcadVerifyDocumentState.sketches[1];
      const line = sketch.entityData.find((entity) => entity.type === 'line' && entity.role === 'projected');
      const points = line.pointIds.map((pointId) => {
        const point = sketch.entityData.find((entity) => entity.id === pointId);
        return ['x', 'y', 'z'].map((axis) => Number(point.geometry[axis]));
      });
      const pipeButton = [...document.querySelectorAll('.ribbon-tool')].find((item) => item.querySelector('.ribbon-label')?.textContent.trim() === 'Rura');
      return { lineId: line.id, referenceId: line.projectionReferenceId, points, pipeEnabled: !pipeButton?.disabled };
    })()`);
    if (!associatedPath.referenceId || !associatedPath.pipeEnabled || JSON.stringify(associatedPath.points) !== JSON.stringify(associatedSource.endpoints)) throw new Error(`Błędna skojarzona ścieżka 3D: ${JSON.stringify({ associatedSource, associatedPath })}`);
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
    await waitFor(window, `!window.__madcadVerifyDocumentState?.command && !window.__madcadVerifyDocumentState?.activeSketchId && window.__madcadVerifyDocumentState?.sketches?.length === 2`, 'bezpieczne zakończenie skojarzonego szkicu 3D przez Esc');

    console.log(JSON.stringify({ ok: true, sketchSegments: 4, curveTypes, splineContinuity, editedSpline, associatedPath, undoVerified: true, escapeVerified: true, points, pipe: afterReopen, screenshots: { handles: handleArtifactPath, pipe: artifactPath } }, null, 2));
  } catch (error) {
    exitCode = 1;
    console.error(error);
  } finally {
    window.destroy();
    app.exit(exitCode);
  }
});
