# MadCAD — pierwszy projekt CAD / Your first CAD project

Aktualne dla `6.5.30`. Interaktywną wersję otwiera przycisk **Samouczek** w menu **Pomoc**.

## Ścieżka PL

1. Utwórz nowy projekt i nadaj mu nazwę.
2. Wybierz płaszczyznę XY, narysuj zamknięty prostokąt i wpisz wymiary w mm.
3. Dodaj wymiary i więzy, aż szkic pokaże stan „W pełni związany”.
4. Zakończ szkic, zaznacz profil i wykonaj Wyciągnięcie.
5. Zaznacz górną płaską ścianę i dwie krawędzie; dodaj otwór z odsunięciami.
6. Sprawdź część narzędziami Zmierz, Masa i Analiza.
7. Zmień wymiar szkicu, sprawdź przebudowę bryły oraz Cofnij/Ponów.
8. Zapisz `.madcad`, otwórz go ponownie i wyeksportuj dokładną bryłę STEP albo rysunek DXF.

## English path

1. Create and name a new project.
2. Choose XY, draw a closed rectangle, and enter dimensions in millimeters.
3. Add dimensions and constraints until the sketch is “Fully constrained”.
4. Finish the sketch, select its profile, and Extrude it.
5. Select the top planar face and two edges; add a hole with parametric offsets.
6. Check the part with Measure, Mass, and Analysis.
7. Edit a sketch dimension, check the rebuilt solid, and verify Undo/Redo.
8. Save and reopen `.madcad`, then export an exact STEP solid or DXF drawing.

## Znane ograniczenia / Known limitations

- DWG jest konwertowany lokalnie do DXF przez zainstalowany GNU LibreDWG lub ODA File Converter; złożone obiekty niestandardowe mogą zostać pominięte przez wybrany konwerter.
- STEP zachowuje dokładną geometrię B-Rep. STL/3MF wczytują się jako natywne siatki do pomiaru, transformacji i eksportu; narzędzia ścian i krawędzi wymagają B-Rep.
- Złożona zmiana historii może wymagać ręcznej naprawy referencji B-Rep.

MadCAD jest publikowany dla Windows x64, macOS Apple Silicon i Linux x64 (AppImage). Każda paczka ma sumę SHA-256.
