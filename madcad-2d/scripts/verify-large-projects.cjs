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

    const before = await window.webContents.executeJavaScript(`({
      revision: window.__madcadVerifyEngineState.revision,
      canceled: window.__madcadVerifyEngineState.canceledRevisions,
    })`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyUpdateLargeHistory(2, 10)`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'computing' && window.__madcadVerifyEngineState?.revision > ${before.revision}`, 'rozpoczęta starsza przebudowa', 5);
    const supersededRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyUpdateLargeHistory(2, -3)`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.revision > ${supersededRevision} && window.__madcadVerifyEngineState?.canceledRevisions > ${before.canceled} && window.__madcadVerifyDocumentState?.featureData?.[2]?.x === '-3'`, 'najnowsza rewizja po anulowaniu starej');

    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
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
    Object.assign(result, { screenshotPath });
    if (result.featureCount !== 220 || result.timelineCount !== 220 || result.timelineErrors !== 0 || result.canceledRevisions <= before.canceled || result.finalX !== '-3' || !(result.volume > 0) || result.horizontalOverflow) {
      throw new Error(`Niepoprawna przebudowa dużego projektu: ${JSON.stringify(result)}`);
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
