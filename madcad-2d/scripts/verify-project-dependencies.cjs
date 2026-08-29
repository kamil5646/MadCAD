const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-project-dependencies.png');

async function waitFor(window, expression, label, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

async function click(window, selector) {
  await window.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(selector)})?.click()`);
}

async function openProjectWorkspace(window) {
  await window.webContents.executeJavaScript(`([...document.querySelectorAll('.workspace-tabs button')].find((button) => button.textContent.trim() === 'ZARZĄDZAJ' || button.textContent.trim() === 'MANAGE'))?.click()`);
  await waitFor(window, `document.querySelector('#projectDependenciesBtn')`, 'karta projektu');
}

async function prepareFixture(window) {
  await waitFor(window, `typeof window.__madcadVerifyLoadTimelineFixture === 'function'`, 'fixture historii');
  await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTimelineFixture()`);
  await waitFor(window, `window.__madcadVerifyDocumentState?.features === 3 && document.querySelector('.engine-status.ready')`, 'przeliczony projekt testowy', 45000);
}

async function selectFirstSketch(window) {
  await window.webContents.executeJavaScript(`(() => {
    const select = document.querySelector('[data-dependency-source]');
    const sketchId = window.__madcadVerifyDocumentState.sketches[0].id;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, sketchId);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(window, `window.__madcadVerifyDocumentState?.projectDependencies?.selected?.kind === 'sketch' && document.querySelectorAll('[data-dependency-kind="feature"]').length === 2`, 'zależności szkicu');
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-dependencies-verifier-${Date.now()}` } });
  window.setContentSize(1440, 837);
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'interfejs aplikacji');
    await click(window, '.license-info-dialog button.confirm');
    await prepareFixture(window);
    await openProjectWorkspace(window);
    await click(window, '#projectDependenciesBtn');
    await waitFor(window, `document.querySelector('.project-dependencies-panel')`, 'panel Gdzie używane');
    await selectFirstSketch(window);

    const direct = await window.webContents.executeJavaScript(`(() => {
      const inspection = window.__madcadVerifyDocumentState.projectDependencies;
      const panel = document.querySelector('.project-dependencies-panel')?.getBoundingClientRect();
      const stage = document.querySelector('.modeling-stage')?.getBoundingClientRect();
      return { usedBy: inspection.counts.usedBy, affected: inspection.counts.affected, featureRows: document.querySelectorAll('[data-dependency-kind="feature"]').length, inside: Boolean(panel && stage && panel.left >= stage.left && panel.right <= stage.right && panel.top >= stage.top && panel.bottom <= stage.bottom), overflow: document.documentElement.scrollWidth > innerWidth };
    })()`);
    if (direct.usedBy !== 2 || direct.affected < 3 || direct.featureRows !== 2 || !direct.inside || direct.overflow) throw new Error(`Niepoprawne zależności bezpośrednie: ${JSON.stringify(direct)}`);

    await window.webContents.executeJavaScript(`([...document.querySelectorAll('.project-dependencies-tabs button')].find((button) => button.textContent.includes('WPŁYW ZMIANY')))?.click()`);
    await waitFor(window, `document.querySelector('[data-dependency-kind="body"]') && document.querySelectorAll('[data-dependency-node]').length >= 3`, 'pełny wpływ zmiany');
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());

    await window.webContents.executeJavaScript(`([...document.querySelectorAll('.project-dependencies-tabs button')].find((button) => button.textContent.includes('UŻYWANY PRZEZ')))?.click()`);
    const featureId = await window.webContents.executeJavaScript(`document.querySelector('[data-dependency-kind="feature"]')?.getAttribute('data-dependency-node')`);
    await click(window, `[data-dependency-node="${featureId}"]`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'feature' && window.__madcadVerifyDocumentState?.selection?.id === ${JSON.stringify(featureId)} && window.__madcadVerifyDocumentState?.projectDependencies?.selected?.id === ${JSON.stringify(featureId)}`, 'nawigacja do operacji');

    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'en' } });
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'angielski interfejs');
    await click(window, '.license-info-dialog button.confirm');
    await prepareFixture(window);
    await openProjectWorkspace(window);
    await click(window, '#projectDependenciesBtn');
    await waitFor(window, `document.querySelector('.project-dependencies-panel')?.textContent.includes('WHERE USED')`, 'angielski panel zależności');
    await selectFirstSketch(window);
    const englishInspection = await window.webContents.executeJavaScript(`(() => {
      const panel = document.querySelector('.project-dependencies-panel');
      const attributes = [...panel.querySelectorAll('*')].flatMap((node) => ['title', 'aria-label', 'placeholder'].map((name) => node.getAttribute(name) || ''));
      const content = [panel.textContent, ...attributes].join(' ');
      return { ok: !/(GDZIE UŻYWANE|Graf zależności|Znajdź obiekt|Analizowany obiekt|UŻYWANY PRZEZ|WPŁYW ZMIANY|Kliknij element|wejść|bezpośrednich użyć|elementów pod wpływem)/i.test(content), content };
    })()`);
    if (!englishInspection.ok) throw new Error(`Panel zależności zawiera nieprzetłumaczony tekst systemowy: ${englishInspection.content}`);

    const result = { ...direct, navigationTarget: featureId, englishPanel: englishInspection.ok, screenshotPath };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
