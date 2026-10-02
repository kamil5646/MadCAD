const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const artifactsDir = path.join(__dirname, '..', 'artifacts');
const screenshotPath = path.join(artifactsDir, 'madcad-under-constraint-diagnostics.png');

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
    width: 1600,
    height: 980,
    show: true,
    webPreferences: { partition: `madcad-under-constraint-${Date.now()}` },
  });
  window.setContentSize(1600, 917);
  try {
    await fs.mkdir(artifactsDir, { recursive: true });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    await waitFor(window, `document.querySelector('.modeling-shell') && window.__madcadVerifyLoadConstraintFixture`, 'interfejs aplikacji');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button.confirm')?.click()`);
    await waitFor(window, `!document.querySelector('.license-info-dialog')`, 'zamknięcie informacji licencyjnej');
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadConstraintFixture()`);
    await waitFor(window, `document.querySelector('.sketch-solver-status.under-constrained:not(:disabled)')`, 'status niedowiązania');
    await window.webContents.executeJavaScript(`document.querySelector('.sketch-solver-status').click()`);
    await waitFor(window, `document.querySelectorAll('.sketch-freedom-modes button').length > 2`, 'lista stopni swobody');
    await new Promise((resolve) => setTimeout(resolve, 250));
    const state = await window.webContents.executeJavaScript(`(() => {
      const panel = document.querySelector('.sketch-freedom-panel');
      const viewport = document.querySelector('.model-viewport');
      const panelRect = panel.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      const status = document.querySelector('.sketch-solver-status');
      const modes = [...panel.querySelectorAll('.sketch-freedom-modes button')].map((button) => button.textContent.trim());
      return {
        status: status.textContent.trim(),
        expanded: status.getAttribute('aria-expanded'),
        heading: panel.querySelector('header')?.textContent.trim(),
        modes,
        suggestions: panel.querySelector('footer')?.textContent.trim() || '',
        rect: { width: panelRect.width, height: panelRect.height, left: panelRect.left, top: panelRect.top },
        display: getComputedStyle(panel).display,
        visibility: getComputedStyle(panel).visibility,
        insideViewport: panelRect.left >= viewportRect.left && panelRect.top >= viewportRect.top && panelRect.right <= viewportRect.right && panelRect.bottom <= viewportRect.bottom,
      };
    })()`);
    await fs.writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    if (state.expanded !== 'true' || !state.status.includes('DOF') || !state.heading.includes('Pozostałe stopnie swobody') || !state.suggestions.includes('Co dodać') || !state.insideViewport) {
      throw new Error(`Niepełna diagnostyka niedowiązania: ${JSON.stringify(state)}`);
    }

    // Driving dimension from the keyboard: D on a selected segment, typed value replaces the default, Enter confirms.
    await window.webContents.executeJavaScript(`document.querySelector('.sketch-freedom-panel header button')?.click()`);
    await window.webContents.executeJavaScript(`window.__madcadVerifySketchSelection(window.__madcadConstraintFixtureIds.horizontal, 'replace')`);
    await waitFor(window, `document.body.textContent.includes('1 element szkicu')`, 'zaznaczony odcinek');
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'D' });
    window.webContents.sendInputEvent({ type: 'char', keyCode: 'd' });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'D' });
    await waitFor(window, `document.querySelector('.sketch-dimension-dialog input') === document.activeElement`, 'okno wymiaru po klawiszu D');
    const initialSelection = await window.webContents.executeJavaScript(`(() => { const input = document.activeElement; return { value: input.value, start: input.selectionStart, end: input.selectionEnd }; })()`);
    if (initialSelection.start !== 0 || initialSelection.end !== initialSelection.value.length || !initialSelection.value) throw new Error(`Wartość wymiaru nie jest zaznaczona: ${JSON.stringify(initialSelection)}`);
    await window.webContents.insertText('12');
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
    await waitFor(window, `!document.querySelector('.sketch-dimension-dialog') && window.__madcadVerifyDocumentState?.sketches?.[0]?.dimensions?.length === 1`, 'wymiar zatwierdzony Enterem');
    const dimension = await window.webContents.executeJavaScript(`(() => { const sketch = window.__madcadVerifyDocumentState.sketches[0]; const dimension = sketch.dimensions[0]; return { ...dimension, value: sketch.constraints.find((item) => item.id === dimension.constraintId)?.value }; })()`);
    if (String(dimension.value) !== '12') throw new Error(`Wpisana wartość nie zastąpiła domyślnej: ${JSON.stringify(dimension)}`);
    // The dimension is drawn at the geometry and clicking its value opens the editor.
    await waitFor(window, `window.__madcadVerifySketchDimensionLabels?.().some((label) => label.text === '12')`, 'etykieta wymiaru w widoku');
    const label = await window.webContents.executeJavaScript(`window.__madcadVerifySketchDimensionLabels().find((item) => item.text === '12')`);
    const point = { x: Math.round(label.x), y: Math.round(label.y) };
    const hitElement = await window.webContents.executeJavaScript(`document.elementFromPoint(${point.x}, ${point.y})?.tagName`);
    if (hitElement !== 'CANVAS') throw new Error(`Etykieta wymiaru jest zasłonięta przez ${hitElement}.`);
    window.webContents.sendInputEvent({ type: 'mouseDown', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    window.webContents.sendInputEvent({ type: 'mouseUp', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    await waitFor(window, `document.querySelector('.sketch-constraint-editor input')?.value === '12'`, 'edytor wartości po kliknięciu etykiety');
    await fs.writeFile(screenshotPath.replace('.png', '-dimension.png'), (await window.webContents.capturePage()).toPNG());
    process.stdout.write(`${JSON.stringify({ screenshotPath, ...state, dimension, label }, null, 2)}\n`);
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    app.exit(1);
  }
});
