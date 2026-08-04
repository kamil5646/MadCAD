# MadCAD — główny plan rozwoju

Aktualizacja: 2026-08-04

Status produktu: `6.0.0-alpha.1`

Główna gałąź prac: `agent/madcad-vnext-core`

Ten dokument jest głównym źródłem kolejności prac nad MadCAD. Po każdym ukończonym pakiecie należy zaktualizować status, dopisać wynik testów i wskazać następne zadanie. Nie rozpoczynamy kilku dużych modułów naraz.

## Oznaczenia

- `[x]` — ukończone i zweryfikowane.
- `[~]` — działa częściowo; nie wolno przedstawiać jako pełnej funkcji.
- `[ ]` — nie rozpoczęto.
- `[!]` — blokada wymagająca decyzji albo zmiany architektury.
- Rozmiar `S/M/L/XL` opisuje względną wielkość pakietu, a nie termin kalendarzowy.

## Zasady wykonania

1. Widoczny aktywny przycisk musi wykonywać prawdziwą operację. Atrapy pozostają poza głównym interfejsem.
2. Funkcja jest ukończona dopiero, gdy ma kod, obsługę błędów, cofanie, zapis projektu i test automatyczny.
3. Każda operacja geometryczna musi działać na XY, XZ i YZ albo być wyraźnie oznaczona jako ograniczona.
4. Każdy pakiet kończy się scenariuszem wykonywanym od pustego dokumentu, nie tylko testem pojedynczej funkcji.
5. Nie tworzymy wydania instalacyjnego, jeśli scenariusz główny ma znany błąd P0/P1.
6. Priorytet produktu: projektowanie części do druku 3D. Dokumentacja 2D pozostaje dostępna, ale nie blokuje rozwoju 3D.
7. Interfejs ma strukturę pracy zbliżoną do Fusion 360, a manipulatory bezpośrednie mają zachowywać się podobnie do Shapr3D — bez kopiowania marek i zasobów.

## Stan obecny — punkt wyjścia

### Działa i ma test przepływu

- [x] Natywna aplikacja Electron na Windows.
- [x] Dokument parametryczny, historia operacji, autosave, undo/redo.
- [x] Płaszczyzny szkicu XY, XZ i YZ.
- [x] Prostokąt i okrąg tworzone wymiarami lub wskazaniem punktów.
- [x] Wyciągnięcie profilu oraz bezpośredni uchwyt przeciągania z wartością w mm.
- [x] Otwór z profilu okręgu.
- [x] Podstawowe zaokrąglenie i fazowanie całej bryły.
- [x] Parametry użytkownika.
- [x] Kontrola pola drukarki oraz eksport STL i STEP.
- [x] Opisy aktywnych narzędzi po najechaniu.
- [x] Aktywacja licencji tymczasowo wyłączona jednym przełącznikiem; kod licencji zachowany.

### Działa tylko częściowo

- [~] Zaznaczanie rozpoznaje dokument, szkic, profil i bryłę, ale nie rozpoznaje stabilnie ścian, krawędzi i wierzchołków B-Rep.
- [~] Zaokrąglenie i fazowanie obejmuje wszystkie możliwe krawędzie zamiast wybranych krawędzi.
- [~] Przygotowanie do druku sprawdza gabaryty, ale nie analizuje grubości ścian, nawisów ani szczelności siatki.
- [~] Oś czasu pozwala wybierać i edytować parametry, ale nie ma pełnego wycofania wskaźnika historii, zmiany kolejności i menu operacji.
- [~] Dokumentacja projektu i README opisują częściowo starszą wersję 2D.

### Najważniejsze braki

- [ ] Ogólny model elementów szkicu: linie, łuki, polilinie i krzywe.
- [ ] Wykrywanie dowolnych zamkniętych obrysów i otworów wewnętrznych.
- [ ] Wiązania i pełne wymiarowanie szkicu.
- [ ] Zaznaczanie ścian/krawędzi/wierzchołków.
- [ ] Operacje 3D na wybranej geometrii.
- [ ] Import STEP/STL i narzędzia naprawy modelu do druku.
- [ ] Pełne testy dokumentu, migracji, geometrii i awarii.

---

## TERAZ — pakiet R1 „Prawdziwy szkicownik”

Cel wydania: użytkownik potrafi narysować dowolny zamknięty profil z odcinków i łuków, poprawić go, zwymiarować oraz wyciągnąć w poprawną bryłę.

Zadania wykonujemy dokładnie w tej kolejności.

### R1.1 — nowy model danych szkicu `L`

- [ ] Dodać encje: `point`, `line`, `arc`, `circle` oraz pomocnicze identyfikatory końców.
- [ ] Oddzielić encje szkicu od wykrytych profili zamkniętych.
- [ ] Przygotować migrację bieżącego schematu dokumentu do następnej wersji bez utraty prostokątów i okręgów.
- [ ] Dodać walidację odwołań, usuwania i duplikatów ID.
- [ ] Test: zapis → ponowne otwarcie → identyczna geometria i historia.

### R1.2 — linia i polilinia `M`

- [ ] Narzędzie Linia: punkt początkowy, podgląd, punkt końcowy, Escape kończy polecenie.
- [ ] Narzędzie Polilinia: kolejne segmenty, Enter/Escape kończy, kliknięcie początku zamyka obrys.
- [ ] Wprowadzanie dokładnej długości i kąta z klawiatury.
- [ ] Cofanie ostatniego segmentu bez wychodzenia z polecenia.
- [ ] Test: profil w kształcie litery L utworzony bez prostokąta.

### R1.3 — zaznaczanie i edycja szkicu `L`

- [ ] Zaznaczanie punktu, segmentu i wielu elementów z Ctrl/Shift.
- [ ] Przeciąganie punktów oraz segmentów z podglądem na żywo.
- [ ] Delete usuwa zaznaczenie; undo/redo przywraca dokładny stan.
- [ ] Wybór oknem od lewej i prawej strony.
- [ ] Czytelne stany: hover, selected, constrained, construction, error.
- [ ] Test: przesunięcie wierzchołka zmienia profil i wynik wyciągnięcia.

### R1.4 — snap i prowadnice `M`

- [ ] Przyciąganie do końca, środka, centrum, przecięcia i siatki.
- [ ] Prowadnice pozioma/pionowa oraz podgląd relacji przed kliknięciem.
- [ ] Regulowany próg przyciągania niezależny od poziomu zoomu.
- [ ] Możliwość chwilowego wyłączenia snap klawiszem modyfikującym.
- [ ] Testy wszystkich typów snap przy kilku poziomach zoomu.

### R1.5 — wykrywanie zamkniętych profili `XL`

- [ ] Zbudować graf topologii szkicu z tolerancją geometryczną.
- [ ] Wykrywać zamknięte pętle, pętle zagnieżdżone i otwory wewnętrzne.
- [ ] Odrzucać przerwy, samoprzecięcia i zerowe segmenty z czytelnym komunikatem.
- [ ] Wypełniać poprawne profile na płótnie i umożliwiać ich zaznaczenie.
- [ ] Przekazać dowolną pętlę do OpenCascade i wyciągnąć ją na XY/XZ/YZ.
- [ ] Test: litera L, sześciokąt, profil z otworem i profil z celową przerwą.

### R1.6 — łuki i wielokąty `L`

- [ ] Łuk przez trzy punkty.
- [ ] Łuk środek–początek–koniec.
- [ ] Wielokąt foremny z liczbą boków i wymiarem.
- [ ] Okrąg przez środek i promień pozostaje niezależną encją.
- [ ] Test: wspornik z prostymi bokami, łukiem i otworem.

### R1.7 — modyfikacje szkicu `XL`

- [ ] Przytnij i Wydłuż z podglądem wyniku.
- [ ] Odsuń profil lub łańcuch o zadaną wartość.
- [ ] Przesuń, Obróć, Kopiuj, Lustro i szyk liniowy.
- [ ] Geometria konstrukcyjna niewchodząca do profilu.
- [ ] Wszystkie operacje obsługują undo/redo i zachowują identyfikatory tam, gdzie to możliwe.

### R1.8 — wymiary i wiązania `XL`

- [ ] Wymiary: długość, poziomy, pionowy, kąt, promień, średnica i odległość.
- [ ] Wiązania: coincident, horizontal, vertical, parallel, perpendicular, tangent, concentric, equal, midpoint i fixed.
- [ ] Solver zgłasza szkic niedowiązany, poprawny oraz przewiązany.
- [ ] Zmiana parametru aktualizuje szkic i całą historię bryły.
- [ ] Test: w pełni związany szkic wspornika reagujący na zmianę dwóch parametrów.

### Kryterium zamknięcia R1

- [ ] Od pustego dokumentu można narysować niesymetryczny wspornik z linii i łuków, dodać dwa otwory, zmienić wymiar, wyciągnąć bryłę i wyeksportować poprawny STEP/STL.
- [ ] Brak aktywnych atrap w obszarze Szkic.
- [ ] Testy jednostkowe modelu szkicu oraz automatyczny test desktopowy przechodzą bez wyjątków.

---

## POTEM — pakiet R2 „Bezpośrednie modelowanie 3D”

Cel wydania: większość podstawowych zmian bryły wykonuje się przez zaznaczenie geometrii i przeciągnięcie manipulatora.

### R2.1 — stabilne zaznaczanie B-Rep `XL`

- [ ] Identyfikatory ścian, krawędzi i wierzchołków odporne na podstawowe przeliczenie historii.
- [ ] Filtry zaznaczania: profile, ściany, krawędzie, bryły.
- [ ] Multi-select, wybór przez nakładanie i menu kontekstowe.
- [ ] Podświetlenie hover bez kosztownego przeliczania bryły.

### R2.2 — uniwersalny manipulator `L`

- [ ] Strzałki osiowe, uchwyty płaszczyzn i pierścienie obrotu.
- [ ] Wartość przy uchwycie, snap, wpis liczbowy i anulowanie.
- [ ] Jeden system dla wyciągnięcia, przesuwania, obrotu i odsunięcia ściany.

### R2.3 — wyciągnięcie kompletne `L`

- [ ] Automatyczne `Nowa bryła / Połącz / Wytnij / Część wspólna` z możliwością ręcznej zmiany.
- [ ] Jedna strona, dwie strony i symetrycznie.
- [ ] Zakres: odległość, do obiektu, przez wszystko.
- [ ] Kąt pochylenia ścian.
- [ ] Edycja istniejącego kroku przez manipulator na modelu.

### R2.4 — podstawowe operacje bryłowe `XL`

- [ ] Union, Subtract i Intersect dla wskazanych brył.
- [ ] Offset Face / Push-Pull dla płaskich i prostych ścian.
- [ ] Fillet i Chamfer tylko na wskazanych krawędziach.
- [ ] Shell z kontrolą grubości ściany.
- [ ] Draft dla wskazanych ścian.
- [ ] Move, Rotate, Align i Scale bryły.

### R2.5 — tworzenie złożonych brył `XL`

- [ ] Revolve.
- [ ] Sweep.
- [ ] Loft.
- [ ] Rib/Web.
- [ ] Mirror oraz szyk liniowy i kołowy operacji.

### Kryterium zamknięcia R2

- [ ] Użytkownik tworzy obudowę z pokrywą, otworami, żebrami, shell i wybranymi zaokrągleniami bez używania atrap lub operacji „na wszystkie krawędzie”.

---

## PAKIET R3 „Druk 3D”

Cel wydania: MadCAD przygotowuje wiarygodny model do slicera i wykrywa najczęstsze problemy przed eksportem.

- [ ] Profile drukarek i stołów: Bambu Lab, Prusa, Creality oraz własny profil.
- [ ] Jednostki, pozycja, obrót, skala, kopiowanie i automatyczne ułożenie na stole.
- [ ] Import STL, STEP i 3MF z poprawną obsługą jednostek.
- [ ] Eksport STL binarny, STEP i 3MF.
- [ ] Analiza: rozmiar stołu, zamknięta bryła, odwrócone normalne, minimalna grubość, małe otwory, nawisy i trudne mosty.
- [ ] Proste naprawy siatki i ponowne tworzenie siatki z B-Rep.
- [ ] Przekrój modelu oraz pomiar grubości w zaznaczonym miejscu.
- [ ] Ustawienie tolerancji druku i kompensacji otworów.
- [ ] Test: eksport części z gwintem/otworem do slicera bez zmiany skali.

---

## PAKIET R4 „Historia, projekty i zespoły”

- [ ] Cofnięcie wskaźnika osi czasu i wstawianie operacji w środku historii.
- [ ] Zmiana kolejności, suppression, rename, delete i grupowanie operacji.
- [ ] Stabilne migracje formatu `.madcad` oraz kopie awaryjne.
- [ ] Import/eksport projektu z osadzonymi zależnościami.
- [ ] Komponenty i proste zespoły.
- [ ] Wiązania zespołu: fixed, revolute, slider i rigid.
- [ ] Wykrywanie kolizji i podstawowy przekrój zespołu.
- [ ] Generowanie dokumentacji 2D z widoków bryły, wymiarami i eksportem PDF/DXF.

---

## PAKIET R5 „Aplikacja gotowa do wydania”

- [ ] Testy migracji, autosave, awarii workera i dużych modeli.
- [ ] Odtworzenie sesji po awarii bez utraty ostatniej poprawnej operacji.
- [ ] Pomiar wydajności viewportu, meshowania i przeliczania historii.
- [ ] Skróty klawiaturowe, dostępność, skalowanie DPI i obsługa wielu monitorów.
- [ ] Aktualizator z kanałami `alpha`, `beta`, `stable` i możliwością cofnięcia wersji.
- [ ] Decyzja o ponownym włączeniu licencji; test trybu online i offline przed wydaniem.
- [ ] Instalator Windows, podpis, czysta instalacja, aktualizacja istniejącej wersji i odinstalowanie.
- [ ] Aktualna dokumentacja użytkownika oraz samouczek „pierwsza część do druku”.
- [ ] Lista znanych ograniczeń widoczna przed publikacją.

---

## Parking — nie zaczynać przed R1/R2

- Modelowanie powierzchniowe klasy Fusion.
- Zaawansowana edycja siatek.
- Konstrukcja blachowa i rozwinięcia.
- Generatywne projektowanie i optymalizacja topologii.
- CAM, ścieżki CNC i symulacja obróbki.
- Renderowanie fotorealistyczne.
- Chmura, współdzielenie projektu i jednoczesna edycja.
- Wtyczki i publiczne API.

Te obszary są wartościowe, ale rozpoczęcie ich przed ukończeniem szkicownika i selekcji B-Rep rozproszyłoby rozwój.

## Rejestr decyzji produktu

- 2026-08-04 — MadCAD pozostaje aplikacją desktopową, nie aplikacją przeglądarkową.
- 2026-08-04 — Dotychczasowe 2D pozostaje jako „Dokumentacja”; główny produkt rozwija modelowanie 3D.
- 2026-08-04 — Priorytetem jest projektowanie pod druk 3D.
- 2026-08-04 — Struktura UI czerpie z Fusion 360, a bezpośrednia manipulacja z Shapr3D.
- 2026-08-04 — Niedziałające opcje nie mogą być prezentowane jako aktywne narzędzia.
- 2026-08-04 — Aktywacja licencji jest tymczasowo wyłączona, ale mechanizm pozostaje w kodzie.

## Następne pojedyncze zadanie

`R1.1 — nowy model danych szkicu`.

Nie przechodzimy do kolejnego dużego modułu, dopóki R1.1 nie ma migracji dokumentu, testów jednostkowych i poprawnego otwarcia obecnych projektów.
