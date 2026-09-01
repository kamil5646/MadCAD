# MadCAD — Form / SubD

## Ukończony pierwszy etap

Polecenie `Więcej brył → Form` tworzy kontrolną klatkę prostopadłościanu z 8 punktów i 6 czworokątnych ścian. Wymiary klatki, położenie oraz poziom wygładzenia są parametryczne i pozostają edytowalne w osi czasu.

Rdzeń `subdivision-form.js` wykonuje rzeczywisty algorytm Catmulla–Clarka:

- oblicza punkty ścian i krawędzi;
- przelicza położenia starych wierzchołków według ich sąsiedztwa;
- dzieli każdą ścianę czworokątną na cztery nowe ściany;
- zachowuje zamkniętą, spójnie zorientowaną powierzchnię manifold;
- normalizuje końcową obwiednię do parametrów klatki.

Poziomy 1–3 dają odpowiednio 24, 96 i 384 czworokątne płaty powierzchni granicznej. Zatwierdzenie trianguluje je i zszywa w OpenCascade do zamkniętej fasetowej bryły B-Rep. Dzięki temu wynik ma ściany, krawędzie, objętość, eksport STEP i może być wejściem dalszych operacji bryłowych. Nie jest to jeszcze aproksymacja NURBS o małej liczbie płatów — każda para trójkątów pozostaje jawnie widoczna w topologii.

## Walidacja

- test rdzenia sprawdza klatkę 40×30×20 mm na poziomie 2: 98 punktów powierzchni, 96 czworokątów i 192 trójkąty bez otwartych, niemanifold ani niespójnie zorientowanych krawędzi;
- ten sam test sprawdza parametry, graf zależności, produkcję osobnej bryły i odrzucenie poziomu spoza zakresu 1–3;
- test desktopowy `verify:form` uruchamia polecenie z prawdziwego menu, zmienia siedem parametrów, kontroluje 192 ściany B-Rep, dodatnią objętość, wymiary, brak overflow, Cofnij/Ponów i ponowne otwarcie projektu;
- dowód wizualny jest zapisywany w `artifacts/madcad-form.png`.

## Kolejne etapy

Następny pakiet powinien wprowadzić jawny tryb edycji klatki z wyborem punktów, krawędzi i ścian oraz wspólnym manipulatorem. Dopiero na tym fundamencie należy dodać Insert Edge, Crease, symetrię, Bridge i Fill Hole, a później konwersję do gładkich płatów B-Rep.
