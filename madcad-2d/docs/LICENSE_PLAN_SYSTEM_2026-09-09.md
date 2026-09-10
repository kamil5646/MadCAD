# System kont i planów licencyjnych — 2026-09-09

MadCAD rozdziela trzy stany: bezpłatny użytek osobisty, jednorazową 40-dniową ocenę komercyjną oraz płatny plan komercyjny. Interfejs przypomina podejście Autodesk Fusion: użytkownik loguje się kontem, a aplikacja automatycznie pobiera uprawnienie zamiast wymagać przepisywania klucza.

## Zasady

- Każdy plan, także bezpłatny osobisty, wymaga konta MadCAD i pierwszego sprawdzenia przez Internet.
- Rejestracja i logowanie odbywają się przez `https://madcad.madmagsystem.pl/api/madcad/v1` na SEOHost MAD-MAG.
- Okres próbny może zostać rozpoczęty tylko raz dla konta. Datę przechowuje serwer, więc reinstalacja aplikacji go nie resetuje.
- Przed rozpoczęciem okresu próbnego konto musi potwierdzić adres e-mail jednorazowym kodem ważnym 24 godziny.
- Plan komercyjny nadaje i cofa administrator. Klient nie zawiera endpointu ani sekretu pozwalającego użytkownikowi zmienić własne uprawnienie.
- Plan obejmuje określoną liczbę aktywnych urządzeń. Administrator może zwolnić stanowisko.
- Po poprawnym sprawdzeniu online każdy plan działa offline maksymalnie 30 dni. Cofnięcie zegara unieważnia lokalną dzierżawę do kolejnej kontroli online.

## Ochrona danych

Hasło trafia do API wyłącznie przez HTTPS podczas rejestracji lub logowania i nie jest zapisywane przez aplikację. Serwer zapisuje wyłącznie hash hasła. Losowy token sesji jest haszowany na serwerze, a jego lokalna kopia szyfrowana przez Electron `safeStorage`. Odpowiedzi nie są buforowane, żądania mają limit rozmiaru i czasu, a logowanie, rejestracja oraz operacje administracyjne mają limity prób.

Odzyskiwanie konta wysyła jednorazowy kod ważny 60 minut. Publiczna odpowiedź nie ujawnia, czy adres jest zarejestrowany, a poprawna zmiana hasła unieważnia wszystkie wcześniejsze sesje.

Magazyn kont, token administratora i blokady plików znajdują się poza `public_html`. Repozytorium zawiera gotowy szablon wdrożenia w `server/seohost/madcad-license-api`, lecz nie zawiera danych produkcyjnych ani sekretów.

## Stan weryfikacji

- testy jednostkowe klienta obejmują walidację danych, plany z serwera, szyfrowany token, wygaśnięcie offline, cofnięcie zegara i wylogowanie;
- desktopowy test bezpieczeństwa potwierdza izolację kontekstu, minimalne API preload i zablokowany stan bez konta;
- pełny test interfejsu sprawdza startowe okno, formularz konta, brak lokalnego pola faktury/klucza oraz dalszy przepływ CAD;
- API produkcyjne działa pod HTTPS na `madcad.madmagsystem.pl`; bramka wydania sprawdza jego endpoint zdrowia.

Źródła koncepcji sprawdzone 09.09.2026:

- <https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/How-to-register-for-Fusion-360-for-Personal-Use.html>
- <https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/How-to-activate-start-up-or-educational-licensing-for-Fusion-360.html>
