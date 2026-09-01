# MadCAD — aktywny plan rozwoju

Aktualizacja: 2026-08-27
Wersja bazowa: `6.4.6 stable`
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
| 10 | M10 Wydanie stabilne | `[x]` | M1–M9 | instalowalna, odzyskiwalna i przetestowana aplikacja Windows/macOS/Linux |

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
- [x] Electron ma context isolation, sandbox, CSP, bezpieczne linki, wspólną kontrolę źródła dla wszystkich 20 kanałów IPC oraz test odrzucenia obcego widoku.
- [x] Budżety wydajności pickingu, meshowania i długiej historii są mierzone w testach core i desktop E2E.
- [x] Przełącznik PL/EN, katalog tekstów nowych przepływów oraz bramka wykrywająca polskie teksty w renderowanym interfejsie EN działają. Dostępność klawiatury i fokusu oraz DPI 100–200% są testowane.
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
- [x] P1.21a Modelowanie powierzchniowe B-Rep: Patch z zamkniętego profilu, Surface Extrude z profilu lub otwartego łańcucha oraz Thicken jednostronny/symetryczny; osobny typ ciała, historia, graf zależności, przeglądarka i desktop E2E.
- [x] P1.21b Surface Revolve: obrót zamkniętego profilu albo otwartego łańcucha wokół osi bazowej/konstrukcyjnej, kąt parametryczny, bezpośredni dostęp z aktywnego szkicu, edycja historii i współpraca z Thicken.
- [x] P1.21c Surface Sweep: prowadzenie zamkniętego profilu albo otwartego łańcucha po osobnym ciągłym szkicu ścieżki, bezpośredni dostęp z aktywnego szkicu, edycja historii, graf zależności i współpraca z Thicken.
- [x] P1.21d Surface Loft: otwarta powierzchnia gładka lub odcinkowa między dwoma zamkniętymi profilami z osobnych równoległych szkiców, edycja historii, graf zależności i współpraca z Thicken.
- [x] P1.21e Surface Offset: dokładne odsunięcie istniejącej powierzchni B-Rep o dodatnią lub ujemną odległość, podgląd, edycja historii, graf zależności i współpraca z Thicken.
- [x] P1.21f Stitch: zszywanie co najmniej dwóch stykających się powierzchni z parametryczną tolerancją; otwarty wynik pozostaje jednym płaszczem, a szczelny płaszcz automatycznie staje się bryłą.
- [x] P1.21g Surface Trim: dokładne odjęcie bryły tnącej od powierzchni B-Rep, opcjonalne zachowanie narzędzia, podgląd, edycja historii i współpraca z Thicken.
- [x] P1.21h Surface Extend: przedłużenie wskazanej prostej krawędzi planarnej powierzchni o parametryczną odległość, trwała referencja topologii i poprawne późniejsze Thicken.
- [x] P1.21i Analiza powierzchni: zebra zależna od kamery, mapa krzywizny siatki z regulowanym zakresem, grzebień krzywizny krawędzi, izolinie XYZ oraz klasyfikacja płynnych, przejściowych i ostrych granic ścian bez zmiany historii modelu.

## P1 — organizacja dokumentu i produktywność klasycznego CAD

- [x] P1.22 Warstwy szkicu: aktywna warstwa, kolor, typ i grubość linii, widoczność, blokada, drukowanie oraz nadpisania `ByLayer`; starsze dokumenty są normalizowane bez zmiany wersji schematu, a zapis, undo/redo i desktop E2E zachowują właściwości.
- [x] P1.23 Bloki 2D: tworzenie definicji z połączonej geometrii, wybór całego wystąpienia, biblioteka dokumentu, wstawianie z pozycją/obrotem/skalą, atrybuty definicji i wystąpienia, rozbijanie, usuwanie, undo/redo oraz zapis/otwarcie.
- [x] P1.24 Konfigurowalne aliasy i bezpośrednie klawisze podstawowych poleceń: ustawienia ogólne aplikacji, walidacja konfliktów i nazw zarezerwowanych, przywracanie układu Autodesk, dynamiczne tooltipy, podpowiedzi linii poleceń oraz zapis lokalny.
- [x] P1.25 Automatyczne sugestie więzów podczas szkicowania: czytelny podgląd `H/V` przy kursorze, automatyczne wyrównanie i zapis więzu poziomego/pionowego oraz zbieżności punktów, możliwość wyłączenia w palecie szkicu i regresja desktopowa.
- [x] P1.26 Diagnostyka niedowiązania: solver wyznacza bazę przestrzeni swobodnej, wskazuje osie i parametry pozostające do związania, podświetla swobodne punkty oraz udostępnia kompaktowy panel z wyborem geometrii i podpowiedziami następnego więzu.
- [x] P1.27 Raport naprawy importu: SVG/DXF/DWG jawnie zlicza dodane, zmienione i pominięte elementy, raportuje uproszczenia i nieobsługiwane encje, a import 3D rejestruje konwersję 3MF i skalowanie; wynik ma zwarty podgląd oraz zapis JSON.
- [x] P1.28 Zapisywane obszary robocze i układy paneli: cztery gotowe presety CAD, czyste płótno, narzędzia dokumentu i eksport/druk, do ośmiu nazwanych układów użytkownika, trwały zapis lokalny, usuwanie oraz bezpieczne zastosowanie podczas aktywnego szkicu.
- [x] P1.29 Porządkowanie architektury obszaru modelowania: decyzje linii poleceń są planowane w testowalnym kontrolerze, zapis i odczyt projektu korzystają ze wspólnej usługi dokumentu, a modalne narzędzia szkicu/importu są renderowane przez osobny stos dialogów.
- [x] P1.30 Korpus zgodności wymiany danych: deterministyczne fixture profili AutoCAD 2013 DXF, Fusion sketch DXF, FreeCAD/OpenCascade STEP oraz ASCII STL dla PrusaSlicer/Cura/Bambu mają testy jednostek, profili, trybu B-Rep/mesh i siatki; osobna regresja sprawdza drzewo AX, nazwy kontrolek i kolejność fokusu.
- [x] P1.31a Diagnostyka i bezpieczna naprawa importowanej siatki: wykrywanie duplikatów, degeneracji, powtórzeń, granic otwartych, niemanifold i niespójnej orientacji; naprawa usuwa wyłącznie jednoznaczne błędy, zachowuje otwory, wspiera undo i ponowną ocenę silnika.
- [x] P1.31 Rzeczywista macierz zgodności uruchamia lokalny GNU LibreDWG 0.13.3, oficjalny model STEP z przypiętego commita FreeCAD oraz zapisany wynik CLI Bambu Studio 2.8.2 przez pełny interfejs i silnik MadCAD. Naprawiono 3MF Production z geometrią w zewnętrznych plikach modelu: diagnostyka pokazuje teraz 1 obiekt i 4 trójkąty zamiast zera, a import zachowuje gabaryt 20 × 20 × 20 mm i dodatnią objętość. Raport JSON oraz `docs/INTEROPERABILITY_REPORT.md` rozdzielają wyniki potwierdzone od aplikacji nieobecnych na maszynie.
- [x] P1.32a Wspólne otwory normowane M2–M24: trzy serie przejściowe ISO 273, gwinty metryczne o skoku zwykłym i wybranych drobnych, klasy wewnętrzne 5H/6H/7H, automatyczna średnica i oznaczenie. Metadane przechodzą walidację, edycję, B-Rep, zapis/otwarcie i zasilają skojarzoną tabelę otworów w dokumentacji 2D; zakres oraz źródła opisuje `docs/HOLE_STANDARDS.md`.
- [x] P1.32b Rozszerza gwinty metryczne do M1–M56 i dodaje NPT 1/16–3 oraz BSPT/Rc 1/8–3 z TPI, stożkiem 1:16, wyborem przygotowania, kontrolą sprawdzianem i jawnymi odchyłkami produkcyjnymi. Publiczne zalecenia producentów są odseparowane od płatnych wymagań odbiorowych ASME/ISO; walidacja, stożkowy B-Rep, zapis/otwarcie i tabela otworów mają regresję desktopową.
- [x] P1.33 Draft Analysis oblicza podpisany zakres kąta każdej ściany z rzeczywistych normalnych tessellacji względem kierunku ±X/±Y/±Z i tolerancji 0–45°. Widok 3D nakłada rozróżnialne kolory pochylenia dodatniego, zerowego, ujemnego i mieszanego, panel pokazuje liczniki oraz jawnie zgłasza siatki bez mapy ścian; analiza nie zmienia historii modelu.
- [x] P1.34a Interference uruchamia dokładną analizę tylko dla dwóch świadomie wskazanych wystąpień, odróżnia potwierdzone przecięcie siatek od ryzyka obwiedni i wyniku czystego oraz pokazuje wymiary nakładania obwiedni bez przedstawiania ich jako dokładnej objętości przecięcia.
- [x] P1.34b Named Views zapisuje w dokumencie dokładną pozycję kamery, punkt celu i kierunek góry po dowolnej orbicie lub panoramowaniu. Zwarty panel przywraca widok jednym kliknięciem, usuwa go z Undo/Redo i zachowuje dane po ponownym otwarciu bez podnoszenia zgodnego wstecznie schematu v15.
- [x] P1.34c ViewCube udostępnia komplet widoków Góra/Dół/Przód/Tył/Lewo/Prawo oraz izometrię w zwartej, przestrzennej kontrolce. Każdy kierunek ma nazwę dostępności, stan aktywny i test rzeczywistego wektora kamery; forma pozostaje płaska bez gradientów i nie zasłania narzędzi nawigacji.
- [x] P1.35a Appearance zapisuje na definicji komponentu preset, kolor, metaliczność i chropowatość, stosuje je do wszystkich wystąpień w widoku 3D oraz zachowuje zgodność ze starszymi dokumentami bez pola wyglądu. Testy potwierdzają zapis/otwarcie, Undo/Redo, rzeczywisty materiał renderera i układ panelu bez przepełnienia.
- [x] P1.35b Exploded View rozsuwa widoczne wystąpienia części od środka złożenia deterministycznym suwakiem 0–100%, nie zmieniając położeń projektowych, jointów, kolizji ani historii. Kolory kolizji zostają wyłączone wyłącznie w rozstrzelonym podglądzie, a test desktopowy potwierdza rozsunięcie, powrót do położeń projektowych i układ panelu bez przepełnienia.

## P2 — dokumentacja techniczna 2D

- [x] P2.1 Obszar `DOKUMENTACJA`: arkusze A4/A3 w orientacji poziomej lub pionowej, skojarzony widok bazowy z rzeczywistych krawędzi aktualnego modelu, kierunki Front/Top/Right/Isometric, automatyczny dobór standardowej skali, położenie na arkuszu, tabliczka, zapis/otwarcie, undo/redo, podgląd 1:1 i bezpośredni eksport PDF.
- [x] P2.2 Skojarzone widoki rzutowane, przekroje z rzeczywistego przecięcia modelu i kreskowaniem oraz powiększone detale tworzone od widoku bazowego; kontrola wyrównania, zależności rodzic–dziecko, automatyczna aktualizacja po przebudowie, bezpieczne usuwanie kaskadowe i układ arkusza 2×2.
- [x] P2.3 Skojarzone wymiary gabarytowe poziome/pionowe, osie i znaczniki środka, automatyczne opisy średnicy otworu, opisy gwintu z klasą oraz tolerancje symetryczne i odchyłkowe; adnotacje aktualizują się z widokiem, zapisują w projekcie, przechodzą undo/redo, autozapis, round-trip, PDF i desktop E2E.
- [x] P2.4 Podstawowe ramki GD&T (pozycja, płaskość, równoległość, prostopadłość, okrągłość), konfigurowalna tabliczka, zapisywana historia rewizji oraz eksport geometrii, tekstów i oznaczeń arkusza do DXF w milimetrach; schemat v8 ma migrację v7 i pełną walidację.
- [x] P2.5 Automatyczne BOM z komponentów lub brył, skojarzone balony pozycji oraz tabela średnic i liczby otworów z topologii modelu; czytelne numery części, edycja położenia, usuwanie kaskadowe, migracja schematu v8→v9, zapis/otwarcie, undo/redo, autozapis oraz eksport PDF/DXF są objęte testami core, UI i desktop E2E.

## P3 — komponenty i złożenia

- [x] P3.1 Części, złożenia i podkomponenty: hierarchia bez cykli i wielu rodziców, origin XYZ, numer części, opis, materiał, ilość, wyłączna własność brył, przenoszenie i bezpieczne usuwanie z promocją dzieci. Struktura jest widoczna w przeglądarce projektu oraz panelu właściwości, zasila wielopoziomowy BOM, czyści przypisania po usunięciu historii, przechodzi undo/redo, walidację i migrację schematu v9→v10, testy core/UI oraz desktop E2E.
- [x] P3.2 Wystąpienia komponentów: wielokrotne użycie jednej definicji, zagnieżdżone położenie i obrót XYZ, widoczność, wybór z drzewa i widoku 3D, Ground, powielanie całego poddrzewa oraz Rigid Group przenosząca członków razem. BOM sumuje wystąpienia, usuwanie promuje dzieci i czyści grupy, a migracja v10→v11 odtwarza dotychczasową hierarchię bez utraty danych. Etap ma testy core/UI, undo/redo, walidację zapisu i desktop E2E z kontrolą wizualną.
- [x] P3.3 Joints: rigid, revolute i slider mają trwałe referencje osi origin, kotwice, konfigurowalne limity i wartość ruchu. Solver blokuje cykle, Ground, Rigid Group oraz ręczne nadpisanie sterowanego wystąpienia, a usuwanie wystąpień czyści zależności. Jointy są widoczne i wybieralne w przeglądarce oraz widoku 3D, mają bezpośredni panel sterowania, undo/redo, migrację schematu v11→v12, walidację, testy core/UI i desktop E2E z kontrolą wizualną.
- [x] P3.4 Kontrola kolizji w ruchu wykorzystuje szybkie obwiednie oraz ograniczony kosztowo, dokładny test trójkątów z rozróżnieniem potwierdzonej kolizji i ryzyka. Motion Links przekazują ruch wielu jointów przez przełożenie i offset bez cykli, Contact Sets zapisują stale monitorowane pary, a konfiguracje odtwarzają transformacje, widoczność, Ground i wartości jointów bez kopiowania definicji ani geometrii części. Całość jest widoczna w panelu, przeglądarce i widoku 3D, ma czyszczenie zależności, undo/redo, walidację, migrację schematu v12→v13 oraz testy core/UI i desktop E2E.

## P4 — historia i zarządzanie projektem

- [x] P4.1 Bezpieczny rollback osi czasu oznacza aktywną granicę modelu i nie wykonuje późniejszych operacji. Nowe operacje są wstawiane przy markerze, reorder odrzuca zerwanie zależności lub kolejności grupy, a rename/suppress/delete oraz zwijane, nazywane grupy działają z kaskadowym czyszczeniem. Schemat v14 zapisuje marker i grupy, migruje v13 bez utraty danych i przechodzi testy core, walidację, undo/redo oraz desktop E2E z kontrolą wizualną.
- [x] P4.2 Lokalne punkty zapisu projektu przechowują nazwane, niezmienne migawki `.madcad` z czasem, opisem, rozmiarem i liczbą szkiców/operacji. Manifest i jego kopia zapasowa są zapisywane atomowo, limity 20 wersji, 64 MiB na wersję i 256 MiB łącznie automatycznie usuwają najstarsze dane. Kompaktowy panel PL/EN tworzy, przywraca i usuwa wersje z potwierdzeniem; przywrócenie pozostawia poprzedni stan w Undo/Redo, oznacza projekt jako zmieniony i jest dostępne z komunikatu odzyskiwania po awarii. Zaufane IPC blokuje nieprawidłowe ID i obcy widok, a testy core, Electron security oraz desktop E2E sprawdzają prawdziwy zapis, odczyt, limity, odbudowę brył i układ panelu.
- [x] P4.3 Linkowane komponenty projektu wskazują zewnętrzny plik `.madcad`, zapisują względną ścieżkę, ID i SHA-256 źródła oraz zachowują lekką, odświeżalną geometrię proxy STEP zamiast całej historii części. Panel PL/EN pokazuje stan aktualny/zmieniony/brakujący/błąd, odświeża bez zmiany stabilnych ID proxy i naprawia utracone łącze z jawną zgodą na zmianę tożsamości źródła. Usuwanie chroni zależności, odświeżenie przechodzi Undo/Redo, a schemat v15 migruje v14. Natywne otwieranie projektu zachowuje pełną ścieżkę na desktopie; 19 kanałów IPC ma wspólną kontrolę zaufanego widoku. Testy core, PL/EN E2E, Electron security, komponentów, dokumentacji i pełnego modelowania sprawdzają zmianę, brak pliku, naprawę, zapis i układ panelu.
- [x] P4.4 Pack & Go tworzy atomowo przenośny folder projektu nadrzędnego i wszystkich osiągalnych projektów linkowanych. Graf do 200 plików odrzuca cykle, braki, zmienione źródła, podwójne ID, nieprawidłowe ścieżki, pliki ponad 64 MiB i istniejący katalog docelowy przed publikacją paczki. Deterministyczne nazwy rozwiązują kolizje, wszystkie ścieżki są przepisywane przenośnie, a sumy źródeł aktualizowane od liści grafu. `madcad-pack.json` zawiera SHA-256, rozmiar, ID i zależności każdego pliku bez ujawniania ścieżek absolutnych. Natywny dialog, komunikaty PL/EN i uporządkowany pasek 2×2 przechodzą testy core na prawdziwym systemie plików, zaufane IPC, desktop E2E, dostępność, komponenty i kontrolę wizualną.
- [x] P4.5 Porównanie wersji projektu tworzy deterministyczny, tylko do odczytu diff bieżącego dokumentu względem lokalnego punktu zapisu albo zewnętrznego `.madcad`. Parametry, szkice, operacje, komponenty i linki są dopasowywane po trwałym ID, klasyfikowane jako dodane/usunięte/zmienione/bez zmian i opisane listą zmienionych pól. Znaczniki czasu są ignorowane, a duże proxy STEP porównywane odciskiem treści bez renderowania Base64. Kompaktowy panel PL/EN pokazuje źródło, liczniki, grupy i filtry oraz aktualizuje wynik po dalszej zmianie bieżącego modelu bez mutowania historii. Testy core, punkty zapisu, zewnętrzny plik, dostępność, DPI/overflow i wizualny desktop E2E przechodzą; moduł diff ma 98,91% pokrycia linii.
- [x] P4.6 Kondycja projektu tworzy deterministyczny raport tylko do odczytu łączący walidację dokumentu, stany historii, utracone referencje B-Rep, aktualność linków zewnętrznych, diagnostykę silnika i rozmiar danych. Problemy mają stabilny kod, kategorię, priorytet krytyczny/ostrzeżenie/informacja oraz cel nawigacji do operacji, szkicu, komponentu, parametrów albo dokumentu. Zwarty panel PL/EN pokazuje wynik 0–100, sześć kontroli, metryki i filtry; kliknięcie przechodzi do problemu, a eksport JSON dodaje czas wygenerowania bez modyfikowania modelu. Testy core obejmują stan zdrowy i złożone błędy, desktop E2E sprawdza nawigację, prawdziwy pobrany JSON, układ bez overflow i oba języki, a moduł raportu ma 94,89% pokrycia linii.
- [x] P4.7 „Gdzie używane” indeksuje jeden istniejący graf zależności zamiast dublować logikę modelu. Parametry, szkice, profile, geometria szkicu, konstrukcja, operacje, bryły, komponenty i linkowane projekty mają deterministyczne wejścia, bezpośrednich użytkowników, pełne zależności nadrzędne oraz transytywny wpływ zmiany z poziomem odległości. Link projektu wskazuje komponent i stabilne proxy. Zwarty panel PL/EN otwiera się dla bieżącego zaznaczenia, pozwala wyszukać dowolny węzeł, przełącza `Używany przez`/`Używa`/`Wpływ zmiany` i nawiguje do obiektu bez modyfikowania dokumentu. Testy core, desktop E2E, dostępność, DPI/overflow, regresja raportu kondycji i kontrola wizualna przechodzą; moduł inspektora ma 95,70% pokrycia linii.
- [x] P4.8 Globalne „Idź do” buduje deterministyczny indeks parametrów, szkiców, operacji, brył, komponentów, wystąpień, arkuszy, projektów linkowanych i geometrii konstrukcyjnej. Paleta otwierana przyciskiem albo `Ctrl/⌘ K` wyszukuje po nazwie, typie i numerze części bez rozróżniania polskich znaków, porządkuje trafienia według jakości oraz obsługuje strzałki, Enter, Escape, mysz i pusty wynik. Wybrany element otwiera właściwy obszar, panel lub zaznaczenie bez zmiany dokumentu. Interfejs PL/EN, fokus, dostępność, DPI/overflow i układ wizualny sprawdza desktop E2E; test komponentu obejmuje klawiaturę, a 178 testów core potwierdza komplet celów i brak mutacji. Moduł indeksu ma 100% pokrycia linii.

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
- [x] Zgodność EN ma automatyczną bramkę renderowanego tekstu, a nowe przepływy układów, więzów, diagnostyki i raportu importu mają komplet kluczy.
- [x] Automatyczne kontrole axe, kontrastu, drzewa AX i klawiatury oraz ręczny przepływ VoiceOver na macOS nie wykrywają naruszeń blokujących. Wykryte podczas odsłuchu okno aktualizacji przenosi teraz fokus do środka, ogłasza wynik jako status, obsługuje Escape i przywraca fokus na wywołujący przycisk.

## Najbliższe zadania

1. [x] Dodać globalne wyszukiwanie projektu „Idź do” z nawigacją klawiaturą jako etap P4.8.
2. [x] Sprawdzić import/eksport na rzeczywistych plikach z dostępnych lokalnie LibreDWG i Bambu Studio oraz oficjalnym STEP FreeCAD; wynik i uczciwe granice potwierdzenia zapisać w raporcie P1.31.
3. [x] Dodać etap P1.32a wspólnych otworów ISO metrycznych z automatycznym opisem produkcyjnym i tabelą otworów.
4. [x] P1.32b ukończono: NPT/BSPT, dodatkowe rozmiary, jawne tolerancje użytkownika oraz publiczne zalecenia przygotowania bez kopiowania płatnych tabel normatywnych.
5. [x] Dodać P1.33 Draft Analysis z kolorową mapą ścian, wyborem kierunku i tolerancji.
6. [x] Interference P1.34a, Named Views P1.34b i pełny ViewCube P1.34c ukończono.
7. [x] Ręczny przepływ VoiceOver na kandydacie macOS 6.4.0 objął uruchomienie, licencję, samouczek, linię od wskazanego punktu z długością `50 mm` zatwierdzoną Enterem, komunikaty snap/status, cofnięcie i aktualizator. Naprawiono fokus, ogłaszanie wyniku i Escape w aktualizatorze; regresja sprawdza teraz także przywrócenie fokusu mimo użycia `autoFocus`.
8. W przyszłości skonfigurować certyfikaty i notaryzację, a następnie przetestować aktualizację między dwiema podpisanymi wersjami.
9. [>] Przebudować przepływ i hierarchię interfejsu według lokalnie zweryfikowanego Autodesk Fusion; aktywna lista oraz kryteria odbioru: [docs/FUSION_UI_CHECKLIST.md](./docs/FUSION_UI_CHECKLIST.md).

Dalsze pomysły produktowe pozostają w [BACKLOG.md](./BACKLOG.md) i wymagają osobnej priorytetyzacji.
