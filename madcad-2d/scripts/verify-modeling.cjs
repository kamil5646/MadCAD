const fs = require('fs/promises');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const outputPath = path.join(__dirname, '..', 'artifacts', 'modeling-checkpoint.png');

async function waitForModel(window, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await window.webContents.executeJavaScript(`(() => {
      const status = document.querySelector('.engine-status');
      return {
        shell: Boolean(document.querySelector('.modeling-shell')),
        status: status?.className || '',
        text: status?.textContent?.trim() || '',
        bodies: document.querySelectorAll('.tree-section:last-child .tree-row').length,
      };
    })()`);
    if (result.status.includes('ready') || result.status.includes('error')) return result;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Przekroczono czas oczekiwania na silnik CAD.');
}

async function verifyExport(window, format, timeoutMs = 20000) {
  const exportPromise = window.webContents.executeJavaScript(`(async () => {
    if (typeof window.__madcadVerifyExport !== 'function') throw new Error('Brak testowego interfejsu eksportu.');
    const buffers = await window.__madcadVerifyExport('${format.toLowerCase()}');
    return buffers.map((buffer) => buffer.byteLength);
  })()`);
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error(`Przekroczono czas eksportu ${format}.`)), timeoutMs));
  const sizes = await Promise.race([exportPromise, timeout]);
  if (!sizes.length || sizes.some((size) => size < 100)) throw new Error(`Eksport ${format} zwrócił pusty plik.`);
  return sizes;
}

async function waitForUi(window, expression, label, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await window.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Interfejs nie osiągnął stanu: ${label}.`);
}

async function runUiFlow(window) {
  const clickTool = (label) => window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.ribbon-tool')].find((item) => item.textContent.includes(${JSON.stringify(label)}));
    if (!button) throw new Error('Brak przycisku: ${label}');
    if (button.disabled) throw new Error('Przycisk jest nieaktywny: ${label}');
    const propsKey = Object.keys(button).find((key) => key.startsWith('__reactProps'));
    const handler = propsKey && button[propsKey]?.onClick;
    if (typeof handler !== 'function') throw new Error('Brak procedury przycisku: ${label}');
    handler({ currentTarget: button, target: button });
  })()`);

  await window.webContents.executeJavaScript(`(() => {
    const row = [...document.querySelectorAll('.tree-row')].find((item) => item.textContent.includes('Szerokość'));
    const rowKey = Object.keys(row).find((key) => key.startsWith('__reactProps'));
    row[rowKey].onClick();
  })()`);
  await waitForUi(window, `document.querySelector('.property-panel')?.textContent.includes('Parametr użytkownika')`, 'panel parametru');
  await window.webContents.executeJavaScript(`(() => {
    const field = [...document.querySelectorAll('.property-field')].find((item) => item.firstElementChild?.textContent === 'Wyrażenie');
    const input = field.querySelector('input');
    const inputKey = Object.keys(input).find((key) => key.startsWith('__reactProps'));
    input[inputKey].onChange({ target: { value: '72' } });
  })()`);
  await waitForUi(window, `[...document.querySelectorAll('.tree-row')].some((item) => item.textContent.includes('Szerokość') && item.textContent.includes('72'))`, 'zmieniony parametr');
  await new Promise((resolve) => setTimeout(resolve, 250));
  await waitForUi(window, `document.querySelector('.engine-status')?.classList.contains('ready')`, 'przeliczenie parametru', 20000);

  await window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('button[title="Cofnij"]');
    const key = Object.keys(button).find((item) => item.startsWith('__reactProps'));
    button[key].onClick();
  })()`);
  await waitForUi(window, `[...document.querySelectorAll('.tree-row')].some((item) => item.textContent.includes('Szerokość') && item.textContent.includes('60'))`, 'cofnięcie parametru');
  await window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('button[title="Ponów"]');
    const key = Object.keys(button).find((item) => item.startsWith('__reactProps'));
    button[key].onClick();
  })()`);
  await waitForUi(window, `[...document.querySelectorAll('.tree-row')].some((item) => item.textContent.includes('Szerokość') && item.textContent.includes('72'))`, 'ponowienie parametru');

  await clickTool('Prostokąt');
  await new Promise((resolve) => setTimeout(resolve, 500));
  const profileState = await window.webContents.executeJavaScript(`({
    count: document.querySelectorAll('.tree-grandchild').length,
    names: [...document.querySelectorAll('.tree-grandchild')].map((item) => item.textContent.trim()),
    panel: document.querySelector('.property-panel')?.textContent?.trim() || '',
  })`);
  if (profileState.count !== 3) throw new Error(`Dodanie prostokąta nie zadziałało: ${JSON.stringify(profileState)}`);
  await waitForUi(window, `document.querySelector('.property-panel')?.textContent.includes('Profil szkicu')`, 'właściwości profilu');

  await clickTool('Wyciągnij');
  await waitForUi(window, `document.querySelectorAll('.timeline-item').length === 3`, 'dodane wyciągnięcie');
  await new Promise((resolve) => setTimeout(resolve, 250));
  await waitForUi(window, `document.querySelector('.engine-status')?.classList.contains('ready')`, 'przeliczona bryła po wyciągnięciu', 20000);

  await clickTool('Okrąg');
  await waitForUi(window, `document.querySelectorAll('.tree-grandchild').length === 4`, 'dodany okrąg');
  await clickTool('Otwór');
  await waitForUi(window, `document.querySelectorAll('.timeline-item').length === 4`, 'dodany otwór');
  await new Promise((resolve) => setTimeout(resolve, 250));
  await waitForUi(window, `document.querySelector('.engine-status')?.classList.contains('ready')`, 'przeliczona bryła po otworze', 20000);

  await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.workspace-tabs button')].find((item) => item.textContent === 'Druk 3D');
    const key = Object.keys(button).find((item) => item.startsWith('__reactProps'));
    button[key].onClick();
  })()`);
  await waitForUi(window, `document.querySelector('.print-inspector')`, 'obszar przygotowania druku');

  return {
    profiles: await window.webContents.executeJavaScript(`document.querySelectorAll('.tree-grandchild').length`),
    features: await window.webContents.executeJavaScript(`document.querySelectorAll('.timeline-item').length`),
    parameterEditing: true,
    undoRedo: true,
    printWorkspace: true,
  };
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    show: true,
    webPreferences: { partition: `madcad-verifier-${Date.now()}` },
  });
  const rendererMessages = [];
  window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    rendererMessages.push({ level, message, line, sourceId });
  });
  let exitCode = 0;
  try {
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { verify: '1' } });
    const result = await waitForModel(window);
    await window.webContents.executeJavaScript(`(() => {
      const overlay = document.querySelector('#licenseOverlay');
      if (overlay) overlay.style.visibility = 'hidden';
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 600));
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const image = await window.webContents.capturePage();
    await fs.writeFile(outputPath, image.toPNG());
    const uiFlow = await runUiFlow(window);
    const stl = await verifyExport(window, 'STL');
    const step = await verifyExport(window, 'STEP');
    const report = { ...result, screenshot: outputPath, uiFlow, exports: { stl, step }, rendererMessages };
    await fs.writeFile(path.join(path.dirname(outputPath), 'verification-report.json'), JSON.stringify(report, null, 2));
    process.stdout.write(`${JSON.stringify(report)}\n`);
    if (!result.shell || !result.status.includes('ready') || result.bodies < 1) process.exitCode = 1;
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
