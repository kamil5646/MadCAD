# MadCAD 6.1 — aktualna architektura

Aktualizacja: 2026-08-13

Ten dokument opisuje działający kod 6.1. Nie jest planem hipotetycznego
„vNext”. Kierunek dalszego rozwoju znajduje się w
[`../madcad-2d/ROADMAP.md`](../madcad-2d/ROADMAP.md).

## Granice systemu

1. Electron jest minimalną, uprzywilejowaną powłoką desktopową.
2. React odpowiada za środowisko modelowania, stan interakcji i dialogi.
3. Dokument CAD oraz algorytmy szkicu są niezależne od Reacta.
4. OpenCascade/RepliCAD działa w Web Workerze i tworzy dokładne B-Rep.
5. Three.js odpowiada za prezentację, picking i manipulatory, nie za prawdę
   geometryczną dokumentu.
6. Projekt `.madcad` zapisuje zamiar parametryczny, historię i ustawienia, nie
   wyłącznie końcową siatkę.

## Warstwy

### Dokument i sesja

`src/cad-core/document.js` definiuje wersjonowany schemat projektu, migracje i
walidację. `src/modeling/document-session.js` utrzymuje zapisaną rewizję,
wykrywa `dirty` oraz tworzy wspólną bramę Zapisz/Odrzuć/Anuluj dla Nowy,
Otwórz, zamknięcia aplikacji i aktualizacji.

Sesja ma dwa niezależne zabezpieczenia:

- szybki autozapis lokalny renderera;
- atomowy autozapis plikowy `primary` + `.bak` przez wąskie IPC.

Niepoprawny plik lub przerwany zapis nie zastępuje ostatniego poprawnego
dokumentu. Udany zapis projektu czyści kopię awaryjną.

### Szkic i parametry

Encje 2D żyją w lokalnym układzie płaszczyzny. Solver, analiza profili,
więzy, wymiary i stabilne ID są osobnymi modułami `src/cad-core`. Interfejs
obsługuje zarówno wskazywanie myszą, jak i klasyczny przepływ rysowania:
podstawowy skrót, punkt początkowy, kierunek, wartość i `Enter` — bez osobnego
wiersza poleceń.

### Ewaluator i worker CAD

Worker szereguje operacje, oznacza każdą rewizją, odrzuca spóźnione wyniki i
utrzymuje ograniczony cache. Awaria workera nie niszczy ostatniego poprawnego
modelu; klient uruchamia worker ponownie. OpenCascade odpowiada za bryły,
booleany, fillet/chamfer, shell, triangulację i wymianę STEP/STL/3MF.

Kontrola kolizji ma tanią szeroką fazę AABB. Dokładne przecięcie B-Rep jest
uruchamiane tylko dla par o nakładających się bounds i na jawne żądanie
narzędzia analizy.

### Viewport

`ModelViewport` ładuje Three.js na żądanie i obsługuje kamerę, wybieranie,
widoki standardowe, szkic na płótnie, trwałe referencje oraz manipulatory.
Ciężkie importery/eksportery są osobnymi dynamicznymi fragmentami, dzięki
czemu start aplikacji nie pobiera całego stosu 3D w jednym pliku JS.

### Usługi desktopowe

Preload wystawia tylko wymagane metody poprzez `contextBridge`. Proces główny
ma 11 zaufanych kanałów IPC; każdy przechodzi tę samą kontrolę źródła oraz
walidację rozmiaru i kształtu danych. Jeden ograniczony kanał importu DWG
wybiera plik w procesie głównym, uruchamia wyłącznie wskazany lokalny `dwg2dxf`
albo ODA File Converter i zwraca tekst DXF. Renderer nie przekazuje ścieżki
programu ani pliku i nie instaluje dodatków.

Aktualizator przyjmuje wyłącznie HTTPS z oficjalnego repozytorium, narzuca
limit rozmiaru i SHA-256. Cicha instalacja nadal wymaga poprawnego
Authenticode na Windows albo Developer ID, oczekiwanego Team ID i Gatekeeper
na macOS. Dla niepodpisanego wydania 6.2.0 aktualizator zapisuje zweryfikowaną
paczkę w Pobranych i otwiera ją do potwierdzonej instalacji systemowej; na Linux
wybiera AppImage właściwy dla architektury i nadaje mu prawo uruchomienia.
Renderer nie może podać dowolnego adresu aktualizacji.

## Niezmienne bezpieczeństwa

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`;
- CSP i zablokowana nawigacja poza aplikację;
- zewnętrzne linki są normalizowane do zatwierdzonych adresów HTTPS;
- brak klucza produktu, fingerprintu urządzenia, telemetrii i zdalnej
  aktywacji;
- wydanie bez podpisu musi mieć obowiązkowe SHA-256, test paczki i jawne
  ostrzeżenie, a wbudowany aktualizator nie może obchodzić kontroli podpisu;
- dokument użytkownika nie jest zastępowany przed udanym parsowaniem i
  walidacją nowego dokumentu.

## Format operacji

Każda operacja ma trwałe `id`, `type`, nazwę, parametry lub wyrażenia,
referencje do profili/topologii, zależności, stan oraz wersję schematu. Zmiana
parametru przelicza zależne elementy i zachowuje ostatni poprawny wynik w razie
błędu. Trwałe referencje nie mogą opierać się na indeksie pojedynczej
tessellacji.

## Dług techniczny

Największym pozostałym punktem koncentracji jest `ModelingWorkspace.jsx`,
który nadal łączy rejestr poleceń, dialogi, usługi dokumentu i część
orkiestracji importu/eksportu. Następne wydzielenia powinny zachować obecny test
desktopowy i przebiegać pionowo: kontroler poleceń, dialogi, persistence,
import/export, a dopiero potem mniejsze komponenty widoku.

Pozostałe blokady wydania to rzeczywiste certyfikaty Windows/macOS, test
aktualizacji między dwiema podpisanymi wersjami, pełny katalog PL/EN oraz
fixture'y wymiany danych z zewnętrznych programów.
