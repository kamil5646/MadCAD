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
- [x] Pełna walidacja i lokalna instalacja macOS.

## Dziennik

- 2026-08-30: rozpoczęto wdrażanie według audytu. Repozytorium było czyste na `main`, bez publikowania wydania.
- 2026-08-30: ujednolicono wstążkę: dwa poziomy ważności narzędzi, większe etykiety, spokojne kolory grup zamiast osobnego tła każdego przycisku i czytelniejsze stany wyłączone.
- 2026-08-30: usunięto wizualne powielanie aktywnego polecenia pomiędzy środkiem widoku a dolnym komunikatem. Zachowano dostępne semantycznie podpowiedzi dla testów i technologii asystujących.
- 2026-08-30: płaszczyzny XY/XZ/YZ otrzymały odrębne miniatury, pełne nazwy oraz klawisze `1`, `2`, `3`.
- 2026-08-30: `ZARZĄDZAJ` zmieniono z pustego modelu 3D w pulpit projektu z kondycją, liczbami i skrótami do działających paneli.
- 2026-08-30: arkusz 2D otrzymał powiększenie `50–200%`, polecenie `Dopasuj` oraz niezależnie zwijane panele arkuszy i właściwości.
- 2026-08-30: menu Plik poszerzono i zwiększono czytelność sekcji; panel skrótów doprecyzowuje przywracanie ustawień Autodesk, a okno licencji rozróżnia kontynuację, zakup i wsparcie.
- 2026-08-30: kontrola po pakietach: `build:ui`, `verify:interface-consistency` oraz rozszerzony `verify:drawing-workspace` zakończone powodzeniem; zrzuty sprawdzone wizualnie.
- 2026-08-30: testy komponentów `vitest`: 25 plików, 105 testów — wszystkie zaliczone. Test płaszczyzn rozszerzony o jednoznaczne nazwy dostępności.
- 2026-08-30: zaliczone testy `assistive-tech`, `snap-feedback`, `sketch-drawing`, `start-experience`, `docked-panels`, `ribbon-overflow` i `command-line`. W teście paska poleceń uwzględniono tolerancję 1 px dla skalowania ekranu macOS.
- 2026-08-30: zaliczone testy wyciągnięcia po zakończeniu szkicu (profil zamknięty i otwarty), nawigacji kamery prawym przyciskiem/kółkiem oraz importu STEP, STL i 3MF.
- 2026-08-30: pełny test modelowania wykrył dwie nieprzetłumaczone podpowiedzi nawigacji w angielskim interfejsie; dodano brakujące tłumaczenia przed ponownym uruchomieniem całej kontroli.
- 2026-08-30: ponowny pełny `verify-modeling` zakończony powodzeniem: szkice, dokładne wpisywanie długości, wyciągnięcia, operacje B-Rep, import/eksport, druk, skalowanie 100/150/200%, dostępność i angielski interfejs bez wykrytych polskich pozostałości.
- 2026-08-30: zbudowano wyłącznie lokalny pakiet macOS 6.4.6, bez publikacji i bez certyfikatu dystrybucyjnego. Pakiet podpisano lokalnie ad-hoc, zweryfikowano `codesign --verify --deep --strict` i zainstalowano w `/Applications/MadCAD.app`; suma SHA-256 `app.asar` jest zgodna z przetestowanym buildem.
- 2026-08-30: po kontroli na rzeczywistym ekranie poprawiono ucinanie drugiego rzędu ikon wstążki bez zwiększania jej całkowitej wysokości. Ramka fokusowa pozostaje widoczna przy sterowaniu klawiaturą, ale nie dubluje obramowania zakładki klikniętej myszą. Ponownie zaliczono testy arkusza 2D, przepełnienia wstążki i technologii asystujących oraz sprawdzono zrzut wizualnie.
- 2026-08-30: po ponownej kontroli dodano 4 px dolnego marginesu wstążki, ponieważ nieucięty drugi rząd nadal był optycznie zbyt blisko krawędzi. Zachowano dotychczasowy rozmiar ikon i etykiet.
