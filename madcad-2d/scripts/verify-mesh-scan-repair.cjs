const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-mesh-scan-repair.png');
async function waitFor(window, expression, label, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  const state = await window.webContents.executeJavaScript(`({ engine: window.__madcadVerifyEngineState, document: window.__madcadVerifyDocumentState, panel: document.querySelector('.mesh-tools-panel')?.textContent })`);
  throw new Error(`Przekroczono czas oczekiwania: ${label}\n${JSON.stringify(state)}`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-mesh-scan-repair-${Date.now()}` } });
  window.setContentSize(1440, 837);
  let exitCode = 0;
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyTopologySelection`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await window.webContents.executeJavaScript(`(async () => {
      const vertices = [[0,0,0],[10,0,0],[10,10,0],[0,10,0],[0,0,10],[10,0,10],[10,10,10],[0,10,10]];
      const indices = [[0,2,1],[0,3,2],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,7,4]];
      const triangles = indices.map((face) => face.map((index) => vertices[index]));
      const stl = new ArrayBuffer(84 + triangles.length * 50);
      const view = new DataView(stl);
      view.setUint32(80, triangles.length, true);
      triangles.forEach((face, faceIndex) => face.forEach((vertex, vertexIndex) => vertex.forEach((value, axis) => view.setFloat32(84 + faceIndex * 50 + 12 + vertexIndex * 12 + axis * 4, value, true))));
      const input = [...document.querySelectorAll('input[type="file"]')].find((item) => item.accept.includes('.stl'));
      const key = input && Object.keys(input).find((item) => item.startsWith('__reactProps'));
      await input[key].onChange({ target: { files: [new File([stl], 'open-scan-cube.stl', { type: 'model/stl' })], value: '' } });
    })()`);
    await waitFor(window, `document.querySelector('.import-model-dialog .confirm')`, 'potwierdzenie importu');
    await window.webContents.executeJavaScript(`document.querySelector('.import-model-dialog .confirm').click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.triangles?.length === 30`, 'otwarty sześcian');
    await window.webContents.executeJavaScript(`(() => { const body = window.__madcadVerifyEngineState.bodies[0]; window.__madcadVerifyTopologySelection({ kind: 'body', id: body.id, bodyId: body.id }); })()`);
    await waitFor(window, `[...document.querySelectorAll('.adaptive-tool-shelf button')].some((button) => button.textContent.includes('Narzędzia siatki'))`, 'kontekst narzędzi siatki');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.adaptive-tool-shelf button')].find((button) => button.textContent.includes('Narzędzia siatki')).click()`);
    await waitFor(window, `document.querySelector('.mesh-tools-panel')?.textContent.includes('4 krawędzi') && document.querySelector('.mesh-tools-panel')?.textContent.includes('niespójnych')`, 'diagnostyka otworu i orientacji');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.mesh-operation-controls button')].find((button) => button.textContent.includes('Uporządkuj')).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.featureData.find((feature) => feature.type === 'importedModel')?.meshOperations?.at(-1)?.type === 'orient' && document.querySelector('.mesh-tools-panel')?.textContent.includes('Kontrola bryły')`, 'uporządkowane ściany');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.mesh-operation-controls button')].find((button) => button.textContent.includes('Wypełnij')).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.featureData.find((feature) => feature.type === 'importedModel')?.meshOperations?.at(-1)?.type === 'fillHoles'`, 'zapisane wypełnienie otworu');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.triangles?.length === 42 && document.querySelector('.mesh-tools-panel')?.textContent.includes('Siatka zamknięta')`, 'zamknięta siatka 14 trójkątów');
    const panelResult = await window.webContents.executeJavaScript(`(() => {
      const panel = document.querySelector('.mesh-tools-panel');
      const body = panel.querySelector('.measure-panel-body');
      const rect = panel.getBoundingClientRect();
      const stageRect = document.querySelector('.modeling-stage').getBoundingClientRect();
      const feature = window.__madcadVerifyDocumentState.featureData.find((item) => item.type === 'importedModel');
      return { operationTypes: feature.meshOperations.map((item) => item.type), triangleCount: window.__madcadVerifyEngineState.bodies[0].triangles.length / 3, insideWorkspace: rect.bottom <= stageRect.bottom && rect.right <= stageRect.right, contentFits: body.scrollHeight <= body.clientHeight + 1, horizontalOverflow: document.documentElement.scrollWidth > innerWidth };
    })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    await waitFor(window, `document.querySelector('.mesh-conversion-section button:not(:disabled)')`, 'konwersja po naprawie');
    await window.webContents.executeJavaScript(`document.querySelector('.mesh-conversion-section button').click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.representation === 'brep'`, 'B-Rep po naprawie skanu');
    const volume = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`);
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.representation === 'mesh-import'`, 'cofnięta konwersja');
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.triangles?.length === 30`, 'cofnięte wypełnienie');
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.triangles?.length === 42`, 'ponowione wypełnienie');
    if (panelResult.operationTypes.join(',') !== 'orient,fillHoles' || panelResult.triangleCount !== 14 || !panelResult.insideWorkspace || !panelResult.contentFits || panelResult.horizontalOverflow || Math.abs(volume - 1000) > 0.01) throw new Error(`Niepoprawny wynik naprawy skanu: ${JSON.stringify({ ...panelResult, volume })}`);
    process.stdout.write(`${JSON.stringify({ screenshotPath, ...panelResult, volume }, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
