const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-reference-repair-wizard.png');

async function executeStep(window, script, label) {
  try {
    return await window.webContents.executeJavaScript(script);
  } catch (error) {
    throw new Error(`${label}: ${error.message || error}`);
  }
}

async function waitFor(window, expression, label, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await executeStep(window, `Boolean(${expression})`, label)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

async function clickWhenEnabled(window, selector, label, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const clicked = await executeStep(window, `(() => {
      const button = document.querySelector(${JSON.stringify(selector)});
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()`, label);
    if (clicked) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

async function invokeVerificationHook(window, hookName, label, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await executeStep(window, `(() => {
      const hook = window[${JSON.stringify(hookName)}];
      if (typeof hook !== 'function') return { available: false };
      return { available: true, value: hook() };
    })()`, label);
    if (result?.available) return result.value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    webPreferences: { partition: `madcad-repair-verifier-${Date.now()}` },
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    process.stderr.write(`Renderer kreatora naprawy zakończył pracę: ${details.reason} (${details.exitCode}).\n`);
  });
  window.setContentSize(1440, 837);

  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'interfejs aplikacji');
    await executeStep(window, `document.querySelector('.license-info-dialog button.confirm')?.click()`, 'zamknięcie informacji o licencji');
    const fixtureLastFeatureId = await invokeVerificationHook(window, '__madcadVerifyLoadTimelineFixture', 'uruchomienie fixture modelu');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyDocumentState?.featureIds?.at(-1) === ${JSON.stringify(fixtureLastFeatureId)} && window.__madcadVerifyEngineState?.evaluatedFeatureData?.at(-1)?.id === ${JSON.stringify(fixtureLastFeatureId)} && window.__madcadVerifyEngineState?.bodies?.length >= 1`, 'przeliczony nowy model');
    const referenceId = await invokeVerificationHook(window, '__madcadVerifyCreateLostTopologyReference', 'utworzenie kontrolowanej utraconej referencji');
    await waitFor(window, `document.querySelector('.reference-repair-panel.collapsed')`, 'kompaktowy kreator naprawy');
    await clickWhenEnabled(window, '.reference-repair-toggle', 'rozwinięcie kreatora naprawy');
    await waitFor(window, `document.querySelector('.reference-repair-panel:not(.collapsed) .reference-candidate')`, 'rozwinięty kreator z kandydatem');
    await waitFor(window, `document.querySelector('[data-reference-action="repair-certain"]:not(:disabled)')`, 'gotowa automatyczna naprawa');

    const before = await executeStep(window, `(() => {
      const panel = document.querySelector('.reference-repair-panel');
      const rect = panel.getBoundingClientRect();
      const candidate = panel.querySelector('.reference-candidate');
      return {
        title: panel.querySelector('header strong')?.textContent.trim(),
        step: panel.querySelector('.reference-repair-progress span')?.textContent.trim(),
        progressMax: Number(panel.querySelector('progress')?.max),
        candidateClass: candidate?.className || '',
        candidateScore: candidate?.querySelector('strong')?.textContent.trim() || '',
        candidateActions: candidate?.querySelectorAll('button').length || 0,
        insideViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()`, 'odczyt stanu kreatora przed naprawą');
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    await clickWhenEnabled(window, '[data-reference-action="repair-certain"]', 'uruchomienie automatycznej naprawy');
    await waitFor(window, `!document.querySelector('.reference-repair-panel') && window.__madcadVerifyDocumentState.references.find((reference) => reference.id === ${JSON.stringify(referenceId)})?.repairedAt`, 'automatyczna naprawa pewnego dopasowania');

    const result = { screenshotPath, ...before, repaired: true };
    if (before.title !== 'Kreator naprawy referencji' || before.step !== 'Krok 1 z 1' || before.progressMax !== 1 || !before.candidateClass.includes('confidence-high') || !before.candidateScore.includes('%') || before.candidateActions < 2 || !before.insideViewport || before.horizontalOverflow) {
      throw new Error(`Niepoprawny kreator naprawy: ${JSON.stringify(result)}`);
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
