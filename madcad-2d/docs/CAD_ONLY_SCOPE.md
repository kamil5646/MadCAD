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
- Eksport PNG sceny: kontrola obecności geometrii zamiast liczby kolorów,
  która nie jest miarodajna dla płaskich ścian prostego modelu CAD.

Wyniki lokalne dotyczą kodu tej zmiany. Przed wydaniem wymagane są również
CI Windows/macOS i kontrola paczek opisane w `CI_DESKTOP_VERIFICATION.md`.

CI dla `f525f55`: wszystkie testy i pięć kontroli uruchomienia paczek
przeszły w [run 36984599208](https://github.com/kamil5646/MadCAD/actions/runs/36984599208).
Kontrola startu nie oznacza pełnej weryfikacji pracy CAD po zalogowaniu.

## Dwuklik historii

`verify-extrude-after-sketch.cjs` ma regresję dwukliku przy pustym
zaznaczeniu, bez poprzedzającego kliknięcia. Stary handler wybierający
operację ze stanu zaznaczenia nie otworzył edytora. Handler z jawnym ID
klikniętej operacji przeszedł test, a Escape zachował wolumen 11520 mm³.
Cały dalszy scenariusz wymiarów, edycji, Cofnij/Ponów, zapisu/otwarcia i
szkiców zależnych od ścian także przeszedł lokalnie. Istniejąca lokalna
poprawka dwukliku została zachowana i włączona do zmiany wraz z tym testem.

## Pakiet macOS i anulowanie edycji

Zbudowano rzeczywisty pakiet arm64 z produkcyjnym `app.asar`, bez hooków
`__madcadVerify`. Uruchomiono go z osobnym katalogiem danych i kopią już
istniejącego, zaszyfrowanego stanu logowania. Kopię stanu logowania usunięto
po teście; oryginalne dane użytkownika nie były zastępowane.

Przez interfejs aplikacji wykonano szkic XY, prostokąt 40 × 24 mm, wyciągnięcie
12 mm zatwierdzone Enterem, edycję do 15 mm, Cofnij (12 mm) i Ponów (15 mm).
Natywne okno zapisania utworzyło plik `.madcad`; drugi zapis utworzył `.bak`.
Odczyt pliku potwierdził schemat v27, jeden szkic, profil 40 × 24 mm, odległość
15 mm i brak aktywnych pól CAM/druku. Kopia `.bak` miała odległość 12 mm.
Po utworzeniu pustego projektu i ponownym otwarciu pliku przez systemowy
dialog aplikacja przebudowała jedną bryłę; edytor historii pokazał 15 mm.

Ten test ujawnił, że anulowanie edycji pozostawiało zaznaczony profil i mylący
stan „profil gotowy do wyciągnięcia”. Poprawka przywraca zaznaczenie edytowanej
operacji. Rozszerzony test `verify-extrude-after-sketch.cjs` odtworzył błąd,
a po poprawce przeszedł anulowanie bez zmiany bryły i dalszy pełny scenariusz.

Pakowanie nie potrzebuje źródeł bibliotek React/Three/OpenCascade:
Vite umieszcza ich wymagany kod i WASM w `dist`. Przeniesiono siedem bibliotek
do `devDependencies` bez zmiany wersji lub integrity w lockfile. `verify:repository`
pilnuje ich licencji oraz tego, by każdy zewnętrzny import Electron miał
zadeklarowaną zależność runtime. `app.asar` ma 14 833 982 bajty. Paczki ZIP/DMG
są lokalnymi artefaktami testowymi, nie nowym wydaniem 6.5.28.

Pełny scenariusz CAD w zainstalowanej aplikacji Windows nadal wymaga osobnego
potwierdzenia. CI desktopowe i test startu NSIS nie są jego zastępstwem.
