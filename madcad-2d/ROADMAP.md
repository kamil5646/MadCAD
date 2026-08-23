# MadCAD — aktywny plan rozwoju

Aktualizacja: 2026-08-23
Wersja bazowa: `6.3.2 stable`
Gałąź wydania: `main`

Ten plik opisuje aktywną ścieżkę do CAD 2D/3D: bezpośrednie szkicowanie i polecenia znane z klasycznego CAD są podstawą, a parametryczna historia i modelowanie bryłowe rozwijają rysunek w model 3D. Przygotowanie do druku 3D pozostaje opcjonalnym dodatkiem eksportowym. Historia ukończonych prac znajduje się w [DONE.md](./DONE.md), a dalszy zakres produktu w [BACKLOG.md](./BACKLOG.md).

## Osiągnięty zakres wydania 6.1

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
| 2 | M2 Podstawowe modyfikacje szkicu | `[x]` | M1 | Trim/Extend/Break/Offset/Fillet/Chamfer i podstawowe transformacje zachowują więzy |
| 3 | M3 Picking B-Rep | `[x]` | trwałe ID z R0 | można stabilnie wskazać ścianę, krawędź i wierzchołek |
| 4 | M4 Konstrukcja podstawowa | `[x]` | M3 | offset plane, midplane, plane przez trzy punkty, osie i punkty konstrukcyjne |
| 5 | M5 Szkic na modelu i Project | `[x]` | M1, M3, M4 | drugi szkic powstaje na ścianie i zachowuje projekcję krawędzi |
| 6 | M6 Modelowanie części MVP | `[x]` | M3, M5 | pełniejsze Extrude, Boolean, wskazane Fillet/Chamfer, Shell i podstawowe prymitywy |
| 7 | M7 Otwory i gwinty MVP | `[x]` | M3, M5, M6 | proste/counterbore/countersink otwory i podstawowy gwint metryczny |
| 8 | M8 Inspect MVP | `[x]` | M3, M6 | Measure, Section, objętość, pole, masa i środek masy |
| 9 | M9 Wymiana danych i dodatki eksportowe | `[x]` | M6–M8 | STEP jako wymiana CAD; opcjonalnie STL/3MF, analiza drukowalności i slicer |
| 10 | M10 Wydanie stabilne | `[>]` | M1–M9 | instalowalna, odzyskiwalna i przetestowana aplikacja Windows/macOS/Linux |

## M4 — geometria konstrukcyjna MVP `P0`

- [x] Offset plane ma nazwę, widoczność, parametryczną odległość, trwałe ID i pełny przepływ zapisu/undo/redo.
- [x] Midplane i płaszczyzna przez trzy punkty.
- [x] Oś z krawędzi, walca, dwóch punktów oraz przecięcia dwóch płaszczyzn.
- [x] Punkt na wierzchołku, centrum i przecięciu.
- [x] Widoczność, nazwa i trwała referencja do konstrukcji.

Pozostałe warianty UCS/płaszczyzn/osi są `P1`.

## M5 — szkic na modelu i Project `P0`

- [x] Szkic na płaszczyźnie bazowej, ścianie planarnej i płaszczyźnie konstrukcyjnej.
  - [x] Płaszczyzny bazowe XY/XZ/YZ.
  - [x] Planarna ściana bryły z trwałą referencją podpory i odsunięciem.
  - [x] Nazwana płaszczyzna konstrukcyjna.
- [x] Project punktu, krawędzi i zamkniętej pętli.
- [x] Associative link oraz czytelny stan utraconej referencji.
- [x] Slice i kontrola widoczności profili, więzów oraz projected geometry.

Import SVG/DXF został ukończony w `P1.1`.

## M6 — modelowanie części MVP `P0`

- [x] Extrude: New/Join/Cut/Intersect, jedna/dwie strony, symetrycznie i Through All.
- [x] Boolean Union/Subtract/Intersect dla wskazanych brył.
- [x] Fillet i Chamfer wyłącznie wskazanych krawędzi.
- [x] Shell z wyborem usuwanych ścian.
- [x] Box, Cylinder, Sphere i Torus.
- [x] Jeden manipulator dla Extrude, Move/Rotate i Offset Face.
- [x] Tekst szkicu jako jeden scenariusz `Text → profile → Extrude/Emboss/Deboss`, bez blokowania solvera i zależności od fontów systemowych.

Coil i Pipe ukończono jako `P1.18–P1.19`.

## M7 — otwory i gwinty MVP `P0`

- [x] Umieszczenie prostego otworu przez trwały punkt szkicu.
- [x] Umieszczenie na planarnej ścianie z trwałymi referencjami do dwóch prostopadłych krawędzi i parametrycznymi odsunięciami.
- [x] Otwór prosty, Counterbore i Countersink; Distance/Through All.
- [x] Podstawowy gwint metryczny kosmetyczny i modelowany: średnica, skok, kierunek i długość.
- [x] Profil kompensacji luzu FFF bez zmiany nominalnego wymiaru.

Tapered threads, wiele norm i klasy pasowania są `P1`.

## M8 — Inspect MVP `P0`

- [x] Measure: długość, odległość, kąt, promień/średnica, pole i pozycja.
- [x] Section Analysis.
- [x] Objętość, pole, gęstość, masa i środek masy.
- [x] Minimum Radius oraz podstawowa kontrola kolizji wielu brył.

## M9 — wymiana danych i opcjonalny druk 3D `P0`

- [x] Profile stołu Bambu/Prusa/Creality i własny profil.
- [x] Pozycja, obrót, skala, kopie i orientacja względem płaskiej ściany.
- [x] Import STEP/STL/3MF z kontrolą jednostek; eksport STEP/STL/3MF w skali 1:1.
- [x] Analiza manifold, normalnych, trójkątów zdegenerowanych, minimalnej grubości, małych otworów, nawisów i gabarytu stołu.
- [x] Lista problemów wskazuje geometrię; wynik opisuje ryzyko, nie gwarancję wydruku.
- [x] Przekazanie pliku do Bambu Studio, PrusaSlicer lub Cura.

Zaawansowane heatmapy, automatyczne rozmieszczanie wielu części i rozbudowany remesh są `P1`.

## M10 — ciągły tor jakości i wydanie `P0`

Te prace nie czekają na koniec modelowania:

- [x] CI: test core i build na Linux/macOS/Windows, desktop E2E na macOS/Windows oraz smoke test paczek ZIP/NSIS/AppImage.
- [x] Awaria workera, pełny dysk, uszkodzony projekt, kopia autozapisu i odzyskanie sesji są testowane.
- [x] Electron ma context isolation, sandbox, CSP, bezpieczne linki, wspólną kontrolę źródła dla wszystkich 10 kanałów IPC oraz test odrzucenia obcego widoku.
- [x] Budżety wydajności pickingu, meshowania i długiej historii są mierzone w testach core i desktop E2E.
- [~] Przełącznik PL/EN i smoke test EN działają; pełne przeniesienie tekstów interfejsu do katalogu tłumaczeń nadal trwa. Dostępność klawiatury i fokusu oraz DPI 100–200% są testowane.
- [x] Kanały alpha/beta/stable, SHA-256, testy paczek, rollback podpisanej instalacji macOS i updater ignorujący niezaufany adres z renderera są zaimplementowane. Wydanie 6.2.0 bez certyfikatu pobiera, sprawdza i przekazuje właściwą paczkę na Windows, macOS i Linux.
- [x] Wbudowany samouczek prowadzi od szkicu do modelu i eksportu, ma ścieżkę PL/EN oraz jawną listę znanych ograniczeń.

## P1 — rozszerzenie modelowania części

- [x] P1.1 Import SVG/DXF do aktywnego szkicu: wykrywanie i wybór jednostek, profile, undo/redo, autozapis i ponowne otwarcie w desktop E2E.
- [x] P1.1a Lokalny import DWG przez wykryty GNU LibreDWG albo ODA File Converter: bez przesyłania projektu do chmury, z bezpiecznym wyborem pliku, limitami rozmiaru i ponownym użyciem sprawdzonego importera DXF.
- [x] P1.2 Więzy `collinear` i `symmetry` od solvera do interfejsu, z diagnostyką konfliktów, undo/redo, autozapisem i round-trip projektu.
- [x] P1.3 Wymiary ordinate X/Y oraz długości łuku: sterowanie solverem, znaczniki, edycja na szkicu, undo/redo, autozapis i ponowne otwarcie w desktop E2E.
- [x] P1.4 Prostokątny i kołowy szyk geometrii szkicu z pomijaniem wystąpień, walidacją, undo/redo, autozapisem i ponownym otwarciem w desktop E2E.
- [x] P1.5 Szyk geometrii szkicu po linii lub łuku z równym rozstawem, stałą orientacją albo orientacją do stycznej, pomijaniem wystąpień i pełnym desktop E2E.
- [x] P1.6 Parametryczne płaszczyzny tangent/angle/path, oś normalna do płaszczyzny oraz punkty środkowy i odsunięty na osi, z walidacją dokumentu, grafem zależności i pełnym desktop E2E.
- [x] P1.7 Więz ciągłości krzywizny `curvature` (G2) dla dwóch łuków ze wspólnym końcem, z diagnostyką konfliktu, znacznikiem κ, undo/redo, autozapisem i round-trip dokumentu.
- [x] P1.8 Extrude To Object i parametryczne odsunięcie początku wyciągnięcia.
  - [x] P1.8a Odsunięcie początku działa parametrycznie dla wszystkich zakresów, przechodzi edycję i pełny desktop E2E na przesuniętym B-Rep.
  - [x] P1.8b To Object kończy bryłę na równoległej płaszczyźnie konstrukcyjnej albo planarnej ścianie, śledzi przesunięcie ściany przez trwałą referencję i przechodzi undo/redo, autozapis oraz ponowne otwarcie.
- [x] P1.9 Thin Extrude dla zamkniętego i otwartego profilu: parametryczna grubość, strona wewnętrzna/zewnętrzna/symetryczna oraz pełny przepływ B-Rep.
  - [x] P1.9a Zamknięty profil tworzy dokładną cienkościenną bryłę do wewnątrz, na zewnątrz lub symetrycznie; edycja, undo/redo, autozapis i ponowne otwarcie przechodzą desktop E2E.
  - [x] P1.9b Otwarty łańcuch linii szkicu tworzy dokładną cienkościenną bryłę z zakończeniem prostym lub wydłużonym; walidacja rozgałęzień, anulowanie, undo/redo, autozapis i ponowne otwarcie przechodzą testy.
- [x] P1.10 Draft wskazanych planarnych ścian względem bazowej albo parametrycznej płaszczyzny neutralnej, z kątem dodatnim/ujemnym, trwałymi referencjami, anulowaniem, edycją, undo/redo, autozapisem i ponownym otwarciem.
- [x] P1.11 Press Pull jako kontekstowa operacja profilu i planarnej ściany, oparta na istniejących Extrude oraz Offset Face i sprawdzona w obu kontekstach przez desktop E2E.
- [x] P1.12 Split Face/Body bez dublowania narzędzi tnących.
  - [x] P1.12a Split Body bazową albo konstrukcyjną płaszczyzną, z zachowaniem obu wynikowych brył, trwałym ID drugiej bryły, edycją, undo/redo, autozapisem i ponownym otwarciem.
  - [x] P1.12b Split Face zamkniętym profilem szkicu na wskazanej planarnej ścianie, bez zmiany objętości, z trwałą referencją, anulowaniem, undo/redo, autozapisem i ponownym otwarciem.
- [x] P1.13 Naprawa ścian jako osobne, mierzalne etapy.
  - [x] P1.13a Delete Face + Heal scala wskazane regiony ze zgodnymi sąsiednimi ścianami, chroni pozostałe granice i kontroluje objętość oraz liczbę ścian wynikowej bryły; trwałe referencje, anulowanie, undo/redo, autozapis i ponowne otwarcie przechodzą desktop E2E.
  - [x] P1.13b Replace Face dopasowuje wskazaną planarną ścianę do równoległej powierzchni docelowej innej bryły, zachowuje bryłę referencyjną, odrzuca powierzchnie nierównoległe i przechodzi pełny przepływ trwałych referencji oraz historii.
- [x] P1.14 Revolve zamkniętego profilu wokół osi bazowej albo konstrukcyjnej, z kątem parametrycznym, New/Join/Cut/Intersect, kontrolą położenia osi, edycją, undo/redo, autozapisem i ponownym otwarciem.
- [x] P1.15 Sweep jednego zamkniętego profilu po ciągłej otwartej ścieżce linii z osobnego szkicu, z New/Join/Cut/Intersect, walidacją rozłączeń, edycją, anulowaniem, undo/redo, autozapisem i ponownym otwarciem.
- [x] P1.16 Loft między dwoma zamkniętymi profilami z osobnych szkiców na różnych równoległych płaszczyznach, z przejściem gładkim/odcinkowym, zgodną liczbą otworów, New/Join/Cut/Intersect, edycją, anulowaniem, undo/redo, autozapisem i ponownym otwarciem.
- [x] P1.17 Rib/Web z ciągłego otwartego łańcucha linii szkicu: Rib rośnie w płaszczyźnie, Web prostopadle do niej, oba mają parametryczną grubość i zadany zasięg, stronę oraz kierunek, łączą się z istniejącą bryłą i przechodzą edycję, anulowanie, undo/redo, autozapis i ponowne otwarcie.
- [x] P1.18 Coil jako dokładna bryła helikalna wokół osi bazowej albo konstrukcyjnej, z parametryczną średnicą spirali i przekroju, skokiem, ułamkową liczbą zwojów, kierunkiem prawym/lewym, New/Join/Cut/Intersect, limitem złożoności, kontrolą samoprzecięcia, edycją, anulowaniem, undo/redo, autozapisem i ponownym otwarciem.
- [x] P1.19 Pipe jako dokładny pusty przekrój rurowy prowadzony po ciągłej otwartej ścieżce linii, z parametryczną średnicą zewnętrzną i grubością ścianki, New/Join/Cut/Intersect, walidacją ścieżki i kanału wewnętrznego, edycją, undo/redo, autozapisem i ponownym otwarciem.
- [x] P1.20 Pattern bryły w jednym wspólnym narzędziu: prostokątny z parametrycznymi wierszami/kolumnami i odstępami, kołowy wokół osi bazowej/konstrukcyjnej oraz równomierny po ciągłej ścieżce, z limitem 100 wystąpień, edycją trybu, undo/redo i autozapisem.
- [x] P1.21 Zaawansowane Emboss/Deboss tekstu na wskazanej planarnej ścianie: trwała referencja topologii, lokalny układ powierzchni, kierunek zgodny z normalną dla Emboss i przeciwny dla Deboss, edycja, undo/redo, autozapis i ponowne otwarcie.

## P1 — organizacja dokumentu i produktywność klasycznego CAD

- [x] P1.22 Warstwy szkicu: aktywna warstwa, kolor, typ i grubość linii, widoczność, blokada, drukowanie oraz nadpisania `ByLayer`; starsze dokumenty są normalizowane bez zmiany wersji schematu, a zapis, undo/redo i desktop E2E zachowują właściwości.
- [x] P1.23 Bloki 2D: tworzenie definicji z połączonej geometrii, wybór całego wystąpienia, biblioteka dokumentu, wstawianie z pozycją/obrotem/skalą, atrybuty definicji i wystąpienia, rozbijanie, usuwanie, undo/redo oraz zapis/otwarcie.
- [x] P1.24 Konfigurowalne aliasy i bezpośrednie klawisze podstawowych poleceń: ustawienia ogólne aplikacji, walidacja konfliktów i nazw zarezerwowanych, przywracanie układu Autodesk, dynamiczne tooltipy, podpowiedzi linii poleceń oraz zapis lokalny.
- [x] P1.25 Automatyczne sugestie więzów podczas szkicowania: czytelny podgląd `H/V` przy kursorze, automatyczne wyrównanie i zapis więzu poziomego/pionowego oraz zbieżności punktów, możliwość wyłączenia w palecie szkicu i regresja desktopowa.
- [x] P1.26 Diagnostyka niedowiązania: solver wyznacza bazę przestrzeni swobodnej, wskazuje osie i parametry pozostające do związania, podświetla swobodne punkty oraz udostępnia kompaktowy panel z wyborem geometrii i podpowiedziami następnego więzu.
- [>] P1.27 Raport naprawy importu z jawną listą zmienionych i pominiętych elementów.
- [ ] P1.28 Zapisywane obszary robocze i układy paneli.

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
- [!] Niepodpisane wydanie 6.2.0 nadal wywołuje ostrzeżenia SmartScreen/Gatekeeper; aktualizator może bezpiecznie zweryfikować i otworzyć paczkę, lecz cicha instalacja wymaga certyfikatu platformowego.
- [!] Pełna zgodność EN wymaga usunięcia pozostałych tekstów zakodowanych bezpośrednio w komponentach.
- [!] Kontrast gęstego interfejsu CAD wymaga ręcznej weryfikacji wyników `axe` i testu z czytnikiem ekranu; automatyczna kontrola nie wykrywa obecnie naruszeń blokujących.

## Najbliższe zadania

1. W przyszłości skonfigurować certyfikaty i notaryzację, a następnie przetestować aktualizację między dwiema podpisanymi wersjami.
2. Dokończyć katalog kluczy PL/EN i dodać bramkę wykrywającą nieprzetłumaczone teksty w renderowanym interfejsie.
3. Wydzielić kontroler poleceń, dialogi i usługi dokumentu z `ModelingWorkspace`, zachowując obecny test pełnego przepływu.
4. Sprawdzić import/eksport na fixture'ach z FreeCAD, AutoCAD/DXF, Fusion i popularnych slicerów oraz wykonać ręczny test technologii asystujących.

Dalsze pomysły produktowe pozostają w [BACKLOG.md](./BACKLOG.md) i wymagają osobnej priorytetyzacji.
