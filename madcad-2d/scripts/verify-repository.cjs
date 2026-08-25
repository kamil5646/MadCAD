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
if (packageJson.version !== '6.4.1') throw new Error(`Wersja stabilna musi wynosić 6.4.1, jest ${packageJson.version}.`);

const license = read('LICENSE');
const packagedLicense = read('madcad-2d/LICENSE');
if (packagedLicense !== license) throw new Error('Licencja w paczce nie jest identyczna z głównym plikiem LICENSE.');
expectText(license, /MadCAD Personal and Commercial License 3\.0/, 'nazwa licencji 3.0');
expectText(license, /40 kolejnych dni/, '40-dniowa ocena organizacji');
expectText(license, /bezterminowa dla zakupionej głównej wersji/, 'bezterminowa licencja komercyjna');
expectText(license, /jednym stanowisku\s+roboczym lub urządzeniu/, 'licencja na stanowisko');
expectText(license, /kkasprzak15@icloud\.com/, 'kontakt handlowy');

const site = read('docs/index.html');
expectText(site, /Oficjalne wydanie 6\.4/, 'stabilne wydanie na stronie');
expectText(site, /40 dni bezpłatnej oceny/, 'ocena komercyjna na stronie');
expectText(site, /licencja bezterminowa na stanowisko/, 'licencja stanowiskowa na stronie');
expectText(site, /mailto:kkasprzak15@icloud\.com/, 'zakup licencji na stronie');
expectText(site, /paczki 6\.4\.1 są publikowane bez podpisu producenta/, 'ostrzeżenie o niepodpisanym wydaniu 6.4.1');
expectText(site, /Linux · x64/, 'oficjalna paczka Linux na stronie');
expectText(site, /data-release-asset="windows-installer"/, 'bezpośredni instalator Windows na stronie');
expectText(site, /data-release-asset="windows-portable"/, 'przenośna paczka Windows na stronie');
expectText(site, /data-release-asset="mac-dmg"/, 'bezpośredni obraz DMG na stronie');
rejectText(site, /license-registry|issue-private|token-admin|generatePrivateToken/i, 'stary system tokenów na stronie');

const rootReadme = read('README.md');
expectText(rootReadme, /Uwaga o wydaniu 6\.4\.1/, 'ostrzeżenie wydania w README');
expectText(rootReadme, /Importuj DWG/, 'lokalny import DWG w README');
const firstPart = read('madcad-2d/FIRST_PART.md');
expectText(firstPart, /DWG jest konwertowany lokalnie/, 'lokalny przepływ DWG w samouczku');

const appUi = read('madcad-2d/src/modeling/ModelingWorkspace.jsx');
rejectText(appUi, /licenseTokenInput|licenseDeviceIdInput|licenseActivateTokenBtn/, 'kontrolki aktywacji w aplikacji');
expectText(appUi, /function readStoredLanguage\(\)[\s\S]*?catch \(_error\)/, 'bezpieczny odczyt języka bez Web Storage');
expectText(appUi, /autosaveSuspendedRef\.current[\s\S]*?setTimeout\(persistWhenReady, 100\)/, 'ponowienie autozapisu po wstrzymaniu');
expectText(appUi, /promptPending: silent && Boolean\(result\?\.available\)/, 'odroczony automatyczny dialog aktualizacji');
expectText(appUi, /if \(!persistenceReady\)[\s\S]*?zakończenie odzyskiwania autozapisu/, 'blokada destrukcyjnych akcji podczas odzyskiwania');
const appDialogs = read('madcad-2d/src/modeling/AppDialogs.jsx');
expectText(appDialogs, /oceniać pełną wersję przez 40 dni/, 'ocena w oknie aplikacji');
expectText(appDialogs, /bezterminowej licencji na każde stanowisko/, 'licencja stanowiskowa w aplikacji');
expectText(appDialogs, /fullLicenseText/, 'lokalna pełna licencja w aplikacji');
expectText(appDialogs, /Wydanie 6\.4\.1 nie ma podpisu producenta/, 'ostrzeżenie o podpisie w aplikacji');

const preload = read('madcad-2d/electron/preload.js');
const main = read('madcad-2d/electron/main.js');
rejectText(preload, /installOdaAddon|convertCadFile|getOdaStatus|chooseOdaConverterPath|openOdaDownload/, 'nieużywane API ODA w preload');
rejectText(main, /install-oda-addon|convert-cad-file|get-oda-status|choose-oda|open-oda/, 'wycofany automatyczny instalator i stare kanały ODA w procesie głównym');
expectText(main, /import-dwg-sketch/, 'zaufany kanał lokalnego importu DWG');
expectText(main, /__madcadPersistenceReady[\s\S]*?MadCAD nadal sprawdza autozapis/, 'blokada zamknięcia podczas odzyskiwania');
expectText(main, /NEW_TEAM[\s\S]*?TRUSTED_TEAM[\s\S]*?installed app belongs to a different signing team/, 'zaufany Team ID aktualizatora macOS');
expectText(main, /__madcadClearRuntimeSession[\s\S]*?clearAutoSaveSnapshot\(\)[\s\S]*?forceCloseForUpdate = true/, 'czyszczenie obu autozapisów przed aktualizacją');
expectText(main, /verifyBufferChecksum[\s\S]*?moveVerifiedUpdateToDownloads[\s\S]*?openVerifiedUpdatePackage/, 'zweryfikowane przekazanie niepodpisanej paczki aktualizacji');
expectText(main, /handoff:\s*true[\s\S]*?downloadedPath:\s*packagePath/, 'wynik przekazania paczki do instalatora systemu');

const notices = read('madcad-2d/THIRD_PARTY_NOTICES.md');
for (const dependency of Object.keys(packageJson.dependencies || {})) {
  if (!notices.includes(`\`${dependency}\``)) throw new Error(`Brak informacji o zależności ${dependency}.`);
}

const releaseWorkflow = read('.github/workflows/release.yml');
expectText(releaseWorkflow, /CSC_IDENTITY_AUTO_DISCOVERY:\s*'false'/, 'jawnie niepodpisany build wydania');
expectText(releaseWorkflow, /MADCAD_REQUIRE_SIGNATURE:\s*'0'/, 'wyłączony wymóg certyfikatu wydania');
expectText(releaseWorkflow, /Ważne — wydanie bez podpisu producenta/, 'ostrzeżenie w GitHub Release');
expectText(releaseWorkflow, /MADCAD_REQUIRE_CHECKSUM:\s*'1'/, 'obowiązkowa suma SHA-256 wydania');
expectText(releaseWorkflow, /electron-builder --linux AppImage --x64/, 'oficjalny build Linux AppImage');
expectText(releaseWorkflow, /electron-builder --win nsis zip --x64/, 'instalator i przenośna paczka Windows');
expectText(releaseWorkflow, /electron-builder --mac dmg zip --arm64/, 'obraz DMG i awaryjny ZIP dla macOS');
if (packageJson.build?.nsis?.oneClick !== true || packageJson.build?.nsis?.perMachine !== false || packageJson.build?.nsis?.allowElevation !== false) {
  throw new Error('Niepodpisany instalator Windows ma działać jednym kliknięciem, bez administratora.');
}
if (!Array.isArray(packageJson.build?.win?.target) || !packageJson.build.win.target.includes('zip')) {
  throw new Error('Brak przenośnej paczki ZIP dla Windows.');
}
if (!Array.isArray(packageJson.build?.mac?.target) || !packageJson.build.mac.target.includes('dmg')) {
  throw new Error('Brak łatwego obrazu DMG dla macOS.');
}

const codeqlWorkflow = read('.github/workflows/codeql.yml');
expectText(codeqlWorkflow, /github\/codeql-action\/analyze@[a-f0-9]{40}/, 'przypięta analiza CodeQL');

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
