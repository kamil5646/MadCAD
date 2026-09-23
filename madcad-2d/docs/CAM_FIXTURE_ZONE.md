# Pierwsza strefa uchwytu CAM

Setup frezowania lub cięcia 2D może przechowywać jedną prostopadłościenną strefę uchwytu. W panelu **Ustawienia → Strefa uchwytu** włącz kontrolę i wpisz rzeczywiste współrzędne minimalne oraz maksymalne X/Y/Z w układzie modelu (mm). Domyślne granice są tylko wartościami początkowymi, **nie pomiarem uchwytu**. Odstęp bezpieczeństwa także podaje się w mm.

Aktywna strefa jest czerwona w widoku CAM i trafia na arkusz ustawczy. Kontrola sprawdza każdy odcinek ścieżki narzędzia, w tym przejazdy szybkie, przeciw strefie powiększonej w XY o promień narzędzia i zadany odstęp oraz w Z o zadany odstęp. Przecięcie oznacza operację jako niebezpieczną i blokuje eksport pojedynczej operacji oraz całego programu. Nieprawidłowe wymiary strefy również unieważniają Setup. Zmiana jest zapisywana w `.madcad`, obsługuje Cofnij/Ponów, a projekty v18 są migrowane do v19 z domyślnie wyłączoną strefą.

To przybliżony test odsunięcia, **nie dowód bezkolizyjności na obrabiarce**. Nie obejmuje geometrii szczęk, śrub, oprawki, wrzeciona, kinematyki ani dojazdu do pierwszego punktu z aktualnej pozycji maszyny. Tokarka nie obsługuje jeszcze tej strefy. Operator musi zweryfikować rzeczywiste mocowanie, zero, korekcje i wykonać bezpieczny przejazd próbny.

Punkty kodu: `src/cad-core/manufacturing.js` (normalizacja, przecięcie odcinka z AABB, blokada NC), `src/modeling/ManufacturingPanel.jsx` (edycja), `src/modeling/ModelViewport.jsx` (widok), `src/cad-core/document.js` (migracja). Regresje: `src/cad-core/manufacturing.test.js`, `tests/cad-core.test.mjs`, `scripts/verify-manufacturing.cjs`.
