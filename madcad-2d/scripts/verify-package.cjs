const fs = require('fs/promises');
const path = require('path');

const releaseRoot = path.resolve(__dirname, '..', 'release');
const requestedKind = String(process.env.MADCAD_PACKAGE_KIND || process.argv[2] || '').toLowerCase();
const expected = requestedKind === 'windows'
  ? { extension: '.exe', signature: [0x4d, 0x5a], minimumBytes: 20 * 1024 * 1024 }
  : requestedKind === 'mac'
    ? { extension: '.zip', signature: [0x50, 0x4b], minimumBytes: 20 * 1024 * 1024 }
    : null;

if (!expected) throw new Error('Podaj rodzaj paczki: mac albo windows.');

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  }));
  return nested.flat();
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
    reports.push({ file: path.basename(filePath), bytes: stat.size, signature: [...signature] });
  }
  process.stdout.write(`${JSON.stringify({ ok: true, kind: requestedKind, packages: reports })}\n`);
})().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});

