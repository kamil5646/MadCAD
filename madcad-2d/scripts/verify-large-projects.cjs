const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-large-projects.png');
const timeoutMs = process.env.CI ? 300000 : 120000;

async function waitFor(window, expression, label, pollMs = 25) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  const diagnostic = await window.webContents.executeJavaScript(`JSON.stringify({
    engine: {
      status: window.__madcadVerifyEngineState?.status,
      revision: window.__madcadVerifyEngineState?.revision,
      bodies: window.__madcadVerifyEngineState?.bodies?.length,
      timeline: window.__madcadVerifyEngineState?.timeline?.length,
      canceledRevisions: window.__madcadVerifyEngineState?.canceledRevisions,
      performance: window.__madcadVerifyEngineState?.performance,
    },
    features: window.__madcadVerifyDocumentState?.features,
  })`);
  throw new Error(`Przekroczono czas oczekiwania: ${label}. ${diagnostic}`);
}

function rendererMemory(window) {
  const processId = window.webContents.getOSProcessId();
  return app.getAppMetrics().find((metric) => metric.pid === processId)?.memory || null;
}

async function sendHistoryShortcut(window, { redo = false } = {}) {
  const modifiers = ['control'];
  if (redo) modifiers.push('shift');
  await window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Z', modifiers });
  await window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Z', modifiers });
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    webPreferences: { partition: `madcad-large-projects-${Date.now()}` },
  });
  window.setContentSize(1440, 837);

  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell') && typeof window.__madcadVerifyLoadLargeHistoryFixture === 'function'`, 'gotowy interfejs dużych projektów');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadLargeHistoryFixture(220)`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.features === 220 && window.__madcadVerifyEngineState?.timeline?.length === 220 && window.__madcadVerifyEngineState?.bodies?.length === 1`, 'przebudowany projekt z 220 operacjami');
    const initialMemory = rendererMemory(window);

    const beforeCancel = await window.webContents.executeJavaScript(`({ revision: window.__madcadVerifyEngineState.revision, canceled: window.__madcadVerifyEngineState.canceledRevisions, volume: window.__madcadVerifyEngineState.bodies[0].metrics.volume })`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyUpdateLargeHistory(2, 10)`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'computing' && window.__madcadVerifyEngineState?.revision > ${beforeCancel.revision} && [...document.querySelectorAll('.engine-status button')].some((button) => button.textContent.includes('Anuluj przeliczanie'))`, 'trwająca przebudowa z przyciskiem anulowania', 5);
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.engine-status button')].find((button) => button.textContent.includes('Anuluj przeliczanie')).click()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'canceled' && window.__madcadVerifyEngineState?.bodies?.length === 1 && Math.abs(window.__madcadVerifyEngineState.bodies[0].metrics.volume - ${beforeCancel.volume}) < 1e-6 && window.__madcadVerifyDocumentState?.featureData?.[2]?.x === '10'`, 'anulowanie zachowało ostatni poprawny model');
    await waitFor(window, `window.__madcadVerifyEngineState?.canceledRevisions > ${beforeCancel.canceled}`, 'worker potwierdził przerwanie obliczeń');
    const canceledRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyUpdateLargeHistory(2, -3)`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.revision > ${canceledRevision} && window.__madcadVerifyDocumentState?.featureData?.[2]?.x === '-3'`, 'ponowna edycja po anulowaniu');

    const before = await window.webContents.executeJavaScript(`({
      revision: window.__madcadVerifyEngineState.revision,
      canceled: window.__madcadVerifyEngineState.canceledRevisions,
    })`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyUpdateLargeHistory(2, 10)`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'computing' && window.__madcadVerifyEngineState?.revision > ${before.revision}`, 'rozpoczęta starsza przebudowa', 5);
    const supersededRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyUpdateLargeHistory(2, -3)`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.revision > ${supersededRevision} && window.__madcadVerifyEngineState?.canceledRevisions > ${before.canceled} && window.__madcadVerifyDocumentState?.featureData?.[2]?.x === '-3'`, 'najnowsza rewizja po anulowaniu starej');

    const finalEditRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
    await sendHistoryShortcut(window);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.revision > ${finalEditRevision} && window.__madcadVerifyDocumentState?.featureData?.[2]?.x === '10'`, 'Undo dużego projektu');
    const undoRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
    await sendHistoryShortcut(window, { redo: true });
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.revision > ${undoRevision} && window.__madcadVerifyDocumentState?.featureData?.[2]?.x === '-3'`, 'Redo dużego projektu');
    await waitFor(window, `JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null')?.features?.length === 220 && JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null')?.features?.[2]?.x === '-3'`, 'autozapis dużego projektu');
    const redoRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.revision > ${redoRevision} && window.__madcadVerifyDocumentState?.features === 220 && window.__madcadVerifyDocumentState?.featureData?.[2]?.x === '-3'`, 'ponowne otwarcie autozapisu dużego projektu');

    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    const finalMemory = rendererMemory(window);
    const result = await window.webContents.executeJavaScript(`(() => {
      const engine = window.__madcadVerifyEngineState;
      const body = engine.bodies[0];
      return {
        featureCount: window.__madcadVerifyDocumentState.features,
        timelineCount: engine.timeline.length,
        timelineErrors: engine.timeline.filter((entry) => entry.status === 'error' || entry.status === 'stale').length,
        canceledRevisions: engine.canceledRevisions,
        finalRevision: engine.revision,
        finalX: window.__madcadVerifyDocumentState.featureData[2].x,
        volume: body.metrics.volume,
        performance: engine.performance,
        cache: engine.cache,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    Object.assign(result, { screenshotPath, memory: { initial: initialMemory, final: finalMemory } });
    if (result.featureCount !== 220 || result.timelineCount !== 220 || result.timelineErrors !== 0 || result.canceledRevisions <= before.canceled || result.finalX !== '-3' || !(result.volume > 0) || !(finalMemory?.peakWorkingSetSize > 0) || result.horizontalOverflow) {
      throw new Error(`Niepoprawna przebudowa dużego projektu: ${JSON.stringify(result)}`);
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
