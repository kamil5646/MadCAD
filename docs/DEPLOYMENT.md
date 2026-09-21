# Wdrożenie strony MadCAD

Źródłem strony jest `docs/index.html` oraz dwa obrazy:

- `docs/madcad-512.png`;
- `docs/readme-banner.png`.

Przed wdrożeniem numer wersji w metadanych, tytule, stopce i treści musi być
zgodny z `madcad-2d/package.json` oraz najnowszym GitHub Release. Nie wdrażaj
pliku z gałęzi roboczej przed przejściem kontroli repozytorium i CI.

## Bezpieczna publikacja na hostingu

1. Utwórz poza katalogiem publicznym archiwum obecnego `index.html` i zasobów.
2. Wgraj tylko trzy pliki źródłowe strony. Nie usuwaj `.htaccess`, stron błędów,
   `cgi-bin` ani katalogu `api/`.
3. Porównaj SHA-256 plików lokalnych i zdalnych.
4. Sprawdź przez HTTPS widoczną wersję, tytuł, grafikę oraz każdy przycisk
   pobierania Windows/macOS/Linux.
5. Potwierdź, że linki prowadzą do istniejących zasobów najnowszego GitHub
   Release i że strona nie pokazuje starszej wersji z pamięci podręcznej.

Produkcja jest ukończona dopiero po sprawdzeniu rzeczywistej domeny w
przeglądarce. Sam upload albo zielone GitHub Pages nie są dowodem wdrożenia na
osobnym hostingu.
