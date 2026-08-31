# MadCAD — audyt modelowania powierzchniowego

Data: 2026-08-31  
Zakres: obszar `PROJEKTUJ`, jądro OpenCascade, historia parametryczna i lokalna aplikacja macOS

## Wynik

MadCAD obsługuje teraz trzy współpracujące operacje powierzchniowe:

- `Patch` tworzy dokładną planarną powierzchnię B-Rep z zamkniętego profilu szkicu, także na płaszczyznach XY, XZ i YZ.
- `Surface Extrude` tworzy otwartą powierzchnię z zamkniętego profilu albo ciągłego otwartego łańcucha linii.
- `Thicken` nadaje powierzchni grubość jednostronną albo symetryczną i zamienia ją w zamkniętą bryłę B-Rep.

Każda operacja jest zapisana w osi czasu, zachowuje zależność od szkicu i bierze udział w grafie wpływu zmian. Powierzchnia oraz bryła nie są mylone: mają osobne oznaczenie, osobne foldery w przeglądarce i właściwe działania kontekstowe.

## Zachowanie interfejsu

- Narzędzia znajdują się w jednym menu `Powierzchnie` w grupie `UTWÓRZ`.
- Zaznaczony profil proponuje `Patch` oraz `Wyciągnij powierzchnię`.
- Zaznaczona powierzchnia proponuje `Pogrub` jako działanie główne.
- Panel polecenia pokazuje wyłącznie parametry danej operacji.
- Powierzchnia jest półprzezroczysta i ma cyjanowe krawędzie, a po pogrubieniu wraca do wyglądu bryły.
- Polecenia linii poleceń: `PA`/`PATCH`, `SE`/`SURFACEEXTRUDE`, `TH`/`THICKEN`/`POGRUB`.

## Zabezpieczenia przepływu

- Boolean, Pattern i właściwości masy wymagające bryły nie są proponowane dla powierzchni.
- STL, 3MF i przygotowanie druku 3D wymagają zamkniętej bryły; STEP zachowuje dokładną geometrię powierzchniową.
- Anulowanie panelu nie zapisuje operacji, a zatwierdzenie tworzy jeden krok historii.
- Szkic źródłowy pozostaje w dokumencie i nadal steruje przebudową powierzchni oraz pogrubienia.
- Przesunięcie powierzchni przed `Thicken` jest zachowane; test przesuwa powierzchnię o 35 mm i sprawdza położenie wynikowej bryły.

## Weryfikacja

| Kontrola | Wynik |
| --- | --- |
| Testy jądra | 187/187 |
| Testy UI | 115/115 |
| ESLint | bez błędów i ostrzeżeń |
| Build Vite | poprawny |
| `Patch 48 × 32 → Thicken 2 mm` | bryła 3072 mm³ |
| `Surface Extrude Ø24 × 18 → Move 35 mm → Thicken 2 mm` | bryła 2940,5307 mm³, środek X = 35 mm |
| Przepełnienie poziome 1440 px | brak |
| Pełny scenariusz modelowania | poprawny, od szkicu przez B-Rep do eksportów |
| Szkic → Extrude | profil zamknięty i otwarty łańcuch poprawne |
| Kamera | wybór, pan, orbita PPM, zoom i powrót widoku poprawne |
| Spójność interfejsu | brak duplikatów i przepełnienia; menu `Powierzchnie` w `UTWÓRZ` |

Scenariusz wykonuje `scripts/verify-surface-modeling.cjs`. Zrzut końcowy znajduje się w `artifacts/madcad-surface-modeling.png`.

## Instalacja lokalna

- Zbudowano aplikację arm64 bez automatycznego wykrywania certyfikatu producenta, aby uniknąć blokującego podpisu z pęku kluczy.
- `/Applications/MadCAD.app` ma lokalny podpis ad-hoc i przechodzi `codesign --verify --deep --strict`.
- Zainstalowany `app.asar` jest identyczny z wynikiem kompilacji: SHA-256 `1e28ad1fed94900747f6881be251294f3d984018d3083b0269171a888fd8489d`.
- Poprzednia aplikacja została zachowana odwracalnie w Koszu jako `MadCAD-before-surfaces-20260831.app`; pośredni build kontrolny jako `MadCAD-before-surface-memory-fix-20260831.app`.
- Aplikacja została uruchomiona z `/Applications`; nie utworzono wydania ani tagu GitHub.
