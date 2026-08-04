# MadCAD Desktop

![MadCAD Banner](./docs/readme-banner.png)

![Release](https://img.shields.io/github/v/release/kamil5646/MadCAD2D?display_name=tag&label=release)
![Platform](https://img.shields.io/badge/platform-macOS%20ARM64%20%7C%20Windows%20x64-1c7ed6)
![UI](https://img.shields.io/badge/interface-PL%20%2F%20EN-2f9e44)
[![Wsparcie projektu](https://img.shields.io/badge/Support-PayPal-00457C?logo=paypal&logoColor=white)](https://paypal.me/refek1)

MadCAD to desktopowa aplikacja CAD 2D/3D do projektowania technicznego, konstrukcji stalowych i modeli do druku 3D.

## Szybkie Linki
- Najnowszy release: https://github.com/kamil5646/MadCAD2D/releases/latest
- GitHub Pages: https://kamil5646.github.io/MadCAD2D/
- Dokumentacja aplikacji: [`madcad-2d/README.md`](./madcad-2d/README.md)
- Wsparcie projektu: https://paypal.me/refek1

## Wsparcie Projektu
Jeśli MadCAD pomaga Ci w codziennej pracy, możesz wesprzeć rozwój aplikacji:
- PayPal: https://paypal.me/refek1
- Każde wsparcie przyspiesza poprawki, nowe funkcje i kolejne wydania.

## PL
### Co to jest
MadCAD łączy szkice 2D, modelowanie 3D i gotowy workflow pod bramy, ogrodzenia, balkony oraz druk 3D.

### Najważniejsze możliwości
- Rysowanie: linia, polilinia, prostokąt, okrąg, pomiar, wymiarowanie.
- Wymiarowanie: tryby wyrównany, liniowy, obrócony i kątowy.
- Modyfikacje: przesuń, kopiuj, odsuń, duplikuj, warstwy, kolejność obiektów.
- Generator stali: szybkie szablony `brama`, `ogrodzenie`, `balkon`.
- Druk 3D: wyciąganie zamkniętych figur 2D, kontrola stołu drukarki i eksport `STL`.
- Eksport i wydruk: `JSON`, `DXF`, `SVG`, `PDF`.
- Aktualizacje aplikacji z poziomu interfejsu.

### Pobieranie
- Najnowsze wydanie (Assets): https://github.com/kamil5646/MadCAD2D/releases/latest
- Buildy: macOS (arm64), Windows (x64)

### Szybki Start (dev)
```bash
cd madcad-2d
npm install
npm run dev
```

### Build
```bash
cd madcad-2d
npm run dist:release:trusted
```

### Struktura repo
- `madcad-2d/` - główny kod aplikacji desktop (Electron + UI CAD).
- `docs/` - strona projektu na GitHub Pages.
- `cloudflare/license-registry-worker/` - backend API rejestru licencji (Cloudflare Worker + KV).
- katalog główny - pliki prawne i organizacyjne.

---

## EN
### What It Is
MadCAD is a desktop 2D/3D CAD app focused on technical design, steel structures, and 3D printing.

### Key Features
- Drawing tools: line, polyline, rectangle, circle, measure, dimension.
- Dimensioning modes: aligned, linear, rotated, angular.
- Editing: move, copy, offset, duplicate, layers, object order.
- Steel generator templates: `gate`, `fence`, `balcony`.
- 3D printing: extrude closed 2D shapes, check printer-bed fit, and export `STL`.
- Export and print: `JSON`, `DXF`, `SVG`, `PDF`.
- Built-in update flow from the app UI.

### Download
- Latest release (Assets): https://github.com/kamil5646/MadCAD2D/releases/latest
- Builds: macOS (arm64), Windows (x64)
- Support the project: https://paypal.me/refek1

### Support The Project
If MadCAD helps in your daily work, you can support further development:
- PayPal: https://paypal.me/refek1
- Every contribution helps ship fixes, new features, and future releases faster.

### Quick Start (dev)
```bash
cd madcad-2d
npm install
npm run dev
```

### Build
```bash
cd madcad-2d
npm run dist:release:trusted
```

### Repository Layout
- `madcad-2d/` - main desktop app code (Electron + CAD UI).
- `docs/` - project website hosted on GitHub Pages.
- `cloudflare/license-registry-worker/` - license registry backend API (Cloudflare Worker + KV).
- repository root - legal and project files.

## License
Projekt korzysta z licencji niestandardowej:
- [`LICENSE`](./LICENSE)
