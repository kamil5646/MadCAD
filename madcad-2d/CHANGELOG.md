# Changelog

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
