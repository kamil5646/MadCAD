# MadCAD — główny plan rozwoju

Aktualizacja i pełny audyt zakresu: 2026-08-08

Status produktu: `6.0.0-alpha.1`

Główna gałąź prac: `agent/madcad-vnext-core`

Ten dokument jest głównym źródłem kolejności prac nad MadCAD. Obejmuje podstawowy zakres Autodesk Fusion potrzebny do projektowania mechanicznego, bezpośrednią pracę na modelu inspirowaną Shapr3D oraz przygotowanie części do druku 3D. Po każdym pakiecie aktualizujemy status, testy, ryzyka i następne pojedyncze zadanie.

Nie zakładamy pełnej zgodności funkcjonalnej z Fusion. Fusion obejmuje również CAM, elektronikę, symulacje, generative design, rendering i rozbudowane usługi chmurowe. Wszystkie te obszary są jednak jawnie sklasyfikowane poniżej, żeby żaden nie zniknął z planu.

## Oznaczenia

- `[x]` — ukończone i zweryfikowane.
- `[~]` — działa częściowo; nie wolno przedstawiać jako pełnej funkcji.
- `[ ]` — nie rozpoczęto.
- `[!]` — blokada wymagająca decyzji albo zmiany architektury.
- Rozmiar `S/M/L/XL` opisuje względną wielkość pakietu, a nie termin kalendarzowy.

## Zasady wykonania

1. Widoczny aktywny przycisk musi wykonywać prawdziwą operację. Atrapy pozostają poza głównym interfejsem.
2. Funkcja jest ukończona dopiero, gdy ma kod, obsługę błędów, anulowanie, undo/redo, zapis projektu i test automatyczny.
3. Każda operacja geometryczna musi działać na XY, XZ, YZ, ścianie planarnej i płaszczyźnie konstrukcyjnej albo być wyraźnie oznaczona jako ograniczona.
4. Każdy pakiet kończy się scenariuszem od pustego dokumentu oraz ponownym otwarciem zapisanego projektu.
5. Nie tworzymy wydania instalacyjnego, jeśli scenariusz główny ma znany błąd P0/P1.
6. Priorytet produktu to projektowanie części do druku 3D. Dokumentacja 2D pozostaje częścią programu, ale nie blokuje rozwoju 3D.
7. Interfejs ma strukturę pracy zbliżoną do Fusion, a manipulatory bezpośrednie mają zachowywać się podobnie do Shapr3D — bez kopiowania marek i zasobów.
8. Jednocześnie rozwijamy tylko jeden duży pakiet. Następny pakiet zaczyna się dopiero po spełnieniu kryterium wyjścia poprzedniego.
9. Format `.madcad` jest trwałym kontraktem. Każda zmiana schematu wymaga migracji w przód, fixture starego pliku i testu round-trip.
10. Każda operacja kernela musi być deterministyczna, działać w transakcji i zostawić ostatni poprawny model po błędzie.

## Wynik audytu kompletności

Poprzedni plan był dobrym szkieletem, ale nie był kompletny. Brakowało fundamentów architektury CAD, pełnego zakresu szkicu, geometrii konstrukcyjnej, inspekcji, materiałów, pełniejszych zespołów i rysunków oraz bezpiecznego procesu aktualizacji. Poniższa mapa obejmuje wszystkie główne obszary aktualnego Autodesk Fusion i nadaje im decyzję produktową.

| Obszar Fusion | Decyzja dla MadCAD | Miejsce w planie |
| --- | --- | --- |
| Sketch 2D, wymiary, constraints, Project/Include | Rdzeń produktu | R1 |
| Solid, bezpośrednia edycja, historia operacji | Rdzeń produktu | R0, R2, R4 |
| Construct: UCS, płaszczyzny, osie, punkty | Rdzeń produktu | R2.7 |
| Inspect: Measure, Section, Interference, właściwości | Rdzeń produktu | R2.8, R3 |
| Mesh i naprawa modeli | Rdzeń dla druku 3D | R3, później R7 |
| Additive manufacturing / przygotowanie wydruku | Główny wyróżnik produktu | R3 |
| Components, assemblies i joints | Ważne po modelowaniu części | R4 |
| Drawing i dokumentacja 2D | Zachować i rozbudować | R5 |
| Surface | Późniejszy moduł profesjonalny | R7 |
| Sheet Metal | Późniejszy moduł branżowy | R8 |
| Form / T-Spline i Plastic | Późniejszy moduł wzorniczy | R8 |
| Render i Animation | Późniejsza prezentacja projektu | R9 |
| Simulation / FEA | Późniejsza walidacja inżynierska | R9 |
| Generative Design / optymalizacja topologii | Później, po stabilnym modelerze | R9 |
| Manufacture: frezowanie, toczenie, cięcie, G-code | Poza bieżącym rdzeniem; później CAM | R10 |
| Electronics / PCB | Osobny produktowy kierunek, nie teraz | R11 |
| Cloud, współdzielenie, wersjonowanie zespołowe | Później; aplikacja pozostaje desktopowa | R11 |
| Publiczne API i wtyczki | Po stabilizacji formatu i kernela | R11 |

Pełny szkic 3D, zaawansowane analizy powierzchni, CAM, FEA i elektronika nie są wymagane do pierwszej dobrej wersji MadCAD dla druku 3D, lecz są zapisane w backlogu. Zakres porównujemy ponownie z oficjalną dokumentacją po R2, R3 i przed każdym wydaniem stable.

## Stan obecny — punkt wyjścia

### Działa i ma test przepływu

- [x] Natywna aplikacja Electron na Windows.
- [x] Dokument parametryczny, historia operacji, autosave, undo/redo.
- [x] Płaszczyzny szkicu XY, XZ i YZ.
- [x] Prostokąt i okrąg tworzone wymiarami lub wskazaniem punktów.
- [x] Wyciągnięcie profilu oraz bezpośredni uchwyt przeciągania z wartością w mm.
- [x] Otwór z profilu okręgu.
- [x] Podstawowe zaokrąglenie i fazowanie całej bryły.
- [x] Parametry użytkownika.
- [x] Kontrola gabarytu względem pola drukarki oraz eksport STL i STEP.
- [x] Opisy aktywnych narzędzi po najechaniu.
- [x] Aktywacja licencji tymczasowo wyłączona jednym przełącznikiem; kod licencji zachowany.
- [x] Schemat dokumentu v4, migracje v2 → v3 → v4, szczegółowa walidacja i bezpieczny podgląd nowszego zgodnego formatu tylko do odczytu.
- [x] Atomowy zapis projektu i autozapisu z kopią poprzedniej poprawnej wersji `.bak`.
- [x] Wspólna polityka tolerancji, graf zależności, transakcje operacji i pełne stany historii `ok/warning/error/stale/suppressed`.
- [x] Kontrakt trwałych sygnatur topologii odporny na kolejność elementów i szum mieszczący się w tolerancji.
- [x] Rewizje dokumentu, serializowana kolejka workera, odrzucanie spóźnionych wyników, ograniczony cache LRU i eksport z dokładnego snapshotu.
- [x] Worker zwraca mapowanie trójkątów do trwałych face ID oraz linii do trwałych edge ID.
- [x] Fundament ma golden B-Rep, round-trip `.madcad`/STEP/STL, fuzz, budżety wydajności i automatyczny test desktopowy w CI.

### Działa tylko częściowo

- [~] Worker zwraca stabilne face/edge ID, ale viewport nie używa ich jeszcze do interaktywnego zaznaczania ścian, krawędzi i wierzchołków B-Rep.
- [~] Zaokrąglenie i fazowanie obejmuje wszystkie możliwe krawędzie zamiast wybranych krawędzi.
- [~] Przygotowanie do druku sprawdza gabaryty, ale nie analizuje grubości ścian, nawisów, samoprzecięć ani szczelności siatki.
- [~] Oś czasu pozwala wybierać i edytować parametry, ale nie ma rollback, zmiany kolejności i pełnego menu operacji.
- [~] Aktualizator wykrywa GitHub Releases i uruchamia instalator na Windows/macOS, ale nie ma kanałów, jawnej weryfikacji integralności, rollback i testów przerwanego procesu.
- [~] Widoczna nazwa produktu to MadCAD, lecz identyfikatory techniczne i repozytorium nadal zawierają `MadCAD2D`; zmiana musi zachować dane i ciągłość aktualizacji.
- [~] Dokumentacja projektu i README opisują częściowo starszą wersję 2D.

### Najważniejsze braki

- [x] Rejestr migracji, model zależności i trwały kontrakt dokumentu.
- [~] Stabilne nazewnictwo topologii jest podłączone do OpenCascade, ale pełne wskazywanie i operacje na tych ID należą do R2.1.
- [~] Ogólny model encji i dowolne profile zamknięte są gotowe; wymiary i więzy należą do R1.9.
- [ ] Zaznaczanie ścian, krawędzi i wierzchołków oraz operacje na wskazanej geometrii.
- [ ] Geometria konstrukcyjna, pomiary, przekroje i właściwości fizyczne.
- [ ] Import STEP/STL/3MF i wiarygodna analiza oraz naprawa modelu do druku.
- [~] Fundament dokumentu, geometrii, eksportu, wydajności i awarii workera jest testowany; testy aktualizatora oraz przyszłych modułów dochodzą razem z R5 i kolejnymi pakietami.

---

## TERAZ — pakiet R0 „Fundament CAD”

Cel wydania: kolejne narzędzia powstają na stabilnym dokumencie, grafie zależności i kontrolowanym workerze, zamiast dopisywać wyjątki do obecnego modelu prostokąt/okrąg.

### R0.1 — format dokumentu i migracje `L`

- [x] Ustalić schemat v3 dla `entities`, `profiles`, `constraints`, `dimensions`, `features`, `bodies`, `components` i referencji topologicznych.
- [x] Dodać rejestr migracji `v2 -> v3`; zachować istniejące prostokąty, okręgi, operacje, parametry i ustawienia druku.
- [x] Dodać walidację strukturalną z komunikatem wskazującym pole i operację, która zerwała referencję.
- [x] Nowszy nieznany format otwierać tylko do odczytu zamiast go nadpisywać.
- [x] Zapisywać projekt atomowo: plik tymczasowy, flush, podmiana i zachowana kopia ostatniej poprawnej wersji.
- [x] Fixture v2 i test: migracja → zapis v3 → ponowne otwarcie → identyczna geometria i historia.

Wynik R0.1: `npm run test:core` — 8/8; `npm run verify:modeling` — pełny przepływ desktopowy oraz eksport STL/STEP zaliczony; build produkcyjny poprawny.

### R0.2 — kontrakty geometrii i historia `XL`

- [x] Ustalić jedną politykę jednostek, precyzji, tolerancji długości/kąta i porównywania punktów.
- [x] Wprowadzić graf zależności: parametr → szkic → profil → feature → body → komponent.
- [x] Każda operacja kernela ma wejście, wynik, diagnostykę i transakcję; błąd nie usuwa ostatniej poprawnej bryły.
- [x] Zaprojektować trwałe identyfikatory ścian/krawędzi/wierzchołków oraz reguły ponownego dopasowania po przebudowie.
- [x] Rozdzielić definicję parametryczną, wynik B-Rep, siatkę renderera i dane zaznaczania.
- [x] Dodać stan `ok / warning / error / suppressed / stale` na każdej operacji historii.

Wynik R0.2: `npm run test:core` — 13/13; test grafu zależności, rollback transakcji, pięciu stanów historii i stabilności sygnatur topologii zaliczony; `npm run verify:modeling` oraz eksport STL/STEP bez regresji.

### R0.3 — worker, przeliczanie i viewport `L`

- [x] Numerować rewizje dokumentu i ignorować każdy spóźniony wynik starszego przeliczenia.
- [x] Debounce, anulowanie możliwych zadań i kolejka gwarantująca kolejność operacji zależnych.
- [x] Eksport otrzymuje snapshot/revision dokumentu i nie korzysta z niejawnego `lastBodies` bez sprawdzenia wersji.
- [x] Cache tessellacji, osobne LOD podglądu i eksportu oraz budżet pamięci.
- [x] Siatka zwraca mapowanie trójkąt → face ID i odcinek → edge ID potrzebne do prawdziwego pickingu.
- [x] Po awarii worker jest odtwarzany, a UI zachowuje dokument i pokazuje pełną diagnostykę.

Wynik R0.3: `npm run test:core` — 15/15; test kolejki, LRU, rewizji i polityki odtwarzania workera zaliczony. Test desktopowy: rewizja 21, cache 3, 29 ścian i 63 krawędzie z kompletnym mapowaniem trwałych ID; eksport STL/STEP bez regresji.

### R0.4 — baza testów CAD `L`

- [x] Testy jednostkowe dokumentu, migracji, grafu zależności i wyrażeń.
- [x] Golden tests B-Rep: liczba brył, objętość, pole, bounding box i oczekiwane cechy topologii z tolerancją.
- [x] Testy round-trip `.madcad`, STEP i STL przez ponowny import. 3MF wchodzi razem z właściwym eksporterem w R4.5.
- [x] Deterministyczne property/fuzz tests dla bieżących profili, zerowych i skrajnych wartości oraz błędnych wyrażeń. Przerwy i samoprzecięcia dochodzą w R1.5, gdy istnieją dowolne łańcuchy krzywych.
- [x] Desktop E2E dla wskaźnika pióra, klawiatury, undo/redo, autozapisu i kontrolowanego odtworzenia workera; zapis atomowy pokrywa osobny test rdzenia.
- [x] Budżety wydajności dla małego, średniego i dużego dokumentu oraz uruchomienia i przepływu desktopowego.

Wynik R0.4: `npm run test:core` — 19/19. Golden B-Rep 64 × 42 × 8 mm: objętość 21 504 mm³, pole 7 072 mm², 6 ścian i 12 krawędzi. Ponowny import STEP zachowuje objętość z błędem względnym poniżej `6e-15`, a STL poniżej `3e-5`. Desktop E2E przechodzi po odtworzeniu workera z rewizji 21 do 22; zimny start 1,9 s, pełny przepływ 4,5 s. GitHub Actions uruchamia testy rdzenia i build UI na Windowsie oraz Linuksie, a pełny Electron E2E na docelowym Windowsie.

### Kryterium zamknięcia R0

- [x] Obecny projekt v2 migruje bez utraty modelu, eksportu ani historii.
- [x] Spóźnione przeliczenie nie może nadpisać nowszego wyniku ani eksportować starszej bryły.
- [x] Błąd pojedynczej operacji nie zamyka aplikacji i nie niszczy pliku.
- [x] Testy fundamentu przechodzą automatycznie w CI.

---

## NASTĘPNIE — pakiet R1 „Prawdziwy szkicownik”

Cel wydania: użytkownik potrafi narysować dowolny typowy profil mechaniczny, poprawić go, zwymiarować, w pełni związać i wyciągnąć w poprawną bryłę.

Zadania wykonujemy dokładnie w tej kolejności.

### R1.1 — nowy model danych szkicu `L`

- [x] Dodać encje `point`, `line`, `arc`, `circle` oraz stabilne identyfikatory końców.
- [x] Przygotować rozszerzalny kontrakt dla `ellipse`, `ellipticalArc`, `spline`, `conic`, `slot`, `polygon` i `text` bez kolejnego łamania formatu.
- [x] Oddzielić encje szkicu od wykrytych profili zamkniętych.
- [x] Rozróżnić geometrię zwykłą, konstrukcyjną, centerline, projected i fixed.
- [x] Walidować referencje, usuwanie, duplikaty ID i zależności do parametrów.
- [x] Test: edycja → zapis → ponowne otwarcie → identyczne encje, profile, relacje i historia.

Wynik R1.1: schemat v4 zapisuje punkty jako osobne encje, a linie, łuki i okręgi wskazują je przez stabilne `pointIds`; profile zawierają wyłącznie referencje brzegowe oraz cache zgodności obecnych prymitywów synchronizowany przy każdej edycji. Migracja v3 → v4 materializuje 8 encji prostokąta i 2 encje okręgu bez zmiany geometrii. `npm run test:core` — 23/23; pełny desktop E2E, odtworzenie workera oraz round-trip STEP/STL zaliczone.

### R1.2 — linia i polilinia `M`

- [x] Narzędzie Linia: punkt początkowy, podgląd, punkt końcowy, Escape kończy polecenie.
- [x] Narzędzie Polilinia: kolejne segmenty, Enter/Escape kończy, kliknięcie początku zamyka obrys.
- [x] Wprowadzanie dokładnej długości i kąta z klawiatury.
- [x] Cofanie ostatniego segmentu bez wychodzenia z polecenia.
- [x] Łuk styczny jako kontynuacja odcinka.
- [x] Test: profil w kształcie litery L utworzony bez prostokąta.

Wynik R1.2: Linia i Polilinia zapisują prawdziwe punkty/segmenty v4, mają przerywany podgląd, dokładną długość i kąt, cofanie bieżącego segmentu oraz tryb stycznego łuku. Zamknięcie początku wykrywa profil brzegowy. Desktop E2E tworzy bez prostokąta profil L z 12 encji i wyciąga go na 8 mm: objętość 4 000 mm³, pole 1 960 mm², 8 ścian i 18 krawędzi. `npm run test:core` — 25/25.

### R1.3 — zaznaczanie i edycja szkicu `L`

- [x] Zaznaczanie punktu, segmentu i wielu elementów z Ctrl/Shift.
- [x] Przeciąganie punktów i segmentów z podglądem na żywo oraz wpisem liczbowym.
- [x] Delete usuwa zaznaczenie; undo/redo przywraca dokładny stan i relacje.
- [x] Wybór oknem crossing/inside od lewej i prawej strony.
- [x] Czytelne stany: hover, selected, under-constrained, fully-constrained, construction, projected i error.
- [x] Test: przesunięcie wierzchołka zmienia profil i wynik wyciągnięcia.

Wynik R1.3: punkty i segmenty mają stabilne trafienia oraz rozróżnione stany wizualne, obsługują Ctrl/Shift, wybór inside/crossing, przeciąganie z podglądem i dokładne ΔX/ΔY. Delete usuwa zależności kaskadowo w jednej transakcji, a Undo/Redo przywraca profil. Desktop E2E przesuwa wierzchołek profilu L z 10 na 15 mm i potwierdza zmianę dokładnej bryły: objętość 4 400 mm³, pole 2 024,924 mm², 8 ścian i 18 krawędzi. `npm run test:core` — 27/27.

### R1.4 — snap, inferencje i prowadnice `L`

- [x] Przyciąganie do końca, środka, centrum, kwadrantu, przecięcia, styczności, najbliższego punktu i siatki.
- [x] Prowadnice pozioma/pionowa, wyrównanie, przedłużenie i podgląd proponowanej relacji przed kliknięciem.
- [x] Regulowany próg przyciągania niezależny od poziomu zoomu.
- [x] Możliwość chwilowego wyłączenia snap klawiszem modyfikującym.
- [x] Testy wszystkich typów snap przy kilku poziomach zoomu i DPI.

Wynik R1.4: osobny silnik snap rozpoznaje punkty charakterystyczne linii, łuków i okręgów, dokładne przecięcia, styczne z aktywnego punktu, najbliższą geometrię, siatkę oraz inferencje poziome, pionowe, wyrównania i przedłużenia. Próg 4–24 px działa w pikselach CSS niezależnie od zoomu i DPI, Alt chwilowo wyłącza przyciąganie, a canvas pokazuje marker relacji i prowadnice przed kliknięciem. `npm run test:core` — 30/30; build produkcyjny i pełny desktop E2E zaliczone.

### R1.5 — wykrywanie zamkniętych profili `XL`

- [x] Zbudować graf topologii szkicu zgodny z polityką tolerancji R0.
- [x] Wykrywać zamknięte pętle, pętle zagnieżdżone, wyspy i otwory wewnętrzne.
- [x] Odrzucać przerwy, samoprzecięcia, nakładanie i zerowe segmenty z czytelnym wskazaniem miejsca.
- [x] Wypełniać poprawne profile na płótnie i umożliwiać ich zaznaczenie.
- [x] Przekazać dowolną pętlę do OpenCascade i wyciągnąć ją na XY/XZ/YZ oraz dowolnej płaszczyźnie planarnej.
- [x] Test: litera L, sześciokąt, profil z otworem i profil z celową przerwą.

Wynik R1.5: osobny graf topologii klastruje współrzędne według tolerancji R0, zachowuje kierunek krawędzi i wykrywa pętle o dowolnej orientacji. Parzystość zagnieżdżenia rozróżnia zewnętrzne profile, otwory i wyspy; pętle wewnętrzne są trwałą częścią formatu `.madcad` i grafu zależności. Canvas wypełnia region z rzeczywistymi otworami, umożliwia wybór wnętrza i pokazuje diagnostykę przerwy, samoprzecięcia, nakładania, rozgałęzienia oraz zerowej geometrii. `npm run test:core` — 35/35. Desktop E2E potwierdza wypełnienie i wybór profilu oraz dokładną objętość 5 520 mm³ dla profilu z otworem wyciągniętego przez OpenCascade na XY, XZ i YZ.

### R1.6 — figury mechaniczne `XL`

- [x] Łuk przez trzy punkty, środek–początek–koniec i styczny.
- [x] Prostokąt: dwa punkty, środek oraz trzy punkty.
- [x] Okrąg: środek/promień, dwa punkty i trzy punkty.
- [x] Wielokąt wpisany/opisany i zdefiniowany krawędzią.
- [x] Elipsa i łuk eliptyczny.
- [x] Slot: środek–środek, całościowy, trzy punkty i łukowy.
- [x] Test: wspornik z prostymi bokami, łukiem, slotem i otworami.

Wynik R1.6: dokładne konstruktory figur zapisują edytowalne punkty, linie, łuki kołowe, okręgi, elipsy i łuki eliptyczne zamiast spłaszczonej siatki. Wszystkie metody konstrukcji są dostępne z aktywnych komend wstążki, przechodzą detekcję profilu i zachowują się poprawnie w OpenCascade. `bun test` — 38/38. Desktop E2E potwierdza objętości elipsy, półelipsy, slotu prostego, slotu łukowego i wspornika z trzema otworami wewnętrznymi, a następnie pełny przepływ, odtworzenie workera i round-trip STL/STEP.

Następne pojedyncze zadanie: R1.7 — conic z parametrem rho i kontrolą ciągłości.

### R1.7 — krzywe, punkty i tekst `L`

- [x] Fit-point spline i control-point spline z edycją uchwytów.
- [x] Conic z kontrolą rho i ciągłości.
- [x] Punkt szkicu jako referencja dla otworu i konstrukcji.
- [ ] Tekst szkicu z fontem, wysokością, wyrównaniem i zamianą na profile do emboss/wycięcia.
- [ ] Diagnostyka krzywizny i samoprzecięć krzywej.

Stan R1.7: spline dopasowany jest zapisywany jako odcinki kubiczne przechodzące przez punkty, a spline kontrolny jako dokładna krzywa Béziera. Conic używa trzech trwałych punktów, dodatniego parametru `rho`, trybu ciągłości G0/G1/G2 i trafia do OpenCascade jako dokładna racjonalna krzywa Béziera z wagami `[1, rho, 1]`. Krzywe korzystają z istniejącego zaznaczania, przeciągania, wpisu ΔX/ΔY, Delete i Undo/Redo. Samodzielny punkt szkicu ma trwałe ID, może być zwykłą geometrią referencyjną albo konstrukcyjną i bez profilu wyznacza oś operacji Otwór; wierzchołki należące do konturu są celowo odróżniane od takich punktów. `bun test` — 41/41; pełny desktop E2E wyciąga profile spline i conic, wykonuje dokładny otwór z punktu, odtwarza worker i przechodzi round-trip STL/STEP.

Następne pojedyncze zadanie: tekst szkicu z zamianą na profile do emboss/wycięcia.

### R1.8 — modyfikacje szkicu `XL`

- [ ] Przytnij, Wydłuż, Przerwij, Sketch Fillet i Sketch Chamfer z podglądem wyniku.
- [ ] Odsuń pojedynczą krzywą, łańcuch lub profil o zadaną wartość.
- [ ] Przesuń, Obróć, Kopiuj, Skaluj i Lustro.
- [ ] Szyk prostokątny, kołowy i po ścieżce z możliwością pominięcia wystąpień.
- [ ] Wszystkie operacje obsługują undo/redo i zachowują identyfikatory tam, gdzie jest to matematycznie możliwe.

### R1.9 — wymiary, więzy i solver `XL`

- [ ] Wymiary: długość, poziomy, pionowy, aligned, kąt, promień, średnica, odległość, współrzędna i długość łuku.
- [ ] Więzy: coincident, horizontal, vertical, parallel, perpendicular, tangent, concentric, equal, midpoint, collinear, symmetry, curvature i fixed/unfix.
- [ ] Solver pokazuje stopnie swobody, szkic niedowiązany, fully constrained, konflikt oraz przewiązanie.
- [ ] Badges więzów na canvasie można wskazać, edytować, usunąć i ukryć.
- [ ] Zmiana parametru aktualizuje szkic i całą zależną historię bryły.
- [ ] Test: w pełni związany szkic wspornika reagujący na zmianę dwóch parametrów.

### R1.10 — szkice na modelu i Project/Include `XL`

- [ ] Tworzenie i edycja szkicu na płaszczyznach bazowych, ścianach planarnych i płaszczyznach konstrukcyjnych.
- [ ] Project krawędzi, punktów, pętli i przecięcia bryły ze szkicem.
- [ ] Associative link do geometrii źródłowej z czytelnym stanem utraconej referencji.
- [ ] Slice, pokaż/ukryj profile, punkty, wymiary, więzy i projected geometry.
- [ ] Import SVG/DXF jako edytowalne encje szkicu z kontrolą jednostek i uproszczenia.

### Kryterium zamknięcia R1

- [ ] Od pustego dokumentu można narysować niesymetryczny wspornik z linii, łuków i slotów, dodać dwa otwory, w pełni związać szkic, zmienić wymiar, wyciągnąć bryłę i wyeksportować poprawny STEP/STL.
- [ ] Drugi szkic można utworzyć na ścianie bryły i powiązać projekcją jej krawędzi.
- [ ] Brak aktywnych atrap w obszarze Szkic.
- [ ] Testy jednostkowe modelu/solvera oraz automatyczny test desktopowy przechodzą bez wyjątków.

---

## PAKIET R2 „Modelowanie części 3D”

Cel wydania: typową część mechaniczną do druku można zbudować parametrycznie albo przez zaznaczenie geometrii i przeciągnięcie manipulatora.

### R2.1 — stabilne zaznaczanie B-Rep `XL`

- [ ] Identyfikatory ścian, krawędzi i wierzchołków odporne na podstawowe przeliczenie historii.
- [ ] Filtry zaznaczania: szkice, profile, ściany, krawędzie, wierzchołki, bryły i komponenty.
- [ ] Multi-select, cykliczny wybór nakładających się elementów, box select i menu kontekstowe.
- [ ] Podświetlenie hover bez przeliczania bryły i wskazanie utraconej referencji.

### R2.2 — uniwersalny manipulator `L`

- [ ] Strzałki osiowe, uchwyty płaszczyzn i pierścienie obrotu.
- [ ] Wartość przy uchwycie, snap, wpis liczbowy, flip, zatwierdzenie i anulowanie.
- [ ] Jeden system dla Extrude, Move/Rotate, Scale, Offset Face i edycji feature.
- [ ] Menu adaptacyjne: wybór profilu proponuje Extrude; wybór ściany proponuje Offset/Move; wybór krawędzi proponuje Fillet/Chamfer.

### R2.3 — Extrude kompletne `L`

- [ ] Automatyczne `Nowa bryła / Połącz / Wytnij / Część wspólna` z możliwością ręcznej zmiany.
- [ ] Jedna strona, dwie strony i symetrycznie.
- [ ] Zakres: odległość, do obiektu i przez wszystko; start z profilu, offsetu lub obiektu.
- [ ] Kąt pochylenia ścian oraz thin extrude dla profilu otwartego.
- [ ] Edycja istniejącego kroku przez manipulator na modelu.

### R2.4 — bezpośrednie modyfikacje bryły `XL`

- [ ] Boolean Union, Subtract i Intersect dla wskazanych brył.
- [ ] Press Pull / Offset Face dla ścian planarnych, cylindrycznych i prostych zestawów stycznych.
- [ ] Fillet oraz Chamfer tylko na wskazanych krawędziach, z typowymi wariantami i setback.
- [ ] Shell z wyborem usuwanych ścian i kontrolą grubości.
- [ ] Draft dla wskazanych ścian.
- [ ] Move/Copy, Rotate, Align i Scale dla ścian, brył i komponentów.
- [ ] Split Face, Split Body, Delete/Heal Face i Replace Face.

### R2.5 — otwory i gwinty do druku `XL`

- [ ] Umieszczenie otworu przez punkt szkicu, wskazanie ściany i referencje do krawędzi.
- [ ] Otwór prosty, counterbore i countersink; zakończenie Distance, To i All; końcówka płaska lub kątowa.
- [ ] Clearance, tapped i tapered tapped z biblioteką podstawowych norm metrycznych.
- [ ] Gwint kosmetyczny i modelowany; średnica, skok, klasa, kierunek, długość i offset.
- [ ] Profile kompensacji luzu dla FFF/resin bez zmiany nominalnej dokumentacji.
- [ ] Test: pasująca śruba i nakrętka po eksporcie z wybranym profilem drukarki.

### R2.6 — tworzenie złożonych brył `XL`

- [ ] Prymitywy: Box, Cylinder, Sphere i Torus.
- [ ] Revolve, Sweep i Loft z osią/ścieżką/prowadnicami oraz kontrolą ciągłości.
- [ ] Rib/Web, Coil i Pipe.
- [ ] Emboss/Deboss tekstu i profilu na ścianie.
- [ ] Mirror oraz szyk prostokątny, kołowy i po ścieżce dla feature, faces, bodies i components.
- [ ] Thicken i Boundary Fill po dostępności wymaganych podstaw modelowania powierzchniowego.

### R2.7 — geometria konstrukcyjna `XL`

- [ ] Własny UCS z originem i orientacją.
- [ ] Płaszczyzna offset, pod kątem, tangent, midplane, przez trzy punkty, przez dwie krawędzie i wzdłuż ścieżki.
- [ ] Osie przez walec/stożek/torus, dwie płaszczyzny, dwa punkty, krawędź i prostopadle do ściany.
- [ ] Punkty na wierzchołku, przecięciu, centrum i wzdłuż ścieżki.
- [ ] Widoczność, nazwy, foldery i użycie konstrukcji jako trwałych referencji operacji.

### R2.8 — Inspect, właściwości i orientacja `L`

- [ ] Measure: długość, odległość min/max, kąt, promień/średnica, obwód, pole, pozycja i kopiowanie wyniku.
- [ ] Section Analysis jako trwały element folderu analiz.
- [ ] Interference dla brył i komponentów z objętością kolizji.
- [ ] Objętość, pole, materiał, gęstość, masa i środek masy.
- [ ] Draft Analysis i Minimum Radius potrzebne do wytwarzania; Curvature/Zebra pozostają etapem R7.
- [ ] Named Views, ViewCube, standardowe widoki, orbit/pan/zoom, focus, isolate oraz show/hide.

### R2.9 — prawdziwy workflow desktop CAD `L`

- [ ] Ribbon/workspaces, browser modelu, panel właściwości, oś czasu i dialog polecenia mają jeden spójny model zaznaczenia.
- [ ] Każda opcja ma napis oraz tooltip opisujący działanie, wymagane zaznaczenie, skrót i ograniczenia.
- [ ] Command Search, konfigurowalne skróty, repeat last command i kontekstowe menu pod prawym przyciskiem.
- [ ] Narzędzia niedostępne pokazują przyczynę; niegotowe narzędzia nie wyglądają na aktywne.
- [ ] Układ działa przy 100–200% DPI, na małym ekranie i wielu monitorach.

### Kryterium zamknięcia R2

- [ ] Użytkownik tworzy obudowę z pokrywą, otworami, gwintem, żebrami, shell i wybranymi zaokrągleniami bez atrap oraz operacji „na wszystkie krawędzie”.
- [ ] Tę samą część można istotnie zmienić manipulacją ścian i edycją kroków historii.
- [ ] Pomiary, przekrój, masa i kontrola kolizji zwracają powtarzalne wyniki.

---

## PAKIET R3 „Druk 3D”

Cel wydania: MadCAD przygotowuje wiarygodny model do slicera i wykrywa najczęstsze problemy przed eksportem.

- [ ] Profile drukarek i stołów: Bambu Lab, Prusa, Creality oraz własny profil; FFF jako pierwszy wspierany proces.
- [ ] Profile materiału, średnicy dyszy, wysokości warstwy, skurczu, tolerancji i kompensacji otworów/gwintów.
- [ ] Pozycja, obrót, skala, kopiowanie, orientacja względem płaskiej ściany i automatyczne ułożenie wielu części na stole.
- [ ] Import STEP, STL, 3MF i OBJ z wykrywaniem jednostek, komponentów i transformacji.
- [ ] Eksport STL binarny, STEP i 3MF z nazwami części, jednostkami, kolorami i ustawieniami jakości tessellacji.
- [ ] Analiza: obszar stołu, zamknięta bryła/manifold, samoprzecięcia, odwrócone normalne, zdegenerowane trójkąty, minimalna grubość, małe otwory, luz pasowania, nawisy i mosty.
- [ ] Heatmapy problemów na modelu oraz lista wyników prowadząca do wskazanej geometrii.
- [ ] Naprawa siatki: weld, usunięcie duplikatów, zamykanie prostych otworów, odwrócenie normalnych, separate, reduce/remesh i ponowna tessellacja z B-Rep.
- [ ] Przekrój modelu i pomiar lokalnej grubości.
- [ ] Podgląd wpływu tolerancji siatki na rozmiar pliku i odchyłkę od B-Rep.
- [ ] Przekazanie pliku do zainstalowanego slicera lub otwarcie lokalizacji; własne generowanie G-code nie wchodzi do pierwszego wydania.
- [ ] Testy w aktualnych wersjach Bambu Studio, PrusaSlicer i Cura: skala 1:1, orientacja, osobne części i gwint.

### Kryterium zamknięcia R3

- [ ] Model testowy z gwintem, cienką ścianką, nawisem i błędną siatką otrzymuje poprawną diagnozę oraz daje się naprawić albo świadomie wyeksportować.
- [ ] STEP/STL/3MF po eksporcie i ponownym imporcie zachowują jednostki, gabaryt i oczekiwaną liczbę części.

---

## PAKIET R4 „Historia, projekty i zespoły”

- [ ] Cofnięcie wskaźnika osi czasu i wstawianie operacji w środku historii.
- [ ] Zmiana kolejności z walidacją zależności, suppress/unsuppress, rename, delete i grupowanie operacji.
- [ ] Edycja błędnej operacji bez utraty późniejszych kroków; czytelne ostrzeżenie o osieroconych referencjach.
- [ ] Stabilne migracje `.madcad`, kopie awaryjne, odzyskiwanie sesji i historia ręcznych zapisów.
- [ ] Import/eksport projektu z osadzonymi lub linkowanymi zależnościami i kontrolą brakujących plików.
- [ ] Komponent jako kontener własnego originu, konstrukcji, szkiców, brył, właściwości, numeru części i podkomponentów.
- [ ] Ground, rigid group, joint origin, Joint i As-Built Joint.
- [ ] Typy joints: rigid, revolute, slider, cylindrical, pin-slot, planar i ball.
- [ ] Motion limits, motion link, drive/animate joint i podstawowe contact sets.
- [ ] Interference, przekrój, zakres ruchu i prosta diagnostyka stopni swobody zespołu.
- [ ] Konfiguracje wariantów wymiarów i suppressions jako etap po stabilnych komponentach.

### Kryterium zamknięcia R4

- [ ] Zespół zawiasu ma osobne komponenty, poprawny revolute joint z limitem, brak niezamierzonej kolizji i zachowuje ruch po ponownym otwarciu.

---

## PAKIET R5 „Dokumentacja 2D”

- [ ] Associative base, projected, isometric, section i detail views części oraz zespołu.
- [ ] Kontrola hidden lines, skali, standardu arkusza i aktualizacji po zmianie modelu 3D.
- [ ] Wymiary liniowe, kątowe, radialne, średnicowe, ordinate i baseline.
- [ ] Center marks/lines, hole/thread notes, leaders, tekst, symbole, datums, tolerancje i podstawowe GD&T.
- [ ] Parts List/BOM, balloons, hole table i właściwości numeru/nazwy/materiału/masy.
- [ ] Title block, szablony arkuszy, revision table/marker/cloud.
- [ ] Eksport PDF i DXF; DWG przez kontrolowany adapter, jeśli dostępna jest legalna i stabilna biblioteka/konwerter.
- [ ] Tryb dotychczasowego rysunku 2D pozostaje dostępny jako „Dokumentacja”, bez `2D` w nazwie produktu.

### Kryterium zamknięcia R5

- [ ] Z modelu i zespołu testowego powstaje aktualizujący się rysunek wykonawczy PDF/DXF z widokami, przekrojem, wymiarami, tolerancjami i listą części.

---

## PAKIET R6 „Aplikacja gotowa do wydania”

- [ ] CI dla Windows i macOS: test core, build UI, desktop E2E, migracje, eksporty i smoke test instalatora.
- [ ] Testy awarii workera/kernela, autosave, pełnego dysku, uszkodzonego projektu i dużych modeli.
- [ ] Odtworzenie sesji po awarii bez utraty ostatniej poprawnej operacji.
- [ ] Pomiar i progi wydajności viewportu, pickingu, meshowania, przeliczania historii, zapisu i eksportu.
- [ ] Skróty klawiaturowe, dostępność, PL/EN, skalowanie DPI, wielu monitorów oraz nawigacja bez myszy tam, gdzie ma sens.
- [ ] Usunąć `2D` z nazw widocznych i nowych identyfikatorów technicznych, ale migrować stary app data/appId/installer bez utraty projektów i bez przerwania aktualizacji.
- [ ] Aktualizator: kanały `alpha`, `beta`, `stable`, manifest release, allowlista hostów, SHA-256/podpis paczki, podpis kodu, progress, retry/cancel i zakaz niejawnego downgrade.
- [ ] Aktualizator: kopia poprzedniej wersji, rollback, test zaniku sieci/prądu, uszkodzonej paczki, braku miejsca i aktualizacji z każdej wspieranej wersji.
- [ ] Instalator Windows i pakiet macOS: podpis/notarization, czysta instalacja, repair, aktualizacja, odinstalowanie oraz zachowanie danych użytkownika.
- [ ] Utwardzenie Electron: context isolation, ograniczone IPC, walidacja wszystkich payloadów, CSP, bezpieczne linki zewnętrzne i brak sekretów w rendererze/logach.
- [ ] Decyzja o ponownym włączeniu licencji dopiero po stabilnej becie; do tego czasu test gwarantuje brak blokady aktywacyjnej.
- [ ] Polityka prywatności, crash reports/telemetria tylko za zgodą oraz możliwość pełnego wyłączenia.
- [ ] Aktualna dokumentacja, command reference, samouczek „pierwsza część do druku”, pliki przykładowe i lista znanych ograniczeń.
- [ ] Kanał stable powstaje dopiero po zerowej liczbie P0/P1 i przejściu pełnej macierzy release.

---

## Dalsze pakiety — przeanalizowane, ale nie rozpoczynać przed R2/R3

### R7 — Surface i zaawansowany Mesh

- Surface Extrude/Revolve/Sweep/Loft, Patch, Offset, Ruled Surface, Trim/Extend, Stitch/Unstitch, Untrim, Reverse Normal i Thicken.
- Curvature comb/map, zebra, isocurve i continuity diagnostics.
- Mesh face groups, convert mesh/B-Rep, reduce, remesh, smooth, shell, separate/combine i dokładniejsze naprawy skanów.

### R8 — Sheet Metal, Plastic, Form i szkic 3D

- Reguły blachy, flange, bend, hem, rip, unfold/refold, flat pattern i bend table.
- Plastic rules, boss, snap-fit, grille i analiza grubości/pochylenia.
- SubD/T-Spline Form z symetrią i konwersją do B-Rep.
- Pełny szkic 3D, ścieżki przestrzenne i krzywe na powierzchni.

### R9 — Render, Animation, Simulation i Generative

- Materiały wizualne, appearance, oświetlenie, decals i render lokalny.
- Exploded views, storyboard i eksport animacji.
- Najpierw proste analizy liniowo-statyczne i termiczne; pełne FEA wymaga osobnego solvera i walidacji numerycznej.
- Optymalizacja topologii/generative dopiero po wiarygodnych constraintach, materiałach i środowisku obliczeniowym.

### R10 — Manufacture / CAM

- Setup, stock, narzędzia, 2D/3D milling, drilling, turning, cutting, symulacja, wykrywanie kolizji i postprocesory G-code.
- To osobny duży produktowy etap; nie mieszać go z prostym przekazaniem modelu do slicera w R3.

### R11 — Electronics, chmura i rozszerzalność

- Schematic/PCB/MCAD-ECAD tylko po osobnej decyzji produktowej.
- Wersjonowanie chmurowe, komentarze, uprawnienia, współdzielenie i ewentualna współpraca czasu rzeczywistego.
- Stabilne publiczne API, sandbox wtyczek, wersjonowanie API i marketplace dopiero po zamrożeniu podstawowych kontraktów.

## Macierz Definition of Done dla każdej funkcji

- [ ] Happy path i co najmniej jeden błąd wejścia są pokryte testem.
- [ ] Operacja działa po undo/redo, zapisie/otwarciu oraz zmianie parametru nadrzędnego.
- [ ] Wynik B-Rep jest valid; liczba brył, objętość i bounding box mieszczą się w tolerancji.
- [ ] Export i ponowny import nie zmieniają jednostek ani gabarytu.
- [ ] Anulowanie nie zostawia częściowego kroku historii.
- [ ] UI ma label, tooltip, stan disabled z powodem, skrót jeśli istnieje i komunikat błędu bez stack trace dla użytkownika.
- [ ] Nie ma aktywnego przycisku bez implementacji.
- [ ] Dokumentacja i ten roadmap są zaktualizowane w tym samym PR.

## Główne ryzyka techniczne

- [!] Topological naming po zmianie parametrów jest najtrudniejszą zależnością R2/R4; nie wolno zastąpić go indeksami ścian/krawędzi z jednej tessellacji.
- [!] Replicad/OpenCascade w Web Workerze może nie udostępnić każdego narzędzia Fusion; brakujące operacje wymagają adaptera do OpenCascade, nie atrap w UI.
- [!] Pełny solver więzów i wydajne wykrywanie profili są osobnymi modułami, nie logiką dopisaną w komponencie React.
- [!] Zmiana `appId`/nazwy instalatora bez migracji może stworzyć drugą instalację i zerwać updater.
- [!] Import STEP/STL/3MF musi być testowany na plikach z różnych programów; samo otwarcie własnego eksportu jest niewystarczające.
- [!] Funkcje druku nie mogą sugerować, że model na pewno się wydrukuje; raportują wykryte ryzyka i założenia profilu.

## Rejestr decyzji produktu

- 2026-08-04 — MadCAD pozostaje aplikacją desktopową, nie aplikacją przeglądarkową.
- 2026-08-04 — Dotychczasowe 2D pozostaje jako „Dokumentacja”; główny produkt rozwija modelowanie 3D.
- 2026-08-04 — Priorytetem jest projektowanie pod druk 3D.
- 2026-08-04 — Struktura UI czerpie z Fusion, a bezpośrednia manipulacja z Shapr3D.
- 2026-08-04 — Niedziałające opcje nie mogą być prezentowane jako aktywne narzędzia.
- 2026-08-04 — Aktywacja licencji jest tymczasowo wyłączona, ale mechanizm pozostaje w kodzie.
- 2026-08-04 — Pełny zakres Fusion jest skatalogowany, lecz implementujemy najpierw Part Design + druk 3D, potem zespoły i dokumentację.
- 2026-08-04 — Przed dalszym rozrostem funkcji powstaje R0: migracje, graf zależności, kontrola rewizji workera i baza testów.

## Oficjalne źródła audytu

- [Autodesk Fusion — Workspaces](https://help.autodesk.com/view/fusion360/ENU/?guid=GS-WORKSPACES)
- [Autodesk Fusion — Design types and tabs](https://help.autodesk.com/view/fusion360/ENU/?guid=ASM-DESIGNS)
- [Autodesk Fusion — Sketch tools](https://help.autodesk.com/cloudhelp/ENU/Fusion-GenerativeDesign/files/GD-SKETCH-TOOLS.htm)
- [Autodesk Fusion — Sketch constraints](https://help.autodesk.com/cloudhelp/ENU/Fusion-Sketch/files/SKT-CONSTRAINTS.htm)
- [Autodesk Fusion — Construction geometry](https://help.autodesk.com/view/fusion360/ENU/?contextId=SLD-CONSTRUCT-TOOLS)
- [Autodesk Fusion — Inspect and analysis tools](https://help.autodesk.com/view/fusion360/ENU/?contextId=SLD-INSPECT-TOOLS)
- [Autodesk Fusion — Mesh overview](https://help.autodesk.com/view/fusion360/ENU/?contextId=MESH-OVERVIEW)
- [Autodesk Fusion — Joint types](https://help.autodesk.com/view/fusion360/ENU/?contextId=ASM-REF-JOINT)
- [Autodesk Fusion — Manufacture overview](https://help.autodesk.com/view/fusion360/ENU/?guid=GUID-BEC5DEA9-AC3E-4FA8-998E-4AE8CD0D0B1E)
- [Shapr3D Manual — direct tools and adaptive menu](https://support.shapr3d.com/hc/en-us/article_attachments/11017077131036)

## Następne pojedyncze zadanie

`R1.6 — figury mechaniczne`.

R0.1–R0.4 oraz R1.1–R1.5 są zamknięte i zweryfikowane. Następny krok to R1.6: łuki, warianty prostokąta i okręgu, wielokąty, elipsy oraz sloty. Nie rozpoczynamy równolegle nowych modułów powierzchni, CAM, zespołów ani renderingu.
