const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-mesh-to-brep.png');
async function waitFor(window, expression, label, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  const state = await window.webContents.executeJavaScript(`({ engine: window.__madcadVerifyEngineState, document: window.__madcadVerifyDocumentState })`);
  throw new Error(`Przekroczono czas oczekiwania: ${label}\n${JSON.stringify(state)}`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-mesh-to-brep-${Date.now()}` } });
  window.setContentSize(1440, 837);
  let exitCode = 0;
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyTopologySelection`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await window.webContents.executeJavaScript(`(async () => {
      const vertices = [[0,0,0],[10,0,0],[10,10,0],[0,10,0],[0,0,10],[10,0,10],[10,10,10],[0,10,10]];
      const indices = [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[3,7,6],[3,6,2],[0,4,7],[0,7,3],[1,2,6],[1,6,5]];
      const triangles = indices.map((face) => face.map((index) => vertices[index]));
      const stl = new ArrayBuffer(84 + triangles.length * 50);
      const view = new DataView(stl);
      view.setUint32(80, triangles.length, true);
      triangles.forEach((face, faceIndex) => face.forEach((vertex, vertexIndex) => vertex.forEach((value, axis) => view.setFloat32(84 + faceIndex * 50 + 12 + vertexIndex * 12 + axis * 4, value, true))));
      const input = [...document.querySelectorAll('input[type="file"]')].find((item) => item.accept.includes('.stl'));
      const key = input && Object.keys(input).find((item) => item.startsWith('__reactProps'));
      await input[key].onChange({ target: { files: [new File([stl], 'closed-cube.stl', { type: 'model/stl' })], value: '' } });
    })()`);
    await waitFor(window, `document.querySelector('.import-model-dialog .confirm')`, 'potwierdzenie importu');
    await window.webContents.executeJavaScript(`document.querySelector('.import-model-dialog .confirm').click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.representation === 'mesh-import'`, 'zamknięta siatka');
    await window.webContents.executeJavaScript(`(() => { const body = window.__madcadVerifyEngineState.bodies[0]; window.__madcadVerifyTopologySelection({ kind: 'body', id: body.id, bodyId: body.id }); })()`);
    await waitFor(window, `[...document.querySelectorAll('.adaptive-tool-shelf button')].some((button) => button.textContent.includes('Narzędzia siatki'))`, 'kontekst narzędzi siatki');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.adaptive-tool-shelf button')].find((button) => button.textContent.includes('Narzędzia siatki')).click()`);
    await waitFor(window, `document.querySelector('.mesh-conversion-section button:not(:disabled)')`, 'dostępna konwersja B-Rep');
    await window.webContents.executeJavaScript(`document.querySelector('.mesh-conversion-section button').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.featureData.find((feature) => feature.type === 'importedModel')?.representationMode === 'brep-faceted'`, 'zapis konwersji');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.representation === 'brep' && window.__madcadVerifyEngineState?.bodies?.[0]?.topology?.faces?.length >= 6`, 'bryła B-Rep');
    const converted = await window.webContents.executeJavaScript(`({ representation: window.__madcadVerifyEngineState.bodies[0].representation, faces: window.__madcadVerifyEngineState.bodies[0].topology.faces.length, edges: window.__madcadVerifyEngineState.bodies[0].topology.edges.length, volume: window.__madcadVerifyEngineState.bodies[0].metrics.volume })`);
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.representation === 'mesh-import'`, 'cofnięta konwersja');
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.representation === 'brep'`, 'ponowiona konwersja');
    await waitFor(window, `[...document.querySelectorAll('.adaptive-tool-shelf button')].some((button) => button.textContent.includes('Przywróć siatkę'))`, 'jawna konwersja B-Rep do siatki');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.adaptive-tool-shelf button')].find((button) => button.textContent.includes('Przywróć siatkę')).click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.representation === 'mesh-import' && window.__madcadVerifyDocumentState.featureData.find((feature) => feature.type === 'importedModel')?.representationMode === 'mesh'`, 'przywrócona siatka');
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.representation === 'brep'`, 'cofnięte przywracanie siatki');
    await new Promise((resolve) => setTimeout(resolve, 250));
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    if (converted.representation !== 'brep' || converted.faces < 6 || Math.abs(converted.volume - 1000) > 0.01) throw new Error(`Niepoprawna bryła po konwersji: ${JSON.stringify(converted)}`);
    process.stdout.write(`${JSON.stringify({ screenshotPath, ...converted }, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
