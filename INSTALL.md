# Instalacja MadCAD bez certyfikatu

Pobieraj MadCAD wyłącznie z [oficjalnych wydań GitHub](https://github.com/kamil5646/MadCAD/releases/latest). Każda paczka ma obok plik `.sha256`, a wbudowany aktualizator sprawdza sumę przed jej otwarciem.

## Windows 10/11

Najłatwiejsza opcja to plik `MadCAD-*-win-x64.exe`:

1. Uruchom pobrany instalator.
2. Jeżeli pojawi się SmartScreen, wybierz **Więcej informacji**, sprawdź nazwę `MadCAD`, a następnie **Uruchom mimo to**.
3. Instalator działa jednym kliknięciem na koncie użytkownika, nie prosi o uprawnienia administratora, tworzy skróty i uruchamia MadCAD po zakończeniu.

Jeżeli nie chcesz nic instalować, pobierz `MadCAD-*-win-x64.zip`, rozpakuj cały katalog i uruchom znajdujący się w nim plik `MadCAD.exe`.

Bez płatnego podpisu Authenticode nie można legalnie usunąć ostrzeżenia SmartScreen. Nie należy wyłączać SmartScreen w ustawieniach systemu.

## macOS Apple Silicon

1. Pobierz polecany `MadCAD-*-mac-arm64.dmg`, otwórz go i przeciągnij MadCAD do folderu Aplikacje. ZIP jest wariantem awaryjnym.
2. Przy pierwszym uruchomieniu kliknij MadCAD w folderze Aplikacje z wciśniętym `Control`, wybierz **Otwórz**, a następnie ponownie **Otwórz**.

Nie wyłączaj Gatekeepera dla całego systemu.

## Linux x64

Nadaj plikowi AppImage prawo uruchomienia i otwórz go bez instalacji:

```sh
chmod +x MadCAD-*-linux-x86_64.AppImage
./MadCAD-*-linux-x86_64.AppImage
```
