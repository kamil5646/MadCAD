# Współpraca przy MadCAD

1. Załóż issue opisujące błąd albo proponowaną zmianę.
2. Pracuj na osobnej gałęzi i nie dodawaj wygenerowanych katalogów `node_modules`, `dist`, `release` ani `artifacts`.
3. W katalogu `madcad-2d` uruchom `npm ci`, a przed PR: `npm run lint`, `npm test`, `npm run test:core:coverage` i `npm run build:ui`.
4. Zmiany renderera/Electron muszą zachować `contextIsolation`, sandbox, ograniczoną powierzchnię preload i walidację nadawcy IPC.
5. Zmiany formatu projektu wymagają migracji, walidacji i testu round-trip bez utraty danych.
6. Nie zmieniaj licencji, EULA ani workflowu wydania bez jawnego opisu skutków w PR.

Przesłanie wkładu nie zmienia własności projektu ani warunków licencji. Autor oświadcza, że ma prawo przekazać swój wkład do użycia w MadCAD na warunkach repozytorium.
