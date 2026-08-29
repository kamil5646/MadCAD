const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const artifactsDir = path.join(__dirname, '..', 'artifacts');
const screenshotPath = path.join(artifactsDir, 'madcad-sketch-drawing.png');
const clarityArtifactsDir = path.join(artifactsDir, 'clarity-audit-2026-08-28');
const projectScreenshotPath = path.join(clarityArtifactsDir, '02-after-project-workspace.png');
const cadScreenshotPath = path.join(clarityArtifactsDir, '03-file-menu.png');
const printScreenshotPath = path.join(clarityArtifactsDir, '04-print-panel.png');

async function waitFor(window, expression, label, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

async function clickText(window, selector, label) {
  return window.webContents.executeJavaScript(`(() => {
    const target = [...document.querySelectorAll(${JSON.stringify(selector)})].find((item) => item.textContent.trim() === ${JSON.stringify(label)} || item.querySelector('.ribbon-label')?.textContent.trim() === ${JSON.stringify(label)});
    target?.click();
    return Boolean(target);
  })()`);
}

async function waitForPaint() {
  await new Promise((resolve) => setTimeout(resolve, 300));
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1500, height: 940, show: true, webPreferences: { partition: `madcad-sketch-drawing-${Date.now()}` } });
  window.setContentSize(1500, 877);
  try {
    await fs.mkdir(artifactsDir, { recursive: true });
    await fs.mkdir(clarityArtifactsDir, { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'interfejs aplikacji');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await waitFor(window, `document.querySelector('.engine-status.ready') && typeof window.__madcadVerifyLoadSketchDrawingFixture === 'function'`, 'gotowy silnik CAD', 45000);
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadSketchDrawingFixture()`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.length === 1 && window.__madcadVerifyDocumentState?.bodyIds?.length === 0`, 'czysty szkic 2D');
    const tabs = await window.webContents.executeJavaScript(`[...document.querySelectorAll('.workspace-tabs button')].map((item) => item.textContent.trim())`);
    if (tabs.join('|') !== 'PROJEKTUJ|ARKUSZ 2D|ZARZĄDZAJ') throw new Error(`Niepoprawny podział obszarów: ${tabs.join('|')}`);
    if (!(await clickText(window, '.workspace-tabs button', 'ZARZĄDZAJ'))) throw new Error('Brak obszaru ZARZĄDZAJ.');
    await waitFor(window, `document.querySelector('.workspace-tabs button.active')?.textContent.trim() === 'ZARZĄDZAJ' && document.querySelector('.workspace-guidebar')?.textContent.includes('ZARZĄDZAJ · projekt i jego historia')`, 'objaśnienie obszaru zarządzania');
    await waitForPaint();
    await fs.writeFile(projectScreenshotPath, (await window.webContents.capturePage()).toPNG());
    if (!(await clickText(window, '.workspace-tabs button', 'ARKUSZ 2D'))) throw new Error('Brak obszaru ARKUSZ 2D.');
    if (!(await clickText(window, '.ribbon-tool', 'Nowy arkusz'))) throw new Error('Brak polecenia Nowy arkusz.');
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.length === 1`, 'utworzony arkusz');
    if (!(await clickText(window, '.ribbon-tool', 'Szkic 2D'))) throw new Error('Brak polecenia Szkic 2D.');
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.views?.[0]?.type === 'sketch' && document.querySelectorAll('.drawing-view line').length === 4`, 'widok szkicu 2D');
    if (!(await clickText(window, '.ribbon-tool', 'Wymiar X'))) throw new Error('Brak polecenia Wymiar X.');
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.annotations?.length === 1 && document.querySelector('.drawing-linear-dimension')`, 'wymiar szkicu');
    await window.webContents.executeJavaScript(`document.querySelector('#fileMenuBtn')?.click()`);
    await waitFor(window, `document.querySelector('.file-backstage')`, 'centralne menu Plik');
    const state = await window.webContents.executeJavaScript(`(() => {
      const view = window.__madcadVerifyDocumentState.drawings[0].views[0];
      const pdf = document.querySelector('#fileExportPdfBtn');
      const dxf = document.querySelector('#fileExportDxfBtn');
      return {
        bodies: window.__madcadVerifyDocumentState.bodyIds.length,
        viewType: view.type,
        sketchId: view.sketchId,
        lineCount: document.querySelectorAll('.drawing-view line').length,
        association: document.querySelector('.drawing-association-status')?.textContent,
        dimension: document.querySelector('.drawing-linear-dimension text')?.textContent,
        pdfEnabled: Boolean(pdf && !pdf.disabled),
        dxfEnabled: Boolean(dxf && !dxf.disabled),
        allFileActionsPresent: ['fileImportModelBtn', 'fileImportSketchBtn', 'fileImportDwgBtn', 'fileExportStepBtn', 'fileExportStlBtn', 'fileExport3mfBtn', 'fileExportPdfBtn', 'fileExportDxfBtn', 'filePrint3dBtn'].every((id) => document.querySelector('#' + id)),
      };
    })()`);
    await waitFor(window, `document.querySelector('.drawing-sheet-list button small')?.textContent.includes('1 wid.')`, 'odświeżony licznik widoków');
    await new Promise((resolve) => setTimeout(resolve, 250));
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    await fs.writeFile(cadScreenshotPath, (await window.webContents.capturePage()).toPNG());
    if (state.bodies !== 0 || state.viewType !== 'sketch' || !state.sketchId || state.lineCount !== 4 || state.association !== 'Aktualizowane z widokiem źródłowym' || !state.dimension?.startsWith('80.00') || !state.pdfEnabled || !state.dxfEnabled || !state.allFileActionsPresent) throw new Error(`Niepoprawny wydruk szkicu 2D: ${JSON.stringify(state)}`);
    await window.webContents.executeJavaScript(`document.querySelector('#filePrint3dBtn')?.click()`);
    await waitFor(window, `document.querySelector('.workspace-tabs button.active')?.textContent.trim() === 'PROJEKTUJ' && document.querySelector('.print-panel') && ![...document.querySelectorAll('.workspace-tabs button')].some((item) => ['PLIKI CAD', 'DRUK 3D'].includes(item.textContent.trim()))`, 'panel druku 3D z menu Plik');
    await waitForPaint();
    await fs.writeFile(printScreenshotPath, (await window.webContents.capturePage()).toPNG());
    process.stdout.write(`${JSON.stringify({ screenshotPath, projectScreenshotPath, cadScreenshotPath, printScreenshotPath, tabs, centralFileMenu: true, ...state }, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
