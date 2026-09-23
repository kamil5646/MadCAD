# Układy robocze CAM G54–G59

Każdy Setup CAM przechowuje własny `workOffset` w projekcie. Nowe i starsze projekty używają domyślnie `G54`; w panelu Setup można wybrać `G54`–`G59`. Wybrany kod trafia do nagłówka programu pojedynczej operacji i całego Setupu (frezowanie, toczenie i cięcie 2D) oraz na arkusz ustawczy.

## Zakres i ograniczenia

- Wybór kodu **nie ustawia fizycznie zera na obrabiarce** i nie zapisuje wartości do sterownika. Operator musi zmierzyć i potwierdzić odpowiadający mu układ współrzędnych przed uruchomieniem.
- Dostępne są prostopadłościenne strefy uchwytów XYZ z zadanym odstępem. Ich przecięcie przez narzędzie albo przybliżoną oprawkę blokuje eksport. Drukowalny raport kolejnych mocowań zestawia układy WCS i ręczne kontrole operatora, lecz nie generuje ruchów między Setupami ani sondowania. Pełna geometria uchwytu, oprawki i kinematyka maszyny pozostają częścią [P5.5](../ROADMAP.md).
- Zakres i obsługa strefy są opisane osobno w [CAM_FIXTURE_ZONE.md](./CAM_FIXTURE_ZONE.md).
- Eksport obejmuje jeden Setup i używa jednego układu roboczego na jego cały program. Zmiana układu między Setupami wymaga odrębnego eksportu i kontroli na maszynie.
- W toczeniu początek każdej operacji jest osiągany kolejno przez odsunięcie X na średnicę bezpieczną, przesunięcie osiowe Z i powrót X do promienia startowego. Średnica bezpieczna musi mieścić się w zakresie tokarki. Strefy uchwytów tokarki nie są jeszcze modelowane, a początkowe położenie maszyny jest nieznane aplikacji.
- Przed rzeczywistą obróbką trzeba sprawdzić mocowanie, korekcje narzędzi, zero osi, przejazdy oraz zgodność postprocesora ze sterownikiem.

## Punkty kontrolne dla dalszych prac

- Kontrakt danych i walidacja: `src/cad-core/manufacturing.js` (`normalizeManufacturingSetup`, `validateManufacturing`, `analyzeManufacturingProgram`).
- Emisja kodu NC: `createMachineGcode` i `createManufacturingProgramGcode` w tym samym module.
- Interfejs: `src/modeling/ManufacturingPanel.jsx`; tłumaczenia: `src/modeling/i18n.js`.
- Testy: `tests/cad-core.test.mjs`, `scripts/verify-manufacturing.cjs`, `scripts/verify-cam-sequence.cjs`.
- Lokalna weryfikacja: `npm run test:core`, `npm run lint`, `npm run verify:manufacturing`, `npm run verify:turning`.
