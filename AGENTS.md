# MadCAD — playbook pracy nad repozytorium

Ten plik jest krótkim punktem startowym dla kolejnych prac. Szczegółowy stan i
priorytety znajdują się w `AUDIT-2026-09-20.md`.

## Układ repozytorium

- `madcad-2d/src/cad-core/` — dokument, solver, historia, topologia, formaty i
  algorytmy niezależne od Reacta.
- `madcad-2d/src/cad-core/cad-worker.js` — adapter OpenCascade i ciężkie
  operacje B-Rep w workerze.
- `madcad-2d/src/modeling/` — React, ribbon, panele, dialogi i viewport.
- `madcad-2d/electron/` — pliki, recovery, licencja, aktualizacje i bezpieczne
  IPC desktopowe.
- `madcad-2d/scripts/desktop-verification-manifest.cjs` — źródło podziału 52
  scenariuszy Electron na shardy.
- `.github/workflows/ci.yml` i `release.yml` — obowiązujące bramki CI/release.
- `docs/` — strona GitHub Pages; domena produkcyjna ma osobny deployment.
- `docs/DEPLOYMENT.md` — bezpieczna procedura publikacji i kontroli produkcji.

## Komendy bazowe

Pracuj z `madcad-2d` na Node.js 22:

```bash
npm ci
npm run lint
npm test -- --run
npm run test:core:coverage
npm run build:ui
npm run verify:repository
npm run verify:product-completeness
```

Nie uruchamiaj wszystkich ciężkich scenariuszy bez potrzeby. Wybierz skrypt
`verify:*` odpowiadający zmienianej domenie, a pełny shard uruchom przed PR-em:

```bash
npm run verify:desktop-suite -- modeling
npm run verify:desktop-suite -- interoperability
npm run verify:desktop-suite -- interface
npm run verify:desktop-suite -- project
npm run verify:desktop-suite -- analysis
```

## Niezmienne projektowe

- Operacja kernela jest transakcyjna i po błędzie zachowuje ostatni poprawny
  model.
- Referencje B-Rep nie mogą zależeć od indeksów pojedynczej tessellacji.
- Zmiana schematu `.madcad` wymaga migracji, fixture starego dokumentu i testu
  round-trip.
- Nowa funkcja jest gotowa dopiero po błędzie, anulowaniu, undo/redo,
  zapisie/otwarciu i właściwym teście Electron.
- `pipeShape` ma używać dwóch sweepów (zewnętrzny i wewnętrzny) oraz
  `outside.cut(inside)`. Sweep profilu pierścieniowego wcześniej psuł geometrię.
- Ciężkie etapy dokładnego szkicu 3D/Pipe/Project to Surface na Windows używają
  wspólnego limitu 300000 ms, ale nadal muszą potwierdzać wynik geometrii.
- Nie traktuj tagu ani uploadu jako ukończonego wydania: sprawdź workflow,
  artefakty i produkcyjną stronę.

## Znane pułapki

- Windowsowy scenariusz naprawy referencji został ustabilizowany w PR #69 przez
  atomowe wywołanie hooków helperem `invokeVerificationHook()`. Zachowaj ten
  wzorzec i dokładny opis etapu błędu.
- `ModelingWorkspace.jsx`, `ModelViewport.jsx` i `cad-worker.js` są monolitami;
  nie dodawaj do nich kolejnej domeny bez rozważenia wydzielenia modułu.
- PR podnoszący `replicad-opencascadejs` do 1.x jest migracją kernela, nie
  zwykłym bumpem zależności.
- Konto MadCAD i okresowe sprawdzenie uprawnienia są wymagane; nie opisuj tego
  jako klucza produktu ani wysyłania projektów. Licencja, README, prywatność,
  strona i interfejs muszą pozostać zgodne.
- `https://madcad.madmagsystem.pl/` może być starsze niż `docs/` w repo;
  weryfikuj domenę po każdym wdrożeniu.
- Komunikat `.zshenv` o brakującym `.cargo/env` jest szumem środowiska, nie
  błędem MadCAD.

## Zasady zmian

- Najpierw odtwórz problem i zapisz dowód, potem zmieniaj kod.
- Nie zwiększaj timeoutu bez wskazania rzeczywiście wolnego etapu.
- Duże zależności aktualizuj pojedynczo i porównuj B-Rep, topologię, wolumen,
  import/export oraz zachowanie zapisanych projektów.
- Nie aktualizuj ręcznie numeru wersji w wielu plikach. Docelowo generuj go z
  `package.json` i latest release.
- Nie dodawaj nowej funkcji do roadmapy bez jednego aktywnego pionowego celu i
  mierzalnych kryteriów odbioru.

## Definicja ukończonego wydania

1. Wersja i changelog są spójne.
2. `main` i tag wskazują oczekiwany commit.
3. CI oraz workflow release są zielone bez ręcznego retry.
4. Wszystkie paczki i sumy SHA-256 istnieją.
5. Instalator został sprawdzony na docelowym systemie.
6. Produkcyjna domena pokazuje tę samą wersję i działające linki.
7. Wynik, znane ograniczenia i niepodpisany status paczek są udokumentowane.
