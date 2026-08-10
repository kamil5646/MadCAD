const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const outputPath = path.join(__dirname, '..', 'artifacts', 'modeling-checkpoint.png');
const emptyOutputPath = path.join(__dirname, '..', 'artifacts', 'madcad-qa-empty.png');
const sketchOutputPath = path.join(__dirname, '..', 'artifacts', 'madcad-qa-sketch.png');
const directOutputPath = path.join(__dirname, '..', 'artifacts', 'madcad-direct-extrude.png');
const narrowOutputPath = path.join(__dirname, '..', 'artifacts', 'madcad-qa-narrow.png');
const verificationStartedAt = Date.now();
const isCi = Boolean(process.env.CI);
const modelingTimeoutMs = isCi ? 60000 : 20000;

async function waitForModel(window, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await window.webContents.executeJavaScript(`(() => {
      const status = document.querySelector('.engine-status');
      return {
        shell: Boolean(document.querySelector('.modeling-shell')),
        status: status?.className || '',
        text: status?.textContent?.trim() || '',
        bodies: document.querySelectorAll('.model-browser .body-color').length,
      };
    })()`);
    if (result.status.includes('ready') || result.status.includes('error')) return result;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Przekroczono czas oczekiwania na silnik CAD.');
}

async function verifyAccessibilityAndScale(window) {
  const checks = [];
  for (const zoomFactor of [1, 1.5, 2]) {
    window.webContents.setZoomFactor(zoomFactor);
    await new Promise((resolve) => setTimeout(resolve, 250));
    await window.webContents.executeJavaScript(`document.querySelector('.modeling-shell button:not([disabled])')?.focus()`);
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Tab' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const state = await window.webContents.executeJavaScript(`(() => {
      const shell = document.querySelector('.modeling-shell');
      const buttons = [...shell.querySelectorAll('button:not([disabled])')];
      if (!shell.contains(document.activeElement) || !document.activeElement.matches('button, input, select, [tabindex]')) buttons[0]?.focus();
      const focusTarget = document.activeElement;
      const focusStyle = focusTarget ? getComputedStyle(focusTarget) : null;
      const unnamedButtons = buttons.filter((button) => !((button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent || '').trim())).length;
      return {
        language: document.documentElement.lang,
        width: innerWidth,
        height: innerHeight,
        documentOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        shellOverflow: shell.scrollWidth > shell.clientWidth + 1,
        toolbarVisible: Boolean(document.querySelector('.ribbon-tool')),
        timelineVisible: Boolean(document.querySelector('.timeline')),
        unnamedButtons,
        focusReachable: shell.contains(focusTarget) && focusTarget.matches('button, input, select, [tabindex]'),
        focusControl: focusTarget ? focusTarget.tagName + '.' + (focusTarget.className || '') : '',
        focusOutline: (focusStyle?.outlineWidth || '0') + ' ' + (focusStyle?.outlineStyle || 'none'),
      };
    })()`);
    if (state.documentOverflow || state.shellOverflow || !state.toolbarVisible || !state.timelineVisible || state.unnamedButtons || !state.focusReachable) {
      throw new Error(`Accessibility/DPI check failed at ${zoomFactor * 100}%: ${JSON.stringify(state)}`);
    }
    checks.push({ zoomPercent: zoomFactor * 100, ...state });
  }
  window.webContents.setZoomFactor(1);
  return checks;
}

async function verifyEnglishModelingUi() {
  const englishWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    webPreferences: { partition: `madcad-verifier-en-${Date.now()}` },
  });
  try {
    await englishWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1', verifyLanguage: 'en' } });
    await waitForModel(englishWindow);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const state = await englishWindow.webContents.executeJavaScript(`(() => ({
      language: document.documentElement.lang,
      createSketch: [...document.querySelectorAll('.ribbon-label')].some((item) => item.textContent.trim() === 'Create sketch'),
      browser: document.querySelector('.browser-heading strong')?.textContent.trim(),
      engineReady: document.querySelector('.engine-status')?.textContent.includes('ready'),
      tutorialButton: Boolean(document.querySelector('button[title="First part tutorial"]')),
      polishPrimaryLabel: [...document.querySelectorAll('.ribbon-label')].some((item) => item.textContent.trim() === 'Utwórz szkic'),
    }))()`);
    if (state.language !== 'en' || !state.createSketch || state.browser !== 'BROWSER' || !state.engineReady || !state.tutorialButton || state.polishPrimaryLabel) {
      throw new Error(`English UI smoke check failed: ${JSON.stringify(state)}`);
    }
    return state;
  } finally {
    englishWindow.destroy();
  }
}

function assertClose(actual, expected, tolerance, label) {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected} +/- ${tolerance}, received ${actual}.`);
  }
}

async function verifyExport(window, format, timeoutMs = isCi ? 90000 : 45000) {
  const exportPromise = window.webContents.executeJavaScript(`(async () => {
    if (typeof window.__madcadVerifyExport !== 'function') throw new Error('Brak testowego interfejsu eksportu.');
    const result = await window.__madcadVerifyExport('${format.toLowerCase()}', { validateRoundTrip: true });
    return { sizes: result.buffers.map((buffer) => buffer.byteLength), roundTrip: result.roundTrip };
  })()`);
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error(`Przekroczono czas eksportu ${format}.`)), timeoutMs));
  const result = await Promise.race([exportPromise, timeout]);
  const sizes = result.sizes;
  if (!sizes.length || sizes.some((size) => size < 100)) throw new Error(`Eksport ${format} zwrócił pusty plik.`);
  if (result.roundTrip.length !== sizes.length || result.roundTrip.some((entry) => !entry.valid)) {
    throw new Error(`Round-trip ${format} exceeded tolerance: ${JSON.stringify(result.roundTrip)}`);
  }
  return result;
}

async function verifyThreeMfExport(window) {
  const result = await window.webContents.executeJavaScript(`(async () => {
    if (typeof window.__madcadVerifyExport !== 'function') throw new Error('Brak testowego interfejsu eksportu.');
    const exported = await window.__madcadVerifyExport('3mf');
    const bytes = new Uint8Array(exported[0]);
    return { size: bytes.byteLength, signature: Array.from(bytes.slice(0, 4)) };
  })()`);
  if (result.size < 300 || result.signature[0] !== 0x50 || result.signature[1] !== 0x4b) throw new Error(`Invalid 3MF archive: ${JSON.stringify(result)}`);
  return result;
}

async function verifyThreeMfImport(window) {
  const before = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.bodies?.length || 0`);
  await window.webContents.executeJavaScript(`(async () => {
    const exported = await window.__madcadVerifyExport('3mf');
    const input = [...document.querySelectorAll('input[type="file"]')].find((item) => item.accept.includes('.3mf'));
    const key = input && Object.keys(input).find((item) => item.startsWith('__reactProps'));
    const handler = key && input[key]?.onChange;
    if (!handler) throw new Error('Brak interfejsu importu modelu.');
    await handler({ target: { files: [new File([exported[0]], 'roundtrip.3mf', { type: 'model/3mf' })], value: '' } });
  })()`);
  await waitForUi(window, `Boolean(document.querySelector('.import-model-dialog .confirm'))`, '3MF import dialog', modelingTimeoutMs);
  await window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('.import-model-dialog .confirm');
    const key = button && Object.keys(button).find((item) => item.startsWith('__reactProps'));
    if (!key || typeof button[key]?.onClick !== 'function') throw new Error('Brak potwierdzenia importu 3MF.');
    button[key].onClick();
  })()`);
  await waitForUi(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.bodies?.length === ${before + 1}`, '3MF imported body', isCi ? 90000 : 45000);
  return window.webContents.executeJavaScript(`(() => {
    const body = window.__madcadVerifyEngineState.bodies.at(-1);
    return { bodies: window.__madcadVerifyEngineState.bodies.length, dimensions: body.metrics.dimensions, volume: body.metrics.volume };
  })()`);
}

async function waitForUi(window, expression, label, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Interfejs nie osiągnął stanu: ${label}.`);
}

async function runUiFlow(window) {
  const progress = (message) => process.stdout.write(`[verify] ${message}\n`);
  const clickTool = (label) => window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.ribbon-tool')].find((item) => item.querySelector('.ribbon-label')?.textContent === ${JSON.stringify(label)});
    if (!button) throw new Error('Brak przycisku: ${label}');
    if (button.disabled) throw new Error('Przycisk jest nieaktywny: ${label}');
    const key = Object.keys(button).find((item) => item.startsWith('__reactProps'));
    const handler = key && button[key]?.onClick;
    if (typeof handler !== 'function') throw new Error('Brak procedury przycisku: ${label}');
    handler({ currentTarget: button, target: button });
  })()`);

  const clickByTitle = (title) => window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('.modeling-shell button[title=${JSON.stringify(title)}]');
    if (!button) throw new Error('Brak przycisku: ${title}');
    const key = Object.keys(button).find((item) => item.startsWith('__reactProps'));
    const handler = key && button[key]?.onClick;
    if (typeof handler !== 'function') throw new Error('Brak procedury przycisku: ${title}');
    handler({ currentTarget: button, target: button });
  })()`);
  const sendShortcut = (key, shiftKey = false) => window.webContents.executeJavaScript(`(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: ${JSON.stringify(key)},
      ctrlKey: true,
      shiftKey: ${Boolean(shiftKey)},
      bubbles: true,
      cancelable: true,
    }));
  })()`);
  const sendKey = (key) => window.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true, cancelable: true }))`);
  const setCommandField = (label, value) => window.webContents.executeJavaScript(`(() => {
    const expectedLabel = ${JSON.stringify(label)};
    const expectedValue = ${JSON.stringify(String(value))};
    const deadline = performance.now() + 2000;
    return new Promise((resolve, reject) => {
      const updateWhenReady = () => {
        const fields = [...document.querySelectorAll('.command-field')];
        const field = fields.find((item) => item.firstElementChild?.textContent === expectedLabel);
        const input = field?.querySelector('input, select');
        if (!input) {
          if (performance.now() < deadline) {
            requestAnimationFrame(updateWhenReady);
            return;
          }
          const available = fields.map((item) => item.firstElementChild?.textContent).filter(Boolean).join(', ');
          reject(new Error('Brak pola: ${label}. Dostępne: ' + available));
          return;
        }
        const key = Object.keys(input).find((item) => item.startsWith('__reactProps'));
        const handler = key && input[key]?.onChange;
        if (typeof handler !== 'function') {
          reject(new Error('Brak procedury pola: ${label}'));
          return;
        }
        handler({ target: { value: ${JSON.stringify(value)} } });
        requestAnimationFrame(() => setTimeout(() => {
          const updatedField = [...document.querySelectorAll('.command-field')].find((item) => item.firstElementChild?.textContent === expectedLabel);
          const updatedInput = updatedField?.querySelector('input, select');
          if (String(updatedInput?.value) !== expectedValue) reject(new Error('Pole nie przyjęło wartości: ${label}'));
          else resolve();
        }, 30));
      };
      updateWhenReady();
    });
  })()`);
  const setCommandCheckbox = (label, checked) => window.webContents.executeJavaScript(`(() => {
    const field = [...document.querySelectorAll('.command-field')].find((item) => item.firstElementChild?.textContent === ${JSON.stringify(label)});
    const input = field?.querySelector('input[type="checkbox"]');
    if (!input) throw new Error('Brak pola wyboru: ${label}');
    const key = Object.keys(input).find((item) => item.startsWith('__reactProps'));
    const handler = key && input[key]?.onChange;
    if (typeof handler !== 'function') throw new Error('Brak procedury pola wyboru: ${label}');
    handler({ target: { checked: ${Boolean(checked)} } });
    return new Promise((resolve, reject) => requestAnimationFrame(() => setTimeout(() => {
      const updated = [...document.querySelectorAll('.command-field')].find((item) => item.firstElementChild?.textContent === ${JSON.stringify(label)})?.querySelector('input[type="checkbox"]');
      if (Boolean(updated?.checked) !== ${Boolean(checked)}) reject(new Error('Pole wyboru nie przyjęło wartości: ${label}'));
      else resolve();
    }, 30)));
  })()`);
  const confirmDialog = () => window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('.command-dialog .confirm');
    const key = Object.keys(button).find((item) => item.startsWith('__reactProps'));
    button[key].onClick();
  })()`);
  const confirmParameters = () => window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('.parameters-dialog .confirm');
    const key = Object.keys(button).find((item) => item.startsWith('__reactProps'));
    button[key].onClick();
  })()`);
  const clickDialogButton = (label) => window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.command-dialog footer button')].find((item) => item.textContent.includes(${JSON.stringify(label)}));
    if (!button) throw new Error('Missing dialog button: ${label}');
    const key = Object.keys(button).find((item) => item.startsWith('__reactProps'));
    button[key].onClick();
  })()`);
  const pickPlane = (plane) => window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.plane-options button')].find((item) => item.textContent.includes(${JSON.stringify(plane)}));
    if (!button) throw new Error('Brak płaszczyzny ${plane}');
    const key = Object.keys(button).find((item) => item.startsWith('__reactProps'));
    button[key].onClick();
  })()`);
  const toggleSketchOption = (label) => window.webContents.executeJavaScript(`(() => {
    const row = [...document.querySelectorAll('.sketch-palette label')].find((item) => item.querySelector('span')?.textContent === ${JSON.stringify(label)});
    const input = row?.querySelector('input[type="checkbox"]');
    if (!input) throw new Error('Brak opcji szkicu: ${label}');
    const key = Object.keys(input).find((item) => item.startsWith('__reactProps'));
    input[key].onChange({ target: { checked: !input.checked } });
  })()`);
  const editTimelineFeature = async (index, title = 'Wyciągnięcie') => {
    await window.webContents.executeJavaScript(`(() => {
      const button = document.querySelectorAll('.timeline-item')[${index}];
      if (!button) throw new Error('Brak operacji osi czasu: ${index}');
      button.click();
    })()`);
    await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'feature'`, `wybór operacji ${index + 1}`);
    await clickTool('Edytuj');
    await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes(${JSON.stringify(title)})`, `edycja ${title} ${index + 1}`);
  };
  const dragDirectExtrude = async () => {
    await window.webContents.executeJavaScript(`(async () => {
      const canvas = document.querySelector('.model-viewport canvas');
      const handle = document.querySelector('.direct-handle-hit');
      const rect = canvas.getBoundingClientRect();
      const point = window.__madcadDirectHandlePoint || { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
      const key = Object.keys(handle).find((item) => item.startsWith('__reactProps'));
      const props = handle[key];
      const event = (y) => ({ clientX: point.x, clientY: y, pointerId: 9, pointerType: 'pen', currentTarget: handle, preventDefault() {}, stopPropagation() {}, altKey: false });
      props.onPointerDown(event(point.y));
      for (let offset = 20; offset <= 120; offset += 20) {
        props.onPointerMove(event(point.y - offset));
        await new Promise((resolve) => setTimeout(resolve, 35));
      }
      props.onPointerUp(event(point.y - 120));
    })()`);
  };

  const sketchScreenPoint = (entityId) => window.webContents.executeJavaScript(`(() => {
    const point = window.__madcadSketchEntityScreenPoints?.[${JSON.stringify(entityId)}];
    if (!point) throw new Error('Missing sketch screen point: ${entityId}');
    return point;
  })()`);
  const sendMouse = async (type, point, modifiers = []) => {
    window.webContents.sendInputEvent({ type, x: Math.round(point.x), y: Math.round(point.y), button: 'left', clickCount: 1, modifiers });
    await new Promise((resolve) => setTimeout(resolve, 45));
  };
  const clickSketchEntity = async (entityId, modifiers = []) => {
    const point = await sketchScreenPoint(entityId);
    await sendMouse('mouseDown', point, modifiers);
    await sendMouse('mouseUp', point, modifiers);
  };
  const dragSketchEntity = async (entityId, offsetX, offsetY) => {
    if (isCi) {
      await window.webContents.executeJavaScript(`(() => {
        if (typeof window.__madcadVerifySketchSelection !== 'function' || typeof window.__madcadVerifyMoveSketch !== 'function') {
          throw new Error('Missing deterministic sketch drag verification hooks.');
        }
        window.__madcadVerifySketchSelection([${JSON.stringify(entityId)}], 'replace');
        window.__madcadVerifyMoveSketch({ ids: [${JSON.stringify(entityId)}], dx: 3, dy: 0 });
      })()`);
      await new Promise((resolve) => setTimeout(resolve, 100));
      return;
    }
    const point = await sketchScreenPoint(entityId);
    await sendMouse('mouseDown', point);
    for (let step = 1; step <= 4; step += 1) {
      await sendMouse('mouseMove', { x: point.x + (offsetX * step / 4), y: point.y + (offsetY * step / 4) });
    }
    await sendMouse('mouseUp', { x: point.x + offsetX, y: point.y + offsetY });
  };
  const selectWithBox = (start, end) => window.webContents.executeJavaScript(`(() => {
    if (typeof window.__madcadVerifySketchBoxSelection !== 'function') throw new Error('Missing deterministic sketch box selection hook.');
    return window.__madcadVerifySketchBoxSelection({
      startX: ${Number(start.x)},
      startY: ${Number(start.y)},
      endX: ${Number(end.x)},
      endY: ${Number(end.y)},
    }, 'replace');
  })()`);

  const addSketchPoint = async (point, expectedEntities) => {
    await window.webContents.executeJavaScript(`(() => {
      if (typeof window.__madcadVerifySketchPoint !== 'function') throw new Error('Missing sketch point test hook.');
      window.__madcadVerifySketchPoint(${JSON.stringify(point)});
    })()`);
    await waitForUi(
      window,
      `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === ${expectedEntities}`,
      `sketch entities ${expectedEntities}`,
    );
  };

  progress('first printable part tutorial');
  await clickByTitle('Samouczek pierwszej części');
  await waitForUi(window, `document.querySelectorAll('.tutorial-body ol li').length === 8 && document.querySelectorAll('.tutorial-body aside li').length >= 6`, 'samouczek i ograniczenia alpha');
  const tutorial = await window.webContents.executeJavaScript(`({ steps: document.querySelectorAll('.tutorial-body ol li').length, limitations: document.querySelectorAll('.tutorial-body aside li').length })`);
  await sendKey('Escape');
  await waitForUi(window, `!document.querySelector('.tutorial-dialog')`, 'zamknięty samouczek');

  progress('SVG sketch import, undo, redo and reopen');
  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt dla importu SVG');
  await clickTool('Utwórz szkic');
  await waitForUi(window, `document.querySelector('.plane-picker')`, 'wybór płaszczyzny importu');
  await pickPlane('XY');
  await window.webContents.executeJavaScript(`(async () => {
    const input = [...document.querySelectorAll('input[type="file"]')].find((item) => item.accept.includes('.svg'));
    const key = input && Object.keys(input).find((item) => item.startsWith('__reactProps'));
    const handler = key && input[key]?.onChange;
    if (!handler) throw new Error('Brak interfejsu importu SVG/DXF.');
    const svg = '<svg width="40mm" height="20mm" viewBox="0 0 40 20"><rect x="0" y="0" width="40" height="20"/></svg>';
    await handler({ target: { files: [new File([svg], 'plate.svg', { type: 'image/svg+xml' })], value: '' } });
  })()`);
  await waitForUi(window, `document.querySelector('.import-sketch-dialog .confirm')`, 'dialog importu SVG');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 8 && window.__madcadVerifyDocumentState?.sketches?.at(-1)?.profiles === 1`, 'zaimportowany profil SVG');
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 0`, 'undo importu SVG');
  await sendShortcut('z', true);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 8`, 'redo importu SVG');
  await waitForUi(window, `(() => { const saved = JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null'); return saved?.sketches?.at(-1)?.entities?.length === 8; })()`, 'autozapis importu SVG');
  const importedRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave?.()`);
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${importedRevision} && window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 8`, 'ponownie otwarty import SVG', modelingTimeoutMs);
  const sketchImport = { format: 'svg', entities: 8, profiles: 1, undoRedo: true, reopened: true };

  progress('collinear and symmetry constraints');
  await window.webContents.executeJavaScript(`window.__madcadVerifyLoadConstraintFixture?.()`);
  await waitForUi(window, `window.__madcadConstraintFixtureIds && window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 18`, 'fixture więzów P1');
  await window.webContents.executeJavaScript(`window.__madcadVerifySketchSelection(window.__madcadConstraintFixtureIds.collinear, 'replace')`);
  await waitForUi(window, `!([...document.querySelectorAll('.ribbon-tool')].find((item) => item.querySelector('.ribbon-label')?.textContent === 'Współliniowe')?.disabled)`, 'aktywny przycisk współliniowości');
  await clickTool('Współliniowe');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.constraints?.some((item) => item.type === 'collinear')`, 'więz collinear');
  const collinearSolved = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.sketches[0].entityData.filter((item) => window.__madcadConstraintFixtureIds.targetPointIds.includes(item.id)).every((item) => Math.abs(Number(item.geometry.y)) < 1e-6)`);
  if (!collinearSolved) throw new Error('UI collinear did not solve target line.');
  await window.webContents.executeJavaScript(`window.__madcadVerifySketchSelection(window.__madcadConstraintFixtureIds.symmetry, 'replace')`);
  await waitForUi(window, `!([...document.querySelectorAll('.ribbon-tool')].find((item) => item.querySelector('.ribbon-label')?.textContent === 'Symetria')?.disabled)`, 'aktywny przycisk symetrii');
  await clickTool('Symetria');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.constraints?.some((item) => item.type === 'symmetry')`, 'więz symmetry');
  const symmetrySolved = await window.webContents.executeJavaScript(`(() => { const point = window.__madcadVerifyDocumentState.sketches[0].entityData.find((item) => item.id === window.__madcadConstraintFixtureIds.reflectedPointId); return Math.abs(Number(point.geometry.x) - 3) < 1e-6 && Math.abs(Number(point.geometry.y) - 2) < 1e-6; })()`);
  if (!symmetrySolved) throw new Error('UI symmetry did not reflect target point.');
  await window.webContents.executeJavaScript(`window.__madcadVerifySketchSelection(window.__madcadConstraintFixtureIds.curvature, 'replace')`);
  await waitForUi(window, `!([...document.querySelectorAll('.ribbon-tool')].find((item) => item.querySelector('.ribbon-label')?.textContent === 'Krzywizna G2')?.disabled)`, 'aktywny przycisk krzywizny G2');
  await clickTool('Krzywizna G2');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.constraints?.some((item) => item.type === 'curvature')`, 'więz curvature');
  const curvatureSolved = await window.webContents.executeJavaScript(`(() => { const point = window.__madcadVerifyDocumentState.sketches[0].entityData.find((item) => item.id === window.__madcadConstraintFixtureIds.curvatureCenterId); return Math.abs(Number(point.geometry.x) - 20) < 1e-6 && Math.abs(Number(point.geometry.y)) < 1e-6; })()`);
  if (!curvatureSolved) throw new Error('UI curvature did not align arc osculating circles.');
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.constraints?.length === 2`, 'undo curvature');
  await sendShortcut('z', true);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.constraints?.length === 3`, 'redo curvature');
  await waitForUi(window, `(() => { const saved = JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null'); return ['collinear', 'symmetry', 'curvature'].every((type) => saved?.sketches?.[0]?.constraints?.some((item) => item.type === type)); })()`, 'autozapis więzów P1');
  const constraintFlow = { collinear: collinearSolved, symmetry: symmetrySolved, curvature: curvatureSolved, undoRedo: true };

  progress('ordinate and arc length dimensions');
  await window.webContents.executeJavaScript(`window.__madcadVerifyLoadDimensionFixture?.()`);
  await waitForUi(window, `window.__madcadDimensionFixtureIds && window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 5`, 'fixture wymiarów P1');
  await window.webContents.executeJavaScript(`window.__madcadVerifySketchSelection([window.__madcadDimensionFixtureIds.pointId], 'replace')`);
  await waitForUi(window, `!([...document.querySelectorAll('.ribbon-tool')].find((item) => item.querySelector('.ribbon-label')?.textContent === 'Ordinate X')?.disabled)`, 'aktywny wymiar ordinate X');
  await clickTool('Ordinate X');
  await waitForUi(window, `document.querySelector('.sketch-dimension-dialog')?.textContent.includes('Wymiar ordinate X')`, 'dialog ordinate X');
  await setCommandField('Wartość', '12');
  await confirmDialog();
  await waitForUi(window, `(() => { const sketch = window.__madcadVerifyDocumentState?.sketches?.[0]; const point = sketch?.entityData?.find((item) => item.id === window.__madcadDimensionFixtureIds.pointId); return sketch?.constraints?.some((item) => item.type === 'coordinateX') && Math.abs(Number(point?.geometry?.x) - 12) < 1e-6; })()`, 'zastosowany ordinate X');
  await window.webContents.executeJavaScript(`window.__madcadVerifySketchSelection([window.__madcadDimensionFixtureIds.pointId], 'replace')`);
  await clickTool('Ordinate Y');
  await waitForUi(window, `document.querySelector('.sketch-dimension-dialog')?.textContent.includes('Wymiar ordinate Y')`, 'dialog ordinate Y');
  await setCommandField('Wartość', '-7');
  await confirmDialog();
  await waitForUi(window, `(() => { const sketch = window.__madcadVerifyDocumentState?.sketches?.[0]; const point = sketch?.entityData?.find((item) => item.id === window.__madcadDimensionFixtureIds.pointId); return sketch?.constraints?.some((item) => item.type === 'coordinateY') && Math.abs(Number(point?.geometry?.y) + 7) < 1e-6; })()`, 'zastosowany ordinate Y');
  await window.webContents.executeJavaScript(`window.__madcadVerifySketchSelection([window.__madcadDimensionFixtureIds.arcId], 'replace')`);
  await waitForUi(window, `!([...document.querySelectorAll('.ribbon-tool')].find((item) => item.querySelector('.ribbon-label')?.textContent === 'Długość łuku')?.disabled)`, 'aktywny wymiar długości łuku');
  await clickTool('Długość łuku');
  await waitForUi(window, `document.querySelector('.sketch-dimension-dialog')?.textContent.includes('Wymiar długości łuku')`, 'dialog długości łuku');
  await setCommandField('Wartość', String(Math.PI * 10));
  await confirmDialog();
  await waitForUi(window, `(() => { const sketch = window.__madcadVerifyDocumentState?.sketches?.[0]; const center = sketch?.entityData?.find((item) => item.id === window.__madcadDimensionFixtureIds.centerId); const start = sketch?.entityData?.find((item) => item.id === window.__madcadDimensionFixtureIds.startId); return sketch?.constraints?.some((item) => item.type === 'arcLength') && Math.abs(Math.hypot(Number(start?.geometry?.x) - Number(center?.geometry?.x), Number(start?.geometry?.y) - Number(center?.geometry?.y)) - 20) < 1e-5; })()`, 'zastosowana długość łuku');
  await waitForUi(window, `document.querySelector('.sketch-constraint-editor input')`, 'edytor długości łuku na szkicu');
  await window.webContents.executeJavaScript(`(() => {
    const form = document.querySelector('.sketch-constraint-editor');
    const input = form?.querySelector('input');
    const button = form?.querySelector('button[type="submit"]');
    if (!input || !button) throw new Error('Brak edytora wybranego wymiaru.');
    input.value = String(Math.PI * 12.5);
    button.click();
  })()`);
  await waitForUi(window, `(() => { const sketch = window.__madcadVerifyDocumentState?.sketches?.[0]; const center = sketch?.entityData?.find((item) => item.id === window.__madcadDimensionFixtureIds.centerId); const start = sketch?.entityData?.find((item) => item.id === window.__madcadDimensionFixtureIds.startId); return Math.abs(Math.hypot(Number(start?.geometry?.x) - Number(center?.geometry?.x), Number(start?.geometry?.y) - Number(center?.geometry?.y)) - 25) < 1e-5; })()`, 'edycja długości łuku na szkicu');
  await sendShortcut('z');
  await waitForUi(window, `(() => { const sketch = window.__madcadVerifyDocumentState?.sketches?.[0]; const center = sketch?.entityData?.find((item) => item.id === window.__madcadDimensionFixtureIds.centerId); const start = sketch?.entityData?.find((item) => item.id === window.__madcadDimensionFixtureIds.startId); return Math.abs(Math.hypot(Number(start?.geometry?.x) - Number(center?.geometry?.x), Number(start?.geometry?.y) - Number(center?.geometry?.y)) - 20) < 1e-5; })()`, 'undo edycji długości łuku');
  await sendShortcut('z', true);
  await waitForUi(window, `(() => { const sketch = window.__madcadVerifyDocumentState?.sketches?.[0]; const center = sketch?.entityData?.find((item) => item.id === window.__madcadDimensionFixtureIds.centerId); const start = sketch?.entityData?.find((item) => item.id === window.__madcadDimensionFixtureIds.startId); return Math.abs(Math.hypot(Number(start?.geometry?.x) - Number(center?.geometry?.x), Number(start?.geometry?.y) - Number(center?.geometry?.y)) - 25) < 1e-5; })()`, 'redo edycji długości łuku');
  await waitForUi(window, `(() => { const saved = JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null'); return saved?.sketches?.[0]?.dimensions?.length === 3 && saved.sketches[0].constraints.some((item) => item.type === 'arcLength'); })()`, 'autozapis wymiarów P1');
  await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave?.()`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.dimensions?.length === 3 && window.__madcadVerifyDocumentState.sketches[0].constraints.some((item) => item.type === 'coordinateX') && window.__madcadVerifyDocumentState.sketches[0].constraints.some((item) => item.type === 'coordinateY') && window.__madcadVerifyDocumentState.sketches[0].constraints.some((item) => item.type === 'arcLength')`, 'ponownie otwarte wymiary P1');
  const dimensionFlow = { ordinateX: true, ordinateY: true, arcLength: true, inlineEdit: true, undoRedo: true, reopened: true };

  progress('rectangular and circular sketch patterns');
  await window.webContents.executeJavaScript(`window.__madcadVerifyLoadPatternFixture?.('rectangular')`);
  await waitForUi(window, `window.__madcadPatternFixtureIds && window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 8`, 'fixture szyku prostokątnego');
  await window.webContents.executeJavaScript(`window.__madcadVerifySketchSelection(window.__madcadPatternFixtureIds.lineIds, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.ids?.length === window.__madcadPatternFixtureIds?.lineIds?.length`, 'selekcja szyku prostokątnego');
  await clickTool('Szyk szkicu');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Szyk szkicu')`, 'dialog szyku prostokątnego');
  await setCommandField('Kolumny', '3');
  await setCommandField('Wiersze', '1');
  await setCommandField('Odstęp X', '12');
  await setCommandField('Pomiń wystąpienia', '3');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 16 && window.__madcadVerifyDocumentState.sketches[0].profiles === 2`, 'szyk prostokątny z pominięciem');
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 8`, 'undo szyku prostokątnego');
  await sendShortcut('z', true);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 16`, 'redo szyku prostokątnego');

  await window.webContents.executeJavaScript(`window.__madcadVerifyLoadPatternFixture?.('circular')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 8 && window.__madcadVerifyDocumentState.sketches[0].profiles === 1`, 'fixture szyku kołowego');
  await window.webContents.executeJavaScript(`window.__madcadVerifySketchSelection(window.__madcadPatternFixtureIds.lineIds, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.ids?.length === window.__madcadPatternFixtureIds?.lineIds?.length`, 'selekcja szyku kołowego');
  await clickTool('Szyk szkicu');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Typ szyku')`, 'dialog szyku kołowego');
  await setCommandField('Typ szyku', 'circular');
  await setCommandField('Wystąpienia', '4');
  await setCommandField('Środek X', '0');
  await setCommandField('Środek Y', '0');
  await setCommandField('Kąt całkowity', '360');
  await setCommandField('Pomiń wystąpienia', '3');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 24 && window.__madcadVerifyDocumentState.sketches[0].profiles === 3`, 'szyk kołowy z pominięciem');
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 8`, 'undo szyku kołowego');
  await sendShortcut('z', true);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 24`, 'redo szyku kołowego');
  await waitForUi(window, `(() => { const saved = JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null'); return saved?.sketches?.[0]?.entities?.length === 24 && saved.sketches[0].profiles?.length === 3; })()`, 'autozapis szyku kołowego');
  await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave?.()`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 24 && window.__madcadVerifyDocumentState.sketches[0].profiles === 3`, 'ponownie otwarty szyk kołowy');

  await window.webContents.executeJavaScript(`window.__madcadVerifyLoadPatternFixture?.('path')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 4 && window.__madcadPatternFixtureIds?.sourceIds?.length === 1`, 'fixture szyku po ścieżce');
  await window.webContents.executeJavaScript(`window.__madcadVerifySketchSelection(window.__madcadPatternFixtureIds.sourceIds, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.ids?.length === window.__madcadPatternFixtureIds?.sourceIds?.length`, 'selekcja szyku po ścieżce');
  await clickTool('Szyk szkicu');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Typ szyku')`, 'dialog szyku po ścieżce');
  await setCommandField('Typ szyku', 'path');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Orientacja')`, 'pola szyku po ścieżce');
  await setCommandField('Wystąpienia', '4');
  await setCommandField('Orientacja', 'path');
  await setCommandField('Pomiń wystąpienia', '3');
  await confirmDialog();
  await waitForUi(window, `(() => { const data = window.__madcadVerifyDocumentState?.sketches?.[0]?.entityData || []; const copies = data.filter((item) => item.type === 'point' && ![window.__madcadPatternFixtureIds.sourceIds[0]].includes(item.id) && item.role === 'standard'); return data.length === 6 && copies.some((item) => Math.abs(Number(item.geometry.x) - 10) < 1e-6) && copies.some((item) => Math.abs(Number(item.geometry.x) - 30) < 1e-6); })()`, 'szyk po ścieżce z pominięciem');
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 4`, 'undo szyku po ścieżce');
  await sendShortcut('z', true);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 6`, 'redo szyku po ścieżce');
  await waitForUi(window, `JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null')?.sketches?.[0]?.entities?.length === 6`, 'autozapis szyku po ścieżce');
  await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave?.()`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.entities === 6`, 'ponownie otwarty szyk po ścieżce');
  const patternFlow = { rectangular: true, circular: true, path: true, skippedOccurrences: true, undoRedo: true, reopened: true };

  progress('line and command termination');
  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt dla linii');
  await clickTool('Utwórz szkic');
  await waitForUi(window, `document.querySelector('.plane-picker')`, 'wybór płaszczyzny linii');
  await pickPlane('XY');
  await clickTool('Linia');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Linia')`, 'polecenie linii');
  await addSketchPoint([0, 0], 1);
  await addSketchPoint([10, 0], 3);
  await waitForUi(window, `!document.querySelector('.command-dialog')`, 'zakończenie pojedynczej linii');
  await clickTool('Polilinia');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Polilinia')`, 'polilinia przed Escape');
  await sendKey('Escape');
  await waitForUi(window, `!document.querySelector('.command-dialog')`, 'Escape kończy polilinię');
  await clickTool('Polilinia');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Polilinia')`, 'polilinia przed Enter');
  await addSketchPoint([0, 10], 4);
  await sendKey('Enter');
  await waitForUi(window, `!document.querySelector('.command-dialog')`, 'Enter kończy polilinię');

  progress('open chain thin extrude');
  const openThinLineId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.sketches[0].entityData.find((entity) => entity.type === 'line').id`);
  await window.webContents.executeJavaScript(`window.__madcadVerifySketchSelection?.([${JSON.stringify(openThinLineId)}], 'replace')`);
  await clickTool('Thin Extrude');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Wyciągnięcie') && document.querySelector('.command-dialog')?.textContent.includes('Zakończenie')`, 'podgląd otwartego Thin Extrude');
  progress('open chain thin cancel');
  await clickDialogButton('Anuluj');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.features === 0 && document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'anulowanie otwartego Thin Extrude');
  progress('open chain thin reopen');
  await window.webContents.executeJavaScript(`window.__madcadVerifySketchSelection?.([${JSON.stringify(openThinLineId)}], 'replace')`);
  await clickTool('Thin Extrude');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Zakończenie')`, 'ponowny podgląd otwartego Thin Extrude');
  await setCommandField('Odległość', '5');
  await setCommandField('Grubość ścianki', '2');
  await setCommandField('Zakończenie', 'butt');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.openEntityIds?.length === 1 && window.__madcadVerifyDocumentState.featureData[0].thin === true && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 100) < 0.01`, 'otwarty Thin Extrude z prostym zakończeniem', modelingTimeoutMs);
  await editTimelineFeature(0);
  await setCommandField('Zakończenie', 'square');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.endCap === 'square' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 120) < 0.01`, 'edycja otwartego Thin Extrude na wydłużone zakończenie', modelingTimeoutMs);
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.endCap === 'butt' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 100) < 0.01`, 'undo zakończenia Thin Extrude', modelingTimeoutMs);
  await sendShortcut('y');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.endCap === 'square' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 120) < 0.01`, 'redo zakończenia Thin Extrude', modelingTimeoutMs);
  await waitForUi(window, `JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null')?.features?.[0]?.endCap === 'square'`, 'autozapis otwartego Thin Extrude');
  const openThinRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave?.()`);
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${openThinRevision} && window.__madcadVerifyDocumentState?.featureData?.[0]?.endCap === 'square' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 120) < 0.01`, 'ponownie otwarty Thin Extrude otwartego łańcucha', modelingTimeoutMs);

  progress('polyline L profile');
  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt dla polilinii');
  await clickTool('Utwórz szkic');
  await waitForUi(window, `document.querySelector('.plane-picker')`, 'wybór płaszczyzny polilinii');
  await pickPlane('XY');
  await clickTool('Polilinia');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Polilinia')`, 'polecenie polilinii');
  await addSketchPoint([0, 0], 1);
  await setCommandField('Długość', '30');
  await setCommandField('Kąt', '0');
  await new Promise((resolve) => setTimeout(resolve, 100));
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 3`, 'dokładny pierwszy segment');
  await addSketchPoint([30, 10], 5);
  await addSketchPoint([10, 10], 7);
  await addSketchPoint([10, 25], 9);
  await clickDialogButton('Cofnij segment');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 7`, 'cofnięcie segmentu polilinii');
  await addSketchPoint([10, 30], 9);
  await addSketchPoint([0, 30], 11);
  await addSketchPoint([0, 0], 12);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.profiles === 1`, 'zamknięty profil L');
  await clickTool('Wybierz');
  const profileInterior = await window.webContents.executeJavaScript(`window.__madcadSketchLocalToScreen?.(5, 5)`);
  await sendMouse('mouseDown', profileInterior);
  await sendMouse('mouseUp', profileInterior);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'profile'`, 'wybór wypełnionego profilu');

  progress('sketch selection and editing');
  const editTargets = await window.webContents.executeJavaScript(`(() => {
    const entities = window.__madcadVerifyDocumentState.sketches.at(-1).entityData;
    const pointAt = (x, y) => entities.find((entity) => entity.type === 'point' && Number(entity.geometry.x) === x && Number(entity.geometry.y) === y)?.id;
    const originPointId = pointAt(0, 0);
    return {
      concavePointId: pointAt(10, 10),
      neighborPointId: pointAt(30, 10),
      originPointId,
      originCornerLineIds: entities.filter((entity) => entity.type === 'line' && entity.pointIds?.includes(originPointId)).map((entity) => entity.id),
      allLineIds: entities.filter((entity) => entity.type === 'line').map((entity) => entity.id),
      lineId: entities.find((entity) => entity.type === 'line')?.id,
    };
  })()`);
  if (!editTargets.concavePointId || !editTargets.neighborPointId || !editTargets.lineId || editTargets.originCornerLineIds.length !== 2) throw new Error(`Missing L-profile edit targets: ${JSON.stringify(editTargets)}`);
  await waitForUi(window, `window.__madcadSketchEntityScreenPoints?.[${JSON.stringify(editTargets.concavePointId)}]`, 'punkty ekranowe szkicu');

  await clickSketchEntity(editTargets.concavePointId);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.ids?.length === 1`, 'zaznaczenie punktu');
  await clickSketchEntity(editTargets.neighborPointId, ['shift']);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.ids?.length === 2`, 'wielokrotny wybór Shift');
  await clickSketchEntity(editTargets.neighborPointId, ['control']);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.ids?.length === 1`, 'przełączenie wyboru Ctrl');

  await clickTool('Wybierz');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'sketch'`, 'wyczyszczenie wyboru przed inside');
  const insidePoints = await Promise.all([sketchScreenPoint(editTargets.concavePointId), sketchScreenPoint(editTargets.neighborPointId)]);
  await selectWithBox(
    { x: Math.min(...insidePoints.map((point) => point.x)) - 40, y: Math.min(...insidePoints.map((point) => point.y)) - 40 },
    { x: Math.max(...insidePoints.map((point) => point.x)) + 40, y: Math.max(...insidePoints.map((point) => point.y)) + 40 },
  );
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.ids?.length >= 2`, 'wybór oknem inside');

  await clickTool('Wybierz');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'sketch'`, 'wyczyszczenie wyboru przed crossing');
  const linePoint = await sketchScreenPoint(editTargets.lineId);
  await selectWithBox({ x: linePoint.x + 48, y: linePoint.y - 48 }, { x: linePoint.x - 48, y: linePoint.y + 48 });
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.ids?.includes(${JSON.stringify(editTargets.lineId)})`, 'wybór oknem crossing');
  const crossingPreservedGeometry = await window.webContents.executeJavaScript(`(() => {
    const point = window.__madcadVerifyDocumentState.sketches.at(-1).entityData.find((entity) => entity.id === ${JSON.stringify(editTargets.originPointId)});
    return Number(point.geometry.x) === 0 && Number(point.geometry.y) === 0;
  })()`);
  if (!crossingPreservedGeometry) throw new Error('Crossing selection dragged geometry instead of selecting it.');
  await sendKey('Delete');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.profiles === 0`, 'Delete usuwa zależny profil');
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.profiles === 1`, 'Undo przywraca profil i relacje');
  await sendShortcut('y');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.profiles === 0`, 'Redo ponownie usuwa profil');
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.profiles === 1`, 'drugie Undo przywraca profil');

  await waitForUi(window, `window.__madcadSketchEntityScreenPoints?.[${JSON.stringify(editTargets.concavePointId)}]`, 'odtworzony punkt ekranowy');
  await dragSketchEntity(editTargets.concavePointId, 24, 0);
  await waitForUi(window, `(() => { const point = window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entityData?.find((entity) => entity.id === ${JSON.stringify(editTargets.concavePointId)}); return Number(point?.geometry?.x) !== 10 || Number(point?.geometry?.y) !== 10; })()`, 'przeciągnięcie punktu');
  await sendShortcut('z');
  await waitForUi(window, `(() => { const point = window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entityData?.find((entity) => entity.id === ${JSON.stringify(editTargets.concavePointId)}); return Number(point?.geometry?.x) === 10 && Number(point?.geometry?.y) === 10; })()`, 'Undo przeciągnięcia punktu');

  await waitForUi(window, `window.__madcadSketchEntityScreenPoints?.[${JSON.stringify(editTargets.lineId)}]`, 'odtworzony segment ekranowy');
  await dragSketchEntity(editTargets.lineId, 18, 0);
  await waitForUi(window, `(() => { const point = window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entityData?.find((entity) => entity.id === ${JSON.stringify(editTargets.originPointId)}); return Number(point?.geometry?.x) !== 0 || Number(point?.geometry?.y) !== 0; })()`, 'przeciągnięcie segmentu');
  await sendShortcut('z');
  await waitForUi(window, `(() => { const point = window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entityData?.find((entity) => entity.id === ${JSON.stringify(editTargets.originPointId)}); return Number(point?.geometry?.x) === 0 && Number(point?.geometry?.y) === 0; })()`, 'Undo przeciągnięcia segmentu');

  progress('sketch fillet and chamfer commands');
  await window.webContents.executeJavaScript(`window.__madcadVerifySketchSelection?.(${JSON.stringify(editTargets.originCornerLineIds)}, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.ids?.length === 2`, 'dwie linie narożnika Fillet');
  await clickTool('Fillet szkicu');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Fillet szkicu')`, 'okno Fillet szkicu');
  await setCommandField('Promień', '2');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 15`, 'utworzenie Fillet szkicu');
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 12`, 'Undo Fillet szkicu');
  await window.webContents.executeJavaScript(`window.__madcadVerifySketchSelection?.(${JSON.stringify(editTargets.originCornerLineIds)}, 'replace')`);
  await clickTool('Faza szkicu');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Chamfer szkicu')`, 'okno Chamfer szkicu');
  await setCommandField('Odległość', '3');
  await clickDialogButton('Anuluj');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 12`, 'anulowanie Chamfer szkicu');
  await clickTool('Faza szkicu');
  await setCommandField('Odległość', '3');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 14`, 'utworzenie Chamfer szkicu');
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 12`, 'Undo Chamfer szkicu');

  progress('sketch offset command, cancel and undo');
  await clickSketchEntity(editTargets.lineId);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.ids?.includes(${JSON.stringify(editTargets.lineId)})`, 'zaznaczenie linii Offset');
  await clickTool('Offset');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Offset szkicu')`, 'okno Offset');
  await setCommandField('Odległość', '-2');
  await clickDialogButton('Anuluj');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 12`, 'anulowanie Offset bez zmiany');
  await clickTool('Offset');
  await setCommandField('Odległość', '-2');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 15`, 'utworzenie Offset linii');
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 12`, 'Undo Offset');

  progress('sketch copy transform command');
  await window.webContents.executeJavaScript(`window.__madcadVerifySketchSelection?.(${JSON.stringify(editTargets.allLineIds)}, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.ids?.length === ${editTargets.allLineIds.length}`, 'pełny profil do Copy');
  await clickTool('Transformuj');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Transformuj szkic')`, 'okno transformacji szkicu');
  await setCommandField('Operacja', 'copy');
  await waitForUi(window, `[...document.querySelectorAll('.command-field')].some((item) => item.firstElementChild?.textContent === 'Kopia ΔX')`, 'pola Copy');
  await setCommandField('Kopia ΔX', '50');
  await setCommandField('Kopia ΔY', '0');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 24 && window.__madcadVerifyDocumentState?.sketches?.at(-1)?.profiles === 2`, 'Copy tworzy niezależny profil');
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entities === 12 && window.__madcadVerifyDocumentState?.sketches?.at(-1)?.profiles === 1`, 'Undo Copy');

  await clickSketchEntity(editTargets.concavePointId);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.ids?.includes(${JSON.stringify(editTargets.concavePointId)})`, 'ponowne zaznaczenie wierzchołka');
  await clickTool('Przesuń');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Przesuń geometrię')`, 'dokładne przesunięcie szkicu');
  await setCommandField('Przesunięcie X', '5');
  await setCommandField('Przesunięcie Y', '0');
  await confirmDialog();
  await waitForUi(window, `(() => { const point = window.__madcadVerifyDocumentState?.sketches?.at(-1)?.entityData?.find((entity) => entity.id === ${JSON.stringify(editTargets.concavePointId)}); return Number(point?.geometry?.x) === 15; })()`, 'dokładna zmiana wierzchołka');

  await clickTool('Zakończ szkic');
  await clickTool('Press Pull');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Wyciągnięcie')`, 'wyciągnięcie profilu L');
  await setCommandField('Odległość', '8');
  await new Promise((resolve) => setTimeout(resolve, 100));
  await confirmDialog();
  await waitForUi(window, `Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 4400) < 0.01`, 'bryła ze zmienionego profilu L', modelingTimeoutMs);
  const polylineModel = await window.webContents.executeJavaScript(`(() => ({
    metrics: window.__madcadVerifyEngineState.bodies[0].metrics,
    entities: window.__madcadVerifyDocumentState.sketches[0].entities,
    profiles: window.__madcadVerifyDocumentState.sketches[0].profiles,
    features: window.__madcadVerifyDocumentState.features,
  }))()`);
  assertClose(polylineModel.metrics.area, 1100 + ((95 + Math.sqrt(425)) * 8), 0.01, 'Edited polyline L area');

  progress('topology profiles XY XZ YZ');
  for (const plane of ['XY', 'XZ', 'YZ']) {
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadTopologyFixture?.(${JSON.stringify(plane)})`);
    await waitForUi(window, `Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 5520) < 0.01`, `profil z otworem ${plane}`, modelingTimeoutMs);
  }

  progress('mechanical profiles and exact curved B-Rep');
  const mechanicalFixtures = [
    ['ellipse', Math.PI * 20 * 10 * 3],
    ['ellipticalArc', Math.PI * 20 * 10 * 1.5],
    ['slot', ((30 * 10) + (Math.PI * 25)) * 3],
    ['slotArc', (((Math.PI / 2) * 25 * 10) + (Math.PI * 25)) * 3],
    ['bracket', ((60 * 50) + (Math.PI * 25 * 25 / 2) - ((20 * 8) + (Math.PI * 4 * 4)) - (2 * Math.PI * 4 * 4)) * 3],
    ['spline', null],
    ['conic', null],
  ];
  for (const [kind, expectedVolume] of mechanicalFixtures) {
    const previousRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
    await window.webContents.executeJavaScript(`window.__madcadVerifyLoadMechanicalFixture?.(${JSON.stringify(kind)})`);
    await waitForUi(window, `(window.__madcadVerifyEngineState?.revision || 0) > ${previousRevision} && window.__madcadVerifyEngineState?.status === 'ready'`, `rewizja dokładnej figury ${kind}`, modelingTimeoutMs);
    const actualVolume = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume`);
    progress(`${kind} volume ${actualVolume}`);
    if (expectedVolume === null) {
      if (!(actualVolume > 100)) throw new Error(`Mechanical ${kind} returned invalid volume ${actualVolume}.`);
    } else assertClose(actualVolume, expectedVolume, 0.05, `Mechanical ${kind} volume`);
  }
  progress('fully constrained parametric bracket');
  let previousRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyLoadParametricBracketFixture?.()`);
  await waitForUi(window, `(window.__madcadVerifyEngineState?.revision || 0) > ${previousRevision} && Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 6000) < 0.05`, 'początkowa bryła parametrycznego wspornika', modelingTimeoutMs);
  await waitForUi(window, `document.querySelector('.sketch-solver-status')?.textContent.includes('W pełni związany')`, 'status w pełni związanego wspornika');
  const bracketIds = await window.webContents.executeJavaScript(`window.__madcadParametricBracketIds`);
  previousRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyUpdateConstraint?.(window.__madcadParametricBracketIds.widthConstraintId, '60')`);
  await waitForUi(window, `(window.__madcadVerifyEngineState?.revision || 0) > ${previousRevision} && Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 9000) < 0.05`, 'bryła po zmianie szerokości', modelingTimeoutMs);
  previousRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyUpdateConstraint?.(window.__madcadParametricBracketIds.heightConstraintId, '25')`);
  await waitForUi(window, `(window.__madcadVerifyEngineState?.revision || 0) > ${previousRevision} && Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 7500) < 0.05`, 'bryła po zmianie wysokości', modelingTimeoutMs);
  await waitForUi(window, `(() => { const saved = JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null'); return saved?.sketches?.[0]?.constraints?.some((item) => item.id === window.__madcadParametricBracketIds.heightConstraintId && item.value === '25'); })()`, 'autozapis zmienionych wymiarów');
  previousRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave?.()`);
  await waitForUi(window, `(window.__madcadVerifyEngineState?.revision || 0) > ${previousRevision} && Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 7500) < 0.05`, 'ponownie otwarta bryła wspornika', modelingTimeoutMs);
  const reopenedBracketIds = await window.webContents.executeJavaScript(`(() => ({
    entityIds: window.__madcadVerifyDocumentState.sketches[0].entityData.map((entity) => entity.id),
    profileId: window.__madcadVerifyDocumentState.sketches[0].profileIds[0],
    featureId: window.__madcadVerifyDocumentState.featureIds[0],
  }))()`);
  if (JSON.stringify(reopenedBracketIds.entityIds) !== JSON.stringify(bracketIds.entityIds)
    || reopenedBracketIds.profileId !== bracketIds.profileId
    || reopenedBracketIds.featureId !== bracketIds.featureId) throw new Error(`Parametric bracket lost stable IDs: ${JSON.stringify({ bracketIds, reopenedBracketIds })}`);
  const pointHoleRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyLoadPointHoleFixture?.()`);
  await waitForUi(window, `(window.__madcadVerifyEngineState?.revision || 0) > ${pointHoleRevision} && window.__madcadVerifyEngineState?.status === 'ready'`, 'otwór z punktu referencyjnego', modelingTimeoutMs);
  const pointHoleVolume = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume`);
  assertClose(pointHoleVolume, (40 * 30 * 10) - (Math.PI * 3 * 3 * 10), 0.05, 'Point reference hole volume');

  progress('hole on face positioned from two edges');
  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt dla otworu od krawędzi');
  await clickTool('Prymityw');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Prymityw 3D')`, 'baza otworu od krawędzi');
  await setCommandField('Szerokość', '40');
  await setCommandField('Głębokość', '30');
  await setCommandField('Wysokość', '10');
  await confirmDialog();
  await waitForUi(window, `Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 12000) < 0.05`, 'baza otworu od krawędzi gotowa', modelingTimeoutMs);
  const faceEdgeHoleSelection = await window.webContents.executeJavaScript(`(() => {
    const body = window.__madcadVerifyEngineState.bodies[0];
    const face = body.topology.faces.filter((item) => item.descriptor.geometry === 'PLANE').sort((a, b) => b.descriptor.center[2] - a.descriptor.center[2])[0];
    const edges = body.topology.edges.filter((item) => item.descriptor.geometry === 'LINE' && item.descriptor.endpoints.every((point) => Math.abs(point[2] - 10) < 0.001));
    let pair = null;
    for (let first = 0; first < edges.length && !pair; first += 1) for (let second = first + 1; second < edges.length && !pair; second += 1) {
      const shared = edges[first].descriptor.endpoints.some((left) => edges[second].descriptor.endpoints.some((right) => Math.hypot(...left.map((value, axis) => value - right[axis])) < 0.001));
      if (shared) pair = [edges[first], edges[second]];
    }
    if (!face || !pair) throw new Error('Nie znaleziono ściany i narożnika testowego Box.');
    const selection = (kind, record) => ({ kind, id: record.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId });
    return [selection('face', face), selection('edge', pair[0]), selection('edge', pair[1])];
  })()`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify(faceEdgeHoleSelection[0])}, 'replace')`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify(faceEdgeHoleSelection[1])}, 'add')`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify(faceEdgeHoleSelection[2])}, 'add')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.items?.length === 3`, 'ściana i dwie krawędzie otworu');
  await clickTool('Zmierz');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.command?.type === 'measure' && Math.abs(window.__madcadVerifyDocumentState.command.measurement?.angle - 90) < 0.001 && window.__madcadVerifyDocumentState.command.measurement?.length > 0 && window.__madcadVerifyDocumentState.command.measurement?.distance > 0`, 'Measure dwóch prostopadłych krawędzi');
  await waitForUi(window, `document.querySelector('.measure-panel')?.textContent.includes('Długość') && document.querySelector('.measure-panel')?.textContent.includes('Odległość') && document.querySelector('.measure-panel')?.textContent.includes('Kąt')`, 'panel wyniku Measure');
  await window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('.measure-panel header button');
    const key = button && Object.keys(button).find((item) => item.startsWith('__reactProps'));
    if (!key || typeof button[key]?.onClick !== 'function') throw new Error('Brak zamknięcia Measure.');
    button[key].onClick();
  })()`);
  await waitForUi(window, `!document.querySelector('.measure-panel')`, 'zamknięty Measure');
  await clickTool('Przekrój');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.command?.type === 'sectionAnalysis' && document.querySelector('.section-panel')`, 'otwarty Section Analysis');
  await setCommandField('Płaszczyzna', 'XZ');
  await setCommandField('Przesunięcie', '15');
  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('.section-toggle input');
    const key = input && Object.keys(input).find((item) => item.startsWith('__reactProps'));
    if (!key || typeof input[key]?.onChange !== 'function') throw new Error('Brak przełącznika strony przekroju.');
    input[key].onChange({ target: { checked: true } });
  })()`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.command?.sectionAnalysis?.plane === 'XZ' && window.__madcadVerifyDocumentState.command.sectionAnalysis.offset === '15' && window.__madcadVerifyDocumentState.command.sectionAnalysis.flip === true && window.__madcadSectionViewState?.enabled && window.__madcadSectionViewState.plane === 'XZ' && window.__madcadSectionViewState.offset === 15 && window.__madcadSectionViewState.clippingPlanes === 1`, 'aktywny przekrój XZ');
  await window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('.section-panel header button');
    const key = button && Object.keys(button).find((item) => item.startsWith('__reactProps'));
    if (!key || typeof button[key]?.onClick !== 'function') throw new Error('Brak zamknięcia Section Analysis.');
    button[key].onClick();
  })()`);
  await waitForUi(window, `!document.querySelector('.section-panel') && !window.__madcadSectionViewState?.enabled`, 'wyłączony Section Analysis');
  await clickTool('Masa');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.command?.type === 'massProperties' && document.querySelector('.mass-properties-panel')`, 'otwarte właściwości masowe');
  await setCommandField('Gęstość', '1.2');
  await waitForUi(window, `Math.abs(window.__madcadVerifyDocumentState?.command?.massProperties?.result?.volume - 12000) < 0.05 && Math.abs(window.__madcadVerifyDocumentState.command.massProperties.result.area - 3800) < 0.05 && Math.abs(window.__madcadVerifyDocumentState.command.massProperties.result.mass - 14.4) < 0.001 && Math.abs(window.__madcadVerifyDocumentState.command.massProperties.result.centerOfMass[2] - 5) < 0.001`, 'objętość pole masa i środek masy Box');
  await waitForUi(window, `document.querySelector('.mass-properties-panel')?.textContent.includes('14,4 g') && document.querySelector('.mass-properties-panel')?.textContent.includes('12\u00a0000 mm³')`, 'wynik właściwości masowych');
  await window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('.mass-properties-panel header button');
    const key = button && Object.keys(button).find((item) => item.startsWith('__reactProps'));
    if (!key || typeof button[key]?.onClick !== 'function') throw new Error('Brak zamknięcia właściwości masowych.');
    button[key].onClick();
  })()`);
  await waitForUi(window, `!document.querySelector('.mass-properties-panel')`, 'zamknięte właściwości masowe');
  await clickTool('Otwór');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Od krawędzi 1')`, 'pozycjonowanie otworu od krawędzi');
  await setCommandField('Od krawędzi 1', '6');
  await setCommandField('Od krawędzi 2', '8');
  await setCommandField('Średnica', '5');
  await setCommandField('Głębokość', '10');
  const faceEdgeHoleVolume = 12000 - (Math.PI * 2.5 * 2.5 * 10);
  await waitForUi(window, `Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - ${faceEdgeHoleVolume}) < 0.05`, 'podgląd otworu od krawędzi', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.placement === 'face-edges' && window.__madcadVerifyDocumentState.featureData[1].referenceIds?.length === 3`, 'zapisany otwór od krawędzi', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), faceEdgeHoleVolume, 0.05, 'Face-edge hole volume');

  await editTimelineFeature(1, 'Otwór');
  await setCommandField('Typ otworu', 'counterbore');
  await setCommandField('Zakres', 'through-all');
  await setCommandField('Średnica Counterbore', '9');
  await setCommandField('Głębokość Counterbore', '3');
  const counterboreVolume = 12000 - (Math.PI * 2.5 ** 2 * 10) - (Math.PI * ((4.5 ** 2) - (2.5 ** 2)) * 3);
  await waitForUi(window, `Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - ${counterboreVolume}) < 0.05`, 'podgląd Counterbore Through All', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.holeType === 'counterbore' && window.__madcadVerifyDocumentState.featureData[1].extent === 'through-all'`, 'zapisany Counterbore Through All', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), counterboreVolume, 0.05, 'Counterbore Through All volume');

  await editTimelineFeature(1, 'Otwór');
  const countersinkRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await setCommandField('Typ otworu', 'countersink');
  await setCommandField('Zakres', 'distance');
  await setCommandField('Głębokość', '10');
  await setCommandField('Średnica Countersink', '10');
  await setCommandField('Kąt Countersink', '90');
  const sinkDepth = (5 - 2.5) / Math.tan(Math.PI / 4);
  const countersinkExtra = (Math.PI * sinkDepth / 3) * ((5 ** 2) + (5 * 2.5) - (2 * (2.5 ** 2)));
  const countersinkVolume = 12000 - (Math.PI * 2.5 ** 2 * 10) - countersinkExtra;
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${countersinkRevision} && (window.__madcadVerifyEngineState?.status === 'ready' || window.__madcadVerifyEngineState?.status === 'error')`, 'wynik Countersink', modelingTimeoutMs);
  const countersinkPreview = await window.webContents.executeJavaScript(`({ status: window.__madcadVerifyEngineState?.status, error: document.querySelector('.engine-status')?.textContent, volume: window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume, timeline: window.__madcadVerifyEngineState?.timeline })`);
  if (countersinkPreview.status !== 'ready') throw new Error(`Countersink kernel error: ${JSON.stringify(countersinkPreview)}`);
  if (Math.abs(countersinkPreview.volume - countersinkVolume) > 0.05) throw new Error(`Countersink preview mismatch: ${JSON.stringify({ expected: countersinkVolume, ...countersinkPreview })}`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.holeType === 'countersink' && window.__madcadVerifyDocumentState.featureData[1].extent === 'distance'`, 'zapisany Countersink', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), countersinkVolume, 0.05, 'Countersink volume');

  await editTimelineFeature(1, 'Otwór');
  await setCommandField('Typ otworu', 'simple');
  await setCommandField('Gwint', 'cosmetic');
  await setCommandField('Średnica gwintu', '6');
  await setCommandField('Skok gwintu', '1');
  await setCommandField('Długość gwintu', '8');
  await setCommandField('Kierunek gwintu', 'right');
  await waitForUi(window, `Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - ${faceEdgeHoleVolume}) < 0.05`, 'gwint kosmetyczny bez zmiany B-Rep', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.threadMode === 'cosmetic' && window.__madcadVerifyDocumentState.featureData[1].threadDirection === 'right'`, 'zapisany gwint kosmetyczny', modelingTimeoutMs);

  await editTimelineFeature(1, 'Otwór');
  const modeledThreadRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await setCommandField('Gwint', 'modeled');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.command?.previewThreadMode === 'modeled'`, 'parametry modelowanego gwintu');
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${modeledThreadRevision} && ['ready', 'error'].includes(window.__madcadVerifyEngineState?.status) && ['ok', 'error'].includes(window.__madcadVerifyEngineState?.timeline?.[1]?.status)`, 'modelowany gwint prawy', modelingTimeoutMs);
  const modeledThreadState = await window.webContents.executeJavaScript(`({ volume: window.__madcadVerifyEngineState.bodies[0].metrics.volume, timeline: window.__madcadVerifyEngineState.timeline })`);
  if (modeledThreadState.timeline?.[1]?.status !== 'ok') throw new Error(`Modeled thread kernel error: ${JSON.stringify(modeledThreadState)}`);
  const rightThreadVolume = modeledThreadState.volume;
  if (!(rightThreadVolume < faceEdgeHoleVolume - 0.1 && rightThreadVolume > faceEdgeHoleVolume - 100)) throw new Error(`Modeled right thread volume is invalid: ${rightThreadVolume}.`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.threadMode === 'modeled'`, 'zapisany gwint modelowany');

  await editTimelineFeature(1, 'Otwór');
  const leftThreadRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await setCommandField('Kierunek gwintu', 'left');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.command?.previewThreadDirection === 'left' && window.__madcadVerifyEngineState?.revision > ${leftThreadRevision} && window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.timeline?.[1]?.status === 'ok'`, 'modelowany gwint lewy', modelingTimeoutMs);
  const leftThreadVolume = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`);
  assertClose(leftThreadVolume, rightThreadVolume, 0.1, 'Left/right modeled thread volume');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.threadDirection === 'left'`, 'zapisany lewy gwint modelowany');

  await editTimelineFeature(1, 'Otwór');
  await setCommandField('Gwint', 'none');
  await setCommandField('Profil luzu', 'fff');
  await setCommandField('Luz promieniowy FFF', '0.2');
  const fffHoleVolume = 12000 - (Math.PI * 2.7 * 2.7 * 10);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.command?.previewClearanceProfile === 'fff' && Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - ${fffHoleVolume}) < 0.05`, 'podgląd kompensacji FFF', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.clearanceProfile === 'fff' && window.__madcadVerifyDocumentState.featureData[1].diameter === '5' && window.__madcadVerifyDocumentState.featureData[1].clearance === '0.2'`, 'nominalny wymiar i profil FFF', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), fffHoleVolume, 0.05, 'FFF compensated hole volume');

  progress('revolve profile around base and construction axis');
  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt dla Revolve');
  await clickTool('Oś 2 punkty');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Oś przez dwa punkty')`, 'oś konstrukcyjna Revolve');
  await setCommandField('Nazwa', 'Oś Revolve Y');
  await setCommandField('Punkt 2 Y', '10');
  await setCommandField('Punkt 2 Z', '0');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.references?.some((reference) => reference.name === 'Oś Revolve Y')`, 'zapisana oś Revolve');
  const revolveAxisId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.references.find((reference) => reference.name === 'Oś Revolve Y').id`);
  await clickTool('Utwórz szkic');
  await waitForUi(window, `document.querySelector('.plane-picker')`, 'wybór płaszczyzny Revolve');
  await pickPlane('XY');
  await clickTool('Prostokąt');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Prostokąt')`, 'profil Revolve');
  await setCommandField('Szerokość', '5');
  await setCommandField('Wysokość', '4');
  await setCommandField('Środek X', '7.5');
  await setCommandField('Środek Y', '0');
  await confirmDialog();
  await clickTool('Zakończ szkic');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'profile'`, 'profil wskazany do Revolve');
  await clickTool('Revolve');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Kąt Revolve')`, 'otwarty Revolve');
  await waitForUi(window, `window.__madcadVerifyEngineState?.timeline?.at(-1)?.status === 'ok' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${300 * Math.PI}) < 0.05`, 'podgląd Revolve wokół osi bazowej Y', modelingTimeoutMs);
  await setCommandField('Oś obrotu', 'Z_AXIS');
  await waitForUi(window, `window.__madcadVerifyEngineState?.status === 'error' && document.querySelector('.notice')?.textContent.includes('płaszczyźnie szkicu')`, 'Revolve odrzuca oś prostopadłą do szkicu', modelingTimeoutMs);
  await setCommandField('Oś obrotu', revolveAxisId);
  await waitForUi(window, `window.__madcadVerifyEngineState?.timeline?.at(-1)?.status === 'ok' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${300 * Math.PI}) < 0.05`, 'Revolve wokół osi konstrukcyjnej Y', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.type === 'revolve' && window.__madcadVerifyDocumentState.featureData[0].axisId === ${JSON.stringify(revolveAxisId)} && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${300 * Math.PI}) < 0.05`, 'zapisany Revolve', modelingTimeoutMs);
  await editTimelineFeature(0, 'Revolve');
  await clickDialogButton('Anuluj');
  await clickByTitle('Cofnij');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.features === 0 && window.__madcadVerifyEngineState?.bodies?.length === 0`, 'undo Revolve', modelingTimeoutMs);
  await clickByTitle('Ponów');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.type === 'revolve' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${300 * Math.PI}) < 0.05`, 'redo Revolve', modelingTimeoutMs);
  await waitForUi(window, `(() => { const saved = JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null'); return saved?.features?.[0]?.type === 'revolve' && saved.features[0].axisId === ${JSON.stringify(revolveAxisId)}; })()`, 'autozapis Revolve');
  const revolveReopenRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave?.()`);
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${revolveReopenRevision} && window.__madcadVerifyDocumentState?.featureData?.[0]?.type === 'revolve' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${300 * Math.PI}) < 0.05`, 'ponownie otwarty Revolve', modelingTimeoutMs);

  progress('sweep profile along a separate sketch path');
  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt dla Sweep');
  await clickTool('Utwórz szkic');
  await waitForUi(window, `document.querySelector('.plane-picker')`, 'wybór płaszczyzny ścieżki Sweep');
  await pickPlane('XY');
  await clickTool('Linia');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Linia')`, 'linia ścieżki Sweep');
  await addSketchPoint([0, 0], 1);
  await addSketchPoint([20, 0], 3);
  await waitForUi(window, `!document.querySelector('.command-dialog')`, 'zakończona ścieżka Sweep');
  await clickTool('Zakończ szkic');
  const sweepPathSketchId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.sketches[0].id`);
  const sweepPathEntityId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.sketches[0].entityData.find((entity) => entity.type === 'line').id`);
  await clickTool('Utwórz szkic');
  await waitForUi(window, `document.querySelector('.plane-picker')`, 'wybór płaszczyzny profilu Sweep');
  await pickPlane('YZ');
  await clickTool('Okrąg');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Okrąg')`, 'profil Sweep');
  await setCommandField('Średnica', '4');
  await setCommandField('Środek X', '0');
  await setCommandField('Środek Y', '0');
  await confirmDialog();
  await clickTool('Zakończ szkic');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'profile'`, 'profil wskazany do Sweep');
  await clickTool('Sweep');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Ścieżka Sweep')`, 'otwarty Sweep');
  await waitForUi(window, `window.__madcadVerifyEngineState?.timeline?.at(-1)?.status === 'ok' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${80 * Math.PI}) < 0.05`, 'podgląd Sweep', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.type === 'sweep' && window.__madcadVerifyDocumentState.featureData[0].pathSketchId === ${JSON.stringify(sweepPathSketchId)} && window.__madcadVerifyDocumentState.featureData[0].pathEntityIds?.[0] === ${JSON.stringify(sweepPathEntityId)} && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${80 * Math.PI}) < 0.05`, 'zapisany Sweep', modelingTimeoutMs);
  await editTimelineFeature(0, 'Sweep');
  await clickDialogButton('Anuluj');
  await clickByTitle('Cofnij');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.features === 0 && window.__madcadVerifyEngineState?.bodies?.length === 0`, 'undo Sweep', modelingTimeoutMs);
  await clickByTitle('Ponów');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.type === 'sweep' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${80 * Math.PI}) < 0.05`, 'redo Sweep', modelingTimeoutMs);
  await waitForUi(window, `(() => { const feature = JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null')?.features?.[0]; return feature?.type === 'sweep' && feature.pathSketchId === ${JSON.stringify(sweepPathSketchId)} && feature.pathEntityIds?.[0] === ${JSON.stringify(sweepPathEntityId)}; })()`, 'autozapis Sweep');
  const sweepReopenRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave?.()`);
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${sweepReopenRevision} && window.__madcadVerifyDocumentState?.featureData?.[0]?.type === 'sweep' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${80 * Math.PI}) < 0.05`, 'ponownie otwarty Sweep', modelingTimeoutMs);

  progress('loft between profiles on parallel sketch planes');
  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt dla Loft');
  await clickTool('Utwórz szkic');
  await waitForUi(window, `document.querySelector('.plane-picker')`, 'wybór płaszczyzny dolnego profilu Loft');
  await pickPlane('XY');
  await clickTool('Okrąg');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Okrąg')`, 'dolny profil Loft');
  await setCommandField('Średnica', '8');
  await setCommandField('Środek X', '0');
  await setCommandField('Środek Y', '0');
  await confirmDialog();
  await clickTool('Zakończ szkic');
  const loftBottomSketchId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.sketches[0].id`);
  const loftBottomProfileId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.sketches[0].profileIds[0]`);
  await clickTool('Płaszczyzna offset');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Płaszczyzna odsunięta')`, 'płaszczyzna górnego profilu Loft');
  await setCommandField('Nazwa', 'Góra Loft');
  await setCommandField('Płaszczyzna bazowa', 'XY');
  await setCommandField('Odległość', '10');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'constructionPlane'`, 'wybrana płaszczyzna Loft');
  await clickTool('Utwórz szkic');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.length === 2 && Number(window.__madcadVerifyDocumentState.sketches[1].planeOffset) === 10`, 'szkic górnego profilu Loft');
  await clickTool('Okrąg');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Okrąg')`, 'górny profil Loft');
  await setCommandField('Średnica', '4');
  await setCommandField('Środek X', '0');
  await setCommandField('Środek Y', '0');
  await confirmDialog();
  await clickTool('Zakończ szkic');
  const loftTopSketchId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.sketches[1].id`);
  const loftTopProfileId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.sketches[1].profileIds[0]`);
  const loftVolume = 280 * Math.PI / 3;
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'profile'`, 'górny profil wskazany do Loft');
  await clickTool('Loft');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Profil końcowy') && document.querySelector('.command-dialog')?.textContent.includes('Przejście')`, 'otwarty Loft');
  await waitForUi(window, `window.__madcadVerifyEngineState?.timeline?.at(-1)?.status === 'ok' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${280 * Math.PI / 3}) < 0.05`, 'podgląd gładkiego Loft', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `(() => { const feature = window.__madcadVerifyDocumentState?.featureData?.[0]; return feature?.type === 'loft' && feature.loftMode === 'smooth' && feature.sketchIds?.includes(${JSON.stringify(loftBottomSketchId)}) && feature.sketchIds?.includes(${JSON.stringify(loftTopSketchId)}) && feature.profileIds?.includes(${JSON.stringify(loftBottomProfileId)}) && feature.profileIds?.includes(${JSON.stringify(loftTopProfileId)}) && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${loftVolume}) < 0.05; })()`, 'zapisany gładki Loft', modelingTimeoutMs);
  await editTimelineFeature(0, 'Loft');
  await setCommandField('Przejście', 'ruled');
  await waitForUi(window, `Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${loftVolume}) < 0.05`, 'podgląd odcinkowego Loft', modelingTimeoutMs);
  await clickDialogButton('Anuluj');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.loftMode === 'smooth'`, 'anulowanie edycji Loft');
  await editTimelineFeature(0, 'Loft');
  await setCommandField('Przejście', 'ruled');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.loftMode === 'ruled'`, 'zapisany odcinkowy Loft', modelingTimeoutMs);
  await clickByTitle('Cofnij');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.loftMode === 'smooth'`, 'undo edycji Loft', modelingTimeoutMs);
  await clickByTitle('Ponów');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.loftMode === 'ruled' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${loftVolume}) < 0.05`, 'redo edycji Loft', modelingTimeoutMs);
  await waitForUi(window, `JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null')?.features?.[0]?.loftMode === 'ruled'`, 'autozapis Loft');
  const loftReopenRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave?.()`);
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${loftReopenRevision} && window.__madcadVerifyDocumentState?.featureData?.[0]?.type === 'loft' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${loftVolume}) < 0.05`, 'ponownie otwarty Loft', modelingTimeoutMs);

  progress('rib and web from an open sketch profile');
  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt dla Rib Web');
  await clickTool('Prymityw');
  await setCommandField('Szerokość', '20');
  await setCommandField('Głębokość', '20');
  await setCommandField('Wysokość', '5');
  await setCommandField('Położenie X', '-10');
  await setCommandField('Położenie Y', '-10');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyEngineState?.bodies?.length === 1 && Math.abs(window.__madcadVerifyEngineState.bodies[0].metrics.volume - 2000) < 0.05`, 'baza Rib Web', modelingTimeoutMs);
  const ribSupport = await window.webContents.executeJavaScript(`(() => {
    const body = window.__madcadVerifyEngineState.bodies[0];
    const face = body.topology.faces.filter((item) => item.descriptor.geometry === 'PLANE').sort((left, right) => right.descriptor.center[2] - left.descriptor.center[2])[0];
    return { kind: 'face', id: face.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId };
  })()`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify(ribSupport)}, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'face' && window.__madcadVerifyDocumentState.selection.id === ${JSON.stringify(ribSupport.id)}`, 'ściana wskazana dla szkicu Rib Web');
  await clickTool('Utwórz szkic');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.support?.kind === 'face' && Number(window.__madcadVerifyDocumentState.sketches[0].planeOffset) === 5`, 'szkic Rib Web na górnej ścianie', modelingTimeoutMs);
  await clickTool('Linia');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Linia')`, 'otwarty profil Rib Web');
  await addSketchPoint([-8, 0], 1);
  await addSketchPoint([8, 0], 3);
  const ribLineId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.sketches[0].entityData.find((entity) => entity.type === 'line').id`);
  await window.webContents.executeJavaScript(`window.__madcadVerifySketchSelection?.([${JSON.stringify(ribLineId)}], 'replace')`);
  await waitForUi(window, `!([...document.querySelectorAll('.ribbon-tool')].find((item) => item.querySelector('.ribbon-label')?.textContent === 'Rib/Web')?.disabled)`, 'aktywny przycisk Rib Web');
  await clickTool('Rib/Web');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Otwarty profil') && document.querySelector('.command-dialog')?.textContent.includes('Zasięg')`, 'otwarty Rib Web');
  await waitForUi(window, `Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 2160) < 0.05 && Math.abs(window.__madcadVerifyEngineState.bodies[0].metrics.bounds[1][2] - 10) < 0.001`, 'podgląd Web', modelingTimeoutMs);
  await clickDialogButton('Anuluj');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.features === 1 && document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'anulowanie Rib Web');
  await window.webContents.executeJavaScript(`window.__madcadVerifySketchSelection?.([${JSON.stringify(ribLineId)}], 'replace')`);
  await waitForUi(window, `!([...document.querySelectorAll('.ribbon-tool')].find((item) => item.querySelector('.ribbon-label')?.textContent === 'Rib/Web')?.disabled)`, 'ponownie aktywny przycisk Rib Web');
  await clickTool('Rib/Web');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Rib/Web')`, 'ponownie otwarty Rib Web');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.type === 'rib' && window.__madcadVerifyDocumentState.featureData[1].ribMode === 'web' && window.__madcadVerifyDocumentState.featureData[1].openEntityIds?.[0] === ${JSON.stringify(ribLineId)} && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 2160) < 0.05`, 'zapisany Web', modelingTimeoutMs);
  await editTimelineFeature(1, 'Rib/Web');
  await setCommandField('Typ', 'rib');
  await waitForUi(window, `Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 2160) < 0.05 && Math.abs(window.__madcadVerifyEngineState.bodies[0].metrics.bounds[1][2] - 7) < 0.001`, 'podgląd Rib w płaszczyźnie szkicu', modelingTimeoutMs);
  await clickDialogButton('Anuluj');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.ribMode === 'web'`, 'anulowanie zmiany Web na Rib');
  await editTimelineFeature(1, 'Rib/Web');
  await setCommandField('Grubość', '3');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.thickness === '3' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 2240) < 0.05`, 'edycja grubości Web', modelingTimeoutMs);
  await clickByTitle('Cofnij');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.thickness === '2' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 2160) < 0.05`, 'undo Rib Web', modelingTimeoutMs);
  await clickByTitle('Ponów');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.thickness === '3' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 2240) < 0.05`, 'redo Rib Web', modelingTimeoutMs);
  await waitForUi(window, `(() => { const feature = JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null')?.features?.[1]; return feature?.type === 'rib' && feature.thickness === '3' && feature.ribMode === 'web'; })()`, 'autozapis Rib Web');
  const ribReopenRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave?.()`);
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${ribReopenRevision} && window.__madcadVerifyDocumentState?.featureData?.[1]?.type === 'rib' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 2240) < 0.05`, 'ponownie otwarty Rib Web', modelingTimeoutMs);

  progress('parametric solid coil around a selected axis');
  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt dla Coil');
  await clickTool('Coil');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Średnica Coil') && document.querySelector('.command-dialog')?.textContent.includes('Liczba zwojów')`, 'otwarty Coil');
  await waitForUi(window, `window.__madcadVerifyEngineState?.timeline?.[0]?.status === 'ok' && window.__madcadVerifyEngineState?.bodies?.length === 1 && window.__madcadVerifyEngineState.bodies[0].metrics.volume > 295 && window.__madcadVerifyEngineState.bodies[0].metrics.volume < 302`, 'podgląd Coil', modelingTimeoutMs);
  const coilInitialVolume = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`);
  await confirmDialog();
  await waitForUi(window, `(() => { const feature = window.__madcadVerifyDocumentState?.featureData?.[0]; return feature?.type === 'coil' && feature.axisId === 'Z_AXIS' && feature.coilDiameter === '10' && feature.wireDiameter === '2' && feature.pitch === '4' && feature.turns === '3' && feature.handedness === 'right'; })()`, 'zapisany Coil', modelingTimeoutMs);
  await editTimelineFeature(0, 'Coil');
  await setCommandField('Kierunek zwoju', 'left');
  await waitForUi(window, `window.__madcadVerifyEngineState?.timeline?.[0]?.status === 'ok'`, 'podgląd lewoskrętnego Coil', modelingTimeoutMs);
  const coilLeftVolume = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`);
  assertClose(coilLeftVolume, coilInitialVolume, 0.05, 'Left/right Coil volume');
  await clickDialogButton('Anuluj');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.handedness === 'right'`, 'anulowanie kierunku Coil');
  await editTimelineFeature(0, 'Coil');
  await setCommandField('Liczba zwojów', '4');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.turns === '4' && window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume > ${coilInitialVolume * 1.32} && window.__madcadVerifyEngineState.bodies[0].metrics.volume < ${coilInitialVolume * 1.35}`, 'edycja liczby zwojów Coil', modelingTimeoutMs);
  await clickByTitle('Cofnij');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.turns === '3'`, 'undo Coil', modelingTimeoutMs);
  await clickByTitle('Ponów');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.turns === '4'`, 'redo Coil', modelingTimeoutMs);
  await waitForUi(window, `JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null')?.features?.[0]?.turns === '4'`, 'autozapis Coil');
  const coilReopenRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave?.()`);
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${coilReopenRevision} && window.__madcadVerifyDocumentState?.featureData?.[0]?.type === 'coil' && window.__madcadVerifyEngineState?.timeline?.[0]?.status === 'ok'`, 'ponownie otwarty Coil', modelingTimeoutMs);

  progress('hollow pipe along an open sketch path');
  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt dla Pipe');
  await clickTool('Utwórz szkic');
  await pickPlane('Góra');
  await waitForUi(window, `document.querySelector('.model-viewport')?.classList.contains('sketch-view') && [...document.querySelectorAll('.ribbon-label')].some((item) => item.textContent === 'Linia')`, 'aktywny szkic ścieżki Pipe');
  await clickTool('Linia');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Linia')`, 'polecenie linii Pipe');
  await addSketchPoint([-10, 0], 1);
  await addSketchPoint([10, 0], 3);
  const pipePathId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.sketches[0].entityData.find((entity) => entity.type === 'line').id`);
  await window.webContents.executeJavaScript(`window.__madcadVerifySketchSelection?.([${JSON.stringify(pipePathId)}], 'replace')`);
  await clickTool('Pipe');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Średnica zewnętrzna') && document.querySelector('.command-dialog')?.textContent.includes('Grubość ścianki')`, 'otwarty Pipe');
  await waitForUi(window, `window.__madcadVerifyEngineState?.timeline?.[0]?.status === 'ok' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${35 * Math.PI}) < 0.05`, 'podgląd pustego Pipe', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `(() => { const feature = window.__madcadVerifyDocumentState?.featureData?.[0]; return feature?.type === 'pipe' && feature.pathEntityIds?.[0] === ${JSON.stringify(pipePathId)} && feature.outsideDiameter === '4' && feature.wallThickness === '0.5'; })()`, 'zapisany Pipe', modelingTimeoutMs);
  await editTimelineFeature(0, 'Pipe');
  await setCommandField('Średnica zewnętrzna', '6');
  await setCommandField('Grubość ścianki', '1');
  await waitForUi(window, `Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${100 * Math.PI}) < 0.05`, 'podgląd edycji Pipe', modelingTimeoutMs);
  await confirmDialog();
  await clickByTitle('Cofnij');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.outsideDiameter === '4'`, 'undo Pipe', modelingTimeoutMs);
  await clickByTitle('Ponów');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.outsideDiameter === '6' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${100 * Math.PI}) < 0.05`, 'redo Pipe', modelingTimeoutMs);
  await waitForUi(window, `JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null')?.features?.[0]?.outsideDiameter === '6'`, 'autozapis Pipe');
  const pipeReopenRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave?.()`);
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${pipeReopenRevision} && window.__madcadVerifyDocumentState?.featureData?.[0]?.type === 'pipe' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${100 * Math.PI}) < 0.05`, 'ponownie otwarty Pipe', modelingTimeoutMs);

  progress('rectangular circular and path body patterns');
  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt Pattern');
  await clickTool('Prymityw');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Prymityw')`, 'prymityw Pattern');
  await setCommandField('Szerokość', '2');
  await setCommandField('Głębokość', '2');
  await setCommandField('Wysokość', '2');
  await setCommandField('Położenie X', '5');
  await setCommandField('Położenie Y', '-1');
  await confirmDialog();
  await waitForUi(window, `Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 8) < 0.05`, 'bryła źródłowa Pattern', modelingTimeoutMs);
  await clickTool('Utwórz szkic');
  await waitForUi(window, `document.querySelector('.plane-picker')`, 'płaszczyzna ścieżki Pattern');
  await pickPlane('Góra');
  await waitForUi(window, `document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'szkic ścieżki Pattern');
  await clickTool('Linia');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Linia')`, 'linia ścieżki Pattern');
  await addSketchPoint([-10, 10], 1);
  await addSketchPoint([20, 10], 3);
  await clickTool('Zakończ szkic');
  await waitForUi(window, `!document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'zakończony szkic Pattern');
  await clickTool('Pattern');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Typ szyku')`, 'otwarty Pattern');
  await waitForUi(window, `Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 24) < 0.05`, 'podgląd Pattern prostokątnego', modelingTimeoutMs);
  await setCommandField('Typ szyku', 'path');
  await waitForUi(window, `Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 32) < 0.05`, 'podgląd Pattern po ścieżce', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.patternType === 'path'`, 'zapisany Pattern po ścieżce', modelingTimeoutMs);
  await editTimelineFeature(1, 'Pattern');
  await setCommandField('Typ szyku', 'circular');
  await waitForUi(window, `Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 32) < 0.05`, 'podgląd Pattern kołowego', modelingTimeoutMs);
  await confirmDialog();
  await clickByTitle('Cofnij');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.patternType === 'path'`, 'undo Pattern', modelingTimeoutMs);
  await clickByTitle('Ponów');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.patternType === 'circular'`, 'redo Pattern', modelingTimeoutMs);
  await waitForUi(window, `JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null')?.features?.[1]?.patternType === 'circular'`, 'autozapis Pattern');

  progress('split body by construction and base plane');
  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt dla Split Body');
  await clickTool('Prymityw');
  await setCommandField('Szerokość', '20');
  await setCommandField('Głębokość', '16');
  await setCommandField('Wysokość', '12');
  await setCommandField('Położenie X', '-10');
  await setCommandField('Położenie Y', '-8');
  await setCommandField('Położenie Z', '-6');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyEngineState?.bodies?.length === 1 && Math.abs(window.__madcadVerifyEngineState.bodies[0].metrics.volume - 3840) < 0.05`, 'wyśrodkowana bryła Split Body', modelingTimeoutMs);
  const splitSourceBodyId = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].id`);
  await clickTool('Płaszczyzna offset');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Płaszczyzna odsunięta')`, 'płaszczyzna konstrukcyjna Split Body');
  await setCommandField('Płaszczyzna bazowa', 'XY');
  await setCommandField('Odległość', '2');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.references?.some((reference) => reference.kind === 'construction-plane' && reference.offset === '2')`, 'zapisana płaszczyzna Split Body');
  const splitConstructionPlaneId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.references.find((reference) => reference.kind === 'construction-plane' && reference.offset === '2').id`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection({ kind: 'body', bodyId: ${JSON.stringify(splitSourceBodyId)} }, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'body'`, 'bryła wskazana do Split Body');
  await clickTool('Split Body');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Płaszczyzna podziału')`, 'otwarty Split Body');
  await setCommandField('Płaszczyzna podziału', splitConstructionPlaneId);
  await waitForUi(window, `window.__madcadVerifyEngineState?.bodies?.length === 2 && Math.abs(window.__madcadVerifyEngineState.bodies.reduce((sum, body) => sum + body.metrics.volume, 0) - 3840) < 0.05 && Math.abs(Math.min(...window.__madcadVerifyEngineState.bodies.map((body) => body.metrics.volume)) - 1280) < 0.05`, 'podgląd podziału bryły płaszczyzną konstrukcyjną', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.type === 'splitBody' && window.__madcadVerifyDocumentState.featureData[1].planeId === ${JSON.stringify(splitConstructionPlaneId)} && window.__madcadVerifyEngineState?.bodies?.length === 2`, 'zapisany Split Body', modelingTimeoutMs);
  const splitFeatureId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.featureData[1].id`);
  const splitResultBodyId = `body-${splitFeatureId}`;
  await waitForUi(window, `window.__madcadVerifyEngineState?.bodies?.some((body) => body.id === ${JSON.stringify(splitResultBodyId)})`, 'trwałe ID drugiej bryły Split Body');

  await editTimelineFeature(1, 'Split Body');
  await setCommandField('Płaszczyzna podziału', 'XZ');
  await waitForUi(window, `window.__madcadVerifyEngineState?.bodies?.length === 2 && window.__madcadVerifyEngineState.bodies.every((body) => Math.abs(body.metrics.volume - 1920) < 0.05)`, 'podgląd edycji Split Body na XZ', modelingTimeoutMs);
  await clickDialogButton('Anuluj');
  await waitForUi(window, `!document.querySelector('.command-dialog') && window.__madcadVerifyDocumentState?.featureData?.[1]?.planeId === ${JSON.stringify(splitConstructionPlaneId)} && Math.abs(Math.min(...window.__madcadVerifyEngineState.bodies.map((body) => body.metrics.volume)) - 1280) < 0.05`, 'anulowanie edycji Split Body bez zmiany historii', modelingTimeoutMs);

  await editTimelineFeature(1, 'Split Body');
  await setCommandField('Płaszczyzna podziału', 'XZ');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.planeId === 'XZ' && window.__madcadVerifyEngineState?.bodies?.length === 2 && window.__madcadVerifyEngineState.bodies.every((body) => Math.abs(body.metrics.volume - 1920) < 0.05)`, 'edycja Split Body zapisana na XZ', modelingTimeoutMs);
  await clickByTitle('Cofnij');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.planeId === ${JSON.stringify(splitConstructionPlaneId)} && Math.abs(Math.min(...window.__madcadVerifyEngineState.bodies.map((body) => body.metrics.volume)) - 1280) < 0.05`, 'undo edycji Split Body', modelingTimeoutMs);
  await clickByTitle('Ponów');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.planeId === 'XZ' && window.__madcadVerifyEngineState?.bodies?.length === 2 && window.__madcadVerifyEngineState.bodies.every((body) => Math.abs(body.metrics.volume - 1920) < 0.05)`, 'redo edycji Split Body', modelingTimeoutMs);
  await waitForUi(window, `(() => { const saved = JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null'); return saved?.features?.[1]?.type === 'splitBody' && saved.features[1].planeId === 'XZ'; })()`, 'autozapis Split Body');
  const splitReopenRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave?.()`);
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${splitReopenRevision} && window.__madcadVerifyDocumentState?.featureData?.[1]?.planeId === 'XZ' && window.__madcadVerifyEngineState?.bodies?.length === 2 && window.__madcadVerifyEngineState.bodies.some((body) => body.id === ${JSON.stringify(splitResultBodyId)})`, 'ponownie otwarty Split Body', modelingTimeoutMs);

  progress('split planar face by supported sketch profile');
  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt dla Split Face');
  await clickTool('Prymityw');
  await setCommandField('Szerokość', '20');
  await setCommandField('Głębokość', '20');
  await setCommandField('Wysokość', '10');
  await setCommandField('Położenie X', '-10');
  await setCommandField('Położenie Y', '-10');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyEngineState?.bodies?.length === 1 && window.__madcadVerifyEngineState.bodies[0].metrics.faceCount === 6 && Math.abs(window.__madcadVerifyEngineState.bodies[0].metrics.volume - 4000) < 0.05`, 'baza Split Face', modelingTimeoutMs);
  const splitFaceSupport = await window.webContents.executeJavaScript(`(() => {
    const body = window.__madcadVerifyEngineState.bodies[0];
    const face = body.topology.faces.filter((item) => item.descriptor.geometry === 'PLANE').sort((left, right) => right.descriptor.center[2] - left.descriptor.center[2])[0];
    return { kind: 'face', id: face.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId };
  })()`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify(splitFaceSupport)}, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'face' && window.__madcadVerifyDocumentState.selection.id === ${JSON.stringify(splitFaceSupport.id)}`, 'ściana wskazana dla szkicu Split Face');
  await clickTool('Utwórz szkic');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.[0]?.support?.kind === 'face' && Number(window.__madcadVerifyDocumentState.sketches[0].planeOffset) === 10`, 'szkic Split Face na górnej ścianie', modelingTimeoutMs);
  await clickTool('Okrąg');
  await setCommandField('Średnica', '8');
  await setCommandField('Środek X', '0');
  await setCommandField('Środek Y', '0');
  await confirmDialog();
  await clickTool('Zakończ szkic');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'profile'`, 'profil wskazany do Split Face');
  const splitFaceProfileId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.selection.id`);
  const splitFaceReferenceId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.sketches[0].support.referenceId`);
  await clickTool('Split Face');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Profil podziału')`, 'otwarty Split Face');
  await waitForUi(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.timeline?.at(-1)?.status === 'ok' && window.__madcadVerifyEngineState?.bodies?.length === 1 && window.__madcadVerifyEngineState.bodies[0].metrics.faceCount > 6 && Math.abs(window.__madcadVerifyEngineState.bodies[0].metrics.volume - 4000) < 0.05`, 'dokładny podgląd Split Face bez zmiany objętości', modelingTimeoutMs);
  const splitFaceCount = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.faceCount`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.type === 'splitFace' && window.__madcadVerifyDocumentState.featureData[1].profileId === ${JSON.stringify(splitFaceProfileId)} && window.__madcadVerifyDocumentState.featureData[1].referenceIds?.[0] === ${JSON.stringify(splitFaceReferenceId)} && window.__madcadVerifyEngineState.bodies[0].metrics.faceCount === ${splitFaceCount}`, 'zapisany Split Face z trwałą referencją', modelingTimeoutMs);
  await editTimelineFeature(1, 'Split Face');
  await clickDialogButton('Anuluj');
  await waitForUi(window, `!document.querySelector('.command-dialog') && window.__madcadVerifyDocumentState?.featureData?.[1]?.type === 'splitFace' && window.__madcadVerifyEngineState.bodies[0].metrics.faceCount === ${splitFaceCount}`, 'anulowanie edycji Split Face', modelingTimeoutMs);
  await clickByTitle('Cofnij');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.features === 1 && window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.faceCount === 6`, 'undo Split Face', modelingTimeoutMs);
  await clickByTitle('Ponów');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.type === 'splitFace' && window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.faceCount === ${splitFaceCount}`, 'redo Split Face', modelingTimeoutMs);
  await waitForUi(window, `(() => { const saved = JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null'); return saved?.features?.[1]?.type === 'splitFace' && saved.features[1].profileId === ${JSON.stringify(splitFaceProfileId)} && saved.features[1].referenceIds?.[0] === ${JSON.stringify(splitFaceReferenceId)}; })()`, 'autozapis Split Face');
  const splitFaceReopenRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave?.()`);
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${splitFaceReopenRevision} && window.__madcadVerifyDocumentState?.featureData?.[1]?.type === 'splitFace' && window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.faceCount === ${splitFaceCount} && Math.abs(window.__madcadVerifyEngineState.bodies[0].metrics.volume - 4000) < 0.05`, 'ponownie otwarty Split Face', modelingTimeoutMs);

  progress('delete split face region and heal surrounding surface');
  const deleteFaceSelection = await window.webContents.executeJavaScript(`(() => {
    const body = window.__madcadVerifyEngineState.bodies[0];
    const face = body.topology.faces
      .filter((item) => item.descriptor.geometry === 'PLANE' && item.descriptor.center[2] > 9.9)
      .sort((left, right) => left.descriptor.area - right.descriptor.area)[0];
    return { kind: 'face', id: face.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId };
  })()`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify(deleteFaceSelection)}, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'face' && window.__madcadVerifyDocumentState.selection.id === ${JSON.stringify(deleteFaceSelection.id)}`, 'region wskazany do Delete Face + Heal');
  await clickTool('Delete Face + Heal');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Usuwane regiony')`, 'otwarty Delete Face + Heal');
  await waitForUi(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.timeline?.at(-1)?.status === 'ok' && window.__madcadVerifyEngineState?.bodies?.length === 1 && window.__madcadVerifyEngineState.bodies[0].metrics.faceCount === 6 && Math.abs(window.__madcadVerifyEngineState.bodies[0].metrics.volume - 4000) < 0.05`, 'podgląd Delete Face + Heal odtwarza powierzchnię', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[2]?.type === 'deleteFace' && window.__madcadVerifyDocumentState.featureData[2].referenceIds?.length === 1 && window.__madcadVerifyEngineState.bodies[0].metrics.faceCount === 6`, 'zapisany Delete Face + Heal z trwałą referencją', modelingTimeoutMs);
  const deleteFaceReferenceId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.featureData[2].referenceIds[0]`);
  await editTimelineFeature(2, 'Delete Face + Heal');
  await clickDialogButton('Anuluj');
  await waitForUi(window, `!document.querySelector('.command-dialog') && window.__madcadVerifyDocumentState?.featureData?.[2]?.type === 'deleteFace' && window.__madcadVerifyEngineState.bodies[0].metrics.faceCount === 6`, 'anulowanie edycji Delete Face + Heal', modelingTimeoutMs);
  await clickByTitle('Cofnij');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.features === 2 && window.__madcadVerifyDocumentState?.featureData?.[1]?.type === 'splitFace' && window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.faceCount === ${splitFaceCount}`, 'undo Delete Face + Heal', modelingTimeoutMs);
  await clickByTitle('Ponów');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[2]?.type === 'deleteFace' && window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.faceCount === 6`, 'redo Delete Face + Heal', modelingTimeoutMs);
  await waitForUi(window, `(() => { const saved = JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null'); return saved?.features?.[2]?.type === 'deleteFace' && saved.features[2].referenceIds?.[0] === ${JSON.stringify(deleteFaceReferenceId)}; })()`, 'autozapis Delete Face + Heal');
  const deleteFaceReopenRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave?.()`);
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${deleteFaceReopenRevision} && window.__madcadVerifyDocumentState?.featureData?.[2]?.type === 'deleteFace' && window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.faceCount === 6 && Math.abs(window.__madcadVerifyEngineState.bodies[0].metrics.volume - 4000) < 0.05`, 'ponownie otwarty Delete Face + Heal', modelingTimeoutMs);

  progress('replace planar face with target surface');
  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt dla Replace Face');
  await clickTool('Prymityw');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Prymityw 3D')`, 'pierwszy prymityw Replace Face');
  await setCommandField('Szerokość', '10');
  await setCommandField('Głębokość', '10');
  await setCommandField('Wysokość', '10');
  await setCommandField('Położenie X', '0');
  await setCommandField('Położenie Y', '0');
  await setCommandField('Położenie Z', '0');
  await confirmDialog();
  await clickTool('Prymityw');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Prymityw 3D')`, 'drugi prymityw Replace Face');
  await setCommandField('Szerokość', '10');
  await setCommandField('Głębokość', '10');
  await setCommandField('Wysokość', '2');
  await setCommandField('Położenie X', '20');
  await setCommandField('Położenie Y', '0');
  await setCommandField('Położenie Z', '15');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyEngineState?.bodies?.length === 2 && window.__madcadVerifyEngineState.bodies.some((body) => Math.abs(body.metrics.volume - 1000) < 0.05) && window.__madcadVerifyEngineState.bodies.some((body) => Math.abs(body.metrics.volume - 200) < 0.05)`, 'dwie bryły Replace Face', modelingTimeoutMs);
  const replaceFaceFixture = await window.webContents.executeJavaScript(`(() => {
    const source = window.__madcadVerifyEngineState.bodies.find((body) => Math.abs(body.metrics.volume - 1000) < 0.05);
    const destination = window.__madcadVerifyEngineState.bodies.find((body) => Math.abs(body.metrics.volume - 200) < 0.05);
    const sourceFace = source.topology.faces.filter((face) => face.descriptor.geometry === 'PLANE').sort((left, right) => right.descriptor.center[2] - left.descriptor.center[2])[0];
    const destinationFace = destination.topology.faces.filter((face) => face.descriptor.geometry === 'PLANE').sort((left, right) => left.descriptor.center[2] - right.descriptor.center[2])[0];
    const destinationSide = destination.topology.faces.find((face) => face.descriptor.geometry === 'PLANE' && Math.abs(face.descriptor.normal[0]) > 0.9);
    const selection = (body, face) => ({ kind: 'face', id: face.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId });
    return { sourceBodyId: source.id, destinationBodyId: destination.id, source: selection(source, sourceFace), destination: selection(destination, destinationFace), nonParallelDestination: selection(destination, destinationSide) };
  })()`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify(replaceFaceFixture.source)}, 'replace')`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify(replaceFaceFixture.nonParallelDestination)}, 'add')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.items?.length === 2`, 'nierównoległe ściany wskazane do Replace Face');
  await clickTool('Replace Face');
  await waitForUi(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.timeline?.at(-1)?.status === 'error' && window.__madcadVerifyEngineState.timeline.at(-1).error?.includes('równoległa')`, 'Replace Face odrzuca nierównoległą powierzchnię', modelingTimeoutMs);
  await clickDialogButton('Anuluj');
  await waitForUi(window, `!document.querySelector('.command-dialog') && window.__madcadVerifyDocumentState?.features === 2 && window.__madcadVerifyEngineState?.status === 'ready' && Math.abs(window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(replaceFaceFixture.sourceBodyId)}).metrics.volume - 1000) < 0.05`, 'anulowanie błędnego Replace Face bez częściowego stanu', modelingTimeoutMs);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify(replaceFaceFixture.source)}, 'replace')`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify(replaceFaceFixture.destination)}, 'add')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.items?.length === 2`, 'dwie ściany wskazane do Replace Face');
  await clickTool('Replace Face');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Powierzchnia docelowa')`, 'otwarty Replace Face');
  await waitForUi(window, `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.timeline?.at(-1)?.status === 'ok' && Math.abs(window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(replaceFaceFixture.sourceBodyId)}).metrics.volume - 1500) < 0.05 && Math.abs(window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(replaceFaceFixture.destinationBodyId)}).metrics.volume - 200) < 0.05`, 'podgląd Replace Face dochodzi do powierzchni docelowej', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[2]?.type === 'replaceFace' && window.__madcadVerifyDocumentState.featureData[2].referenceIds?.length === 2 && Math.abs(window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(replaceFaceFixture.sourceBodyId)}).metrics.volume - 1500) < 0.05`, 'zapisany Replace Face z dwiema trwałymi referencjami', modelingTimeoutMs);
  const replaceFaceReferenceIds = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.featureData[2].referenceIds`);
  await editTimelineFeature(2, 'Replace Face');
  await clickDialogButton('Anuluj');
  await waitForUi(window, `!document.querySelector('.command-dialog') && window.__madcadVerifyDocumentState?.featureData?.[2]?.type === 'replaceFace'`, 'anulowanie edycji Replace Face', modelingTimeoutMs);
  await clickByTitle('Cofnij');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.features === 2 && Math.abs(window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(replaceFaceFixture.sourceBodyId)}).metrics.volume - 1000) < 0.05`, 'undo Replace Face', modelingTimeoutMs);
  await clickByTitle('Ponów');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[2]?.type === 'replaceFace' && Math.abs(window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(replaceFaceFixture.sourceBodyId)}).metrics.volume - 1500) < 0.05`, 'redo Replace Face', modelingTimeoutMs);
  await waitForUi(window, `(() => { const saved = JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null'); return saved?.features?.[2]?.type === 'replaceFace' && saved.features[2].referenceIds?.[0] === ${JSON.stringify(replaceFaceReferenceIds[0])} && saved.features[2].referenceIds?.[1] === ${JSON.stringify(replaceFaceReferenceIds[1])}; })()`, 'autozapis Replace Face');
  const replaceFaceReopenRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave?.()`);
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${replaceFaceReopenRevision} && window.__madcadVerifyDocumentState?.featureData?.[2]?.type === 'replaceFace' && Math.abs(window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(replaceFaceFixture.sourceBodyId)}).metrics.volume - 1500) < 0.05 && Math.abs(window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(replaceFaceFixture.destinationBodyId)}).metrics.volume - 200) < 0.05`, 'ponownie otwarty Replace Face', modelingTimeoutMs);

  progress('box cylinder sphere torus primitives');
  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt dla prymitywów');
  const primitiveFixtures = [
    { type: 'box', fields: { Szerokość: '10', Głębokość: '12', Wysokość: '14', 'Położenie X': '0' }, volume: 10 * 12 * 14 },
    { type: 'cylinder', fields: { Promień: '5', Wysokość: '10', 'Położenie X': '30' }, volume: Math.PI * 5 * 5 * 10 },
    { type: 'sphere', fields: { Promień: '6', 'Położenie X': '60' }, volume: (4 / 3) * Math.PI * 6 ** 3 },
    { type: 'torus', fields: { 'Promień główny': '12', 'Promień przekroju': '3', 'Położenie X': '100' }, volume: 2 * Math.PI ** 2 * 12 * 3 ** 2 },
  ];
  for (const [index, fixture] of primitiveFixtures.entries()) {
    await clickTool('Prymityw');
    await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Prymityw 3D')`, `okno prymitywu ${fixture.type}`);
    await setCommandField('Typ', fixture.type);
    for (const [label, value] of Object.entries(fixture.fields)) await setCommandField(label, value);
    const primitiveRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
    await confirmDialog();
    await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${primitiveRevision} && window.__madcadVerifyEngineState?.bodies?.length === ${index + 1} && window.__madcadVerifyEngineState?.status === 'ready'`, `przeliczony prymityw ${fixture.type}`, modelingTimeoutMs);
    const volume = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[${index}].metrics.volume`);
    assertClose(volume, fixture.volume, 0.05, `${fixture.type} volume`);
  }

  await clickTool('Analiza');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.command?.type === 'geometryInspection' && Math.abs(window.__madcadVerifyDocumentState.command.geometryInspection.minimumRadius - 3) < 0.001 && window.__madcadVerifyDocumentState.command.geometryInspection.collisions.length === 0`, 'minimalny promień i brak kolizji prymitywów', modelingTimeoutMs);
  await waitForUi(window, `document.querySelector('.geometry-inspection-panel')?.textContent.includes('3 mm') && document.querySelector('.geometry-inspection-panel')?.textContent.includes('Nie wykryto wspólnej objętości')`, 'panel analizy geometrii');
  await window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('.geometry-inspection-panel header button');
    const key = button && Object.keys(button).find((item) => item.startsWith('__reactProps'));
    if (!key || typeof button[key]?.onClick !== 'function') throw new Error('Brak zamknięcia analizy geometrii.');
    button[key].onClick();
  })()`);
  await waitForUi(window, `!document.querySelector('.geometry-inspection-panel')`, 'zamknięta analiza geometrii');

  progress('shared move rotate offset face manipulator');
  const primitiveBoxId = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].id`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection({ kind: 'body', bodyId: ${JSON.stringify(primitiveBoxId)} }, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'body'`, 'bryła wskazana do przesunięcia');
  await clickTool('Przesuń bryłę');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Przesuń bryłę') && document.querySelector('.direct-handle-hit')`, 'wspólny manipulator przesunięcia');
  await dragDirectExtrude();
  await setCommandField('Przesunięcie X', '5');
  await waitForUi(window, `Math.abs(window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(primitiveBoxId)}).metrics.bounds[0][0] - 5) < 0.001 && window.__madcadVerifyEngineState.timeline.at(-1)?.status === 'ok'`, 'podgląd przesuniętej bryły', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.at(-1)?.type === 'transform' && window.__madcadVerifyDocumentState.featureData.at(-1).x === '5'`, 'zapisane przesunięcie bryły', modelingTimeoutMs);
  let boxBounds = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(primitiveBoxId)}).metrics.bounds`);
  if (Math.abs(boxBounds[0][0] - 5) > 0.001) {
    const moveDiagnostic = await window.webContents.executeJavaScript(`({ feature: window.__madcadVerifyDocumentState.featureData.at(-1), bodies: window.__madcadVerifyEngineState.bodies.map((body) => ({ id: body.id, bounds: body.metrics.bounds })) })`);
    throw new Error(`Move body minimum X: expected 5, received ${boxBounds[0][0]}; ${JSON.stringify(moveDiagnostic)}`);
  }

  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection({ kind: 'body', bodyId: ${JSON.stringify(primitiveBoxId)} }, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'body' && window.__madcadVerifyDocumentState.selection.id === ${JSON.stringify(primitiveBoxId)}`, 'bryła ponownie wskazana do obrotu');
  await clickTool('Obróć bryłę');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Obróć bryłę') && document.querySelector('.direct-handle-hit')`, 'wspólny manipulator obrotu');
  await setCommandField('Kąt Z', '90');
  await waitForUi(window, `Math.abs((window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(primitiveBoxId)}).metrics.dimensions[0]) - 12) < 0.001 && window.__madcadVerifyEngineState.timeline.at(-1)?.status === 'ok'`, 'podgląd obróconej bryły', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.at(-1)?.mode === 'rotate'`, 'zapisany obrót bryły', modelingTimeoutMs);
  boxBounds = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(primitiveBoxId)}).metrics.bounds`);
  assertClose(boxBounds[1][0] - boxBounds[0][0], 12, 0.001, 'Rotate body X dimension');

  const offsetSelection = await window.webContents.executeJavaScript(`(() => { const body = window.__madcadVerifyEngineState.bodies.find((item) => item.id === ${JSON.stringify(primitiveBoxId)}); const face = body.topology.faces.filter((item) => item.descriptor.geometry === 'PLANE').sort((left, right) => right.descriptor.center[2] - left.descriptor.center[2])[0]; return { kind: 'face', id: face.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId }; })()`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify(offsetSelection)}, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'face' && window.__madcadVerifyDocumentState.selection.id === ${JSON.stringify(offsetSelection.id)}`, 'ściana wskazana do Press Pull');
  await clickTool('Press Pull');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Offset Face') && document.querySelector('.direct-handle-hit')`, 'wspólny manipulator Offset Face');
  await setCommandField('Odległość', '2');
  await waitForUi(window, `Math.abs(window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(primitiveBoxId)}).metrics.volume - ${10 * 12 * 16}) < 0.05 && window.__madcadVerifyEngineState.timeline.at(-1)?.status === 'ok'`, 'podgląd odsuniętej ściany', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.at(-1)?.type === 'offsetFace'`, 'zapisany Offset Face', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(primitiveBoxId)}).metrics.volume`), 10 * 12 * 16, 0.05, 'Offset Face volume');

  progress('draft planar face about neutral plane');
  const draftFixture = await window.webContents.executeJavaScript(`(() => {
    const body = window.__madcadVerifyEngineState.bodies.find((item) => item.id === ${JSON.stringify(primitiveBoxId)});
    const face = body.topology.faces
      .filter((item) => item.descriptor.geometry === 'PLANE' && Math.abs(item.descriptor.normal?.[2] || 0) < 0.1)
      .sort((left, right) => left.descriptor.center[2] - right.descriptor.center[2])[0];
    const normalAxis = Math.abs(face.descriptor.normal[0]) > Math.abs(face.descriptor.normal[1]) ? 0 : 1;
    const transverseAxis = normalAxis === 0 ? 1 : 0;
    return {
      selection: { kind: 'face', id: face.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId },
      transverse: body.metrics.dimensions[transverseAxis],
      height: body.metrics.dimensions[2],
    };
  })()`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify(draftFixture.selection)}, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'face' && window.__madcadVerifyDocumentState.selection.id === ${JSON.stringify(draftFixture.selection.id)}`, 'ściana wskazana do Draft');
  await clickTool('Draft');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Płaszczyzna neutralna') && document.querySelector('.command-dialog')?.textContent.includes('Kąt Draft')`, 'okno Draft');
  await clickDialogButton('Anuluj');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.features === 7 && !document.querySelector('.command-dialog') && Math.abs(window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(primitiveBoxId)}).metrics.volume - ${10 * 12 * 16}) < 0.05`, 'anulowanie Draft bez częściowego stanu', modelingTimeoutMs);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify(draftFixture.selection)}, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'face' && window.__madcadVerifyDocumentState.selection.id === ${JSON.stringify(draftFixture.selection.id)}`, 'ściana ponownie wskazana do Draft');
  await clickTool('Draft');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Kąt Draft')`, 'ponowne otwarcie Draft');
  const positiveDraftRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await setCommandField('Płaszczyzna neutralna', 'XY');
  await setCommandField('Kąt Draft', '5');
  const draftBaseVolume = 10 * 12 * 16;
  const draftDelta = 0.5 * draftFixture.transverse * draftFixture.height ** 2 * Math.tan(5 * Math.PI / 180);
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${positiveDraftRevision} && window.__madcadVerifyEngineState?.timeline?.length === 8 && window.__madcadVerifyEngineState.timeline.at(-1)?.status === 'ok' && Math.abs(window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(primitiveBoxId)}).metrics.volume - ${draftBaseVolume - draftDelta}) < 0.05`, 'podgląd Draft', modelingTimeoutMs);
  const positiveDraftVolume = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(primitiveBoxId)}).metrics.volume`);
  assertClose(Math.abs(positiveDraftVolume - draftBaseVolume), draftDelta, 0.05, 'Positive Draft volume delta');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.at(-1)?.type === 'draft' && window.__madcadVerifyDocumentState.featureData.at(-1).neutralPlaneId === 'XY' && window.__madcadVerifyDocumentState.featureData.at(-1).referenceIds?.length === 1`, 'zapisany Draft', modelingTimeoutMs);
  await editTimelineFeature(7, 'Draft');
  const negativeDraftRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await setCommandField('Kąt Draft', '-5');
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${negativeDraftRevision} && window.__madcadVerifyEngineState?.timeline?.at(-1)?.status === 'ok' && Math.abs(window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(primitiveBoxId)}).metrics.volume - ${draftBaseVolume + draftDelta}) < 0.05`, 'podgląd odwróconego Draft', modelingTimeoutMs);
  const negativeDraftVolume = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies.find((body) => body.id === ${JSON.stringify(primitiveBoxId)}).metrics.volume`);
  assertClose(Math.abs(negativeDraftVolume - draftBaseVolume), draftDelta, 0.05, 'Negative Draft volume delta');
  if ((positiveDraftVolume - draftBaseVolume) * (negativeDraftVolume - draftBaseVolume) >= 0) throw new Error(`Draft angle sign did not reverse the taper direction: ${JSON.stringify({ draftBaseVolume, positiveDraftVolume, negativeDraftVolume, draftDelta })}`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.at(-1)?.angle === '-5' && !document.querySelector('.command-dialog')`, 'zapisany odwrócony Draft', modelingTimeoutMs);
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.at(-1)?.angle === '5'`, 'undo kierunku Draft', modelingTimeoutMs);
  await sendShortcut('y');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.at(-1)?.angle === '-5'`, 'redo kierunku Draft', modelingTimeoutMs);
  await waitForUi(window, `(() => { const feature = JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null')?.features?.at(-1); return feature?.type === 'draft' && feature.angle === '-5'; })()`, 'autozapis Draft');
  const draftReopenRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave?.()`);
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${draftReopenRevision} && window.__madcadVerifyDocumentState?.featureData?.at(-1)?.angle === '-5'`, 'ponownie otwarty Draft', modelingTimeoutMs);

  progress('text profile extrude emboss deboss');
  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt dla tekstu');
  await clickTool('Tekst 3D');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Tekst 3D')`, 'okno nowej bryły tekstowej');
  await setCommandField('Tekst', 'HI');
  await setCommandField('Rozmiar', '7');
  await setCommandField('Głębokość', '2');
  const newTextRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${newTextRevision} && window.__madcadVerifyEngineState?.bodies?.length === 1 && window.__madcadVerifyDocumentState?.featureData?.[0]?.type === 'textSolid'`, 'wyciągnięty tekst jako nowa bryła', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), 32 * 2, 0.05, 'Text extrusion volume');

  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt dla Emboss');
  await clickTool('Prymityw');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Prymityw 3D')`, 'baza tekstu');
  await setCommandField('Szerokość', '40');
  await setCommandField('Głębokość', '20');
  await setCommandField('Wysokość', '5');
  await confirmDialog();
  await waitForUi(window, `Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 4000) < 0.05`, 'bryła bazowa tekstu', modelingTimeoutMs);
  const textFace = await window.webContents.executeJavaScript(`(() => { const body = window.__madcadVerifyEngineState.bodies[0]; const face = body.topology.faces.filter((item) => item.descriptor.geometry === 'PLANE').sort((left, right) => right.descriptor.center[2] - left.descriptor.center[2])[0]; return { kind: 'face', id: face.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId }; })()`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify(textFace)}, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'face'`, 'planarna ściana wskazana dla Emboss');
  await clickTool('Tekst 3D');
  await waitForUi(window, `[...document.querySelectorAll('.command-field')].some((field) => field.firstElementChild?.textContent === 'Powierzchnia' && field.querySelector('input')?.value.includes('Planarna ściana'))`, 'trwała powierzchnia Emboss');
  await setCommandField('Tekst', 'HI');
  await setCommandField('Rozmiar', '7');
  await setCommandField('Głębokość', '2');
  await setCommandField('Położenie X', '-5');
  await setCommandField('Położenie Y', '-3');
  await waitForUi(window, `Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 4064) < 0.05`, 'podgląd Emboss', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.operation === 'emboss' && window.__madcadVerifyDocumentState.featureData[1].placement === 'face' && window.__madcadVerifyDocumentState.featureData[1].referenceIds?.length === 1`, 'zapisany Emboss na powierzchni', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), 4064, 0.05, 'Text emboss volume');

  await editTimelineFeature(1, 'Tekst 3D');
  await setCommandField('Operacja', 'deboss');
  await waitForUi(window, `Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 3936) < 0.05`, 'podgląd Deboss', modelingTimeoutMs);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.operation === 'deboss'`, 'zapisany Deboss', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), 3936, 0.05, 'Text deboss volume');
  await sendShortcut('z');
  await waitForUi(window, `Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 4064) < 0.05`, 'undo tekstu', modelingTimeoutMs);
  await sendShortcut('z', true);
  await waitForUi(window, `Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 3936) < 0.05`, 'redo tekstu', modelingTimeoutMs);
  await waitForUi(window, `(() => { const saved = JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null'); return saved?.features?.[1]?.type === 'textSolid' && saved.features[1].operation === 'deboss'; })()`, 'autozapis tekstu 3D');
  const reopenTextRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave?.()`);
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${reopenTextRevision} && Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - 3936) < 0.05`, 'ponownie otwarty Deboss', modelingTimeoutMs);

  progress('new document');
  await clickByTitle('Nowy projekt');
  await waitForUi(window, `document.querySelector('.empty-canvas')`, 'pusty projekt');
  await new Promise((resolve) => setTimeout(resolve, 75));
  await fs.writeFile(emptyOutputPath, (await window.webContents.capturePage()).toPNG());

  progress('base sketch');
  await clickTool('Utwórz szkic');
  await waitForUi(window, `document.querySelector('.plane-picker')`, 'wybór płaszczyzny');
  await pickPlane('XY');
  await waitForUi(window, `document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'tryb szkicu');
  await clickTool('Prostokąt');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Prostokąt')`, 'polecenie prostokąta');
  await setCommandField('Szerokość', '64');
  await setCommandField('Wysokość', '42');
  await new Promise((resolve) => setTimeout(resolve, 75));
  await fs.writeFile(sketchOutputPath, (await window.webContents.capturePage()).toPNG());
  await confirmDialog();
  await waitForUi(window, `document.querySelectorAll('.tree-profile').length === 1`, 'profil prostokąta');
  await clickTool('Zakończ szkic');
  progress('extrude');
  await waitForUi(window, `document.querySelector('.direct-extrude-hint')`, 'uchwyt bezpośredniego wyciągnięcia');
  await waitForUi(window, `window.__madcadDirectHandlePoint`, 'pozycja uchwytu wyciągnięcia');
  progress(`direct point ${JSON.stringify(await window.webContents.executeJavaScript(`window.__madcadDirectHandlePoint`))}`);
  const directHandleIsVisible = await window.webContents.executeJavaScript(`(() => {
    const canvas = document.querySelector('.model-viewport canvas');
    const rect = canvas.getBoundingClientRect();
    const point = window.__madcadDirectHandlePoint;
    return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
  })()`);
  if (!directHandleIsVisible) throw new Error('Direct extrusion handle is outside the viewport.');
  await dragDirectExtrude();
  progress(`direct pointer ${JSON.stringify(await window.webContents.executeJavaScript(`window.__madcadPointerLog || null`))}`);
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Wyciągnięcie')`, 'polecenie wyciągnięcia');
  await new Promise((resolve) => setTimeout(resolve, 100));
  await fs.writeFile(directOutputPath, (await window.webContents.capturePage()).toPNG());
  await setCommandField('Odległość', '8');
  await setCommandField('Odsunięcie początku', '2');
  await new Promise((resolve) => setTimeout(resolve, 50));
  await confirmDialog();
  await waitForUi(window, `document.querySelectorAll('.timeline-item').length === 1`, 'dodane wyciągnięcie');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.startOffset === '2'`, 'parametryczne odsunięcie początku wyciągnięcia');
  await waitForUi(window, `document.querySelector('.engine-status')?.classList.contains('ready')`, 'przeliczona bryła', modelingTimeoutMs);

  await waitForUi(
    window,
    `Math.abs((window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume || 0) - ${64 * 42 * 8}) < 0.00001`,
    'golden B-Rep revision',
    modelingTimeoutMs,
  );
  const goldenBrep = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.bodies?.[0]?.metrics || null`);
  if (!goldenBrep) throw new Error('CAD engine did not return golden B-Rep metrics.');
  assertClose(goldenBrep.volume, 64 * 42 * 8, 1e-5, 'Golden B-Rep volume');
  assertClose(goldenBrep.area, 2 * ((64 * 42) + (64 * 8) + (42 * 8)), 1e-5, 'Golden B-Rep area');
  goldenBrep.dimensions.forEach((dimension, index) => {
    assertClose(dimension, [64, 42, 8][index], 1e-5, `Golden B-Rep dimension ${index}`);
  });
  assertClose(goldenBrep.bounds[0][2], 2, 1e-5, 'Golden B-Rep start offset');
  assertClose(goldenBrep.bounds[1][2], 10, 1e-5, 'Golden B-Rep offset end');
  if (goldenBrep.faceCount !== 6 || goldenBrep.edgeCount !== 12) {
    throw new Error(`Unexpected golden B-Rep topology: ${goldenBrep.faceCount} faces, ${goldenBrep.edgeCount} edges.`);
  }
  await editTimelineFeature(0);
  await setCommandField('Odsunięcie początku', '0');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.startOffset === '0' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.bounds?.[0]?.[2] || 0) < 1e-5`, 'edycja odsunięcia początku wyciągnięcia', modelingTimeoutMs);

  progress('closed profile thin extrude');
  await editTimelineFeature(0);
  await setCommandCheckbox('Cienka ścianka', true);
  await setCommandField('Grubość ścianki', '2');
  await setCommandField('Strona ścianki', 'symmetric');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.thin === true && window.__madcadVerifyDocumentState.featureData[0].wallSide === 'symmetric' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 3392) < 0.01`, 'Thin Extrude symetryczny', modelingTimeoutMs);
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.thin === false && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${64 * 42 * 8}) < 0.01`, 'undo Thin Extrude', modelingTimeoutMs);
  await sendShortcut('y');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.thin === true && window.__madcadVerifyDocumentState.featureData[0].wallSide === 'symmetric'`, 'redo Thin Extrude', modelingTimeoutMs);
  await waitForUi(window, `(() => { const feature = JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null')?.features?.[0]; return feature?.thin === true && feature.wallThickness === '2' && feature.wallSide === 'symmetric'; })()`, 'autozapis Thin Extrude');
  const thinReopenRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave?.()`);
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${thinReopenRevision} && window.__madcadVerifyDocumentState?.featureData?.[0]?.thin === true && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - 3392) < 0.01`, 'ponownie otwarty Thin Extrude', modelingTimeoutMs);
  await editTimelineFeature(0);
  await setCommandCheckbox('Cienka ścianka', false);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.thin === false && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${64 * 42 * 8}) < 0.01`, 'powrót do pełnego Extrude', modelingTimeoutMs);

  progress('B-Rep hover, multi-select and box select');
  await new Promise((resolve) => setTimeout(resolve, 50));
  const selectionRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  const topologyIds = await window.webContents.executeJavaScript(`(() => {
    const body = window.__madcadVerifyEngineState.bodies[0];
    return { face: body.topology.faces[0].id, edge: body.topology.edges[0].id, body: body.id };
  })()`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection({ kind: 'face', id: ${JSON.stringify(topologyIds.face)}, bodyId: ${JSON.stringify(topologyIds.body)} }, 'replace')`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection({ kind: 'edge', id: ${JSON.stringify(topologyIds.edge)}, bodyId: ${JSON.stringify(topologyIds.body)} }, 'add')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.items?.length === 2`, 'wielokrotny wybór topologii');
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection({ kind: 'face', id: ${JSON.stringify(topologyIds.face)}, bodyId: ${JSON.stringify(topologyIds.body)} }, 'toggle')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.items?.length === 1 && window.__madcadVerifyDocumentState.selection.items[0].kind === 'edge'`, 'przełączenie topologii Ctrl');
  await waitForUi(window, `window.__madcadModelScreenState?.topologyPoints?.[${JSON.stringify(topologyIds.face)}]`, 'punkt ekranowy ściany');
  const facePoint = await window.webContents.executeJavaScript(`window.__madcadModelScreenState.topologyPoints[${JSON.stringify(topologyIds.face)}]`);
  await sendMouse('mouseMove', facePoint);
  await waitForUi(window, `window.__madcadModelHover?.kind === 'face'`, 'hover ściany');
  await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.selection-filter-bar button')].find((item) => item.textContent === 'Ściana');
    button.click();
  })()`);
  await sendMouse('mouseMove', facePoint);
  await sendMouse('mouseDown', facePoint);
  await sendMouse('mouseUp', facePoint);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'face'`, 'pierwsza ściana cyklu');
  const firstCycledFace = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.selection.id`);
  await sendMouse('mouseMove', facePoint);
  await sendMouse('mouseDown', facePoint, ['alt']);
  await sendMouse('mouseUp', facePoint, ['alt']);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'face' && window.__madcadVerifyDocumentState.selection.id !== ${JSON.stringify(firstCycledFace)}`, 'cykliczny wybór nakładającej się ściany');
  await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.selection-filter-bar button')].find((item) => item.textContent === 'Bryła');
    button.click();
  })()`);
  await waitForUi(window, `document.querySelector('.selection-filter-bar button.active')?.textContent === 'Bryła'`, 'filtr bryły');
  const bodyBounds = await window.webContents.executeJavaScript(`window.__madcadModelScreenState.bodyBounds[${JSON.stringify(topologyIds.body)}]`);
  const canvasBounds = await window.webContents.executeJavaScript(`(() => { const rect = document.querySelector('.model-viewport canvas').getBoundingClientRect(); return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }; })()`);
  const boxStart = { x: Math.max(canvasBounds.left + 2, bodyBounds.left - 12), y: Math.max(canvasBounds.top + 2, bodyBounds.top - 12) };
  const boxEnd = { x: Math.min(canvasBounds.right - 2, bodyBounds.right + 12), y: Math.min(canvasBounds.bottom - 2, bodyBounds.bottom + 12) };
  await sendMouse('mouseDown', boxStart, ['shift']);
  await sendMouse('mouseMove', boxEnd, ['shift']);
  await sendMouse('mouseUp', boxEnd, ['shift']);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.items?.some((item) => item.kind === 'body')`, 'wybór bryły obszarem');
  const revisionAfterSelection = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  if (revisionAfterSelection !== selectionRevision) throw new Error('Picking uruchomił ponowne przeliczenie bryły.');
  const lostReferenceId = await window.webContents.executeJavaScript(`window.__madcadVerifyCreateLostTopologyReference()`);
  await waitForUi(window, `document.querySelector('.reference-repair-panel')?.textContent.includes('Źródło: Wyciągnięcie 1')`, 'komunikat utraconej referencji ze źródłowym feature', modelingTimeoutMs);
  await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.reference-repair-panel button')].find((item) => item.textContent === 'Kandydat 1');
    if (!button) throw new Error('Brak kandydata naprawy referencji.');
    button.click();
  })()`);
  await waitForUi(window, `!document.querySelector('.reference-repair-panel') && window.__madcadVerifyDocumentState?.references?.find((item) => item.id === ${JSON.stringify(lostReferenceId)})?.topologyId !== window.__madcadVerifyEngineState.bodies[0].topology.edges[0].id + '-lost'`, 'ponowne przypisanie referencji', modelingTimeoutMs);

  progress('parametric offset construction plane');
  await clickTool('Płaszczyzna offset');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Płaszczyzna odsunięta')`, 'okno płaszczyzny odsuniętej');
  await setCommandField('Nazwa', 'Płaszczyzna montażowa');
  await setCommandField('Płaszczyzna bazowa', 'YZ');
  await setCommandField('Odległość', '15');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.references?.some((item) => item.kind === 'construction-plane' && item.name === 'Płaszczyzna montażowa' && item.basePlane === 'YZ' && item.offset === '15')`, 'zapis płaszczyzny konstrukcyjnej');
  const constructionPlaneId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.references.find((item) => item.kind === 'construction-plane').id`);
  await waitForUi(window, `(() => { const plane = window.__madcadConstructionPlaneState?.find((item) => item.id === ${JSON.stringify(constructionPlaneId)}); return plane?.status === 'ok' && plane.visible && plane.origin[0] === 15 && plane.origin[1] === 0 && plane.origin[2] === 0; })()`, 'dokładne położenie płaszczyzny YZ');
  await window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('.tree-reference-row .tree-reference-visibility');
    if (!button) throw new Error('Brak przełącznika widoczności płaszczyzny.');
    button.click();
  })()`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.references?.find((item) => item.id === ${JSON.stringify(constructionPlaneId)})?.visible === false`, 'ukrycie płaszczyzny');
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.references?.find((item) => item.id === ${JSON.stringify(constructionPlaneId)})?.visible === true`, 'undo widoczności płaszczyzny');
  await sendShortcut('y');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.references?.find((item) => item.id === ${JSON.stringify(constructionPlaneId)})?.visible === false`, 'redo widoczności płaszczyzny');
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.references?.find((item) => item.id === ${JSON.stringify(constructionPlaneId)})?.visible === true`, 'przywrócenie widoczności płaszczyzny');
  await clickTool('Midplane');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Płaszczyzna środkowa')`, 'okno midplane');
  await setCommandField('Nazwa', 'Środek korpusu');
  await setCommandField('Płaszczyzna bazowa', 'XY');
  await setCommandField('Położenie A', '-4');
  await setCommandField('Położenie B', '20');
  await confirmDialog();
  await waitForUi(window, `(() => { const plane = window.__madcadConstructionPlaneState?.find((item) => item.name === 'Środek korpusu'); return plane?.status === 'ok' && plane.origin[2] === 8; })()`, 'dokładna płaszczyzna środkowa');
  await clickTool('Płaszczyzna offset');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Płaszczyzna odsunięta')`, 'okno płaszczyzny końca wyciągnięcia');
  await setCommandField('Nazwa', 'Koniec wyciągnięcia');
  await setCommandField('Płaszczyzna bazowa', 'XY');
  await setCommandField('Odległość', '12');
  await confirmDialog();
  await waitForUi(window, `window.__madcadConstructionPlaneState?.some((item) => item.name === 'Koniec wyciągnięcia' && item.status === 'ok' && item.origin[2] === 12)`, 'docelowa płaszczyzna wyciągnięcia');
  const extrudeTargetPlaneId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.references.find((item) => item.kind === 'construction-plane' && item.name === 'Koniec wyciągnięcia').id`);

  progress('extrude to construction plane');
  await editTimelineFeature(0);
  await setCommandField('Odsunięcie początku', '2');
  await setCommandField('Kierunek', 'to-object');
  await setCommandField('Obiekt docelowy', extrudeTargetPlaneId);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.extent === 'to-object' && window.__madcadVerifyDocumentState.featureData[0].targetReferenceId === ${JSON.stringify(extrudeTargetPlaneId)} && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.bounds?.[0]?.[2] - 2) < 1e-5 && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.bounds?.[1]?.[2] - 12) < 1e-5`, 'Extrude To Object do płaszczyzny', modelingTimeoutMs);
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.extent === 'one-side' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.bounds?.[1]?.[2] - 8) < 1e-5`, 'undo Extrude To Object', modelingTimeoutMs);
  await sendShortcut('y');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.extent === 'to-object' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume - ${64 * 42 * 10}) < 1e-5`, 'redo Extrude To Object', modelingTimeoutMs);
  await waitForUi(window, `(() => { const saved = JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null'); return saved?.features?.[0]?.extent === 'to-object' && saved.features[0].targetReferenceId === ${JSON.stringify(extrudeTargetPlaneId)}; })()`, 'autozapis Extrude To Object');
  const toObjectRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave?.()`);
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${toObjectRevision} && window.__madcadVerifyDocumentState?.featureData?.[0]?.extent === 'to-object' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.bounds?.[1]?.[2] - 12) < 1e-5`, 'ponownie otwarty Extrude To Object', modelingTimeoutMs);
  await editTimelineFeature(0);
  await setCommandField('Kierunek', 'one-side');
  await setCommandField('Odległość', '8');
  await setCommandField('Odsunięcie początku', '0');
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[0]?.extent === 'one-side' && Math.abs(window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.bounds?.[1]?.[2] - 8) < 1e-5`, 'przywrócony zakres bazowego wyciągnięcia', modelingTimeoutMs);
  await clickTool('Plane 3 punkty');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Płaszczyzna przez trzy punkty')`, 'okno plane przez trzy punkty');
  await setCommandField('Nazwa', 'Płaszczyzna punktów');
  await setCommandField('Punkt 1 Z', '6');
  await setCommandField('Punkt 2 Z', '6');
  await setCommandField('Punkt 3 Z', '6');
  await confirmDialog();
  await waitForUi(window, `(() => { const plane = window.__madcadConstructionPlaneState?.find((item) => item.name === 'Płaszczyzna punktów'); return plane?.status === 'ok' && plane.origin[2] === 6 && plane.normal[2] === 1; })()`, 'płaszczyzna przez trzy niewspółliniowe punkty');
  await clickTool('Plane angle');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Płaszczyzna pod kątem')`, 'okno plane angle');
  await setCommandField('Nazwa', 'Płaszczyzna kątowa');
  await setCommandField('Płaszczyzna bazowa', 'XY');
  await setCommandField('Oś obrotu', 'u');
  await setCommandField('Kąt', '30');
  await setCommandField('Odległość', '5');
  await confirmDialog();
  await waitForUi(window, `(() => { const plane = window.__madcadConstructionPlaneState?.find((item) => item.name === 'Płaszczyzna kątowa'); return plane?.status === 'ok' && Math.abs(plane.origin[2] - 5) < 1e-9 && Math.abs(plane.normal[1] + 0.5) < 1e-9; })()`, 'parametryczna płaszczyzna pod kątem');
  await clickTool('Plane tangent');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Płaszczyzna styczna')`, 'okno plane tangent');
  await setCommandField('Nazwa', 'Płaszczyzna styczna sfery');
  await setCommandField('Styczność X', '0');
  await setCommandField('Styczność Y', '5');
  await confirmDialog();
  await waitForUi(window, `(() => { const plane = window.__madcadConstructionPlaneState?.find((item) => item.name === 'Płaszczyzna styczna sfery'); return plane?.status === 'ok' && plane.origin[1] === 5 && plane.normal[1] === 1; })()`, 'płaszczyzna styczna');
  await clickTool('Plane path');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Płaszczyzna na ścieżce')`, 'okno plane path');
  await setCommandField('Nazwa', 'Płaszczyzna normalna ścieżki');
  await setCommandField('Punkt ścieżki X', '2');
  await setCommandField('Punkt ścieżki Y', '3');
  await setCommandField('Punkt ścieżki Z', '4');
  await setCommandField('Kierunek ścieżki X', '1');
  await setCommandField('Kierunek ścieżki Y', '1');
  await confirmDialog();
  await waitForUi(window, `(() => { const plane = window.__madcadConstructionPlaneState?.find((item) => item.name === 'Płaszczyzna normalna ścieżki'); return plane?.status === 'ok' && plane.origin[0] === 2 && plane.origin[1] === 3 && plane.origin[2] === 4 && Math.abs(plane.normal[0] - Math.SQRT1_2) < 1e-9; })()`, 'płaszczyzna na ścieżce');
  await sendShortcut('z');
  await waitForUi(window, `!window.__madcadConstructionPlaneState?.some((item) => item.name === 'Płaszczyzna normalna ścieżki')`, 'undo płaszczyzny na ścieżce');
  await sendShortcut('z', true);
  await waitForUi(window, `window.__madcadConstructionPlaneState?.some((item) => item.name === 'Płaszczyzna normalna ścieżki' && item.status === 'ok')`, 'redo płaszczyzny na ścieżce');
  await waitForUi(window, `(() => { const saved = JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null'); return ['angle', 'tangent', 'path'].every((type) => saved?.references?.some((item) => item.planeType === type)); })()`, 'autozapis nowych płaszczyzn');

  progress('construction axes');
  await clickTool('Oś z krawędzi');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Oś z krawędzi')`, 'okno osi z krawędzi');
  await setCommandField('Nazwa', 'Oś krawędzi testowej');
  await setCommandField('Punkt 2 X', '25');
  await confirmDialog();
  await waitForUi(window, `(() => { const axis = window.__madcadConstructionAxisState?.find((item) => item.name === 'Oś krawędzi testowej'); return axis?.status === 'ok' && axis.direction[0] === 1; })()`, 'oś z krawędzi');
  await clickTool('Oś walca');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Oś walca')`, 'okno osi walca');
  await setCommandField('Nazwa', 'Oś walca testowego');
  await setCommandField('Środek X', '4');
  await setCommandField('Kierunek Z', '3');
  await confirmDialog();
  await waitForUi(window, `(() => { const axis = window.__madcadConstructionAxisState?.find((item) => item.name === 'Oś walca testowego'); return axis?.status === 'ok' && axis.origin[0] === 4 && axis.direction[2] === 1; })()`, 'oś walca');
  await clickTool('Oś 2 punkty');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Oś przez dwa punkty')`, 'okno osi przez dwa punkty');
  await setCommandField('Nazwa', 'Oś przekątna');
  await setCommandField('Punkt 2 Y', '10');
  await setCommandField('Punkt 2 Z', '10');
  await confirmDialog();
  await waitForUi(window, `(() => { const axis = window.__madcadConstructionAxisState?.find((item) => item.name === 'Oś przekątna'); return axis?.status === 'ok' && Math.abs(axis.direction[1] - Math.SQRT1_2) < 1e-9 && Math.abs(axis.direction[2] - Math.SQRT1_2) < 1e-9; })()`, 'oś przez dwa punkty');
  await clickTool('Oś przecięcia');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Oś przecięcia płaszczyzn')`, 'okno osi przecięcia');
  await setCommandField('Nazwa', 'Oś przecięcia testowa');
  await setCommandField('Płaszczyzna A', constructionPlaneId);
  const midplaneId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.references.find((item) => item.name === 'Środek korpusu').id`);
  await setCommandField('Płaszczyzna B', midplaneId);
  await confirmDialog();
  await waitForUi(window, `(() => { const axis = window.__madcadConstructionAxisState?.find((item) => item.name === 'Oś przecięcia testowa'); return axis?.status === 'ok' && axis.origin[0] === 15 && axis.origin[2] === 8 && Math.abs(axis.direction[1]) === 1; })()`, 'oś przecięcia dwóch płaszczyzn');
  await clickTool('Oś normalna');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Oś normalna do płaszczyzny')`, 'okno osi normalnej');
  await setCommandField('Nazwa', 'Oś normalna testowa');
  await setCommandField('Płaszczyzna', midplaneId);
  await setCommandField('Punkt osi X', '1');
  await setCommandField('Punkt osi Y', '2');
  await setCommandField('Punkt osi Z', '3');
  await confirmDialog();
  await waitForUi(window, `(() => { const axis = window.__madcadConstructionAxisState?.find((item) => item.name === 'Oś normalna testowa'); return axis?.status === 'ok' && axis.origin.join(',') === '1,2,3' && axis.direction.join(',') === '0,0,1'; })()`, 'oś normalna do płaszczyzny');

  progress('construction points');
  await clickTool('Punkt wierzchołka');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Punkt na wierzchołku')`, 'okno punktu wierzchołka');
  await setCommandField('Nazwa', 'Punkt bazowy');
  await setCommandField('X', '2');
  await setCommandField('Y', '3');
  await setCommandField('Z', '4');
  await confirmDialog();
  await waitForUi(window, `(() => { const point = window.__madcadConstructionPointState?.find((item) => item.name === 'Punkt bazowy'); return point?.status === 'ok' && point.position.join(',') === '2,3,4'; })()`, 'punkt na wierzchołku');
  await clickTool('Punkt centrum');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Punkt środka')`, 'okno punktu centrum');
  await setCommandField('Nazwa', 'Punkt środka testowy');
  await setCommandField('X', '5');
  await setCommandField('Y', '6');
  await setCommandField('Z', '7');
  await confirmDialog();
  await waitForUi(window, `(() => { const point = window.__madcadConstructionPointState?.find((item) => item.name === 'Punkt środka testowy'); return point?.status === 'ok' && point.position.join(',') === '5,6,7'; })()`, 'punkt centrum');
  await clickTool('Punkt przecięcia');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Punkt przecięcia')`, 'okno punktu przecięcia');
  await setCommandField('Nazwa', 'Punkt przecięcia testowy');
  const edgeAxisId = await window.webContents.executeJavaScript(`window.__madcadVerifyDocumentState.references.find((item) => item.name === 'Oś krawędzi testowej').id`);
  await setCommandField('Oś', edgeAxisId);
  await setCommandField('Płaszczyzna', constructionPlaneId);
  await confirmDialog();
  await waitForUi(window, `(() => { const point = window.__madcadConstructionPointState?.find((item) => item.name === 'Punkt przecięcia testowy'); return point?.status === 'ok' && point.position.join(',') === '15,0,0'; })()`, 'punkt przecięcia osi i płaszczyzny');
  await clickTool('Punkt środkowy');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Punkt środkowy')`, 'okno punktu środkowego');
  await setCommandField('Nazwa', 'Środek odcinka testowy');
  await setCommandField('Punkt 1 X', '2');
  await setCommandField('Punkt 1 Y', '4');
  await setCommandField('Punkt 1 Z', '6');
  await setCommandField('Punkt 2 X', '10');
  await setCommandField('Punkt 2 Y', '8');
  await setCommandField('Punkt 2 Z', '4');
  await confirmDialog();
  await waitForUi(window, `(() => { const point = window.__madcadConstructionPointState?.find((item) => item.name === 'Środek odcinka testowy'); return point?.status === 'ok' && point.position.join(',') === '6,6,5'; })()`, 'punkt środkowy dwóch punktów');
  await clickTool('Punkt na osi');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Punkt na osi')`, 'okno punktu na osi');
  await setCommandField('Nazwa', 'Punkt odsunięty na osi');
  await setCommandField('Oś', edgeAxisId);
  await setCommandField('Odległość na osi', '7');
  await confirmDialog();
  await waitForUi(window, `(() => { const point = window.__madcadConstructionPointState?.find((item) => item.name === 'Punkt odsunięty na osi'); return point?.status === 'ok' && point.position.join(',') === '7,0,0'; })()`, 'punkt odsunięty na osi');
  await sendShortcut('z');
  await waitForUi(window, `!window.__madcadConstructionPointState?.some((item) => item.name === 'Punkt odsunięty na osi')`, 'undo punktu na osi');
  await sendShortcut('y');
  await waitForUi(window, `window.__madcadConstructionPointState?.some((item) => item.name === 'Punkt odsunięty na osi' && item.status === 'ok')`, 'redo punktu na osi');
  await waitForUi(window, `(() => { const saved = JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null'); return saved?.references?.some((item) => item.axisType === 'plane-normal') && ['midpoint', 'on-axis'].every((type) => saved.references.some((item) => item.pointType === type)); })()`, 'autozapis nowych osi i punktów');
  const constructionReopenRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave()`);
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${constructionReopenRevision} && window.__madcadVerifyEngineState?.status === 'ready' && ['angle', 'tangent', 'path'].every((type) => window.__madcadVerifyDocumentState?.references?.some((item) => item.planeType === type)) && window.__madcadConstructionAxisState?.some((item) => item.axisType === 'plane-normal' && item.status === 'ok') && ['midpoint', 'on-axis'].every((type) => window.__madcadConstructionPointState?.some((item) => item.pointType === type && item.status === 'ok'))`, 'ponowne otwarcie rozszerzonej geometrii konstrukcyjnej', modelingTimeoutMs);

  progress('sketch on planar model face');
  const supportFace = await window.webContents.executeJavaScript(`(() => {
    const body = window.__madcadVerifyEngineState.bodies[0];
    const face = body.topology.faces.find((item) => item.descriptor.geometry === 'PLANE' && Math.abs(item.descriptor.normal?.[2] || 0) > 0.99 && item.descriptor.center?.[2] > 7.9);
    return face && { id: face.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId };
  })()`);
  if (!supportFace) throw new Error('Brak górnej planarnej ściany do testu szkicu na modelu.');
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify({ kind: 'face', ...supportFace })}, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'face' && window.__madcadVerifyDocumentState.selection.id === ${JSON.stringify(supportFace.id)}`, 'ściana wskazana dla szkicu na modelu');
  await clickTool('Utwórz szkic');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.length === 2 && window.__madcadVerifyDocumentState.sketches[1].support?.kind === 'face' && Number(window.__madcadVerifyDocumentState.sketches[1].planeOffset) > 7.9 && document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'szkic założony bezpośrednio na ścianie modelu', modelingTimeoutMs);
  await clickTool('Zakończ szkic');
  await waitForUi(window, `!document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'zakończenie szkicu na ścianie');

  progress('sketch on named construction plane');
  await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.tree-reference-row .tree-row')].find((item) => item.textContent.includes('Płaszczyzna montażowa'));
    if (!button) throw new Error('Brak płaszczyzny konstrukcyjnej w przeglądarce.');
    button.click();
  })()`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'constructionPlane'`, 'wybór płaszczyzny konstrukcyjnej');
  await clickTool('Utwórz szkic');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.length === 3 && window.__madcadVerifyDocumentState.sketches[2].support?.kind === 'construction-plane' && Number(window.__madcadVerifyDocumentState.sketches[2].planeOffset) === 15 && document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'szkic na nazwanej płaszczyźnie konstrukcyjnej', modelingTimeoutMs);
  await clickTool('Zakończ szkic');
  await waitForUi(window, `!document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'zakończenie szkicu na płaszczyźnie konstrukcyjnej');

  progress('hole sketch');
  await clickTool('Utwórz szkic');
  await waitForUi(window, `document.querySelector('.plane-picker')`, 'drugi wybór płaszczyzny');
  await pickPlane('XY');
  await waitForUi(window, `document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'drugi tryb szkicu');
  await clickTool('Project');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.command?.type === 'projectSketch'`, 'tryb Project');
  const projectionEdge = await window.webContents.executeJavaScript(`(() => {
    const body = window.__madcadVerifyEngineState.bodies[0];
    const edge = body.topology.edges.find((item) => { const [first, second] = item.descriptor.endpoints || []; return first && second && Math.hypot(second[0] - first[0], second[1] - first[1]) > 1; });
    return edge && { id: edge.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId };
  })()`);
  if (!projectionEdge) throw new Error('Brak niezerowej krawędzi do Project.');
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify({ kind: 'edge', ...projectionEdge })}, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'edge' && window.__madcadVerifyDocumentState.selection.id === ${JSON.stringify(projectionEdge.id)}`, 'krawędź wskazana do Project');
  await clickTool('Project');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.sketches?.[3]?.entityData?.some((entity) => entity.role === 'projected' && entity.fixed && entity.projectionReferenceId)`, 'projekcja krawędzi z trwałym linkiem');
  const brokenProject = await window.webContents.executeJavaScript(`window.__madcadVerifyBreakProjectedReference()`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.references?.find((item) => item.id === ${JSON.stringify(brokenProject.referenceId)})?.topologyId.endsWith('-lost')`, 'kontrolowane zerwanie źródła Project');
  await waitForUi(window, `document.querySelector('.reference-repair-panel')?.textContent.includes('Project')`, 'panel utraconego źródła Project', modelingTimeoutMs);
  await waitForUi(window, `window.__madcadSketchEntityScreenPoints?.[${JSON.stringify(brokenProject.entityId)}]?.state === 'error'`, 'wyróżnienie utraconego źródła Project', modelingTimeoutMs);
  await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.reference-repair-panel button')].find((item) => item.textContent === 'Kandydat 1');
    if (!button) throw new Error('Brak kandydata naprawy Project.');
    button.click();
  })()`);
  await waitForUi(window, `!document.querySelector('.reference-repair-panel') && window.__madcadSketchEntityScreenPoints?.[${JSON.stringify(brokenProject.entityId)}]?.state === 'projected' && !window.__madcadVerifyDocumentState.references.find((item) => item.id === ${JSON.stringify(brokenProject.referenceId)})?.topologyId.endsWith('-lost')`, 'naprawa i odświeżenie Project', modelingTimeoutMs);
  await toggleSketchOption('Geometria Project');
  await waitForUi(window, `window.__madcadSketchVisibilityState?.showProjectedGeometry === false && !window.__madcadSketchVisibilityState.entityIds.includes(${JSON.stringify(brokenProject.entityId)})`, 'ukrycie geometrii Project');
  await toggleSketchOption('Geometria Project');
  await waitForUi(window, `window.__madcadSketchVisibilityState?.showProjectedGeometry === true && window.__madcadSketchVisibilityState.entityIds.includes(${JSON.stringify(brokenProject.entityId)})`, 'pokazanie geometrii Project');
  await toggleSketchOption('Slice modelu');
  await waitForUi(window, `window.__madcadSketchVisibilityState?.sliceModel === true && document.querySelector('.sketch-slice-badge')?.textContent.includes('XY')`, 'Slice modelu na płaszczyźnie szkicu');
  await toggleSketchOption('Slice modelu');
  await waitForUi(window, `window.__madcadSketchVisibilityState?.sliceModel === false && !document.querySelector('.sketch-slice-badge')`, 'wyłączenie Slice');
  await clickTool('Okrąg');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Okrąg')`, 'polecenie okręgu');
  await setCommandField('Średnica', '12');
  await confirmDialog();
  await waitForUi(window, `document.querySelectorAll('.tree-profile').length === 2`, 'profil okręgu');
  await toggleSketchOption('Profile');
  await waitForUi(window, `window.__madcadSketchVisibilityState?.showSketchProfiles === false && window.__madcadSketchVisibilityState.profileCount === 0`, 'ukrycie profili szkicu');
  await toggleSketchOption('Profile');
  await waitForUi(window, `window.__madcadSketchVisibilityState?.showSketchProfiles === true && window.__madcadSketchVisibilityState.profileCount > 0`, 'pokazanie profili szkicu');
  await toggleSketchOption('Wiązania');
  await waitForUi(window, `window.__madcadSketchVisibilityState?.showSketchConstraints === false`, 'ukrycie więzów szkicu');
  await toggleSketchOption('Wiązania');
  await toggleSketchOption('Wymiary');
  await waitForUi(window, `window.__madcadSketchVisibilityState?.showSketchConstraints === true && window.__madcadSketchVisibilityState?.showSketchDimensions === false`, 'niezależna kontrola wymiarów i więzów');
  await toggleSketchOption('Wymiary');
  await toggleSketchOption('Geometrie konstrukcyjne');
  await waitForUi(window, `window.__madcadSketchVisibilityState?.showSketchDimensions === true && window.__madcadSketchVisibilityState?.showConstructionGeometry === false`, 'ukrycie geometrii konstrukcyjnej');
  await toggleSketchOption('Geometrie konstrukcyjne');
  await clickTool('Zakończ szkic');
  await waitForUi(window, `document.querySelector('.engine-status')?.classList.contains('ready')`, 'bryła przed wycięciem Through All', modelingTimeoutMs);
  await waitForUi(window, `[...document.querySelectorAll('.ribbon-tool')].some((item) => item.querySelector('.ribbon-label')?.textContent === 'Wyciągnij' && !item.disabled)`, 'aktywne polecenie Extrude', modelingTimeoutMs);
  progress('extrude to planar face');
  await clickTool('Wyciągnij');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Wyciągnięcie')`, 'polecenie Extrude To Object');
  await setCommandField('Operacja', 'new');
  await setCommandField('Kierunek', 'to-object');
  const planarTargetReferenceId = await window.webContents.executeJavaScript(`(() => {
    const field = [...document.querySelectorAll('.command-field')].find((item) => item.firstElementChild?.textContent === 'Obiekt docelowy');
    const option = [...(field?.querySelector('select')?.options || [])].find((item) => item.textContent.includes('Z=8.000'));
    if (!option) throw new Error('Brak górnej ściany planarnej na liście To Object.');
    return option.value;
  })()`);
  await setCommandField('Obiekt docelowy', planarTargetReferenceId);
  const faceTargetRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.extent === 'to-object' && window.__madcadVerifyDocumentState.featureData[1].targetReferenceId === ${JSON.stringify(planarTargetReferenceId)} && window.__madcadVerifyEngineState?.revision > ${faceTargetRevision} && window.__madcadVerifyEngineState?.bodies?.length === 2`, 'Extrude To Object do ściany planarnej', modelingTimeoutMs);
  const faceTargetMetrics = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies.find((body) => body.id === 'body-' + window.__madcadVerifyDocumentState.featureData[1].id)?.metrics`);
  assertClose(faceTargetMetrics.volume, Math.PI * 6 * 6 * 8, 0.05, 'Extrude To Object planar face volume');
  assertClose(faceTargetMetrics.bounds[1][2], 8, 0.02, 'Extrude To Object planar face end');
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.features === 1 && window.__madcadVerifyEngineState?.bodies?.length === 1`, 'undo To Object do ściany', modelingTimeoutMs);
  await sendShortcut('y');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.extent === 'to-object' && window.__madcadVerifyEngineState?.bodies?.length === 2`, 'redo To Object do ściany', modelingTimeoutMs);
  await waitForUi(window, `(() => { const saved = JSON.parse(localStorage.getItem('madcad:modeling-document:v4') || 'null'); return saved?.features?.[1]?.extent === 'to-object' && saved.references?.some((item) => item.id === saved.features[1].targetReferenceId && item.topologyKind === 'face'); })()`, 'autozapis To Object do ściany');
  const faceTargetReopenRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyReopenAutosave?.()`);
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${faceTargetReopenRevision} && window.__madcadVerifyDocumentState?.featureData?.[1]?.extent === 'to-object' && window.__madcadVerifyEngineState?.bodies?.length === 2`, 'ponownie otwarty To Object do ściany', modelingTimeoutMs);
  await editTimelineFeature(0);
  await setCommandField('Odległość', '10');
  await confirmDialog();
  await waitForUi(window, `(() => { const feature = window.__madcadVerifyDocumentState?.featureData?.[1]; const body = window.__madcadVerifyEngineState?.bodies?.find((item) => item.id === 'body-' + feature?.id); return feature?.extent === 'to-object' && Math.abs(body?.metrics?.volume - ${Math.PI * 6 * 6 * 10}) < 0.05 && Math.abs(body?.metrics?.bounds?.[1]?.[2] - 10) < 0.02; })()`, 'parametryczne śledzenie przesuniętej ściany docelowej', modelingTimeoutMs);
  await editTimelineFeature(0);
  await setCommandField('Odległość', '8');
  await confirmDialog();
  await waitForUi(window, `(() => { const feature = window.__madcadVerifyDocumentState?.featureData?.[1]; const body = window.__madcadVerifyEngineState?.bodies?.find((item) => item.id === 'body-' + feature?.id); return Math.abs(body?.metrics?.bounds?.[1]?.[2] - 8) < 0.02; })()`, 'powrót ściany docelowej na pierwotne położenie', modelingTimeoutMs);

  progress('extrude cut through all');
  await editTimelineFeature(1);
  await setCommandField('Operacja', 'cut');
  await setCommandField('Kierunek', 'through-all');
  const throughAllRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.type === 'extrude' && window.__madcadVerifyDocumentState.featureData[1].operation === 'cut' && window.__madcadVerifyDocumentState.featureData[1].extent === 'through-all'`, 'dodany Extrude Cut Through All');
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${throughAllRevision} && document.querySelector('.engine-status')?.classList.contains('ready')`, 'przeliczony Extrude Cut Through All', modelingTimeoutMs);
  const throughAllVolume = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.bodies?.[0]?.metrics?.volume`);
  assertClose(throughAllVolume, (64 * 42 * 8) - (Math.PI * 6 * 6 * 8), 0.05, 'Extrude Cut Through All volume');

  await editTimelineFeature(1);
  await setCommandField('Operacja', 'join');
  await setCommandField('Kierunek', 'two-sides');
  await setCommandField('Odległość', '3');
  await setCommandField('Druga strona', '2');
  const twoSidesRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.operation === 'join' && window.__madcadVerifyDocumentState.featureData[1].extent === 'two-sides' && window.__madcadVerifyEngineState?.revision > ${twoSidesRevision} && document.querySelector('.engine-status')?.classList.contains('ready')`, 'Extrude Join na dwie strony', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), (64 * 42 * 8) + (Math.PI * 6 * 6 * 2), 0.05, 'Extrude Join two sides volume');

  await editTimelineFeature(1);
  await setCommandField('Operacja', 'cut');
  await setCommandField('Kierunek', 'symmetric');
  await setCommandField('Długość całkowita', '4');
  const symmetricRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.operation === 'cut' && window.__madcadVerifyDocumentState.featureData[1].extent === 'symmetric' && window.__madcadVerifyEngineState?.revision > ${symmetricRevision} && document.querySelector('.engine-status')?.classList.contains('ready')`, 'Extrude Cut symetryczny', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), (64 * 42 * 8) - (Math.PI * 6 * 6 * 2), 0.05, 'Extrude Cut symmetric volume');

  await editTimelineFeature(1);
  await setCommandField('Operacja', 'intersect');
  await setCommandField('Kierunek', 'through-all');
  const intersectRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.operation === 'intersect' && window.__madcadVerifyDocumentState.featureData[1].extent === 'through-all' && window.__madcadVerifyEngineState?.revision > ${intersectRevision} && document.querySelector('.engine-status')?.classList.contains('ready')`, 'Extrude Intersect Through All', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), Math.PI * 6 * 6 * 8, 0.05, 'Extrude Intersect Through All volume');

  await editTimelineFeature(1);
  await setCommandField('Operacja', 'new');
  await setCommandField('Kierunek', 'one-side');
  await setCommandField('Odległość', '8');
  const secondBodyRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[1]?.operation === 'new' && window.__madcadVerifyEngineState?.revision > ${secondBodyRevision} && window.__madcadVerifyEngineState?.bodies?.length === 2`, 'druga niezależna bryła do Boolean', modelingTimeoutMs);

  const booleanBodyIds = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies.map((body) => body.id)`);
  await window.webContents.executeJavaScript(`(() => {
    window.__madcadVerifyTopologySelection({ kind: 'body', bodyId: ${JSON.stringify(booleanBodyIds[0])} }, 'replace');
    window.__madcadVerifyTopologySelection({ kind: 'body', bodyId: ${JSON.stringify(booleanBodyIds[1])} }, 'add');
  })()`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.items?.length === 2`, 'dwie bryły zaznaczone do Boolean');
  await clickTool('Boolean');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Boolean')`, 'polecenie Boolean Union');
  const unionRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[2]?.type === 'boolean' && window.__madcadVerifyDocumentState.featureData[2].operation === 'union' && window.__madcadVerifyEngineState?.revision > ${unionRevision} && window.__madcadVerifyEngineState?.bodies?.length === 1`, 'Boolean Union', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), 64 * 42 * 8, 0.05, 'Boolean Union volume');

  await editTimelineFeature(2, 'Boolean');
  await setCommandField('Operacja', 'subtract');
  const subtractRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[2]?.operation === 'subtract' && window.__madcadVerifyEngineState?.revision > ${subtractRevision} && document.querySelector('.engine-status')?.classList.contains('ready')`, 'Boolean Subtract', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), (64 * 42 * 8) - (Math.PI * 6 * 6 * 8), 0.05, 'Boolean Subtract volume');

  await editTimelineFeature(2, 'Boolean');
  await setCommandField('Operacja', 'intersect');
  const booleanIntersectRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[2]?.operation === 'intersect' && window.__madcadVerifyEngineState?.revision > ${booleanIntersectRevision} && document.querySelector('.engine-status')?.classList.contains('ready')`, 'Boolean Intersect', modelingTimeoutMs);
  assertClose(await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`), Math.PI * 6 * 6 * 8, 0.05, 'Boolean Intersect volume');

  await editTimelineFeature(2, 'Boolean');
  await setCommandField('Operacja', 'subtract');
  const restoredSubtractRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.[2]?.operation === 'subtract' && window.__madcadVerifyEngineState?.revision > ${restoredSubtractRevision} && document.querySelector('.engine-status')?.classList.contains('ready')`, 'przywrócony Boolean Subtract', modelingTimeoutMs);

  progress('fillet and chamfer');
  const filletEdge = await window.webContents.executeJavaScript(`(() => { const body = window.__madcadVerifyEngineState.bodies[0]; const edge = body.topology.edges.find((item) => item.descriptor.geometry === 'LINE' && item.descriptor.length > 5); return { kind: 'edge', id: edge.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId }; })()`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify(filletEdge)}, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'edge'`, 'krawędź wskazana do Fillet');
  await clickTool('Zaokrąglij');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Zaokrąglenie')`, 'polecenie zaokrąglenia');
  await setCommandField('Promień', '0.8');
  const filletRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `document.querySelectorAll('.timeline-item').length === 4`, 'dodane zaokrąglenie');
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${filletRevision} && document.querySelector('.engine-status')?.classList.contains('ready') && !document.querySelector('.timeline-item.error')`, 'przeliczone zaokrąglenie', modelingTimeoutMs);

  const chamferEdge = await window.webContents.executeJavaScript(`(() => { const body = window.__madcadVerifyEngineState.bodies[0]; const edge = body.topology.edges.find((item) => item.descriptor.geometry === 'LINE' && item.descriptor.length > 5); return { kind: 'edge', id: edge.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId }; })()`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify(chamferEdge)}, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'edge'`, 'krawędź wskazana do Chamfer');
  await clickTool('Fazuj');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Fazowanie')`, 'polecenie fazowania');
  await setCommandField('Odległość', '0.4');
  const chamferRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `document.querySelectorAll('.timeline-item').length === 5`, 'dodane fazowanie');
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${chamferRevision} && document.querySelector('.engine-status')?.classList.contains('ready') && !document.querySelector('.timeline-item.error')`, 'przeliczone fazowanie', modelingTimeoutMs);

  progress('shell selected face');
  const shellInput = await window.webContents.executeJavaScript(`(() => {
    const body = window.__madcadVerifyEngineState.bodies[0];
    const face = body.topology.faces.filter((item) => item.descriptor.geometry === 'PLANE').sort((left, right) => right.descriptor.center[2] - left.descriptor.center[2])[0];
    return { selection: { kind: 'face', id: face.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId }, volume: body.metrics.volume };
  })()`);
  await window.webContents.executeJavaScript(`window.__madcadVerifyTopologySelection(${JSON.stringify(shellInput.selection)}, 'replace')`);
  await waitForUi(window, `window.__madcadVerifyDocumentState?.selection?.kind === 'face'`, 'ściana wskazana do Shell');
  await clickTool('Shell');
  await waitForUi(window, `document.querySelector('.command-dialog')?.textContent.includes('Shell')`, 'polecenie Shell');
  await setCommandField('Grubość', '1');
  const shellRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.revision`);
  await confirmDialog();
  await waitForUi(window, `document.querySelectorAll('.timeline-item').length === 6`, 'dodany Shell');
  await waitForUi(window, `window.__madcadVerifyEngineState?.revision > ${shellRevision} && document.querySelector('.engine-status')?.classList.contains('ready') && !document.querySelector('.timeline-item.error')`, 'przeliczony Shell', modelingTimeoutMs);
  const shellVolume = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState.bodies[0].metrics.volume`);
  if (!(shellVolume > 0 && shellVolume < shellInput.volume)) throw new Error(`Shell powinien zmniejszyć objętość: ${shellInput.volume} -> ${shellVolume}`);
  await waitForUi(window, `(() => { try { const saved = JSON.parse(window.localStorage.getItem('madcad:modeling-document:v4') || 'null'); return saved?.features?.length === 6 && saved.features[5]?.type === 'shell' && saved.features[5]?.referenceIds?.length === 1; } catch (_error) { return false; } })()`, 'Shell zapisany automatycznie', 5000);
  await sendShortcut('z');
  await waitForUi(window, `window.__madcadVerifyDocumentState?.featureData?.length === 5 && document.querySelectorAll('.timeline-item').length === 5`, 'cofnięcie Shell przed kontrolą eksportu');

  progress('parameters and undo/redo');
  await clickTool('Parametry');
  await waitForUi(window, `document.querySelector('.parameters-dialog')`, 'okno parametrów');
  progress('print workspace');
  await window.webContents.executeJavaScript(`(() => {
    const add = [...document.querySelectorAll('.parameters-dialog button')].find((item) => item.textContent.includes('Dodaj parametr'));
    const key = Object.keys(add).find((item) => item.startsWith('__reactProps'));
    add[key].onClick();
  })()`);
  await waitForUi(window, `document.querySelectorAll('.parameter-row').length === 1`, 'dodany parametr');
  await confirmParameters();
  await waitForUi(window, `!document.querySelector('.parameters-dialog')`, 'zamknięcie parametrów przed cofnięciem');

  await sendShortcut('z');
  await waitForUi(window, `!document.querySelector('.modeling-shell button[title="Ponów"]')?.disabled`, 'aktywny stan ponowienia');
  await clickTool('Parametry');
  await waitForUi(window, `document.querySelector('.parameters-dialog') && document.querySelectorAll('.parameter-row').length === 0`, 'cofnięcie parametru skrótem');
  await confirmParameters();
  await waitForUi(window, `!document.querySelector('.parameters-dialog')`, 'zamknięcie parametrów przed ponowieniem');
  await sendShortcut('y');
  await clickTool('Parametry');
  await waitForUi(window, `document.querySelectorAll('.parameter-row').length === 1`, 'ponowienie parametru skrótem');
  await confirmParameters();

  await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.workspace-tabs button')].find((item) => item.textContent === 'DRUK 3D');
    if (!button) throw new Error('Brak obszaru DRUK 3D');
    const key = Object.keys(button).find((item) => item.startsWith('__reactProps'));
    button[key].onClick();
  })()`);
  await waitForUi(window, `document.querySelector('.print-inspector')`, 'obszar przygotowania druku');

  await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.workspace-tabs button')].find((item) => item.textContent === 'BRYŁA');
    const key = Object.keys(button).find((item) => item.startsWith('__reactProps'));
    button[key].onClick();
  })()`);

  await waitForUi(
    window,
    `(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem('madcad:modeling-document:v4') || 'null');
        return saved?.schemaVersion === 4 && saved?.features?.length === 5 && saved?.sketches?.length === 4 && saved?.references?.some((item) => item.kind === 'construction-plane' && item.name === 'Płaszczyzna montażowa');
      } catch (_error) {
        return false;
      }
    })()`,
    'current autosave revision',
    5000,
  );
  const selectionFilters = await window.webContents.executeJavaScript(`(() => {
    const buttons = [...document.querySelectorAll('.selection-filter-bar button')];
    const vertex = buttons.find((button) => button.textContent === 'Wierzchołek');
    const automatic = buttons.find((button) => button.textContent === 'Auto');
    if (!vertex || !automatic || vertex.disabled) return { count: buttons.length, switched: false };
    const vertexKey = Object.keys(vertex).find((item) => item.startsWith('__reactProps'));
    vertex[vertexKey].onClick();
    const autoKey = Object.keys(automatic).find((item) => item.startsWith('__reactProps'));
    automatic[autoKey].onClick();
    return { count: buttons.length, switched: true };
  })()`);
  if (selectionFilters.count !== 6 || !selectionFilters.switched) throw new Error(`Niepełne filtry wyboru B-Rep: ${JSON.stringify(selectionFilters)}`);
  const autosaveState = await window.webContents.executeJavaScript(`(() => {
    const raw = window.localStorage.getItem('madcad:modeling-document:v4');
    if (!raw) return { available: false };
    const saved = JSON.parse(raw);
    return {
      available: true,
      schemaVersion: saved.schemaVersion,
      features: saved.features?.length || 0,
      sketches: saved.sketches?.length || 0,
      entities: saved.sketches?.reduce((total, sketch) => total + (sketch.entities?.length || 0), 0) || 0,
      constructionPlanes: saved.references?.filter((item) => item.kind === 'construction-plane').length || 0,
      constructionAxes: saved.references?.filter((item) => item.kind === 'construction-axis').length || 0,
      constructionPoints: saved.references?.filter((item) => item.kind === 'construction-point').length || 0,
    };
  })()`);
  const autosaveRoundTrip = autosaveState.available
    && autosaveState.schemaVersion === 4
    && autosaveState.features === 5
    && autosaveState.sketches === 4
    && autosaveState.entities === 13
    && autosaveState.constructionPlanes === 7
    && autosaveState.constructionAxes === 5
    && autosaveState.constructionPoints === 5;
  if (!autosaveRoundTrip) throw new Error(`Desktop autosave did not preserve the current document: ${JSON.stringify(autosaveState)}`);

  const recoveryRevision = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.revision || 0`);
  await window.webContents.executeJavaScript(`(() => {
    if (typeof window.__madcadVerifyRestartWorker !== 'function') throw new Error('Missing worker recovery test hook.');
    window.__madcadVerifyRestartWorker();
  })()`);
  try {
    await waitForUi(
      window,
      `window.__madcadVerifyEngineState?.status === 'ready' && window.__madcadVerifyEngineState?.revision > ${recoveryRevision}`,
      'worker recovery',
      modelingTimeoutMs,
    );
  } catch (error) {
    const recoveryState = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState`);
    throw new Error(`${error.message}: ${JSON.stringify(recoveryState)}`);
  }
  const workerRecovery = await window.webContents.executeJavaScript(`(() => ({
    fromRevision: ${recoveryRevision},
    toRevision: window.__madcadVerifyEngineState.revision,
    crashDiagnostic: window.__madcadVerifyEngineState.diagnostics?.some((item) => item.code === 'WORKER_CRASH'),
    bodies: window.__madcadVerifyEngineState.bodies?.length || 0,
  }))()`);
  if (!workerRecovery.crashDiagnostic || !workerRecovery.bodies) throw new Error(`Incomplete worker recovery: ${JSON.stringify(workerRecovery)}`);

  const describedControls = await window.webContents.executeJavaScript(`(() => {
    const ribbon = [...document.querySelectorAll('.ribbon-tool:not(:disabled)')];
    const navigation = [...document.querySelectorAll('.navigation-bar button')];
    return ribbon.length > 0
      && ribbon.every((button) => button.querySelector('.ribbon-label')?.textContent.trim() && button.title.trim())
      && navigation.every((button) => button.title.trim());
  })()`);
  if (!describedControls) throw new Error('Aktywne opcje nie mają kompletu podpisów i opisów.');

  progress('ui flow complete');
  return {
    profiles: await window.webContents.executeJavaScript(`document.querySelectorAll('.tree-profile').length`),
    features: await window.webContents.executeJavaScript(`document.querySelectorAll('.timeline-item').length`),
    parameterEditing: true,
    undoRedo: true,
    keyboardUndoRedo: true,
    sketchWorkflow: true,
    sketchProfileFillSelection: true,
    linePolyline: true,
    enterEscapeTermination: true,
    sketchMultiSelection: true,
    crossingInsideSelection: true,
    sketchPointSegmentDrag: true,
    sketchDeleteUndoRedo: true,
    polylineModel,
    topologyProfiles: true,
    parametricBracket: true,
    directManipulation: true,
    pointerInput: 'pen',
    filletChamfer: true,
    constructionPlane: true,
    goldenBrep,
    describedControls,
    commandDialogs: true,
    printWorkspace: true,
    tutorial,
    sketchImport,
    constraintFlow,
    dimensionFlow,
    patternFlow,
    autosaveRoundTrip,
    workerRecovery,
  };
}

app.whenReady().then(async () => {
  const performanceBudgets = isCi
    ? { desktopColdStartMs: 60000, desktopWorkflowMs: 180000, displayMeshPerBodyMs: 15000, displayEvaluationMs: 45000 }
    : { desktopColdStartMs: 30000, desktopWorkflowMs: 100000, displayMeshPerBodyMs: 5000, displayEvaluationMs: 15000 };
  const performance = { coldStartMs: 0, workflowMs: 0 };
  const window = new BrowserWindow({
    width: 1936,
    height: 1080,
    show: true,
    webPreferences: { partition: `madcad-verifier-${Date.now()}` },
  });
  window.setContentSize(1936, 1017);
  const rendererMessages = [];
  window.webContents.on('console-message', (details) => {
    const level = { debug: 0, info: 1, warning: 2, error: 3 }[details.level] ?? 1;
    rendererMessages.push({ level, message: details.message, line: details.lineNumber, sourceId: details.sourceId });
  });
  let exitCode = 0;
  try {
    process.stdout.write('[verify] loading application\n');
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1' } });
    const result = await waitForModel(window);
    performance.coldStartMs = Date.now() - verificationStartedAt;
    if (performance.coldStartMs > performanceBudgets.desktopColdStartMs) {
      throw new Error(`Desktop cold start exceeded budget: ${performance.coldStartMs} ms.`);
    }
    process.stdout.write('[verify] engine ready\n');
    const licenseReminder = await window.webContents.executeJavaScript(`(() => {
      const overlay = document.querySelector('#licenseOverlay');
      const root = document.querySelector('.app');
      const entry = document.querySelector('#licenseCategoryBtn');
      const closeButton = document.querySelector('#licenseCloseBtn');
      return {
        overlayHidden: !overlay || overlay.hidden,
        appUnlocked: !root?.classList.contains('license-locked'),
        entryVisible: Boolean(entry && !entry.hidden),
        closeVisible: Boolean(closeButton && !closeButton.hidden),
      };
    })()`);
    if (!licenseReminder.appUnlocked || !licenseReminder.entryVisible || !licenseReminder.closeVisible) {
      throw new Error('Tryb przypomnienia licencyjnego nie pozostawił interfejsu odblokowanego.');
    }
    if (!licenseReminder.overlayHidden) {
      const reminderClosed = await window.webContents.executeJavaScript(`(() => {
        const closeButton = document.querySelector('#licenseCloseBtn');
        closeButton?.click();
        return Boolean(document.querySelector('#licenseOverlay')?.hidden);
      })()`);
      if (!reminderClosed) {
        throw new Error('Nie można zamknąć przypomnienia licencyjnego.');
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const workflowStartedAt = Date.now();
    const uiFlow = await runUiFlow(window);
    performance.workflowMs = Date.now() - workflowStartedAt;
    if (performance.workflowMs > performanceBudgets.desktopWorkflowMs) {
      throw new Error(`Desktop workflow exceeded budget: ${performance.workflowMs} ms.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
    const topologyMapping = await window.webContents.executeJavaScript(`(() => {
      const engine = window.__madcadVerifyEngineState;
      const bodies = engine?.bodies || [];
      return {
        revision: engine?.revision || 0,
        cacheEntries: engine?.cache?.entries || 0,
        faces: bodies.reduce((total, body) => total + (body.topology?.faces?.length || 0), 0),
        edges: bodies.reduce((total, body) => total + (body.topology?.edges?.length || 0), 0),
        vertices: bodies.reduce((total, body) => total + (body.topology?.vertices?.length || 0), 0),
        faceGroupsMapped: bodies.every((body) => (body.faceGroups || []).every((group) => Boolean(group.topologyId))),
        edgeGroupsMapped: bodies.every((body) => (body.edgeGroups || []).every((group) => Boolean(group.topologyId))),
      };
    })()`);
    if (!topologyMapping.revision || !topologyMapping.faces || !topologyMapping.edges || !topologyMapping.vertices || !topologyMapping.faceGroupsMapped || !topologyMapping.edgeGroupsMapped) {
      throw new Error(`Niepełne mapowanie topologii workera: ${JSON.stringify(topologyMapping)}`);
    }
    const image = await window.webContents.capturePage();
    await fs.writeFile(outputPath, image.toPNG());
    window.setContentSize(1100, 760);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await fs.writeFile(narrowOutputPath, (await window.webContents.capturePage()).toPNG());
    const narrowViewport = await window.webContents.executeJavaScript(`({
      width: innerWidth,
      height: innerHeight,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      coreToolbarVisible: [...document.querySelectorAll('.ribbon-label')].some((item) => item.textContent === 'Utwórz szkic'),
      timelineVisible: Boolean(document.querySelector('.timeline')),
    })`);
    window.setContentSize(1936, 1017);
    process.stdout.write('[verify] exporting STL, STEP and 3MF\n');
    const stl = await verifyExport(window, 'STL');
    const step = await verifyExport(window, 'STEP');
    const threeMf = await verifyThreeMfExport(window);
    const threeMfImport = await verifyThreeMfImport(window);
    const accessibility = await verifyAccessibilityAndScale(window);
    const englishUi = await verifyEnglishModelingUi();
    const workerPerformance = await window.webContents.executeJavaScript(`window.__madcadVerifyEngineState?.performance || null`);
    if (!workerPerformance || workerPerformance.totalMs > performanceBudgets.displayEvaluationMs) {
      throw new Error(`Worker evaluation exceeded budget: ${JSON.stringify(workerPerformance)}.`);
    }
    const slowBody = workerPerformance.bodies?.find((body) => body.durationMs > performanceBudgets.displayMeshPerBodyMs);
    if (slowBody) throw new Error(`Body meshing exceeded budget: ${JSON.stringify(slowBody)}.`);
    performance.worker = workerPerformance;
    const report = { ...result, licenseReminder, screenshot: outputPath, narrowScreenshot: narrowOutputPath, narrowViewport, uiFlow, topologyMapping, exports: { stl, step, threeMf }, imports: { threeMf: threeMfImport }, accessibility, englishUi, performance, rendererMessages };
    await fs.writeFile(path.join(path.dirname(outputPath), 'verification-report.json'), JSON.stringify(report, null, 2));
    process.stdout.write(`${JSON.stringify(report)}\n`);
    if (!result.shell || !result.status.includes('ready') || uiFlow.features < 2 || narrowViewport.horizontalOverflow || !narrowViewport.coreToolbarVisible || !narrowViewport.timelineVisible) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    exitCode = 1;
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const notice = window.isDestroyed() ? '' : await window.webContents.executeJavaScript(`document.querySelector('.notice')?.textContent?.trim() || ''`);
    await fs.writeFile(
      path.join(path.dirname(outputPath), 'verification-report.json'),
      JSON.stringify({ ok: false, error: error.stack || error.message, notice, rendererMessages }, null, 2),
    );
  } finally {
    window.destroy();
    app.exit(exitCode);
  }
});
