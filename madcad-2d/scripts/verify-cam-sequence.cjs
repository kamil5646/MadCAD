const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const reportPath = path.join(__dirname, '..', 'artifacts', 'madcad-cam-sequence.html');
const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-cam-sequence.png');
const timeoutMs = process.env.CI ? 90000 : 45000;

async function waitFor(window, expression, label) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error(`Przekroczono czas oczekiwania: ${label}`);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-cam-sequence-${Date.now()}` } });
  window.setContentSize(1440, 837);
  try {
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `typeof window.__madcadVerifyLoadTimelineFixture === 'function'`, 'gotowy interfejs');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click(); window.__madcadVerifyLoadTimelineFixture()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 2`, 'dwie bryły modelu');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.workspace-tabs button')].find((button) => button.textContent.trim() === 'WYTWARZANIE').click()`);
    await waitFor(window, `document.querySelector('[data-tool-label="Nowy Setup"]')`, 'obszar CAM');
    await window.webContents.executeJavaScript(`document.querySelector('[data-tool-label="Nowy Setup"]').click()`);
    await waitFor(window, `JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups.length === 1`, 'pierwszy Setup');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.manufacturing-page-tabs button')].find((button) => button.textContent.includes('Operacje')).click()`);
    await window.webContents.executeJavaScript(`document.querySelector('.manufacturing-add-actions button').click()`);
    await waitFor(window, `JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[0].operations.length === 1`, 'pierwsze planowanie');
    await window.webContents.executeJavaScript(`document.querySelector('.manufacturing-panel > header button').click()`);
    await waitFor(window, `JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups.length === 2`, 'drugi Setup');
    await window.webContents.executeJavaScript(`(() => { const control = [...document.querySelectorAll('.manufacturing-form label')].find((label) => label.querySelector('span')?.textContent === 'Układ roboczy').querySelector('select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(control, 'G55'); control.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await waitFor(window, `JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[1].workOffset === 'G55'`, 'drugi układ roboczy G55');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.manufacturing-page-tabs button')].find((button) => button.textContent.includes('Operacje')).click()`);
    await window.webContents.executeJavaScript(`document.querySelector('.manufacturing-add-actions button').click()`);
    await waitFor(window, `JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[1].operations.length === 1`, 'drugie planowanie');
    await window.webContents.executeJavaScript(`document.querySelector('#undoProjectBtn').click()`);
    await waitFor(window, `JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[1].operations.length === 0`, 'Cofnij drugi program');
    await window.webContents.executeJavaScript(`document.querySelector('#redoProjectBtn').click()`);
    await waitFor(window, `JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups[1].operations.length === 1`, 'Ponów drugi program');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.manufacturing-page-tabs button')].find((button) => button.textContent.includes('Kontrola')).click()`);
    await waitFor(window, `document.querySelectorAll('.manufacturing-sequence > div').length === 2 && document.querySelector('.manufacturing-sequence')?.textContent.includes('G55')`, 'raport dwóch mocowań');
    await window.webContents.executeJavaScript(`document.querySelector('.manufacturing-sequence').scrollIntoView({ block: 'center' })`);
    await waitFor(window, `document.querySelector('.manufacturing-page-tabs button[aria-selected="true"]')?.textContent.includes('Kontrola') && document.querySelector('.manufacturing-sequence')?.getBoundingClientRect().top < window.innerHeight`, 'widoczny raport w zakładce Kontrola');
    await new Promise((resolve) => setTimeout(resolve, 400));
    const sequenceVisible = await window.webContents.executeJavaScript(`(() => { const panel = document.querySelector('.manufacturing-sequence'); const bounds = panel.getBoundingClientRect(); return bounds.top < window.innerHeight && bounds.bottom > 0 && panel.querySelectorAll('.invalid').length === 2; })()`);
    if (!sequenceVisible) throw new Error('Raport mocowań nie jest widoczny lub pomija niekompletne operacje.');
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());

    const download = new Promise((resolve, reject) => window.webContents.session.once('will-download', (_event, item) => {
      item.setSavePath(reportPath);
      item.once('done', (_downloadEvent, status) => status === 'completed' ? resolve() : reject(new Error(`Eksport raportu mocowań: ${status}`)));
    }));
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.manufacturing-sequence button')].find((button) => button.textContent.includes('Raport mocowań')).click()`);
    await download;
    const html = await fs.readFile(reportPath, 'utf8');
    if (!html.includes('Raport kolejnych mocowań CAM') || !html.includes('G54') || !html.includes('G55') || !html.includes('nie generuje ruchów sondy') || !html.includes('WYMAGA POPRAWY')) throw new Error('Raport HTML pomija Setup, WCS albo ostrzeżenie operatora.');

    await window.webContents.executeJavaScript(`window.__madcadVerifyReopenCurrentDocument()`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && JSON.parse(window.__madcadGetSessionExport()).manufacturing.setups.length === 2`, 'ponowne otwarcie projektu');
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.workspace-tabs button')].find((button) => button.textContent.trim() === 'WYTWARZANIE').click()`);
    await window.webContents.executeJavaScript(`[...document.querySelectorAll('.manufacturing-page-tabs button')].find((button) => button.textContent.includes('Kontrola')).click()`);
    await waitFor(window, `document.querySelectorAll('.manufacturing-sequence > div').length === 2 && document.querySelector('.manufacturing-sequence')?.textContent.includes('G55')`, 'raport po ponownym otwarciu');
    process.stdout.write(`${JSON.stringify({ ok: true, reportPath, screenshotPath, setupCount: 2, reportBytes: Buffer.byteLength(html) }, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
