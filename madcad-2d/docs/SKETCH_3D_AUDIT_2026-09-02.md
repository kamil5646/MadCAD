# MadCAD — szkic 3D i krzywe przestrzenne

## Zakres ukończonego pakietu

W obszarze `PROJEKTUJ` polecenie `Szkic 3D` tworzy odrębny szkic przestrzenny. Użytkownik wybiera linię, łuk przez trzy punkty albo sześcienny spline Béziera, wpisuje współrzędne XYZ i zatwierdza Enterem lub przyciskiem `Dodaj krzywą`. Następna krzywa automatycznie zaczyna się we wspólnym końcu poprzedniej (G0). Dla spline można dodatkowo wybrać G1, które przejmuje styczną poprzedniej krzywej, albo G2, które przejmuje także jej wektor krzywizny; użytkownik steruje długością uchwytu, a współrzędne wymaganych uchwytów są obliczane automatycznie. `Cofnij krzywą` usuwa ostatnią krzywą bez opuszczania narzędzia. `Esc`, zamknięcie panelu i `Zakończ szkic` kończą tryb w kontrolowany sposób i pozostawiają gotową ścieżkę w projekcie.

Szkic 3D ma własny kontrakt `space: 3d`. Nie jest przypadkowo scalany ze szkicem 2D na płaszczyźnie XY i nie uruchamia płaskiego solvera więzów, profili ani przekroju Slice. Punkty, punkty pośrednie łuku i uchwyty splajnu zawierają trwałe wyrażenia X, Y i Z, krzywe zachowują trwałe identyfikatory, a walidacja odrzuca geometrię 2D nieobsługiwaną w tym trybie.

Widok przechodzi do orientacji izometrycznej, zachowuje obracanie kamery i pokazuje trzy osie. Przeglądarka projektu podpisuje przestrzenny szkic jako `3D`, a nie jako pozorną płaszczyznę `XY`.

Narzędzie `Pobierz krawędzie` pozwala podczas szkicowania 3D wskazać prostą krawędź istniejącej bryły. Powstaje zablokowana linia `projected` z trwałą referencją topologiczną. Jej dwa końce zachowują rzeczywiste XYZ i są automatycznie synchronizowane, gdy przebudowa źródłowej bryły przesunie krawędź. Polecenie ma własny czytelny panel `Pobierz/Anuluj`, a po zatwierdzeniu wraca do rozpoczętego szkicu 3D zamiast wyłączać inne narzędzie.

Zaznaczoną linię, łuk albo spline można otworzyć poleceniem `Edytuj krzywą`. Panel pozwala zmienić dokładne współrzędne XYZ, punkt pośredni łuku, uchwyty spline oraz warunek G0/G1/G2. Edycja zachowuje identyfikatory krzywych i współdzielonych punktów, automatycznie przelicza dalszy łańcuch ciągłości i wraca do rozpoczętego polecenia szkicu 3D. Skojarzona geometria `projected` pozostaje tylko do odczytu, ponieważ jej przebieg kontroluje bryła źródłowa.

Po zaznaczeniu jednej krzywej widok pokazuje jej bezpośrednie uchwyty: początek i koniec, punkt pośredni łuku albo dwa uchwyty spline połączone liniami kontrolnymi. Przeciąganie działa w aktualnym widoku kamery, pokazuje na żywo współrzędne XYZ i zapisuje jedną transakcję historii po puszczeniu myszy. Uchwyt sterowany warunkiem G1/G2 porusza się tylko wzdłuż obliczonej stycznej, a uchwyt całkowicie wynikowy dla G2 jest widoczny, lecz zablokowany; dzięki temu bezpośrednia edycja nie zrywa zadanej ciągłości.

## Integracja z modelowaniem

Ścieżka XYZ jest rozwiązywana jako uporządkowany otwarty łańcuch w trzech wymiarach. Rdzeń zachowuje dokładne segmenty i próbkuje je wyłącznie do równomiernego rozstawienia szyku po rzeczywistej długości zamiast po cięciwach. Worker OpenCascade składa linie, łuki kołowe oraz krzywe Béziera w jeden wire. `Sweep` i `Pipe` prowadzą po nim dokładny profil B-Rep; prawidłowy, łagodny łańcuch mieszany przechodzi zapis i ponowne otwarcie bez zmiany bryły.

## Walidacja

- 200 testów rdzenia potwierdza walidację, zapis XYZ, dokładne segmenty, obliczenia i przebudowę G1/G2, synchronizację skojarzonej krawędzi, próbkowaną długość i przygotowanie ścieżki dla `Sweep`, `Pipe` oraz `Pattern`;
- 136 testów komponentów sprawdza panel współrzędnych, rozdział 2D/3D i oznaczenie w przeglądarce;
- `npm run verify:sketch-3d` uruchamia prawdziwe okno Electron, tworzy kolejno dwie linie, łuk 3D i spline 3D, sprawdza zestaw bezpośrednich uchwytów i przesuwa koniec spline w widoku, wykonuje dokładną edycję panelową G2, wraca do aktywnego szkicowania, buduje Pipe `⌀6 / ścianka 1 mm`, zapisuje operację i ponownie otwiera dokument, a następnie pobiera rzeczywistą prostą krawędź Pipe do drugiego szkicu 3D;
- test potwierdza przebudowę wspólnego łańcucha oraz wyliczonych uchwytów G2, a przed i po ponownym otwarciu Pipe zachowuje tę samą dokładną objętość i wymiary obwiedni;
- dowody wizualne są zapisane w `artifacts/sketch-3d-handles.png` oraz `artifacts/sketch-3d-pipe.png`.

## Następna kolejność

Kolejny etap to zachowanie dokładnej geometrii skojarzonych krawędzi krzywoliniowych i ścieżek leżących na powierzchniach modelu.
