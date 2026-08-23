const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-command-customization.png');

async function waitFor(window, expression, label, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

async function clickByText(window, selector, text) {
  return window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll(${JSON.stringify(selector)})].find((item) => item.textContent.trim().includes(${JSON.stringify(text)}));
    if (!button) return false;
    button.click();
    return true;
  })()`);
}

async function setInput(window, selector, value) {
  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!input) throw new Error('Brak pola: ' + ${JSON.stringify(selector)});
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-command-settings-${Date.now()}` } });
  window.setContentSize(1440, 837);
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'interfejs aplikacji');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    if (!(await clickByText(window, '.workspace-tabs button', 'NARZĘDZIA'))) throw new Error('Nie znaleziono karty Narzędzia.');
    if (!(await clickByText(window, '.ribbon-tool, .ribbon-overflow-menu button', 'Aliasy'))) throw new Error('Nie znaleziono narzędzia Aliasy.');
    await waitFor(window, `document.querySelector('.command-customization-panel')`, 'panel aliasów');

    await setInput(window, 'input[aria-label="Alias polecenia Linia"]', 'XL');
    await setInput(window, 'input[aria-label="Klawisz polecenia Linia"]', 'G');
    await setInput(window, 'input[aria-label="Klawisz polecenia Okrąg"]', 'G');
    await waitFor(window, `document.querySelector('.command-customization-errors') && document.querySelector('.command-customization-panel footer button.confirm').disabled`, 'wykrycie konfliktu skrótu');
    await setInput(window, 'input[aria-label="Klawisz polecenia Okrąg"]', 'C');
    await waitFor(window, `!document.querySelector('.command-customization-errors') && !document.querySelector('.command-customization-panel footer button.confirm').disabled`, 'poprawne ustawienia');
    const layout = await window.webContents.executeJavaScript(`(() => {
      const rect = document.querySelector('.command-customization-panel').getBoundingClientRect();
      return { rows: document.querySelectorAll('.command-customization-row').length, insideViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight, horizontalOverflow: document.documentElement.scrollWidth > innerWidth };
    })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    if (!(await clickByText(window, '.command-customization-panel footer button', 'Zapisz'))) throw new Error('Nie znaleziono zapisu ustawień.');
    await waitFor(window, `JSON.parse(localStorage.getItem('madcad:command-customization:v1')).commands.Linia.alias === 'XL'`, 'zapis ustawień');
    await window.webContents.executeJavaScript(`document.querySelector('.command-customization-panel header button').click()`);

    await waitFor(window, `typeof window.__madcadVerifyLoadTopologyFixture === 'function'`, 'fixture szkicu');
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTopologyFixture('XY')`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entityData?.length > 0`, 'dokument fixture');
    await window.webContents.executeJavaScript(`window.__madcadVerifyOpenFirstSketch()`);
    await waitFor(window, `document.querySelector('.ribbon-tool[aria-label^="Linia."]')?.title.includes('G')`, 'nowy skrót w tooltipie');
    await window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }))`);
    await waitFor(window, `window.__madcadVerifyDocumentState.command?.type === 'line'`, 'bezpośredni klawisz G');
    await window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
    await waitFor(window, `!window.__madcadVerifyDocumentState.command`, 'anulowanie polecenia');
    await setInput(window, '#madcad-command-line', 'XL');
    await window.webContents.executeJavaScript(`document.querySelector('#madcad-command-line').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`);
    await waitFor(window, `window.__madcadVerifyDocumentState.command?.type === 'line'`, 'niestandardowy alias XL');

    const result = { screenshotPath, ...layout, conflictRejected: true, persisted: true, directKey: true, alias: true, tooltip: true };
    if (layout.rows < 15 || !layout.insideViewport || layout.horizontalOverflow) throw new Error(`Niepoprawny panel aliasów: ${JSON.stringify(result)}`);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
