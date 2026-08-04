# MadCAD 2D Desktop App

Aplikacja desktop CAD 2D (Electron) do projektowania technicznego i konstrukcji stalowych.

## Szybkie Linki
- Najnowszy release: https://github.com/kamil5646/MadCAD2D/releases/latest
- Strona projektu (GitHub Pages): https://kamil5646.github.io/MadCAD2D/
- README repo (główny): [`../README.md`](../README.md)
- Wsparcie projektu: https://paypal.me/refek1

## Wsparcie Projektu
MadCAD 2D rozwija się aktywnie. Jeśli chcesz wesprzeć rozwój aplikacji:
- PayPal: https://paypal.me/refek1

## Co Jest W Aplikacji
- Wstążka z zakładkami: `Główne`, `Wymiarowanie`, `Stal`, `Widok`, `Warstwy`.
- Narzędzia CAD 2D: linia, polilinia, prostokąt, okrąg, pomiar, wymiarowanie.
- Modyfikacje: przesuń, kopiuj, odsuń, duplikuj, usuwanie, kolejność obiektów.
- Generator stali: szablony `brama`, `ogrodzenie`, `balkon`.
- Moduł druku 3D: dodatkowy widok projektu, wyciąganie prostokątów, okręgów i zamkniętych obszarów oraz eksport STL.
- Import/eksport: `JSON`, `DXF`, `SVG`, druk/PDF.
- Aktualizacje z poziomu aplikacji.

## Język Interfejsu
- Przy pierwszym uruchomieniu aplikacja pyta o język (`PL` lub `EN`).
- Wybór jest zapamiętywany lokalnie i nie jest pytany ponownie.

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
- Techniczna wersja builda jest semver (`5.2.0`) i wynika z `package.json`.
- W komunikacji/release używana jest skrócona forma (`5.2`).

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
xattr -dr com.apple.quarantine "/Applications/MadCAD 2D.app" && open -a "/Applications/MadCAD 2D.app"
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
