# CAM drilling — kontrakt P5.1

Ten dokument opisuje pionowy przepływ wiercenia 3-osiowego i punkty rozszerzeń. Celem jest utrzymanie jednej prawdy o położeniu otworów od kernela CAD do symulacji i G-code.

## Dane z kernela

Każda cecha `hole` zapisuje w `body.manufacturingHoles`:

- `featureId`, średnicę, typ i informację `through`;
- `position`, `direction` i `depth` pojedynczego otworu;
- `instances[]` z pozycją, osią i głębokością każdego wystąpienia.

Pattern prostokątny i po ścieżce przesuwa pozycje. Pattern kołowy obraca pozycję i oś wokół wskazanej osi. Logika transformacji znajduje się w `manufacturing-hole-instances.js`, poza workerem OpenCascade, aby można ją było testować bez uruchamiania kernela.

## Operacja projektu

Operacja `drill` przechowuje stabilne `holeFeatureIds`, `toolId`, `cycleType`, `peckDepth`, `dwellSeconds`, `retractHeight`, `breakthroughDepth`, `feedRate`, `spindleRpm` i `postProcessorId`. `cycleType` wybiera wiercenie zwykłe, skokowe albo wiercenie z postojem. Pusta lista grup oznacza wszystkie rozpoznane otwory; interfejs domyślnie wybiera pierwszą grupę i najbliższe nieza-duże wiertło. Starsze operacje bez `cycleType` zachowują dotychczasowe zachowanie skokowe.

Normalizacja pozostaje zgodna wstecznie: starszy projekt bez operacji `drill` nie wymaga migracji schematu. Zapis operacji korzysta z istniejącego mechanizmu dokumentu, Undo/Redo i autozapisu.

## Biblioteka narzędzi projektu

`manufacturing.tools[]` przechowuje do 100 własnych wierteł, nawiertaków i gwintowników. Każde narzędzie ma stabilne ID, nazwę, typ, średnicę, długość rowków, wysięg, średnicę oprawki i liczbę ostrzy; gwintownik przechowuje również skok. Biblioteka jest częścią dokumentu `.madcad`, więc zapis, ponowne otwarcie, autozapis i Cofnij/Ponów korzystają z istniejącej transakcji projektu.

Operacja rozwiązuje preset albo narzędzie projektu po `toolId`. Nowe wiercenie uwzględnia własne wiertła przy doborze średnicy. Usunięcie narzędzia używanego przez operację jest blokowane, a utracone ID zatrzymuje obliczenie ścieżki i eksport. Nawiertak i gwintownik są świadomie odrzucane przez zwykłą operację wiercenia do czasu użycia dedykowanych operacji nawiertania i G84.

## Obliczanie i bezpieczeństwo

`calculateDrillingToolpath()`:

1. rozwiązuje wybraną bryłę, półfabrykat, WCS i płaszczyznę bezpieczną;
2. odrzuca brakujące grupy, nieprawidłowe dane, wiertło większe od otworu i oś inną niż Z;
3. rozpoczyna skrawanie od góry półfabrykatu, więc uwzględnia górny naddatek;
4. dodaje przebicie tylko dla otworu przelotowego;
5. kontroluje długość rowków, limit obrotów i wysokość wycofania;
6. wykonuje pełne wycofanie nad półfabrykatem po każdym skoku i przejazd na wysokości bezpiecznej między otworami.

Ścieżka zawsze zachowuje jawne segmenty `G0`/`G1`, z których korzystają symulacja i wspólny analizator kolizji. GRBL eksportuje te segmenty bezpośrednio; postój jest zapisywany jako `G4`. LinuxCNC i Mach3 używają odpowiednio `G81`, `G82` lub `G83`, trybu powrotu `G98` i kończą cykl przez `G80`; jawna ścieżka pozostaje bezpiecznym fallbackiem i źródłem kontroli programu.

## Dowody odbioru

- test jednostkowy: dwa otwory, liczba skoków, przebicie, G-code i symulacja;
- testy błędów: za duże wiertło oraz oś spoza Z;
- testy szyków: translacja prostokątna/po ścieżce i obrót kołowy pozycji oraz osi;
- Electron: rzeczywista bryła OpenCascade Ø8, automatyczny dobór wiertła, Undo/Redo, ponowne otwarcie, podgląd G-code, raport bezpieczeństwa i symulacja;
- pełny shard modelowania pozostaje zielony.

## Jawne ograniczenia i następny etap

P5.1 nie wykonuje wiercenia indeksowanego ani 5-osiowego. P5.2 dodało projektową bibliotekę wierteł, nawiertaków i gwintowników, dobór po średnicy, wybór wiercenia zwykłego/skokowego/z postojem oraz sterownikowe G81–G83 z jawnym fallbackiem. Pozostaje dedykowana operacja gwintowania z posuwem wynikającym ze skoku i G84.
