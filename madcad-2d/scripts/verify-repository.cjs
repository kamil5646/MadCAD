const fs = require('node:fs');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const expectText = (source, pattern, label) => {
  if (!pattern.test(source)) throw new Error(`Brak wymaganego tekstu: ${label}.`);
};
const rejectText = (source, pattern, label) => {
  if (pattern.test(source)) throw new Error(`Pozostał niedozwolony element: ${label}.`);
};

const packageJson = JSON.parse(read('madcad-2d/package.json'));
if (packageJson.version !== '6.1.0') throw new Error(`Wersja stabilna musi wynosić 6.1.0, jest ${packageJson.version}.`);

const license = read('LICENSE');
expectText(license, /MadCAD Personal and Commercial License 3\.0/, 'nazwa licencji 3.0');
expectText(license, /40 kolejnych dni/, '40-dniowa ocena organizacji');
expectText(license, /bezterminowa dla zakupionej głównej wersji/, 'bezterminowa licencja komercyjna');
expectText(license, /jednym stanowisku\s+roboczym lub urządzeniu/, 'licencja na stanowisko');
expectText(license, /kkasprzak15@icloud\.com/, 'kontakt handlowy');

const site = read('docs/index.html');
expectText(site, /Oficjalne wydanie 6\.1/, 'stabilne wydanie na stronie');
expectText(site, /40 dni bezpłatnej oceny/, 'ocena komercyjna na stronie');
expectText(site, /licencja bezterminowa na stanowisko/, 'licencja stanowiskowa na stronie');
expectText(site, /mailto:kkasprzak15@icloud\.com/, 'zakup licencji na stronie');
rejectText(site, /license-registry|issue-private|token-admin|generatePrivateToken/i, 'stary system tokenów na stronie');

const appUi = read('madcad-2d/src/modeling/ModelingWorkspace.jsx');
expectText(appUi, /oceniać pełną wersję przez 40 dni/, 'ocena w oknie aplikacji');
expectText(appUi, /bezterminowej licencji na każde stanowisko/, 'licencja stanowiskowa w aplikacji');
rejectText(appUi, /licenseTokenInput|licenseDeviceIdInput|licenseActivateTokenBtn/, 'kontrolki aktywacji w aplikacji');

for (const legacyPath of [
  'docs/admin/index.html',
  'docs/license-endpoints.json',
  'docs/license-registry.json',
  'cloudflare/license-registry-worker/package.json',
  'cloudflare/license-registry-worker/wrangler.toml',
]) {
  if (fs.existsSync(path.join(repoRoot, legacyPath))) throw new Error(`Stary plik licencyjny nadal istnieje: ${legacyPath}.`);
}

process.stdout.write('Repozytorium, strona, wersja i model licencji są spójne.\n');
