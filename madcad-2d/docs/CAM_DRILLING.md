# CAM drilling — kontrakt P5.1

Ten dokument opisuje pionowy przepływ wiercenia 3-osiowego i punkty rozszerzeń. Celem jest utrzymanie jednej prawdy o położeniu otworów od kernela CAD do symulacji i G-code.

## Dane z kernela

Każda cecha `hole` zapisuje w `body.manufacturingHoles`:

- `featureId`, średnicę, typ i informację `through`;
- `position`, `direction` i `depth` pojedynczego otworu;
- `instances[]` z pozycją, osią i głębokością każdego wystąpienia.

Pattern prostokątny i po ścieżce przesuwa pozycje. Pattern kołowy obraca pozycję i oś wokół wskazanej osi. Logika transformacji znajduje się w `manufacturing-hole-instances.js`, poza workerem OpenCascade, aby można ją było testować bez uruchamiania kernela.

## Operacja projektu

Operacja `drill` przechowuje stabilne `holeFeatureIds`, `toolId`, `peckDepth`, `retractHeight`, `breakthroughDepth`, `feedRate`, `spindleRpm` i `postProcessorId`. Pusta lista grup oznacza wszystkie rozpoznane otwory; interfejs domyślnie wybiera pierwszą grupę i najbliższe nieza-duże wiertło.

Normalizacja pozostaje zgodna wstecznie: starszy projekt bez operacji `drill` nie wymaga migracji schematu. Zapis operacji korzysta z istniejącego mechanizmu dokumentu, Undo/Redo i autozapisu.

## Obliczanie i bezpieczeństwo

`calculateDrillingToolpath()`:

1. rozwiązuje wybraną bryłę, półfabrykat, WCS i płaszczyznę bezpieczną;
2. odrzuca brakujące grupy, nieprawidłowe dane, wiertło większe od otworu i oś inną niż Z;
3. rozpoczyna skrawanie od góry półfabrykatu, więc uwzględnia górny naddatek;
4. dodaje przebicie tylko dla otworu przelotowego;
5. kontroluje długość rowków, limit obrotów i wysokość wycofania;
6. wykonuje pełne wycofanie nad półfabrykatem po każdym skoku i przejazd na wysokości bezpiecznej między otworami.

Ścieżka używa jawnych segmentów `G0`/`G1`. Dzięki temu ten sam bezpieczny program działa w GRBL, LinuxCNC i Mach3, nawet gdy sterownik nie obsługuje cykli stałych. Symulacja materiału i wspólny analizator kolizji korzystają z tych samych segmentów.

## Dowody odbioru

- test jednostkowy: dwa otwory, liczba skoków, przebicie, G-code i symulacja;
- testy błędów: za duże wiertło oraz oś spoza Z;
- testy szyków: translacja prostokątna/po ścieżce i obrót kołowy pozycji oraz osi;
- Electron: rzeczywista bryła OpenCascade Ø8, automatyczny dobór wiertła, Undo/Redo, ponowne otwarcie, podgląd G-code, raport bezpieczeństwa i symulacja;
- pełny shard modelowania pozostaje zielony.

## Jawne ograniczenia i następny etap

P5.1 nie wykonuje wiercenia indeksowanego ani 5-osiowego. Nie ma jeszcze własnych narzędzi użytkownika, nawiertania, dwell, gwintowania i sterownikowych G81–G84. Te elementy należą do aktywnego P5.2; implementacja ma zachować jawne segmenty jako bezpieczny fallback postprocesora.
