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
npm run verify:sheet-metal-base
npm run verify:plastic-boss
npm run verify:plastic-snap-fit
npm run verify:plastic-grille
npm run verify:form
npm run verify:electron-security
npm audit --audit-level=high
```

`verify:modeling` uruchamia prawdziwe okno Electron i przechodzi pełny przepływ:
szkice, więzy, operacje bryłowe, historię, import/eksport, dostępność, licencję i
kontrolę responsywności.

Moduł `Plastic` zawiera mapy pochylenia i grubości ścian oraz parametryczny
Boss łączony z istniejącą bryłą, Snap-fit ze stopą, prześwitem pod
uginanym ramieniem i kontrolowanym zaczepem oraz Grille wycinające
parametryczne szczeliny wentylacyjne bez rozbijania bryły.

`Form` tworzy parametryczną klatkę prostopadłościanu, pozwala wybierać i
przeciągać jej widoczne punkty bezpośrednio w widoku, deformować je dokładnymi
przesunięciami XYZ albo manipulatorem osiowym, wiązać symetrią X/Y/Z oraz wybierać krawędzie klatki i
przełączać je między gładkimi a ostrymi `Crease`. Wynik jest wygładzany
algorytmem Catmulla–Clarka i kończy jako zamknięta fasetowa bryła B-Rep.

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
- Zaznaczenie importowanej siatki udostępnia **Narzędzia siatki** podzielone na `Naprawę` i `Obróbkę`: raport topologii, odwracalne czyszczenie, korektę kierunku ścian, limitowane wypełnianie małych otworów, redukcję, wygładzanie chroniące otwarte brzegi, jednorodny remesh i grupowanie ścian. Zamknięty, spójny STL do 2500 trójkątów można zamienić na prawdziwą fasetową bryłę B-Rep OpenCascade i przywrócić do siatki przez historię lub polecenie; program nie wypełnia dużych braków przekraczających jawną średnicę użytkownika.
- Modelowanie powierzchniowe obejmuje `Patch`, `Surface Extrude`, `Surface Revolve`, `Surface Sweep`, `Surface Loft`, `Surface Offset`, `Stitch`, `Surface Trim`, `Surface Extend` i `Thicken`; powierzchnie mają osobny folder, wygląd i bezpieczny przepływ do bryły.
- Osobne menu `Blacha` tworzy bazę z jednego zamkniętego profilu, parametryczne kołnierze z rzeczywistym promieniem, zawinięcia Hem 180° oraz kontrolowane szczeliny Rip na tej samej bryle B-Rep. `Rozwiń blachę` buduje ciągły wzór płaski z naddatkami promienia i K-factor, a `Zagnij ponownie` odzyskuje dokładną bryłę. Reguła zachowuje grubość, promień gięcia i współczynnik K; bryła jest oznaczona jako `BLACHA`, a wszystkie operacje współpracują z historią oraz Cofnij/Ponów bez utraty szkicu źródłowego. Arkusz 2D tworzy z tych danych skojarzoną tabelę gięć z kątem, promieniem, długością i naddatkiem BA, uwzględnianą w PDF/DXF.
- Menu **SPRAWDŹ → Analiza powierzchni** udostępnia pasy zebra, mapę krzywizny, grzebień krzywizny krawędzi, izolinie XYZ i diagnostykę ciągłości granic ścian. Tryby są wyłącznie widokowe i nie dopisują operacji do historii.
- Obszar **DOKUMENTACJA** tworzy zapisywane arkusze A4/A3, skojarzone widoki bazowe i rzutowane, przekroje A-A z kreskowaniem oraz powiększone detale. Widoki i ich wymiary, osie, znaczniki środka, opisy otworów/gwintów oraz tolerancje aktualizują się z modelem; tabliczka i rewizje są edytowalne, a gotowy arkusz można wyeksportować do PDF lub DXF.
- `Analiza geometrii` przełącza mapę pochylenia i mapę grubości ścian. Grubość jest mierzona między najbliższymi przeciwległymi powierzchniami planarnymi lub współosiowymi walcami, porównywana z celem i tolerancją oraz kolorowana bez zmiany modelu.
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
- [`docs/MESH_TOOLS_AUDIT_2026-09-01.md`](./docs/MESH_TOOLS_AUDIT_2026-09-01.md) — diagnostyka, obróbka, remesh i bezpieczna konwersja siatki do B-Rep.
- [`docs/SHEET_METAL_AUDIT_2026-09-01.md`](./docs/SHEET_METAL_AUDIT_2026-09-01.md) — kontrakt bazy blachowej, wynik B-Rep i dalsza kolejność modułu blach.
- [`docs/PLASTIC_AUDIT_2026-09-01.md`](./docs/PLASTIC_AUDIT_2026-09-01.md) — zakres modułu Plastic, ukończone analizy i kolejność operacji konstrukcyjnych.
- [`docs/FORM_AUDIT_2026-09-02.md`](./docs/FORM_AUDIT_2026-09-02.md) — klatka SubD, algorytm Catmulla–Clarka, konwersja B-Rep i dalsza kolejność modułu Form.
- [`CHANGELOG.md`](./CHANGELOG.md) — historia wydań.
- [`design-qa.md`](./design-qa.md) — kryteria jakości interfejsu.
