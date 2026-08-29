const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-project-health.png');
const reportPath = path.join(__dirname, '..', 'artifacts', 'madcad-project-health-report.json');

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
  await waitFor(window, `document.querySelector('#projectHealthBtn')`, 'karta projektu');
}

async function prepareSuppressedFeature(window) {
  await waitFor(window, `typeof window.__madcadVerifyLoadTimelineFixture === 'function'`, 'fixture historii');
  await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTimelineFixture()`);
  await waitFor(window, `window.__madcadVerifyDocumentState?.features === 3 && document.querySelectorAll('.timeline-item').length === 3 && document.querySelector('.engine-status.ready')`, 'przeliczony projekt testowy', 45000);
  await window.webContents.executeJavaScript(`document.querySelectorAll('.timeline-item')[2].click()`);
  await waitFor(window, `document.querySelector('[data-timeline-action="suppress"]')`, 'narzędzie wyłączenia operacji');
  await click(window, '[data-timeline-action="suppress"]');
  await waitFor(window, `window.__madcadVerifyDocumentState?.featureData?.[2]?.suppressed === true && window.__madcadVerifyDocumentState?.projectHealth?.issues?.some((issue) => issue.code === 'FEATURE_SUPPRESSED')`, 'informacja o wyłączonej operacji', 45000);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    webPreferences: { partition: `madcad-health-verifier-${Date.now()}` },
  });
  window.setContentSize(1440, 837);
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'interfejs aplikacji');
    await click(window, '.license-info-dialog button.confirm');
    await prepareSuppressedFeature(window);

    await openProjectWorkspace(window);
    await click(window, '#projectHealthBtn');
    await waitFor(window, `document.querySelector('.project-health-panel') && document.querySelector('[data-health-issue="FEATURE_SUPPRESSED"]')`, 'panel kondycji z wynikiem');
    const layout = await window.webContents.executeJavaScript(`(() => {
      const panel = document.querySelector('.project-health-panel')?.getBoundingClientRect();
      const stage = document.querySelector('.modeling-stage')?.getBoundingClientRect();
      const report = window.__madcadVerifyDocumentState.projectHealth;
      return {
        status: report.status,
        score: report.score,
        issues: report.counts.total,
        info: report.counts.info,
        checks: report.checks.length,
        inside: Boolean(panel && stage && panel.left >= stage.left && panel.right <= stage.right && panel.top >= stage.top && panel.bottom <= stage.bottom),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    if (layout.status !== 'healthy' || layout.score !== 99 || layout.issues !== 1 || layout.info !== 1 || layout.checks !== 6 || !layout.inside || layout.overflow) throw new Error(`Niepoprawny panel kondycji: ${JSON.stringify(layout)}`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());

    const download = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Nie rozpoczęto eksportu raportu JSON.')), 10000);
      window.webContents.session.once('will-download', (_event, item) => {
        item.setSavePath(reportPath);
        item.once('done', (_doneEvent, state) => {
          clearTimeout(timeout);
          if (state === 'completed') resolve(item.getFilename());
          else reject(new Error(`Eksport raportu zakończył się stanem ${state}.`));
        });
      });
    });
    await click(window, '[data-health-action="export"]');
    const downloadedName = await download;
    const exported = JSON.parse(await fs.readFile(reportPath, 'utf8'));
    if (exported.version !== 1 || exported.generatedAt == null || exported.issues?.[0]?.code !== 'FEATURE_SUPPRESSED') throw new Error('Wyeksportowany raport JSON nie zgadza się z panelem.');

    const targetId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.featureIds[2]`);
    await click(window, '[data-health-issue="FEATURE_SUPPRESSED"]');
    await waitFor(window, `!document.querySelector('.project-health-panel') && window.__madcadVerifyDocumentState?.selection?.kind === 'feature' && window.__madcadVerifyDocumentState?.selection?.id === ${JSON.stringify(targetId)}`, 'przejście do problemu');

    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'en' } });
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'angielski interfejs');
    await click(window, '.license-info-dialog button.confirm');
    await prepareSuppressedFeature(window);
    await openProjectWorkspace(window);
    await click(window, '#projectHealthBtn');
    await waitFor(window, `document.querySelector('.project-health-panel')?.textContent.includes('PROJECT HEALTH') && document.querySelector('[data-health-issue="FEATURE_SUPPRESSED"]')?.textContent.includes('Suppressed feature')`, 'angielski raport kondycji');
    const englishInspection = await window.webContents.executeJavaScript(`(() => {
      const panel = document.querySelector('.project-health-panel');
      const attributes = [...panel.querySelectorAll('*')].flatMap((node) => ['title', 'aria-label'].map((name) => node.getAttribute(name) || ''));
      const content = [panel.textContent, ...attributes].join(' ');
      return { ok: !/(KONDYCJA PROJEKTU|Raport tylko do odczytu|Wszystkie priorytety|Wszystkie kategorie|Kliknij problem|Eksportuj JSON|Stan jest zamierzony)/i.test(content), content };
    })()`);
    const englishPanel = englishInspection.ok;
    if (!englishPanel) throw new Error(`Panel kondycji zawiera nieprzetłumaczony tekst systemowy: ${englishInspection.content}`);

    const result = { ...layout, downloadedName, exportedIssues: exported.issues.length, navigationTarget: targetId, englishPanel, screenshotPath, reportPath };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
