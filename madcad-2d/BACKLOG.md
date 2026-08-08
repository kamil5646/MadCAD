# MadCAD — backlog po ścieżce P0

Ten dokument nie ustala bieżącej kolejności. Aktywna ścieżka znajduje się w [ROADMAP.md](./ROADMAP.md).

## P1 — rozszerzenie modelowania części

- Pozostały zestaw wymiarów i więzów po ukończeniu symmetry/collinear oraz ordinate/długości łuku: curvature.
- Szyk szkicu po ścieżce z pomijaniem wystąpień; szyki prostokątny i kołowy ukończono jako `P1.4`.
- [x] Import SVG/DXF do szkicu — przeniesiony i ukończony jako `P1.1` w aktywnym planie.
- Rozbudowany UCS, płaszczyzny tangent/angle/path oraz pełny zestaw osi i punktów konstrukcyjnych.
- Extrude To Object, offset start, draft i thin extrude.
- Press Pull, Draft, Split Face/Body, Delete/Heal/Replace Face.
- Revolve, Sweep, Loft, Rib/Web, Coil, Pipe, pattern i zaawansowane Emboss/Deboss.
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
