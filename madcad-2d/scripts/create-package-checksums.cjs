'use strict';

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const releaseRoot = path.resolve(__dirname, '..', 'release');

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  }))).flat();
}

(async () => {
  const files = (await walk(releaseRoot)).filter((filePath) => {
    const name = path.basename(filePath);
    return name.startsWith('MadCAD-') && (name.endsWith('.zip') || name.endsWith('.exe') || name.endsWith('.AppImage'));
  });
  if (!files.length) throw new Error('Nie znaleziono paczek MadCAD do obliczenia SHA-256.');
  const reports = [];
  for (const filePath of files) {
    const data = await fs.readFile(filePath);
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    const sidecarPath = `${filePath}.sha256`;
    await fs.writeFile(sidecarPath, `${hash}  ${path.basename(filePath)}\n`, 'utf8');
    reports.push({ file: path.basename(filePath), sha256: hash });
  }
  process.stdout.write(`${JSON.stringify({ ok: true, packages: reports })}\n`);
})().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
