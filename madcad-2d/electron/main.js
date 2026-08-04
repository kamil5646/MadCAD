const path = require('path');
const fsRaw = require('fs');
const fs = require('fs/promises');
const https = require('https');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const { app, BrowserWindow, Menu, shell, nativeImage, dialog, ipcMain } = require('electron');

const execFileAsync = promisify(execFile);

const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';
const APP_DISPLAY_NAME = 'MadCAD';
const appIconPng = path.join(__dirname, '..', 'assets', 'icons', 'madcad-512.png');
const ODA_DOWNLOAD_URL = 'https://www.opendesign.com/guestfiles/oda_file_converter';
const ODA_DOWNLOAD_PAGE_HOST = 'www.opendesign.com';
const MADCAD_RELEASE_API_URL = 'https://api.github.com/repos/kamil5646/MadCAD2D/releases/latest';
const MADCAD_RELEASE_LATEST_PAGE_URL = 'https://github.com/kamil5646/MadCAD2D/releases/latest';
const MADCAD_UPDATE_USER_AGENT = 'MadCAD2D-Updater/1.0';
let forceCloseForUpdate = false;

if (app && typeof app.setName === 'function') {
  app.setName(APP_DISPLAY_NAME);
}

function resolveAppLanguage() {
  const argLanguage = normalizeAppLanguageArg(process.argv);
  if (argLanguage) {
    return argLanguage;
  }
  if (process.env.APP_LANG === 'en') {
    return 'en';
  }
  if (process.env.APP_LANG === 'pl') {
    return 'pl';
  }
  const savedLanguage = getSavedAppLanguageSync();
  if (savedLanguage) {
    return savedLanguage;
  }
  const appName = app ? String(app.getName() || '').toLowerCase() : '';
  if (appName.includes(' en')) {
    return 'en';
  }
  if (appName.includes(' pl')) {
    return 'pl';
  }
  return 'pl';
}

function normalizeLanguage(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'en' || normalized === 'pl' ? normalized : null;
}

function normalizeAppLanguageArg(argv) {
  const source = Array.isArray(argv) ? argv : [];
  for (const arg of source) {
    if (typeof arg !== 'string' || !arg.startsWith('--madcad-lang=')) {
      continue;
    }
    const maybeLanguage = normalizeLanguage(arg.split('=')[1]);
    if (maybeLanguage) {
      return maybeLanguage;
    }
  }
  return null;
}

function getSavedAppLanguageSync() {
  try {
    const configPath = getCadConfigPath();
    if (!fsRaw.existsSync(configPath)) {
      return null;
    }
    const raw = fsRaw.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeLanguage(parsed && parsed.appLanguage);
  } catch (_error) {
    return null;
  }
}

let appLanguage = resolveAppLanguage();
const t = (pl, en) => (appLanguage === 'en' ? en : pl);
const transientWindows = new Set();

function getCadConfigPath() {
  return path.join(app.getPath('userData'), 'private', 'cad-config.json');
}

function getAutoSavePath() {
  return path.join(app.getPath('userData'), 'autosave', 'latest-session.json');
}

async function clearAutoSaveSnapshot() {
  const autoSavePath = getAutoSavePath();
  await fs.rm(autoSavePath, { force: true }).catch(() => {});
}

async function readCadConfig() {
  try {
    const raw = await fs.readFile(getCadConfigPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_error) {
    return {};
  }
}

async function writeCadConfig(config) {
  const safeConfig = config && typeof config === 'object' ? config : {};
  const configPath = getCadConfigPath();
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(safeConfig, null, 2), 'utf8');
}

async function getSavedOdaConverterPath() {
  const config = await readCadConfig();
  const savedPath = typeof config.odaConverterPath === 'string' ? config.odaConverterPath.trim() : '';
  if (!savedPath) {
    return null;
  }
  const normalizedPath = await normalizeOdaConverterPath(savedPath);
  return normalizedPath && (await pathExists(normalizedPath)) ? normalizedPath : null;
}

async function setSavedOdaConverterPath(filePath) {
  const config = await readCadConfig();
  const normalizedPath = await normalizeOdaConverterPath(filePath);
  config.odaConverterPath = String(normalizedPath || filePath || '').trim();
  await writeCadConfig(config);
}

async function normalizeOdaConverterPath(candidatePath) {
  const rawPath = String(candidatePath || '').trim();
  if (!rawPath) {
    return null;
  }

  if (process.platform === 'win32') {
    if (!(await pathExists(rawPath))) {
      return rawPath;
    }
    try {
      const stats = await fs.stat(rawPath);
      if (stats.isDirectory()) {
        const nestedExecutable = await findWindowsOdaExecutable(rawPath);
        return nestedExecutable || rawPath;
      }
    } catch (_error) {
      return rawPath;
    }
    return rawPath;
  }

  if (process.platform !== 'darwin') {
    return rawPath;
  }

  if (!(await pathExists(rawPath))) {
    return rawPath;
  }

  if (rawPath.toLowerCase().endsWith('.app')) {
    const nestedExecutable = path.join(rawPath, 'Contents', 'MacOS', 'ODAFileConverter');
    return (await pathExists(nestedExecutable)) ? nestedExecutable : rawPath;
  }

  try {
    const stats = await fs.stat(rawPath);
    if (stats.isDirectory()) {
      const appBundle = await findAppBundleInDir(rawPath);
      if (appBundle) {
        return path.join(appBundle, 'Contents', 'MacOS', 'ODAFileConverter');
      }
    }
  } catch (_error) {
    return rawPath;
  }

  return rawPath;
}

async function findWindowsOdaExecutable(rootPath, maxDepth = 4) {
  const normalizedRoot = String(rootPath || '').trim();
  if (!normalizedRoot || !(await pathExists(normalizedRoot))) {
    return null;
  }

  const queue = [{ dir: normalizedRoot, depth: 0 }];
  const visited = new Set();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.dir)) {
      continue;
    }
    visited.add(current.dir);

    let entries = [];
    try {
      entries = await fs.readdir(current.dir, { withFileTypes: true });
    } catch (_error) {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current.dir, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === 'odafileconverter.exe') {
        return fullPath;
      }
    }

    if (current.depth >= maxDepth) {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const lower = entry.name.toLowerCase();
      if (!/oda|open design|converter|fileconverter/.test(lower) && current.depth > 0) {
        continue;
      }
      queue.push({ dir: path.join(current.dir, entry.name), depth: current.depth + 1 });
    }
  }

  return null;
}

function httpsGetBuffer(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,pl;q=0.8'
        }
      },
      (response) => {
      const status = Number(response.statusCode) || 0;
      const location = response.headers.location;
      if ([301, 302, 303, 307, 308].includes(status) && location) {
        response.resume();
        const nextUrl = location.startsWith('http') ? location : new URL(location, url).toString();
        resolve(httpsGetBuffer(nextUrl));
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`HTTP ${status}`));
        return;
      }
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      }
    );
    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy(new Error('Timeout pobierania.'));
    });
  });
}

function normalizeVersionText(value) {
  const cleaned = String(value || '')
    .trim()
    .replace(/^v/i, '');
  const parts = cleaned.split('.');
  while (parts.length > 2 && parts[parts.length - 1] === '0') {
    parts.pop();
  }
  return parts.join('.');
}

function parseVersionTuple(versionText) {
  const parts = normalizeVersionText(versionText)
    .split('.')
    .map((part) => parseInt(part, 10));
  while (parts.length < 3) {
    parts.push(0);
  }
  return parts.slice(0, 3).map((part) => (Number.isFinite(part) ? part : 0));
}

function isVersionGreater(candidate, current) {
  const a = parseVersionTuple(candidate);
  const b = parseVersionTuple(current);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) {
      return true;
    }
    if (a[i] < b[i]) {
      return false;
    }
  }
  return false;
}

function isUpdateVersionDifferent(candidate, current) {
  return normalizeVersionText(candidate) !== normalizeVersionText(current);
}

function selectReleaseAssetForPlatform(assets) {
  const list = Array.isArray(assets) ? assets : [];
  const normalized = list
    .map((asset) => {
      const name = String(asset && asset.name ? asset.name : '');
      return {
        raw: asset,
        name,
        lower: name.toLowerCase(),
        url: String(asset && asset.browser_download_url ? asset.browser_download_url : '')
      };
    })
    .filter((item) => item.name && item.url);

  if (isMac && process.arch === 'arm64') {
    return (
      normalized.find(
        (item) => item.lower.includes('mac') && item.lower.includes('arm64') && item.lower.endsWith('.zip')
      ) || null
    );
  }
  if (isMac) {
    return (
      normalized.find((item) => item.lower.includes('mac') && item.lower.endsWith('.zip')) || null
    );
  }
  if (isWindows) {
    return (
      normalized.find(
        (item) => item.lower.includes('win') && item.lower.includes('x64') && item.lower.endsWith('.exe')
      ) || null
    );
  }
  return null;
}

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          'User-Agent': MADCAD_UPDATE_USER_AGENT,
          Accept: 'application/vnd.github+json'
        }
      },
      (response) => {
        const status = Number(response.statusCode) || 0;
        const location = response.headers.location;
        if ([301, 302, 303, 307, 308].includes(status) && location) {
          response.resume();
          const nextUrl = location.startsWith('http') ? location : new URL(location, url).toString();
          resolve(httpsGetJson(nextUrl));
          return;
        }
        if (status < 200 || status >= 300) {
          response.resume();
          reject(new Error(`HTTP ${status}`));
          return;
        }
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          try {
            const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            resolve(payload);
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy(new Error('Timeout pobierania JSON.'));
    });
  });
}

function sanitizeFileName(name, fallback) {
  const safeFallback = fallback || 'madcad-update.bin';
  const value = String(name || '').trim();
  if (!value) {
    return safeFallback;
  }
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
}

function downloadFileWithRedirects(url, destinationPath, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 8) {
      reject(new Error('Zbyt wiele przekierowań podczas pobierania aktualizacji.'));
      return;
    }
    const request = https.get(
      url,
      {
        headers: {
          'User-Agent': MADCAD_UPDATE_USER_AGENT,
          Accept: '*/*'
        }
      },
      (response) => {
        const status = Number(response.statusCode) || 0;
        const location = response.headers.location;
        if ([301, 302, 303, 307, 308].includes(status) && location) {
          response.resume();
          const nextUrl = location.startsWith('http') ? location : new URL(location, url).toString();
          resolve(downloadFileWithRedirects(nextUrl, destinationPath, redirectCount + 1));
          return;
        }
        if (status < 200 || status >= 300) {
          response.resume();
          reject(new Error(`HTTP ${status}`));
          return;
        }

        const stream = fsRaw.createWriteStream(destinationPath);
        response.pipe(stream);
        stream.on('finish', () => {
          stream.close(() => resolve(destinationPath));
        });
        stream.on('error', async (error) => {
          response.destroy();
          await fs.rm(destinationPath, { force: true }).catch(() => {});
          reject(error);
        });
      }
    );
    request.on('error', async (error) => {
      await fs.rm(destinationPath, { force: true }).catch(() => {});
      reject(error);
    });
    request.setTimeout(180000, () => {
      request.destroy(new Error('Timeout pobierania pliku aktualizacji.'));
    });
  });
}

async function scheduleMacZipInstall(zipPath) {
  const appPath = path.resolve(process.execPath, '..', '..', '..');
  const executablePath = process.execPath;
  const scriptPath = path.join(app.getPath('temp'), `madcad-update-${Date.now()}.sh`);
  const logPath = path.join(app.getPath('temp'), `madcad-update-${Date.now()}.log`);
  const scriptSource = `#!/bin/bash
set -u
ZIP_PATH="$1"
TARGET_APP="$2"
LOG_PATH="$3"
APP_EXECUTABLE="$4"

exec >>"$LOG_PATH" 2>&1

echo "== MadCAD updater start: $(date) =="
echo "ZIP_PATH=$ZIP_PATH"
echo "TARGET_APP=$TARGET_APP"
echo "APP_EXECUTABLE=$APP_EXECUTABLE"

sleep 1
TMP_DIR="$(mktemp -d /tmp/madcad-update-XXXXXX)"
echo "TMP_DIR=$TMP_DIR"

if ! /usr/bin/ditto -x -k "$ZIP_PATH" "$TMP_DIR"; then
  echo "ERROR: unzip failed"
  exit 1
fi

NEW_APP="$(/usr/bin/find "$TMP_DIR" -name "*.app" -type d -print -quit)"
echo "NEW_APP=$NEW_APP"
if [ -z "$NEW_APP" ]; then
  echo "ERROR: extracted app not found"
  exit 1
fi

for attempt in $(seq 1 60); do
  if ! /usr/bin/pgrep -f "$APP_EXECUTABLE" >/dev/null 2>&1; then
    echo "App process closed after attempt $attempt"
    break
  fi
  sleep 0.5
done

for attempt in $(seq 1 20); do
  echo "Remove target attempt $attempt"
  /bin/rm -rf "$TARGET_APP" >/dev/null 2>&1 || true
  if [ ! -e "$TARGET_APP" ]; then
    break
  fi
  sleep 0.5
done

if [ -e "$TARGET_APP" ]; then
  echo "ERROR: target app still exists after retries"
  exit 1
fi

if ! /usr/bin/ditto "$NEW_APP" "$TARGET_APP"; then
  echo "ERROR: copy app failed"
  exit 1
fi

/usr/bin/xattr -dr com.apple.quarantine "$TARGET_APP" >/dev/null 2>&1 || true
echo "Opening installed app"
/usr/bin/open -n "$TARGET_APP"
echo "== MadCAD updater done: $(date) =="
`;
  await fs.writeFile(scriptPath, scriptSource, { mode: 0o755 });
  const child = spawn('/bin/bash', [scriptPath, zipPath, appPath, logPath, executablePath], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  return { logPath, scriptPath };
}

function launchWindowsInstaller(installerPath) {
  const child = spawn(installerPath, [], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
}

async function fetchLatestMadcadRelease() {
  try {
    const release = await httpsGetJson(MADCAD_RELEASE_API_URL);
    const latestVersion = normalizeVersionText(String((release && (release.tag_name || release.name)) || ''));
    if (!latestVersion) {
      throw new Error(
        t(
          'Nie udało się odczytać wersji aktualizacji z GitHub Releases.',
          'Cannot read update version from GitHub Releases.'
        )
      );
    }
    const asset = selectReleaseAssetForPlatform(release && release.assets);
    return {
      latestVersion,
      asset,
      releaseUrl: String((release && release.html_url) || '')
    };
  } catch (apiError) {
    // Fallback: jeżeli API GitHub jest blokowane (DNS/proxy), próbujemy odczytu ze strony release.
    try {
      const html = (await httpsGetBuffer(MADCAD_RELEASE_LATEST_PAGE_URL)).toString('utf8');
      const tagMatch = html.match(/\/releases\/tag\/v?(\d+\.\d+\.\d+)/i);
      const latestVersion = normalizeVersionText((tagMatch && tagMatch[1]) || '');
      if (!latestVersion) {
        throw new Error('Missing latest version in release page.');
      }

      const assetMatches = Array.from(
        html.matchAll(/href="([^"]*\/releases\/download\/[^"]+)"/gi)
      ).map((match) => String(match && match[1] ? match[1] : '').replace(/&amp;/g, '&'));

      const uniqueAssets = Array.from(new Set(assetMatches));
      const assets = uniqueAssets
        .map((href) => {
          const fullUrl = href.startsWith('http') ? href : `https://github.com${href}`;
          const urlWithoutQuery = fullUrl.split('?')[0];
          const encodedName = path.basename(urlWithoutQuery || '');
          let name = encodedName;
          try {
            name = decodeURIComponent(encodedName);
          } catch (_error) {}
          return {
            name,
            browser_download_url: fullUrl
          };
        })
        .filter((asset) => asset.name && asset.browser_download_url);

      const asset = selectReleaseAssetForPlatform(assets);
      return {
        latestVersion,
        asset,
        releaseUrl: `https://github.com/kamil5646/MadCAD2D/releases/tag/v${latestVersion}`
      };
    } catch (_fallbackError) {
      throw apiError;
    }
  }
}

function mapUpdaterError(error, fallbackPl, fallbackEn) {
  const rawMessage = String((error && error.message) || '');
  const rawCode = String((error && error.code) || '').toUpperCase();
  const merged = `${rawMessage} ${rawCode}`.toUpperCase();

  const networkCodes = [
    'ENOTFOUND',
    'EAI_AGAIN',
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'ENETUNREACH',
    'EHOSTUNREACH'
  ];
  const isNetworkError = networkCodes.some((code) => merged.includes(code));
  if (isNetworkError) {
    return {
      code: 'NETWORK',
      message: t(
        'Brak połączenia z serwerem aktualizacji (GitHub). Sprawdź internet lub DNS i spróbuj ponownie.',
        'Cannot connect to update server (GitHub). Check internet or DNS and try again.'
      ),
      rawMessage
    };
  }

  if (merged.includes('HTTP 403')) {
    return {
      code: 'RATE_LIMIT',
      message: t(
        'Limit zapytań do GitHub został osiągnięty. Spróbuj ponownie za kilka minut.',
        'GitHub API rate limit reached. Try again in a few minutes.'
      ),
      rawMessage
    };
  }

  return {
    code: rawCode || 'UNKNOWN',
    message: t(fallbackPl, fallbackEn),
    rawMessage
  };
}

async function resolveOdaDmgUrls() {
  const htmlBuffer = await httpsGetBuffer(ODA_DOWNLOAD_URL);
  const html = htmlBuffer.toString('utf8');

  // ODA now uses /guestfiles/get?filename=...dmg redirect links
  // Collect both old-style direct .dmg URLs and new-style /guestfiles/get?filename= links
  const rawMatches = [
    ...html.matchAll(/https?:\/\/[^"'\s>]+\.dmg/gi),
    ...html.matchAll(/href=["']([^"']*\.dmg)["']/gi),
    ...html.matchAll(/href=["']([^"']*guestfiles[^"']*filename=[^"']*\.dmg[^"']*)["']/gi)
  ];

  const candidates = rawMatches
    .map((match) => {
      const raw = match[1] || match[0] || '';
      return raw.startsWith('http')
        ? raw
        : `https://${ODA_DOWNLOAD_PAGE_HOST}${raw.startsWith('/') ? '' : '/'}${raw}`;
    })
    .filter((candidate) => /oda|converter|guestfiles/i.test(candidate));

  if (candidates.length === 0) {
    throw new Error('Nie znaleziono linku DMG ODA na stronie pobierania.');
  }

  const normalizedCandidates = candidates.map((item) => item.toLowerCase());
  const primaryArchTokens = process.arch === 'arm64' ? ['macosx_arm64', 'arm64'] : ['macosx_x64', 'x64'];
  const fallbackArchTokens = process.arch === 'arm64' ? ['macosx_x64', 'x64'] : ['macosx_arm64', 'arm64'];
  const result = [];
  const usedIndexes = new Set();

  const pushMatchesForTokens = (tokens) => {
    for (const token of tokens) {
      for (let index = 0; index < normalizedCandidates.length; index += 1) {
        const value = normalizedCandidates[index];
        if (usedIndexes.has(index)) {
          continue;
        }
        if (value.includes('macosx') && value.includes(token) && value.includes('.dmg')) {
          usedIndexes.add(index);
          result.push(candidates[index]);
        }
      }
    }
  };

  pushMatchesForTokens(primaryArchTokens);
  pushMatchesForTokens(fallbackArchTokens);

  for (let index = 0; index < normalizedCandidates.length; index += 1) {
    const value = normalizedCandidates[index];
    if (usedIndexes.has(index)) {
      continue;
    }
    if (value.includes('macosx') && value.includes('.dmg')) {
      usedIndexes.add(index);
      result.push(candidates[index]);
    }
  }

  for (let index = 0; index < candidates.length; index += 1) {
    if (usedIndexes.has(index)) {
      continue;
    }
    result.push(candidates[index]);
  }

  return result;
}

async function resolveOdaWindowsInstallerUrls() {
  const htmlBuffer = await httpsGetBuffer(ODA_DOWNLOAD_URL);
  const html = htmlBuffer.toString('utf8');

  // ODA now uses /guestfiles/get?filename=...msi redirect links
  const rawMatches = [
    ...html.matchAll(/https?:\/\/[^"'\s>]+\.msi/gi),
    ...html.matchAll(/href=["']([^"']*\.msi)["']/gi),
    ...html.matchAll(/href=["']([^"']*guestfiles[^"']*filename=[^"']*\.msi[^"']*)["']/gi)
  ];

  const candidates = rawMatches
    .map((match) => {
      const raw = match[1] || match[0] || '';
      return raw.startsWith('http')
        ? raw
        : `https://${ODA_DOWNLOAD_PAGE_HOST}${raw.startsWith('/') ? '' : '/'}${raw}`;
    })
    .filter((candidate) => /oda|converter|guestfiles/i.test(candidate));

  if (candidates.length === 0) {
    throw new Error('Nie znaleziono instalatora MSI ODA na stronie pobierania.');
  }

  const normalized = candidates.map((item) => item.toLowerCase());
  const preferredTokens = ['vc16_amd64', 'amd64', 'win', 'windows'];
  const result = [];
  const usedIndexes = new Set();

  for (const token of preferredTokens) {
    for (let index = 0; index < normalized.length; index += 1) {
      if (usedIndexes.has(index)) {
        continue;
      }
      const value = normalized[index];
      if (value.includes(token) && value.includes('.msi')) {
        usedIndexes.add(index);
        result.push(candidates[index]);
      }
    }
  }

  for (let index = 0; index < candidates.length; index += 1) {
    if (usedIndexes.has(index)) {
      continue;
    }
    result.push(candidates[index]);
  }

  return result;
}

function normalizeOdaInstallError(error) {
  const raw = error && error.message ? String(error.message) : '';
  const lower = raw.toLowerCase();
  if (lower.includes('enotfound') || lower.includes('could not resolve host') || lower.includes('eai_again')) {
    return t(
      'Nie udało się pobrać ODA (problem DNS/sieci). Sprawdź połączenie internetowe albo dodaj lokalnie plik tools/oda/ODAFileConverter.',
      'Failed to download ODA (DNS/network issue). Check internet connectivity or place tools/oda/ODAFileConverter locally.'
    );
  }
  if (lower.includes('unsupported') || lower.includes('not supported')) {
    return t(
      'Pobrany instalator ODA nie wspiera tego środowiska. Aplikacja spróbuje innego wariantu (arm64/x64).',
      'Downloaded ODA installer does not support this environment. The app will try another variant (arm64/x64).'
    );
  }
  return raw || t('Nie udało się zainstalować ODA.', 'Failed to install ODA.');
}

async function downloadFile(url, destinationPath) {
  const data = await httpsGetBuffer(url);
  await fs.writeFile(destinationPath, data);
}

async function findAppBundleInDir(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.toLowerCase().endsWith('.app') || !/oda|converter/i.test(entry.name)) {
      continue;
    }
    const bundlePath = path.join(dirPath, entry.name);
    const converterPath = path.join(bundlePath, 'Contents', 'MacOS', 'ODAFileConverter');
    if (await pathExists(converterPath)) {
      return bundlePath;
    }
  }
  return null;
}

async function validateOdaRuntime(converterPath) {
  const tempRoot = await fs.mkdtemp(path.join(app.getPath('temp'), 'madcad-oda-validate-'));
  try {
    const inputDir = path.join(tempRoot, 'in');
    const outputDir = path.join(tempRoot, 'out');
    await fs.mkdir(inputDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
    const sourceDxf = path.join(inputDir, 'test.dxf');
    const minimalDxf = [
      '0', 'SECTION', '2', 'HEADER', '0', 'ENDSEC',
      '0', 'SECTION', '2', 'TABLES', '0', 'ENDSEC',
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'LINE', '8', '0', '10', '0', '20', '0', '11', '100', '21', '100',
      '0', 'ENDSEC', '0', 'EOF', ''
    ].join('\n');
    await fs.writeFile(sourceDxf, minimalDxf, 'utf8');
    await runOdaFileConverter(converterPath, inputDir, outputDir, 'DWG', '*.*');
    const outputDwg = await findFirstWithExtension(outputDir, '.dwg');
    return Boolean(outputDwg && (await pathExists(outputDwg)));
  } catch (_error) {
    return false;
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function installOdaFromBundle(bundlePath) {
  const installTargets = ['/Applications', path.join(app.getPath('home'), 'Applications')];
  let installedConverterPath = null;

  for (const targetDir of installTargets) {
    try {
      await fs.mkdir(targetDir, { recursive: true });
      const targetBundle = path.join(targetDir, path.basename(bundlePath));
      await fs.rm(targetBundle, { recursive: true, force: true }).catch(() => {});
      try {
        await execFileAsync('ditto', ['--rsrc', '--extattr', '--acl', bundlePath, targetBundle], {
          timeout: 180000
        });
      } catch (_dittoError) {
        await execFileAsync('cp', ['-R', bundlePath, targetBundle], { timeout: 180000 });
      }
      await execFileAsync('xattr', ['-dr', 'com.apple.quarantine', targetBundle], { timeout: 30000 }).catch(
        () => {}
      );
      const converterPath = path.join(targetBundle, 'Contents', 'MacOS', 'ODAFileConverter');
      if ((await isHealthyOdaConverterPath(converterPath)) && (await validateOdaRuntime(converterPath))) {
        installedConverterPath = converterPath;
        break;
      }
    } catch (_error) {
      // Spróbuj kolejny target.
    }
  }

  if (!installedConverterPath) {
    throw new Error('Nie udało się zainstalować poprawnego dodatku ODA.');
  }

  await setSavedOdaConverterPath(installedConverterPath);
  return installedConverterPath;
}

async function tryInstallBundledOdaConverter() {
  if (isWindows) {
    const bundledExeCandidates = [
      path.join(process.resourcesPath, 'tools', 'oda', 'ODAFileConverter.exe'),
      path.join(__dirname, '..', 'tools', 'oda', 'ODAFileConverter.exe')
    ];
    for (const exePath of bundledExeCandidates) {
      if (!(await isHealthyOdaConverterPath(exePath))) {
        continue;
      }
      await setSavedOdaConverterPath(exePath);
      return exePath;
    }
    return null;
  }

  const bundledAppCandidates = [
    path.join(process.resourcesPath, 'tools', 'oda', 'ODAFileConverter.app'),
    path.join(__dirname, '..', 'tools', 'oda', 'ODAFileConverter.app')
  ];
  for (const bundlePath of bundledAppCandidates) {
    if (!(await pathExists(bundlePath))) {
      continue;
    }
    try {
      return await installOdaFromBundle(bundlePath);
    } catch (_error) {
      // Próbuj kolejną lokalizację.
    }
  }
  return null;
}

async function installOdaFromDmg(dmgPath) {
  if (!isMac) {
    throw new Error('Automatyczna instalacja ODA jest obecnie wspierana tylko na macOS.');
  }
  const mountPoint = path.join(app.getPath('temp'), `madcad-oda-mount-${Date.now()}`);
  await fs.mkdir(mountPoint, { recursive: true });

  let mounted = false;
  try {
    await execFileAsync('hdiutil', ['attach', dmgPath, '-nobrowse', '-mountpoint', mountPoint], {
      timeout: 120000
    });
    mounted = true;

    const bundlePath = await findAppBundleInDir(mountPoint);
    if (!bundlePath) {
      throw new Error('Instalator ODA nie zawiera aplikacji .app.');
    }

    return await installOdaFromBundle(bundlePath);
  } finally {
    if (mounted) {
      await execFileAsync('hdiutil', ['detach', mountPoint, '-force'], { timeout: 60000 }).catch(() => {});
    }
    await fs.rm(mountPoint, { recursive: true, force: true }).catch(() => {});
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function installOdaFromMsi(msiPath) {
  if (!isWindows) {
    throw new Error('Automatyczna instalacja MSI ODA jest wspierana tylko na Windows.');
  }

  await execFileAsync('msiexec', ['/i', msiPath, '/qn', '/norestart'], {
    timeout: 300000,
    windowsHide: true
  });

  const retries = 20;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const resolved = await resolveOdaConverterPath();
    if (resolved && (await isHealthyOdaConverterPath(resolved))) {
      await setSavedOdaConverterPath(resolved);
      return resolved;
    }
    await sleep(1500);
  }

  throw new Error('Instalator MSI zakończony, ale nie znaleziono ODAFileConverter.exe.');
}

async function autoInstallOdaConverter() {
  const bundledInstalled = await tryInstallBundledOdaConverter();
  if (bundledInstalled) {
    return bundledInstalled;
  }

  let installerUrls = [];
  let extension = 'bin';
  if (isMac) {
    installerUrls = await resolveOdaDmgUrls();
    extension = 'dmg';
  } else if (isWindows) {
    installerUrls = await resolveOdaWindowsInstallerUrls();
    extension = 'msi';
  } else {
    throw new Error('Automatyczna instalacja ODA jest obecnie wspierana na macOS i Windows.');
  }

  const failures = [];

  for (let index = 0; index < installerUrls.length; index += 1) {
    const tempDir = await fs.mkdtemp(path.join(app.getPath('temp'), 'madcad-oda-download-'));
    try {
      const installerUrl = installerUrls[index];
      const installerPath = path.join(tempDir, `oda-converter-${index + 1}.${extension}`);
      await downloadFile(installerUrl, installerPath);
      if (isMac) {
        return await installOdaFromDmg(installerPath);
      }
      if (isWindows) {
        return await installOdaFromMsi(installerPath);
      }
      throw new Error('Nieobsługiwana platforma instalacji ODA.');
    } catch (error) {
      failures.push(normalizeOdaInstallError(error));
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  throw new Error(failures[0] || t('Nie udało się zainstalować ODA.', 'Failed to install ODA.'));
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath, fsRaw.constants.F_OK);
    return true;
  } catch (_error) {
    return false;
  }
}

async function isHealthyOdaConverterPath(candidatePath) {
  const normalizedPath = await normalizeOdaConverterPath(candidatePath);
  if (!normalizedPath || !(await pathExists(normalizedPath))) {
    return false;
  }
  if (process.platform !== 'darwin') {
    return true;
  }
  const normalized = String(normalizedPath);
  const appMarker = '.app/Contents/MacOS/';
  const markerIndex = normalized.indexOf(appMarker);
  if (markerIndex === -1) {
    return true;
  }
  const appBundlePath = normalized.slice(0, markerIndex + 4);
  try {
    await execFileAsync('codesign', ['--verify', '--deep', appBundlePath], { timeout: 30000 });
    return true;
  } catch (_error) {
    return false;
  }
}

async function resolveOdaConverterPath() {
  const candidates = [];
  const bundledCandidates = process.platform === 'win32'
    ? [
        path.join(process.resourcesPath, 'tools', 'oda', 'ODAFileConverter.exe'),
        path.join(__dirname, '..', 'tools', 'oda', 'ODAFileConverter.exe')
      ]
    : [
        path.join(process.resourcesPath, 'tools', 'oda', 'ODAFileConverter'),
        path.join(__dirname, '..', 'tools', 'oda', 'ODAFileConverter')
      ];
  candidates.push(...bundledCandidates);

  const savedPath = await getSavedOdaConverterPath();
  if (savedPath) {
    candidates.push(savedPath);
  }
  if (process.env.ODA_CONVERTER_PATH) {
    candidates.push(process.env.ODA_CONVERTER_PATH);
  }
  if (process.platform === 'darwin') {
    candidates.push('/Applications/ODA File Converter.app/Contents/MacOS/ODAFileConverter');
    candidates.push('/Applications/ODAFileConverter.app/Contents/MacOS/ODAFileConverter');
  } else if (process.platform === 'win32') {
    candidates.push('C:\\Program Files\\ODA\\ODAFileConverter\\ODAFileConverter.exe');
    candidates.push('C:\\Program Files (x86)\\ODA\\ODAFileConverter\\ODAFileConverter.exe');
    candidates.push('C:\\Program Files\\ODA\\ODA File Converter\\ODAFileConverter.exe');
    candidates.push('C:\\Program Files (x86)\\ODA\\ODA File Converter\\ODAFileConverter.exe');
    candidates.push('C:\\Program Files\\Open Design Alliance\\ODAFileConverter\\ODAFileConverter.exe');
    candidates.push('C:\\Program Files (x86)\\Open Design Alliance\\ODAFileConverter\\ODAFileConverter.exe');

    const envRoots = [
      process.env.ProgramFiles,
      process.env['ProgramFiles(x86)'],
      process.env.LOCALAPPDATA
    ].filter(Boolean);
    for (const envRoot of envRoots) {
      candidates.push(envRoot);
      candidates.push(path.join(envRoot, 'ODA'));
      candidates.push(path.join(envRoot, 'Open Design Alliance'));
    }
  } else {
    candidates.push('/usr/bin/ODAFileConverter');
    candidates.push('/usr/local/bin/ODAFileConverter');
  }

  for (const candidate of candidates) {
    const normalizedCandidate = await normalizeOdaConverterPath(candidate);
    if (await isHealthyOdaConverterPath(normalizedCandidate)) {
      return normalizedCandidate;
    }
  }
  return null;
}

async function runOdaFileConverter(converterPath, inputDir, outputDir, targetType, sourcePattern) {
  const args = [inputDir, outputDir, 'ACAD2018', targetType, '0', '1', sourcePattern];
  await execFileAsync(converterPath, args, { timeout: 120000, windowsHide: true });
}

async function findFirstWithExtension(dirPath, extension) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await findFirstWithExtension(fullPath, extension);
      if (nested) {
        return nested;
      }
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(extension.toLowerCase())) {
      return fullPath;
    }
  }
  return null;
}

async function handleSavePromptBeforeExit(win) {
  let hasDrawableContent = true;
  try {
    hasDrawableContent = await win.webContents.executeJavaScript(
      `
      (() => {
        if (typeof window.__madcadHasDrawableContent === 'function') {
          return !!window.__madcadHasDrawableContent();
        }
        if (typeof window.__madcadGetSessionExport === 'function') {
          try {
            const raw = window.__madcadGetSessionExport();
            const parsed = JSON.parse(raw || '{}');
            return Array.isArray(parsed.entities) && parsed.entities.length > 0;
          } catch (_error) {
            return true;
          }
        }
        return true;
      })();
      `,
      true
    );
  } catch (_error) {
    hasDrawableContent = true;
  }

  if (!hasDrawableContent) {
    try {
      await win.webContents.executeJavaScript(
        'window.__madcadClearRuntimeSession && window.__madcadClearRuntimeSession();',
        true
      );
    } catch (_error) {}
    await clearAutoSaveSnapshot();
    return true;
  }

  const response = await dialog.showMessageBox(win, {
    type: 'question',
    buttons: [t('Zapisz i wyjdź', 'Save and Exit'), t('Wyjdź bez zapisu', 'Exit Without Saving'), t('Anuluj', 'Cancel')],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
    title: t('Zamykanie MadCAD', 'Closing MadCAD'),
    message: t('Czy chcesz zapisać rysunek przed wyjściem?', 'Do you want to save the drawing before exit?'),
    detail: t('Po zamknięciu sesja robocza zostanie wyczyszczona.', 'The current runtime session will be cleared after closing.')
  });

  if (response.response === 2) {
    return false;
  }

  if (response.response === 0) {
    let exportedText = '';
    try {
      exportedText = await win.webContents.executeJavaScript(
        'window.__madcadGetSessionExport ? window.__madcadGetSessionExport() : ""',
        true
      );
    } catch (_error) {
      await dialog.showMessageBox(win, {
        type: 'error',
        title: t('Błąd zapisu', 'Save Error'),
        message: t('Nie udało się przygotować danych do zapisu.', 'Failed to prepare drawing data for saving.')
      });
      return false;
    }

    const saveResult = await dialog.showSaveDialog(win, {
      title: t('Zapisz rysunek przed wyjściem', 'Save Drawing Before Exit'),
      defaultPath: path.join(app.getPath('documents'), appLanguage === 'en' ? 'drawing.json' : 'rysunek.json'),
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['createDirectory', 'showOverwriteConfirmation']
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return false;
    }

    try {
      await fs.writeFile(saveResult.filePath, String(exportedText || ''), 'utf8');
    } catch (_error) {
      await dialog.showMessageBox(win, {
        type: 'error',
        title: t('Błąd zapisu', 'Save Error'),
        message: t('Nie udało się zapisać pliku.', 'Failed to save file.')
      });
      return false;
    }
  }

  try {
    await win.webContents.executeJavaScript(
      'window.__madcadClearRuntimeSession && window.__madcadClearRuntimeSession();',
      true
    );
  } catch (_error) {}
  await clearAutoSaveSnapshot();

  return true;
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1680,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#111b29',
    title: appLanguage === 'en' ? `${APP_DISPLAY_NAME} EN` : `${APP_DISPLAY_NAME} PL`,
    icon: appIconPng,
    autoHideMenuBar: !isMac,
    ...(isMac
      ? {
          titleBarStyle: 'hidden',
          trafficLightPosition: { x: 13, y: 10 }
        }
      : isWindows
      ? {
          titleBarStyle: 'hidden',
          titleBarOverlay: {
            color: '#20314a',
            symbolColor: '#dbe7ff',
            height: 30
          }
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      devTools: true,
      additionalArguments: [`--madcad-lang=${appLanguage}`]
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  if (!app.isPackaged) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  if (!isMac) {
    win.setMenuBarVisibility(false);
  }

  let closeApproved = false;
  win.on('close', (event) => {
    if (closeApproved || forceCloseForUpdate) {
      return;
    }
    event.preventDefault();
    void (async () => {
      if (win.isDestroyed()) {
        return;
      }
      const canClose = await handleSavePromptBeforeExit(win);
      if (!canClose || win.isDestroyed()) {
        return;
      }
      closeApproved = true;
      win.close();
    })();
  });

  return win;
}

function retainWindow(win) {
  if (!win) {
    return;
  }
  transientWindows.add(win);
  win.on('closed', () => {
    transientWindows.delete(win);
  });
}

function createMenu() {
  const executeRendererShortcut = (accelerator) => {
    const focused = BrowserWindow.getFocusedWindow();
    if (!focused || focused.isDestroyed()) {
      return;
    }
    if (accelerator && accelerator.id) {
      focused.webContents.executeJavaScript(
        `(() => {
          const element = document.getElementById(${JSON.stringify(String(accelerator.id))});
          if (element) {
            element.click();
          }
        })();`
      );
      return;
    }
    const commandKey = isMac ? 'metaKey' : 'ctrlKey';
    focused.webContents.executeJavaScript(
      `window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(
        String(accelerator.key || '')
      )}, ${commandKey}: true, altKey: ${Boolean(accelerator.altKey)}, shiftKey: ${Boolean(accelerator.shiftKey)} }));`
    );
  };

  const template = [
    ...(isMac
      ? [
          {
            label: APP_DISPLAY_NAME,
            submenu: [
              { role: 'about', label: t(`O programie ${APP_DISPLAY_NAME}`, `About ${APP_DISPLAY_NAME}`) },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          }
        ]
      : []),
    {
      label: t('Plik', 'File'),
      submenu: [
        {
          label: t('Nowy rysunek', 'New drawing'),
          accelerator: 'CmdOrCtrl+N',
          click: () => executeRendererShortcut({ key: 'n' })
        },
        {
          label: t('Wczytaj JSON', 'Open JSON'),
          accelerator: 'CmdOrCtrl+O',
          click: () => executeRendererShortcut({ key: 'o' })
        },
        {
          label: t('Zapisz JSON', 'Save JSON'),
          accelerator: 'CmdOrCtrl+S',
          click: () => executeRendererShortcut({ key: 's' })
        },
        {
          label: t('Drukuj / PDF', 'Print / PDF'),
          accelerator: 'CmdOrCtrl+P',
          click: () => executeRendererShortcut({ key: 'p' })
        },
        { type: 'separator' },
        {
          role: isMac ? 'close' : 'quit',
          label: isMac ? t('Zamknij okno', 'Close window') : t('Wyjście', 'Exit')
        }
      ]
    },
    {
      label: t('Edycja', 'Edit'),
      submenu: [
        { role: 'undo', label: t('Cofnij', 'Undo') },
        { role: 'redo', label: t('Ponów', 'Redo') },
        { type: 'separator' },
        { role: 'cut', label: t('Wytnij', 'Cut') },
        { role: 'copy', label: t('Kopiuj', 'Copy') },
        { role: 'paste', label: t('Wklej', 'Paste') },
        { role: 'selectAll', label: t('Zaznacz wszystko', 'Select all') }
      ]
    },
    {
      label: t('Widok', 'View'),
      submenu: [
        { role: 'resetZoom', label: t('Reset powiększenia', 'Reset zoom') },
        { role: 'zoomIn', label: t('Powiększ', 'Zoom in') },
        { role: 'zoomOut', label: t('Pomniejsz', 'Zoom out') },
        { type: 'separator' },
        { role: 'togglefullscreen', label: t('Pełny ekran', 'Full screen') },
        ...(!app.isPackaged
          ? [
              { type: 'separator' },
              { role: 'reload', label: t('Odśwież', 'Reload') },
              { role: 'forceReload', label: t('Wymuś odświeżenie', 'Force reload') },
              { role: 'toggleDevTools', label: t('Narzędzia deweloperskie', 'Developer tools') }
            ]
          : [])
      ]
    },
    {
      role: 'window',
      label: t('Okno', 'Window'),
      submenu: [
        { role: 'minimize', label: t('Minimalizuj', 'Minimize') },
        { role: 'zoom', label: t('Powiększ okno', 'Zoom window') },
        ...(isMac
          ? [{ type: 'separator' }, { role: 'front', label: t('Na wierzch', 'Bring all to front') }]
          : [{ role: 'close', label: t('Zamknij', 'Close') }])
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle('madcad:save-text-file', async (event, payload) => {
  try {
    const senderWindow = BrowserWindow.fromWebContents(event.sender) || null;
    const defaultName =
      payload && typeof payload.defaultName === 'string' && payload.defaultName.trim()
        ? payload.defaultName.trim()
        : appLanguage === 'en'
        ? 'drawing.txt'
        : 'rysunek.txt';
    const text = payload && typeof payload.text === 'string' ? payload.text : '';
    const filters = Array.isArray(payload && payload.filters) ? payload.filters : [];

    const result = await dialog.showSaveDialog(senderWindow, {
      title: t('Zapisz plik', 'Save file'),
      defaultPath: defaultName,
      filters,
      properties: ['createDirectory', 'showOverwriteConfirmation']
    });

    if (result.canceled || !result.filePath) {
      return { ok: false, canceled: true };
    }

    await fs.writeFile(result.filePath, text, 'utf8');
    return { ok: true, canceled: false, filePath: result.filePath };
  } catch (error) {
    return {
      ok: false,
      canceled: false,
      error: error && error.message ? String(error.message) : t('Nieznany błąd zapisu', 'Unknown save error')
    };
  }
});

ipcMain.handle('madcad:check-for-updates', async () => {
  try {
    if (!app.isPackaged) {
      return {
        ok: true,
        available: false,
        supported: false,
        currentVersion: normalizeVersionText(app.getVersion()),
        latestVersion: null,
        releaseUrl: '',
        error: t(
          'Aktualizator działa tylko w wersji zainstalowanej (build release).',
          'Updater works only in installed release builds.'
        )
      };
    }
    const currentVersion = normalizeVersionText(app.getVersion());
    const latest = await fetchLatestMadcadRelease();
    const hasNewerVersion =
      isVersionGreater(latest.latestVersion, currentVersion) ||
      isUpdateVersionDifferent(latest.latestVersion, currentVersion);
    const hasAssetForPlatform = Boolean(latest.asset && latest.asset.url);
    return {
      ok: true,
      available: hasNewerVersion && hasAssetForPlatform,
      supported: hasAssetForPlatform,
      currentVersion,
      latestVersion: latest.latestVersion,
      assetName: latest.asset ? latest.asset.name : null,
      downloadUrl: latest.asset ? latest.asset.url : null,
      releaseUrl: latest.releaseUrl || ''
    };
  } catch (error) {
    return {
      ok: false,
      available: false,
      supported: false,
      ...(function () {
        const mapped = mapUpdaterError(error, 'Nie udało się sprawdzić aktualizacji.', 'Cannot check updates.');
        return {
          error: mapped.message,
          code: mapped.code,
          debug: mapped.rawMessage || null
        };
      })()
    };
  }
});

ipcMain.handle('madcad:download-and-install-update', async (_event, payload) => {
  try {
    if (!app.isPackaged) {
      return {
        ok: false,
        installing: false,
        error: t(
          'Aktualizator działa tylko w wersji zainstalowanej (build release).',
          'Updater works only in installed release builds.'
        )
      };
    }

    let downloadUrl = String((payload && payload.downloadUrl) || '').trim();
    let assetName = String((payload && payload.assetName) || '').trim();
    let latestVersion = normalizeVersionText(String((payload && payload.latestVersion) || ''));

    if (!downloadUrl) {
      const latest = await fetchLatestMadcadRelease();
      if (!latest.asset || !latest.asset.url) {
        return {
          ok: false,
          installing: false,
          error: t(
            'Brak paczki aktualizacji dla tej platformy.',
            'No update package is available for this platform.'
          )
        };
      }
      downloadUrl = String(latest.asset.url || '').trim();
      assetName = String(latest.asset.name || '').trim();
      latestVersion = latest.latestVersion;
    }

    if (!downloadUrl) {
      return {
        ok: false,
        installing: false,
        error: t('Brak adresu pobierania aktualizacji.', 'Missing update download URL.')
      };
    }

    const currentVersion = normalizeVersionText(app.getVersion());
    if (latestVersion && !isUpdateVersionDifferent(latestVersion, currentVersion)) {
      return {
        ok: true,
        installing: false,
        upToDate: true,
        currentVersion,
        latestVersion
      };
    }

    const updateDir = path.join(app.getPath('temp'), 'madcad-updater');
    await fs.mkdir(updateDir, { recursive: true });
    const fileBase = sanitizeFileName(assetName, isWindows ? 'madcad-update.exe' : 'madcad-update.zip');
    const downloadedPath = path.join(updateDir, `${Date.now()}-${fileBase}`);
    await downloadFileWithRedirects(downloadUrl, downloadedPath);

    let installerMeta = null;
    if (isMac) {
      installerMeta = await scheduleMacZipInstall(downloadedPath);
    } else if (isWindows) {
      launchWindowsInstaller(downloadedPath);
    } else {
      return {
        ok: false,
        installing: false,
        error: t('Ta platforma nie jest jeszcze obsługiwana przez aktualizator.', 'This platform is not supported by updater yet.')
      };
    }

    forceCloseForUpdate = true;
    setTimeout(() => {
      app.quit();
    }, 120);

    return {
      ok: true,
      installing: true,
      downloadedPath,
      latestVersion: latestVersion || null,
      logPath: installerMeta && installerMeta.logPath ? installerMeta.logPath : null
    };
  } catch (error) {
    forceCloseForUpdate = false;
    const mapped = mapUpdaterError(
      error,
      'Nie udało się pobrać lub zainstalować aktualizacji.',
      'Failed to download or install update.'
    );
    return {
      ok: false,
      installing: false,
      error: mapped.message,
      code: mapped.code,
      debug: mapped.rawMessage || null
    };
  }
});

ipcMain.handle('madcad:autosave-write', async (_event, payload) => {
  try {
    const text = payload && typeof payload.text === 'string' ? payload.text : '';
    if (!text.trim()) {
      return {
        ok: false,
        error: t('Brak danych autozapisu.', 'Missing autosave payload.')
      };
    }
    const autoSavePath = getAutoSavePath();
    await fs.mkdir(path.dirname(autoSavePath), { recursive: true });
    await fs.writeFile(autoSavePath, text, 'utf8');
    return {
      ok: true,
      filePath: autoSavePath,
      savedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error && error.message ? String(error.message) : t('Nie udało się zapisać autozapisu.', 'Autosave write failed.')
    };
  }
});

ipcMain.handle('madcad:autosave-read', async () => {
  try {
    const autoSavePath = getAutoSavePath();
    let stat = null;
    try {
      stat = await fs.stat(autoSavePath);
    } catch (_error) {
      return { ok: true, exists: false, filePath: autoSavePath };
    }
    const text = await fs.readFile(autoSavePath, 'utf8');
    return {
      ok: true,
      exists: true,
      filePath: autoSavePath,
      text,
      updatedAt: stat && stat.mtime ? stat.mtime.toISOString() : null
    };
  } catch (error) {
    return {
      ok: false,
      exists: false,
      error:
        error && error.message ? String(error.message) : t('Nie udało się odczytać autozapisu.', 'Autosave read failed.')
    };
  }
});

ipcMain.handle('madcad:autosave-clear', async () => {
  try {
    await clearAutoSaveSnapshot();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error && error.message ? String(error.message) : t('Nie udało się usunąć autozapisu.', 'Autosave clear failed.')
    };
  }
});

ipcMain.handle('madcad:open-print-preview', async (event, payload) => {
  try {
    const html = payload && typeof payload.html === 'string' ? payload.html : '';
    const windowTitle =
      payload && typeof payload.title === 'string' && payload.title.trim()
        ? payload.title.trim()
        : t('MadCAD - wydruk', 'MadCAD - print');

    if (!html || html.length < 32) {
      return { ok: false, error: t('Brak danych podglądu wydruku.', 'Missing print preview data.') };
    }
    if (html.length > 8_000_000) {
      return { ok: false, error: t('Podgląd wydruku jest zbyt duży.', 'Print preview payload is too large.') };
    }

    const previewWindow = new BrowserWindow({
      width: 1220,
      height: 900,
      minWidth: 900,
      minHeight: 640,
      show: false,
      backgroundColor: '#f3f5fa',
      title: windowTitle,
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    retainWindow(previewWindow);

    if (!isMac) {
      previewWindow.removeMenu();
    }

    const previewDir = path.join(app.getPath('temp'), 'madcad-print-preview');
    await fs.mkdir(previewDir, { recursive: true });
    const previewPath = path.join(
      previewDir,
      `preview-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.html`
    );
    await fs.writeFile(previewPath, html, 'utf8');
    previewWindow.on('closed', () => {
      void fs.unlink(previewPath).catch(() => {});
    });
    await previewWindow.loadFile(previewPath);
    previewWindow.once('ready-to-show', () => {
      if (!previewWindow.isDestroyed()) {
        previewWindow.show();
        previewWindow.focus();
      }
    });
    if (!previewWindow.isDestroyed()) {
      previewWindow.show();
      previewWindow.focus();
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error && error.message ? String(error.message) : t('Nie udało się otworzyć podglądu.', 'Cannot open preview.')
    };
  }
});

ipcMain.handle('madcad:get-oda-status', async () => {
  try {
    const converterPath = await resolveOdaConverterPath();
    return {
      ok: true,
      installed: Boolean(converterPath),
      path: converterPath || null
    };
  } catch (error) {
    return {
      ok: false,
      installed: false,
      path: null,
      error: error && error.message ? String(error.message) : t('Błąd sprawdzania ODA.', 'ODA status check error.')
    };
  }
});

ipcMain.handle('madcad:choose-oda-path', async (event) => {
  try {
    const senderWindow = BrowserWindow.fromWebContents(event.sender) || null;
    const result = await dialog.showOpenDialog(senderWindow, {
      title: t('Wskaż ODA File Converter', 'Choose ODA File Converter'),
      properties: process.platform === 'win32' || process.platform === 'darwin'
        ? ['openFile', 'openDirectory']
        : ['openFile'],
      buttonLabel: t('Ustaw ścieżkę', 'Set path')
    });

    if (result.canceled || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
      return { ok: false, canceled: true };
    }

    const selectedPath = result.filePaths[0];
    const normalizedSelection = await normalizeOdaConverterPath(selectedPath);
    if (!normalizedSelection || !(await pathExists(normalizedSelection))) {
      return {
        ok: false,
        canceled: false,
        error: t('Wybrana ścieżka nie istnieje.', 'Selected path does not exist.')
      };
    }

    await setSavedOdaConverterPath(normalizedSelection);
    const converterPath = await resolveOdaConverterPath();
    return {
      ok: true,
      canceled: false,
      installed: Boolean(converterPath),
      path: converterPath || normalizedSelection
    };
  } catch (error) {
    return {
      ok: false,
      canceled: false,
      error: error && error.message ? String(error.message) : t('Błąd wyboru ścieżki ODA.', 'ODA path selection error.')
    };
  }
});

ipcMain.handle('madcad:open-oda-download', async () => {
  try {
    await shell.openExternal(ODA_DOWNLOAD_URL);
    return { ok: true, canceled: false, url: ODA_DOWNLOAD_URL };
  } catch (error) {
    return {
      ok: false,
      canceled: false,
      error: error && error.message ? String(error.message) : t('Nie udało się otworzyć strony pobrania ODA.', 'Failed to open ODA download page.')
    };
  }
});

ipcMain.handle('madcad:install-oda-addon', async () => {
  try {
    const installedPath = await autoInstallOdaConverter();
    return {
      ok: true,
      canceled: false,
      installed: true,
      path: installedPath || null
    };
  } catch (error) {
    return {
      ok: false,
      canceled: false,
      installed: false,
      error: error && error.message ? String(error.message) : t('Nie udało się zainstalować ODA.', 'Failed to install ODA.')
    };
  }
});

ipcMain.handle('madcad:convert-cad-file', async (event, payload) => {
  let tempRoot = null;
  try {
    const mode = String(payload && payload.mode ? payload.mode : '');
    const senderWindow = BrowserWindow.fromWebContents(event.sender) || null;
    const converterPath = await resolveOdaConverterPath();
    if (!converterPath) {
      return {
        ok: false,
        canceled: false,
        error: t(
          'Nie znaleziono ODA File Converter. Zainstaluj aplikację i uruchom ponownie MadCAD.',
          'ODA File Converter not found. Install it and restart MadCAD.'
        )
      };
    }

    tempRoot = await fs.mkdtemp(path.join(app.getPath('temp'), 'madcad-oda-'));
    const inputDir = path.join(tempRoot, 'in');
    const outputDir = path.join(tempRoot, 'out');
    await fs.mkdir(inputDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

    if (mode === 'dwg-to-dxf') {
      const sourcePath = String(payload && payload.sourcePath ? payload.sourcePath : '');
      if (!sourcePath || !(await pathExists(sourcePath))) {
        return {
          ok: false,
          canceled: false,
          error: t('Nieprawidłowa ścieżka pliku DWG.', 'Invalid DWG file path.')
        };
      }
      const sourceName = path.basename(sourcePath);
      const sourceCopy = path.join(inputDir, sourceName);
      await fs.copyFile(sourcePath, sourceCopy);
      await runOdaFileConverter(converterPath, inputDir, outputDir, 'DXF', '*.*');
      const outputDxf = await findFirstWithExtension(outputDir, '.dxf');
      if (!outputDxf) {
        return {
          ok: false,
          canceled: false,
          error: t('Konwersja DWG->DXF nie zwróciła pliku wynikowego.', 'DWG->DXF conversion did not produce an output file.')
        };
      }
      const text = await fs.readFile(outputDxf, 'utf8');
      return { ok: true, canceled: false, text };
    }

    if (mode === 'dxf-text-to-dwg') {
      const dxfText = String(payload && payload.dxfText ? payload.dxfText : '');
      const dxfPath = path.join(inputDir, 'source.dxf');
      await fs.writeFile(dxfPath, dxfText, 'utf8');
      await runOdaFileConverter(converterPath, inputDir, outputDir, 'DWG', '*.*');
      const outputDwg = await findFirstWithExtension(outputDir, '.dwg');
      if (!outputDwg) {
        return {
          ok: false,
          canceled: false,
          error: t('Konwersja DXF->DWG nie zwróciła pliku wynikowego.', 'DXF->DWG conversion did not produce an output file.')
        };
      }

      const defaultName =
        payload && typeof payload.defaultName === 'string' && payload.defaultName.trim()
          ? payload.defaultName.trim()
          : appLanguage === 'en'
          ? 'drawing.dwg'
          : 'rysunek.dwg';

      const saveResult = await dialog.showSaveDialog(senderWindow, {
        title: t('Zapisz plik DWG', 'Save DWG file'),
        defaultPath: defaultName,
        filters: [{ name: 'DWG', extensions: ['dwg'] }],
        properties: ['createDirectory', 'showOverwriteConfirmation']
      });

      if (saveResult.canceled || !saveResult.filePath) {
        return { ok: false, canceled: true };
      }

      await fs.copyFile(outputDwg, saveResult.filePath);
      return { ok: true, canceled: false, filePath: saveResult.filePath };
    }

    return {
      ok: false,
      canceled: false,
      error: t('Nieobsługiwany tryb konwersji CAD.', 'Unsupported CAD conversion mode.')
    };
  } catch (error) {
    return {
      ok: false,
      canceled: false,
      error: error && error.message ? String(error.message) : t('Błąd konwersji CAD.', 'CAD conversion error.')
    };
  } finally {
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
    }
  }
});

function getPrivateLicenseAuditPath() {
  const userDataDir = app.getPath('userData');
  return path.join(userDataDir, 'private', 'license-audit.jsonl');
}

ipcMain.handle('madcad:append-license-audit', async (_event, payload) => {
  try {
    const safePayload = payload && typeof payload === 'object' ? payload : {};
    const entry = {
      at: new Date().toISOString(),
      type: String(safePayload.type || 'akcja'),
      details: String(safePayload.details || ''),
      meta: safePayload.meta && typeof safePayload.meta === 'object' ? safePayload.meta : {}
    };
    const auditPath = getPrivateLicenseAuditPath();
    await fs.mkdir(path.dirname(auditPath), { recursive: true });
    await fs.appendFile(auditPath, `${JSON.stringify(entry)}\n`, 'utf8');
    return { ok: true, path: auditPath };
  } catch (error) {
    return {
      ok: false,
      error: error && error.message ? String(error.message) : t('Nieznany błąd zapisu audytu', 'Unknown audit save error')
    };
  }
});

ipcMain.handle('madcad:clear-license-storage', async (event) => {
  try {
    const senderSession = event && event.sender ? event.sender.session : null;
    if (!senderSession || typeof senderSession.clearStorageData !== 'function') {
      return {
        ok: false,
        error: t('Brak dostępu do sesji aplikacji.', 'App session is unavailable.')
      };
    }

    // Czyścimy localStorage dla sesji renderera (origin file:// dla aplikacji desktop).
    await senderSession.clearStorageData({
      storages: ['localstorage']
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error && error.message
          ? String(error.message)
          : t('Nie udało się wyczyścić localStorage licencji.', 'Failed to clear license localStorage.')
    };
  }
});

ipcMain.handle('madcad:set-language', async (_event, payload) => {
  try {
    const requested = normalizeLanguage(payload && payload.language);
    if (!requested) {
      return { ok: false, error: t('Nieprawidłowy język aplikacji.', 'Invalid app language.') };
    }

    appLanguage = requested;
    const config = await readCadConfig();
    config.appLanguage = requested;
    await writeCadConfig(config);

    createMenu();
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win || win.isDestroyed()) {
        return;
      }
      win.setTitle(appLanguage === 'en' ? `${APP_DISPLAY_NAME} EN` : `${APP_DISPLAY_NAME} PL`);
    });

    return { ok: true, language: appLanguage };
  } catch (error) {
    return {
      ok: false,
      error: error && error.message ? String(error.message) : t('Nie udało się zapisać języka.', 'Failed to save language.')
    };
  }
});

app.whenReady().then(() => {
  // Wymuszamy ikonę w Docku (szczególnie ważne przy uruchamianiu deweloperskim).
  if (isMac && app.dock) {
    const dockIcon = nativeImage.createFromPath(appIconPng);
    if (!dockIcon.isEmpty()) {
      app.dock.setIcon(dockIcon);
    }
  }

  createMenu();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit();
  }
});
