# Zakres MadCAD — projektowanie 2D i 3D

Decyzja użytkownika: 2026-10-02. MadCAD służy do projektowania szkiców,
modeli bryłowych/powierzchniowych i rysunków technicznych.

## Usunięte funkcje

- Obszar WYTWARZANIE, setupy, narzędzia i operacje CAM, frezowanie,
  toczenie i cięcie, symulacja obróbki, arkusze ustawcze oraz G-code.
- Panel DRUK 3D, profile drukarek i materiałów do drukowania, orientacja
  na stole, kopie wydruku, mapa drukowalności i przekazywanie do slicerów.
- Kanał IPC `madcad:send-to-slicer` i jego API preload oraz uruchamianie
  aplikacji slicera. Test kompatybilności importu 3MF używa zapisanego
  pliku geometrii; nie uruchamia zewnętrznego slicera.

Usunięto moduły wykonujące te funkcje oraz ich testy. Testy CAD zostały
zachowane; manifest obejmuje 51 scenariuszy desktopowych zamiast 55.

## Zachowane funkcje CAD

Szkice, wymiary, więzy, historia, operacje 3D, pomiary, widoki modelu,
arkusze techniczne, PDF/DXF i wymiana geometrii STEP/STL/3MF.
STL i 3MF pozostają formatami siatki, bez ustawień procesu drukowania.
Podgląd papierowego arkusza 2D pozostaje funkcją dokumentacji CAD.
Opisy normowanych otworów i ich wystąpienia pozostają potrzebne do
modelowania oraz tabel otworów; nie generują ścieżek obrabiarki.

## Zgodność projektów

Schemat v27 nie tworzy pól `manufacturing` ani `print` w nowych projektach.
Migracja v26 → v27 przechowuje dawne pola jako nieaktywne `legacyProduction`,
aby nie usuwać danych użytkownika podczas otwierania i zapisu. Nie ma ich
panelu ani obliczeń. Nie wpływają na podpis geometrii workera.

Fixture: `tests/fixtures/document-v26-production.madcad`. Test rdzenia
potwierdza migrację, zachowanie szkiców i historii, niezmienność pliku
źródłowego oraz pełny round-trip.

Eksport kernela zapisuje rzeczywistą geometrię projektu. Nie stosuje dawnych
obrotów, pozycji, skali ani kopii zapisanych dla drukowania.

## Sprawdzone lokalnie

- 237/237 testów rdzenia CAD; pokrycie: 90,68% linii, 67,42% gałęzi,
  93,84% funkcji — wszystkie wymagane progi przeszły.
- 209/209 testów jednostkowych w 42 plikach.
- Lint, build, kontrola repozytorium i manifestu desktopowego.
- Electron: szkic → wymiary → bryła → edycja → Cofnij/Ponów →
  zapis/otwarcie, zależne szkice na ścianach i naprawa referencji.
- Electron: czytelność interfejsu, menu Plik bez funkcji produkcyjnych,
  kompaktowe okno, panele poleceń i dostępność strony startowej.

Wyniki lokalne dotyczą kodu tej zmiany. Przed wydaniem wymagane są również
CI Windows/macOS i kontrola paczek opisane w `CI_DESKTOP_VERIFICATION.md`.
