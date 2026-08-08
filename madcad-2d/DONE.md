# MadCAD — ukończone etapy

To archiwum przechowuje wyniki zamkniętych prac. Aktualna kolejność znajduje się w [ROADMAP.md](./ROADMAP.md).

## Fundament CAD R0

- [x] Schemat dokumentu v4, migracje v2 → v3 → v4, walidacja oraz tryb nowszego dokumentu tylko do odczytu.
- [x] Atomowy zapis z kopią `.bak`, autosave i round-trip `.madcad`.
- [x] Wspólna polityka tolerancji, parametry, graf zależności i transakcyjna historia operacji.
- [x] Stany `ok/warning/error/stale/suppressed` i zachowanie ostatniej poprawnej bryły.
- [x] Trwałe sygnatury topologii, rewizje workera, kolejka, LRU oraz odrzucanie spóźnionych wyników.
- [x] Mapowanie tessellacji do trwałych face/edge ID.
- [x] Golden B-Rep, fuzz, budżety wydajności, STEP/STL round-trip i desktop E2E.

## Szkicownik R1.1–R1.7

- [x] Encje point/line/arc/circle/ellipse/ellipticalArc/spline/conic z trwałymi `pointIds`.
- [x] Role standard, construction, centerline, projected i fixed.
- [x] Linia, polilinia, dokładna długość/kąt, cofanie segmentu i styczny łuk.
- [x] Zaznaczanie punktów/segmentów, multi-select, inside/crossing, przeciąganie, Delete oraz undo/redo.
- [x] Snap końca, środka, centrum, kwadrantu, przecięcia, styczności, geometrii i siatki; prowadnice oraz próg niezależny od DPI.
- [x] Graf profili z pętlami, otworami, wyspami i diagnostyką błędnych konturów.
- [x] Łuki, wszystkie warianty prostokąta/okręgu, wielokąty, elipsy, sloty i wspornik testowy.
- [x] Fit/control spline, dokładna racjonalna conic z `rho`, analiza krzywizny i samoprzecięcia.
- [x] Samodzielny punkt jako trwała referencja osi otworu.

## Solver szkicu M1

- [x] Osobny moduł solvera i stany `under-constrained / fully-constrained / conflict / over-constrained`.
- [x] Stopnie swobody punktów i promieni, jawne `fixed` oraz geometria projected.
- [x] Więzy fixed, coincident, horizontal, vertical, distance, angle, radius, diameter, tangent i equal.
- [x] Wymiary sterujące poziome, pionowe, aligned, kąta, promienia i średnicy.
- [x] Minimalny zestaw konfliktowych więzów i diagnostyka bez częściowej zmiany dokumentu.
- [x] Status solvera, DOF i wybieralne badges na canvasie z edycją oraz usuwaniem.
- [x] Przebudowa szkicu i zależnej bryły bez zmiany trwałych ID profilu, encji i operacji.
- [x] W pełni związany wspornik zmienia dwa wymiary, zachowuje poprawną objętość B-Rep i przechodzi autozapis oraz ponowne otwarcie.

## Ostatnia zweryfikowana baza

- Testy rdzenia: 53 zaliczone, 0 błędów.
- Desktop E2E: profile XY/XZ/YZ, spline, conic, parametryczny wspornik, otwór z punktu, fillet/chamfer, autosave, odtworzenie workera oraz eksport STEP/STL.
- Commity kontrolne: `1633cf3`, `6505103`, `be3c067`, `ec5e45f`.

Liczby testów są historycznym zapisem tej bazy; bieżący wynik zawsze pochodzi z aktualnego uruchomienia CI.
