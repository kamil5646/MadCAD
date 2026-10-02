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

Druga decyzja użytkownika (2026-10-02) usuwa też dodatki spoza projektowania:

- Symulacje: szybka analiza statyczna, MES belki 1D, MES bryły 3D
  i analiza cieplna (były tylko poleceniami, bez danych w pliku).
- Scena renderu, naklejki, zapis renderu PNG, storyboardy animacji złożenia,
  eksport filmu WebM i instrukcji montażu HTML.
- Edycja siatek skanów: czyszczenie, orientacja, łatanie otworów, redukcja,
  wygładzanie, remesh i grupy ścian. Diagnostyka importowanej siatki
  i zamiana zamkniętej siatki na bryłę B-Rep zostają.
- Motion Links i Contact Sets. Komponenty, wystąpienia, Ground, grupy
  sztywne, jointy, konfiguracje, widok rozstrzelony i statyczna kontrola
  kolizji (Interference) zostają.

Usunięto moduły wykonujące te funkcje oraz ich testy. Testy CAD zostały
zachowane; manifest obejmuje 51 scenariuszy desktopowych zamiast 55.

## Zgodność projektów v28

Migracja v27 → v28 usuwa z aktywnego dokumentu `renderScene`,
`animationStoryboards`, `motionLinks` i `contactSets`. Niepuste dane (oraz scena
renderu inna niż domyślna) trafiają do nieaktywnego `legacyRemovedFeatures`,
więc otwarcie i zapis nie kasują pracy użytkownika. Test rdzenia sprawdza
archiwizację, brak archiwum dla danych domyślnych i round-trip.

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

## Migracja w produkcyjnym pakiecie i nawigacja

Przez natywne okno otwarto kopię fixture v26 w produkcyjnym pakiecie macOS
z polskim interfejsem. Aplikacja pokazała komunikat migracji do v27,
przebudowała jedną bryłę i odtworzyła dwie operacje historii. Zapis przez UI
zachował szkice i cechy dokładnie jak w fixture oraz dawne pola produkcyjne
w `legacyProduction`; `.bak` pozostał dokumentem v26. Pliku fixture w repo
nie zmieniono. Porównanie JSON tych danych przeszło wszystkie asercje.

CI `36988266221` wykryło dryf środka kamery w teście orbity na macOS.
Stary test mógł uznać powtarzane odczyty kamery za stabilizację, nawet gdy
renderer nie narysował nowej klatki. Kontrola czeka teraz na cztery świeże
klatki bez ruchu zgłaszanego przez `OrbitControls.update()` i nadal sprawdza
wektor oraz środek kamery. Nie zwiększono limitu czasu ani tolerancji geometrii.
Diagnostyka klatek działa tylko w trybie `verify`, nie w produkcyjnym pakiecie.
Po zmianie przeszedł test nawigacji i cały shard interfejsu: 12 scenariuszy.

## Wyrażenia wymiarów i diagnostyka CI

Odtworzono błąd parsera: `2*-3` zwracało −3, a `10/-2` zgłaszało dzielenie
przez zero. Parser używa teraz osobnych operatorów jednoargumentowych,
z wyższym pierwszeństwem i prawostronnym wiązaniem. Testy obejmują znaki
zagnieżdżone, nawiasy, zależne parametry, niepełne wyrażenia i rzeczywiste
dzielenie przez zero. Pełne 238 testów rdzenia wraz z bramką pokrycia przeszły.

Przebieg CI `36989142656` potwierdził poprawioną nawigację na Windows/macOS,
ale scenariusz szkicu na ścianie na macOS zakończył się ogólnym wyjątkiem IPC
bez nazwy akcji. Lokalnie cały scenariusz ponownie przeszedł. Do testu dodano
zachowanie treści wywołania, błędów renderera oraz JSON i zrzutu ekranu
z chwili awarii. Przyczyna tego błędu CI pozostaje niepotwierdzona; nie
zwiększono limitów czasu ani nie wyłączono scenariusza.

## Poprawność wymiarów i dokumentacji po zawężeniu v28

Odtworzono przypadki `1 2 +`, `10(2)+` i `1..2+`, które parser błędnie
akceptował. Walidacja kolejności tokenów odrzuca je oraz puste nawiasy,
brakujące operandy i mnożenie bez operatora; poprawne znaki jednoargumentowe
działają nadal. Regresja jest częścią testów rdzenia.

PDF/DXF i podgląd wydruku oczekują na wynik dokładnego rzutu kernela.
Zmiana rewizji modelu lub błąd projekcji zatrzymuje eksport i pokazuje
komunikat. Siatka użyta jako źródło widoku wymaga konwersji do B-Rep;
siatka niewykorzystywana w arkuszu nie blokuje eksportu. Sam podgląd roboczy
nadal może chwilowo pokazywać uproszczone krawędzie podczas obliczeń.

HLR jest liczone wspólnie dla zestawu brył wybranego w danym widoku,
z osobnymi rzutami dla pojedynczych brył i innych zestawów. Suma przedziałów
pokrycia zastąpiła sprawdzanie dziewięciu punktów: części ukrytej krawędzi
pozostają, gdy widoczna linia pokrywa tylko jej fragment. Pokrywające się
rzuty przednich i tylnych krawędzi są deduplikowane.

Test Electron `verify-drawing-workspace` tworzy dwie rzeczywiste bryły,
z których tylna jest całkowicie zasłonięta przez przednią, i uruchamia
produkcyjny handler przygotowania PDF. Stub zastępuje jedynie zapis PDF,
żeby odczytać wygenerowany HTML. Wynik: cztery krawędzie ciągłe i cztery
przerywane. Rysowanie, adnotacje, tabele, powiązania i arkusz szkicu również
przeszły pełny shard `analysis`; pełny shard `modeling` przeszedł szkice,
operacje, historię oraz wymianę STEP/STL/3MF.

Rzuty są buforowane w obrębie rewizji modelu (maksymalnie cztery warianty).
`compoundShapes` otrzymuje klony, ponieważ zużywa wejściowe obiekty.
Nie zmieniono wersji, nie utworzono wydania i nie podmieniono aplikacji.
