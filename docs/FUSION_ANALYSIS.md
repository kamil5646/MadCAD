# Analiza Autodesk Fusion jako punktu odniesienia dla MadCAD

Data analizy: 2026-08-04

## Cel

MadCAD nie ma kopiować marki ani całego interfejsu Autodesk Fusion. Celem jest przejęcie sprawdzonego sposobu pracy:

1. szkic opisuje zamiar projektowy,
2. zamknięty profil staje się dokładną bryłą,
3. każda operacja jest parametryczna i edytowalna,
4. drzewo projektu pokazuje komponenty, bryły i szkice,
5. historia pozwala wrócić do wcześniejszej operacji,
6. model można lokalnie zapisać w formacie produkcyjnym.

Głównym użytkownikiem MadCAD pozostaje osoba projektująca części mechaniczne, uchwyty, obudowy, elementy stalowe i modele do druku 3D.

## Pełna mapa Fusion

### 1. Data i współpraca

- projekty, foldery i wersje dokumentów,
- przechowywanie w chmurze i współdzielenie,
- komentarze, rewizje i kamienie milowe,
- import oraz eksport formatów CAD.

MadCAD vNext: lokalne pliki projektu, autozapis i kopie bezpieczeństwa. Współpraca chmurowa jest poza pierwszym zakresem.

### 2. Design

#### Sketch

- płaszczyzny XY, XZ, YZ oraz płaskie ściany brył,
- linia, polilinia, prostokąt, okrąg, łuk, elipsa, wielokąt i splajn,
- geometria konstrukcyjna, osie i rzutowanie krawędzi,
- przycinanie, wydłużanie, odsunięcie, lustro i szyki,
- wymiary sterujące oraz pomiarowe,
- więzy: coincident, horizontal/vertical, parallel, perpendicular, tangent, concentric, equal, midpoint, symmetry i fix,
- rozpoznawanie profili otwartych i zamkniętych,
- informacja o stopniu związania szkicu.

#### Solid

- bryły pierwotne,
- extrude i thin extrude,
- revolve,
- sweep i loft,
- hole i thread,
- rib, web i draft,
- fillet, chamfer i shell,
- combine: join, cut, intersect,
- split body/face,
- move/copy, align, scale,
- mirror oraz pattern,
- press/pull i direct editing.

#### Surface

- powierzchnie z profili,
- patch, trim, extend, stitch i thicken,
- naprawa przerw i konwersja powierzchni do bryły.

#### Form

- modelowanie T-Spline i swobodne kształtowanie organiczne.

#### Mesh

- import STL/OBJ/3MF,
- analiza i naprawa siatki,
- redukcja liczby trójkątów,
- konwersja mesh/B-Rep,
- cięcie i łączenie siatek.

#### Sheet Metal

- reguły blachy,
- flange, bend, unfold/refold,
- flat pattern i eksport produkcyjny.

#### Assemble

- komponenty i wystąpienia,
- joints i ograniczenia ruchu,
- grupy sztywne, kontakt i kontrola kolizji,
- konfiguracje wariantów.

### 3. Render

- materiały i wygląd powierzchni,
- środowisko, światła i kamera,
- rendering lokalny/chmurowy.

### 4. Animation

- widoki rozstrzelone,
- ruch komponentów,
- ścieżki montażu i eksport filmu.

### 5. Simulation

- analiza statyczna, modalna, cieplna i wyboczeniowa,
- materiały, kontakty, obciążenia i utwierdzenia,
- siatka obliczeniowa i interpretacja wyników.

### 6. Manufacture

- setup półfabrykatu i układu współrzędnych,
- frezowanie, toczenie, wiercenie i cięcie,
- additive manufacturing,
- generowanie i symulacja ścieżek,
- postprocesory i G-code,
- inspekcja.

### 7. Drawing

- rzut bazowy, rzuty zależne, przekroje i detale,
- arkusze, skale, ramki i tabliczki,
- wymiary, opisy, symbole i zestawienia części,
- eksport PDF/DWG/DXF.

### 8. Electronics

- schemat,
- 2D PCB,
- 3D PCB,
- biblioteki symboli, footprintów i modeli,
- dane produkcyjne i BOM.

### 9. Generative Design

- przestrzenie zachowane i przeszkody,
- obciążenia oraz ograniczenia produkcyjne,
- generowanie i porównywanie wariantów.

## Zaobserwowane problemy użytkowników Fusion

### A. Zbyt wiele ścieżek do tego samego celu

Eksport do druku występuje jako Export, Save As Mesh i 3D Print. Użytkownicy wybierają niewłaściwą ścieżkę, a zachowanie offline jest niespójne. MadCAD powinien mieć jedną komendę `Przygotuj do druku`, która zawsze działa lokalnie.

### B. Więzy szkicu są potężne, ale mało czytelne

Automatycznie dodane więzy mogą zaśmiecać szkic, a informacje o zależnościach są trudne do odkrycia. MadCAD powinien pokazywać więzy na żądanie, jasno wskazywać konflikt i umożliwiać cofnięcie automatycznego więzu.

### C. Ciężkie szkice blokują interfejs

Solver więzów i przeliczanie historii potrafią spowolnić duże szkice. MadCAD powinien liczyć geometrię w Web Workerze, przeliczać tylko zależne operacje i pozwalać anulować obliczenie.

### D. Uszkodzona historia jest trudna do naprawy

Błędy jednej operacji propagują się na kolejne elementy timeline. MadCAD powinien wskazywać pierwszą uszkodzoną zależność, zachowywać ostatni poprawny wynik i oferować naprawę od źródła.

### E. Początkujący widzi za dużo możliwości naraz

Pełny Fusion obejmuje tysiące komend i wiele przestrzeni. MadCAD powinien zacząć od trzech czytelnych środowisk: `Szkic`, `Bryła`, `Druk`.

## Zakres MadCAD Core

### Musi znaleźć się w pierwszej kompletnej wersji roboczej

- marka `MadCAD`, bez `2D` w nazwie widocznej użytkownikowi,
- jeden dokument zawierający szkice, parametry, operacje, bryły i ustawienia druku,
- drzewo projektu,
- timeline z edycją, wyłączeniem i usuwaniem operacji,
- szkic na XY/XZ/YZ oraz płaskiej ścianie,
- linia, prostokąt, okrąg, łuk i geometria konstrukcyjna,
- trim, extend i offset,
- podstawowe więzy i wymiary sterujące,
- wykrywanie zamkniętych profili,
- extrude: new/join/cut/intersect,
- revolve,
- hole,
- fillet, chamfer i shell,
- move/copy, mirror i rectangular/circular pattern,
- właściwości bryły: rozmiar, objętość i pole,
- zapis projektu MadCAD,
- lokalny eksport STEP, STL i 3MF,
- kontrola poprawności bryły i wymiarów drukarki,
- pełne undo/redo i autozapis.

### Kolejny etap

- sweep, loft, split i draft,
- import STEP oraz naprawa STL,
- komponenty i proste joints,
- rysunki 2D z modelu,
- blachy,
- biblioteka materiałów i wyglądu,
- integracja ze slicerami.

### Później

- powierzchnie zaawansowane i T-Spline,
- CAM/CNC,
- symulacje,
- PCB,
- rendering i animacja,
- generative design i współpraca chmurowa.

## Źródła

- Autodesk Fusion — workspaces: https://help.autodesk.com/view/fusion360/ENU/?guid=GS-WORKSPACES
- Autodesk Fusion — sketches: https://help.autodesk.com/cloudhelp/ENU/Fusion-Sketch/files/SKT-3D-SKETCH.htm
- Autodesk Fusion — solid extrude: https://help.autodesk.com/view/fusion360/ENU/?contextId=SLD-EXTRUDE-SOLID
- Autodesk Fusion — design history: https://help.autodesk.com/view/fusion360/ENU/?contextId=DESIGN_HISTORY
- Autodesk Fusion — drawings: https://help.autodesk.com/view/fusion360/ENU/?guid=GUID-54D1504C-8885-4EF7-A60E-8E3B902A2632
- Autodesk Fusion — manufacture: https://help.autodesk.com/view/fusion360/ENU/?guid=GUID-BEC5DEA9-AC3E-4FA8-998E-4AE8CD0D0B1E
- Autodesk Fusion — mesh: https://help.autodesk.com/view/fusion360/ENU/?contextId=MESH-OVERVIEW
- Autodesk Fusion — 3D print/export: https://help.autodesk.com/view/fusion360/ENU/?guid=SLD-3D-PRINT
- Autodesk forums — sketch constraints and performance: https://forums.autodesk.com/t5/fusion-design-validate-document/sketch-performance-while-repairing/td-p/13751142
- Autodesk forums — workflow friction: https://forums.autodesk.com/t5/fusion-support-forum/list-of-annoying-things-about-fusion/td-p/13987927
- Fusion community — offline/export friction: https://www.reddit.com/r/Fusion360/comments/1rwi5f1/fusion_crashing_cant_export_stl_or_3mf_from/

## Wniosek

MadCAD powinien być lokalnym, szybkim i zrozumiałym CAD-em parametrycznym dla projektowania mechanicznego i druku 3D. Nie powinien próbować od razu odtwarzać całego Fusion. Wspólny model dokumentu i dokładny kernel CAD są ważniejsze niż liczba widocznych przycisków.
