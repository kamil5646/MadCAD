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
- [x] Ponowny audyt z aktualnych zrzutów po uwagach o kolizjach i niespójnych proporcjach.
- [x] Usunięcie duplikatów w `ZARZĄDZAJ` i regresja funkcjonalna paneli projektu.
- [x] Responsywne wykorzystanie wolnego miejsca we wstążce szkicu i zmniejszenie ikon.
- [x] Zachowanie widoczności wcześniejszych szkiców podczas tworzenia następnego szkicu.
- [x] Wspólna edycja starej i nowej geometrii szkicu oraz naprawa projektów zapisanych z rozdzielonymi szkicami tej samej płaszczyzny.

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
- 2026-08-30: ponowny audyt wizualny wykonano na świeżych zrzutach: start szeroki i wąski, licencja, wybór płaszczyzny, model 3D, menu konstrukcji, pulpit projektu, arkusz 2D, menu Plik, skróty oraz odzyskiwanie po awarii.
- 2026-08-30: naprawiono kolizję paska tytułu przy szerokości 1100 px. Etykiety lewego paska przechodzą wtedy w czytelne ikony, a nazwa dokumentu ma gwarantowany odstęp od lewej i prawej grupy. Test mierzy rzeczywiste prostokąty elementów i odrzuca ich nachodzenie.
- 2026-08-30: karta `ZARZĄDZAJ` nie dubluje już dziewięciu poleceń na wstążce i w treści. Wstążka jest w tym obszarze zwinięta, a polecenia zebrano w trzy sekcje: `PARAMETRY I WERSJE`, `KONTROLA`, `STRUKTURA`. Dodano brakujące tworzenie części, złożenia i zapisane widoki.
- 2026-08-30: `Zapisane widoki` automatycznie wracają do modelu 3D i otwierają panel nad widokiem, aby użytkownik nie musiał ręcznie wyłączać jednego obszaru przed użyciem drugiego.
- 2026-08-30: menu konstrukcji poszerzono do 340 px i usunięto ucinanie opisów wielokropkiem. Test potwierdza, że pełne opisy sześciu rodzajów płaszczyzn mieszczą się w menu i nie wychodzą poza okno.
- 2026-08-30: stopkę komunikatu licencyjnego ustawiono w przewidywalnym układzie: trzy działania informacyjne w pierwszym rzędzie, a główne `Przejdź do programu` osobno po prawej. Na małym ekranie akcje przechodzą w jedną kolumnę.
- 2026-08-30: po poprawkach zaliczone: `lint`, 105/105 testów komponentów, 185/185 testów core, `start-experience`, `interface-consistency`, `project-snapshots`, `project-health`, `project-dependencies`, `named-views`, `drawing-workspace`, `ribbon-overflow`, `extrude-after-sketch` i `assistive-tech`. Jednorazowy `UnknownVizError` testu zrzutu wystąpił przy równoległym uruchomieniu wielu instancji Electron; powtórzenie testu wstążki osobno zakończyło się powodzeniem.
- 2026-08-30: pełny `verify-modeling` po końcowym układzie zaliczony. Obejmuje m.in. szkic myszą i dokładną długość jak w AutoCAD, zakończenie szkicu i wyciągnięcie, operacje B-Rep, konstrukcję, import/eksport, druk 3D, parametry z pulpitu `ZARZĄDZAJ`, skalowanie 100/150/200%, dostępność i interfejs angielski.
- 2026-08-30: pierwsze zagospodarowanie wolnej szerokości okazało się zbyt gęste — wystawienie `Odsuń`, `Przesuń`, `Warstwy` i `Bloki` zatarło podział na narzędzia podstawowe, kontekstowe i organizacyjne. Poprawiona wersja pokazuje bezpośrednio tylko podstawowy `Łuk`; polecenia kontekstowe wróciły do `Modyfikuj`, organizacyjne do `Więcej narzędzi`, a `Zakończ szkic` pozostaje obok narzędzi.
- 2026-08-30: ikony wstążki zmniejszono o około 2 px. Automatyczna kontrola przy 1459 × 877 potwierdza wszystkie wymagane etykiety, brak ukrytych grup i przepełnienia oraz sąsiedztwo grup `NARZĘDZIA` i `3 · ZAKOŃCZ`; wynik porównania wizualnego zapisano w `design-qa.md`.
- 2026-08-30: po zmianie zaliczone: `lint`, 105/105 testów komponentów, 185/185 testów core, `interface-consistency`, `sketch-drawing`, `ribbon-overflow`, `assistive-tech` oraz pełny `verify-modeling`. Test modelowania korzysta teraz z bezpośrednio widocznego narzędzia, a przy wąskiej wstążce nadal obsługuje jego pozycję w menu.
- 2026-08-30: po korekcie gęstości ponownie zaliczone `lint`, 105/105 testów komponentów, 185/185 testów core, `interface-consistency` i pełny `verify-modeling`. Kontrola odrzuca teraz zarówno ukrycie podstawowego łuku, jak i wystawienie więcej niż 15 poleceń bezpośrednich.
- 2026-08-30: poprawiony build `ca2dd45` podpisano lokalnie ad-hoc, zainstalowano w `/Applications/MadCAD.app` i uruchomiono. Ten sam stan szkicu przed i po poprawce sprawdzono w rzeczywistym oknie 1351 × 768; wspólny kadr zapisano w `artifacts/interface-recheck-2026-08-30/03-before-after-comparison.png`.
- 2026-08-30: naprawiono znikanie wcześniejszej geometrii po uruchomieniu kolejnego szkicu. Poprzednie niepuste szkice pozostają widoczne jako jaśniejszy, przygaszony kontekst, ale nie przechwytują zaznaczania aktywnego szkicu.
- 2026-08-30: regresję sprawdzono na tej samej płaszczyźnie oraz między XY i YZ w działającym scenariuszu Sweep. Zaliczone: `lint`, 106/106 testów komponentów, 185/185 testów core, `build:ui` i pełny `verify-modeling`; zrzut kontrolny zapisano w `artifacts/madcad-reference-sketch-visible.png`.
- 2026-08-30: wcześniejsze szkice na tej samej płaszczyźnie włączono do aktywnego systemu snap. Nowa geometria korzysta z ich końców, środków, krawędzi, przecięć, przedłużeń i wyrównań; znacznik pokazuje jawne `Odniesienie`, a snap ma pierwszeństwo przed sugestią automatycznego więzu.
- 2026-08-30: test prawdziwego wejścia myszy ustawia kursor kilka pikseli obok obu końców starej linii i potwierdza, że nowa linia zapisuje dokładnie oba współrzędne źródłowe. Zaliczone: 106/106 testów komponentów, 186/186 testów core, `lint`, `build:ui` i pełny `verify-modeling`.
- 2026-08-30: kolejne wybranie tej samej bazowej płaszczyzny przed utworzeniem bryły domyślnie kontynuuje istniejący szkic zamiast tworzyć odłączony obiekt. Wybór płaszczyzny jasno pokazuje `Kontynuuj Szkic`, a opcja `Utwórz oddzielny szkic` pozostawia kontrolę dla świadomych przepływów wieloszkicowych.
- 2026-08-30: dodano naprawę starszych projektów utworzonych w czasie, gdy każda sesja szkicowania zakładała osobny szkic. Zgodne szkice bazowe na tej samej płaszczyźnie są scalane przed historią 3D; zachowywane są encje, wiązania, wymiary, wystąpienia bloków, przypisania komponentów i odwołania arkuszy 2D, a profile są wykrywane ponownie z pełnej geometrii. Szkice użyte już przez operacje 3D nigdy nie są scalane automatycznie.
- 2026-08-30: pełny test okna Electron odtworzył stary błędny stan dwóch szkiców, scalił je do jednego zamkniętego profilu, wykonał rzeczywiste `Wyciągnij`, a następnie potwierdził bryłę, undo, redo, autozapis i ponowne otwarcie. Osobno potwierdzono jawnie rozdzielony szkic i snap myszy do starej geometrii, osobne płaszczyzny Sweep/Loft oraz brak automatycznego wznowienia szkicu użytego przez bryłę. Zaliczone: 110/110 testów komponentów, 186/186 testów core, `lint`, `build:ui` i pełny `verify-modeling`.
