const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-ribbon-overflow.png');

async function waitFor(window, expression, label, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    show: true,
    webPreferences: { partition: `madcad-ribbon-verifier-${Date.now()}` },
  });
  window.setContentSize(1100, 697);

  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'interfejs aplikacji');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await waitFor(window, `!document.querySelector('.license-info-dialog')`, 'zamknięcie informacji licencyjnej');
    window.setContentSize(1090, 697);
    await new Promise((resolve) => setTimeout(resolve, 100));
    window.setContentSize(1100, 697);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const layoutSnapshot = await window.webContents.executeJavaScript(`({
      innerWidth,
      ribbonWidth: document.querySelector('.modeling-ribbon')?.clientWidth || 0,
      groups: [...document.querySelectorAll('.ribbon-group')].map((item) => ({ label: item.getAttribute('aria-label'), width: item.getBoundingClientRect().width, hidden: item.hidden })),
      trigger: Boolean(document.querySelector('.ribbon-overflow-trigger')),
    })`);
    process.stdout.write(`[ribbon] ${JSON.stringify(layoutSnapshot)}\n`);
    await waitFor(window, `document.querySelectorAll('.ribbon-group[hidden]').length > 0 && document.querySelector('.ribbon-overflow-trigger')`, 'responsywna wstążka');
    await window.webContents.executeJavaScript(`document.querySelector('.ribbon-overflow-trigger').click()`);
    await waitFor(window, `document.querySelector('.ribbon-overflow-menu')`, 'menu przepełnienia');
    await new Promise((resolve) => setTimeout(resolve, 150));

    const result = await window.webContents.executeJavaScript(`(() => {
      const menu = document.querySelector('.ribbon-overflow-menu');
      const trigger = document.querySelector('.ribbon-overflow-trigger');
      const stickyGroup = document.querySelector('.ribbon-sticky-groups .ribbon-group');
      const rect = menu.getBoundingClientRect();
      return {
        expanded: trigger.getAttribute('aria-expanded') === 'true',
        groups: [...menu.querySelectorAll('.ribbon-overflow-section > strong')].map((item) => item.textContent.trim()),
        tools: menu.querySelectorAll('[role="menuitem"]').length,
        hiddenGroups: document.querySelectorAll('.ribbon-group[hidden]').length,
        stickyLabel: stickyGroup?.querySelector('.ribbon-label')?.textContent.trim() || '',
        insideViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    if (!result.expanded || !result.groups.length || !result.tools || !result.hiddenGroups || !result.stickyLabel || !result.insideViewport || result.horizontalOverflow) {
      throw new Error(`Niepoprawne menu przepełnienia wstążki: ${JSON.stringify(result)}`);
    }
    process.stdout.write(`${JSON.stringify({ screenshotPath, ...result }, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
