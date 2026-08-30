# Przebudowa interfejsu MadCAD

Aktualizacja: 2026-08-30

## Cel

Ujednolicić aplikację według hierarchii znanej z Worda i kontekstowego sposobu pracy AutoCAD-a, bez ponownego powiększania całej wstążki i bez mieszania narzędzi 2D, modelowania 3D oraz druku 3D.

## Kryteria ukończenia

- Wstążka używa tylko dwóch rozmiarów narzędzi, czytelnych etykiet i jednego koloru akcentu na grupę.
- Informacja o aktywnym poleceniu nie powtarza się jednocześnie w kilku miejscach.
- `ZARZĄDZAJ` jest pulpitem projektu, a nie pustym widokiem modelu.
- Arkusz 2D ma zwijane panele oraz widoczne sterowanie powiększeniem.
- Menu Plik wyraźnie rozdziela projekt, import, eksport 3D, dokumentację 2D i druk 3D.
- Płaszczyzny XY/XZ/YZ mają różne, jednoznaczne miniatury.
- Panel skrótów i okno licencji mają jasną hierarchię akcji.
- Układ przechodzi testy szerokiego i wąskiego okna, testy interakcji oraz kontrolę wizualną zrzutów.

## Postęp

- [x] Audyt aktualnej aplikacji: start, szkic, model 3D, arkusz, zarządzanie, Plik, skróty, panele, płaszczyzna i licencja.
- [x] Zapisano punkt wyjścia w `artifacts/full-interface-audit-2026-08-30`.
- [x] Pakiet 1: wspólna hierarchia wstążki i typografii.
- [x] Pakiet 2: jeden system komunikatów, snap i stan szkicu.
- [x] Pakiet 3: pulpit `ZARZĄDZAJ`, arkusz i menu Plik.
- [x] Pakiet 4: dialogi, skróty i licencja.
- [ ] Pełna walidacja i lokalna instalacja macOS.

## Dziennik

- 2026-08-30: rozpoczęto wdrażanie według audytu. Repozytorium było czyste na `main`, bez publikowania wydania.
- 2026-08-30: ujednolicono wstążkę: dwa poziomy ważności narzędzi, większe etykiety, spokojne kolory grup zamiast osobnego tła każdego przycisku i czytelniejsze stany wyłączone.
- 2026-08-30: usunięto wizualne powielanie aktywnego polecenia pomiędzy środkiem widoku a dolnym komunikatem. Zachowano dostępne semantycznie podpowiedzi dla testów i technologii asystujących.
- 2026-08-30: płaszczyzny XY/XZ/YZ otrzymały odrębne miniatury, pełne nazwy oraz klawisze `1`, `2`, `3`.
- 2026-08-30: `ZARZĄDZAJ` zmieniono z pustego modelu 3D w pulpit projektu z kondycją, liczbami i skrótami do działających paneli.
- 2026-08-30: arkusz 2D otrzymał powiększenie `50–200%`, polecenie `Dopasuj` oraz niezależnie zwijane panele arkuszy i właściwości.
- 2026-08-30: menu Plik poszerzono i zwiększono czytelność sekcji; panel skrótów doprecyzowuje przywracanie ustawień Autodesk, a okno licencji rozróżnia kontynuację, zakup i wsparcie.
- 2026-08-30: kontrola po pakietach: `build:ui`, `verify:interface-consistency` oraz rozszerzony `verify:drawing-workspace` zakończone powodzeniem; zrzuty sprawdzone wizualnie.
