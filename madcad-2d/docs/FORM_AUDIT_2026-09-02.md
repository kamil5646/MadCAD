# MadCAD — Form / SubD

## Ukończone etapy

Polecenie `Więcej brył → Form` tworzy kontrolną klatkę prostopadłościanu z 8 punktów i 6 czworokątnych ścian. Wymiary klatki, położenie oraz poziom wygładzenia są parametryczne i pozostają edytowalne w osi czasu.

Klatka jest widoczna nad powierzchnią niezależnie od zasłonięcia. Każdy punkt ma powiększony obszar trafienia, można go wskazać bezpośrednio w widoku, a aktywny punkt jest wyróżniany. Aktywny punkt można przeciągnąć myszą w płaszczyźnie widoku albo prowadzić czerwonym, zielonym i niebieskim uchwytem wyłącznie po osi X, Y lub Z, z krokiem 0,5 mm albo 0,1 mm z klawiszem modyfikującym. Trzy parametry przesunięcia XYZ pozwalają też wpisać dokładną deformację i przebudowują podgląd B-Rep. Osiem wektorów przesunięcia jest zapisywanych w operacji, obsługuje parametry użytkownika, Cofnij/Ponów i ponowne otwarcie projektu.

Tryb symetrii X, Y albo Z wiąże wybrany narożnik z jego lustrzaną parą. Przeciąganie i dokładne wpisanie wartości aktualizuje oba punkty, odwracając znak tylko na osi symetrii; wyrażenia parametryczne są zachowywane jako wyrażenia, a nie zamieniane na stałe.

Każdą z 12 krawędzi klatki można wskazać bezpośrednio w widoku lub wybrać z listy i przełączyć między stanem gładkim a `Crease`. Gładkie krawędzie są turkusowe, ostre fioletowe, a aktualnie wybrana krawędź żółta. Crease zmienia geometrię, a nie tylko jej wygląd: punkt krawędzi pozostaje średnią końców, dwa ostre odcinki stosują regułę `(6P + N1 + N2) / 8`, a trzy lub więcej zachowują narożnik. Ostre krawędzie są propagowane przez kolejne poziomy podziału.

Wybranie krawędzi przenosi manipulator do jej środka. Przeciągnięcie osi przesuwa oba punkty końcowe o identyczną wartość, nie zmienia współrzędnych na pozostałych osiach i respektuje aktywną symetrię. Dzięki temu wybór krawędzi, jej transformacja oraz Crease działają w jednym trybie, bez przełączania narzędzi.

Każdą z 6 ścian klatki można również wskazać bezpośrednio na modelu lub wybrać z listy. Wybrana ściana otrzymuje półprzezroczyste żółte wyróżnienie, a manipulator przechodzi do jej środka. Przeciągnięcie osi przesuwa razem wszystkie cztery narożniki ściany, pozostawia przeciwległą ścianę bez zmian i respektuje aktywną symetrię.

Panel właściwości ma jeden jawny tryb edycji: punkt, krawędź albo ściana. Pokazuje wyłącznie pola dotyczące aktualnego wyboru; wskazanie elementu bezpośrednio na modelu przełącza ten tryb automatycznie. Parametry całej klatki i jej położenie pozostają dostępne niezależnie od wyboru.

`Insert Edge` uruchamia się dla wybranej krawędzi i prowadzi pętlę przez kolejne przeciwległe krawędzie wszystkich ścian quad aż do zamknięcia pierścienia. Dla klatki bazowej dodaje 4 punkty, zwiększa liczbę ścian kontrolnych z 6 do 10 i zachowuje zamkniętą topologię manifold. Położenie pętli jest parametryczne w zakresie `0,05–0,95`; jeżeli pętla biegnie wzdłuż osi aktywnej symetrii, pozostaje w środku `0,5`, ponieważ pojedyncza niesymetryczna pętla nie miałaby lustrzanej pary. Nowe punkty można wskazywać i przesuwać tym samym manipulatorem co punkty bazowe.

Rdzeń `subdivision-form.js` wykonuje rzeczywisty algorytm Catmulla–Clarka:

- oblicza punkty ścian i krawędzi;
- przelicza położenia starych wierzchołków według ich sąsiedztwa;
- dzieli każdą ścianę czworokątną na cztery nowe ściany;
- zachowuje zamkniętą, spójnie zorientowaną powierzchnię manifold;
- normalizuje końcową obwiednię do parametrów klatki.

Poziomy 1–3 dają odpowiednio 24, 96 i 384 czworokątne płaty powierzchni granicznej. Zatwierdzenie trianguluje je i zszywa w OpenCascade do zamkniętej fasetowej bryły B-Rep. Dzięki temu wynik ma ściany, krawędzie, objętość, eksport STEP i może być wejściem dalszych operacji bryłowych. Nie jest to jeszcze aproksymacja NURBS o małej liczbie płatów — każda para trójkątów pozostaje jawnie widoczna w topologii.

## Walidacja

- test rdzenia sprawdza klatkę 40×30×20 mm na poziomie 2: 98 punktów powierzchni, 96 czworokątów i 192 trójkąty bez otwartych, niemanifold ani niespójnie zorientowanych krawędzi; osobno kontroluje Insert Edge 8→12 punktów i 6→10 ścian;
- ten sam test sprawdza deformację klatki, wspólne przesunięcie czterech punktów ściany, propagację Crease, zmianę geometrii bez utraty manifold, parametryczne przesunięcie punktu, graf zależności, produkcję osobnej bryły i odrzucenie niepoprawnego poziomu lub indeksu krawędzi;
- test desktopowy `verify:form` uruchamia polecenie z prawdziwego menu, wybiera i przeciąga punkt klatki swobodnie oraz po pojedynczej osi, wskazuje krawędź i ścianę, przesuwa odpowiednio dwa i cztery narożniki wspólnym manipulatorem, ustawia Crease, dodaje Insert Edge, wskazuje i przesuwa nowy punkt, kontroluje 12 punktów, 20 krawędzi, 10 ścian klatki, 320 ścian B-Rep, dodatnią objętość, wymiary, brak overflow, Cofnij/Ponów i ponowne otwarcie projektu;
- dowód wizualny jest zapisywany w `artifacts/madcad-form.png`.

## Kolejne etapy

Następny pakiet powinien dodać Bridge i Fill Hole, a później konwersję do gładkich płatów B-Rep.
