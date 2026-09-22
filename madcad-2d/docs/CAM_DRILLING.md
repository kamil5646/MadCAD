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

`manufacturing.tools[]` przechowuje do 100 własnych wierteł, nawiertaków i gwintowników. Każde narzędzie ma stabilne ID, nazwę, typ, średnicę, długość rowków, wysięg, średnicę oprawki i liczbę ostrzy; nawiertak przechowuje kąt ostrza, a gwintownik skok. Biblioteka jest częścią dokumentu `.madcad`, więc zapis, ponowne otwarcie, autozapis i Cofnij/Ponów korzystają z istniejącej transakcji projektu.

Operacja rozwiązuje preset albo narzędzie projektu po `toolId`. Wiercenie uwzględnia własne wiertła przy doborze średnicy. Usunięcie narzędzia używanego przez operację jest blokowane, a utracone ID zatrzymuje obliczenie ścieżki i eksport. Nawiertak i gwintownik są odrzucane przez zwykłe wiercenie i mają dedykowane operacje.

## Nawiertanie geometryczne

Operacja `spot` działa na tych samych stabilnych grupach i wystąpieniach otworów co wiercenie oraz gwintowanie. Użytkownik podaje średnicę docelową fazy, natomiast głębokość stożka nie jest swobodnym parametrem. Dla średnicy otworu `d`, średnicy docelowej `D` i kąta ostrza `α` wynosi `(D - d) / (2 × tan(α / 2))`. Dzięki temu zmiana średnicy otworu, narzędzia albo kąta automatycznie przebudowuje bezpieczną głębokość.

Obliczenie odrzuca średnicę docelową nie większą od otworu lub większą od narzędzia, brakujące dane głębokości, oś inną niż Z oraz przekroczenie długości rowków albo wysięgu. Ścieżka zachowuje jawne przejazdy i wejścia `G0`/`G1`, dlatego działa we wszystkich frezarskich postprocesorach i we wspólnej symulacji bez udawania cyklu sterownika.

## Pogłębianie walcowe

Operacja `counterbore` obrabia płaskie gniazdo współosiowe z rozpoznanym otworem. Płaski frez musi mieścić się w otworze pilotowym, dzięki czemu każde wejście osiowe odbywa się w istniejącej pustej przestrzeni. Głębokość jest dzielona przez `maxStepdown`, a każda warstwa otrzymuje koncentryczne przejścia z zakładką 50% średnicy freza aż do średnicy docelowej. Pozwala to obrabiać także gniazda szersze niż dwa promienie narzędzia bez pozostawiania pierścienia materiału.

Operacja sprawdza średnicę gniazda względem otworu i freza, dostępną głębokość otworu, oś Z, długość ostrza, wysięg, limit wrzeciona oraz wysokość wycofania. Eksport pozostaje jawną, przenośną ścieżką liniową; przybliżenie okręgów ma krok nie większy niż około 1,5 mm łuku i jest widoczne w symulacji oraz raporcie usuwanego materiału.

## Raport kompletności otworów

Kontrola programu buduje wymagany proces dla każdej stabilnej grupy otworów na podstawie semantyki modelu: każde gniazdo wymaga wiercenia, `countersink` wymaga wcześniejszego nawiertania, `counterbore` wymaga pogłębiania walcowego, a oznaczenie gwintu wymaga gwintowania. Liczone są wyłącznie operacje z prawidłową ścieżką, które obejmują daną grupę albo wszystkie rozpoznane otwory.

Raport pokazuje liczbę kompletnych wystąpień, brakujące etapy i błędną kolejność. Bezpieczna kolejność etapów otworowych to nawiertanie → wiercenie → pogłębianie walcowe → gwintowanie. Brak albo odwrócona kolejność blokuje status „Program gotowy do symulacji”, ale nie zmienia modelu ani operacji użytkownika.

Przycisk „Uporządkuj operacje” buduje graf zależności zamiast wykonywać zwykłe sortowanie listy. Planowanie powierzchni pozostaje przed dalszą obróbką, kontur zewnętrzny jest wykonywany na końcu, a nakładające się grupy otworów zachowują kolejność technologiczną. Spośród operacji aktualnie gotowych algorytm wybiera najpierw tę samą oprawkę, dzięki czemu ogranicza zmiany narzędzia bez łamania zależności. Wynik jest pojedynczą transakcją projektu i można go cofnąć.

Na stronie kontroli przycisk „Eksportuj cały program” zapisuje jeden plik dla wszystkich operacji aktywnego Setupu. Program ma jeden nagłówek modalny i jedno zakończenie, zachowuje kolejność operacji, pomija zbędną ponowną zmianę tego samego narzędzia i nadal uruchamia pełną kontrolę ścieżek, kolizji oraz kompletności obróbki otworów przed zapisem. Postprocesor jest wybierany dla całego programu; synchronizowane gwintowanie automatycznie wymusza sterownik operacji G84.

Każdą operację można zduplikować oraz przesunąć o jedną pozycję w górę lub w dół. Kopia dostaje nowe trwałe ID i unikalną nazwę, zachowując narzędzie, skojarzoną geometrię i parametry. Ręczny ruch jest zatwierdzany tylko wtedy, gdy nadal zachowuje planowanie przed dalszą obróbką, kontur na końcu oraz kolejność etapów otworowych. Wszystkie te zmiany działają z Cofnij/Ponów.

„Arkusz ustawczy” eksportuje samodzielny, drukowalny plik HTML w układzie A4 poziomo. Dokument zawiera nazwę projektu i Setupu, obrabiarkę, bryłę, gabaryty półfabrykatu, współrzędne zera WCS, płaszczyznę bezpieczną, szacowany czas, tabelę narzędzi z przypisanymi operacjami, pełną kolejność programu oraz wynik kontroli przed uruchomieniem. Dane użytkownika są kodowane przed umieszczeniem w HTML.

## Gwintowanie synchronizowane

Operacja `tap` używa wyłącznie gwintownika z biblioteki projektu. Dla każdego rozpoznanego otworu sprawdza oś Z, długość roboczą narzędzia i średnicę otworu pilotowego względem przybliżenia `średnica nominalna - skok`. Posuw nie jest polem swobodnym: zawsze wynosi `spindleRpm × pitch`, dzięki czemu zapis projektu nie może rozjechać synchronizacji.

LinuxCNC i Mach3 otrzymują `G98`, osobny `G84` dla każdego położenia i zamknięcie `G80`. Postprocesory bez deklarowanej synchronizacji wrzeciona, w tym GRBL, są blokowane zamiast otrzymywać niebezpieczny jawny fallback. Symulacja i kontrola kolizji nadal korzystają z jawnych segmentów wejścia oraz zsynchronizowanego wycofania.

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
- testy błędów: za duże wiertło, nieprawidłowa średnica nawiertania oraz oś spoza Z;
- testy szyków: translacja prostokątna/po ścieżce i obrót kołowy pozycji oraz osi;
- Electron: rzeczywista bryła OpenCascade Ø8, automatyczny dobór wiertła, Undo/Redo, ponowne otwarcie, podgląd G-code, raport bezpieczeństwa i symulacja;
- raport kompletności: wymagane etapy z semantyki otworu, brak operacji i nieprawidłowa kolejność wielu narzędzi;
- pełny shard modelowania pozostaje zielony.

## Jawne ograniczenia i następny etap

P5.1–P5.3 nie wykonują wiercenia indeksowanego ani 5-osiowego. Dostępne są projektowa biblioteka wierteł, nawiertaków i gwintowników, dobór po średnicy, wiercenie zwykłe/skokowe/z postojem, geometryczne nawiertanie i pogłębianie walcowe, G81–G83 z jawnym fallbackiem, synchronizowane G84, raport kompletności oraz automatyczne porządkowanie operacji. Pogłębianie stożkowe jest realizowane przez geometryczne nawiertanie do zadanej średnicy.
