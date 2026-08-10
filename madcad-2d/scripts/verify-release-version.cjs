const path = require('node:path');

const packageJson = require(path.resolve(__dirname, '..', 'package.json'));
const tag = String(process.argv[2] || process.env.GITHUB_REF_NAME || '').trim();
const expectedTag = `v${packageJson.version}`;

if (!tag) {
  throw new Error('Brak tagu wydania. Przekaż go jako argument lub GITHUB_REF_NAME.');
}

if (tag !== expectedTag) {
  throw new Error(`Tag ${tag} nie zgadza się z wersją pakietu ${packageJson.version}; oczekiwano ${expectedTag}.`);
}

process.stdout.write(`Wersja wydania jest spójna: ${tag}.\n`);
