# Strefy uchwytów CAM

Setup frezowania lub cięcia 2D może przechowywać do 20 prostopadłościennych stref uchwytów. W panelu **Ustawienia → Strefy uchwytów** dodaj i nazwij każdą strefę, wpisz rzeczywiste współrzędne minimalne oraz maksymalne X/Y/Z w układzie modelu (mm), a następnie ją włącz. Domyślne granice są tylko wartościami początkowymi, **nie pomiarem uchwytu**. Odstęp bezpieczeństwa także podaje się w mm.

Aktywne strefy są czerwone w widoku CAM i trafiają na arkusz ustawczy. Kontrola sprawdza każdy odcinek ścieżki narzędzia, w tym przejazdy szybkie, przeciw każdej strefie powiększonej w XY o promień narzędzia i zadany odstęp oraz w Z o zadany odstęp. Przecięcie oznacza operację jako niebezpieczną i blokuje eksport pojedynczej operacji oraz całego programu. Nieprawidłowe wymiary aktywnej strefy również unieważniają Setup. Zmiany są zapisywane w `.madcad` i obsługują Cofnij/Ponów. Schemat projektu v20 migruje pojedynczą strefę z v19 do listy bez utraty jej parametrów.

To przybliżony test odsunięcia, **nie dowód bezkolizyjności na obrabiarce**. Nie obejmuje geometrii szczęk, śrub, oprawki, wrzeciona, kinematyki ani dojazdu do pierwszego punktu z aktualnej pozycji maszyny. Tokarka nie obsługuje jeszcze tej strefy. Operator musi zweryfikować rzeczywiste mocowanie, zero, korekcje i wykonać bezpieczny przejazd próbny.

Punkty kodu: `src/cad-core/manufacturing.js` (normalizacja, przecięcie odcinka z AABB, blokada NC), `src/modeling/ManufacturingPanel.jsx` (edycja), `src/modeling/ModelViewport.jsx` (widok), `src/cad-core/document.js` (migracja). Regresje: `src/cad-core/manufacturing.test.js`, `tests/cad-core.test.mjs`, `scripts/verify-manufacturing.cjs`.
