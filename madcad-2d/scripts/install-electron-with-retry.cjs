const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const electronDirectory = path.dirname(require.resolve('electron/package.json'));
const installScript = path.join(electronDirectory, 'install.js');
const attempts = 4;

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  process.stdout.write(`Electron runtime check ${attempt}/${attempts}\n`);
  const check = spawnSync(process.execPath, ['-e', "require('electron')"], { stdio: 'inherit' });
  if (check.status === 0) process.exit(0);

  fs.rmSync(path.join(electronDirectory, 'dist'), { recursive: true, force: true });
  fs.rmSync(path.join(electronDirectory, 'path.txt'), { force: true });
  const install = spawnSync(process.execPath, [installScript], { stdio: 'inherit' });
  if (install.status === 0) {
    const verified = spawnSync(process.execPath, ['-e', "require('electron')"], { stdio: 'inherit' });
    if (verified.status === 0) process.exit(0);
  }

  if (attempt < attempts) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 3000);
}

process.stderr.write('Electron runtime installation failed after four attempts.\n');
process.exit(1);
