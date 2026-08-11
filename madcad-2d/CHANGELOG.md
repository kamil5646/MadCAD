# Changelog

## Unreleased

- Dodano wejście dynamiczne w stylu AutoCAD dla linii: kliknięcie ustala początek, kursor kierunek, a wpisana długość zatwierdzona Enterem tworzy dokładny odcinek.
- Dodano podpowiedzi funkcji po najechaniu lub ustawieniu fokusu: każda funkcja pokazuje opis działania i skrót, a aliasy CAD można wpisywać z klawiatury i zatwierdzać Enterem albo spacją.
- Doprecyzowano licencję: bezpłatny jest wyłącznie użytek prywatny i niezarobkowy, a użytek komercyjny wymaga odrębnej płatnej licencji.
- Dodano wyświetlane przy każdym uruchomieniu przypomnienie o licencji prywatnej i dobrowolnym wsparciu projektu.
- Rozszerzono szkicowanie bezpośrednio myszą: figury powstają z kolejnych wskazań na płótnie, a formularz pozostaje opcjonalnym wejściem dokładnym.
- Usunięto stary interfejs 2D oraz jego nieużywaną warstwę CSS i kod uruchomieniowy.
- Usunięto aktywację tokenem, identyfikator urządzenia i okno licencyjne wyświetlane przy starcie.
- Dodano proste okno informacji o licencji bez klucza oraz poprawiono integrację nowego interfejsu z menu desktopowym.

## 6.0.1 (2026-08-11)

- Naprawiono tryb przypomnienia licencyjnego: kontrolki są aktywne, aplikacja pozostaje odblokowana,
  a test desktopowy potwierdza możliwość zamknięcia przypomnienia na macOS i Windows.
- Zaktualizowano Electron, electron-builder i Vite do wersji bez znanych podatności z bieżącego audytu npm.
- Ujednolicono bramki CI i wydania: lint, testy jednostkowe, audyt zależności, testy desktopowe,
  kontrola wersji tagu oraz kontrola pochodzenia tagu z gałęzi `main`.

## 6.0.0 (2026-08-10)

- Zmieniono model licencji na tryb przypomnienia licencyjnego: aplikacja pozostaje w pełni odblokowana,
  ale przy starcie pokazuje nieblokujące okno przypominające o wsparciu projektu i opcjonalnej aktywacji tokenu.
- Ujednolicono opisy/licencję w UI i dokumentacji do nowego modelu przypomnienia.
- Poprawiono responsywny układ interfejsu, aby elementy ribbonu i górnego paska nie nachodziły na siebie
  przy mniejszych szerokościach i wysokościach okna.

## 5.7.2 (2026-08-10)

- Tymczasowo wyłączono wymóg licencji: aplikacja startuje w pełni odblokowana,
  bez ekranu aktywacji tokenu (kod licencjonowania pozostaje w repo do
  ponownego włączenia w przyszłości).
- Naprawiono komunikat startowy i cykliczną walidację online, aby nie
  próbowały ponownie blokować sesji, gdy licencjonowanie jest wyłączone.

## 5.7.1 (2026-08-10)

- Naprawiono zduplikowany klucz tłumaczenia w silniku CAD (mogło nadpisywać poprawny komunikat).
- Dodano bramkę jakości w CI (lint + testy dla aplikacji i backendu rejestru licencji) przed wydaniem.
- Usunięto nieużywane pliki debugowe pozostawione w repozytorium.

## 5.7.0 (2026-08-04)

- Dodano dodatkowy widok przygotowania projektu do druku 3D bez usuwania narzędzi CAD 2D.
- Dodano wyciąganie prostokątów, okręgów i zamkniętych obszarów 2D do brył 3D.
- Dodano interaktywny podgląd modelu, kontrolę wymiarów stołu drukarki i eksport STL w milimetrach.
- Moduł 3D jest ładowany na żądanie, aby nie obciążać podstawowego trybu 2D.

## 5.6.4 (2026-05-04)

- Naprawiono przeciąganie okna aplikacji na Windowsie po ukryciu natywnego paska tytułu.
- Dodano widoczny górny obszar przeciągania z odstępem na systemowe przyciski okna.

## 3.1.5 (2026-03-08)

- Podbito wersję release po poprawkach instalatora aktualizacji na macOS.
- Zachowano wzmocniony mechanizm auto-update z logowaniem, retry i bezpiecznym restartem aplikacji.

## 3.1.4 (2026-03-07)

- Wzmocniono instalator aktualizacji na macOS.
- Dodano log plikowy aktualizatora, oczekiwanie na pełne zamknięcie procesu oraz ponawianie podmiany aplikacji.
- Usprawniono ponowne otwarcie aplikacji po udanej aktualizacji.

## 3.1.3 (2026-03-07)

- Usprawniono aktualizator aplikacji i dodano automatyczne sprawdzanie przy starcie.
- Dodano pytanie o instalację, gdy nowa wersja jest dostępna po uruchomieniu programu.
- Naprawiono czytelność komunikatów aktualizatora oraz usunięto fałszywy status `offline` przy starcie.
- Ujednolicono panel `Zapisz/Drukuj` z resztą interfejsu wstążki.

## 3.1.2 (2026-03-06)

### Dodano / zmieniono
- Ujednolicono zachowanie paska okna dla macOS i Windows (kontrolki natywne, bez zbędnego pustego pasa).
- Dopracowano układ górnej wstążki tak, aby nie kolidował z kontrolkami okna.
- Dodano autozapis awaryjny sesji (desktop) i automatyczne przywracanie po nieoczekiwanym zamknięciu.

### Poprawki
- Aplikacja nie pyta już o zapis przy wyjściu, gdy rysunek jest pusty.
- Poprawiono logikę podglądu i wydruku PDF: spójna skala między podglądem i finalnym PDF.
- Usunięto problem pustej drugiej strony przy wydruku.

### Artefakty release
- `MadCAD 2D-3.1.2-mac-arm64.zip`
- `MadCAD 2D-3.1.2-win-x64.exe`

## 3.1.1 (2026-03-04)

### Dodano / zmieniono
- Ujednolicono obsługę DWG w menu `Zapisz/Drukuj` dla importu i eksportu.
- Gdy ODA nie jest dostępne, pozycje DWG pokazują komunikat o braku dodatku i możliwość instalacji.
- Pozycje DWG przeniesiono na sam dół menu `Zapisz/Drukuj`.
- Dodano czytelniejszy przepływ instalacji ODA (status/komunikaty podczas akcji).

### Poprawki
- Usunięto pytanie onboardingowe o DWG przy starcie aplikacji.
- Usprawniono instalację ODA na macOS (lepsza walidacja i obsługa błędów).
- Dodano automatyczną instalację ODA także dla Windows (MSI) + fallback lokalny.
- Dodano fallback kompatybilności, gdy automatyczny bridge instalacji nie jest dostępny.

### Artefakty release
- `MadCAD 2D-3.1.1-mac-arm64.zip`
- `MadCAD 2D-3.1.1-win-x64.exe`
