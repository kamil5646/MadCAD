const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const releaseRoot = path.resolve(__dirname, '..', 'release');
const requestedKind = String(process.env.MADCAD_PACKAGE_KIND || process.argv[2] || '').toLowerCase();
const requireChecksum = process.env.MADCAD_REQUIRE_CHECKSUM === '1';
const requireSignature = process.env.MADCAD_REQUIRE_SIGNATURE === '1';
const expected = requestedKind === 'windows'
  ? { extension: '.exe', signature: [0x4d, 0x5a], minimumBytes: 20 * 1024 * 1024, nameIncludes: 'win' }
  : requestedKind === 'windows-portable'
    ? { extension: '.zip', signature: [0x50, 0x4b], minimumBytes: 20 * 1024 * 1024, nameIncludes: 'win' }
  : requestedKind === 'mac'
    ? { extension: '.zip', signature: [0x50, 0x4b], minimumBytes: 20 * 1024 * 1024, nameIncludes: 'mac' }
    : requestedKind === 'mac-dmg'
      ? { extension: '.dmg', trailerSignature: [0x6b, 0x6f, 0x6c, 0x79], trailerOffset: 512, minimumBytes: 20 * 1024 * 1024, nameIncludes: 'mac' }
    : requestedKind === 'linux'
      ? { extension: '.appimage', signature: [0x7f, 0x45, 0x4c, 0x46], minimumBytes: 20 * 1024 * 1024 }
      : null;

if (!expected) throw new Error('Podaj rodzaj paczki: mac, mac-dmg, windows, windows-portable albo linux.');

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
  const candidates = files.filter((filePath) => {
    const name = path.basename(filePath);
    const lower = name.toLowerCase();
    return lower.endsWith(expected.extension) && name.startsWith('MadCAD-') && (!expected.nameIncludes || lower.includes(expected.nameIncludes));
  });
  if (!candidates.length) throw new Error(`Nie znaleziono paczki ${expected.extension} w ${releaseRoot}.`);
  const reports = [];
  for (const filePath of candidates) {
    const stat = await fs.stat(filePath);
    const handle = await fs.open(filePath, 'r');
    const expectedSignature = expected.signature || expected.trailerSignature;
    const signature = Buffer.alloc(expectedSignature.length);
    try {
      const position = expected.trailerSignature ? stat.size - expected.trailerOffset : 0;
      await handle.read(signature, 0, signature.length, position);
    } finally {
      await handle.close();
    }
    if (stat.size < expected.minimumBytes) throw new Error(`${path.basename(filePath)} jest podejrzanie mały: ${stat.size} B.`);
    if (!expectedSignature.every((byte, index) => signature[index] === byte)) throw new Error(`${path.basename(filePath)} ma nieprawidłową sygnaturę pliku.`);
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
    reports.push({ file: path.basename(filePath), bytes: stat.size, signature: [...signature], sha256, checksumVerified, platformSignature });
  }
  process.stdout.write(`${JSON.stringify({ ok: true, kind: requestedKind, packages: reports })}\n`);
})().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
