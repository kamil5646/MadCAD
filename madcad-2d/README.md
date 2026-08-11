# MadCAD Desktop — dokumentacja techniczna

Aktualna stabilna wersja: **6.1.0**.

MadCAD jest aplikacją Electron z interfejsem React, parametrycznym dokumentem
CAD i kernelem OpenCascade uruchamianym w workerze.

## Katalogi

- `src/modeling/` — aktualny interfejs modelowania i widok 2D/3D.
- `src/cad-core/` — dokument, szkicownik, solver, topologia, historia i eksporty.
- `electron/` — bezpieczna integracja desktopowa, zapis, aktualizacje i import DWG.
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
npm run verify:modeling
npm run verify:electron-security
npm audit --audit-level=high
```

`verify:modeling` uruchamia prawdziwe okno Electron i przechodzi pełny przepływ:
szkice, więzy, operacje bryłowe, historię, import/eksport, dostępność, licencję i
kontrolę responsywności.

## Budowanie

```bash
npm run dist:mac:trusted
npm run dist:win:trusted
```

Paczki trafiają do `release/`. Oficjalny workflow dodatkowo tworzy pliki
`.sha256`, sprawdza format paczki i weryfikuje podpis, jeśli certyfikat jest
skonfigurowany w sekretach repozytorium.

## Wersje i aktualizacje

- tag `v6.1.0` odpowiada wersji `6.1.0` w `package.json`;
- wersje bez sufiksu są publikowane w kanale stabilnym;
- `-beta.N` i `-alpha.N` pozostają obsługiwanymi kanałami testowymi;
- aktualizator przyjmuje wyłącznie zaufane adresy oficjalnego repozytorium.

## Interakcja CAD

- Funkcje wstążki pokazują po najechaniu opis i alias.
- Alias wpisuje się bezpośrednio, a `Enter` lub spacja uruchamia polecenie.
- Linia: `L`, klik początku, kierunek kursorem, długość, `Enter`.
- `Escape` anuluje alias lub aktywne polecenie; `Ctrl+Enter` kończy szkic.

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
- [`CHANGELOG.md`](./CHANGELOG.md) — historia wydań.
- [`design-qa.md`](./design-qa.md) — kryteria jakości interfejsu.
