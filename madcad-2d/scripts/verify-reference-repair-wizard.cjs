const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-reference-repair-wizard.png');

async function waitFor(window, expression, label, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
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
  window.setContentSize(1440, 837);

  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'interfejs aplikacji');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await waitFor(window, `typeof window.__madcadVerifyLoadTimelineFixture === 'function'`, 'fixture modelu');
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length >= 1`, 'przeliczony model');
    const referenceId = await window.webContents.executeJavaScript(`window.__madcadVerifyCreateLostTopologyReference()`);
    await waitFor(window, `document.querySelector('.reference-repair-panel.collapsed')`, 'kompaktowy kreator naprawy');
    await window.webContents.executeJavaScript(`document.querySelector('.reference-repair-toggle').click()`);
    await waitFor(window, `document.querySelector('.reference-repair-panel:not(.collapsed) .reference-candidate')`, 'rozwinięty kreator z kandydatem');

    const before = await window.webContents.executeJavaScript(`(() => {
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
    })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    const autoRepairTriggered = await window.webContents.executeJavaScript(`(() => {
      const button = document.querySelector('[data-reference-action="repair-certain"]');
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()`);
    if (!autoRepairTriggered) throw new Error('Przycisk automatycznej naprawy nie jest dostępny.');
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
