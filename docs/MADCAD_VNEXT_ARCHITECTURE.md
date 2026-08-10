# MadCAD vNext — architektura rdzenia

## Zasady

1. Electron pozostaje powłoką desktopową.
2. React obsługuje nowe środowiska i panele.
3. Istniejący silnik 2D działa podczas migracji, ale nie jest źródłem geometrii 3D.
4. Three.js odpowiada wyłącznie za viewport i wybieranie elementów.
5. Dokładne bryły B-Rep tworzy OpenCascade uruchomiony w Web Workerze.
6. Każda operacja jest deklaratywnym wpisem timeline, a wynik można przeliczyć od początku.
7. Plik projektu przechowuje zamiar projektowy, nie tylko końcową siatkę.

## Warstwy

### Document Model

- metadata,
- units,
- parameters,
- components,
- sketches,
- features,
- bodies,
- print settings,
- schema version.

### Parametric Evaluator

- buduje graf zależności,
- waliduje parametry i odwołania,
- przelicza tylko zmienione i zależne features,
- zachowuje ostatni poprawny rezultat,
- raportuje pierwszą operację powodującą błąd.

### Sketch Engine

- geometria 2D w lokalnym układzie płaszczyzny,
- solver wymiarów i więzów,
- analiza profili,
- stabilne identyfikatory krawędzi i punktów.

### CAD Kernel Worker

- OpenCascade.js przez warstwę RepliCAD,
- extrude/revolve/boolean/hole/fillet/chamfer/shell,
- triangulacja do viewportu,
- STEP/STL export,
- kontrola poprawności B-Rep.

### Viewport

- Three.js,
- kamera perspektywiczna i ortograficzna,
- standardowe widoki,
- wybieranie brył, ścian i krawędzi,
- manipulator przesunięcia/obrotu,
- podgląd operacji przed zatwierdzeniem.

### Desktop Services

- otwieranie i zapis plików,
- autozapis i recovery,
- eksport lokalny,
- integracja ze slicerem,
- updater zgodny z istniejącymi instalacjami.

## Model operacji

Każda operacja ma:

- trwałe `id`,
- `type`,
- nazwę widoczną w timeline,
- parametry liczbowe lub wyrażenia,
- referencje do profili, brył, ścian i krawędzi,
- stan `active`, `suppressed`, `error`,
- zależności upstream,
- wersję schematu.

Podstawowe typy:

- `sketch`,
- `extrude`,
- `revolve`,
- `hole`,
- `fillet`,
- `chamfer`,
- `shell`,
- `boolean`,
- `transform`,
- `mirror`,
- `pattern`.

## Zgodność

- nazwa widoczna: `MadCAD`,
- wewnętrzny `appId` pozostaje bez zmian do czasu migracji instalacji,
- starsze pliki 2D są importowane jako `Legacy Sketch`,
- release `5.7.0` pozostaje szkicem i nie jest kanałem aktualizacji,
- vNext nie otrzyma publicznego release przed testami migracji, zapisu, eksportu i aktualizacji.

## Kryteria pierwszego checkpointu

1. Utworzenie szkicu na XY.
2. Prostokąt i okrąg z wymiarami.
3. Rozpoznanie zamkniętych profili.
4. Extrude do nowej bryły.
5. Cut okręgiem przez istniejącą bryłę.
6. Edycja wymiaru aktualizuje bryłę przez timeline.
7. Lokalny eksport STEP i STL.
8. Zapis, ponowne otwarcie i identyczne przeliczenie projektu.
