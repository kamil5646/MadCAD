const path = require('path');
const { pathToFileURL } = require('url');
const fsRaw = require('fs');
const fs = require('fs/promises');
const https = require('https');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const { app, BrowserWindow, Menu, shell, nativeImage, dialog, ipcMain, screen } = require('electron');
const { atomicWriteTextFile } = require('./atomic-file.cjs');
const { normalizeSlicerPayload, windowsCandidates } = require('./slicer-launch.cjs');
const { isTrustedAppNavigation, isTrustedIpcUrl, normalizeExternalUrl } = require('./security-policy.cjs');
const {
  normalizeAutosavePayload,
  normalizePrintPreviewPayload,
  normalizeSaveTextPayload,
  securePrintPreviewHtml,
} = require('./ipc-policy.cjs');
const { readRecoverableTextFile, validateJsonText } = require('./recovery-file.cjs');
const { normalizeWindowBounds } = require('./window-bounds.cjs');
const updatePolicy = require('./update-policy.cjs');
const dwgConverter = require('./dwg-converter.cjs');
const packageMetadata = require('../package.json');

const execFileAsync = promisify(execFile);

const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';
const isWindowsStore = isWindows && process.windowsStore === true;
const APP_DISPLAY_NAME = 'MadCAD';
const LEGACY_USER_DATA_NAME = 'MadCAD 2D';
const appIconPng = path.join(__dirname, '..', 'assets', 'icons', 'madcad-512.png');
const MADCAD_RELEASE_API_URL = 'https://api.github.com/repos/kamil5646/MadCAD2D/releases?per_page=30';
const MADCAD_RELEASE_LATEST_PAGE_URL = 'https://github.com/kamil5646/MadCAD2D/releases/latest';
const MADCAD_UPDATE_USER_AGENT = 'MadCAD2D-Updater/1.0';
const MAX_UPDATE_DOWNLOAD_BYTES = 512 * 1024 * 1024;
const MAX_UPDATE_METADATA_BYTES = 4 * 1024 * 1024;
const DWG_CONVERTER_DOWNLOAD_URL = 'https://www.opendesign.com/guestFiles/oda_file_converter';
const TRUSTED_MAC_TEAM_ID = /^[A-Z0-9]{10}$/.test(String(packageMetadata.madcadMacTeamId || ''))
  ? String(packageMetadata.madcadMacTeamId)
  : '';
let forceCloseForUpdate = false;
let autosaveOperationQueue = Promise.resolve();

if (app && typeof app.setName === 'function') {
  app.setName(APP_DISPLAY_NAME);
  // Zachowujemy dotychczasowy katalog danych, aby aktualizacja po zmianie nazwy
  // nie utraciła ustawień ani automatycznych zapisów użytkownika.
  const isolatedTestUserData = !app.isPackaged && process.env.MADCAD_TEST_USER_DATA_DIR
    ? path.resolve(process.env.MADCAD_TEST_USER_DATA_DIR)
    : '';
  app.setPath('userData', isolatedTestUserData || path.join(app.getPath('appData'), LEGACY_USER_DATA_NAME));
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
  const systemLocale = String(Intl.DateTimeFormat().resolvedOptions().locale || process.env.LANG || '').toLowerCase();
  return systemLocale.startsWith('pl') ? 'pl' : 'en';
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

function getSavedWindowBoundsSync() {
  try {
    const parsed = JSON.parse(fsRaw.readFileSync(getCadConfigPath(), 'utf8'));
    return parsed && typeof parsed.windowBounds === 'object' ? parsed.windowBounds : null;
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

function queueAutosaveOperation(operation) {
  const result = autosaveOperationQueue.then(operation, operation);
  autosaveOperationQueue = result.catch(() => {});
  return result;
}

function clearAutoSaveSnapshot() {
  return queueAutosaveOperation(async () => {
    const autoSavePath = getAutoSavePath();
    await Promise.all([
      fs.rm(autoSavePath, { force: true }).catch(() => {}),
      fs.rm(`${autoSavePath}.bak`, { force: true }).catch(() => {}),
    ]);
  });
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

async function readSavedDwgConverterPath() {
  const config = await readCadConfig();
  return typeof config.dwgConverterPath === 'string' ? config.dwgConverterPath.trim() : '';
}

async function saveDwgConverterPath(converterPath) {
  const config = await readCadConfig();
  config.dwgConverterPath = String(converterPath || '').trim();
  await writeCadConfig(config);
}

async function chooseDwgConverterPath(ownerWindow) {
  const result = await dialog.showOpenDialog(ownerWindow, {
    title: t('Wskaż lokalny konwerter DWG', 'Choose a local DWG converter'),
    buttonLabel: t('Użyj konwertera', 'Use converter'),
    properties: ['openFile', 'openDirectory'],
  });
  if (result.canceled || !result.filePaths?.[0]) return null;
  const normalized = await dwgConverter.normalizeConverterPath(result.filePaths[0], process.platform);
  if (!(await dwgConverter.isUsableConverter(normalized, process.platform))) {
    throw new Error(t('Wybrany plik nie jest obsługiwanym konwerterem DWG.', 'The selected file is not a supported DWG converter.'));
  }
  await saveDwgConverterPath(normalized);
  return { executablePath: normalized, kind: dwgConverter.converterKind(normalized) };
}

function httpsGetBuffer(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (!updatePolicy.isTrustedUpdateUrl(url)) {
      reject(new Error('Niezaufany adres metadanych aktualizacji.'));
      return;
    }
    if (redirectCount > 8) {
      reject(new Error('Zbyt wiele przekierowań metadanych aktualizacji.'));
      return;
    }
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
        if (!updatePolicy.isTrustedUpdateUrl(nextUrl)) {
          reject(new Error('Przekierowanie metadanych aktualizacji prowadzi do niezaufanego hosta.'));
          return;
        }
        resolve(httpsGetBuffer(nextUrl, redirectCount + 1));
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`HTTP ${status}`));
        return;
      }
      const chunks = [];
      let receivedBytes = 0;
      response.on('data', (chunk) => {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_UPDATE_METADATA_BYTES) {
          request.destroy(new Error('Metadane aktualizacji przekraczają limit 4 MB.'));
          return;
        }
        chunks.push(chunk);
      });
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
  return String(value || '').trim().replace(/^v/i, '');
}

function selectReleaseAssetForPlatform(assets) {
  const asset = updatePolicy.selectReleaseAsset(assets, process.platform, process.arch);
  return asset ? {
    raw: asset,
    name: String(asset.name || ''),
    lower: String(asset.name || '').toLowerCase(),
    url: String(asset.browser_download_url || asset.url || ''),
  } : null;
}

function httpsGetJson(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (!updatePolicy.isTrustedUpdateUrl(url)) {
      reject(new Error('Niezaufany adres API aktualizacji.'));
      return;
    }
    if (redirectCount > 8) {
      reject(new Error('Zbyt wiele przekierowań API aktualizacji.'));
      return;
    }
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
          if (!updatePolicy.isTrustedUpdateUrl(nextUrl)) {
            reject(new Error('Przekierowanie API aktualizacji prowadzi do niezaufanego hosta.'));
            return;
          }
          resolve(httpsGetJson(nextUrl, redirectCount + 1));
          return;
        }
        if (status < 200 || status >= 300) {
          response.resume();
          reject(new Error(`HTTP ${status}`));
          return;
        }
        const chunks = [];
        let receivedBytes = 0;
        response.on('data', (chunk) => {
          receivedBytes += chunk.length;
          if (receivedBytes > MAX_UPDATE_METADATA_BYTES) {
            request.destroy(new Error('Odpowiedź API aktualizacji przekracza limit 4 MB.'));
            return;
          }
          chunks.push(chunk);
        });
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
    if (!updatePolicy.isTrustedUpdateUrl(url)) {
      reject(new Error('Niezaufany adres pobierania aktualizacji.'));
      return;
    }
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
          if (!updatePolicy.isTrustedUpdateUrl(nextUrl)) {
            reject(new Error('Przekierowanie aktualizacji prowadzi do niezaufanego hosta.'));
            return;
          }
          resolve(downloadFileWithRedirects(nextUrl, destinationPath, redirectCount + 1));
          return;
        }
        if (status < 200 || status >= 300) {
          response.resume();
          reject(new Error(`HTTP ${status}`));
          return;
        }

        const declaredLength = Number(response.headers['content-length'] || 0);
        if (declaredLength > MAX_UPDATE_DOWNLOAD_BYTES) {
          response.resume();
          reject(new Error('Paczka aktualizacji przekracza limit 512 MB.'));
          return;
        }

        const stream = fsRaw.createWriteStream(destinationPath);
        let receivedBytes = 0;
        let settled = false;
        const failDownload = (error) => {
          if (settled) return;
          settled = true;
          response.unpipe(stream);
          response.destroy();
          stream.destroy();
          void fs.rm(destinationPath, { force: true }).catch(() => {}).finally(() => reject(error));
        };
        response.on('error', failDownload);
        response.on('data', (chunk) => {
          receivedBytes += chunk.length;
          if (receivedBytes > MAX_UPDATE_DOWNLOAD_BYTES) {
            failDownload(new Error('Paczka aktualizacji przekracza limit 512 MB.'));
          }
        });
        response.pipe(stream);
        stream.on('finish', () => {
          if (settled) return;
          settled = true;
          stream.close(() => resolve(destinationPath));
        });
        stream.on('error', failDownload);
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
  if (!TRUSTED_MAC_TEAM_ID) {
    throw new Error(t('Pakiet nie zawiera zaufanego identyfikatora zespołu Apple.', 'The package does not contain a trusted Apple Team ID.'));
  }
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
TRUSTED_TEAM="$5"
BACKUP_APP="${'${TARGET_APP}'}.madcad-backup"

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

if ! /usr/bin/codesign --verify --deep --strict "$NEW_APP"; then
  echo "ERROR: downloaded app has an invalid signature"
  exit 1
fi
if ! /usr/sbin/spctl --assess --type execute --verbose "$NEW_APP"; then
  echo "ERROR: downloaded app was not accepted by Gatekeeper"
  exit 1
fi
CURRENT_TEAM="$(/usr/bin/codesign -dv --verbose=4 "$TARGET_APP" 2>&1 | /usr/bin/sed -n 's/^TeamIdentifier=//p')"
NEW_TEAM="$(/usr/bin/codesign -dv --verbose=4 "$NEW_APP" 2>&1 | /usr/bin/sed -n 's/^TeamIdentifier=//p')"
if [ -z "$NEW_TEAM" ] || [ "$NEW_TEAM" != "$TRUSTED_TEAM" ]; then
  echo "ERROR: signing TeamIdentifier mismatch"
  exit 1
fi
if [ -n "$CURRENT_TEAM" ] && [ "$CURRENT_TEAM" != "$TRUSTED_TEAM" ]; then
  echo "ERROR: installed app belongs to a different signing team"
  exit 1
fi

for attempt in $(seq 1 60); do
  if ! /usr/bin/pgrep -f "$APP_EXECUTABLE" >/dev/null 2>&1; then
    echo "App process closed after attempt $attempt"
    break
  fi
  sleep 0.5
done

rollback() {
  echo "Rolling back previous app"
  /bin/rm -rf "$TARGET_APP" >/dev/null 2>&1 || true
  if [ -e "$BACKUP_APP" ]; then /bin/mv "$BACKUP_APP" "$TARGET_APP"; fi
}

/bin/rm -rf "$BACKUP_APP" >/dev/null 2>&1 || true
if [ -e "$TARGET_APP" ] && ! /bin/mv "$TARGET_APP" "$BACKUP_APP"; then
  echo "ERROR: cannot create rollback backup"
  exit 1
fi

if ! /usr/bin/ditto "$NEW_APP" "$TARGET_APP"; then rollback; exit 1; fi
if ! /usr/bin/codesign --verify --deep --strict "$TARGET_APP"; then rollback; exit 1; fi
if ! /usr/sbin/spctl --assess --type execute --verbose "$TARGET_APP"; then rollback; exit 1; fi

echo "Opening installed app"
/usr/bin/open -n "$TARGET_APP"
echo "== MadCAD updater done: $(date) =="
`;
  await fs.writeFile(scriptPath, scriptSource, { mode: 0o755 });
  const child = spawn('/bin/bash', [scriptPath, zipPath, appPath, logPath, executablePath, TRUSTED_MAC_TEAM_ID], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  return { logPath, scriptPath };
}

async function moveVerifiedUpdateToDownloads(sourcePath, assetName) {
  const downloadsDir = app.getPath('downloads');
  await fs.mkdir(downloadsDir, { recursive: true });
  const fallbackName = isWindows ? 'madcad-update.exe' : isMac ? 'madcad-update.zip' : 'madcad-update.AppImage';
  const safeName = sanitizeFileName(assetName, fallbackName);
  const parsed = path.parse(safeName);
  for (let index = 0; index < 100; index += 1) {
    const suffix = index === 0 ? '' : ` (${index})`;
    const destinationPath = path.join(downloadsDir, `${parsed.name}${suffix}${parsed.ext}`);
    try {
      await fs.copyFile(sourcePath, destinationPath, fsRaw.constants.COPYFILE_EXCL);
      await fs.rm(sourcePath, { force: true });
      return destinationPath;
    } catch (error) {
      if (error && error.code === 'EEXIST') continue;
      throw error;
    }
  }
  throw new Error(t('Nie udało się utworzyć pliku aktualizacji w folderze Pobrane.', 'Cannot create the update file in Downloads.'));
}

async function openVerifiedUpdatePackage(filePath) {
  if (process.platform === 'linux' && filePath.toLowerCase().endsWith('.appimage')) {
    await fs.chmod(filePath, 0o755);
  }
  const openError = await shell.openPath(filePath);
  if (!openError) return { opened: true, openError: '' };
  shell.showItemInFolder(filePath);
  return { opened: false, openError: String(openError) };
}

async function fetchLatestMadcadRelease(channel = 'stable', currentVersion = app.getVersion()) {
  try {
    const releases = await httpsGetJson(MADCAD_RELEASE_API_URL);
    const selected = updatePolicy.selectLatestRelease(releases, channel, currentVersion);
    if (!selected) {
      return { latestVersion: normalizeVersionText(currentVersion), asset: null, checksumAsset: null, releaseUrl: '' };
    }
    const release = selected.release;
    const latestVersion = selected.version.raw;
    if (!latestVersion) {
      throw new Error(
        t(
          'Nie udało się odczytać wersji aktualizacji z GitHub Releases.',
          'Cannot read update version from GitHub Releases.'
        )
      );
    }
    const asset = selectReleaseAssetForPlatform(release && release.assets);
    const checksumAsset = asset ? updatePolicy.selectChecksumAsset(release.assets, asset.name) : null;
    return {
      latestVersion,
      asset,
      checksumAsset: checksumAsset ? { name: checksumAsset.name, url: checksumAsset.browser_download_url } : null,
      channel,
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
      const checksumAsset = asset ? updatePolicy.selectChecksumAsset(assets, asset.name) : null;
      return {
        latestVersion,
        asset,
        checksumAsset: checksumAsset ? { name: checksumAsset.name, url: checksumAsset.browser_download_url } : null,
        channel: 'stable',
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

async function pathExists(filePath) {
  try {
    await fs.access(filePath, fsRaw.constants.F_OK);
    return true;
  } catch (_error) {
    return false;
  }
}

async function handleSavePromptBeforeExit(win) {
  let persistenceReady = false;
  try {
    persistenceReady = await win.webContents.executeJavaScript(
      `
      (() => {
        if (typeof window.__madcadPersistenceReady === 'function') return !!window.__madcadPersistenceReady();
        return false;
      })();
      `,
      true
    );
  } catch (_error) {
    persistenceReady = false;
  }

  if (!persistenceReady) {
    await dialog.showMessageBox(win, {
      type: 'info',
      buttons: [t('OK', 'OK')],
      defaultId: 0,
      title: t('Odzyskiwanie projektu', 'Project Recovery'),
      message: t('MadCAD nadal sprawdza autozapis.', 'MadCAD is still checking the autosave.'),
      detail: t('Poczekaj chwilę i zamknij aplikację ponownie, aby nie utracić odzyskiwanego projektu.', 'Wait a moment and close the application again to avoid losing a recoverable project.')
    });
    return false;
  }

  let hasUnsavedChanges = true;
  try {
    hasUnsavedChanges = await win.webContents.executeJavaScript(
      `
      (() => {
        if (typeof window.__madcadHasUnsavedChanges === 'function') return !!window.__madcadHasUnsavedChanges();
        return true;
      })();
      `,
      true
    );
  } catch (_error) {
    hasUnsavedChanges = true;
  }

  if (!hasUnsavedChanges) {
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
    message: t('Czy chcesz zapisać projekt przed wyjściem?', 'Do you want to save the project before exit?'),
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
      title: t('Zapisz projekt przed wyjściem', 'Save Project Before Exit'),
      defaultPath: path.join(app.getPath('documents'), appLanguage === 'en' ? 'project.madcad' : 'projekt.madcad'),
      filters: [{ name: 'Projekt MadCAD', extensions: ['madcad'] }, { name: 'JSON', extensions: ['json'] }],
      properties: ['createDirectory', 'showOverwriteConfirmation']
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return false;
    }

    try {
      await atomicWriteTextFile(saveResult.filePath, String(exportedText || ''), { backup: true });
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
  const initialBounds = normalizeWindowBounds(
    getSavedWindowBoundsSync(),
    screen.getAllDisplays().map((display) => ({ workArea: display.workArea, primary: display.id === screen.getPrimaryDisplay().id })),
    { width: 1680, height: 980 },
  );
  const win = new BrowserWindow({
    ...initialBounds,
    minWidth: Math.min(1200, initialBounds.width),
    minHeight: Math.min(760, initialBounds.height),
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
      sandbox: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
      webSecurity: true,
      allowRunningInsecureContent: false,
      additionalArguments: [`--madcad-lang=${appLanguage}`]
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(
      path.join(__dirname, '..', 'dist', 'index.html'),
      process.env.MADCAD_TEST_USER_DATA_DIR ? { query: { verify: '1' } } : undefined,
    );
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    const externalUrl = normalizeExternalUrl(url);
    if (externalUrl) void shell.openExternal(externalUrl);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    const currentUrl = win.webContents.getURL();
    const developmentOrigin = process.env.VITE_DEV_SERVER_URL ? new URL(process.env.VITE_DEV_SERVER_URL).origin : '';
    if (isTrustedAppNavigation(url, currentUrl, developmentOrigin)) return;
    event.preventDefault();
    const externalUrl = normalizeExternalUrl(url);
    if (externalUrl) void shell.openExternal(externalUrl);
  });

  if (!app.isPackaged && process.argv.includes('--devtools')) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  if (!isMac) {
    win.setMenuBarVisibility(false);
  }

  let windowBoundsSaveTimer = null;
  const scheduleWindowBoundsSave = () => {
    if (win.isDestroyed() || win.isMaximized() || win.isFullScreen()) return;
    if (windowBoundsSaveTimer) clearTimeout(windowBoundsSaveTimer);
    windowBoundsSaveTimer = setTimeout(() => {
      windowBoundsSaveTimer = null;
      void (async () => {
        const config = await readCadConfig();
        config.windowBounds = win.getNormalBounds();
        await writeCadConfig(config);
      })().catch(() => {});
    }, 400);
  };
  win.on('move', scheduleWindowBoundsSave);
  win.on('resize', scheduleWindowBoundsSave);
  win.on('closed', () => {
    if (windowBoundsSaveTimer) clearTimeout(windowBoundsSaveTimer);
  });

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
          label: t('Nowy projekt', 'New project'),
          accelerator: 'CmdOrCtrl+N',
          click: () => executeRendererShortcut({ id: 'newProjectBtn' })
        },
        {
          label: t('Otwórz projekt', 'Open project'),
          accelerator: 'CmdOrCtrl+O',
          click: () => executeRendererShortcut({ id: 'openProjectBtn' })
        },
        {
          label: t('Zapisz projekt', 'Save project'),
          accelerator: 'CmdOrCtrl+S',
          click: () => executeRendererShortcut({ id: 'saveProjectBtn' })
        },
        {
          label: t('Druk 3D', '3D Print'),
          accelerator: 'CmdOrCtrl+P',
          click: () => executeRendererShortcut({ id: 'printWorkspaceBtn' })
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
        { label: t('Cofnij', 'Undo'), accelerator: 'CmdOrCtrl+Z', click: () => executeRendererShortcut({ id: 'undoProjectBtn' }) },
        { label: t('Ponów', 'Redo'), accelerator: 'CmdOrCtrl+Shift+Z', click: () => executeRendererShortcut({ id: 'redoProjectBtn' }) },
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

function spawnDetached(executable, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

function storageErrorMessage(error, fallbackPl, fallbackEn) {
  if (error?.code === 'ENOSPC') return t('Brak wolnego miejsca na dysku. Ostatnia poprawna wersja pliku nie została zmieniona.', 'The disk is full. The last valid file version was not changed.');
  if (error?.code === 'EACCES' || error?.code === 'EPERM') return t('Brak uprawnień do zapisu w wybranym miejscu.', 'Permission denied for the selected location.');
  return error?.message ? String(error.message) : t(fallbackPl, fallbackEn);
}

async function openFilesInSlicer(slicer, definition, filePaths) {
  if (process.platform === 'darwin') {
    let lastError;
    for (const applicationName of definition.mac) {
      try {
        await execFileAsync('/usr/bin/open', ['-a', applicationName, ...filePaths]);
        return applicationName;
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(`${definition.label} nie jest zainstalowany albo macOS nie może go uruchomić. ${lastError?.message || ''}`.trim());
  }
  if (process.platform === 'win32') {
    for (const executable of windowsCandidates(slicer)) {
      if (!(await pathExists(executable))) continue;
      await spawnDetached(executable, filePaths);
      return executable;
    }
    throw new Error(`${definition.label} nie został znaleziony w standardowych katalogach Windows.`);
  }
  let lastError;
  for (const command of definition.linux) {
    try {
      await spawnDetached(command, filePaths);
      return command;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`${definition.label} nie jest dostępny w PATH. ${lastError?.message || ''}`.trim());
}

function trustedIpcSenderUrl(event) {
  try {
    return event?.senderFrame?.url || event?.sender?.getURL?.() || '';
  } catch (_error) {
    return '';
  }
}

function registerTrustedIpcHandler(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    const appEntryUrl = pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).toString();
    const developmentOrigin = process.env.VITE_DEV_SERVER_URL
      ? new URL(process.env.VITE_DEV_SERVER_URL).origin
      : '';
    if (!isTrustedIpcUrl(trustedIpcSenderUrl(event), appEntryUrl, developmentOrigin)) {
      const error = new Error(t('Odrzucono żądanie z niezaufanego widoku.', 'Request from an untrusted view was rejected.'));
      error.code = 'UNTRUSTED_IPC_SENDER';
      throw error;
    }
    return handler(event, ...args);
  });
}

registerTrustedIpcHandler('madcad:send-to-slicer', async (_event, payload) => {
  let filePaths = [];
  try {
    const normalized = normalizeSlicerPayload(payload);
    const root = path.join(app.getPath('temp'), 'madcad-slicer');
    await fs.mkdir(root, { recursive: true });
    const jobDirectory = await fs.mkdtemp(path.join(root, 'job-'));
    filePaths = await Promise.all(normalized.files.map(async (file, index) => {
      const filePath = path.join(jobDirectory, `${String(index + 1).padStart(2, '0')}-${file.name}`);
      await fs.writeFile(filePath, Buffer.from(file.bytes));
      return filePath;
    }));
    const launchedWith = await openFilesInSlicer(normalized.slicer, normalized.definition, filePaths);
    return { ok: true, slicer: normalized.slicer, launchedWith, filePaths };
  } catch (error) {
    if (filePaths[0]) shell.showItemInFolder(filePaths[0]);
    return { ok: false, filePaths, error: error?.message || String(error) };
  }
});

registerTrustedIpcHandler('madcad:import-dwg-sketch', async (event) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender) || null;
  let temporaryRoot = null;
  try {
    const selection = await dialog.showOpenDialog(senderWindow, {
      title: t('Importuj DWG do aktywnego szkicu', 'Import DWG into the active sketch'),
      buttonLabel: t('Importuj DWG', 'Import DWG'),
      filters: [{ name: 'AutoCAD DWG', extensions: ['dwg'] }],
      properties: ['openFile'],
    });
    if (selection.canceled || !selection.filePaths?.[0]) return { ok: false, canceled: true };
    const sourcePath = selection.filePaths[0];
    if (path.extname(sourcePath).toLowerCase() !== '.dwg') {
      throw new Error(t('Wybrany plik nie ma rozszerzenia DWG.', 'The selected file does not have a DWG extension.'));
    }

    let converter = await dwgConverter.resolveConverter({ savedPath: await readSavedDwgConverterPath() });
    if (!converter) {
      const setup = await dialog.showMessageBox(senderWindow, {
        type: 'info',
        title: t('Lokalny silnik DWG', 'Local DWG engine'),
        message: t('MadCAD potrzebuje lokalnego konwertera DWG.', 'MadCAD needs a local DWG converter.'),
        detail: t(
          'Możesz wskazać zainstalowany program dwg2dxf (GNU LibreDWG) albo ODA File Converter. Plik pozostaje na tym komputerze.',
          'Choose an installed dwg2dxf (GNU LibreDWG) or ODA File Converter. The file stays on this computer.'
        ),
        buttons: [t('Wskaż konwerter', 'Choose converter'), t('Pobierz ODA', 'Download ODA'), t('Anuluj', 'Cancel')],
        defaultId: 0,
        cancelId: 2,
        noLink: true,
      });
      if (setup.response === 0) {
        converter = await chooseDwgConverterPath(senderWindow);
        if (!converter) return { ok: false, canceled: true };
      } else if (setup.response === 1) {
        const trustedDownloadUrl = normalizeExternalUrl(DWG_CONVERTER_DOWNLOAD_URL);
        if (!trustedDownloadUrl) throw new Error(t('Nieprawidłowy adres pobierania konwertera.', 'Invalid converter download URL.'));
        await shell.openExternal(trustedDownloadUrl);
        return { ok: false, canceled: false, setupRequired: true, downloadOpened: true };
      } else {
        return { ok: false, canceled: true };
      }
    }

    temporaryRoot = await fs.mkdtemp(path.join(app.getPath('temp'), 'madcad-dwg-'));
    const text = await dwgConverter.convertDwgToDxf(converter, sourcePath, temporaryRoot);
    return {
      ok: true,
      canceled: false,
      fileName: path.basename(sourcePath),
      text,
      converter: converter.kind,
    };
  } catch (error) {
    return {
      ok: false,
      canceled: false,
      error: error?.message || t('Import DWG nie powiódł się.', 'DWG import failed.'),
    };
  } finally {
    if (temporaryRoot) await fs.rm(temporaryRoot, { recursive: true, force: true }).catch(() => {});
  }
});

registerTrustedIpcHandler('madcad:save-text-file', async (event, payload) => {
  try {
    const senderWindow = BrowserWindow.fromWebContents(event.sender) || null;
    const normalized = normalizeSaveTextPayload(payload, appLanguage);

    const result = await dialog.showSaveDialog(senderWindow, {
      title: t('Zapisz plik', 'Save file'),
      defaultPath: normalized.defaultName,
      filters: normalized.filters,
      properties: ['createDirectory', 'showOverwriteConfirmation']
    });

    if (result.canceled || !result.filePath) {
      return { ok: false, canceled: true };
    }

    const writeResult = normalized.atomic
      ? await atomicWriteTextFile(result.filePath, normalized.text, { backup: normalized.createBackup })
      : (await fs.writeFile(result.filePath, normalized.text, 'utf8'), { filePath: result.filePath, backupPath: null });
    return { ok: true, canceled: false, ...writeResult };
  } catch (error) {
    return {
      ok: false,
      canceled: false,
      error: storageErrorMessage(error, 'Nieznany błąd zapisu', 'Unknown save error')
    };
  }
});

registerTrustedIpcHandler('madcad:confirm-unsaved-changes', async (event, payload) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender) || null;
  const reason = ['new', 'open', 'update'].includes(payload?.reason) ? payload.reason : 'open';
  const action = reason === 'new'
    ? t('utworzeniem nowego projektu', 'creating a new project')
    : reason === 'update'
      ? t('zainstalowaniem aktualizacji', 'installing the update')
      : t('otwarciem innego projektu', 'opening another project');
  const response = await dialog.showMessageBox(senderWindow, {
    type: 'warning',
    buttons: [t('Zapisz', 'Save'), t('Odrzuć zmiany', 'Discard Changes'), t('Anuluj', 'Cancel')],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
    title: t('Niezapisane zmiany', 'Unsaved Changes'),
    message: t('Projekt zawiera niezapisane zmiany.', 'The project has unsaved changes.'),
    detail: t(`Zapisz zmiany przed ${action}?`, `Save changes before ${action}?`),
  });
  return { decision: response.response === 0 ? 'save' : response.response === 1 ? 'discard' : 'cancel' };
});

registerTrustedIpcHandler('madcad:check-for-updates', async () => {
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
    if (isWindowsStore) {
      return {
        ok: true,
        available: false,
        newerVersion: false,
        supported: true,
        managedByStore: true,
        installMode: 'store',
        currentVersion: normalizeVersionText(app.getVersion()),
        latestVersion: null,
        releaseUrl: '',
      };
    }
    const currentVersion = String(app.getVersion());
    const config = await readCadConfig();
    const channel = updatePolicy.normalizeChannel(config.updateChannel, currentVersion);
    const latest = await fetchLatestMadcadRelease(channel, currentVersion);
    const hasNewerVersion = updatePolicy.compareVersions(latest.latestVersion, currentVersion) > 0;
    const hasAssetForPlatform = Boolean(latest.asset && latest.asset.url && latest.checksumAsset?.url);
    return {
      ok: true,
      available: hasNewerVersion && hasAssetForPlatform,
      newerVersion: hasNewerVersion,
      supported: hasAssetForPlatform,
      installMode: isMac && TRUSTED_MAC_TEAM_ID ? 'automatic' : 'verified-package',
      currentVersion,
      channel,
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

registerTrustedIpcHandler('madcad:download-and-install-update', async (event) => {
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
    if (isWindowsStore) {
      return {
        ok: true,
        installing: false,
        managedByStore: true,
        upToDate: true,
        currentVersion: normalizeVersionText(app.getVersion()),
      };
    }

    const currentVersion = String(app.getVersion());
    const config = await readCadConfig();
    const channel = updatePolicy.normalizeChannel(config.updateChannel, currentVersion);
    const latest = await fetchLatestMadcadRelease(channel, currentVersion);
    if (!latest.asset?.url || !latest.checksumAsset?.url) {
        return {
          ok: false,
          installing: false,
          error: t(
            'Brak paczki aktualizacji dla tej platformy.',
            'No update package is available for this platform.'
          )
        };
    }
    const downloadUrl = String(latest.asset.url).trim();
    const assetName = String(latest.asset.name).trim();
    const latestVersion = latest.latestVersion;
    if (!updatePolicy.isTrustedUpdateUrl(downloadUrl) || !updatePolicy.isTrustedUpdateUrl(latest.checksumAsset.url)) {
      throw new Error(t('Źródło aktualizacji nie jest zaufane.', 'The update source is not trusted.'));
    }
    if (updatePolicy.compareVersions(latestVersion, currentVersion) <= 0) {
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
    const fallbackName = isWindows ? 'madcad-update.exe' : isMac ? 'madcad-update.zip' : 'madcad-update.AppImage';
    const fileBase = sanitizeFileName(assetName, fallbackName);
    const downloadedPath = path.join(updateDir, `${Date.now()}-${fileBase}`);
    await downloadFileWithRedirects(downloadUrl, downloadedPath);
    const checksumText = (await httpsGetBuffer(latest.checksumAsset.url)).toString('utf8');
    const expectedChecksum = updatePolicy.parseChecksumFile(checksumText, assetName);
    const downloadedBuffer = await fs.readFile(downloadedPath);
    if (!expectedChecksum || !updatePolicy.verifyBufferChecksum(downloadedBuffer, expectedChecksum)) {
      await fs.rm(downloadedPath, { force: true }).catch(() => {});
      throw new Error(t('Suma SHA-256 paczki aktualizacji jest nieprawidłowa.', 'The update package SHA-256 checksum is invalid.'));
    }

    let installerMeta = null;
    if (isMac && TRUSTED_MAC_TEAM_ID) {
      installerMeta = await scheduleMacZipInstall(downloadedPath);
    } else if (isMac || isWindows || process.platform === 'linux') {
      const packagePath = await moveVerifiedUpdateToDownloads(downloadedPath, assetName);
      const handoff = await openVerifiedUpdatePackage(packagePath);
      return {
        ok: true,
        installing: false,
        handoff: true,
        opened: handoff.opened,
        openError: handoff.openError || null,
        downloadedPath: packagePath,
        latestVersion: latestVersion || null,
        platform: process.platform
      };
    } else {
      await fs.rm(downloadedPath, { force: true }).catch(() => {});
      return {
        ok: false,
        installing: false,
        error: t('Ta platforma nie jest jeszcze obsługiwana przez aktualizator.', 'This platform is not supported by updater yet.')
      };
    }

    await event.sender.executeJavaScript(
      'window.__madcadClearRuntimeSession && window.__madcadClearRuntimeSession();',
      true
    );
    await clearAutoSaveSnapshot();
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
      'Nie udało się pobrać lub otworzyć aktualizacji.',
      'Failed to download or open the update.'
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

registerTrustedIpcHandler('madcad:autosave-write', async (_event, payload) => {
  try {
    const { text } = normalizeAutosavePayload(payload);
    const writeResult = await queueAutosaveOperation(async () => {
      const autoSavePath = getAutoSavePath();
      await fs.mkdir(path.dirname(autoSavePath), { recursive: true });
      return atomicWriteTextFile(autoSavePath, text, { backup: true });
    });
    return {
      ok: true,
      ...writeResult,
      savedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      ok: false,
      error: storageErrorMessage(error, 'Nie udało się zapisać autozapisu.', 'Autosave write failed.')
    };
  }
});

registerTrustedIpcHandler('madcad:autosave-read', async () => {
  try {
    const autoSavePath = getAutoSavePath();
    const recovered = await queueAutosaveOperation(() => readRecoverableTextFile(autoSavePath, { validate: validateJsonText }));
    if (!recovered.exists) return { ok: true, ...recovered };
    return {
      ok: true,
      ...recovered,
      warning: recovered.recovered ? t('Główny autozapis był uszkodzony. Odzyskano poprzednią wersję z kopii zapasowej.', 'The main autosave was corrupted. The previous version was recovered from backup.') : null,
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

registerTrustedIpcHandler('madcad:autosave-clear', async () => {
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

registerTrustedIpcHandler('madcad:open-print-preview', async (event, payload) => {
  try {
    const { html, title: windowTitle } = normalizePrintPreviewPayload(payload, appLanguage);

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
    await fs.writeFile(previewPath, securePrintPreviewHtml(html), 'utf8');
    previewWindow.on('closed', () => {
      void fs.unlink(previewPath).catch(() => {});
    });
    previewWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    previewWindow.webContents.on('will-navigate', (navigationEvent, url) => {
      if (url !== previewWindow.webContents.getURL()) navigationEvent.preventDefault();
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

registerTrustedIpcHandler('madcad:set-language', async (_event, payload) => {
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
