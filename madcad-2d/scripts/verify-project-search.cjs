const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const screenshotPath = path.join(__dirname, '..', 'artifacts', 'madcad-project-search.png');

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

async function prepareFixture(window) {
  await waitFor(window, `typeof window.__madcadVerifyLoadTimelineFixture === 'function'`, 'fixture historii');
  await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTimelineFixture()`);
  await waitFor(window, `window.__madcadVerifyDocumentState?.features === 3 && window.__madcadVerifyDocumentState?.projectSearchCount >= 8 && document.querySelector('.engine-status.ready')`, 'indeks gotowego projektu', 45000);
}

async function setQuery(window, value) {
  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('[data-project-search-input]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
}

async function openWithKeyboard(window) {
  await window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true, bubbles: true, cancelable: true }))`);
  await waitFor(window, `document.activeElement?.matches('[data-project-search-input]')`, 'paleta otwarta skrótem');
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { partition: `madcad-search-verifier-${Date.now()}` } });
  window.setContentSize(1440, 837);
  try {
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'interfejs aplikacji');
    await click(window, '.license-info-dialog button.confirm');
    await prepareFixture(window);

    await click(window, '#projectSearchBtn');
    await waitFor(window, `document.activeElement?.matches('[data-project-search-input]')`, 'paleta Idź do');
    await setQuery(window, 'otwor centralny');
    await waitFor(window, `document.querySelectorAll('[data-project-search-result]').length === 1 && document.querySelector('[data-project-search-kind="feature"]')?.textContent.includes('Otwór centralny')`, 'wyszukiwanie bez polskiego znaku');

    const layout = await window.webContents.executeJavaScript(`(() => {
      const palette = document.querySelector('.project-search-palette')?.getBoundingClientRect();
      const stage = document.querySelector('.modeling-stage')?.getBoundingClientRect();
      return {
        results: document.querySelectorAll('[data-project-search-result]').length,
        focused: document.activeElement?.matches('[data-project-search-input]'),
        centered: Boolean(palette && stage && palette.left >= stage.left && palette.right <= stage.right && palette.top >= stage.top && palette.bottom <= stage.bottom),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    if (layout.results !== 1 || !layout.focused || !layout.centered || layout.overflow) throw new Error(`Niepoprawny układ palety: ${JSON.stringify(layout)}`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());

    const targetId = await window.webContents.executeJavaScript(`document.querySelector('[data-project-search-kind="feature"]')?.getAttribute('data-project-search-result')`);
    await window.webContents.executeJavaScript(`document.querySelector('[data-project-search-input]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))`);
    await waitFor(window, `!document.querySelector('.project-search-palette') && window.__madcadVerifyDocumentState?.selection?.kind === 'feature' && window.__madcadVerifyDocumentState?.selection?.id === ${JSON.stringify(targetId)}`, 'nawigacja Enterem do operacji');

    await openWithKeyboard(window);
    await setQuery(window, 'szerokosc');
    await waitFor(window, `document.querySelectorAll('[data-project-search-kind="parameter"]').length === 1`, 'wyszukiwanie parametru');
    await window.webContents.executeJavaScript(`document.querySelector('[data-project-search-input]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.command?.type === 'parameters' && window.__madcadVerifyDocumentState?.selection?.kind === 'settings'`, 'nawigacja do parametrów');

    await openWithKeyboard(window);
    await setQuery(window, 'szkic podstawy');
    await waitFor(window, `document.querySelectorAll('[data-project-search-kind="sketch"]').length === 1`, 'wyszukiwanie szkicu');
    const sketchId = await window.webContents.executeJavaScript(`document.querySelector('[data-project-search-kind="sketch"]')?.getAttribute('data-project-search-result')`);
    await window.webContents.executeJavaScript(`document.querySelector('[data-project-search-input]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'sketch' && window.__madcadVerifyDocumentState?.selection?.id === ${JSON.stringify(sketchId)}`, 'nawigacja do szkicu');

    await openWithKeyboard(window);
    await setQuery(window, 'bryla');
    await waitFor(window, `document.querySelectorAll('[data-project-search-kind="body"]').length === 2`, 'wyszukiwanie brył po typie');
    const bodyId = await window.webContents.executeJavaScript(`document.querySelector('[data-project-search-kind="body"]')?.getAttribute('data-project-search-result')`);
    await click(window, `[data-project-search-result="${bodyId}"]`);
    await waitFor(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'body' && window.__madcadVerifyDocumentState?.selection?.id === ${JSON.stringify(bodyId)}`, 'nawigacja do bryły');

    await openWithKeyboard(window);
    await setQuery(window, 'operacja');
    await waitFor(window, `document.querySelectorAll('[data-project-search-kind="feature"]').length === 3`, 'wyszukiwanie po typie');
    const before = await window.webContents.executeJavaScript(`document.querySelector('[data-project-search-result].active')?.getAttribute('data-project-search-result')`);
    await window.webContents.executeJavaScript(`document.querySelector('[data-project-search-input]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))`);
    await waitFor(window, `document.querySelector('[data-project-search-result].active')?.getAttribute('data-project-search-result') !== ${JSON.stringify(before)}`, 'wybór strzałką');
    await window.webContents.executeJavaScript(`document.querySelector('[data-project-search-input]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))`);
    await waitFor(window, `!document.querySelector('.project-search-palette')`, 'zamknięcie Escape');

    await openWithKeyboard(window);
    await setQuery(window, 'zzzz-brak-wynikow');
    await waitFor(window, `document.querySelector('.project-search-empty') && document.querySelectorAll('[data-project-search-result]').length === 0`, 'stan bez wyników');

    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'en' } });
    await waitFor(window, `document.querySelector('.modeling-shell')`, 'angielski interfejs');
    await click(window, '.license-info-dialog button.confirm');
    await prepareFixture(window);
    await click(window, '#projectSearchBtn');
    await waitFor(window, `document.querySelector('.project-search-palette')?.textContent.includes('GO TO')`, 'angielska paleta');
    await setQuery(window, 'feature');
    await waitFor(window, `document.querySelectorAll('[data-project-search-kind="feature"]').length === 3`, 'angielskie wyszukiwanie po typie');
    const englishInspection = await window.webContents.executeJavaScript(`(() => {
      const panel = document.querySelector('.project-search-palette');
      const attributes = [...panel.querySelectorAll('*')].flatMap((node) => ['title', 'aria-label', 'placeholder'].map((name) => node.getAttribute(name) || ''));
      const content = [panel.textContent, ...attributes].join(' ');
      return { ok: !/(IDŹ DO|Wyszukaj|Szukaj w projekcie|Wyniki wyszukiwania|Wystąpienie|Arkusz|Brak pasujących|Spróbuj nazwy|wybór|przejdź|zamknij)/i.test(content), content };
    })()`);
    if (!englishInspection.ok) throw new Error(`Paleta zawiera nieprzetłumaczony tekst systemowy: ${englishInspection.content}`);

    process.stdout.write(`${JSON.stringify({ ...layout, targetId, sketchId, bodyId, parameterNavigation: true, keyboardNavigation: true, noResults: true, englishPanel: true, screenshotPath }, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
