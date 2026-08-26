const path = require('node:path');
const { app, BrowserWindow } = require('electron');

async function waitFor(window, expression, label, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error(`Przekroczono czas oczekiwania na: ${label}.`);
}

const distance = (first, second) => Math.hypot(...first.map((value, index) => value - second[index]));
const vector = (camera) => camera.position.map((value, index) => value - camera.target[index]);
const approximatelyEqual = (first, second, tolerance = 1e-4) => distance(first, second) <= tolerance;

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1500,
    height: 900,
    show: true,
    webPreferences: { partition: `madcad-viewport-navigation-${Date.now()}` },
  });
  const rendererMessages = [];
  window.webContents.on('console-message', (details) => {
    if (details.level === 'error') rendererMessages.push(details.message);
  });
  let exitCode = 0;
  try {
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'pl' } });
    window.focus();
    window.webContents.debugger.attach('1.3');
    await waitFor(window, `Boolean(document.querySelector('.license-info-dialog'))`, 'komunikat startowy');
    await window.webContents.executeJavaScript(`document.querySelector('.license-info-dialog button[aria-label="Zamknij"]')?.click()`);
    await waitFor(window, `!document.querySelector('.license-info-dialog')`, 'zamknięcie komunikatu startowego');
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready'`, 'start silnika CAD');
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTopologyFixture?.('XY')`);
    await waitFor(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === 1 && window.__madcadCameraState`, 'model i kamera');

    const viewport = await window.webContents.executeJavaScript(`(() => {
      const canvas = document.querySelector('.model-viewport canvas');
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.round(rect.left + rect.width * 0.58),
        y: Math.round(rect.top + rect.height * 0.56),
        hit: document.elementFromPoint(Math.round(rect.left + rect.width * 0.58), Math.round(rect.top + rect.height * 0.56))?.className || document.elementFromPoint(Math.round(rect.left + rect.width * 0.58), Math.round(rect.top + rect.height * 0.56))?.tagName,
        orbitTitle: document.querySelector('.navigation-bar [aria-label="Orbita"]')?.title || '',
        panTitle: document.querySelector('.navigation-bar [aria-label="Przesuń widok"]')?.title || '',
        activeButtons: document.querySelectorAll('.navigation-bar button.active').length,
        cursor: getComputedStyle(canvas).cursor,
      };
    })()`);
    if (!viewport.orbitTitle.includes('Shift') || !viewport.panTitle.includes('kółko') || viewport.activeButtons !== 0 || viewport.cursor !== 'crosshair') {
      throw new Error(`Niepoprawny domyślny tryb nawigacji: ${JSON.stringify(viewport)}`);
    }

    const camera = () => window.webContents.executeJavaScript(`structuredClone(window.__madcadCameraState)`);
    const waitForCameraToSettle = async (timeoutMs = 2500) => {
      const startedAt = Date.now();
      let previous = await camera();
      let stableSamples = 0;
      while (Date.now() - startedAt < timeoutMs) {
        await new Promise((resolve) => setTimeout(resolve, 80));
        const current = await camera();
        const movement = distance(previous.position, current.position) + distance(previous.target, current.target);
        if (movement <= 0.003) stableSamples += 1;
        else stableSamples = 0;
        if (stableSamples >= 3) return current;
        previous = current;
      }
      throw new Error(`Kamera nie ustabilizowała się po ${timeoutMs} ms.`);
    };
    const drag = async ({ button, modifiers = [], dx, dy }) => {
      const buttons = { left: 1, right: 2, middle: 4 }[button];
      const modifierMask = modifiers.includes('shift') ? 8 : 0;
      await window.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mousePressed', x: viewport.x, y: viewport.y, button, buttons, clickCount: 1, modifiers: modifierMask });
      for (let step = 1; step <= 5; step += 1) {
        await window.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.round(viewport.x + dx * step / 5), y: Math.round(viewport.y + dy * step / 5), button, buttons, modifiers: modifierMask });
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      await window.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseReleased', x: viewport.x + dx, y: viewport.y + dy, button, buttons: 0, clickCount: 1, modifiers: modifierMask });
      return waitForCameraToSettle();
    };

    const initial = await waitForCameraToSettle();
    const afterLeft = await drag({ button: 'left', dx: 90, dy: 35 });
    if (!approximatelyEqual(initial.position, afterLeft.position) || !approximatelyEqual(initial.target, afterLeft.target)) {
      throw new Error('Lewy przycisk zmienił kamerę w domyślnym trybie wyboru.');
    }

    const afterPan = await drag({ button: 'middle', dx: 110, dy: 45 });
    if (approximatelyEqual(afterLeft.target, afterPan.target, 0.01)
      || !approximatelyEqual(vector(afterLeft), vector(afterPan), 0.02)) {
      const navigation = await window.webContents.executeJavaScript(`window.__madcadViewportNavigationState`);
      throw new Error(`Środkowy przycisk nie wykonał czystego pan: ${JSON.stringify({ afterLeft, afterPan, navigation })}`);
    }

    const afterOrbit = await drag({ button: 'middle', modifiers: ['shift'], dx: 95, dy: -55 });
    const orbitDistance = distance(afterPan.position, afterPan.target);
    const targetDriftTolerance = Math.max(6, orbitDistance * 0.025);
    const distanceTolerance = Math.max(0.1, orbitDistance * 0.002);
    if (!approximatelyEqual(afterPan.target, afterOrbit.target, targetDriftTolerance)
      || approximatelyEqual(vector(afterPan), vector(afterOrbit), 0.05)
      || Math.abs(orbitDistance - distance(afterOrbit.position, afterOrbit.target)) > distanceTolerance) {
      throw new Error(`Shift + środkowy przycisk nie wykonał orbity: ${JSON.stringify({ afterPan, afterOrbit })}`);
    }

    const distanceBeforeWheel = distance(afterOrbit.position, afterOrbit.target);
    await window.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseWheel', x: viewport.x + 80, y: viewport.y - 40, deltaY: 180, deltaX: 0, buttons: 0 });
    const afterWheel = await waitForCameraToSettle();
    const distanceAfterWheel = distance(afterWheel.position, afterWheel.target);
    if (Math.abs(distanceAfterWheel - distanceBeforeWheel) < 0.05) throw new Error('Kółko myszy nie zmieniło powiększenia.');

    process.stdout.write(`${JSON.stringify({
      ok: true,
      defaultMode: 'selection',
      leftCameraChange: distance(initial.position, afterLeft.position),
      panTargetChange: distance(afterLeft.target, afterPan.target),
      orbitDirectionChange: distance(vector(afterPan), vector(afterOrbit)),
      zoomDistanceBefore: distanceBeforeWheel,
      zoomDistanceAfter: distanceAfterWheel,
    })}\n`);
  } catch (error) {
    exitCode = 1;
    process.stderr.write(`${error.stack || error.message}\n${JSON.stringify({ rendererMessages })}\n`);
  } finally {
    if (window.webContents.debugger.isAttached()) window.webContents.debugger.detach();
    window.destroy();
    app.exit(exitCode);
  }
});
