# Audyt interfejsu względem Autodesk Fusion — 2026-09-13

## Zakres i cel

Sprawdzono podstawowy przepływ projektowania: obszar modelowania, szkic oraz aktywną operację na bryle. Celem jest hierarchia zbliżona do Fusion: stała przeglądarka projektu po lewej, spokojna wstążka u góry, maksymalnie duże płótno oraz kontekstowe palety po prawej.

## 1. Modelowanie — stan dobry

Dowód: `artifacts/full-interface-audit-2026-08-30/01-model-fixed.png`.

- Narzędzia są pogrupowane według zadania, a nie typu pliku.
- Ikony mają jedną warstwę i nie konkurują z nazwami poleceń.
- Przeglądarka projektu, kostka widoku i oś czasu mają stałe miejsca.

## 2. Szkic — stan dobry

Dowód: `artifacts/full-interface-audit-2026-08-30/08-sketch-ribbon-expanded.png`.

- Paleta szkicu jest domyślnie widoczna po prawej na szerokim ekranie.
- Najczęstsze narzędzia są dostępne bez otwierania menu.
- Kolejność grup prowadzi od tworzenia przez zmianę i wiązania do zakończenia szkicu.

## 3. Operacja na bryle — stan dobry po poprawce

Dowód: `artifacts/full-interface-audit-2026-08-30/09-command-panel-fusion.png`.

- Panel parametrów jest kompaktową paletą na płótnie zamiast kolumny zajmującej pełną wysokość.
- Kostka widoku odsuwa się obok aktywnej palety.
- Stopka z Anuluj i OK pozostaje widoczna, a długa zawartość przewija się wewnątrz panelu.
- Nazwy operacji są spójne po polsku, bez mieszania z angielskimi nazwami interfejsu.

## 4. Ikony, przeglądarka i oś czasu — stan dobry po poprawce

Dowód: `artifacts/full-interface-audit-2026-08-30/10-browser-timeline-fusion.png`.

- Ikony korzystają z czterech spokojnych rodzin funkcjonalnych zamiast osobnego koloru dla każdego polecenia; elementy wewnętrzne piktogramu nie wprowadzają dodatkowych barw.
- Aktywne polecenie ma neutralne tło i wąski akcent z boku zamiast czerwonej obwódki przecinającej etykietę.
- Początek, konstrukcja i złożenie są domyślnie zwinięte, a puste złożenie nie dodaje zbędnego wiersza.
- Przełącznik widoczności znajduje się w stałej pierwszej kolumnie przed ikoną typu obiektu.
- Operacje historii mają większe piktogramy, bez mikroskopijnych numerów; zaznaczenie jest neutralne z cienkim akcentem marki.
- Działania dla zaznaczonej bryły, ściany i krawędzi tworzą zwartą poziomą belkę zamiast wysokiego kafla zasłaniającego płótno.
- Menu „Więcej” jest kontrolowane przez React, zamyka się klawiszem Esc i nie kasuje przy tym zaznaczenia modelu.

## 5. Nawigacja i filtr wyboru — stan dobry po poprawce

Dowód: `artifacts/fusion-flow-audit-2026-08-31/07-visibility-viewcube.png`.

- Filtr wyboru jest zwartą kontrolką przy dolnym pasku nawigacji, a nie jaskrawą wyspą zasłaniającą model.
- Aktywny filtr i aktywna ściana kostki używają neutralnego tła z cienkim akcentem marki.
- Rozwinięty filtr pozostaje nad nawigacją, a na wąskim ekranie automatycznie ustawia się centralnie.
- Automatyczny test mierzy położenie obu kontrolek i wykrywa ich nakładanie.

## 6. Adaptacyjna wstążka bryły — stan dobry po poprawce

Dowód: `artifacts/full-interface-audit-2026-08-30/01-model-fixed.png`.

- Na szerokim ekranie wolne miejsce pokazuje bezpośrednio Prymityw, bryłę obrotową, operację po ścieżce, fazowanie, powłokę, szyk i operację logiczną.
- Przy zwykłej szerokości te same polecenia wracają do „Więcej brył” i „Więcej zmian”, dzięki czemu grupy nie wypychają się poza okno.
- Test zmienia szerokość z 2200 na 1351 px i sprawdza zarówno dostępność poleceń, jak i brak poziomego przepełnienia.

## 7. Właściwości zaznaczenia — stan dobry po poprawce

Dowody: `artifacts/fusion-flow-audit-2026-08-31/04-face-context.png` i `artifacts/fusion-flow-audit-2026-08-31/05-edge-context.png`.

- Profil, ściana i krawędź udostępniają „Właściwości” w tym samym menu kontekstowym co pasujące operacje.
- Polecenie korzysta ze wspólnego panelu pomiarów, więc pokazuje dane wynikające z rzeczywistego zaznaczenia zamiast osobnego, niespójnego okna.
- Bryła zachowuje dokładniejsze „Właściwości masy”, a działania usuwania pozostają oddzielone i wymagają potwierdzenia.
- Menu działa myszą i klawiaturą, zamyka się klawiszem Esc oraz nie usuwa zaznaczenia.

## Dostępność i ograniczenia dowodów

Pełny przebieg sprawdził powiększenie 100%, 150% i 200% bez przepełnienia dokumentu, dostępny fokus klawiatury oraz brak zgłoszonych naruszeń axe. Automatyczny audyt kontrastu pozostawia elementy niejednoznaczne przy nakładaniu warstw płótna; wymaga to dalszej kontroli wizualnej przy kolejnych panelach.

## Wynik końcowy

Podstawowy przepływ interfejsu jest spójny z modelem pracy Fusion: przestrzeń robocza i dziedzina wybierają zestaw poleceń, przeglądarka utrzymuje strukturę projektu, płótno udostępnia wyłącznie działania pasujące do zaznaczenia, a szczegółowe parametry otwierają się w prawej palecie. Import, eksport, druk 2D i druk 3D pozostają oddzielone w menu Plik.
