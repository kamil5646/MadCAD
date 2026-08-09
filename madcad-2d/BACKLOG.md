# MadCAD — backlog po ścieżce P0

Ten dokument nie ustala bieżącej kolejności. Aktywna ścieżka znajduje się w [ROADMAP.md](./ROADMAP.md).

## P1 — rozszerzenie modelowania części

- [x] Więz `curvature` dla połączonych łuków ukończono jako `P1.7`.
- [x] Szyki szkicu prostokątny, kołowy i po ścieżce z pomijaniem wystąpień ukończono jako `P1.4–P1.5`.
- [x] Import SVG/DXF do szkicu — przeniesiony i ukończony jako `P1.1` w aktywnym planie.
- [x] Płaszczyzny tangent/angle/path, oś normalna do płaszczyzny oraz punkty środkowy i na osi ukończono jako `P1.6`; rozbudowany UCS pozostaje osobnym późniejszym zakresem.
- [x] Extrude To Object i offset start ukończono jako `P1.8` dla płaszczyzn konstrukcyjnych i planarnych ścian.
- [x] Thin Extrude dla zamkniętych profili i otwartych łańcuchów ukończono jako `P1.9`.
- [x] Draft wskazanych ścian względem płaszczyzny neutralnej ukończono jako `P1.10`.
- [x] Press Pull ukończono jako `P1.11`, wykorzystując istniejące Extrude i Offset Face zamiast dublować funkcje oraz format dokumentu.
- [x] Split Face/Body ukończono etapami jako `P1.12`: podział bryły płaszczyzną oraz podział planarnej ściany profilem.
- [x] Delete/Heal/Replace Face ukończono jako `P1.13`: kontrolowane scalanie regionów oraz Replace Face do równoległej powierzchni planarnej.
- [x] Revolve ukończono jako `P1.14` dla osi bazowych i konstrukcyjnych.
- [x] Sweep ukończono jako `P1.15` dla jednego zamkniętego profilu i ciągłej otwartej ścieżki linii osobnego szkicu.
- [>] Loft jest aktywnym etapem `P1.16`; dalej pozostają Rib/Web, Coil, Pipe, pattern i zaawansowane Emboss/Deboss.
- Pełne normy gwintów, clearance/tapped/tapered oraz klasy pasowania.
- Draft Analysis, Interference, Named Views i rozbudowany ViewCube.
- Zaawansowane profile materiałów/druku, heatmapy, automatyczne ułożenie i naprawa siatki.

## Historia, projekty i zespoły

- Rollback osi czasu, wstawianie w środku, reorder, suppress, rename, delete i grupy.
- Historia ręcznych zapisów, odzyskiwanie i linkowane zależności projektu.
- Komponenty, podkomponenty, origin, numer części i właściwości.
- Ground, rigid group, joints, motion limits, motion links, contact sets i konfiguracje.

## Dokumentacja 2D

- Associative base/projected/isometric/section/detail views.
- Wymiary, center marks, hole/thread notes, tolerancje i podstawowe GD&T.
- BOM, balloons, hole table, title block, rewizje oraz eksport PDF/DXF.

## Późniejsze moduły profesjonalne

### Surface i zaawansowany Mesh

- Surface Extrude/Revolve/Sweep/Loft, Patch, Offset, Trim/Extend, Stitch i Thicken.
- Curvature map/comb, zebra, isocurve i diagnostyka ciągłości powierzchni.
- Mesh groups, convert mesh/B-Rep, reduce, remesh, smooth i naprawa skanów.

### Sheet Metal, Plastic, Form i szkic 3D

- Flange, bend, hem, rip, unfold/refold, flat pattern i bend table.
- Boss, snap-fit, grille oraz analizy grubości i pochylenia.
- SubD/T-Spline Form i konwersja do B-Rep.
- Szkic 3D, krzywe przestrzenne i ścieżki na powierzchni.

### Render, Animation, Simulation i Generative

- Appearance, światło, decals i render lokalny.
- Exploded views, storyboard i animacja.
- Walidowane analizy statyczne/termiczne oraz późniejsza optymalizacja topologii.

### Manufacture / CAM

- Setup, stock, narzędzia, frezowanie, toczenie, cięcie, symulacja i postprocesory G-code.

### Electronics, chmura i rozszerzalność

- PCB/MCAD-ECAD wyłącznie po osobnej decyzji produktowej.
- Wersjonowanie chmurowe, komentarze, uprawnienia i współpraca.
- Publiczne API, sandbox wtyczek i marketplace po zamrożeniu kontraktów.
