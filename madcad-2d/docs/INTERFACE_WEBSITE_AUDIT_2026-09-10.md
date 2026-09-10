# Audyt interfejsu i strony MadCAD — 2026-09-10

## Wynik

Interfejs aplikacji przeszedł pełny pakiet 53 scenariuszy desktopowych na macOS arm64. Strona produkcyjna została sprawdzona w WebKit przy szerokości 1440 px i 390 px, bez poziomego przepełnienia i z poprawnym ładowaniem wszystkich grafik. Zbudowana lokalnie aplikacja 6.5.0 została podmieniona w `/Applications/MadCAD.app` i uruchomiona po instalacji.

## Co działa

- Start programu, obowiązkowe konto dla planu osobistego i wybór planu licencyjnego.
- Szkic 2D, bezpośrednie wpisywanie długości, widoczny snap, więzy, wymiary, edycja i usuwanie.
- Zachowanie osobnych szkiców, szkic na ścianie lub płaszczyźnie oraz wyciąganie po zakończeniu szkicu.
- Nawigacja myszy: zaznaczanie, przesuwanie, zoom i obrót prawym przyciskiem.
- Modelowanie bryłowe, powierzchniowe, blachy, elementy z tworzywa, historia i naprawa referencji.
- Import STEP, STL, 3MF i DWG przez lokalny LibreDWG; raport importu i narzędzia naprawy siatek.
- Arkusze techniczne 2D, widoki, przekroje, opisy, BOM oraz eksport PDF i DXF.
- Wytwarzanie, CAM, cięcie 2D, toczenie, podgląd G-code i osobny przepływ druku 3D.
- Odzyskiwanie projektu, autozapis, cofanie/ponawianie, diagnostyka projektu i bezpieczeństwo Electron.

## Poprawione w tym audycie

- Poszerzono i skrócono okno licencji, aby formularz oraz główne działanie mieściły się w jednym widoku.
- Szczegóły użycia komercyjnego przeniesiono do rozwijanej sekcji; tekst prawny nadal jest dostępny.
- Dodano test regresyjny wymagający widocznego przycisku wejścia do programu i domyślnie zwiniętych szczegółów.
- Na stronie dodano osobne, bezpośrednie pobieranie DMG, EXE i AppImage.
- Rozdzielono instrukcje pierwszego uruchomienia dla macOS, Windows i Linux.
- Zmniejszono dominację nagłówka hero i powiększono znaczenie rzeczywistego zrzutu aplikacji.
- Uporządkowano nawigację strony wokół możliwości, pobierania, licencji i pomocy.

## Znane ryzyka, które nie blokują wydania

- Paczki desktopowe nie mają płatnego podpisu Apple/Microsoft, więc system wymaga jednorazowego potwierdzenia uruchomienia.
- Duże moduły silnika CAD generują ostrzeżenie bundlera o rozmiarze paczki; są potrzebne do lokalnych obliczeń B-Rep i nie powodują błędu działania.
- Analiza MES jest narzędziem inżynierskim do weryfikacji; przy słabej zbieżności pokazuje stan „do sprawdzenia”, zamiast udawać pewny wynik.

## Dowody weryfikacji

- `npm run lint`
- `npm run build:ui`
- `npm run verify:desktop-suite:prepared` — 53/53
- `npm run dist:mac` z wyłączonym wykrywaniem certyfikatu — poprawna paczka arm64 bez podpisu
- `/Applications/MadCAD.app` — wersja 6.5.0 uruchomiona po podmianie; poprzednia kopia przeniesiona do Kosza
- Produkcyjne `index.html` i `styles.css` — sumy SHA-256 identyczne z plikami repozytorium
- Produkcyjny WebKit 1440 × 1000 i 390 × 844 — brak poziomego przepełnienia, 3 właściwe odnośniki pobierania i komplet obrazów
- Bezpośrednie pliki DMG, EXE i AppImage — odpowiedź HTTP 206 z oficjalnego GitHub Release
