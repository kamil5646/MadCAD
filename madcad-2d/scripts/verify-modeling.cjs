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

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1440, height: 920, show: true });
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
    const stl = await verifyExport(window, 'STL');
    const step = await verifyExport(window, 'STEP');
    const report = { ...result, screenshot: outputPath, exports: { stl, step } };
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
      JSON.stringify({ ok: false, error: error.stack || error.message, notice }, null, 2),
    );
  } finally {
    window.destroy();
    app.exit(exitCode);
  }
});
