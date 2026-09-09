# Szkicowanie UCS — 2026-09-09

## Wynik

MadCAD nie ogranicza już szkicu 2D do płaszczyzn `XY`, `XZ` i `YZ`. Szkic zapisuje opcjonalną ortonormalną ramę `origin/u/v/normal`, dzięki czemu może leżeć na dowolnej planarnej ścianie albo obróconej płaszczyźnie konstrukcyjnej.

Ta sama rama jest używana przez:

- siatkę, osie oraz kamerę ustawioną prostopadle do szkicu;
- zamianę pozycji kursora i snapu między współrzędnymi świata i szkicu;
- profile, geometrię referencyjną i podgląd bezpośredniego wyciągnięcia;
- Extrude i Thin Extrude, Patch, Surface Extrude/Revolve, Sweep, Loft, Thicken, Rib/Web, otwór z punktu szkicu oraz Split Face.

Stare projekty zachowują dotychczasowy format `plane/planeOffset`. Rama UCS jest polem opcjonalnym, więc nie wymaga podniesienia wersji schematu ani migracji istniejących plików.

## Weryfikacja

- `npm test`: 35 plików, 167 testów;
- `npm run test:core`: 224 testy;
- `npm run verify:ucs-sketch`: dokładna bryła B-Rep o objętości `2400 mm³` z profilu na płaszczyźnie `45°`, zgodność kamery z normalną `1.000` i kontrola zrzutu `artifacts/ucs-sketch.png`;
- `npm run verify:extrude-after-sketch`: zamknięty profil `11520 mm³` i Thin Extrude `400 mm³`;
- `npm run verify:surface-modeling`: pełna regresja Patch, powierzchni, Loft, Stitch, Extend i Thicken;
- `npm run lint` oraz `npm run build:ui`.
