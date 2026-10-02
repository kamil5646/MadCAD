# MadCAD — playbook pracy nad repozytorium

Ten plik jest krótkim punktem startowym dla kolejnych prac. Bieżące priorytety
i otwarte kryteria odbioru znajdują się w `madcad-2d/ROADMAP.md`; dokument
`AUDIT-2026-09-20.md` jest migawką audytu z podanej daty.

Priorytet od 2026-10-02: prosty CAD 2D/3D. Najpierw szkic, wymiary i więzy,
bryła, historia, Cofnij/Ponów oraz zapis i ponowne otwarcie. CAM, frezowanie,
G-code, przygotowanie druku 3D, profile drukarek i slicery są poza zakresem.
Nie dodawaj ich ponownie. Schemat v27 zachowuje dawne dane produkcyjne
wyłącznie w nieaktywnym `legacyProduction`, bez obliczania ścieżek lub układu.

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
- `madcad-2d/scripts/desktop-verification-manifest.cjs` — źródło podziału 51
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
  Ta sama zasada dotyczy wyboru ścian po zatwierdzeniu drugiego prymitywu
  w teście Replace Face: dwie widoczne bryły mogą jeszcze pochodzić z podglądu,
  więc przed zapisaniem ID ścian czekaj na zamknięcie dialogu, status `ready`
  i zgodność ID ostatniej cechy dokumentu z wynikiem silnika.
  Kontrolowane dodanie utraconej referencji także zwraca ID przed ukończeniem
  `history.commit`: zanim rozwiniesz panel naprawy, sprawdź obecność referencji
  w dokumencie i nowszą, gotową rewizję silnika.
- `ModelingWorkspace.jsx`, `ModelViewport.jsx` i `cad-worker.js` są monolitami;
  nie dodawaj do nich kolejnej domeny bez rozważenia wydzielenia modułu.
- PR podnoszący `replicad-opencascadejs` do 1.x jest migracją kernela, nie
  zwykłym bumpem zależności.
- Konto MadCAD i okresowe sprawdzenie uprawnienia są wymagane; nie opisuj tego
  jako klucza produktu ani wysyłania projektów. Licencja, README, prywatność,
  strona i interfejs muszą pozostać zgodne.
- Przy lokalnym teście natywnych okien plików macOS nie wybieraj aplikacji po
  samej nazwie, jeśli `/Applications/MadCAD.app` też działa. Uruchom pakiet z
  odizolowaną kopią zalogowanego profilu i kieruj macOS Accessibility do
  `first application process whose unix id is <PID>`. Potwierdź zapis przez
  odczyt pliku `.madcad`, a otwarcie przez komunikat UI, historię, bryły i
  status silnika; nie uznawaj samego zamknięcia dialogu za sukces.
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
- W trwającym celu uproszczenia i stabilizacji CAD 2D/3D nie twórz tagu ani GitHub Release i nie
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
