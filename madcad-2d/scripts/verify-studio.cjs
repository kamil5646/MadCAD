// End-to-end check of the main workflow in the real renderer: sketch a rectangle
// on the top plane, dimension it, extrude it and get the body back after a reload.
const path = require('path');
const { app, BrowserWindow } = require('electron');

async function waitFor(window, expression, label, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

const run = (window, code) => window.webContents.executeJavaScript(code);
const clickTool = (window, label) => run(window, `(() => {
  const button = document.querySelector('[data-tool="${label}"]');
  if (!button) throw new Error('Brak narzędzia ${label}');
  button.click();
  return true;
})()`);

async function clickCanvas(window, x, y) {
  for (const type of ['mouseMove', 'mouseDown', 'mouseUp']) {
    window.webContents.sendInputEvent({ type, x, y, button: 'left', clickCount: 1 });
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  await new Promise((resolve) => setTimeout(resolve, 150));
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1280, height: 800, show: true, webPreferences: { partition: `madcad-studio-verifier-${Date.now()}` } });
  let exitCode = 0;
  try {
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1' } });
    await waitFor(window, `document.querySelector('.studio')`, 'interfejs aplikacji');
    await waitFor(window, `document.querySelector('.license-info-dialog button.confirm')`, 'okno licencji');
    await run(window, `document.querySelector('.license-info-dialog button.confirm').click()`);
    await waitFor(window, `window.__madcadStudio?.engine.status === 'ready'`, 'gotowy silnik CAD', 60000);

    const modelTools = await run(window, `[...document.querySelectorAll('.toolbar .tool')].map((item) => item.textContent.trim())`);
    if (modelTools.join(',') !== 'Szkic,Wyciągnij,Obróć,Zaokrąglij,Fazuj,Skorupa,Otwór,Szyk,Lustro') throw new Error(`Nieoczekiwany pasek modelu: ${modelTools}`);

    await clickTool(window, 'Szkic');
    await waitFor(window, `document.querySelector('.plane-picker')`, 'wybór płaszczyzny');
    await run(window, `[...document.querySelectorAll('.plane-picker button')].find((item) => item.textContent.includes('XY')).click()`);
    await waitFor(window, `document.querySelector('.studio.is-sketch')`, 'tryb szkicu');
    await new Promise((resolve) => setTimeout(resolve, 600));

    await clickTool(window, 'Prostokąt');
    const canvas = await run(window, `(() => { const rect = document.querySelector('.model-viewport canvas').getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; })()`);
    await clickCanvas(window, Math.round(canvas.x - 120), Math.round(canvas.y - 80));
    await clickCanvas(window, Math.round(canvas.x + 120), Math.round(canvas.y + 80));
    await waitFor(window, `window.__madcadStudio.document.sketches[0]?.profiles.length === 1`, 'zamknięty profil prostokąta');

    // Dimension the first rectangle line through the panel.
    await run(window, `document.querySelector('[data-tool="Prostokąt"]').click()`);
    const lineId = await run(window, `window.__madcadStudio.document.sketches[0].entities.find((item) => item.type === 'line').id`);
    await run(window, `window.__madcadStudioSelect(${JSON.stringify([lineId])})`);
    await clickTool(window, 'Wymiar');
    await waitFor(window, `document.querySelector('.panel input')`, 'pole wymiaru');
    await run(window, `(() => {
      const input = document.querySelector('.panel input');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '50');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await run(window, `[...document.querySelectorAll('.panel button')].find((item) => item.textContent.includes('OK')).click()`);
    await waitFor(window, `window.__madcadStudio.document.sketches[0].dimensions.length === 1`, 'wymiar 50 mm');

    await clickTool(window, 'Zakończ szkic');
    await waitFor(window, `!document.querySelector('.studio.is-sketch')`, 'koniec szkicu');
    await clickTool(window, 'Wyciągnij');
    await waitFor(window, `document.querySelector('.panel input')`, 'panel wyciągnięcia');
    await waitFor(window, `window.__madcadStudio.engine.status === 'ready' && window.__madcadStudio.engine.bodies === 1`, 'podgląd bryły', 60000);
    await run(window, `[...document.querySelectorAll('.panel button')].find((item) => item.textContent.includes('OK')).click()`);
    await waitFor(window, `window.__madcadStudio.document.features.length === 1 && !document.querySelector('.panel')`, 'zapisane wyciągnięcie');
    await waitFor(window, `window.__madcadStudio.engine.status === 'ready' && window.__madcadStudio.engine.bodies === 1`, 'bryła po zatwierdzeniu', 60000);
    if (!(await run(window, `window.__madcadHasUnsavedChanges()`))) throw new Error('Zmiany nie są oznaczone jako niezapisane.');

    // The autosave must bring the body back after a renderer reload.
    await new Promise((resolve) => setTimeout(resolve, 800));
    window.webContents.reload();
    await waitFor(window, `document.querySelector('.license-info-dialog button.confirm')`, 'okno licencji po przeładowaniu');
    await run(window, `document.querySelector('.license-info-dialog button.confirm').click()`);
    await waitFor(window, `window.__madcadStudio?.engine.status === 'ready' && window.__madcadStudio.engine.bodies === 1`, 'bryła z autozapisu', 60000);

    // Core scenarios: regions, face-supported sketches, fillets after dimension changes…
    const scenarios = await run(window, 'window.__madcadScenarios()');
    const failed = scenarios.filter((item) => !item.ok);
    if (failed.length) throw new Error(`Scenariusze rdzenia: ${failed.map((item) => `${item.name}: ${item.error}`).join('; ')}`);
    process.stdout.write(`${JSON.stringify({ ok: true, checks: ['sketch', 'rectangle', 'dimension', 'extrude', 'autosave'], scenarios: scenarios.length })}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`Error: ${error.stack || error.message}\n`);
  } finally {
    app.exit(exitCode);
  }
});
