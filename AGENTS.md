# MadCAD — playbook pracy nad repozytorium

Ten plik jest krótkim punktem startowym dla kolejnych prac. Bieżące priorytety
i otwarte kryteria odbioru znajdują się w `madcad-2d/ROADMAP.md`; dokument
`AUDIT-2026-09-20.md` jest migawką audytu z podanej daty.

Priorytet od 2026-09-27: najpierw pionowy przepływ podstawowego projektowania
jak w Fusion (szkic, wymiary, bryła, historia, Cofnij/Ponów, zapis i ponowne
otwarcie) oraz naprawa potwierdzonych różnic UX. Rozbudowa przygotowania
ścieżek CAM jest odłożona za ten przepływ. Użytkownik nie potrzebuje zarządzania
obrabiarką: automatyczne sondowanie/ustawianie jej zera i sterowanie maszyną są
poza celem. Nie osłabiaj istniejących blokad niebezpiecznego eksportu NC.

## Układ repozytorium

- `madcad-2d/src/cad-core/` — dokument, solver, historia, topologia, formaty i
  algorytmy niezależne od Reacta.
- `madcad-2d/src/cad-core/cad-worker.js` — adapter OpenCascade i ciężkie
  operacje B-Rep w workerze.
- `madcad-2d/src/modeling/` — React, ribbon, panele, dialogi i viewport.
- `madcad-2d/electron/` — pliki, recovery, licencja, aktualizacje i bezpieczne
  IPC desktopowe. `project-file-handlers.cjs` jest wspólną ścieżką produkcyjnego
  zapisu/otwarcia oraz krótkiego testu `verify-extrude-after-sketch.cjs`; test
  podmienia tylko systemowy wybór ścieżki i sprawdza także kopię `.bak`.
- `madcad-2d/scripts/desktop-verification-manifest.cjs` — źródło podziału 55
  scenariuszy Electron na siedem shardów; czasy i sposób sprawdzania opisuje
  `madcad-2d/docs/CI_DESKTOP_VERIFICATION.md`.
- `madcad-2d/scripts/verify-packaged-startup.cjs` — po zbudowaniu uruchamia
  rzeczywisty ZIP/DMG macOS i ZIP Windows Portable na izolowanym profilu;
  dla NSIS wykonuje cichą instalację w tymczasowym katalogu runnera, uruchamia
  zainstalowaną aplikację i odinstalowuje ją. Przez lokalny
  debugger potwierdza ekran licencji i brak hooków testowych; nie obchodzi
  logowania. Workflow wydania wymaga arm64 dla paczki macOS.
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
npm run verify:desktop-suite -- modeling-features
npm run verify:desktop-suite -- modeling-3d
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
- Nowy plik `scripts/verify-*.cjs` musi mieć jawną bramkę w
  `verify-product-completeness.cjs` (manifest desktopowy albo wyjątek dla
  pakietu) oraz odpowiadający mu krok CI/release; inaczej bramka jakości
  zatrzyma całą macierz przed testami desktopowymi.

## Znane pułapki

- Windowsowy scenariusz naprawy referencji został ustabilizowany w PR #69 przez
  atomowe wywołanie hooków helperem `invokeVerificationHook()`. Zachowaj ten
  wzorzec i dokładny opis etapu błędu. Po podmianie fixture nie wystarczy
  `engine.status === ready`: stary model może nadal spełniać ten warunek.
  Czekaj na identyfikator ostatniej operacji nowego dokumentu także w wyniku
  silnika, zanim utworzysz utraconą referencję. Odczyt panelu rób atomowo:
  Windows może go odmontować między `waitFor` i osobnym `executeJavaScript`.
- `ModelingWorkspace.jsx`, `ModelViewport.jsx` i `cad-worker.js` są monolitami;
  nie dodawaj do nich kolejnej domeny bez rozważenia wydzielenia modułu.
- Uchwyt CAM typu `body` wskazuje osobną bryłę po ID, a nie kopiuje geometrii do
  `.madcad`. `manufacturing-fixture-mesh.js` wymaga zamkniętej powierzchni i
  indeksuje jej trójkąty zachowawczo. Rzut trójkąta w XY odrzuca jednoznacznie
  oddalone przejazdy, a ograniczony podział pochyłych trójkątów zawęża ich
  lokalny zakres Z. Promień pionowy sprawdza wnętrze zamkniętej bryły dla
  końcówek narzędzia i przekrojów oprawki. Szew triangulacji nie blokuje
  punktu ponad wszystkimi trafionymi powierzchniami; inne niejednoznaczności
  pozostają kolizją. Regresja skośnej szczęki jest w `tests/cad-core.test.mjs`. Brak
  siatki lub niepewna kolizja blokuje eksport. Nie nazywaj tego dokładną
  symulacją oprawki ani pozycji startowej obrabiarki.
- Własne narzędzie CAM w schemacie v25 może być frezem palcowym, frezem do
  planowania, wiertłem, nawiertakiem albo gwintownikiem. Nieznany typ musi
  pozostać błędem walidacji projektu, a nie po cichu stać się wiertłem.
  Opcjonalny pierwszy stopień oprawki opisują:
  `holderNeckDiameter` i `holderNeckLength` nad wysięgiem `stickout`. Długość 0
  zachowuje model v23; bez dalszych stopni powyżej szyjki obowiązuje
  `holderDiameter` do góry bez skończonej granicy. Od schematu v26
  `holderStages` może zawierać do sześciu
  dalszych stopni `{ diameter, length }` po szyjce; nad ostatnim wciąż obowiązuje
  `holderDiameter`. Starsze projekty migrują z pustą listą. Nie utożsamiaj tego
  z pełną geometrią wrzeciona. Zmiany kontroli kolizji sprawdzaj przez
  `npm run verify:manufacturing`, `verify:cam-sequence` i `verify:cutting`.
- Nieznany typ operacji CAM nie może być normalizowany do planowania: zachowaj
  jego typ do walidacji projektu i zwracaj nieprawidłową ścieżkę, aby eksport NC
  był zablokowany. Dotyczy to także przyszłego `probe-wcs`, zanim powstaną jego
  pełna walidacja, bezpieczny eksport i weryfikacja sterowania.
- Nieznany jawnie zapisany kształt mocowania CAM zachowuje swoją wartość i
  blokuje walidację oraz eksport NC; tylko brak pola w starszym projekcie
  oznacza dawny prostopadłościan. Nie zmieniaj przyszłej geometrii po cichu.
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
- W trwającym celu zbliżenia do Fusion nie twórz tagu ani GitHub Release i nie
  aktualizuj strony produkcyjnej, dopóki otwarte wymagania produktu nie zostaną
  zaimplementowane i zweryfikowane; roboczy PR pozostaje szkicem.

## Definicja ukończonego wydania

1. Wersja i changelog są spójne.
2. `main` i tag wskazują oczekiwany commit.
3. CI oraz workflow release są zielone bez ręcznego retry.
4. Wszystkie paczki i sumy SHA-256 istnieją.
5. Instalator został sprawdzony na docelowym systemie.
6. Produkcyjna domena pokazuje tę samą wersję i działające linki.
7. Wynik, znane ograniczenia i niepodpisany status paczek są udokumentowane.
