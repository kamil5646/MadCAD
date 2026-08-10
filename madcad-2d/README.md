# MadCAD Desktop App

Aplikacja desktop CAD 2D (Electron) do projektowania technicznego i konstrukcji stalowych, z modułem druku 3D (eksport STL).

## Szybkie Linki
- Główny plan rozwoju: [`ROADMAP.md`](./ROADMAP.md)
- Samouczek pierwszej części i znane ograniczenia: [`FIRST_PART.md`](./FIRST_PART.md)
- Najnowszy release: https://github.com/kamil5646/MadCAD2D/releases/latest
- Strona projektu (GitHub Pages): https://kamil5646.github.io/MadCAD2D/
- README repo (główny): [`../README.md`](../README.md)
- Wsparcie projektu: https://paypal.me/refek1

## Wsparcie Projektu
MadCAD rozwija się aktywnie. Jeśli chcesz wesprzeć rozwój aplikacji:
- PayPal: https://paypal.me/refek1

## Co Jest W Aplikacji
- Wstążka z zakładkami: `Główne`, `Wymiarowanie`, `Stal`, `Widok`, `Warstwy`.
- Narzędzia CAD 2D: linia, polilinia, prostokąt, okrąg, pomiar oraz sterujące wymiary liniowe, kątowe, ordinate X/Y i długości łuku.
- Modyfikacje: przesuń, kopiuj, odsuń, duplikuj oraz szyki szkicu prostokątne, kołowe i po linii/łuku z pomijaniem wystąpień.
- Generator stali: szablony `brama`, `ogrodzenie`, `balkon`.
- Modeler 3D: szkice z więzami (w tym współliniowość, symetria i ciągłość krzywizny G2 łuków), historia parametryczna, podstawowe operacje bryłowe, otwory, inspekcja i przygotowanie druku.
- Geometria konstrukcyjna: płaszczyzny offset/midplane/3-punktowe/angle/tangent/path, osie z geometrii lub normalne do płaszczyzny oraz punkty na geometrii, przecięciu, środku i osi.
- Wyciągnięcie obsługuje jedną/dwie strony, symetrię, Through All i parametryczne odsunięcie początku.
- Import/eksport 3D: `STEP`, `STL`, `3MF`; projekt parametryczny: `.madcad`.
- Import szkicu: `SVG` i `DXF` z kontrolą jednostek oraz automatycznym wykrywaniem zamkniętych profili.
- Wbudowany samouczek „Pierwsza część do druku” z jawną listą ograniczeń wersji alpha.
- Aktualizacje z poziomu aplikacji.

## Język Interfejsu
- Przy pierwszym uruchomieniu aplikacja pyta o język (`PL` lub `EN`).
- Wybór jest zapamiętywany lokalnie i nie jest pytany ponownie.

## Licencja Aplikacji (stan bieżący)
- Aplikacja działa w modelu **przypomnienia licencyjnego**: pełna funkcjonalność jest dostępna bez blokady.
- Przy starcie wyświetla się nieblokujące okno przypomnienia o wsparciu projektu i opcjonalnej aktywacji tokenu.
- Mechanizm tokenów (`cad-engine.js`, rejestr w `cloudflare/license-registry-worker/`) pozostaje aktywny i może być
  używany dobrowolnie (np. do rozróżnienia licencji prywatnej/komercyjnej).

## Struktura Katalogu `madcad-2d/`
- `app.js` - logika UI i narzędzi CAD.
- `index.html` + `style.css` - interfejs aplikacji.
- `electron/` - proces main/preload i integracje desktop.
- `assets/` - ikony i zasoby.
- `scripts/` - narzędzia pomocnicze (np. notaryzacja).
- `release/` - artefakty buildów.

## Wymagania
- Node.js 18+.
- npm.
- macOS lub Windows.

## Uruchomienie Lokalnie (Dev)
```bash
cd madcad-2d
npm install
npm run dev
```

## Buildy
Wszystkie komendy uruchamiaj z `madcad-2d/`.

### macOS (dir)
```bash
npm run dist:mac
```

### Windows (NSIS)
```bash
npm run dist:win
```

### Build release trusted (macOS + Windows)
```bash
npm run dist:release:trusted
```

### Build wszystkich targetów z `dist`
```bash
npm run dist
```

## Podpisywanie I Notaryzacja
Dla wersji bez ostrzeżeń systemowych ustaw zmienne środowiskowe:

```bash
export APPLE_ID="twoj-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="TEAMID1234"

export CSC_LINK="/sciezka/do/certyfikatu.p12"
export CSC_KEY_PASSWORD="haslo_do_certyfikatu"
```

Następnie uruchom:
```bash
npm run dist:release:trusted
```

## Uwaga O Numerze Wersji
- Techniczna wersja builda jest pełnym semver, np. `6.0.0-alpha.1`, i wynika z `package.json`.
- Sufiks `alpha`/`beta` wybiera kanał aktualizacji; wersja bez sufiksu używa kanału stabilnego.

## Weryfikacja

```bash
npm run test:core
npm run verify:modeling
npm run verify:electron-security
```

Ostatnia komenda uruchamia prawdziwe okno główne i potwierdza sandbox, context isolation, preload oraz odrzucenie IPC z obcego dokumentu.

## ODA File Converter (DWG)
Jeśli import/eksport DWG nie działa, skonfiguruj ODA ręcznie:

1. Otwórz w aplikacji `Zapisz/Drukuj`.
2. Wejdź w opcję instalacji/konfiguracji DWG.
3. Wskaż plik `ODAFileConverter`, folder z ODA albo na macOS całą aplikację `ODA File Converter.app`.

Typowe ścieżki:
- macOS:
  - `/Applications/ODAFileConverter.app/Contents/MacOS/ODAFileConverter`
  - `/Applications/ODA File Converter.app/Contents/MacOS/ODAFileConverter`
- Windows:
  - `C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe`
  - `C:\Program Files (x86)\ODA\ODAFileConverter\ODAFileConverter.exe`
  - `C:\Program Files\ODA\ODA File Converter\ODAFileConverter.exe`
  - `C:\Program Files\Open Design Alliance\ODAFileConverter\ODAFileConverter.exe`

Strona ODA:
- https://www.opendesign.com/guestfiles/oda_file_converter

## Troubleshooting
### macOS - komunikat o uszkodzonej aplikacji
```bash
xattr -dr com.apple.quarantine "/Applications/MadCAD.app" && open -a "/Applications/MadCAD.app"
```

### Windows - blokada SmartScreen
Uruchom instalator jako administrator, a gdy trzeba wybierz `Więcej informacji` -> `Uruchom mimo to`.

## Skróty (Najczęściej Używane)
- `Z` zaznacz
- `L` linia
- `Y` polilinia
- `P` prostokąt
- `O` okrąg
- `M` pomiar
- `D` wymiar
- `F3` przyciąganie
- `F4` zwiń/rozwiń wstążkę
- `F6` ukryj/pokaż panele
- `F8` poziom/pion
- `G` siatka
- `Ctrl+Z` cofnij
- `Ctrl+Y` ponów
- `Ctrl+S` zapisz JSON
- `Ctrl+O` wczytaj JSON
- `Ctrl+P` druk/PDF

## Stack
- Electron
- HTML/CSS/JavaScript
- electron-builder

## Dokumenty Prawne
- [`LICENSE`](./LICENSE)
- [`EULA.md`](./EULA.md)
- [`PRIVACY.md`](./PRIVACY.md)
- [`COPYRIGHT.md`](./COPYRIGHT.md)
