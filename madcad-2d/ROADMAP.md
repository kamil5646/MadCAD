# MadCAD — aktywny plan rozwoju

Aktualizacja: 2026-08-08
Wersja: `6.0.0-alpha.1`
Gałąź: `agent/madcad-vnext-core`

Ten plik zawiera wyłącznie aktywną ścieżkę do używalnego modelera części przeznaczonych do druku 3D. Historia ukończonych prac znajduje się w [DONE.md](./DONE.md), a dalszy zakres produktu w [BACKLOG.md](./BACKLOG.md).

## Cel najbliższego wydania

Od pustego dokumentu użytkownik tworzy w pełni zwymiarowaną część mechaniczną, szkicuje również na ścianie, wykonuje podstawowe operacje bryłowe na wskazanej geometrii, sprawdza model i eksportuje go w skali 1:1 do STEP/STL/3MF.

## Oznaczenia i priorytet

- `[x]` — ukończone i zweryfikowane.
- `[~]` — działa częściowo i nie może być przedstawiane jako pełna funkcja.
- `[>]` — aktywne zadanie.
- `[ ]` — oczekuje.
- `[!]` — blokada architektoniczna.
- `P0` — wymagane do najbliższego używalnego wydania.
- `P1` — ważne po zamknięciu ścieżki P0.
- `P2` — odłożone do backlogu.

## Zasady wykonania

1. Limit pracy to jeden aktywny pionowy scenariusz funkcjonalny. Równolegle wolno prowadzić tylko testy, bezpieczeństwo, dokumentację i naprawy regresji.
2. Funkcja jest gotowa dopiero po obsłudze błędów, anulowaniu, undo/redo, zapisie/otwarciu i teście automatycznym na właściwym poziomie.
3. Test jednostkowy pokrywa algorytm, test kernela wynik B-Rep, a desktop E2E cały scenariusz użytkownika. Nie uruchamiamy round-trip eksportu osobno dla każdej drobnej funkcji.
4. Aktywny przycisk zawsze wykonuje prawdziwą operację. Niedostępne narzędzie pokazuje przyczynę, a nie atrapę.
5. Zmiana schematu `.madcad` wymaga migracji, fixture starego dokumentu i testu round-trip.
6. Operacje kernela są deterministyczne, transakcyjne i zachowują ostatni poprawny model po błędzie.
7. Każdy pionowy etap kończy się scenariuszem od pustego dokumentu oraz ponownym otwarciem zapisu.
8. Nowe narzędzie działa na obsługiwanych płaszczyznach i ścianach albo jawnie pokazuje ograniczenie.

## Ścieżka krytyczna P0

| Kolejność | Etap | Status | Zależność | Wynik użytkownika |
| --- | --- | --- | --- | --- |
| 1 | M1 Solver szkicu MVP | `[x]` | ukończony model encji | szkic ma wymiary, podstawowe więzy i stopnie swobody |
| 2 | M2 Podstawowe modyfikacje szkicu | `[>]` | M1 | Trim/Extend/Break/Offset/Fillet/Chamfer i podstawowe transformacje zachowują więzy |
| 3 | M3 Picking B-Rep | `[ ]` | trwałe ID z R0 | można stabilnie wskazać ścianę, krawędź i wierzchołek |
| 4 | M4 Konstrukcja podstawowa | `[ ]` | M3 | offset plane, midplane, plane przez trzy punkty, osie i punkty konstrukcyjne |
| 5 | M5 Szkic na modelu i Project | `[ ]` | M1, M3, M4 | drugi szkic powstaje na ścianie i zachowuje projekcję krawędzi |
| 6 | M6 Modelowanie części MVP | `[ ]` | M3, M5 | pełniejsze Extrude, Boolean, wskazane Fillet/Chamfer, Shell i podstawowe prymitywy |
| 7 | M7 Otwory i gwinty MVP | `[ ]` | M3, M5, M6 | proste/counterbore/countersink otwory i podstawowy gwint metryczny |
| 8 | M8 Inspect MVP | `[ ]` | M3, M6 | Measure, Section, objętość, pole, masa i środek masy |
| 9 | M9 Przygotowanie druku MVP | `[ ]` | M6–M8 | orientacja, STEP/STL/3MF, skala 1:1, manifold, grubość, nawisy i przekazanie do slicera |
| 10 | M10 Wydanie alpha/beta | `[ ]` | M1–M9 | instalowalna, odzyskiwalna i przetestowana aplikacja Windows/macOS |

## M2 — podstawowe modyfikacje szkicu `P0`

- [x] Trim linii i łuku wybiera kliknięty fragment na canvasie, aktualizuje profil i bezpiecznie usuwa zerwane więzy oraz operacje.
- [x] Extend i Break działają na canvasie dla linii/łuków, zachowują ID oraz zależne profile i bezpiecznie czyszczą więzy.
- [ ] Offset krzywej, łańcucha i profilu.
- [ ] Sketch Fillet i Sketch Chamfer.
- [ ] Move, Rotate, Copy i Mirror; Scale tylko dla geometrii bez blokujących wymiarów.
- [ ] Operacje aktualizują lub jawnie odrzucają więzy, zamiast pozostawiać zerwane referencje.

Szyki szkicu oraz pomijanie wystąpień są `P1` i nie blokują M3.

## M3 — stabilne zaznaczanie B-Rep `P0`

- [ ] Viewport korzysta z istniejącego mapowania trwałych face/edge ID.
- [ ] Filtry: profile, ściany, krawędzie, wierzchołki i bryły.
- [ ] Hover, multi-select, cykliczny wybór elementów nakładających się i box select.
- [ ] Utracona referencja pokazuje źródłowy feature i możliwe ponowne przypisanie.
- [ ] Picking nie uruchamia ponownej tessellacji ani przeliczenia bryły.

## M4 — geometria konstrukcyjna MVP `P0`

- [ ] Offset plane, midplane i plane przez trzy punkty.
- [ ] Oś z krawędzi, walca, dwóch punktów oraz przecięcia dwóch płaszczyzn.
- [ ] Punkt na wierzchołku, centrum i przecięciu.
- [ ] Widoczność, nazwa i trwała referencja do konstrukcji.

Pozostałe warianty UCS/płaszczyzn/osi są `P1`.

## M5 — szkic na modelu i Project `P0`

- [ ] Szkic na płaszczyźnie bazowej, ścianie planarnej i płaszczyźnie konstrukcyjnej.
- [ ] Project punktu, krawędzi i zamkniętej pętli.
- [ ] Associative link oraz czytelny stan utraconej referencji.
- [ ] Slice i kontrola widoczności profili, więzów oraz projected geometry.

Import SVG/DXF jest `P1`.

## M6 — modelowanie części MVP `P0`

- [ ] Extrude: New/Join/Cut/Intersect, jedna/dwie strony, symetrycznie i Through All.
- [ ] Boolean Union/Subtract/Intersect dla wskazanych brył.
- [ ] Fillet i Chamfer wyłącznie wskazanych krawędzi.
- [ ] Shell z wyborem usuwanych ścian.
- [ ] Box, Cylinder, Sphere i Torus.
- [ ] Jeden manipulator dla Extrude, Move/Rotate i Offset Face.
- [ ] Tekst szkicu realizować tutaj jako jeden scenariusz `Text → profile → Extrude/Emboss/Deboss`, aby nie blokował solvera.

Revolve, Sweep, Loft, Draft, Thin Extrude, Heal/Replace Face, Rib, Coil i Pipe są `P1`.

## M7 — otwory i gwinty MVP `P0`

- [x] Umieszczenie prostego otworu przez trwały punkt szkicu.
- [ ] Umieszczenie na ścianie z referencjami do krawędzi.
- [ ] Otwór prosty, counterbore i countersink; Distance/Through All.
- [ ] Podstawowy gwint metryczny kosmetyczny i modelowany: średnica, skok, kierunek i długość.
- [ ] Profil kompensacji luzu FFF bez zmiany nominalnego wymiaru.

Tapered threads, wiele norm i klasy pasowania są `P1`.

## M8 — Inspect MVP `P0`

- [ ] Measure: długość, odległość, kąt, promień/średnica, pole i pozycja.
- [ ] Section Analysis.
- [ ] Objętość, pole, gęstość, masa i środek masy.
- [ ] Minimum Radius oraz podstawowa kontrola kolizji wielu brył.

## M9 — przygotowanie druku MVP `P0`

- [ ] Profile stołu Bambu/Prusa/Creality i własny profil.
- [ ] Pozycja, obrót, skala, kopie i orientacja względem płaskiej ściany.
- [ ] Import STEP/STL/3MF z kontrolą jednostek; eksport STEP/STL/3MF w skali 1:1.
- [ ] Analiza manifold, normalnych, trójkątów zdegenerowanych, minimalnej grubości, małych otworów, nawisów i gabarytu stołu.
- [ ] Lista problemów wskazuje geometrię; wynik opisuje ryzyko, nie gwarancję wydruku.
- [ ] Przekazanie pliku do Bambu Studio, PrusaSlicer lub Cura.

Zaawansowane heatmapy, automatyczne rozmieszczanie wielu części i rozbudowany remesh są `P1`.

## M10 — ciągły tor jakości i wydanie `P0`

Te prace nie czekają na koniec modelowania:

- [~] CI: test core, build UI i desktop E2E; rozszerzyć macierz Windows/macOS oraz smoke test instalatora.
- [~] Awaria workera i autosave są testowane; dodać pełny dysk, uszkodzony projekt i odzyskanie sesji.
- [ ] Utwardzić Electron: context isolation, ograniczone IPC, walidacja payloadów, CSP i bezpieczne linki.
- [ ] Budżety wydajności pickingu, meshowania i długiej historii.
- [ ] PL/EN, dostępność, DPI 100–200% i wielu monitorów.
- [ ] Kanały alpha/beta/stable, integralność paczki, podpis, rollback i bezpieczny updater.
- [ ] Aktualny samouczek „pierwsza część do druku” i znane ograniczenia.

## Definition of Done

Każda funkcja spełnia wymagania wspólne: test happy path i błędu, anulowanie bez częściowego stanu, undo/redo, zapis/otwarcie, poprawny komunikat użytkownika i brak aktywnej atrapy.

Dodatkowo:

- funkcja geometrii: poprawny B-Rep, tolerancje, test parametryczny i zachowanie referencji;
- import/eksport: jednostki, gabaryt i round-trip reprezentatywnego scenariusza;
- UI: label, tooltip, disabled reason, DPI i obsługa klawiatury tam, gdzie ma sens;
- zmiana schematu: migracja, fixture i round-trip `.madcad`;
- pionowy etap: desktop E2E od pustego dokumentu do ponownego otwarcia projektu.

## Aktualne ryzyka

- [!] Pełny solver więzów musi pozostać osobnym modułem numerycznym, nie logiką React.
- [!] Stabilne referencje B-Rep nie mogą używać indeksów z pojedynczej tessellacji.
- [!] Brakujące operacje Replicad wymagają kontrolowanego adaptera OpenCascade.
- [!] Import musi być sprawdzany na plikach z różnych programów, nie tylko na własnym eksporcie.
- [!] Zmiana `appId` i instalatora wymaga migracji danych i ciągłości aktualizacji.

## Następne pojedyncze zadanie

`M2.3 — Offset krzywej, łańcucha i profilu z kontrolą strony oraz odległości.`
