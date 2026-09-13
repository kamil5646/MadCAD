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

## Dostępność i ograniczenia dowodów

Pełny przebieg sprawdził powiększenie 100%, 150% i 200% bez przepełnienia dokumentu, dostępny fokus klawiatury oraz brak zgłoszonych naruszeń axe. Automatyczny audyt kontrastu pozostawia elementy niejednoznaczne przy nakładaniu warstw płótna; wymaga to dalszej kontroli wizualnej przy kolejnych panelach.

## Następna część

Do dalszego zbliżenia do Fusion pozostają panele przeglądarki projektu, właściwości obiektów i oś czasu — przede wszystkim proporcje wierszy, stany zaznaczenia oraz menu kontekstowe.
