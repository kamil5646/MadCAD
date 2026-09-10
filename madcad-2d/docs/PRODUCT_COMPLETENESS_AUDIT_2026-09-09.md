# Audyt kompletności produktu — 2026-09-09

## Cel

Przekrojowo sprawdzić, czy funkcje opisane jako gotowe mają wykonywalną bramkę desktopową i czy kandydat wydania nie może ominąć istniejących scenariuszy Electron.

## Stan wejściowy

- Repozytorium zawierało 53 unikalne scenariusze Electron podpięte do poleceń `verify:*`.
- Zwykłe CI uruchamiało bezpośrednio tylko cztery z nich: modelowanie, import modelu, nawigację i granicę bezpieczeństwa Electron.
- Pozostałe obszary, między innymi arkusz 2D, powierzchnie, blacha, siatki, CAM, analizy, warstwy, bloki, komponenty i zarządzanie projektem, nie tworzyły obowiązkowej bramki przed instalatorem.

## Wprowadzone zabezpieczenia

1. `desktop-verification-manifest.cjs` jest jednym wykazem wszystkich 53 scenariuszy, podzielonym na pięć części: `modeling`, `interoperability`, `interface`, `project` i `analysis`.
2. `run-desktop-verification-suite.cjs` uruchamia wybraną część albo komplet scenariuszy na jednym gotowym buildzie, przerywa na pierwszym błędzie i raportuje czasy.
3. `verify-product-completeness.cjs` odrzuca:
   - scenariusz istniejący w `package.json`, ale nieobecny w pełnej bramce;
   - plik `verify-*.cjs` bez jawnego przypisania;
   - duplikaty i nieistniejące pliki;
   - zakodowaną na stałe aktualną wersję schematu dokumentu;
   - brak którejkolwiek części w CI, pełnej bramki w wydaniu albo benchmarków MES 3D;
   - więcej niż jeden aktywny punkt roadmapy.
4. CI uruchamia każdą z pięciu części na macOS i Windows. Kandydat wydania uruchamia komplet na obu systemach przed budową paczek.

## Luki wykryte przez pierwsze uruchomienie

- Testy warstw i bloków nadal szukały dawnych osobnych przycisków. Zostały przeprowadzone przez aktualne menu `Warstwy i bloki` i ponownie zaliczyły pełne operacje, w tym Undo/Redo.
- Test komponentów oczekiwał nieaktualnego schematu v15 mimo bieżącego v17. Komponenty, arkusz 2D, CAM i główny scenariusz modelowania pobierają teraz `DOCUMENT_SCHEMA_VERSION` ze źródła zamiast duplikować numer.
- Test linkowanych projektów otwierał nieistniejący dawny kafelek `Menedżer`. Przepływ korzysta teraz z aktualnej ścieżki `ZARZĄDZAJ → Komponenty` w języku polskim i angielskim.
- Snap kierunkowy poziomy/pionowy ukrywał podpowiedź więzu automatycznego. Podpowiedź i zapis więzu działają teraz równolegle ze snapem osiowym lub siatkowym, ale pozostają wyłączone przy snapie do końca albo przecięcia.
- Audyt zależności wykrył dwie podatności wysokiego ryzyka (`js-yaml` i pośredni `sharp`) oraz dwie umiarkowane w narzędziach testowych Vitest. Zaktualizowano `manifold-3d` do 3.5.3, Vitest do 4.1.11, Vite do 8.2.2 i bezpośrednio powiązane wersje blokady; `npm audit` raportuje 0 podatności.
- Ponowne uruchomienie całej bramki pod obciążeniem wykryło dwa wyścigi w samych scenariuszach: F3 był wysyłany przed zakończeniem wejścia do szkicu, a klik automatycznej naprawy referencji nie czekał na aktywny przycisk. Oba testy synchronizują się teraz z rzeczywistym stanem interfejsu zamiast polegać na czasie renderowania.
- Równoległa kontrola obciążyła CPU na tyle, że poprawnie liczony zestaw 14 benchmarków MES przekroczył dawny limit 15 s o mniej niż sekundę. Limit wyłącznie dla tego ciężkiego testu zwiększono do 30 s; kryteria numeryczne i wszystkie bramki jakości solvera pozostały bez zmian.

## Weryfikacja lokalna

- manifest kompletności: 53/53 scenariusze przypisane;
- pełna bramka macOS: 53/53 scenariusze potwierdzone łącznie po naprawie wykrytych rozjazdów;
- `modeling`: 13/13;
- `interoperability`: 10/10;
- `interface`: 13/13;
- `project`: 7/7;
- `analysis`: 10/10;
- warstwy: tworzenie, przypisanie, typ kreskowy, blokada wyboru i układ bez overflow;
- bloki: definicja, dwa wystąpienia, atrybut, Undo/Redo i rozbicie;
- komponenty: 2 definicje, 4 wystąpienia, jointy, Motion Link, Contact Set, konfiguracje, storyboard i kolizje dokładne;
- sterowanie kamerą, odzyskiwanie po awarii, menu Plik, skróty, dostępność, snap i usuwanie przeszły rzeczywiste scenariusze Electron.
- po aktualizacji bezpieczeństwa: 184/184 testy UI, 224/224 testy rdzenia, lint, build produkcyjny, kontrola repozytorium i manifest kompletności przeszły lokalnie.

## Zamknięcie P1.37a

Pełny manifest 53 scenariuszy przeszedł na macOS i Windows w GitHub Actions. Oficjalny run wydania `34477547067` zakończył wszystkie bramki powodzeniem i opublikował zweryfikowane paczki Windows/macOS/Linux oraz odpowiadające im sumy SHA-256 w wydaniu <https://github.com/kamil5646/MadCAD/releases/tag/v6.5.0>. P1.37a jest zamknięte.
