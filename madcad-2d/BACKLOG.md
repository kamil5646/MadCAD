# MadCAD — backlog po ścieżce P0

Ten dokument nie ustala bieżącej kolejności. Aktywna ścieżka znajduje się w [ROADMAP.md](./ROADMAP.md).

## P1 — rozszerzenie modelowania części

- [x] Więz `curvature` dla połączonych łuków ukończono jako `P1.7`.
- [x] Szyki szkicu prostokątny, kołowy i po ścieżce z pomijaniem wystąpień ukończono jako `P1.4–P1.5`.
- [x] Import SVG/DXF do szkicu — przeniesiony i ukończony jako `P1.1` w aktywnym planie.
- [x] Rzeczywista macierz LibreDWG, FreeCAD STEP i Bambu Studio 3MF oraz obsługa zewnętrznych modeli 3MF Production — ukończone jako `P1.31`.
- [x] Modalne okna zgodne z macOS Accessibility API: nazwa i rola dialogu, fokus początkowy, pułapka Tab oraz przywracanie fokusu.
- [x] Płaszczyzny tangent/angle/path, oś normalna do płaszczyzny oraz punkty środkowy i na osi ukończono jako `P1.6`; rozbudowany UCS pozostaje osobnym późniejszym zakresem.
- [x] Extrude To Object i offset start ukończono jako `P1.8` dla płaszczyzn konstrukcyjnych i planarnych ścian.
- [x] Thin Extrude dla zamkniętych profili i otwartych łańcuchów ukończono jako `P1.9`.
- [x] Draft wskazanych ścian względem płaszczyzny neutralnej ukończono jako `P1.10`.
- [x] Press Pull ukończono jako `P1.11`, wykorzystując istniejące Extrude i Offset Face zamiast dublować funkcje oraz format dokumentu.
- [x] Split Face/Body ukończono etapami jako `P1.12`: podział bryły płaszczyzną oraz podział planarnej ściany profilem.
- [x] Delete/Heal/Replace Face ukończono jako `P1.13`: kontrolowane scalanie regionów oraz Replace Face do równoległej powierzchni planarnej.
- [x] Revolve ukończono jako `P1.14` dla osi bazowych i konstrukcyjnych.
- [x] Sweep ukończono jako `P1.15` dla jednego zamkniętego profilu i ciągłej otwartej ścieżki linii osobnego szkicu.
- [x] Loft ukończono jako `P1.16` dla dwóch zamkniętych profili na różnych równoległych płaszczyznach, z przejściem gładkim i odcinkowym.
- [x] Rib/Web ukończono jako `P1.17` dla ciągłych otwartych łańcuchów linii, z rozróżnieniem wzrostu w płaszczyźnie i prostopadle do niej.
- [x] Coil ukończono jako `P1.18` dla osi bazowych i konstrukcyjnych, parametrów średnicy, przekroju, skoku, liczby zwojów i kierunku.
- [x] Pipe ukończono jako `P1.19` dla pustego parametrycznego przekroju prowadzonego po ciągłej ścieżce.
- [x] Pattern bryły ukończono jako `P1.20` w trybie prostokątnym, kołowym i po ścieżce.
- [x] Zaawansowane Emboss/Deboss na trwale wskazanej planarnej ścianie ukończono jako `P1.21`; aktywna ścieżka P1 jest zamknięta.
- [x] Wspólne otwory przejściowe ISO 273 i gwinty metryczne M2–M24 z klasami wewnętrznymi 5H/6H/7H ukończono jako `P1.32a`.
- [x] P1.32b: gwinty stożkowe NPT/BSPT, dodatkowe rozmiary i jawne tolerancje produkcyjne ukończono z publicznymi zaleceniami producentów i bez kopiowania płatnych tabel normatywnych.
- [x] Draft Analysis z mapą kątów ścian ukończono jako `P1.33`.
- [x] Interference dla wskazanej pary wystąpień ukończono jako `P1.34a`.
- [x] Named Views z dokładnym zapisem kamery ukończono jako `P1.34b`.
- [x] Rozbudowany ViewCube z sześcioma kierunkami i izometrią ukończono jako `P1.34c`.
- Zaawansowane profile materiałów/druku, heatmapy, automatyczne ułożenie i naprawa siatki.

## Historia, projekty i zespoły

- [x] Rollback osi czasu, wstawianie w środku, reorder, suppress, rename, delete i grupy ukończono jako `P4.1`.
- [x] Historia ręcznych zapisów i odzyskiwanie ukończono jako lokalne, atomowe punkty zapisu `P4.2` z Undo/Redo i dostępem z komunikatu odzyskiwania po awarii.
- [x] Linkowane zależności projektu ukończono jako `P4.3`: względne ścieżki, kontrola tożsamości i zmiany źródła, stabilne proxy STEP, ręczne odświeżanie oraz naprawa brakującego łącza.
- [x] Pack & Go ukończono jako `P4.4`: graf zależności bez cykli, komplet plików, przenośne ścieżki i manifest integralności SHA-256.
- [x] Strukturalne porównanie bieżącego projektu z punktem zapisu lub zewnętrznym `.madcad` ukończono jako `P4.5`.
- [x] Raport kondycji dokumentu, historii, referencji B-Rep, linków i rozmiaru danych ukończono jako `P4.6` z priorytetami, nawigacją i eksportem JSON.
- [x] Widok „Gdzie używane” i wpływ zmiany w grafie zależności ukończono jako `P4.7` z wyszukiwaniem węzłów i nawigacją bez mutacji dokumentu.
- [x] Globalne wyszukiwanie projektu „Idź do” ukończono jako `P4.8` z rankingiem, obsługą klawiatury i bezpośrednią nawigacją bez mutowania dokumentu.
- [x] Komponenty, podkomponenty, origin, numer części i właściwości ukończono jako `P3.1`.
- [x] Wystąpienia komponentów, transformacje, Ground i Rigid Group ukończono jako `P3.2`.
- [x] Joints rigid, revolute i slider z osiami oraz limitami ukończono jako `P3.3`.
- [x] Kontrola kolizji w ruchu, motion links, contact sets i konfiguracje ukończono jako `P3.4`.

## Dokumentacja 2D

- [x] Skojarzony widok bazowy Front/Top/Right/Isometric na arkuszu A4/A3 z automatyczną skalą i eksportem PDF — ukończony jako `P2.1`.
- [x] Skojarzone widoki projected/section/detail, wyrównanie, rzeczywiste przecięcie modelu i automatyczny układ arkusza — ukończone jako `P2.2`.
- [x] Skojarzone wymiary, osie, znaczniki środka, opisy otworów/gwintów i tolerancje — ukończone jako `P2.3`.
- [x] Podstawowe GD&T, tabliczka, rewizje oraz eksport PDF/DXF — ukończone jako `P2.4`.
- [x] BOM, balloons i hole table ukończono jako `P2.5`.

## Późniejsze moduły profesjonalne

### Surface i zaawansowany Mesh

- [x] Surface Extrude, Surface Revolve, Surface Sweep, Surface Loft, Surface Offset, Patch, Stitch i Thicken.
- [x] Surface Trim/Extend: przycinanie powierzchni bryłą oraz przedłużanie prostej krawędzi planarnej powierzchni, oba z historią, podglądem i współpracą z Thicken.
- [x] Curvature map/comb, zebra, izolinie XYZ i diagnostyka ciągłości powierzchni w jednym nieinwazyjnym panelu analitycznym.
- [x] Mesh groups, convert mesh/B-Rep, reduce, remesh, smooth i kontrolowana naprawa skanów.
  - [x] Diagnostyka siatki i bezpieczne czyszczenie: scalanie współrzędnych, usuwanie trójkątów zerowych i zdublowanych, raport otwartych/niemanifold krawędzi oraz niespójnej orientacji.
  - [x] Kontrolowana redukcja, wygładzanie z ochroną otwartych brzegów i grupowanie ścian według kąta cechy.
  - [x] Jednorodny remesh oraz kontrolowana, odwracalna konwersja zamkniętej siatki Mesh/B-Rep.
  - [x] Naprawa kierunku ścian i kontrolowane uzupełnianie małych otworów skanów z jawnym limitem średnicy, licznikiem zmian oraz Cofnij/Ponów.

### Sheet Metal, Plastic, Form i szkic 3D

- [x] Parametryczne modelowanie blach: baza, flange, bend, hem, rip, unfold/refold, flat pattern i bend table.
  - [x] Baza blachowa z regułą grubości, promienia gięcia i współczynnika K, rzeczywistą bryłą B-Rep, podglądem, edycją historii oraz Cofnij/Ponów.
  - [x] Kołnierz krawędziowy z wyborem trwałej prostej krawędzi, długością, kątem, promieniem, odwróceniem kierunku, dziedziczeniem reguły blachy i zapisem naddatku neutralnego.
  - [x] Hem 180° z długością zakładki i kontrolowanym prześwitem oraz Rip odejmujący parametryczną szczelinę wzdłuż trwałej krawędzi.
  - [x] Unfold/Refold oraz ciągły flat pattern z naddatkami liczonymi z promienia, grubości i współczynnika K; ponowne zagięcie odzyskuje dokładną bryłę B-Rep.
  - [x] Skojarzona tabela gięć arkusza 2D z automatycznymi wierszami kołnierzy i Hem oraz eksportem PDF/DXF.
- Boss, snap-fit, grille oraz analizy grubości i pochylenia.
- SubD/T-Spline Form i konwersja do B-Rep.
- Szkic 3D, krzywe przestrzenne i ścieżki na powierzchni.

### Render, Animation, Simulation i Generative

- [x] Appearance: presety i parametry wyglądu komponentów ukończono jako `P1.35a`; światło, decals i render lokalny pozostają późniejszym zakresem.
- [x] Roboczy Exploded View złożeń ukończono jako `P1.35b`; storyboard i animacja pozostają późniejszym zakresem.
- Walidowane analizy statyczne/termiczne oraz późniejsza optymalizacja topologii.

### Manufacture / CAM

- Setup, stock, narzędzia, frezowanie, toczenie, cięcie, symulacja i postprocesory G-code.

### Electronics, chmura i rozszerzalność

- PCB/MCAD-ECAD wyłącznie po osobnej decyzji produktowej.
- Wersjonowanie chmurowe, komentarze, uprawnienia i współpraca.
- Publiczne API, sandbox wtyczek i marketplace po zamrożeniu kontraktów.
