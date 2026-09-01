const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-mesh-operations.png');
async function waitFor(window, expression, label, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-mesh-operations-${Date.now()}` } });
  window.setContentSize(1440, 837);
  let exitCode = 0;
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyTopologySelection`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await window.webContents.executeJavaScript(`(async () => {
      const triangles = [];
      for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) {
        const a = [x * 5, y * 5, 0];
        const b = [(x + 1) * 5, y * 5, 0];
        const c = [x * 5, (y + 1) * 5, 0];
        const d = [(x + 1) * 5, (y + 1) * 5, 0];
        triangles.push([a, b, d], [a, d, c]);
      }
      const stl = new ArrayBuffer(84 + triangles.length * 50);
      const view = new DataView(stl);
      view.setUint32(80, triangles.length, true);
      triangles.forEach((face, faceIndex) => face.forEach((vertex, vertexIndex) => vertex.forEach((value, axis) => view.setFloat32(84 + faceIndex * 50 + 12 + vertexIndex * 12 + axis * 4, value, true))));
      const input = [...document.querySelectorAll('input[type="file"]')].find((item) => item.accept.includes('.stl'));
      const key = input && Object.keys(input).find((item) => item.startsWith('__reactProps'));
      await input[key].onChange({ target: { files: [new File([stl], 'regular-grid.stl', { type: 'model/stl' })], value: '' } });
    })()`);
    await waitFor(window, `document.querySelector('.import-model-dialog .confirm')`, 'potwierdzenie importu');
    await window.webContents.executeJavaScript(`document.querySelector('.import-model-dialog .confirm').click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.[0]?.triangles?.length === 384`, 'siatka 128 trójkątów');
    await window.webContents.executeJavaScript(`(() => { const body = window.__madcadVerifyEngineState.bodies[0]; window.__madcadVerifyTopologySelection({ kind: 'body', id: body.id, bodyId: body.id }); })()`);
    await waitFor(window, `[...document.querySelectorAll('.adaptive-tool-shelf button')].some((button) => button.textContent.includes('Narzędzia siatki'))`, 'kontekst narzędzi siatki');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.adaptive-tool-shelf button')].find((button) => button.textContent.includes('Narzędzia siatki')).click()`);
    await waitFor(window, `document.querySelector('.mesh-tools-panel')`, 'panel narzędzi');

    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.mesh-operation-controls button')].find((button) => button.textContent.includes('Redukuj')).click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState.bodies[0].triangles.length / 3 < 128 && window.__madcadVerifyDocumentState.featureData.find((feature) => feature.type === 'importedModel')?.meshOperations?.at(-1)?.type === 'reduce'`, 'zredukowana siatka');
    const reducedTriangles = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].triangles.length / 3`);

    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.mesh-operation-controls button')].find((button) => button.textContent.includes('Wygładź')).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.featureData.find((feature) => feature.type === 'importedModel')?.meshOperations?.at(-1)?.type === 'smooth'`, 'wygładzona siatka');

    await window.webContents.executeJavaScript(`(() => {
      const section = [...document.querySelectorAll('.mesh-operation-section')].find((item) => item.textContent.includes('Przebudowa'));
      const input = section.querySelector('input');
      const key = Object.keys(input).find((item) => item.startsWith('__reactProps'));
      input[key].onChange({ target: { value: '4' } });
    })()`);
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.mesh-operation-controls button')].find((button) => button.textContent.includes('Przebuduj')).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.featureData.find((feature) => feature.type === 'importedModel')?.meshOperations?.at(-1)?.type === 'remesh'`, 'jednorodny remesh');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState.bodies[0].triangles.length / 3 === window.__madcadVerifyDocumentState.featureData.find((feature) => feature.type === 'importedModel')?.triangleCount`, 'przebudowana geometria w silniku');
    const remeshedTriangles = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].triangles.length / 3`);

    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.mesh-operation-controls button')].find((button) => button.textContent.includes('Grupuj')).click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.featureData.find((feature) => feature.type === 'importedModel')?.meshGroups?.length === 1`, 'grupy ścian');
    await waitFor(window, `[...document.querySelectorAll('.mesh-operation-section')].find((item) => item.textContent.includes('Grupy ścian'))?.textContent.includes('1 grup')`, 'odświeżony panel grup');
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `!window.__madcadVerifyDocumentState.featureData.find((feature) => feature.type === 'importedModel')?.meshGroups?.length`, 'cofnięte grupowanie');
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn').click()`);
    await waitFor(window, `window.__madcadVerifyDocumentState.featureData.find((feature) => feature.type === 'importedModel')?.meshGroups?.length === 1`, 'ponowione grupowanie');
    await waitFor(window, `[...document.querySelectorAll('.mesh-operation-section')].find((item) => item.textContent.includes('Grupy ścian'))?.textContent.includes('1 grup')`, 'panel po ponowieniu');
    await new Promise((resolve) => setTimeout(resolve, 250));
    const result = await window.webContents.executeJavaScript(`(() => {
      const panel = document.querySelector('.mesh-tools-panel');
      const body = panel.querySelector('.measure-panel-body');
      const rect = panel.getBoundingClientRect();
      const stageRect = document.querySelector('.modeling-stage').getBoundingClientRect();
      const feature = window.__madcadVerifyDocumentState.featureData.find((item) => item.type === 'importedModel');
      return { triangleCount: window.__madcadVerifyEngineState.bodies[0].triangles.length / 3, groupCount: feature.meshGroups.length, operationTypes: feature.meshOperations.map((item) => item.type), text: panel.textContent, insideWorkspace: rect.left >= stageRect.left && rect.right <= stageRect.right && rect.top >= stageRect.top && rect.bottom <= stageRect.bottom, contentFits: body.scrollHeight <= body.clientHeight + 1, horizontalOverflow: document.documentElement.scrollWidth > innerWidth };
    })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    if (result.triangleCount !== remeshedTriangles || remeshedTriangles <= reducedTriangles || result.groupCount !== 1 || result.operationTypes.join(',') !== 'reduce,smooth,remesh,group' || !result.insideWorkspace || !result.contentFits || result.horizontalOverflow) throw new Error(`Niepoprawny wynik operacji siatki: ${JSON.stringify({ reducedTriangles, remeshedTriangles, ...result })}`);
    process.stdout.write(`${JSON.stringify({ screenshotPath, reducedTriangles, remeshedTriangles, ...result }, null, 2)}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n`);
  } finally {
    process.exitCode = exitCode;
    app.exit(exitCode);
  }
});
