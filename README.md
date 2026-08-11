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
- Parametryczne szkice 2D z więzami, wymiarami, edycją profili oraz importem `SVG` i `DXF`.
- Modelowanie bryłowe 3D, historia operacji, geometria konstrukcyjna i trwałe referencje B-Rep.
- Inspekcja geometrii, pomiar, właściwości masowe oraz analiza przekroju.
- Przygotowanie druku 3D z profilami drukarek, analizą drukowalności i kontrolą stołu.
- Import i eksport `STEP`, `STL`, `3MF`; zapis projektu parametrycznego `.madcad`.
- Aplikacja działa bez klucza, tokenu i aktywacji.
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
- `cloudflare/license-registry-worker/` - starsza, niezależna usługa rejestru; bieżąca aplikacja desktop jej nie używa.
- katalog główny - pliki prawne i organizacyjne.

---

## EN
### What It Is
MadCAD is a desktop 2D/3D CAD app focused on technical design, steel structures, and 3D printing.

### Key Features
- Parametric 2D sketches with constraints, dimensions, profile editing, and `SVG`/`DXF` import.
- 3D solid modeling with feature history, construction geometry, and persistent B-Rep references.
- Geometry inspection, measurement, mass properties, and section analysis.
- 3D-print preparation with printer profiles, printability checks, and bed-fit validation.
- `STEP`, `STL`, and `3MF` import/export plus parametric `.madcad` project files.
- No key, token, or activation is required.
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
- `cloudflare/license-registry-worker/` - legacy standalone registry service; the current desktop app does not use it.
- repository root - legal and project files.

## License
Projekt korzysta z licencji niestandardowej:
- [`LICENSE`](./LICENSE)
