# Układy robocze CAM G54–G59

Każdy Setup CAM przechowuje własny `workOffset` w projekcie. Nowe i starsze projekty używają domyślnie `G54`; w panelu Setup można wybrać `G54`–`G59`. Wybrany kod trafia do nagłówka programu pojedynczej operacji i całego Setupu (frezowanie, toczenie i cięcie 2D) oraz na arkusz ustawczy.

## Zakres i ograniczenia

- Wybór kodu **nie ustawia fizycznie zera na obrabiarce** i nie zapisuje wartości do sterownika. Operator musi zmierzyć i potwierdzić odpowiadający mu układ współrzędnych przed uruchomieniem.
- Dostępna jest pojedyncza prostopadłościenna strefa uchwytu XYZ z zadanym odstępem. Jej przecięcie przez ścieżkę blokuje eksport. Nie zastępuje pełnej symulacji uchwytu, oprawki i kinematyki maszyny; brak też operacji sondowania i raportu kolejnych zamocowań. To dalsze części [P5.5](../ROADMAP.md).
- Zakres i obsługa strefy są opisane osobno w [CAM_FIXTURE_ZONE.md](./CAM_FIXTURE_ZONE.md).
- Eksport obejmuje jeden Setup i używa jednego układu roboczego na jego cały program. Zmiana układu między Setupami wymaga odrębnego eksportu i kontroli na maszynie.
- Przed rzeczywistą obróbką trzeba sprawdzić mocowanie, korekcje narzędzi, zero osi, przejazdy oraz zgodność postprocesora ze sterownikiem.

## Punkty kontrolne dla dalszych prac

- Kontrakt danych i walidacja: `src/cad-core/manufacturing.js` (`normalizeManufacturingSetup`, `validateManufacturingDocument`).
- Emisja kodu NC: `generateManufacturingGCode` i `generateManufacturingProgramGCode` w tym samym module.
- Interfejs: `src/modeling/ManufacturingPanel.jsx`; tłumaczenia: `src/modeling/i18n.js`.
- Testy: `src/cad-core/manufacturing.test.js`, `tests/cad-core.test.mjs`, `scripts/verify-manufacturing.cjs`.
- Lokalna weryfikacja: `npm run test:core`, `npm run lint`, `npm run verify:manufacturing`, `npm run verify:turning`.
