# MadCAD Desktop — dokumentacja techniczna

Aktualna stabilna wersja: **6.4.6**.

MadCAD jest aplikacją Electron z interfejsem React, parametrycznym dokumentem
CAD i kernelem OpenCascade uruchamianym w workerze. Główny przepływ zaczyna się
od precyzyjnego rysunku 2D, a następnie przechodzi do modelu powierzchniowego lub bryłowego z historią.
Przygotowanie do druku 3D jest opcjonalnym dodatkiem w obszarze eksportu.

## Katalogi

- `src/modeling/` — aktualny interfejs modelowania i widok 2D/3D.
- `src/cad-core/` — dokument, szkicownik, solver, topologia, historia i eksporty.
- `electron/` — bezpieczna integracja desktopowa, zapis, odzyskiwanie i aktualizacje.
- `scripts/` — test pełnego interfejsu, kontrola pakietów i sum SHA-256.
- `tests/` — testy rdzenia CAD i polityk procesu desktopowego.
- `assets/` — ikony aplikacji.

## Uruchomienie

Wymagany jest Node.js 22.

```bash
npm ci
npm run dev
```

## Kontrole jakości

```bash
npm run lint
npm test
npm run test:core
npm run test:core:coverage
npm run verify:repository
npm run verify:start-experience
npm run verify:drawing-workspace
npm run verify:modeling
npm run verify:surface-modeling
npm run verify:electron-security
npm audit --audit-level=high
```

`verify:modeling` uruchamia prawdziwe okno Electron i przechodzi pełny przepływ:
szkice, więzy, operacje bryłowe, historię, import/eksport, dostępność, licencję i
kontrolę responsywności.

## Budowanie

```bash
npm run dist:mac:unsigned
npm run dist:mac:dmg
npm run dist:win:unsigned
npm run dist:win:portable
npm run dist:linux:trusted
```

Paczki trafiają do `release/`. Oficjalny workflow tworzy pliki `.sha256`,
sprawdza format paczki i wykonuje testy na Windows, macOS oraz Linux.

> Instalatory `v6.4.6` nie mają podpisu producenta. Windows SmartScreen lub
> macOS Gatekeeper mogą pokazać ostrzeżenie. Pobieraj paczki wyłącznie z
> oficjalnego GitHub Release i porównaj dołączoną sumę SHA-256. Aktualizacja tej
> wersji pobiera paczkę z oficjalnego wydania, sprawdza
> sumę SHA-256 i otwiera ją do dokończenia instalacji w systemie.

Windows otrzymuje dwa warianty: instalator jednym kliknięciem działający na
koncie użytkownika bez uprawnień administratora oraz przenośną paczkę ZIP,
która nie wymaga instalacji.

macOS otrzymuje polecany obraz DMG z przeciągnięciem MadCAD do Aplikacji oraz
awaryjną paczkę ZIP. Przy pierwszym uruchomieniu niepodpisanej aplikacji należy
użyć `Control` + klik i wybrać **Otwórz**.

## Wersje i aktualizacje

- tag `v6.4.6` odpowiada wersji `6.4.6` w `package.json`;
- wersje bez sufiksu są publikowane w kanale stabilnym;
- `-beta.N` i `-alpha.N` pozostają obsługiwanymi kanałami testowymi;
- aktualizator przyjmuje wyłącznie zaufane adresy oficjalnego repozytorium.
- paczka nie jest uruchamiana, jeśli adres pobrania jest niezaufany albo plik
  nie zgadza się z opublikowaną sumą SHA-256;
- bez certyfikatu systemowego MadCAD przekazuje zweryfikowaną paczkę do
  instalatora systemu zamiast wykonywać cichą podmianę aplikacji.

## Interakcja CAD

- Nawigacja CAD: naciśnięte kółko myszy przesuwa widok, przeciągnięcie prawym przyciskiem lub `Shift` + kółko obraca model 3D, rolka przybliża pod kursorem, a lewy przycisk zaznacza i rysuje. Aktywny szkic 2D pozostaje zablokowany prostopadle do swojej płaszczyzny; dostępne są w nim pan, zoom i dopasowanie widoku.
- Import STEP/STL/3MF jest dostępny w menu **Plik**; poprawny model zostaje dopasowany do widoku, a błędny import jest opisany i bezpiecznie usunięty z historii.
- Zaznaczenie importowanej siatki udostępnia **Narzędzia siatki** z raportem topologii i odwracalnym bezpiecznym czyszczeniem. Operacja nie wypełnia otworów i nie rekonstruuje brakujących fragmentów bez decyzji użytkownika.
- Modelowanie powierzchniowe obejmuje `Patch`, `Surface Extrude`, `Surface Revolve`, `Surface Sweep`, `Surface Loft`, `Surface Offset`, `Stitch`, `Surface Trim`, `Surface Extend` i `Thicken`; powierzchnie mają osobny folder, wygląd i bezpieczny przepływ do bryły.
- Menu **SPRAWDŹ → Analiza powierzchni** udostępnia pasy zebra, mapę krzywizny, grzebień krzywizny krawędzi, izolinie XYZ i diagnostykę ciągłości granic ścian. Tryby są wyłącznie widokowe i nie dopisują operacji do historii.
- Obszar **DOKUMENTACJA** tworzy zapisywane arkusze A4/A3, skojarzone widoki bazowe i rzutowane, przekroje A-A z kreskowaniem oraz powiększone detale. Widoki i ich wymiary, osie, znaczniki środka, opisy otworów/gwintów oraz tolerancje aktualizują się z modelem; tabliczka i rewizje są edytowalne, a gotowy arkusz można wyeksportować do PDF lub DXF.
- Funkcje wstążki pokazują po najechaniu opis; skróty podstawowych narzędzi są widoczne tylko w podpowiedzi, nie na przyciskach.
- **Import DWG** w aktywnym szkicu otwiera plik przez bezpieczny dialog desktopowy, konwertuje go lokalnie przez `dwgread`/`dwg2dxf` (GNU LibreDWG) albo ODA File Converter i przekazuje wynik do istniejącego importera DXF. Projekt nie jest wysyłany do usługi sieciowej.
- Podstawowe skróty uruchamiają narzędzie natychmiast, bez osobnego wiersza poleceń.
- Układ podstawowych klawiszy jest zgodny z Autodesk Fusion: `L`, `R`, `C`, `T`, `O`, `P`, `M`, `I`, `E` i `Del`.
- Przeglądarka projektu startuje zwinięta; pierwszy przycisk górnego paska rozwija ją w razie potrzeby.
- Linia: `L`, klik początku, kierunek kursorem, długość, `Enter`.
- `Escape` anuluje aktywne narzędzie; `Ctrl+Enter` kończy szkic.

## Licencja

Aplikacja nie zawiera systemu kluczy, identyfikatora urządzenia ani zdalnego
rejestru licencji. Przy każdym uruchomieniu pokazuje informacyjne warunki:

- prywatnie bezpłatnie bez limitu czasu;
- 40 dni oceny dla firmy lub organizacji;
- później płatna, bezterminowa licencja na każde stanowisko komercyjne.

Pełne warunki: [`../LICENSE`](../LICENSE). Kontakt handlowy:
[kkasprzak15@icloud.com](mailto:kkasprzak15@icloud.com?subject=MadCAD%20-%20licencja%20komercyjna).

## Dokumentacja dodatkowa

- [`FIRST_PART.md`](./FIRST_PART.md) — przejście od szkicu do pierwszej części.
- [`ROADMAP.md`](./ROADMAP.md) — stan funkcji i dalszy kierunek.
- [`docs/HOLE_STANDARDS.md`](./docs/HOLE_STANDARDS.md) — zakres otworów ISO, źródła danych i granice zgodności.
- [`docs/SURFACE_MODELING_AUDIT_2026-08-31.md`](./docs/SURFACE_MODELING_AUDIT_2026-08-31.md) — przepływ Patch/Surface Extrude/Thicken i wyniki testów B-Rep.
- [`CHANGELOG.md`](./CHANGELOG.md) — historia wydań.
- [`design-qa.md`](./design-qa.md) — kryteria jakości interfejsu.
