const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const electron = require('electron');
const manifest = require('./desktop-verification-manifest.cjs');

const appRoot = path.resolve(__dirname, '..');
const requested = process.argv.slice(2).filter((argument) => !argument.startsWith('--'));
const selected = requested.length && !requested.includes('all') ? requested : Object.keys(manifest);
const unknown = selected.filter((name) => !manifest[name]);
if (unknown.length) {
  process.stderr.write(`Nieznane części pakietu: ${unknown.join(', ')}. Dostępne: ${Object.keys(manifest).join(', ')}.\n`);
  process.exit(2);
}

const scripts = selected.flatMap((name) => manifest[name].map((script) => ({ shard: name, script })));
if (process.argv.includes('--list')) {
  process.stdout.write(`${scripts.map(({ shard, script }) => `${shard}\t${script}`).join('\n')}\n`);
  process.exit(0);
}

const childEnvironment = { ...process.env };
delete childEnvironment.ELECTRON_RUN_AS_NODE;
const startedAt = Date.now();
const completed = [];

for (const [index, entry] of scripts.entries()) {
  const absoluteScript = path.join(appRoot, entry.script);
  if (!fs.existsSync(absoluteScript)) {
    process.stderr.write(`Brak scenariusza ${entry.script}.\n`);
    process.exit(2);
  }
  const stepStartedAt = Date.now();
  process.stdout.write(`\n[desktop ${index + 1}/${scripts.length}] ${entry.shard}: ${entry.script}\n`);
  const result = spawnSync(electron, [absoluteScript], {
    cwd: appRoot,
    env: childEnvironment,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(`Pakiet desktopowy przerwany na ${entry.script} (kod ${result.status ?? 'brak'}).\n`);
    process.exit(result.status || 1);
  }
  completed.push({ script: entry.script, durationMs: Date.now() - stepStartedAt });
}

process.stdout.write(`\n${JSON.stringify({
  ok: true,
  platform: `${process.platform}-${process.arch}`,
  shards: selected,
  checks: completed.length,
  durationMs: Date.now() - startedAt,
  completed,
}, null, 2)}\n`);
