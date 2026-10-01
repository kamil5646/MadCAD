const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { promisify } = require('util');

const kind = process.argv[2];
const releaseRoot = path.resolve(__dirname, '..', 'release');
const version = require('../package.json').version;
const execFileAsync = promisify(execFile);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function preparePackage() {
  if (kind === 'mac' || kind === 'mac-dmg') {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'madcad-mac-artifact-'));
    const archive = path.join(releaseRoot, `MadCAD-${version}-mac-arm64.${kind === 'mac' ? 'zip' : 'dmg'}`);
    try {
      await fs.access(archive);
      if (kind === 'mac') await execFileAsync('/usr/bin/ditto', ['-x', '-k', archive, directory], { timeout: 120000 });
      else await execFileAsync('/usr/bin/hdiutil', ['attach', '-quiet', '-readonly', '-nobrowse', '-mountpoint', directory, archive], { timeout: 120000 });
      return { executable: path.join(directory, 'MadCAD.app', 'Contents', 'MacOS', 'MadCAD'), directory, mounted: kind === 'mac-dmg', source: kind === 'mac' ? 'zip' : 'dmg' };
    } catch (error) {
      await fs.rm(directory, { recursive: true, force: true });
      throw error;
    }
  }
  if (kind === 'windows-portable') {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'madcad-win-artifact-'));
    const archive = path.join(releaseRoot, `MadCAD-${version}-win-x64.zip`);
    try {
      await fs.access(archive);
      await execFileAsync('tar.exe', ['-xf', archive, '-C', directory], { timeout: 120000 });
      return { executable: path.join(directory, 'MadCAD.exe'), directory, mounted: false, source: 'zip' };
    } catch (error) {
      await fs.rm(directory, { recursive: true, force: true });
      throw error;
    }
  }
  if (kind === 'windows') {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'madcad-nsis-install-'));
    const installer = path.join(releaseRoot, `MadCAD-${version}-win-x64.exe`);
    try {
      await fs.access(installer);
      // /D is supported by electron-builder's per-user NSIS template and
      // must be the final argument. Keep this installation off the runner's
      // normal Programs directory so it cannot reuse an existing install.
      await execFileAsync(installer, ['/S', `/D=${directory}`], { timeout: 120000 });
      const executable = path.join(directory, 'MadCAD.exe');
      await fs.access(executable);
      return { executable, directory, installed: true, source: 'nsis-installed' };
    } catch (error) {
      await removeTemporaryDirectory(directory);
      throw error;
    }
  }
  throw new Error('Podaj rodzaj pakietu mac, mac-dmg, windows albo windows-portable.');
}

async function evaluate(targetUrl, expression) {
  const socket = new WebSocket(targetUrl);
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('CDP connection timed out.')), 5000);
      socket.addEventListener('open', () => { clearTimeout(timeout); resolve(); }, { once: true });
      socket.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('CDP connection failed.')); }, { once: true });
    });
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('CDP evaluation timed out.')), 5000);
      socket.addEventListener('message', (event) => {
        const response = JSON.parse(String(event.data));
        if (response.id !== 1) return;
        clearTimeout(timeout);
        if (response.error || response.result?.exceptionDetails) reject(new Error(JSON.stringify(response.error || response.result.exceptionDetails)));
        else resolve(response.result?.result?.value);
      });
      socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
    });
  } finally {
    try { socket.close(); } catch {}
  }
}

async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  if (process.platform === 'win32') {
    // Chromium keeps DLLs locked in child processes after the main process
    // exits. Stop only this verifier's process tree before removing its ZIP.
    try { await execFileAsync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { timeout: 10000 }); } catch {}
  } else child.kill('SIGTERM');
  await Promise.race([exited, delay(5000)]);
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
}

async function removeTemporaryDirectory(directory) {
  if (!directory) return;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await fs.rm(directory, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!['EPERM', 'EBUSY', 'ENOTEMPTY'].includes(error.code)) throw error;
      await delay(500 * (attempt + 1));
    }
  }
  // An ephemeral CI runner clears its own temp directory. A delayed Windows
  // Chromium child must not turn a successful packaged startup into failure.
  process.stderr.write(`Pozostawiono tymczasowy katalog pakietu do wyczyszczenia przez system: ${directory}\n`);
}

(async () => {
  if ((kind === 'mac' || kind === 'mac-dmg') && process.arch !== 'arm64') {
    if (process.env.MADCAD_REQUIRE_PACKAGED_STARTUP === '1') {
      throw new Error('Wymagana bramka wydania: paczka macOS arm64 musi zostać uruchomiona na runnerze arm64.');
    }
    process.stdout.write(`${JSON.stringify({ skipped: true, kind, reason: 'Pakiet jest arm64, a runner nie jest arm64.' })}\n`);
    return;
  }
  const prepared = await preparePackage();
  let profile;
  let child;
  let diagnostics = '';
  try {
    await fs.access(prepared.executable);
    profile = await fs.mkdtemp(path.join(os.tmpdir(), 'madcad-packaged-startup-'));
    const env = { ...process.env, MADCAD_TEST_USER_DATA_DIR: profile };
    delete env.ELECTRON_RUN_AS_NODE;
    child = spawn(prepared.executable, ['--remote-debugging-port=0'], { env, stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr.on('data', (chunk) => { diagnostics = (diagnostics + chunk.toString()).slice(-4096); });
    const deadline = Date.now() + 30000;
    let port = null;
    while (Date.now() < deadline && !port) {
      const match = diagnostics.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/);
      if (match) port = Number(match[1]);
      else if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Pakiet zakończył pracę przed załadowaniem interfejsu: ${diagnostics}`);
      else await delay(100);
    }
    if (!port) throw new Error(`Nie uruchomiono debuggera pakietu: ${diagnostics}`);
    let state = null;
    let lastError = null;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(3000) });
        const targets = await response.json();
        const page = targets.find((target) => target.type === 'page' && /app\.asar\/dist\/index\.html/.test(target.url));
        if (page) {
          state = await evaluate(page.webSocketDebuggerUrl, `({
            url: location.href,
            title: document.title,
            desktopApi: Boolean(window.desktopApp?.isDesktop),
            shell: Boolean(document.querySelector('.modeling-shell')),
            license: Boolean(document.querySelector('.license-info-dialog')),
            verificationHook: typeof window.__madcadVerifyDocumentState
          })`);
          if (state?.shell && state?.license && state?.desktopApi) break;
        }
      } catch (error) {
        lastError = error;
      }
      await delay(150);
    }
    if (!state?.shell || !state?.license || !state?.desktopApi || state.verificationHook !== 'undefined' || state.url.includes('verify=1')) {
      throw new Error(`Spakowana aplikacja nie załadowała poprawnego ekranu startowego: ${JSON.stringify(state)}. ${lastError?.message || ''} ${diagnostics}`);
    }
    const profileEntries = await fs.readdir(profile);
    if (!profileEntries.length) throw new Error('Spakowana aplikacja nie użyła izolowanego profilu.');
    process.stdout.write(`${JSON.stringify({ ok: true, kind, executable: prepared.executable, packageSource: prepared.source, profileIsolated: true, ...state })}\n`);
  } finally {
    await stop(child);
    await removeTemporaryDirectory(profile);
    if (prepared.mounted) await execFileAsync('/usr/bin/hdiutil', ['detach', '-quiet', prepared.directory], { timeout: 30000 });
    if (prepared.installed) {
      const uninstaller = path.join(prepared.directory, 'Uninstall MadCAD.exe');
      await fs.access(uninstaller);
      await execFileAsync(uninstaller, ['/S'], { timeout: 120000 });
    }
    await removeTemporaryDirectory(prepared.directory);
  }
})().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
