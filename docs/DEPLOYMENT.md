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

## Migawka produkcji i kontrola Cloudflare (2026-09-27)

Odczyt tylko do weryfikacji, bez wdrożenia: autorytatywne serwery DNS domeny
`madmagsystem.pl` to `ns1.seohost.pl` i `ns2.seohost.pl`, a
`madcad.madmagsystem.pl` wskazuje bezpośrednio `91.236.131.76`. Odpowiedź
HTTPS ma `HTTP/2 200` i `server: LiteSpeed`, bez nagłówków `cf-*`/Cloudflare.
To potwierdza brak Cloudflare na obserwowanej ścieżce DNS/HTTP, ale nie dowodzi
usunięcia ewentualnego konta Cloudflare poza repozytorium.

W tej samej chwili strona produkcyjna reklamowała **6.5.5** i prowadziła do
`v6.5.5`, natomiast najnowszy GitHub Release był **v6.5.22**. To znany
rozjazd wymagający usunięcia przy końcowej publikacji produktu, nie zgoda na
wcześniejsze wydanie ani na nadpisanie produkcji z gałęzi roboczej. Przed
końcowym wdrożeniem powtórz odczyt: stan DNS/HTTP i wersji może się zmienić.

```sh
dig +short madmagsystem.pl NS
dig +short madcad.madmagsystem.pl A
curl -sSI https://madcad.madmagsystem.pl/
curl -sS https://madcad.madmagsystem.pl/ | rg 'Pobierz MadCAD|releases/tag/'
gh release list --limit 5
```
