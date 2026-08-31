# MadCAD — checklista przebudowy interfejsu według Autodesk Fusion

Aktualizacja: 2026-08-31  
Status: aktywna  
Punkt odniesienia: lokalnie zainstalowany Autodesk Fusion Personal na macOS

## Cel

MadCAD ma korzystać z czytelnego przepływu Autodesk Fusion: stały przegląd projektu po lewej, kontekstowy pasek narzędzi u góry, właściwości bieżącej operacji po prawej, płótno w centrum i historia modelu na dole. Nie kopiujemy marki ani zasobów Autodesk; odwzorowujemy hierarchię informacji, przewidywalność działania i kolejność pracy.

## Zweryfikowane wzorce Fusion

- [x] Zapisano rzeczywisty ekran startowy, pusty projekt, wybór płaszczyzny, tryb szkicu, gotowy profil i profil po zakończeniu szkicu w `artifacts/fusion-reference-2026-08-30/`.
- [x] Potwierdzono stały układ: przeglądarka po lewej, wstążka kontekstowa u góry, ViewCube po prawej, nawigacja pod płótnem i historia na dole.
- [x] Potwierdzono, że wejście do szkicu zmienia tylko zawartość wstążki, a nie cały układ aplikacji.
- [x] Potwierdzono, że wybór płaszczyzny odbywa się bez osobnego dużego okna zasłaniającego model.
- [x] Potwierdzono, że po zakończeniu szkicu profil pozostaje widoczny i gotowy do operacji 3D.
- [x] Potwierdzono grupy szkicu: `UTWÓRZ`, `ZMIEŃ`, `WIĄZANIA`, `SPRAWDŹ`, `WSTAW`, `WYBIERZ`, `ZAKOŃCZ SZKIC`.
- [x] Potwierdzono grupy modelowania: `UTWÓRZ`, `ZMIEŃ`, `KONSTRUKCJA`, `SPRAWDŹ`, `WSTAW`, `ZŁOŻENIE`, `WYBIERZ`.

## Zasady, których nie wolno łamać

- [x] Jedno narzędzie wyboru; po zakończeniu lub anulowaniu polecenia wybór ma działać automatycznie.
- [x] `Esc` anuluje bieżące polecenie, ale nie niszczy modelu ani szkicu.
- [x] Zakończenie szkicu nie ukrywa gotowego profilu i nie uruchamia ponownie wyboru płaszczyzny.
- [ ] Narzędzia 2D, modelowanie 3D, dokumentacja 2D i druk 3D mają odrębne miejsca.
- [ ] Aktywny przycisk wykonuje operację; brak atrap i dublujących się poleceń.
- [ ] Każdy tryb zachowuje stałe położenie przeglądarki, płótna, właściwości i historii.
- [ ] Ikona, tekst, stan aktywny, stan wyłączony i tooltip mają jednakową logikę w całej aplikacji.

## P0 — przepływ szkic → bryła

- [x] Ujednolicić stały szkielet ekranu zgodnie z Fusion: lewy browser, górna wstążka, środek, prawy panel polecenia, dolna historia.
- [x] Zastąpić osobny modal wyboru płaszczyzny wyborem bezpośrednio na płótnie z nieblokującą instrukcją.
- [x] Po `Zakończ szkic` zachować widoczność profilu i jego zaznaczenie lub jednoznacznie podświetlić profil gotowy do 3D.
- [x] Kliknięcie `Wyciągnij` ma użyć istniejącego profilu; nie może ponownie pytać o płaszczyznę szkicu.
- [x] Wyciągnięcie ma mieć jeden panel po prawej: profil, odległość, kierunek, zakres i operacja New/Join/Cut/Intersect.
- [x] Wartość odległości ma przyjmować wpis z klawiatury i zatwierdzenie Enterem oraz reagować na manipulator.
- [x] Po zatwierdzeniu bryła, szkic i operacja muszą pozostać widoczne w przeglądarce i historii.
- [x] Zaznaczenie ściany ma oferować kontekstowo: szkic na ścianie, Press Pull, Offset Face.
- [x] Zaznaczenie krawędzi ma oferować kontekstowo: Fillet i Chamfer.
- [x] Zaznaczenie bryły ma oferować kontekstowo: Move/Copy, Pattern, właściwości i usuń.

## P0 — kamera i zaznaczanie

- [x] Prawy przycisk myszy obraca kamerę zgodnie z decyzją użytkownika; `Esc` anuluje polecenie.
- [x] Środkowy przycisk lub gest panoramuje; kółko przybliża bez skoków i zachowuje punkt pod kursorem.
- [x] W aktywnym szkicu kamera pozostaje ortogonalna do płaszczyzny, dopóki użytkownik świadomie nie opuści lub nie zmieni widoku.
- [x] ViewCube ma jednoznaczne ściany, widoki przeciwne, nazwę aktualnej orientacji i widok izometryczny.
- [x] Pasek nawigacji ma stałe, niekolidujące miejsce pośrodku pod płótnem i czytelne tooltipy.
- [x] Snap ma zawsze widoczny marker, typ punktu i krótką informację tekstową przed kliknięciem.
- [x] Polecenie kończy się do stanu wyboru; użytkownik nie musi włączać osobnego `Wybierz` po każdym narzędziu.

## P1 — hierarchia interfejsu Fusion

- [ ] Zmniejszyć liczbę równorzędnych zakładek na górze; główny przełącznik obszaru ma być jeden i przewidywalny.
- [x] W modelowaniu pokazywać tylko grupy adekwatne do aktualnego trybu i szerokości okna.
- [ ] Najczęstsze narzędzia mają pełną ikonę i etykietę; rzadsze trafiają do menu grupy, bez chowania wolnego miejsca.
- [x] Wstążka nie może dociskać ikon do krawędzi ani nakładać ich na siebie przy szerokościach 1280, 1440 i 1920 px.
- [ ] Ujednolicić proporcje: wysokość wstążki, rozmiar ikon, tekst narzędzi, nagłówki grup i odstępy.
- [x] Przeglądarka projektu ma strukturę Fusion: dokument, ustawienia, początek, szkice, bryły, komponenty i konstrukcja.
- [x] Widoczność szkiców i brył jest przełączana ikoną oka przy obiekcie, utrwalana w projekcie i zsynchronizowana z płótnem.
- [x] Prawy panel pokazuje tylko bieżące polecenie lub właściwości zaznaczenia; nie otwiera wielu nakładających się okien.
- [x] Dolna historia pokazuje operacje w kolejności, stan aktywny, suppressed i marker rollbacku.
- [ ] Komunikaty stanu mają być krótkie i pomocnicze; nie mogą konkurować z narzędziem ani zasłaniać modelu.

## P1 — podział obszarów

- [ ] `PROJEKTUJ` obejmuje szkic, bryłę, powierzchnię, konstrukcję, sprawdzanie i podstawowe złożenie.
- [ ] `ARKUSZ 2D` obejmuje wyłącznie dokumentację techniczną, adnotacje i wydruk/eksport arkusza.
- [ ] `ZARZĄDZAJ` obejmuje parametry, wersje, zależności, kondycję i komponenty projektu.
- [ ] Import/eksport projektu i modelu pozostaje w menu `Plik`; nie dublować go w kilku wstążkach.
- [ ] Druk 3D pozostaje osobnym dodatkiem uruchamianym z `Plik`, bez mieszania z dokumentacją 2D.
- [ ] Usunąć zapisywane presety układu z głównego przepływu; zachować jeden dobry układ adaptacyjny.

## P1 — skróty, nazwy i pomoc

- [ ] Zachować skróty inspirowane Autodesk dla podstaw: `L` linia, `R` prostokąt, `C` okrąg, `E` wyciągnij, `M` przesuń, `F` zaokrąglij, `D` wymiar.
- [ ] Skrót nie jest drukowany na każdym przycisku; jest widoczny w tooltipie i menu narzędzia.
- [ ] Nazwy są polskie i konsekwentne; angielska nazwa techniczna może być drugą linią tylko tam, gdzie pomaga w wymianie danych.
- [ ] Tooltip wyjaśnia działanie, wymagany wybór, skrót i powód niedostępności.
- [ ] Linia poleceń przyjmuje aliasy, ale pozostaje pomocnicza wobec bezpośredniej pracy myszą.

## Weryfikacja każdej paczki

- [x] Test komponentu i test przepływu UI.
- [x] Test pełnego scenariusza: pusty projekt → szkic → profil → wyciągnięcie → zapis → ponowne otwarcie.
- [x] Test anulowania `Esc`, cofania/ponawiania i powrotu do wyboru.
- [x] Test kamery myszą i trackpadem bez skoków.
- [x] Test wizualny macOS w 1280×800, 1440×900 i pełnym ekranie.
- [x] Porównanie z zapisanymi ekranami Fusion, bez kopiowania znaków towarowych i zasobów.
- [x] Lokalny build i podmiana `/Applications/MadCAD.app`; bez publikowania wydania na GitHub do czasu zgody użytkownika.

## Stan paczki 2026-08-31

- [x] Zainstalowano lokalnie MadCAD 6.4.6 z podpisem ad-hoc, bez certyfikatu producenta i bez notaryzacji.
- [x] Zweryfikowano po ponownym uruchomieniu aplikacji ekran startowy, widok modelowania, wybór płaszczyzny i obszar szkicu.
- [x] Zapisano zrzut zainstalowanego obszaru szkicu w `artifacts/fusion-ui-local-2026-08-30/01-sketch-workspace.jpeg`.
- [x] Poprzednią aplikację przeniesiono do Kosza jako `MadCAD-before-fusion-ui-20260830.app`, więc podmiana jest odwracalna.
- [x] Wybór XY/XZ/YZ działa bezpośrednio na kolorowych płaszczyznach modelu; panel instrukcji jest mały, nieblokujący i odsunięty od środka płótna.
- [x] Wyciągnięcie przyjmuje odległość z klawiatury, reaguje na manipulator i zatwierdza operację Enterem.
- [x] Ściana, krawędź i bryła pokazują właściwe akcje kontekstowe; usunięcie bryły prowadzi przez bezpieczne potwierdzenie zależności historii.
- [x] Audyt przepływu oraz dowody wizualne zapisano w `docs/FUSION_FLOW_AUDIT_2026-08-31.md` i `artifacts/fusion-flow-audit-2026-08-31/`.
- [x] Nowy build 6.4.6 podpisano ad-hoc, zainstalowano jako `/Applications/MadCAD.app` i sprawdzono w uruchomionej aplikacji; poprzedni build przeniesiono do Kosza jako `MadCAD-before-fusion-flow-20260831.app`.
- [x] Snap pokazuje duży marker, ikonę i typ; test wizualny potwierdza marker wewnątrz płótna.
- [x] ViewCube pokazuje aktualny widok i wszystkie podstawowe kierunki czytelnym tekstem.
- [x] Ikony oka przy szkicach i bryłach sterują rzeczywistą widocznością na płótnie; foldery służą wyłącznie do zwijania listy.
- [x] Finalny lokalny build z tym pakietem zastąpił `/Applications/MadCAD.app`; poprzedni build jest odwracalnie zachowany w Koszu jako `MadCAD-before-visibility-20260831.app`.
- [ ] Następna paczka: uproszczenie głównego przełącznika obszarów, domknięcie podziału Projektuj/Arkusz 2D/Zarządzaj i ujednolicenie tooltipów.

## Pliki główne

- `src/modeling/ModelingWorkspace.jsx` — szkielet obszarów, przepływ poleceń i wybór.
- `src/modeling/WorkspaceRibbon.jsx` — zachowanie wstążki i przepełnienia.
- `src/modeling/WorkspaceSketchUi.jsx` — wybór płaszczyzny, paleta szkicu i kontekstowe działania.
- `src/modeling/WorkspacePanels.jsx` — prawy panel polecenia i właściwości.
- `src/modeling/ModelViewport.jsx` — zaznaczanie, snap, kamera, manipulator i ViewCube.
- `src/modeling/modeling.css` — spójny układ, skala i responsywność.
- `scripts/verify-interface-consistency.cjs` — pomiary układu i scenariusz wizualny.
- `scripts/verify-modeling.cjs` — scenariusz od szkicu do bryły i ponownego otwarcia.
