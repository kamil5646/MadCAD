// Optional local acceptance check for a built macOS app using an already
// licensed profile. Never prints, modifies, or uploads the source profile.
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const appPath = path.resolve(process.env.MADCAD_PACKAGED_APP_PATH || path.join(__dirname, '..', 'release', 'mac-arm64', 'MadCAD.app', 'Contents', 'MacOS', 'MadCAD'));
const profileSource = process.env.MADCAD_LICENSED_PROFILE_SOURCE;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function evaluate(targetUrl, expression) {
  const socket = new WebSocket(targetUrl);
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Nie połączono z debuggerem pakietu.')), 5000);
      socket.addEventListener('open', () => { clearTimeout(timeout); resolve(); }, { once: true });
      socket.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Połączenie z debuggerem pakietu nie powiodło się.')); }, { once: true });
    });
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Pakiet nie odpowiedział na kontrolę interfejsu.')), 5000);
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

async function waitFor(page, expression, label, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(page, expression)) return;
    await delay(150);
  }
  throw new Error(`Nie potwierdzono w pakiecie: ${label}.`);
}

async function clickTool(page, label) {
  const clicked = await evaluate(page, `(() => {
    const button = [...document.querySelectorAll('.ribbon-tool')].find((item) => item.querySelector('.ribbon-label')?.textContent === ${JSON.stringify(label)});
    if (!button || button.disabled) return false;
    button.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Narzędzie nie jest dostępne w pakiecie: ${label}.`);
}

async function setCommandField(page, label, value) {
  const changed = await evaluate(page, `(() => {
    const field = [...document.querySelectorAll('.command-dialog .command-field')].find((item) => item.firstElementChild?.textContent.trim() === ${JSON.stringify(label)});
    const input = field?.querySelector('input, select');
    const key = input && Object.keys(input).find((item) => item.startsWith('__reactProps'));
    const handler = key && input[key]?.onChange;
    if (typeof handler !== 'function') return false;
    handler({ target: { value: ${JSON.stringify(String(value))} } });
    return true;
  })()`);
  if (!changed) throw new Error(`Brak aktywnego pola polecenia w pakiecie: ${label}.`);
}

async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(3000)]);
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
}

(async () => {
  if (process.platform !== 'darwin') throw new Error('Ta lokalna kontrola wymaga macOS.');
  if (!profileSource) throw new Error('Ustaw MADCAD_LICENSED_PROFILE_SOURCE na istniejący profil zalogowanego konta.');
  await fs.access(appPath);
  await fs.access(profileSource);
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'madcad-licensed-package-'));
  let child;
  let diagnostics = '';
  try {
    await fs.chmod(profile, 0o700);
    await fs.cp(profileSource, profile, { recursive: true, force: false });
    const env = { ...process.env, MADCAD_TEST_USER_DATA_DIR: profile };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.MADCAD_LICENSED_PROFILE_SOURCE;
    child = spawn(appPath, ['--remote-debugging-port=0', '--madcad-lang=pl'], { env, stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr.on('data', (chunk) => { diagnostics = (diagnostics + chunk.toString()).slice(-4096); });
    const deadline = Date.now() + 30000;
    let page = null;
    while (Date.now() < deadline && !page) {
      const port = Number(diagnostics.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/)?.[1]);
      if (port) {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(3000) });
        const targets = await response.json();
        page = targets.find((item) => item.type === 'page' && /app\.asar\/dist\/index\.html/.test(item.url))?.webSocketDebuggerUrl || null;
      } else if (child.exitCode !== null || child.signalCode !== null) throw new Error('Spakowana aplikacja zakończyła pracę przed załadowaniem.');
      if (!page) await delay(150);
    }
    if (!page) throw new Error('Nie załadowano interfejsu spakowanej aplikacji.');
    // A signed-in profile goes straight to the program: the licence window opens
    // only when the account check reports missing access.
    await waitFor(page, `Boolean(document.querySelector('.modeling-shell'))`, 'interfejs programu', 15000);
    await delay(2500);
    const accountState = await evaluate(page, `({ dialog: Boolean(document.querySelector('.license-info-dialog')), verificationHook: typeof window.__madcadVerifyDocumentState })`);
    if (accountState.dialog || accountState.verificationHook !== 'undefined') throw new Error(`Zalogowany profil nie wszedł od razu do programu albo pakiet zawiera hook testowy: ${JSON.stringify(accountState)}.`);
    await evaluate(page, `document.querySelector('button[aria-label^="Prymityw"]')?.click()`);
    await waitFor(page, `Boolean(document.querySelector('.command-dialog .confirm'))`, 'polecenie bryły w pakiecie');
    await evaluate(page, `document.querySelector('.command-dialog .confirm').click()`);
    await waitFor(page, `document.querySelectorAll('.timeline-item').length === 1 && !document.querySelector('.command-dialog')`, 'bryła i historia w pakiecie');
    await evaluate(page, `document.querySelector('#undoProjectBtn')?.click()`);
    await waitFor(page, `document.querySelectorAll('.timeline-item').length === 0`, 'Cofnij w pakiecie');
    await evaluate(page, `document.querySelector('#redoProjectBtn')?.click()`);
    await waitFor(page, `document.querySelectorAll('.timeline-item').length === 1`, 'Ponów w pakiecie');
    await evaluate(page, `document.querySelector('#undoProjectBtn')?.click()`);
    await waitFor(page, `document.querySelectorAll('.timeline-item').length === 0`, 'pusty model po cofnięciu bryły testowej');
    await clickTool(page, 'Utwórz szkic');
    await waitFor(page, `Boolean(document.querySelector('.plane-options'))`, 'wybór płaszczyzny szkicu');
    await evaluate(page, `[...document.querySelectorAll('.plane-options button')].find((button) => button.textContent.includes('XY'))?.click()`);
    await waitFor(page, `document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'szkic XY w pakiecie');
    await clickTool(page, 'Okrąg');
    await waitFor(page, `document.querySelector('.command-dialog')?.textContent.includes('Okrąg')`, 'okrąg w szkicu pakietu');
    await setCommandField(page, 'Średnica', '12');
    await setCommandField(page, 'Środek X', '0');
    await setCommandField(page, 'Środek Y', '0');
    await evaluate(page, `document.querySelector('.command-dialog .confirm')?.click()`);
    await waitFor(page, `!document.querySelector('.command-dialog')`, 'zatwierdzony profil okręgu');
    await clickTool(page, 'Zakończ szkic');
    await waitFor(page, `!document.querySelector('.model-viewport')?.classList.contains('sketch-view')`, 'ukończony szkic w pakiecie');
    await clickTool(page, 'Wyciągnij');
    await waitFor(page, `document.querySelector('.command-dialog')?.textContent.includes('Wyciągnięcie')`, 'wyciągnięcie w pakiecie');
    await setCommandField(page, 'Odległość', '10');
    await evaluate(page, `document.querySelector('.command-dialog .confirm')?.click()`);
    await waitFor(page, `document.querySelectorAll('.timeline-item').length === 1 && !document.querySelector('.command-dialog')`, 'bryła ze szkicu w pakiecie');
    await evaluate(page, `document.querySelector('#undoProjectBtn')?.click()`);
    await waitFor(page, `document.querySelectorAll('.timeline-item').length === 0`, 'Cofnij wyciągnięcie w pakiecie');
    await evaluate(page, `document.querySelector('#redoProjectBtn')?.click()`);
    await waitFor(page, `document.querySelectorAll('.timeline-item').length === 1`, 'Ponów wyciągnięcie w pakiecie');
    process.stdout.write(`${JSON.stringify({ ok: true, packaged: true, licensedEntry: true, primitive: true, sketchExtrude: true, undoRedo: true, verificationHook: false, profileIsolated: true })}\n`);
  } finally {
    await stop(child);
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
