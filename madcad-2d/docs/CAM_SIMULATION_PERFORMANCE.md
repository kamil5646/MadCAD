# Wydajność symulacji CAM

Stan: 2026-09-23. Ten dokument opisuje aktualną ścieżkę obliczeń, nie deklaruje
zmierzonego przyspieszenia animacji na konkretnej maszynie.

## Przepływ danych

`ModelingWorkspace.jsx` oblicza ścieżki aktywnego Setupu raz na zmianę dokumentu,
brył, Setupu lub obszaru roboczego. Z tych samych ścieżek powstaje raport
bezpieczeństwa, widok operacji i symulacja. Sama zmiana postępu animacji nie
przelicza ścieżek ani raportu. `ManufacturingPanel.jsx` wykorzystuje te wyniki
zamiast ponownie liczyć je podczas każdego renderowania.

`simulateMaterialRemoval` przechodzi po już obliczonych ścieżkach do wskazanego
postępu. Nie buduje listy obiektów `{ segment, tool, operationId }` ani jej
kopii dla prefiksu animacji. `ModelViewport.jsx` otrzymuje jedną listę segmentów
oraz liczbę widocznych pozycji; nie dostaje nowej kopii listy przy każdym kroku.
Bufory pozycji i kolorów są alokowane jako tablice typowane o dokładnym rozmiarze.

## Weryfikacja

- `npm test -- src/cad-core/manufacturing.test.js`: porównuje wynik symulacji
  zwykłej i z ponownie użytymi ścieżkami dla dwóch operacji oraz postępu
  0/25/50/100%; osobno przechodzi przez 150 tys. segmentów.
- `npm run verify:manufacturing`: sprawdza rzeczywisty panel Electron, widok
  ścieżki, postęp symulacji i eksport CAM.
- `npm run lint` oraz pełne `npm test` pilnują regresji komponentów i rdzenia.

## Pozostały koszt

Każda zmiana postępu nadal odtwarza usuwanie materiału od początku do nowego
prefiksu i odtwarza geometrię linii w widoku 3D. Dla bardzo dużego programu
następnym krokiem jest stan przyrostowy symulacji oraz aktualizacja zakresu
rysowania GPU bez ponownego tworzenia całego bufora. Tego etapu nie należy
uznawać za wykonaną część obecnej optymalizacji.
