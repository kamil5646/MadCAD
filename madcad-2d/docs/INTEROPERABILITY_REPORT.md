# Raport zgodności importu i eksportu

Ostatnia weryfikacja: 2026-08-24, macOS arm64, MadCAD 6.3.2.

## Wynik

| Źródło / przepływ | Sprawdzony plik i narzędzie | Wynik w MadCAD |
| --- | --- | --- |
| AutoCAD 2013 DXF | profil `AC1027`, jednostka `INSUNITS=4` | 5 krzywych, 1 zamknięty profil, milimetry |
| Autodesk Fusion DXF | szkic DXF w milimetrach | 4 krzywe, 1 zamknięty profil, milimetry |
| DWG R2000 | realne utworzenie DWG i konwersja przez GNU LibreDWG 0.13.3 (`dwgread`) | 4 krzywe, 1 zamknięty profil |
| FreeCAD / OpenCascade STEP | oficjalny `as1-ac-214_small.stp` z repozytorium FreeCAD, przypięty do commita `46f7684bfa2c6814a1a22ef43013924f7eb2b860` | pełny import jako dokładny B-Rep; 86 790 B; SHA-256 `80c8ace7c72ed12d02ab45f8471528c192990781dbb6e4afe975058c6197ca45` |
| Bambu Studio 2.8.2 3MF | rzeczywisty wynik CLI Bambu Studio `02.08.02.61`, zapisany w korpusie jako Base64 | 1 obiekt, 4 trójkąty, 20 × 20 × 20 mm, objętość 1333,333 mm³, natywna siatka |
| MadCAD STL/3MF | eksport, ponowny import i walidacja siatki w `verify:model-import` | zachowane dodatnie gabaryty i objętość; otwarta siatka pozostaje edytowalna jako mesh, a STEP jest dla niej jawnie blokowany |

Oficjalne źródło STEP: [FreeCAD `data/tests/Step/as1-ac-214_small.stp`](https://github.com/FreeCAD/FreeCAD/blob/46f7684bfa2c6814a1a22ef43013924f7eb2b860/data/tests/Step/as1-ac-214_small.stp).

## Znaleziony i naprawiony problem

Bambu Studio używa rozszerzenia 3MF Production: główny `3D/3dmodel.model` zawiera komponent, a właściwa siatka znajduje się w `3D/Objects/object_1.model`. Poprzednia inspekcja czytała tylko pierwszy plik `.model`, dlatego poprawny projekt Bambu pokazywał 0 trójkątów. MadCAD odczytuje teraz wszystkie pliki modelu w archiwum, liczy wyłącznie obiekty z siatką i zachowuje jednostkę głównego modelu. Test jednostkowy oraz zapisany rzeczywisty plik Bambu chronią ten wariant przed regresją.

## Powtarzanie testu

- `npm run verify:external-compatibility` — pełny lokalny przepływ DXF, DWG, oficjalnego STEP i zapisanego 3MF Bambu przez rzeczywisty interfejs oraz silnik MadCAD.
- `MADCAD_LIVE_BAMBU=1 npm run verify:external-compatibility` — dodatkowo ponownie generuje 3MF przez lokalne Bambu Studio; Bambu Studio powinno być zamknięte, aby jego blokada pojedynczej instancji nie przejęła procesu CLI.
- Wynik maszynowy jest zapisywany w `artifacts/external-compatibility-report.json`.

## Granice potwierdzenia

Na tym komputerze nie ma AutoCAD, Fusion, FreeCAD, PrusaSlicer ani Cura. Profile DXF są deterministycznymi fixture zgodnymi z ich dokumentowanymi formatami, natomiast STEP pochodzi bezpośrednio z oficjalnego repozytorium FreeCAD. Lokalnie potwierdzono rzeczywisty LibreDWG i Bambu Studio. PrusaSlicer/Cura pozostają objęte wspólnym standardem STL, ale ich bieżące aplikacje nie zostały tutaj uruchomione. Nie należy opisywać ich jako przetestowanych end-to-end, dopóki nie przejdą na maszynie z tymi programami.
