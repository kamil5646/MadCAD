const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const isolatedUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'madcad-electron-security-'));
process.env.MADCAD_TEST_USER_DATA_DIR = isolatedUserData;
const linkedProjectDirectory = path.join(isolatedUserData, 'linked-project-fixture');
const linkedBasePath = path.join(linkedProjectDirectory, 'main.madcad');
const linkedSourcePath = path.join(linkedProjectDirectory, 'source.madcad');
fs.mkdirSync(linkedProjectDirectory, { recursive: true });
fs.writeFileSync(linkedBasePath, '{}', 'utf8');
fs.writeFileSync(linkedSourcePath, '{"schemaVersion":15,"name":"Security linked source"}', 'utf8');

let started = false;
let finished = false;
let phase = 'bootstrap';
let observedUrl = '';

function finish(code, report) {
  if (finished) return;
  finished = true;
  process.exitCode = code;
  if (report) process.stdout.write(`${JSON.stringify(report)}\n`);
  // Chromium keeps profile files open until its child processes fully exit on
  // Windows. The hosted runner cleans its temporary directory after the job;
  // trying to remove it synchronously here can turn a successful verification
  // into an EPERM/cancelled process. Other platforms can clean it immediately.
  if (process.platform !== 'win32') {
    try {
      fs.rmSync(isolatedUserData, { recursive: true, force: true });
    } catch (error) {
      process.stderr.write(`Could not remove isolated user data: ${error.message}\n`);
    }
  }
  app.exit(code);
}

async function evaluateWithDebugger(webContents, expression, awaitPromise = false) {
  if (!webContents.debugger.isAttached()) webContents.debugger.attach('1.3');
  const response = await webContents.debugger.sendCommand('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || 'Runtime evaluation failed.');
  }
  return response.result.value;
}

app.on('browser-window-created', (_event, mainWindow) => {
  if (started) return;
  started = true;
  phase = 'main-window-created';
  mainWindow.webContents.once('did-fail-load', (_loadEvent, code, description) => {
    process.stderr.write(`Main window failed to load (${code}): ${description}\n`);
  });
  mainWindow.webContents.on('preload-error', (_preloadEvent, preloadPath, error) => {
    process.stderr.write(`Preload failed (${preloadPath}): ${error && error.message ? error.message : error}\n`);
  });
  mainWindow.webContents.on('render-process-gone', (_goneEvent, details) => {
    process.stderr.write(`Renderer exited: ${JSON.stringify(details)}\n`);
  });
  mainWindow.webContents.on('console-message', (details) => {
    if (details.level === 'warning' || details.level === 'error') {
      process.stderr.write(`Renderer console: ${details.message}\n`);
    }
  });
  let verificationStarted = false;
  const verifyMainWindow = async () => {
    observedUrl = mainWindow.webContents.getURL();
    if (verificationStarted || !observedUrl.includes('/dist/index.html')) return;
    verificationStarted = true;
    phase = 'main-window-loaded';
    try {
      const preferences = mainWindow.webContents.getLastWebPreferences();
      assert.equal(preferences.contextIsolation, true);
      assert.equal(preferences.sandbox, true);
      assert.equal(preferences.nodeIntegration, false);

      await new Promise((resolve) => setTimeout(resolve, 1_000));
      const trustedApi = await evaluateWithDebugger(mainWindow.webContents, `({
        api: Boolean(window.desktopApp && window.desktopApp.isDesktop),
        legacyLicenseApi: Boolean(window.desktopApp && ('deviceId' in window.desktopApp || 'appendLicenseAudit' in window.desktopApp || 'clearLicenseStorage' in window.desktopApp))
      })`);
      assert.equal(trustedApi.api, true);
      assert.equal(trustedApi.legacyLicenseApi, false);
      phase = 'trusted-ipc';
      const trustedUpdate = await Promise.race([
        evaluateWithDebugger(mainWindow.webContents, 'window.desktopApp.checkForUpdates()', true),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Trusted IPC timed out.')), 5_000)),
      ]);
      assert.equal(trustedUpdate.ok, true);
      assert.equal(trustedUpdate.supported, false);
      const trustedSnapshots = await evaluateWithDebugger(mainWindow.webContents, `(async () => {
        const text = window.__madcadGetSessionExport();
        const created = await window.desktopApp.projectSnapshotCreate({ name: 'Security smoke', description: 'Trusted IPC', text });
        const listed = await window.desktopApp.projectSnapshotList();
        const opened = await window.desktopApp.projectSnapshotRead({ id: created.snapshot.id });
        const removed = await window.desktopApp.projectSnapshotDelete({ id: created.snapshot.id });
        return { created: created.ok, listed: listed.snapshots.length, opened: opened.text === text, removed: removed.ok };
      })()`, true);
      assert.deepEqual(trustedSnapshots, { created: true, listed: 1, opened: true, removed: true });
      const trustedLinkedProject = await evaluateWithDebugger(mainWindow.webContents, `window.desktopApp.readLinkedProject(${JSON.stringify({ baseProjectPath: linkedBasePath, relativePath: 'source.madcad' })})`, true);
      assert.equal(trustedLinkedProject.ok, true);
      assert.equal(trustedLinkedProject.fileName, 'source.madcad');
      assert.match(trustedLinkedProject.hash, /^[a-f0-9]{64}$/);

      const untrustedWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          preload: path.join(__dirname, '..', 'electron', 'preload.js'),
          contextIsolation: true,
          sandbox: true,
          nodeIntegration: false,
          additionalArguments: ['--madcad-lang=pl'],
        },
      });
      await untrustedWindow.loadURL('data:text/html,<html><body>untrusted</body></html>');
      const rejection = await untrustedWindow.webContents.executeJavaScript(`window.desktopApp.checkForUpdates()
        .then(() => ({ rejected: false }))
        .catch((error) => ({ rejected: true, message: String(error && error.message || error) }))`);
      assert.equal(rejection.rejected, true);
      assert.match(rejection.message, /untrusted|niezaufanego/i);
      untrustedWindow.destroy();

      finish(0, {
        contextIsolation: preferences.contextIsolation,
        sandbox: preferences.sandbox,
        nodeIntegration: preferences.nodeIntegration,
        preloadApi: trustedApi.api,
        trustedIpc: trustedUpdate.ok,
        snapshotIpc: trustedSnapshots,
        linkedProjectIpc: trustedLinkedProject.ok,
        untrustedIpcRejected: rejection.rejected,
      });
    } catch (error) {
      process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
      finish(1);
    }
  };
  mainWindow.webContents.on('did-finish-load', verifyMainWindow);
  mainWindow.webContents.on('did-stop-loading', verifyMainWindow);
  const readinessPoll = setInterval(() => {
    if (finished || mainWindow.isDestroyed()) {
      clearInterval(readinessPoll);
      return;
    }
    observedUrl = mainWindow.webContents.getURL();
    void verifyMainWindow();
  }, 250);
  readinessPoll.unref();
});

setTimeout(() => {
  process.stderr.write(`Electron security smoke test timed out during: ${phase}; URL: ${observedUrl || '(empty)'}.\n`);
  finish(1);
}, 30_000).unref();

app.whenReady().then(() => {
  if (phase === 'bootstrap') phase = 'electron-ready';
});

require('../electron/main.js');
