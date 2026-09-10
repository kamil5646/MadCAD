const fs = require('node:fs');
const path = require('node:path');
const manifest = require('./desktop-verification-manifest.cjs');

const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
const ci = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8');
const release = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'release.yml'), 'utf8');
const roadmap = fs.readFileSync(path.join(appRoot, 'ROADMAP.md'), 'utf8');
const desktopVerificationSources = fs.readdirSync(path.join(appRoot, 'scripts'))
  .filter((name) => /^verify-.*\.cjs$/.test(name))
  .map((name) => fs.readFileSync(path.join(appRoot, 'scripts', name), 'utf8'))
  .join('\n');

const packagedDesktopChecks = new Set();
for (const command of Object.values(packageJson.scripts || {})) {
  const match = command.match(/(?:^|&&\s*)electron\s+(scripts\/verify-[^\s]+\.cjs)/);
  if (match) packagedDesktopChecks.add(match[1]);
}

const manifestEntries = Object.entries(manifest).flatMap(([shard, scripts]) => scripts.map((script) => ({ shard, script })));
const manifestScripts = manifestEntries.map(({ script }) => script);
const duplicates = manifestScripts.filter((script, index) => manifestScripts.indexOf(script) !== index);
if (duplicates.length) throw new Error(`Scenariusz desktopowy występuje w kilku częściach: ${[...new Set(duplicates)].join(', ')}.`);

const missingFromSuite = [...packagedDesktopChecks].filter((script) => !manifestScripts.includes(script));
const staleSuiteEntries = manifestScripts.filter((script) => !packagedDesktopChecks.has(script));
if (missingFromSuite.length) throw new Error(`Scenariusze poza pełną bramką desktopową: ${missingFromSuite.join(', ')}.`);
if (staleSuiteEntries.length) throw new Error(`Nieaktualne wpisy pełnej bramki desktopowej: ${staleSuiteEntries.join(', ')}.`);
for (const script of manifestScripts) {
  if (!fs.existsSync(path.join(appRoot, script))) throw new Error(`Brak pliku scenariusza desktopowego: ${script}.`);
}

const unregisteredFiles = fs.readdirSync(path.join(appRoot, 'scripts'))
  .filter((name) => /^verify-.*\.cjs$/.test(name) && !name.endsWith('-preload.cjs'))
  .map((name) => `scripts/${name}`)
  .filter((script) => !manifestScripts.includes(script))
  .filter((script) => ![
    'scripts/verify-package.cjs',
    'scripts/verify-release-version.cjs',
    'scripts/verify-repository.cjs',
    'scripts/verify-product-completeness.cjs',
  ].includes(script));
if (unregisteredFiles.length) throw new Error(`Pliki weryfikacji bez jawnej bramki: ${unregisteredFiles.join(', ')}.`);
if (/schemaVersion\s*(?:===|!==)\s*\d+/.test(desktopVerificationSources)) {
  throw new Error('Scenariusz desktopowy ma zakodowaną wersję schematu zamiast DOCUMENT_SCHEMA_VERSION.');
}

const expectedShardMatrix = `shard: [${Object.keys(manifest).join(', ')}]`;
if (!ci.includes(expectedShardMatrix)) throw new Error('CI nie uruchamia wszystkich części pełnej bramki desktopowej.');
if (!/npm run verify:desktop-suite -- \$\{\{ matrix\.shard \}\}/.test(ci)) throw new Error('CI nie uruchamia dzielonej pełnej bramki desktopowej.');
if (!ci.includes('npm run verify:solid-fea-benchmarks')) throw new Error('CI nie uruchamia benchmarków MES bryły 3D.');
if (!ci.includes('npm run test:license')) throw new Error('CI nie uruchamia testów klienta licencji.');
if (!release.includes('npm run verify:desktop-suite -- all')) throw new Error('Wydanie nie uruchamia pełnej bramki desktopowej.');
if (!release.includes('npm run verify:solid-fea-benchmarks')) throw new Error('Wydanie nie uruchamia benchmarków MES bryły 3D.');
if (!release.includes('npm run test:license')) throw new Error('Wydanie nie uruchamia testów klienta licencji.');

const activeItems = roadmap.match(/^- \[>\].+$/gm) || [];
if (activeItems.length !== 1) throw new Error(`Roadmapa musi mieć dokładnie jeden aktywny element, ma ${activeItems.length}.`);

process.stdout.write(`${JSON.stringify({
  ok: true,
  desktopChecks: manifestScripts.length,
  shards: Object.fromEntries(Object.entries(manifest).map(([name, scripts]) => [name, scripts.length])),
  activeRoadmapItem: activeItems[0],
}, null, 2)}\n`);
