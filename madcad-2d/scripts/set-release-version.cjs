const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const next = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(next || '')) throw new Error('Podaj stabilną wersję, np. 6.5.29.');
const files = [
  'package.json', 'package-lock.json', 'README.md', 'FIRST_PART.md',
  'src/App.test.jsx', 'src/modeling/AppDialogs.jsx',
  'server/seohost/madcad-site/index.html', '../README.md', '../docs/index.html',
  '../.github/workflows/release.yml',
];
// Only current product metadata: historical changelogs and audit evidence stay intact.
const updates = files.map((file) => {
  const target = path.resolve(root, file);
  const original = fs.readFileSync(target, 'utf8');
  if (!original.includes(pkg.version)) throw new Error(`Brak bieżącej wersji w ${file}.`);
  // The lockfile also holds dependency ranges such as "^7.0.0": change only the project's own version.
  if (file === 'package-lock.json') {
    const lock = JSON.parse(original);
    lock.version = next;
    lock.packages[''].version = next;
    return [target, `${JSON.stringify(lock, null, 2)}\n`];
  }
  if (file === 'package.json') return [target, original.replace(`"version": "${pkg.version}"`, `"version": "${next}"`)];
  return [target, original.replaceAll(pkg.version, next)];
});
for (const [target, content] of updates) fs.writeFileSync(target, content);
console.log(`Wersja ${pkg.version} → ${next}; zaktualizowano ${updates.length} plików.`);
