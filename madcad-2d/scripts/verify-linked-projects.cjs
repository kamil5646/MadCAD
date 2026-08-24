const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-linked-projects.png');

async function waitFor(window, expression, label, timeoutMs = 45000) {
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

async function clickByText(window, selector, text) {
  return window.webContents.executeJavaScript(`(() => { const target = [...document.querySelectorAll(${JSON.stringify(selector)})].find((item) => item.textContent.includes(${JSON.stringify(text)})); target?.click(); return Boolean(target); })()`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'verify-linked-projects-preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      partition: `madcad-linked-projects-${Date.now()}`,
    },
  });
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `typeof window.__madcadVerifyDocumentState === 'object'`, 'interfejs modelowania');
    await click(window, '.license-info-dialog button.confirm');
    if (!(await clickByText(window, '.ribbon-tool, .ribbon-overflow-menu button', 'Menedżer'))) throw new Error('Nie znaleziono menedżera komponentów.');
    await waitFor(window, `document.querySelector('[data-component-action="link-project"]')`, 'panel komponentów');
    await click(window, '[data-component-action="link-project"]');
    await waitFor(window, `window.__madcadVerifyDocumentState.linkedProjects?.length === 1 && window.__madcadVerifyDocumentState.bodyIds?.length === 1 && document.querySelector('[data-linked-project-state="current"]')`, 'utworzone łącze i proxy STEP');
    const initial = await window.webContents.executeJavaScript(`({ featureId: window.__madcadVerifyDocumentState.linkedProjects[0].proxyFeatureIds[0], width: window.__madcadVerifyDocumentState.bodyIds.length })`);

    await window.webContents.executeJavaScript(`window.desktopApp.verifyLinkedProjectChange()`);
    await click(window, '.component-panel header button');
    await clickByText(window, '.ribbon-tool, .ribbon-overflow-menu button', 'Menedżer');
    await waitFor(window, `document.querySelector('[data-linked-project-state="changed"]')`, 'wykryta zmiana źródła');
    await click(window, '[data-linked-project-action="refresh"]');
    await waitFor(window, `document.querySelector('[data-linked-project-state="current"]') && window.__madcadVerifyDocumentState.linkedProjects[0].sourceHash === '${'2'.repeat(64)}'`, 'odświeżone proxy');
    const refreshedId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.linkedProjects[0].proxyFeatureIds[0]`);
    if (refreshedId !== initial.featureId) throw new Error('Odświeżenie zmieniło stabilne ID proxy.');
    await click(window, '#undoProjectBtn');
    await waitFor(window, `window.__madcadVerifyDocumentState.linkedProjects[0].sourceHash === '${'1'.repeat(64)}'`, 'Undo odświeżenia');
    await click(window, '#redoProjectBtn');
    await waitFor(window, `window.__madcadVerifyDocumentState.linkedProjects[0].sourceHash === '${'2'.repeat(64)}'`, 'Redo odświeżenia');

    await window.webContents.executeJavaScript(`window.desktopApp.verifyLinkedProjectMissing()`);
    await click(window, '.component-panel header button');
    await clickByText(window, '.ribbon-tool, .ribbon-overflow-menu button', 'Menedżer');
    await waitFor(window, `document.querySelector('[data-linked-project-state="missing"]')`, 'brakujący plik źródłowy');
    await click(window, '[data-linked-project-action="repair"]');
    await waitFor(window, `document.querySelector('[data-linked-project-state="current"]') && window.__madcadVerifyDocumentState.bodyIds.length === 1`, 'naprawione łącze');
    await click(window, '[data-component-action="pack-and-go"]');
    await waitFor(window, `document.querySelector('.workspace-notice')?.textContent.includes('manifest SHA-256')`, 'utworzona paczka Pack & Go');
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());

    const result = await window.webContents.executeJavaScript(`(() => {
      const panel = document.querySelector('.component-panel');
      const rect = panel.getBoundingClientRect();
      return { linkedProjects: window.__madcadVerifyDocumentState.linkedProjects.length, bodies: window.__madcadVerifyDocumentState.bodyIds.length, state: document.querySelector('.linked-project-card')?.dataset.linkedProjectState, packAndGo: document.querySelector('.workspace-notice')?.textContent.includes('manifest SHA-256') || false, horizontalOverflow: document.documentElement.scrollWidth > innerWidth, panelVisible: rect.width > 0 && rect.height > 0 };
    })()`);
    Object.assign(result, { stableProxyId: refreshedId === initial.featureId, screenshotPath });
    if (result.linkedProjects !== 1 || result.bodies !== 1 || result.state !== 'current' || !result.packAndGo || result.horizontalOverflow || !result.panelVisible || !result.stableProxyId) throw new Error(`Niepoprawny przepływ linkowanego projektu: ${JSON.stringify(result)}`);

    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'en' } });
    await waitFor(window, `typeof window.__madcadVerifyDocumentState === 'object'`, 'angielski interfejs modelowania');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    if (!(await clickByText(window, '.ribbon-tool, .ribbon-overflow-menu button', 'Manager'))) throw new Error('The component manager was not available in English.');
    await waitFor(window, `document.querySelector('[data-component-action="link-project"]')?.textContent.includes('Link project')`, 'angielski panel linkowania');
    const englishPanel = await window.webContents.executeJavaScript(`(() => {
      const panel = document.querySelector('.component-panel');
      const text = panel?.textContent || '';
      return { visible: Boolean(panel), linkAction: document.querySelector('[data-component-action="link-project"]')?.textContent.trim() || '', packAndGo: document.querySelector('[data-component-action="pack-and-go"]')?.textContent.trim() || '', polishLeak: /Linkuj projekt|Projekt linkowany|Napraw łącze/.test(text) };
    })()`);
    if (!englishPanel.visible || englishPanel.polishLeak || !englishPanel.linkAction.includes('Link project') || !englishPanel.packAndGo.includes('Pack & Go')) throw new Error(`Niepełne tłumaczenie panelu linków: ${JSON.stringify(englishPanel)}`);
    result.englishPanel = englishPanel;
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
