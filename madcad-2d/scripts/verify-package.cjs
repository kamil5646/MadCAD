const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const unzipper = require('unzipper');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const releaseRoot = path.resolve(__dirname, '..', 'release');
const requestedKind = String(process.env.MADCAD_PACKAGE_KIND || process.argv[2] || '').toLowerCase();
const requireChecksum = process.env.MADCAD_REQUIRE_CHECKSUM === '1';
const requireSignature = process.env.MADCAD_REQUIRE_SIGNATURE === '1';
const expected = requestedKind === 'windows'
  ? { extension: '.exe', signature: [0x4d, 0x5a], minimumBytes: 20 * 1024 * 1024 }
  : requestedKind === 'windows-store'
    ? { extension: '.appx', signature: [0x50, 0x4b], minimumBytes: 20 * 1024 * 1024 }
  : requestedKind === 'mac'
    ? { extension: '.zip', signature: [0x50, 0x4b], minimumBytes: 20 * 1024 * 1024 }
    : requestedKind === 'linux'
      ? { extension: '.appimage', signature: [0x7f, 0x45, 0x4c, 0x46], minimumBytes: 20 * 1024 * 1024 }
      : null;

if (!expected) throw new Error('Podaj rodzaj paczki: mac, windows, windows-store albo linux.');

function xmlAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}=(['"])(.*?)\\1`, 'i'));
  return match ? match[2] : '';
}

async function verifyWindowsStoreManifest(filePath) {
  const archive = await unzipper.Open.file(filePath);
  const manifestEntry = archive.files.find((entry) => entry.path === 'AppxManifest.xml');
  if (!manifestEntry) throw new Error('Pakiet Store nie zawiera AppxManifest.xml.');
  const manifest = (await manifestEntry.buffer()).toString('utf8');
  const identityTag = manifest.match(/<Identity\b[^>]*\/>/i)?.[0] || '';
  const applicationTag = manifest.match(/<Application\b[^>]*>/i)?.[0] || '';
  const identityName = xmlAttribute(identityTag, 'Name');
  const publisher = xmlAttribute(identityTag, 'Publisher');
  const version = xmlAttribute(identityTag, 'Version');
  const architecture = xmlAttribute(identityTag, 'ProcessorArchitecture');
  const applicationId = xmlAttribute(applicationTag, 'Id');
  const entryPoint = xmlAttribute(applicationTag, 'EntryPoint');
  const languages = Array.from(manifest.matchAll(/<Resource\s+Language=(['"])(.*?)\1\s*\/>/gi), (match) => match[2]);

  if (!/^[A-Za-z0-9.-]{3,50}$/.test(identityName)) throw new Error(`Nieprawidłowe Identity.Name: ${identityName || '(brak)'}.`);
  if (!/^CN=.+/.test(publisher)) throw new Error(`Nieprawidłowy Publisher: ${publisher || '(brak)'}.`);
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(version)) throw new Error(`Nieprawidłowa wersja AppX: ${version || '(brak)'}.`);
  if (architecture !== 'x64') throw new Error(`Nieobsługiwana architektura Store: ${architecture || '(brak)'}.`);
  if (applicationId !== 'MadCAD') throw new Error(`Nieprawidłowe Application.Id: ${applicationId || '(brak)'}.`);
  if (entryPoint !== 'Windows.FullTrustApplication') throw new Error('Pakiet nie uruchamia pełnej aplikacji desktopowej.');
  if (!/<rescap:Capability\s+Name=(['"])runFullTrust\1\s*\/>/i.test(manifest)) {
    throw new Error('Pakiet Electron nie deklaruje wymaganego runFullTrust.');
  }
  for (const forbiddenCapability of ['webcam', 'location', 'privateNetworkClientServer', 'documentsLibrary']) {
    if (new RegExp(`Capability\\s+Name=(['"])${forbiddenCapability}\\1`, 'i').test(manifest)) {
      throw new Error(`Pakiet deklaruje zbędne uprawnienie: ${forbiddenCapability}.`);
    }
  }
  for (const requiredLanguage of ['pl-PL', 'en-US']) {
    if (!languages.includes(requiredLanguage)) throw new Error(`Pakiet nie deklaruje języka ${requiredLanguage}.`);
  }
  if (process.env.MADCAD_REQUIRE_STORE_IDENTITY === '1' && (identityName === 'MadCAD2D.StoreTest' || publisher === 'CN=ms')) {
    throw new Error('Paczka do wysłania nadal używa testowej tożsamości Microsoft Store.');
  }
  return { identityName, publisher, version, architecture, applicationId, languages };
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  }));
  return nested.flat();
}

async function verifyPlatformSignature(filePath) {
  if (requestedKind === 'linux') return 'appimage-elf-valid';
  if (requestedKind === 'windows') {
    const command = `$signature = Get-AuthenticodeSignature -LiteralPath '${filePath.replace(/'/g, "''")}'; if ($signature.Status -ne 'Valid') { throw "Invalid Authenticode status: $($signature.Status)" }`;
    await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { timeout: 120000 });
    return 'authenticode-valid';
  }
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'madcad-signature-'));
  try {
    await execFileAsync('/usr/bin/ditto', ['-x', '-k', filePath, tempDirectory], { timeout: 120000 });
    const extracted = await walk(tempDirectory);
    const appExecutable = extracted.find((entry) => entry.includes('.app/Contents/MacOS/'));
    if (!appExecutable) throw new Error('Archiwum nie zawiera podpisanej aplikacji .app.');
    const appIndex = appExecutable.indexOf('.app/') + 4;
    const appPath = appExecutable.slice(0, appIndex);
    await execFileAsync('/usr/bin/codesign', ['--verify', '--deep', '--strict', appPath], { timeout: 120000 });
    return 'codesign-valid';
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}

(async () => {
  const files = await walk(releaseRoot);
  const candidates = files.filter((filePath) => filePath.toLowerCase().endsWith(expected.extension) && path.basename(filePath).startsWith('MadCAD-'));
  if (!candidates.length) throw new Error(`Nie znaleziono paczki ${expected.extension} w ${releaseRoot}.`);
  const reports = [];
  for (const filePath of candidates) {
    const stat = await fs.stat(filePath);
    const handle = await fs.open(filePath, 'r');
    const signature = Buffer.alloc(expected.signature.length);
    try {
      await handle.read(signature, 0, signature.length, 0);
    } finally {
      await handle.close();
    }
    if (stat.size < expected.minimumBytes) throw new Error(`${path.basename(filePath)} jest podejrzanie mały: ${stat.size} B.`);
    if (!expected.signature.every((byte, index) => signature[index] === byte)) throw new Error(`${path.basename(filePath)} ma nieprawidłową sygnaturę pliku.`);
    const data = await fs.readFile(filePath);
    const sha256 = crypto.createHash('sha256').update(data).digest('hex');
    const checksumPath = `${filePath}.sha256`;
    let checksumVerified = false;
    try {
      const checksumText = await fs.readFile(checksumPath, 'utf8');
      const match = checksumText.trim().match(/^([a-f0-9]{64})\s+[*]?(.+)$/i);
      checksumVerified = Boolean(match && match[1].toLowerCase() === sha256 && match[2].trim() === path.basename(filePath));
    } catch (_error) {}
    if (requireChecksum && !checksumVerified) throw new Error(`${path.basename(filePath)} nie ma poprawnej sumy SHA-256.`);
    const platformSignature = requireSignature ? await verifyPlatformSignature(filePath) : 'not-required';
    const storeManifest = requestedKind === 'windows-store' ? await verifyWindowsStoreManifest(filePath) : null;
    reports.push({ file: path.basename(filePath), bytes: stat.size, signature: [...signature], sha256, checksumVerified, platformSignature, ...(storeManifest ? { storeManifest } : {}) });
  }
  process.stdout.write(`${JSON.stringify({ ok: true, kind: requestedKind, packages: reports })}\n`);
})().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
