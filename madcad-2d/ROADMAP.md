# MadCAD — aktywny plan projektowania 2D/3D

Aktualizacja: 2026-10-02
Wersja opublikowana: `6.5.28`
Wersja przygotowywana: `6.5.29`

Zakres uzgodniony z użytkownikiem: prosty program CAD do szkicowania 2D,
modelowania 3D i dokumentacji technicznej. Frezowanie, CAM, G-code,
przygotowanie druku 3D, profile drukarek i integracje slicerów zostały wycofane
z produktu. Dalszych funkcji wytwarzania nie rozwijamy.

## Aktywne zadanie

- [x] Usunąć narzędzia produkcyjne i potwierdzić podstawowy przepływ CAD:
  nowy projekt → szkic → wymiary i więzy → bryła → edycja historii →
  Cofnij/Ponów → zapis `.madcad` → ponowne otwarcie.
- [x] Potwierdzić migrację v26 → v27: zachować szkice, bryły, parametry i historię;
  dawne ustawienia produkcyjne przechować jako nieaktywne `legacyProduction`.
- [x] Schemat v28 archiwizuje dane usuniętego renderu, animacji i ruchu
  w `legacyRemovedFeatures`; bieżący kod zachowuje podstawy CAD.
- [x] Odrzucać błędne wyrażenia wymiarów, a PDF/DXF eksportować dopiero
  po dokładnym rzucie bieżącej rewizji. Potwierdzić wzajemne zasłanianie brył.
- [x] Potwierdzić brak CAM/druku 3D w menu, panelach i interfejsie desktopowym.
- [x] Przejść szkic na ścianie i zależne wycięcie, zmianę wymiarów oraz
  naprawę utraconej referencji.
- [x] Potwierdzić czytelność podstawowych poleceń i wymiarów na typowym
  oraz małym oknie, również przy skali 150%.
- [x] Przejść podstawowy scenariusz w zbudowanym pakiecie macOS bez hooków testowych.
- [—] Ręczny scenariusz po zalogowaniu w zainstalowanej aplikacji Windows
  pominięty na wyraźną decyzję użytkownika z 2026-10-02 („bez weryfikacji
  na Windowsie”). Nie został wykonany ani zaliczony. Automatyczne testy
  Windows i instalatora nadal obowiązują.
- [>] Opublikować 6.5.29 po zielonych bramkach CI/release, potwierdzić paczki,
  SHA-256 i zgodność strony produkcyjnej.

## Co jest podstawą produktu

1. Szkic 2D: linie, prostokąty, okręgi, łuki, snap, dokładne wymiary i więzy.
2. Model 3D: wyciągnięcie, obrót, wycięcie, otwory, fazy, zaokrąglenia,
   przenoszenie i podstawowe operacje na bryłach.
3. Historia: edycja szkicu i operacji, poprawna przebudowa, Cofnij/Ponów.
4. Projekt: nowy/otwórz/zapisz, odzyskiwanie i czytelne błędy.
5. Dokumentacja 2D: widoki, wymiary, arkusze, PDF/DXF.
6. Wymiana geometrii: STEP i siatki STL/3MF; te formaty nie uruchamiają
   przygotowania druku ani programowania obrabiarki.

## Dowody i ograniczenia

Aktualny kod `7174bfe` przeszedł CI 23/23, w tym wszystkie 43 scenariusze
desktopowe Windows/macOS, testy rdzenia na trzech systemach i pięć testów
uruchomienia paczek. CodeQL również przeszedł.
Dowód: [run 37006354811](https://github.com/kamil5646/MadCAD/actions/runs/37006354811).
Ręczny test zalogowanego instalatora Windows pozostaje niezweryfikowany,
ale na decyzję użytkownika nie blokuje wydania 6.5.29.

CI dla `f525f55` zakończyło się powodzeniem: testy rdzenia na trzech
systemach, wszystkie siedem shardów Electron na Windows/macOS oraz pięć
testów uruchomienia paczek (macOS ZIP/DMG, Windows NSIS/Portable i Linux).
Dowód: [run 36984599208](https://github.com/kamil5646/MadCAD/actions/runs/36984599208).
Nie jest to jeszcze pełny scenariusz CAD po zalogowaniu w zainstalowanej aplikacji.

Dwuklik historii: lokalnie odtworzono brak edytora przy pustym zaznaczeniu.
Poprawka przekazuje ID klikniętej operacji bez czekania na odświeżenie
zaznaczenia. Test regresji sprawdza otwarcie wyciągnięcia i anulowanie bez
zmiany bryły; dalej przechodzi edycję, przebudowę, Cofnij/Ponów i zapis/otwarcie.

Pakiet macOS arm64: zwykłe logowanie z izolowaną kopią istniejącego profilu,
bez hooków testowych. Przez rzeczywisty interfejs utworzono prostokąt 40 × 24 mm,
wyciągnięcie 12 mm, edytowano do 15 mm, sprawdzono Cofnij/Ponów i natywne
okna zapisu/otwarcia. Plik v27 zachował 15 mm, kopia `.bak` 12 mm, ponowne
otwarcie odtworzyło jedną bryłę i historię. Oryginalnych projektów nie zmieniano.
Szczegóły: `docs/CAD_ONLY_SCOPE.md`.

`verify:extrude-after-sketch` sprawdza wymiary przez interfejs, wyciągnięcie,
edycję szkicu/operacji, przebudowę, Cofnij/Ponów i zapis/otwarcie przez
produkcyjne handlery plików. Przypadki szkiców na płaskich ścianach końcowych,
bocznych i obróconych były sprawdzane osobno. Ogólne zmiany topologii nadal
wymagają walidacji; sam poprawny prosty przykład nie zamyka tej kwestii.

Test uruchomienia paczki potwierdza start aplikacji, nie pełną pracę po
zalogowaniu na każdym systemie. Nie przedstawiaj niepotwierdzonej weryfikacji
instalatora jako ukończonej.

## Zasady pracy

Jedno aktywne zadanie. Najpierw podstawy i błędy codziennej pracy, następnie
pozycje z [BACKLOG.md](./BACKLOG.md). Każda zmiana schematu ma migrację,
fixture i round-trip. Operacja kernela po błędzie zachowuje ostatni poprawny
model. Wydanie wymaga zielonego CI, paczek, SHA-256 i aktualnej strony.
