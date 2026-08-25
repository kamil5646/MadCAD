const path = require('node:path');
const { app, BrowserWindow } = require('electron');

async function waitFor(window, expression, label, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Przekroczono czas oczekiwania na: ${label}.`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1500,
    height: 900,
    show: false,
    webPreferences: { partition: `madcad-model-import-${Date.now()}` },
  });
  const rendererMessages = [];
  window.webContents.on('console-message', (details) => {
    if (details.level === 'error') rendererMessages.push(details.message);
  });
  let exitCode = 0;
  try {
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready'`, 'start silnika CAD');
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTopologyFixture?.('XY')`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 1`, 'źródłowa bryła B-Rep dla round-trip STEP');
    const stepFixtureBase64 = await window.webContents.executeJavaScript(`(async () => {
      const exported = await window.__madcadVerifyExport('step');
      const bytes = new Uint8Array(exported[0]);
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      return btoa(binary);
    })()`);
    const before = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies.length`);
    await window.webContents.executeJavaScript(`(async () => {
      const points = [[0, 0, 0], [20, 0, 0], [0, 20, 0], [0, 0, 20]];
      const faces = [[0, 2, 1], [0, 1, 3], [1, 2, 3], [2, 0, 3]];
      const stl = new ArrayBuffer(84 + faces.length * 50);
      const view = new DataView(stl);
      view.setUint32(80, faces.length, true);
      faces.forEach((face, faceIndex) => face.forEach((pointIndex, pointInFace) => {
        points[pointIndex].forEach((value, axis) => view.setFloat32(84 + faceIndex * 50 + 12 + pointInFace * 12 + axis * 4, value, true));
      }));
      const input = [...document.querySelectorAll('input[type="file"]')].find((item) => item.accept.includes('.stl'));
      const key = input && Object.keys(input).find((item) => item.startsWith('__reactProps'));
      if (!key || typeof input[key]?.onChange !== 'function') throw new Error('Brak wejścia importu 3D.');
      await input[key].onChange({ target: { files: [new File([stl], 'tetrahedron.stl', { type: 'model/stl' })], value: '' } });
    })()`);
    await waitFor(window, `Boolean(document.querySelector('.import-model-dialog .confirm'))`, 'okno potwierdzenia importu');
    const dialog = await window.webContents.executeJavaScript(`(() => ({
      text: document.querySelector('.import-model-dialog')?.textContent || '',
      fields: [...document.querySelectorAll('.import-model-dialog .command-field')].map((field) => ({
        label: field.firstElementChild?.textContent || '',
        value: field.querySelector('input, select')?.value || '',
      })),
    }))()`);
    if (!dialog.fields.some((field) => field.value === 'Natywna siatka trójkątów')
      || !dialog.fields.some((field) => field.label === 'Trójkąty' && field.value === '4')) {
      throw new Error(`Okno importu nie pokazuje diagnostyki siatki: ${JSON.stringify(dialog)}`);
    }
    await window.webContents.executeJavaScript(`(() => {
      const button = document.querySelector('.import-model-dialog .confirm');
      const key = button && Object.keys(button).find((item) => item.startsWith('__reactProps'));
      button[key].onClick();
    })()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === ${before + 1}`, 'zaimportowana siatka');
    await waitFor(window, `document.querySelector('.workspace-notice')?.textContent.includes('Zaimportowano tetrahedron.stl')`, 'jednoznaczne potwierdzenie importu STL');
    await window.webContents.executeJavaScript(`(async () => {
      const binary = atob(${JSON.stringify(stepFixtureBase64)});
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const input = [...document.querySelectorAll('input[type="file"]')].find((item) => item.accept.includes('.step'));
      const key = input && Object.keys(input).find((item) => item.startsWith('__reactProps'));
      if (!key || typeof input[key]?.onChange !== 'function') throw new Error('Brak wejścia importu STEP.');
      await input[key].onChange({ target: { files: [new File([bytes], 'freecad-envelope.step', { type: 'model/step' })], value: '' } });
    })()`);
    await waitFor(window, `Boolean(document.querySelector('.import-model-dialog .confirm'))`, 'okno potwierdzenia importu STEP');
    const stepFields = await window.webContents.executeJavaScript(`[...document.querySelectorAll('.import-model-dialog .command-field')].map((field) => ({ label: field.firstElementChild?.textContent || '', value: field.querySelector('input, select')?.value || '' }))`);
    if (!stepFields.some((field) => field.label === 'Format' && field.value === 'STEP')
      || !stepFields.some((field) => field.value === 'Dokładna geometria B-Rep')) {
      throw new Error(`Import STEP nie rozpoznał dokładnej geometrii: ${JSON.stringify(stepFields)}`);
    }
    await window.webContents.executeJavaScript(`(() => {
      const button = document.querySelector('.import-model-dialog .confirm');
      const key = button && Object.keys(button).find((item) => item.startsWith('__reactProps'));
      button[key].onClick();
    })()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === ${before + 2}`, 'zaimportowana dokładna bryła STEP');
    await waitFor(window, `document.querySelector('.workspace-notice')?.textContent.includes('Zaimportowano freecad-envelope.step')`, 'jednoznaczne potwierdzenie importu STEP');
    await window.webContents.executeJavaScript(`(async () => {
      const exported = await window.__madcadVerifyExport('3mf');
      const input = [...document.querySelectorAll('input[type="file"]')].find((item) => item.accept.includes('.3mf'));
      const key = input && Object.keys(input).find((item) => item.startsWith('__reactProps'));
      await input[key].onChange({ target: { files: [new File([exported[0]], 'roundtrip.3mf', { type: 'model/3mf' })], value: '' } });
    })()`);
    await waitFor(window, `Boolean(document.querySelector('.import-model-dialog .confirm'))`, 'okno potwierdzenia importu 3MF');
    const threeMfFields = await window.webContents.executeJavaScript(`[...document.querySelectorAll('.import-model-dialog .command-field')].map((field) => ({ label: field.firstElementChild?.textContent || '', value: field.querySelector('input, select')?.value || '' }))`);
    if (!threeMfFields.some((field) => field.label === 'Format' && field.value === '3MF')
      || !threeMfFields.some((field) => field.label === 'Wykryta jedn.' && /Milimetry/.test(field.value))) {
      throw new Error(`Import 3MF nie rozpoznał formatu lub jednostki: ${JSON.stringify(threeMfFields)}`);
    }
    await window.webContents.executeJavaScript(`(() => {
      const button = document.querySelector('.import-model-dialog .confirm');
      const key = button && Object.keys(button).find((item) => item.startsWith('__reactProps'));
      button[key].onClick();
    })()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === ${before + 3}`, 'zaimportowana siatka 3MF');
    await waitFor(window, `document.querySelector('.workspace-notice')?.textContent.includes('Zaimportowano roundtrip.3mf')`, 'jednoznaczne potwierdzenie importu 3MF');
    await window.webContents.executeJavaScript(`(async () => {
      const stl = new ArrayBuffer(84 + 50);
      const view = new DataView(stl);
      view.setUint32(80, 1, true);
      [[0, 0, 0], [10, 0, 0], [0, 10, 0]].forEach((point, pointIndex) => point.forEach((value, axis) => view.setFloat32(96 + pointIndex * 12 + axis * 4, value, true)));
      const input = [...document.querySelectorAll('input[type="file"]')].find((item) => item.accept.includes('.stl'));
      const key = input && Object.keys(input).find((item) => item.startsWith('__reactProps'));
      await input[key].onChange({ target: { files: [new File([stl], 'open-surface.stl', { type: 'model/stl' })], value: '' } });
    })()`);
    await waitFor(window, `Boolean(document.querySelector('.import-model-dialog .confirm'))`, 'potwierdzenie otwartej siatki STL');
    await window.webContents.executeJavaScript(`(() => {
      const button = document.querySelector('.import-model-dialog .confirm');
      const key = button && Object.keys(button).find((item) => item.startsWith('__reactProps'));
      button[key].onClick();
    })()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === ${before + 4}`, 'otwarta siatka STL');
    await waitFor(window, `document.querySelector('.workspace-notice')?.textContent.includes('Zaimportowano open-surface.stl')`, 'jednoznaczne potwierdzenie otwartej siatki');
    const beforeInvalidFeatures = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.features`);
    await window.webContents.executeJavaScript(`(async () => {
      const invalidStep = new TextEncoder().encode('ISO-10303-21;\\nHEADER;\\nENDSEC;\\nDATA;\\nENDSEC;\\nEND-ISO-10303-21;');
      const input = [...document.querySelectorAll('input[type="file"]')].find((item) => item.accept.includes('.step'));
      const key = input && Object.keys(input).find((item) => item.startsWith('__reactProps'));
      await input[key].onChange({ target: { files: [new File([invalidStep], 'invalid-empty.step', { type: 'model/step' })], value: '' } });
    })()`);
    await waitFor(window, `Boolean(document.querySelector('.import-model-dialog .confirm'))`, 'potwierdzenie niepoprawnego STEP');
    await window.webContents.executeJavaScript(`(() => {
      const button = document.querySelector('.import-model-dialog .confirm');
      const key = button && Object.keys(button).find((item) => item.startsWith('__reactProps'));
      button[key].onClick();
    })()`);
    try {
      await waitFor(window, `document.querySelector('.workspace-notice')?.textContent.includes('Nie zaimportowano invalid-empty.step') && window.__madcadVerifyDocumentState.features === ${beforeInvalidFeatures}`, 'czytelny błąd STEP i automatyczny rollback', 10000);
    } catch (error) {
      const debug = await window.webContents.executeJavaScript(`({
        notice: document.querySelector('.workspace-notice')?.textContent || '',
        features: window.__madcadVerifyDocumentState?.features,
        engineStatus: window.__madcadVerifyEngineState?.status,
        engineError: window.__madcadVerifyEngineState?.error,
        timeline: window.__madcadVerifyEngineState?.timeline,
      })`);
      throw new Error(`${error.message} ${JSON.stringify(debug)}`);
    }
    const result = await window.webContents.executeJavaScript(`(async () => {
      const bodies = window.__madcadVerifyEngineState.bodies;
      const stepBody = bodies[${before + 1}];
      const body = bodies.at(-2);
      const openBody = bodies.at(-1);
      const stl = await window.__madcadVerifyExport('stl', { validateRoundTrip: true });
      let stepBlocked = false;
      try { await window.__madcadVerifyExport('step'); } catch (error) { stepBlocked = /B-Rep/.test(error.message); }
      return {
        representation: body.representation,
        bodyCount: bodies.length,
        step: {
          representation: stepBody.representation,
          topologyFaces: stepBody.topology.faces.length,
          dimensions: stepBody.metrics.dimensions,
          volume: stepBody.metrics.volume,
        },
        triangles: body.triangles.length / 3,
        topologyFaces: body.topology.faces.length,
        dimensions: body.metrics.dimensions,
        volume: body.metrics.volume,
        openMesh: {
          representation: openBody.representation,
          meshBooleanCapable: openBody.meshBooleanCapable,
          triangles: openBody.triangles.length / 3,
          area: openBody.metrics.area,
          volume: openBody.metrics.volume,
        },
        stlSizes: stl.buffers.map((buffer) => buffer.byteLength),
        stlRoundTripValid: stl.roundTrip.every((entry) => entry.valid),
        stepBlocked,
      };
    })()`);
    if (result.representation !== 'mesh-import' || result.bodyCount !== before + 4 || result.triangles < 4 || result.topologyFaces !== 0
      || result.step.representation === 'mesh-import' || result.step.topologyFaces < 1
      || result.step.dimensions.some((value) => !Number.isFinite(value) || value <= 0) || result.step.volume <= 0
      || result.dimensions.some((value) => !Number.isFinite(value) || value <= 0) || result.volume <= 0
      || result.openMesh.representation !== 'mesh-import' || result.openMesh.meshBooleanCapable !== false
      || result.openMesh.triangles !== 1 || result.openMesh.area <= 0 || result.openMesh.volume !== 0
      || result.stlSizes.some((size) => size < 100) || !result.stlRoundTripValid || !result.stepBlocked) {
      throw new Error(`Nieprawidłowy wynik round-trip importu 3D: ${JSON.stringify(result)}`);
    }
    process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n${JSON.stringify({ rendererMessages })}\n`);
  } finally {
    window.destroy();
    app.exit(exitCode);
  }
});
