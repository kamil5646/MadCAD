# MadCAD — audyt modelowania powierzchniowego

Data: 2026-08-31  
Zakres: obszar `PROJEKTUJ`, jądro OpenCascade, historia parametryczna i lokalna aplikacja macOS

## Wynik

MadCAD obsługuje teraz dziesięć współpracujących operacji powierzchniowych:

- `Patch` tworzy dokładną planarną powierzchnię B-Rep z zamkniętego profilu szkicu, także na płaszczyznach XY, XZ i YZ.
- `Surface Extrude` tworzy otwartą powierzchnię z zamkniętego profilu albo ciągłego otwartego łańcucha linii.
- `Surface Revolve` obraca zamknięty profil albo ciągły otwarty łańcuch wokół osi bazowej lub konstrukcyjnej o parametryczny kąt.
- `Surface Sweep` prowadzi zamknięty profil albo ciągły otwarty łańcuch po osobnym ciągłym szkicu ścieżki.
- `Surface Loft` łączy dwa zamknięte profile z osobnych równoległych szkiców gładką albo odcinkową otwartą powierzchnią.
- `Surface Offset` odsuwa istniejącą powierzchnię B-Rep o dodatnią albo ujemną odległość bez zamiany na siatkę.
- `Stitch` zszywa wspólne krawędzie wielu powierzchni z zadaną tolerancją; otwarty wynik pozostaje płaszczem, a szczelny automatycznie staje się bryłą.
- `Surface Trim` usuwa z powierzchni dokładny obszar przecinający bryłę tnącą i pozwala zachować albo skonsumować narzędzie.
- `Surface Extend` przedłuża wskazaną prostą krawędź pojedynczej planarnej powierzchni o parametryczną odległość i normalizuje wynik do jednego płaszcza.
- `Thicken` nadaje powierzchni grubość jednostronną albo symetryczną i zamienia ją w zamkniętą bryłę B-Rep.

Każda operacja jest zapisana w osi czasu, zachowuje zależność od szkicu i bierze udział w grafie wpływu zmian. Powierzchnia oraz bryła nie są mylone: mają osobne oznaczenie, osobne foldery w przeglądarce i właściwe działania kontekstowe.

## Zachowanie interfejsu

- Narzędzia znajdują się w jednym menu `Powierzchnie` w grupie `UTWÓRZ`; `Surface Extrude`, `Surface Revolve` i `Surface Sweep` są także dostępne w menu `Utwórz 3D` podczas edycji szkicu.
- Zaznaczony profil proponuje `Patch` oraz `Wyciągnij powierzchnię`.
- Zaznaczona powierzchnia proponuje `Pogrub` jako działanie główne oraz `Odsuń powierzchnię` jako działanie kontekstowe.
- Wielokrotny wybór samych powierzchni proponuje `Zszyj powierzchnie`; panel pokazuje liczbę elementów i tolerancję.
- Wspólny wybór jednej powierzchni i jednej bryły proponuje `Przytnij powierzchnię`; panel jawnie pokazuje oba obiekty i opcję zachowania bryły tnącej.
- Wybór jednej prostej krawędzi powierzchni proponuje `Przedłuż powierzchnię`; krawędzie brył nadal proponują Fillet i Chamfer.
- Panel polecenia pokazuje wyłącznie parametry danej operacji.
- Powierzchnia jest półprzezroczysta i ma cyjanowe krawędzie, a po pogrubieniu wraca do wyglądu bryły.
- Polecenia linii poleceń: `PA`/`PATCH`, `SE`/`SURFACEEXTRUDE`, `SR`/`SURFACEREVOLVE`, `SS`/`SURFACESWEEP`, `SLO`/`SURFACELOFT`, `SO`/`SURFACEOFFSET`, `STI`/`STITCH`, `STR`/`SURFACETRIM`, `SXT`/`SURFACEEXTEND`, `TH`/`THICKEN`/`POGRUB`.

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
| Testy UI | 116/116 |
| ESLint | bez błędów i ostrzeżeń |
| Build Vite | poprawny |
| `Patch 48 × 32 → Thicken 2 mm` | bryła 3072 mm³ |
| `Surface Extrude Ø24 × 18 → Move 35 mm → Thicken 2 mm` | bryła 2940,5307 mm³, środek X = 35 mm |
| `Surface Revolve R12 × 20, 270° → Thicken 2 mm` | powierzchnia 1507,9645 mm², następnie bryła 2764,6015 mm³ |
| `Surface Sweep 12 mm po ścieżce 25 + 18 mm → Thicken 2 mm` | powierzchnia 516 mm², następnie bryła 984 mm³ |
| `Surface Loft 24 × 16 → 12 × 8 na wysokości 20 mm → Surface Offset 2 mm → Thicken 2 mm` | powierzchnia przed i po odsunięciu 1243,5121 mm², następnie bryła 3360 mm³ |
| `Surface Trim` powierzchni 48 × 32 mm bryłą przecinającą połowę | powierzchnia maleje z 1536 do 768 mm², następnie `Thicken 2 mm` daje 1536 mm³ |
| `Surface Extend` krawędzi 32 mm o 10 mm | powierzchnia rośnie z 1536 do 1856 mm², następnie `Thicken 2 mm` daje dokładnie 3712 mm³ |
| `Stitch` pięciu ścian pudełka 20 × 10 × 8 mm | jeden otwarty płaszcz 680 mm² |
| `Stitch` pięciu ścian → `Thicken 2 mm` | jeden zamknięty wynik 545,5238 mm³ |
| `Stitch` sześciu ścian pudełka 20 × 10 × 8 mm | automatyczna szczelna bryła 1600 mm³ |
| Przepełnienie poziome 1440 px | brak |
| Pełny scenariusz modelowania | poprawny, od szkicu przez B-Rep do eksportów |
| Szkic → Extrude | profil zamknięty i otwarty łańcuch poprawne |
| Kamera | wybór, pan, orbita PPM, zoom i powrót widoku poprawne |
| Spójność interfejsu | brak duplikatów i przepełnienia; menu `Powierzchnie` w `UTWÓRZ` |

Scenariusz wykonuje `scripts/verify-surface-modeling.cjs`. Zrzut końcowy znajduje się w `artifacts/madcad-surface-modeling.png`.

## Instalacja lokalna

- Zbudowano aplikację arm64 bez automatycznego wykrywania certyfikatu producenta, aby uniknąć blokującego podpisu z pęku kluczy.
- `/Applications/MadCAD.app` ma lokalny podpis ad-hoc i przechodzi `codesign --verify --deep --strict`.
- Zainstalowany `app.asar` jest identyczny z wynikiem kompilacji pakietu Surface Trim/Extend: SHA-256 `d8048f8df71f430d11f8d17eba4ea3005dd8e5b165bad7c75f905980f7689afe`.
- Poprzednia aplikacja została zachowana odwracalnie w Koszu jako `MadCAD-before-surface-trim-extend-20260901.app`; wcześniejsze kopie kontrolne pozostały nienaruszone.
- Aplikacja została uruchomiona z `/Applications`; nie utworzono wydania ani tagu GitHub.
