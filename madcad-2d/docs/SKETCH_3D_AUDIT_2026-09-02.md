# MadCAD — szkic 3D i krzywe przestrzenne

## Zakres ukończonego pakietu

W obszarze `PROJEKTUJ` polecenie `Szkic 3D` tworzy odrębny szkic przestrzenny. Użytkownik wybiera linię, łuk przez trzy punkty albo sześcienny spline Béziera, wpisuje współrzędne XYZ i zatwierdza Enterem lub przyciskiem `Dodaj krzywą`. Następna krzywa automatycznie zaczyna się we wspólnym końcu poprzedniej (G0). Dla spline można dodatkowo wybrać G1, które przejmuje styczną poprzedniej krzywej, albo G2, które przejmuje także jej wektor krzywizny; użytkownik steruje długością uchwytu, a współrzędne wymaganych uchwytów są obliczane automatycznie. `Cofnij krzywą` usuwa ostatnią krzywą bez opuszczania narzędzia. `Esc`, zamknięcie panelu i `Zakończ szkic` kończą tryb w kontrolowany sposób i pozostawiają gotową ścieżkę w projekcie.

Szkic 3D ma własny kontrakt `space: 3d`. Nie jest przypadkowo scalany ze szkicem 2D na płaszczyźnie XY i nie uruchamia płaskiego solvera więzów, profili ani przekroju Slice. Punkty, punkty pośrednie łuku i uchwyty splajnu zawierają trwałe wyrażenia X, Y i Z, krzywe zachowują trwałe identyfikatory, a walidacja odrzuca geometrię 2D nieobsługiwaną w tym trybie.

Widok przechodzi do orientacji izometrycznej, zachowuje obracanie kamery i pokazuje trzy osie. Przeglądarka projektu podpisuje przestrzenny szkic jako `3D`, a nie jako pozorną płaszczyznę `XY`.

## Integracja z modelowaniem

Ścieżka XYZ jest rozwiązywana jako uporządkowany otwarty łańcuch w trzech wymiarach. Rdzeń zachowuje dokładne segmenty i próbkuje je wyłącznie do równomiernego rozstawienia szyku po rzeczywistej długości zamiast po cięciwach. Worker OpenCascade składa linie, łuki kołowe oraz krzywe Béziera w jeden wire. `Sweep` i `Pipe` prowadzą po nim dokładny profil B-Rep; prawidłowy, łagodny łańcuch mieszany przechodzi zapis i ponowne otwarcie bez zmiany bryły.

## Walidacja

- 198 testów rdzenia potwierdza walidację, zapis XYZ, dokładne segmenty, obliczenia G1/G2, próbkowaną długość i przygotowanie ścieżki dla `Sweep`, `Pipe` oraz `Pattern`;
- 136 testów komponentów sprawdza panel współrzędnych, rozdział 2D/3D i oznaczenie w przeglądarce;
- `npm run verify:sketch-3d` uruchamia prawdziwe okno Electron, tworzy kolejno dwie linie, łuk 3D i spline 3D, buduje Pipe `⌀6 / ścianka 1 mm`, zapisuje operację i ponownie otwiera dokument;
- test wybiera G2 za łukiem kołowym, potwierdza wyliczone uchwyty, a przed i po ponownym otwarciu bryła ma tę samą objętość około `1451,148 mm³` i te same wymiary obwiedni;
- dowód wizualny jest zapisany w `artifacts/sketch-3d-pipe.png`.

## Następna kolejność

Kolejny etap to skojarzone ścieżki leżące na krawędziach lub powierzchniach modelu oraz bezpośrednia edycja istniejących punktów i uchwytów w widoku.
