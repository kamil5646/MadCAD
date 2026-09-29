# Wdrożenie strony MadCAD

Repozytorium zawiera dwie odrębne strony:

- GitHub Pages: `docs/index.html` oraz dwa obrazy:

  - `docs/madcad-512.png`;
  - `docs/readme-banner.png`.
- Produkcyjna domena `madcad.madmagsystem.pl` na SEOHOST: źródłem jest
  `madcad-2d/server/seohost/madcad-site/index.html`, a katalog docelowy to
  `/home/srv104412/domains/madcad.madmagsystem.pl/public_html/`.
  `styles.css` oraz oba obrazy z `assets/` są już na serwerze i mają identyczne
  sumy SHA-256 jak pliki repozytorium (kontrola 2026-09-29).

Przed wdrożeniem numer wersji w metadanych, tytule, stopce i treści musi być
zgodny z `madcad-2d/package.json` oraz najnowszym GitHub Release. Nie wdrażaj
pliku z gałęzi roboczej przed przejściem kontroli repozytorium i CI.

## Bezpieczna publikacja na SEOHOST

1. Po potwierdzeniu publikacji i zasobów najnowszego GitHub Release utwórz poza
   katalogiem publicznym kopię dotychczasowego `index.html`.
2. Wgraj nowy `index.html` z `madcad-2d/server/seohost/madcad-site/` do pliku
   tymczasowego w katalogu publicznym i przenieś go atomowo na `index.html`.
   Nie usuwaj `.htaccess`, stron błędów, `cgi-bin`, `api/`, `assets/` ani CSS.
3. Porównaj SHA-256 lokalnego i zdalnego `index.html`.
4. Sprawdź przez HTTPS widoczną wersję, tytuł, grafikę oraz każdy przycisk
   pobierania Windows/macOS/Linux.
5. Potwierdź, że linki prowadzą do istniejących zasobów najnowszego GitHub
   Release i że strona nie pokazuje starszej wersji z pamięci podręcznej.

GitHub Pages publikuj osobno ze źródła `docs/`; jego zielony status nie
aktualizuje domeny SEOHOST.

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
`v6.5.5`, natomiast najnowszy GitHub Release był **v6.5.22**. Odczyt produkcji
powtórzony 2026-09-29 nadal pokazał **6.5.5**. To znany
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
