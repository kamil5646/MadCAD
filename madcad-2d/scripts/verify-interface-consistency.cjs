const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const artifactsDir = path.join(__dirname, '..', 'artifacts', 'interface-consistency-audit-2026-08-28');
const modelScreenshotPath = path.join(artifactsDir, '01-model-fixed.png');
const projectScreenshotPath = path.join(artifactsDir, '02-project-fixed.png');
const drawingScreenshotPath = path.join(artifactsDir, '03-drawing-fixed.png');
const overflowScreenshotPath = path.join(artifactsDir, '04-visible-more-menu.png');
const modifyScreenshotPath = path.join(artifactsDir, '05-edit-3d-fixed.png');
const constructionScreenshotPath = path.join(artifactsDir, '06-construction-fixed.png');
const fileMenuScreenshotPath = path.join(artifactsDir, '07-file-menu-fixed.png');

async function waitFor(window, expression, label, timeoutMs = 45000) {
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

async function ribbonGroups(window) {
  return window.webContents.executeJavaScript(`[...document.querySelectorAll('.modeling-ribbon > .ribbon-visible-groups > .ribbon-group, .modeling-ribbon > .ribbon-sticky-groups > .ribbon-group')].map((item) => item.getAttribute('aria-label'))`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1500, height: 940, show: true, webPreferences: { partition: `madcad-consistency-${Date.now()}` } });
  window.setContentSize(1500, 877);
  try {
    await fs.mkdir(artifactsDir, { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell') && typeof window.__madcadVerifyLoadTimelineFixture === 'function'`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await waitFor(window, `!document.querySelector('.license-info-dialog')`, 'zamknięcie informacji licencyjnej');

    const emptyModelGroups = await ribbonGroups(window);
    const tabs = await window.webContents.executeJavaScript(`[...document.querySelectorAll('.workspace-tabs button')].map((item) => item.textContent.trim())`);
    const expectedTabs = ['MODELUJ', 'EDYCJA 3D', 'ARKUSZ 2D', 'KONSTRUKCJA', 'PROJEKT'];
    if (tabs.join('|') !== expectedTabs.join('|')) throw new Error(`Nielogiczny podział obszarów: ${tabs.join('|')}`);

    await window.webContents.executeJavaScript(`document.querySelector('#fileMenuBtn')?.click()`);
    await waitFor(window, `document.querySelector('.file-backstage')`, 'lewe menu Plik');
    const fileMenu = await window.webContents.executeJavaScript(`(() => {
      const menu = document.querySelector('.file-backstage');
      const rect = menu?.getBoundingClientRect();
      const requiredIds = ['fileImportModelBtn', 'fileImportSketchBtn', 'fileImportDwgBtn', 'fileExportStepBtn', 'fileExportStlBtn', 'fileExport3mfBtn', 'fileExportPdfBtn', 'fileExportDxfBtn', 'filePrint3dBtn'];
      return {
        headings: [...menu.querySelectorAll('h2')].map((item) => item.textContent.trim()),
        requiredActions: requiredIds.map((id) => ({ id, available: Boolean(document.querySelector('#' + id)) })),
        leftAligned: Boolean(rect && rect.left === 0),
        insideWindow: Boolean(rect && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight),
        legacyLayoutsRemoved: !document.querySelector('.workspace-layout-control, .workspace-layout-menu'),
        fileTabsRemoved: ![...document.querySelectorAll('.workspace-tabs button')].some((item) => ['PLIKI CAD', 'DRUK 3D'].includes(item.textContent.trim())),
      };
    })()`);
    const expectedHeadings = ['PROJEKT', 'IMPORT', 'EKSPORT MODELU', 'RYSUNEK TECHNICZNY', 'DRUK 3D'];
    if (fileMenu.headings.join('|') !== expectedHeadings.join('|') || fileMenu.requiredActions.some((item) => !item.available) || !fileMenu.leftAligned || !fileMenu.insideWindow || !fileMenu.legacyLayoutsRemoved || !fileMenu.fileTabsRemoved) throw new Error(`Menu Plik nie porządkuje operacji wejścia i wyjścia: ${JSON.stringify(fileMenu)}`);
    await fs.writeFile(fileMenuScreenshotPath, (await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`document.querySelector('.file-backstage header button')?.click()`);
    await waitFor(window, `!document.querySelector('.file-backstage')`, 'zamknięcie menu Plik');

    const expectedModelGroups = ['1 · SZKIC', '2 · UTWÓRZ BRYŁĘ', '3 · OPERACJE BRYŁOWE', 'TRYB'];
    if (emptyModelGroups.join('|') !== expectedModelGroups.join('|')) throw new Error(`Niestabilny pusty obszar modelowania: ${emptyModelGroups.join('|')}`);

    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 2`, 'model testowy');
    const loadedModelGroups = await ribbonGroups(window);
    if (loadedModelGroups.join('|') !== emptyModelGroups.join('|')) throw new Error(`Grupy modelowania zmieniły położenie po wczytaniu bryły: ${loadedModelGroups.join('|')}`);
    await fs.writeFile(modelScreenshotPath, (await window.webContents.capturePage()).toPNG());

    if (!(await clickText(window, '.workspace-tabs button', 'EDYCJA 3D'))) throw new Error('Brak karty EDYCJA 3D.');
    await waitFor(window, `document.querySelector('.workspace-tabs button.active')?.textContent.trim() === 'EDYCJA 3D'`, 'karta edycji 3D');
    const modifyGroups = await ribbonGroups(window);
    const expectedModifyGroups = ['MODYFIKUJ', 'PODZIEL I NAPRAW', 'POŁOŻENIE', 'TRYB'];
    if (modifyGroups.join('|') !== expectedModifyGroups.join('|')) throw new Error(`Nielogiczna karta edycji 3D: ${modifyGroups.join('|')}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
    await fs.writeFile(modifyScreenshotPath, (await window.webContents.capturePage()).toPNG());

    if (!(await clickText(window, '.workspace-tabs button', 'KONSTRUKCJA'))) throw new Error('Brak karty KONSTRUKCJA.');
    await waitFor(window, `document.querySelector('.workspace-tabs button.active')?.textContent.trim() === 'KONSTRUKCJA'`, 'karta konstrukcji');
    const constructionGroups = await ribbonGroups(window);
    const expectedConstructionGroups = ['PŁASZCZYZNY', 'OSIE', 'PUNKTY'];
    if (constructionGroups.join('|') !== expectedConstructionGroups.join('|')) throw new Error(`Nielogiczna karta konstrukcji: ${constructionGroups.join('|')}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
    await fs.writeFile(constructionScreenshotPath, (await window.webContents.capturePage()).toPNG());

    if (!(await clickText(window, '.workspace-tabs button', 'PROJEKT'))) throw new Error('Brak karty PROJEKT.');
    await waitFor(window, `document.querySelector('.workspace-tabs button.active')?.textContent.trim() === 'PROJEKT'`, 'karta projektu');
    const project = await window.webContents.executeJavaScript(`(() => ({
      topMenuRemoved: !document.querySelector('.project-tools-menu'),
      controls: ['projectSnapshotsBtn', 'projectComparisonBtn', 'projectHealthBtn', 'projectDependenciesBtn'].map((id) => ({ id, inRibbon: Boolean(document.querySelector('.modeling-ribbon #' + id)) })),
      groups: [...document.querySelectorAll('.modeling-ribbon .ribbon-group')].map((item) => item.getAttribute('aria-label')),
    }))()`);
    const expectedProjectGroups = ['USTAWIENIA PROJEKTU', 'WERSJE I KONTROLA', 'STRUKTURA', 'SPRAWDŹ MODEL', 'WIDOK'];
    if (!project.topMenuRemoved || project.controls.some((item) => !item.inRibbon) || project.groups.join('|') !== expectedProjectGroups.join('|')) throw new Error(`Narzędzia projektu nadal są pochowane lub pomieszane: ${JSON.stringify(project)}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await fs.writeFile(projectScreenshotPath, (await window.webContents.capturePage()).toPNG());

    if (!(await clickText(window, '.workspace-tabs button', 'ARKUSZ 2D'))) throw new Error('Brak karty ARKUSZ 2D.');
    await waitFor(window, `document.querySelector('.workspace-tabs button.active')?.textContent.trim() === 'ARKUSZ 2D'`, 'karta arkusza');
    const emptyDrawingGroups = await ribbonGroups(window);
    const expectedDrawingGroups = ['ARKUSZE', 'DODAJ WIDOK', 'WYBRANY WIDOK', 'WYMIARY I OPISY', 'OZNACZENIE', 'TABELE'];
    if (emptyDrawingGroups.join('|') !== expectedDrawingGroups.join('|')) throw new Error(`Niestabilny pusty arkusz: ${emptyDrawingGroups.join('|')}`);
    await clickText(window, '.ribbon-tool', 'Nowy arkusz');
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.length === 1`, 'nowy arkusz');
    await clickText(window, '.ribbon-tool', 'Model 3D');
    await waitFor(window, `window.__madcadVerifyDocumentState?.drawings?.[0]?.views?.length === 1`, 'widok modelu na arkuszu');
    const populatedDrawingGroups = await ribbonGroups(window);
    if (populatedDrawingGroups.join('|') !== emptyDrawingGroups.join('|')) throw new Error(`Grupy arkusza zmieniły położenie po dodaniu widoku: ${populatedDrawingGroups.join('|')}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await fs.writeFile(drawingScreenshotPath, (await window.webContents.capturePage()).toPNG());

    window.setContentSize(920, 697);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await waitFor(window, `document.querySelector('.ribbon-overflow-trigger')?.textContent.includes('Więcej')`, 'jawne menu pozostałych grup');
    await window.webContents.executeJavaScript(`document.querySelector('.ribbon-overflow-trigger').click()`);
    await waitFor(window, `document.querySelector('.ribbon-overflow-menu')`, 'otwarte menu pozostałych grup');
    const overflow = await window.webContents.executeJavaScript(`(() => {
      const trigger = document.querySelector('.ribbon-overflow-trigger');
      return {
        label: trigger.textContent.trim(),
        title: trigger.title,
        sections: [...document.querySelectorAll('.ribbon-overflow-section > strong')].map((item) => item.textContent.trim()),
        hiddenGroups: document.querySelectorAll('.ribbon-group[hidden]').length,
      };
    })()`);
    if (!/^Więcej \(\d+\)$/.test(overflow.label) || !overflow.title.includes('Pokaż ukryte grupy:') || overflow.sections.length !== overflow.hiddenGroups) throw new Error(`Nieczytelne menu pozostałych narzędzi: ${JSON.stringify(overflow)}`);
    await fs.writeFile(overflowScreenshotPath, (await window.webContents.capturePage()).toPNG());

    process.stdout.write(`${JSON.stringify({ ok: true, tabs, fileMenu, emptyModelGroups, loadedModelGroups, modifyGroups, constructionGroups, emptyDrawingGroups, populatedDrawingGroups, project, overflow, modelScreenshotPath, modifyScreenshotPath, constructionScreenshotPath, projectScreenshotPath, drawingScreenshotPath, overflowScreenshotPath, fileMenuScreenshotPath }, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
