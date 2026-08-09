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

## Rozszerzenia szkicu i konstrukcji P1.1–P1.6

- [x] Import SVG/DXF do aktywnego szkicu obsługuje jednostki, podstawowe krzywe, profile, diagnostykę pominiętej geometrii oraz pełny przepływ zapisu.
- [x] Więzy współliniowości i symetrii działają od solvera do przycisków i znaczników szkicu, z diagnostyką konfliktów.
- [x] Sterujące wymiary ordinate X/Y i długości łuku mają tworzenie oraz edycję na szkicu, transakcyjne błędy, undo/redo, autozapis i ponowne otwarcie w desktop E2E.
- [x] Prostokątny i kołowy szyk szkicu kopiuje punkty, linie, łuki, okręgi i profile, obsługuje listy oraz zakresy pomijanych wystąpień i przechodzi pełny przepływ zapisu.
- [x] Szyk szkicu po pojedynczej linii lub łuku rozstawia kopie równo, utrzymuje orientację albo obraca je do stycznej i obsługuje ten sam przepływ pomijania, undo/redo oraz zapisu.
- [x] Płaszczyzny angle/tangent/path, oś normalna do płaszczyzny oraz punkty środkowy i odsunięty na osi są parametryczne, walidowane i zachowują zależności po ponownym otwarciu dokumentu.
- [x] Więz curvature utrzymuje wspólny okrąg oskulacyjny dwóch połączonych łuków, wykrywa konflikt nieruchomych środków i działa przez przycisk oraz znacznik κ.
- [x] Extrude ma parametryczne odsunięcie początku uwzględniane przez graf zależności, wszystkie zakresy i dokładny B-Rep; edycja wraca bezpiecznie do zera.
- [x] Extrude To Object kończy się na równoległej płaszczyźnie konstrukcyjnej albo planarnej ścianie, zapisuje trwałą zależność i śledzi parametryczne przesunięcie ściany źródłowej.
- [x] Thin Extrude zamkniętego profilu ma parametryczną grubość do wewnątrz, na zewnątrz i symetrycznie oraz dokładny cienkościenny B-Rep.
- [x] Thin Extrude otwartego łańcucha linii porządkuje segmenty niezależnie od kolejności wyboru, odrzuca rozgałęzienia i tworzy dokładny B-Rep z prostym albo wydłużonym zakończeniem.
- [x] Draft pochyla wskazane planarne ściany względem bazowej albo konstrukcyjnej płaszczyzny neutralnej; znak kąta steruje stroną materiału, a trwałe referencje przechodzą pełny przepływ historii i zapisu.
- [x] Press Pull kieruje zamknięty profil do parametrycznego Extrude, a planarną ścianę do Offset Face; jedna kontekstowa komenda nie dubluje geometrii, historii ani formatu projektu.
- [x] Split Body dzieli dokładną bryłę bazową albo konstrukcyjną płaszczyzną, zachowuje obie strony jako trwałe bryły i odrzuca płaszczyznę, która nie przecina wnętrza.
- [x] Split Face odciska zamknięty profil szkicu na jego planarnej ścianie podporowej, tworząc trwały region topologii B-Rep bez zmiany objętości bryły.
- [x] Delete Face + Heal usuwa wskazany region podzielonej ściany przez kontrolowane scalenie zgodnych powierzchni, chroni granice poza wyborem i zachowuje objętość dokładnej bryły.
- [x] Replace Face przesuwa planarną ścianę dokładnej bryły do równoległej powierzchni wskazanej na drugiej bryle, zachowując ją jako niezmienione źródło referencji.
- [x] Revolve obraca zamknięty profil wokół osi bazowej albo parametrycznej osi konstrukcyjnej, obsługuje pełny lub częściowy kąt oraz operacje New/Join/Cut/Intersect na dokładnym B-Rep.
- [x] Sweep prowadzi zamknięty profil po ciągłej otwartej ścieżce linii osobnego szkicu, obsługuje New/Join/Cut/Intersect oraz pełny przepływ edycji, historii i ponownego otwarcia.
- [x] Loft tworzy dokładną bryłę między dwoma zamkniętymi profilami na różnych równoległych płaszczyznach, obsługuje przejście gładkie/odcinkowe, zgodne otwory, operacje bryłowe i pełny przepływ historii oraz zapisu.
- [x] Rib/Web tworzy połączone z bryłą cienkie wzmocnienie z otwartego łańcucha linii; tryby wzrostu w płaszczyźnie i prostopadle do niej mają parametryczną grubość, zasięg, stronę i kierunek.

## Podstawowe modyfikacje szkicu M2

- [x] Trim, Extend i Break linii/łuków działają bezpośrednio na canvasie, zachowują możliwe ID i bezpiecznie usuwają utracone zależności.
- [x] Offset linii, ciągłego łańcucha, profilu, okręgu i łuku obsługuje parametryczną odległość oraz stronę przez znak.
- [x] Sketch Fillet i Chamfer skracają dwie linie, zachowują ID profilu i zależnej operacji oraz odrzucają zbyt duży wymiar transakcyjnie.
- [x] Move, Rotate, Copy, Mirror i Scale mają dokładne pola; Copy tworzy niezależny profil, Mirror odwraca łuk, a Scale respektuje wymiary blokujące.
- [x] Anulowanie, undo/redo, zapis/otwarcie, stabilne profile, błędy bez częściowego stanu i jawne czyszczenie zerwanych więzów są pokryte testami.
- [x] Desktop E2E wykonuje Offset, Fillet, Chamfer i Copy na rzeczywistym szkicu, cofa każdą zmianę i kończy pełnym STEP/STL round-trip.

## Stabilne zaznaczanie B-Rep M3

- [x] Picking ścian, krawędzi i wierzchołków mapuje tessellację na trwałe ID topologii.
- [x] Filtry Auto/Profil/Ściana/Krawędź/Wierzchołek/Bryła, hover i podświetlanie działają bez ponownego przeliczania bryły.
- [x] Ctrl/Shift utrzymuje wybór wielokrotny, Alt przełącza nakładającą się topologię, a Shift+przeciągnięcie zaznacza obszarem.
- [x] Referencje topologii zapisują bryłę, źródłowy i zależny feature oraz deskryptor geometryczny do rankingowania kandydatów.
- [x] Utracona referencja ostrzega na osi czasu, pokazuje operację źródłową i pozwala przypisać zaznaczenie albo sugerowanego kandydata.
- [x] Desktop E2E sprawdza hover, multi-select, cykl, box select, brak nowej rewizji po pickingu oraz pełną naprawę celowo zerwanej referencji.

## Konstrukcja, szkic na modelu i modelowanie części M4–M6

- [x] Płaszczyzny, osie i punkty konstrukcyjne mają trwałe referencje, nazwy, widoczność oraz pełny przepływ zapisu.
- [x] Szkic działa na płaszczyznach bazowych, konstrukcyjnych i planarnych ścianach modelu; Project utrzymuje skojarzone punkty, krawędzie i pętle.
- [x] Extrude obsługuje New/Join/Cut/Intersect, jedną i dwie strony, symetrię oraz Through All.
- [x] Boolean, Fillet/Chamfer wskazanych krawędzi, Shell wskazanych ścian, Box/Cylinder/Sphere/Torus oraz wspólny manipulator działają na dokładnym B-Rep.
- [x] Text tworzy przenośny profil znaków i realizuje nową bryłę, Emboss oraz Deboss bez zależności od fontu systemowego.
- [x] Otwór można umieścić bez szkicu na planarnej ścianie przez dwie prostopadłe krawędzie i dwa parametryczne odsunięcia.
- [x] Otwory proste, Counterbore i Countersink obsługują zakres Distance/Through All oraz dokładną geometrię walcową i stożkową.
- [x] Gwint metryczny ma tryb kosmetyczny i modelowany z parametrami średnicy, skoku, długości oraz kierunku prawego/lewego; liczba zwojów ma bezpieczny limit.
- [x] Profil luzu FFF zwiększa wyłącznie wykonawczą średnicę otworu o dwukrotność naddatku promieniowego, zachowując nominalny wymiar i wyrażenie parametryczne.
- [x] Coil tworzy dokładną parametryczną bryłę helikalną na osi bazowej lub konstrukcyjnej, obsługuje kierunek prawy/lewy i operacje New/Join/Cut/Intersect oraz przechodzi pełny przepływ historii i zapisu.
- [x] Pipe prowadzi rzeczywiście pusty przekrój rurowy po ciągłej ścieżce, kontroluje średnicę wewnętrzną i przechodzi edycję, undo/redo, autozapis oraz ponowne otwarcie w desktop E2E.
- [x] Measure odczytuje długość, odległość, kąt, promień/średnicę, pole i pozycję z trwałego zaznaczenia B-Rep; dla bryły pokazuje też objętość i gabaryt.
- [x] Section Analysis przycina widok wszystkich brył interaktywną płaszczyzną XY/XZ/YZ z regulowanym położeniem i odwracaniem strony, bez mutowania historii.
- [x] Właściwości masowe sumują objętość i pole zaznaczonych brył, przyjmują gęstość materiału, liczą masę oraz ważony środek masy.
- [x] Analiza geometrii raportuje minimalny promień krzywizny z dokładnego B-Rep i kolizje wielu brył potwierdzone dodatnią objętością części wspólnej.
- [x] Przygotowanie druku ma profile stołu Bambu Lab, Prusa i Creality oraz profil własny aktywowany przez ręczną zmianę wymiarów.

## Ostatnia zweryfikowana baza

- Testy rdzenia: 83 zaliczone, 0 błędów.
- Desktop E2E: profile XY/XZ/YZ, spline, conic, parametryczny wspornik, prymitywy, wspólny manipulator, Text/Emboss/Deboss, otwór z punktu, fillet/chamfer, Shell, autosave, odtworzenie workera oraz eksport STEP/STL.
- Commity kontrolne: `1633cf3`, `6505103`, `be3c067`, `ec5e45f`, `0ad3b75`, `1ca5237`, `1a0a02b`, `fe19842`.

Liczby testów są historycznym zapisem tej bazy; bieżący wynik zawsze pochodzi z aktualnego uruchomienia CI.
