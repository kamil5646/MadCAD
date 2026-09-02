# MadCAD — liniowy szkic 3D

## Zakres ukończonego pakietu

W obszarze `PROJEKTUJ` polecenie `Szkic 3D` tworzy odrębny szkic przestrzenny. Użytkownik wpisuje współrzędne XYZ końca odcinka, zatwierdza Enterem lub przyciskiem `Dodaj odcinek`, a następny odcinek automatycznie zaczyna się w poprzednim końcu. `Cofnij odcinek` usuwa ostatni segment bez opuszczania narzędzia. `Esc`, zamknięcie panelu i `Zakończ szkic` kończą tryb w kontrolowany sposób i pozostawiają gotową ścieżkę w projekcie.

Szkic 3D ma własny kontrakt `space: 3d`. Nie jest przypadkowo scalany ze szkicem 2D na płaszczyźnie XY i nie uruchamia płaskiego solvera więzów, profili ani przekroju Slice. Punkty zawierają trwałe wyrażenia X, Y i Z, linie zachowują trwałe identyfikatory, a walidacja odrzuca geometrię 2D nieobsługiwaną w tym trybie.

Widok przechodzi do orientacji izometrycznej, zachowuje obracanie kamery i pokazuje trzy osie. Przeglądarka projektu podpisuje przestrzenny szkic jako `3D`, a nie jako pozorną płaszczyznę `XY`.

## Integracja z modelowaniem

Liniowa ścieżka XYZ jest rozwiązywana jako uporządkowany otwarty łańcuch w trzech wymiarach. Rdzeń oblicza rzeczywistą długość 3D i przekazuje punkty do `Sweep`, `Pipe` oraz `Pattern` po ścieżce. Worker OpenCascade składa osobne krawędzie 3D w jeden wire i tworzy na nim profil roboczy. `Pipe` prowadzi po tej ścieżce dwa kołowe przekroje i odejmuje wewnętrzny od zewnętrznego, dlatego wynikiem jest dokładna rurowa bryła B-Rep.

## Walidacja

- 196 testów rdzenia potwierdza walidację, zapis XYZ, długość i przygotowanie ścieżki dla `Sweep`, `Pipe` oraz `Pattern`;
- 136 testów komponentów sprawdza panel współrzędnych, rozdział 2D/3D i oznaczenie w przeglądarce;
- `npm run verify:sketch-3d` uruchamia prawdziwe okno Electron, tworzy punkty `(0,0,0) → (30,0,0) → (30,20,15)`, buduje Pipe `⌀6 / ścianka 1 mm`, zapisuje operację i ponownie otwiera dokument;
- przed i po ponownym otwarciu bryła ma tę samą objętość `301,0549 mm³` i te same wymiary obwiedni;
- dowód wizualny jest zapisany w `artifacts/sketch-3d-pipe.png`.

## Następna kolejność

Pakiet nie zamyka całego punktu backlogu. Kolejne etapy to łuki i spline przestrzenne z kontrolą ciągłości, a następnie skojarzone ścieżki leżące na krawędziach lub powierzchniach modelu.
