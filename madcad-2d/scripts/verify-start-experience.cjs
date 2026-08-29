const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const artifactsDir = path.join(__dirname, '..', 'artifacts', 'start-experience-audit');
const wideScreenshotPath = path.join(artifactsDir, '02-after-start.png');
const narrowScreenshotPath = path.join(artifactsDir, '03-narrow-start.png');
const recoveryScreenshotPath = path.join(artifactsDir, '04-crash-recovery.png');

async function waitFor(window, expression, label, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

async function capture(window, outputPath) {
  await fs.writeFile(outputPath, (await window.webContents.capturePage()).toPNG());
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1600,
    height: 980,
    show: true,
    webPreferences: { partition: `madcad-start-verifier-${Date.now()}` },
  });
  window.setContentSize(1600, 917);

  try {
    await fs.mkdir(artifactsDir, { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'interfejs aplikacji');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await waitFor(window, `!document.querySelector('.license-info-dialog')`, 'zamknięcie informacji licencyjnej');
    await waitFor(window, `document.querySelector('.start-page')`, 'strona startowa');
    await waitFor(window, `document.querySelector('.engine-status.ready')`, 'gotowy silnik CAD', 40000);
    const recoveryDocumentText = await window.webContents.executeJavaScript(`window.__madcadGetSessionExport()`);

    const wide = await window.webContents.executeJavaScript(`(() => {
      const page = document.querySelector('.start-page');
      const brand = document.querySelector('.brand-mark img');
      const brandMark = brand?.closest('.brand-mark');
      const titleActions = document.querySelector('.title-actions');
      const startBrand = page?.querySelector('.start-page-brand img');
      const shell = page?.querySelector('.start-page-shell');
      const primary = page?.querySelector('.start-page-action.primary');
      const browserToggle = document.querySelector('.app-menu button[title="Pokaż lub ukryj przeglądarkę"]');
      const labels = [...document.querySelectorAll('.workspace-tabs button')].map((item) => item.textContent.trim());
      const rect = page?.getBoundingClientRect();
      const stageRect = document.querySelector('.modeling-stage')?.getBoundingClientRect();
      return {
        title: page?.querySelector('h1')?.textContent.trim() || '',
        primaryText: primary?.textContent.trim() || '',
        workflowText: page?.querySelector('.start-page-flow')?.textContent.trim() || '',
        tabs: labels,
        fileMenuAvailable: Boolean(document.querySelector('#fileMenuBtn')),
        sharedIcon: Boolean(brand?.src && brand.src === startBrand?.src && brand.naturalWidth >= 512),
        logoAtRightEnd: Boolean(brandMark && titleActions && brandMark.parentElement === titleActions && titleActions.lastElementChild === brandMark),
        browserHiddenByDefault: !document.querySelector('.model-browser') && document.querySelector('.modeling-content')?.classList.contains('without-browser'),
        browserToggleAvailable: Boolean(browserToggle && !browserToggle.classList.contains('active')),
        shellWidth: shell?.getBoundingClientRect().width || 0,
        pageInsideStage: Boolean(rect && stageRect && rect.left >= stageRect.left && rect.top >= stageRect.top && rect.right <= stageRect.right + 1 && rect.bottom <= stageRect.bottom + 1),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth || page.scrollWidth > page.clientWidth + 1,
      };
    })()`);

    if (!wide.title.includes('Zacznij od szkicu 2D') || !wide.primaryText.includes('Nowy szkic 2D') || !wide.workflowText.includes('Arkusz techniczny 2D') || !wide.workflowText.includes('Model parametryczny 3D') || !wide.workflowText.includes('Opcjonalnie: druk 3D') || wide.tabs.join('|') !== 'MODELUJ|EDYCJA 3D|ARKUSZ 2D|KONSTRUKCJA|PROJEKT' || !wide.fileMenuAvailable || !wide.sharedIcon || !wide.logoAtRightEnd || !wide.browserHiddenByDefault || !wide.browserToggleAvailable || wide.shellWidth < 1120 || !wide.pageInsideStage || wide.horizontalOverflow) {
      throw new Error(`Nieprawidłowa hierarchia strony startowej: ${JSON.stringify(wide)}`);
    }

    const axeSource = await fs.readFile(require.resolve('axe-core/axe.min.js'), 'utf8');
    await window.webContents.executeJavaScript(axeSource);
    const accessibility = await window.webContents.executeJavaScript(`(async () => {
      const audit = await axe.run(document.querySelector('.start-page'), {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      });
      return {
        violations: audit.violations.map((item) => ({ id: item.id, impact: item.impact, help: item.help })),
        incomplete: audit.incomplete.map((item) => ({ id: item.id, impact: item.impact })),
      };
    })()`);
    if (accessibility.violations.some((item) => ['critical', 'serious'].includes(item.impact))) {
      throw new Error(`Strona startowa nie przeszła audytu dostępności: ${JSON.stringify(accessibility)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
    await capture(window, wideScreenshotPath);

    window.setContentSize(1100, 760);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const narrow = await window.webContents.executeJavaScript(`(() => {
      const page = document.querySelector('.start-page');
      const primary = page?.querySelector('.start-page-action.primary');
      const pageRect = page?.getBoundingClientRect();
      const buttonRect = primary?.getBoundingClientRect();
      return {
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth || page.scrollWidth > page.clientWidth + 1,
        primaryVisible: Boolean(buttonRect && pageRect && buttonRect.left >= pageRect.left && buttonRect.right <= pageRect.right + 1),
        flowHidden: getComputedStyle(page.querySelector('.start-page-flow')).display === 'none',
      };
    })()`);
    if (narrow.horizontalOverflow || !narrow.primaryVisible || !narrow.flowHidden) throw new Error(`Strona startowa nie mieści się w wąskim oknie: ${JSON.stringify(narrow)}`);
    await capture(window, narrowScreenshotPath);

    window.setContentSize(1600, 917);
    await window.webContents.executeJavaScript(`document.querySelector('.start-page-action.primary')?.click()`);
    await waitFor(window, `document.querySelector('.plane-picker')`, 'przejście ze strony startowej do wyboru płaszczyzny');

    await window.webContents.executeJavaScript(`(() => {
      const recovered = JSON.parse(${JSON.stringify(recoveryDocumentText)});
      recovered.name = 'Projekt po awarii';
      recovered.metadata.modifiedAt = '2026-08-15T20:30:00.000Z';
      localStorage.setItem('madcad:modeling-document:v4', JSON.stringify(recovered));
    })()`);
    await window.webContents.reload();
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'ponowne uruchomienie interfejsu');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await waitFor(window, `document.querySelector('.crash-recovery-banner')`, 'widoczny komunikat odzyskania po awarii');
    const recovery = await window.webContents.executeJavaScript(`(() => {
      const banner = document.querySelector('.crash-recovery-banner');
      const save = [...banner.querySelectorAll('button')].find((item) => item.textContent.includes('Zapisz odzyskany projekt'));
      const dismiss = banner.querySelector('button[aria-label="Zamknij komunikat odzyskiwania"]');
      const rect = banner.getBoundingClientRect();
      const stage = document.querySelector('.modeling-stage').getBoundingClientRect();
      return {
        text: banner.textContent.replace(/\\s+/g, ' ').trim(),
        saveVisible: Boolean(save && !save.disabled),
        dismissVisible: Boolean(dismiss),
        insideStage: rect.left >= stage.left && rect.right <= stage.right + 1 && rect.top >= stage.top && rect.bottom <= stage.bottom + 1,
      };
    })()`);
    if (!recovery.text.includes('Odzyskano projekt po nieoczekiwanym zamknięciu') || !recovery.saveVisible || !recovery.dismissVisible || !recovery.insideStage) {
      throw new Error(`Nieprawidłowy komunikat odzyskiwania po awarii: ${JSON.stringify(recovery)}`);
    }
    await capture(window, recoveryScreenshotPath);

    process.stdout.write(`${JSON.stringify({ ok: true, wideScreenshotPath, narrowScreenshotPath, recoveryScreenshotPath, wide, narrow, recovery, accessibility }, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
