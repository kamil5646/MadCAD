const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const artifactsDir = path.join(__dirname, '..', 'artifacts', 'interface-consistency-audit-2026-08-28');
const modelScreenshotPath = path.join(artifactsDir, '01-model-fixed.png');
const projectScreenshotPath = path.join(artifactsDir, '02-project-fixed.png');
const drawingScreenshotPath = path.join(artifactsDir, '03-drawing-fixed.png');
const overflowScreenshotPath = path.join(artifactsDir, '04-visible-more-menu.png');
const designScreenshotPath = path.join(artifactsDir, '05-design-unified.png');
const constructionScreenshotPath = path.join(artifactsDir, '06-construction-menu.png');
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
  const window = new BrowserWindow({ width: 2200, height: 940, show: true, webPreferences: { partition: `madcad-consistency-${Date.now()}` } });
  window.setContentSize(2200, 877);
  try {
    await fs.mkdir(artifactsDir, { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell') && typeof window.__madcadVerifyLoadTimelineFixture === 'function'`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await waitFor(window, `!document.querySelector('.license-info-dialog')`, 'zamknięcie informacji licencyjnej');

    const emptyModelGroups = await ribbonGroups(window);
    const tabs = await window.webContents.executeJavaScript(`[...document.querySelectorAll('.workspace-tabs button')].map((item) => item.textContent.trim())`);
    const expectedTabs = ['PROJEKTUJ', 'ARKUSZ 2D', 'ZARZĄDZAJ'];
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
        readableWidth: Boolean(rect && rect.width >= 390 && rect.width <= 440),
        compactRows: Math.max(...[...menu.querySelectorAll('.file-backstage-content section > button')].map((item) => item.getBoundingClientRect().height)) <= 42,
        legacyLayoutsRemoved: !document.querySelector('.workspace-layout-control, .workspace-layout-menu'),
        fileTabsRemoved: ![...document.querySelectorAll('.workspace-tabs button')].some((item) => ['PLIKI CAD', 'DRUK 3D'].includes(item.textContent.trim())),
      };
    })()`);
    const expectedHeadings = ['PROJEKT', 'IMPORT', 'EKSPORT MODELU', 'RYSUNEK TECHNICZNY', 'DRUK 3D'];
    if (fileMenu.headings.join('|') !== expectedHeadings.join('|') || fileMenu.requiredActions.some((item) => !item.available) || !fileMenu.leftAligned || !fileMenu.insideWindow || !fileMenu.readableWidth || !fileMenu.compactRows || !fileMenu.legacyLayoutsRemoved || !fileMenu.fileTabsRemoved) throw new Error(`Menu Plik nie porządkuje operacji wejścia i wyjścia: ${JSON.stringify(fileMenu)}`);
    await fs.writeFile(fileMenuScreenshotPath, (await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`document.querySelector('.file-backstage header button')?.click()`);
    await waitFor(window, `!document.querySelector('.file-backstage')`, 'zamknięcie menu Plik');

    const expectedModelGroups = ['UTWÓRZ', 'EDYCJA', 'OPERACJE', 'KONSTRUKCJA', 'SPRAWDŹ'];
    if (emptyModelGroups.join('|') !== expectedModelGroups.join('|')) throw new Error(`Niestabilny pusty obszar modelowania: ${emptyModelGroups.join('|')}`);
    const designStructure = await window.webContents.executeJavaScript(`(() => ({
      legacyTabsRemoved: ![...document.querySelectorAll('.workspace-tabs button')].some((item) => ['MODELUJ', 'EDYCJA 3D', 'KONSTRUKCJA', 'PROJEKT'].includes(item.textContent.trim())),
      selectionModeGroupRemoved: ![...document.querySelectorAll('.ribbon-group')].some((item) => item.getAttribute('aria-label') === 'TRYB'),
      menus: [...document.querySelectorAll('.ribbon-tool-menu-trigger .ribbon-label')].map((item) => item.textContent.trim()),
      customCadIcons: document.querySelectorAll('.ribbon-tool svg path').length > 25,
      iconSize: document.querySelector('.ribbon-tool:not(.featured) .ribbon-icon svg')?.getBoundingClientRect().width || 0,
      featuredIconSize: document.querySelector('.ribbon-tool.featured .ribbon-icon')?.getBoundingClientRect().width || 0,
      appIconSize: document.querySelector('.app-menu button svg')?.getBoundingClientRect().width || 0,
      ribbonHeight: document.querySelector('.command-area')?.getBoundingClientRect().height || 0,
    }))()`);
    const expectedDesignMenus = ['Więcej brył', 'Więcej zmian', 'Łącz i dziel', 'Płaszczyzny', 'Osie', 'Punkty', 'Analiza'];
    if (!designStructure.legacyTabsRemoved || !designStructure.selectionModeGroupRemoved || designStructure.menus.join('|') !== expectedDesignMenus.join('|') || !designStructure.customCadIcons || designStructure.iconSize < 22 || designStructure.featuredIconSize < 33 || designStructure.appIconSize < 17 || designStructure.ribbonHeight > 98) throw new Error(`Projektowanie nadal jest podzielone lub ma nieczytelne narzędzia: ${JSON.stringify(designStructure)}`);

    window.setContentSize(1351, 877);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const normalWidthLayout = await window.webContents.executeJavaScript(`(() => ({
      hiddenGroups: document.querySelectorAll('.modeling-ribbon > .ribbon-visible-groups > .ribbon-group[hidden]').length,
      overflowLabel: document.querySelector('.ribbon-overflow-trigger')?.textContent.trim() || '',
      horizontalOverflow: document.querySelector('.modeling-ribbon').scrollWidth > document.querySelector('.modeling-ribbon').clientWidth + 1,
    }))()`);
    if (normalWidthLayout.hiddenGroups > 1 || normalWidthLayout.horizontalOverflow) throw new Error(`Wstążka nadal gubi narzędzia w typowym oknie: ${JSON.stringify(normalWidthLayout)}`);
    window.setContentSize(2200, 877);
    await new Promise((resolve) => setTimeout(resolve, 300));

    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 2`, 'model testowy');
    const loadedModelGroups = await ribbonGroups(window);
    if (loadedModelGroups.join('|') !== emptyModelGroups.join('|')) throw new Error(`Grupy modelowania zmieniły położenie po wczytaniu bryły: ${loadedModelGroups.join('|')}`);
    await fs.writeFile(modelScreenshotPath, (await window.webContents.capturePage()).toPNG());
    await fs.writeFile(designScreenshotPath, (await window.webContents.capturePage()).toPNG());

    if (!(await clickText(window, '.ribbon-tool-menu-trigger', 'Płaszczyzny'))) throw new Error('Brak menu Płaszczyzny.');
    await waitFor(window, `document.querySelector('.ribbon-tool-submenu')`, 'menu konstrukcji');
    const constructionMenu = await window.webContents.executeJavaScript(`(() => {
      const menu = document.querySelector('.ribbon-tool-submenu');
      const rect = menu.getBoundingClientRect();
      const topElement = document.elementFromPoint(rect.x + 10, rect.y + 10);
      return {
        items: [...menu.querySelectorAll('strong')].map((item) => item.textContent.trim()),
        visible: rect.width > 250 && rect.height > 100 && rect.top >= 0 && rect.bottom <= innerHeight,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        topElement: topElement?.className || topElement?.tagName,
        onTop: Boolean(topElement && menu.contains(topElement)),
      };
    })()`);
    if (constructionMenu.items.join('|') !== 'Płaszczyzna odsunięta|Płaszczyzna środkowa|Przez 3 punkty|Pod kątem|Styczna|Na ścieżce' || !constructionMenu.visible || !constructionMenu.onTop) throw new Error(`Niepełne lub niewidoczne menu płaszczyzn: ${JSON.stringify(constructionMenu)}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await fs.writeFile(constructionScreenshotPath, (await window.webContents.capturePage()).toPNG());
    await clickText(window, '.ribbon-tool-menu-trigger', 'Płaszczyzny');

    if (!(await clickText(window, '.workspace-tabs button', 'ZARZĄDZAJ'))) throw new Error('Brak karty ZARZĄDZAJ.');
    await waitFor(window, `document.querySelector('.workspace-tabs button.active')?.textContent.trim() === 'ZARZĄDZAJ'`, 'karta zarządzania');
    const project = await window.webContents.executeJavaScript(`(() => ({
      topMenuRemoved: !document.querySelector('.project-tools-menu'),
      controls: ['projectSnapshotsBtn', 'projectComparisonBtn', 'projectHealthBtn', 'projectDependenciesBtn'].map((id) => ({ id, inRibbon: Boolean(document.querySelector('.modeling-ribbon #' + id)) })),
      groups: [...document.querySelectorAll('.modeling-ribbon .ribbon-group')].map((item) => item.getAttribute('aria-label')),
    }))()`);
    const expectedProjectGroups = ['PARAMETRY', 'WERSJE', 'KONTROLA', 'STRUKTURA', 'WIDOK'];
    if (!project.topMenuRemoved || project.controls.some((item) => !item.inRibbon) || project.groups.join('|') !== expectedProjectGroups.join('|')) throw new Error(`Narzędzia projektu nadal są pochowane lub pomieszane: ${JSON.stringify(project)}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await fs.writeFile(projectScreenshotPath, (await window.webContents.capturePage()).toPNG());

    if (!(await clickText(window, '.workspace-tabs button', 'ARKUSZ 2D'))) throw new Error('Brak karty ARKUSZ 2D.');
    await waitFor(window, `document.querySelector('.workspace-tabs button.active')?.textContent.trim() === 'ARKUSZ 2D'`, 'karta arkusza');
    const emptyDrawingGroups = await ribbonGroups(window);
    const expectedDrawingGroups = ['ARKUSZ', 'WIDOKI', 'OPISZ', 'ZESTAWIENIA'];
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
    const narrowRibbon = await window.webContents.executeJavaScript(`(() => ({
      hasOverflow: Boolean(document.querySelector('.ribbon-overflow-trigger')),
      hiddenGroups: document.querySelectorAll('.ribbon-group[hidden]').length,
      horizontalOverflow: document.querySelector('.modeling-ribbon').scrollWidth > document.querySelector('.modeling-ribbon').clientWidth + 1,
    }))()`);
    let overflow = { compactWithoutOverflow: true, ...narrowRibbon };
    if (narrowRibbon.hasOverflow) {
      await window.webContents.executeJavaScript(`document.querySelector('.ribbon-overflow-trigger').click()`);
      await waitFor(window, `document.querySelector('.ribbon-overflow-menu')`, 'otwarte menu pozostałych grup');
      overflow = await window.webContents.executeJavaScript(`(() => {
        const trigger = document.querySelector('.ribbon-overflow-trigger');
        return {
          label: trigger.textContent.trim(),
          title: trigger.title,
          sections: [...document.querySelectorAll('.ribbon-overflow-section > strong')].map((item) => item.textContent.trim()),
          hiddenGroups: document.querySelectorAll('.ribbon-group[hidden]').length,
        };
      })()`);
      if (!/^Więcej \(\d+\)$/.test(overflow.label) || !overflow.title.includes('Pokaż ukryte grupy:') || overflow.sections.length !== overflow.hiddenGroups) throw new Error(`Nieczytelne menu pozostałych narzędzi: ${JSON.stringify(overflow)}`);
    } else if (narrowRibbon.hiddenGroups || narrowRibbon.horizontalOverflow) {
      throw new Error(`Wąska wstążka ukrywa narzędzia bez menu: ${JSON.stringify(narrowRibbon)}`);
    }
    await fs.writeFile(overflowScreenshotPath, (await window.webContents.capturePage()).toPNG());

    process.stdout.write(`${JSON.stringify({ ok: true, tabs, fileMenu, designStructure, emptyModelGroups, loadedModelGroups, constructionMenu, emptyDrawingGroups, populatedDrawingGroups, project, overflow, modelScreenshotPath, designScreenshotPath, constructionScreenshotPath, projectScreenshotPath, drawingScreenshotPath, overflowScreenshotPath, fileMenuScreenshotPath }, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
