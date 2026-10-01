const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');
const { budgetFailures, githubSummary } = require('./large-project-budget.cjs');

const reportPath = path.join(__dirname, '..', 'artifacts', 'madcad-large-project-corpus.json');
const timeoutMs = process.env.CI ? 300000 : 180000;
const autosaveKey = 'madcad:modeling-document:v4';

function rendererMemory(window) {
  const processId = window.webContents.getOSProcessId();
  return app.getAppMetrics().find((metric) => metric.pid === processId)?.memory || null;
}

function summarizeRun(performance, memory) {
  return {
    totalMs: performance?.totalMs,
    historyMs: performance?.historyMs,
    meshMs: performance?.meshMs,
    slowestFeature: performance?.slowestFeature,
    slowestMeshBody: [...(performance?.bodies || [])].sort((left, right) => right.durationMs - left.durationMs)[0] || null,
    peakWorkingSetKb: memory?.peakWorkingSetSize,
  };
}

async function waitFor(window, expression, label) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await window.webContents.executeJavaScript(`({ matched: Boolean(${expression}), status: window.__madcadVerifyEngineState?.status, error: window.__madcadVerifyEngineState?.diagnostics?.at(-1)?.message })`);
    if (result.matched) return;
    if (result.status === 'error') throw new Error(`${label}: ${result.error || 'silnik CAD zgłosił błąd'}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const diagnostic = await window.webContents.executeJavaScript(`({ status: window.__madcadVerifyEngineState?.status, bodies: window.__madcadVerifyEngineState?.bodies?.length, timeline: window.__madcadVerifyEngineState?.timeline?.length, diagnostics: window.__madcadVerifyEngineState?.diagnostics?.slice(-3) })`);
  throw new Error(`Przekroczono czas oczekiwania: ${label}. ${JSON.stringify(diagnostic)}`);
}

async function geometrySignature(window) {
  return window.webContents.executeJavaScript(`(() => {
    const engine = window.__madcadVerifyEngineState;
    const documentState = window.__madcadVerifyDocumentState;
    return {
      features: documentState.featureIds,
      sketches: documentState.sketches.map((sketch) => sketch.id),
      bodies: engine.bodies.map((body) => ({
        id: body.id,
        volume: body.metrics.volume,
        area: body.metrics.area,
        bounds: body.metrics.bounds,
        vertexData: Array.from(body.vertices),
        triangleData: Array.from(body.triangles),
        faces: body.topology.faces.map((face) => face.id).sort(),
        edges: body.topology.edges.map((edge) => edge.id).sort(),
        verticesIds: body.topology.vertices.map((vertex) => vertex.id).sort(),
      })),
      timelineErrors: engine.timeline.filter((entry) => entry.status === 'error' || entry.status === 'stale').length,
      performance: engine.performance,
    };
  })()`);
}

async function crashAndReload(window) {
  const gone = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Renderer nie potwierdził kontrolowanej awarii.')), 10000);
    window.webContents.once('render-process-gone', (_event, details) => {
      clearTimeout(timer);
      resolve(details);
    });
  });
  window.webContents.forcefullyCrashRenderer();
  const crash = await gone;
  await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
  return crash;
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    webPreferences: { partition: `madcad-large-corpus-${Date.now()}` },
  });
  window.setContentSize(1440, 837);
  try {
    const { createLargeProjectCorpus } = await import('../tests/large-project-fixtures.mjs');
    const { GEOMETRY_POLICY } = await import('../src/cad-core/geometry-policy.js');
    const budgets = GEOMETRY_POLICY.performanceBudgets;
    const corpus = createLargeProjectCorpus();
    const results = [];
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `typeof window.__madcadVerifyLoadSerializedDocument === 'function'`, 'gotowy interfejs korpusu');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);

    for (const source of corpus) {
      const serialized = JSON.stringify(source);
      await window.webContents.executeJavaScript(`window.__madcadVerifyLoadSerializedDocument(${JSON.stringify(serialized)})`);
      const evaluatedSource = `window.__madcadVerifyEngineState?.evaluatedFeatureData?.[0]?.id === ${JSON.stringify(source.features[0].id)} && window.__madcadVerifyEngineState?.evaluatedFeatureData?.at(-1)?.id === ${JSON.stringify(source.features.at(-1).id)}`;
      await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.features === ${source.features.length} && window.__madcadVerifyEngineState?.timeline?.length === ${source.features.length} && ${evaluatedSource}`, `${source.name}: pierwszy model`);
      const before = await geometrySignature(window);
      assert.equal(before.timelineErrors, 0, `${source.name}: błędy historii przed awarią`);
      assert.ok(before.bodies.length > 0, `${source.name}: brak brył przed awarią`);
      const initialMemory = rendererMemory(window);
      await waitFor(window, `JSON.parse(localStorage.getItem(${JSON.stringify(autosaveKey)}) || 'null')?.id === ${JSON.stringify(source.id)}`, `${source.name}: autozapis`);

      const crash = await crashAndReload(window);
      await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.features === ${source.features.length} && ${evaluatedSource}`, `${source.name}: model po awarii`);
      const after = await geometrySignature(window);
      if (JSON.stringify({ ...after, performance: null }) !== JSON.stringify({ ...before, performance: null })) {
        const firstMismatch = after.bodies.findIndex((body, bodyIndex) => JSON.stringify(body) !== JSON.stringify(before.bodies[bodyIndex]));
        throw new Error(`${source.name}: geometria lub referencje zmieniły się po awarii; bryły ${before.bodies.length} → ${after.bodies.length}, pierwsza różnica ${firstMismatch}, przed ${JSON.stringify(before.bodies[firstMismatch]?.id)}, po ${JSON.stringify(after.bodies[firstMismatch]?.id)}.`);
      }
      assert.ok(await window.webContents.executeJavaScript(`Boolean(document.querySelector('.crash-recovery-banner'))`), `${source.name}: brak komunikatu odzyskiwania`);
      const recoveredMemory = rendererMemory(window);
      results.push({
        name: source.name,
        features: source.features.length,
        sketches: source.sketches.length,
        bodies: after.bodies.length,
        faces: after.bodies.reduce((total, body) => total + body.faces.length, 0),
        edges: after.bodies.reduce((total, body) => total + body.edges.length, 0),
        initial: summarizeRun(before.performance, initialMemory),
        recovered: summarizeRun(after.performance, recoveredMemory),
        crashReason: crash.reason,
      });
      process.stdout.write(`${source.name}: ${after.bodies.length} brył, geometria i referencje zgodne po awarii.\n`);
    }
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    const failures = budgetFailures(results, budgets);
    const report = { platform: process.platform, budgets: {
      largeProjectEvaluationMs: budgets.largeProjectEvaluationMs,
      largeProjectSlowestFeatureMs: budgets.largeProjectSlowestFeatureMs,
      displayMeshPerBodyMs: budgets.displayMeshPerBodyMs,
      largeProjectPeakWorkingSetKb: budgets.largeProjectPeakWorkingSetKb,
    }, results, failures };
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, githubSummary(results, budgets, failures));
    process.stdout.write(`${JSON.stringify({ reportPath, ...report }, null, 2)}\n`);
    if (failures.length) throw new Error(`Przekroczono budżet dużych projektów: ${failures.join('; ')}`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
