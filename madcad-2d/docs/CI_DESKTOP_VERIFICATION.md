# Pełna bramka desktopowa

Źródłem listy scenariuszy jest `scripts/desktop-verification-manifest.cjs`. Każdy plik `scripts/verify-*.cjs` przeznaczony do aplikacji musi wystąpić w nim dokładnie raz; `npm run verify:product-completeness` sprawdza pokrycie listy, zgodność macierzy CI i brak pominiętych testów. Wydanie nadal uruchamia `npm run verify:desktop-suite -- all`, czyli wszystkie scenariusze kolejno.

W CI testy modelowania są rozdzielone na `modeling` (`verify-modeling.cjs`), `modeling-3d` (`verify-sketch-3d.cjs`) i `modeling-features` (pozostałe 13), uruchamiane równolegle na macOS i Windows. W przebiegu `35905193839` na macOS poprzedni wspólny shard 15 scenariuszy trwał około 602 s, z czego `verify-modeling.cjs` około 347 s. Na Windows cały shard trwał około 1400 s, z czego `verify-modeling.cjs` około 510 s, a `verify-sketch-3d.cjs` około 467 s. Rozdział skrócił ścieżkę krytyczną bez usuwania żadnego scenariusza.

CI `36317981941` dla `719f30d` przeszło 23/23 zadań: rdzeń i build na trzech
systemach, scenariusze desktopowe Windows/macOS oraz pięć testów pakietów.
CodeQL `36317981940` również przeszedł. Wynik dotyczy tego commita; późniejsze
wydzielenie handlerów plików wymaga osobnego CI. Zrzuty z artefaktów `interface`
pokazują czytelny układ standardowy i kompaktowy; `verify-modeling` sprawdza
brak przepełnienia przy skali 100%, 150% i 200% oraz zapisuje osobny zrzut
czystego projektu przy 150% (`artifacts/madcad-design-150-percent.png`). Lokalny
przebieg tego testu przeszedł, a zrzut pokazuje dostępny przycisk pierwszego
szkicu, kartę projektu i czytelną instrukcję startową. Nie zastępuje to uruchomienia
gotowego instalatora na czystym profilu użytkownika.

Lokalny niepodpisany pakiet macOS `release/mac-arm64/MadCAD.app` zbudowany po
wydzieleniu handlerów uruchomiono z osobnym katalogiem wskazanym przez
`MADCAD_TEST_USER_DATA_DIR`. Potwierdzono załadowanie `dist/index.html` z tego
konkretnego pakietu, ekran startowy i okno licencji; adres nie zawierał
`?verify=1`. Zmienna izoluje profil również w pakiecie, ale hooki weryfikacyjne
pozostają tylko w aplikacji niepakietowanej. Ekran licencji wymaga konta, więc
ten smoke test **nie** potwierdza ręcznego modelowania po zalogowaniu ani
instalacji z finalnego instalatora. Potwierdzenie pełnego przepływu pochodzi na
razie z testów desktopowych kodu źródłowego; wydanie wymaga oddzielnego audytu.

`verify:packaged-startup` uruchamia po zbudowaniu pakietu aplikację z osobnym
profilem, lokalnym połączeniem debuggera i limitem 30 s. Dla macOS uruchamia
aplikację wyodrębnioną z ZIP albo zamontowaną z DMG, dla Windows Portable z
ZIP, a dla instalatora NSIS wykonuje cichą instalację w odizolowanym katalogu
runnera Windows, uruchamia zainstalowaną aplikację i wykonuje deinstalację.
Sprawdza załadowanie `app.asar/dist/index.html`, API desktopowe, ekran licencji
oraz brak hooków `?verify=1`; lokalne przebiegi ZIP i DMG macOS przeszły.
W CI na runnerze macOS innym niż arm64 test jawnie raportuje pominięcie,
ponieważ dystrybuowana paczka jest arm64; w workflow wydania taka sytuacja
jest błędem blokującym publikację. Test nie obchodzi wymagania konta i nie
potwierdza pracy po zalogowaniu. Nowsze zielone przebiegi CI obejmują także
cichą instalację, uruchomienie i odinstalowanie NSIS, ale bez zalogowanego konta.

Opcjonalna lokalna kontrola `node scripts/check-packaged-licensed-modeling.cjs`
korzysta z istniejącego zalogowanego profilu wskazanego przez
`MADCAD_LICENSED_PROFILE_SOURCE`. Kopiuje go do katalogu tymczasowego z
uprawnieniami właściciela, uruchamia zbudowany `release/mac-arm64/MadCAD.app`
bez hooków weryfikacyjnych, wchodzi do programu, tworzy bryłę prymitywną,
sprawdza Cofnij/Ponów, a potem tworzy szkic okręgu na XY, Wyciągnięcie i
ponownie Cofnij/Ponów. Profil źródłowy nie jest modyfikowany ani wypisywany,
kopia zostaje usunięta także po błędzie. Narzędzie jest opt-in i nie należy do
CI: runner nie ma konta użytkownika. Lokalny przebieg 2026-09-29 dla commitu
`80f3727` przeszedł na macOS arm64 z zalogowanym kontem w odizolowanym
profilu. Po zbudowaniu `a93d4a5` ten sam przepływ przeszedł także na aplikacji
wyodrębnionej z dystrybuowanego ZIP (`MADCAD_PACKAGED_APP_PATH`). Test wraca do
pustego modelu przez Cofnij; przycisk „Nowy projekt” otwiera natywny dialog
niezapisanych zmian i jest sprawdzany w osobnych testach desktopowych. To
potwierdza pracę po zalogowaniu w tych pakietach, ale nie sprawdza natywnych
okien wyboru pliku ani instalatora Windows po zalogowaniu. Nie zapisuj profilu
w repozytorium ani artefaktach CI.

Oddzielna lokalna próba 2026-09-29 na tej samej niepodpisanej aplikacji macOS
`release/mac-arm64/MadCAD.app` przeszła przez rzeczywiste systemowe okno
„Zachowaj jako” i zapisała plik `.madcad`. Zapis miał schemat 26 i jedną
operację `primitive`. W drugim uruchomieniu z odizolowanym zalogowanym profilem
systemowe okno „Otwórz” wczytało ten sam plik; produkcyjny interfejs pokazał
jedną bryłę i jedną operację, status silnika `ready`, komunikat „Otwarto projekt
Bez nazwy” i brak `__madcadVerifyDocumentState`. Dialogi kontrolowano przez
macOS Accessibility po PID procesu, nie przez hooki aplikacji. To potwierdza
lokalny zapis/otwarcie w niepodpisanym pakiecie macOS, nie w instalatorze
Windows ani w paczce podpisanej/notaryzowanej.

CI `36531322788` dla `8339ad1` zakończyło się 23/23 sukcesami, w tym pełnym
modelowaniem Windows/macOS i pięcioma kontrolami paczek/instalatorów; CodeQL
`36531322575` także przeszedł. Dwa poprzednie przebiegi ujawniły wyścigi
weryfikatora Windows: pobranie ID ścian z podglądu przed zatwierdzeniem modelu
oraz kliknięcie panelu naprawy przed ukończeniem `history.commit`. Weryfikator
czeka teraz na ID ostatniej cechy w silniku oraz nową gotową rewizję po dodaniu
referencji, bez zwiększania timeoutów i bez zmiany logiki CAD.

CI `36333554392` dla `3423bcd` potwierdził wszystkie 14 shardów desktopowych
Windows/macOS, CodeQL, trzy buildy rdzenia oraz paczki Linux, macOS ZIP/DMG i
Windows NSIS. Windows Portable rzeczywiście uruchomił aplikację z rozpakowanego
ZIP, załadował ekran licencji i potwierdził brak hooków testowych, lecz zadanie
zakończyło się błędem podczas usuwania tymczasowego `dxcompiler.dll` (`EPERM`):
proces potomny Chromium nadal trzymał plik. Test zatrzymuje teraz własne
drzewo procesów Windows i ponawia sprzątanie; jeśli blokada systemowa trwa,
raportuje pozostawiony katalog tymczasowy zamiast fałszywie odrzucać poprawny
start. Cała bramka nadal wymaga ponownego zielonego przebiegu CI.

CI `36334532774` dla `094ac48` zakończyło się 16/18 zadań pomyślnie.
Macierz desktopowa Windows/macOS przeszła poza dwoma przypadkami: interfejs
macOS uznał dampowaną kamerę za nieruchomą po kilku próbkach bez klatki, a
`modeling-features` Windows przekroczył budżet 45 s dla odzyskanego korpusu
220 szkiców o 1,837 s. Pozostałe długie shardy modelowania przeszły, co
wyklucza wcześniejsze przerywanie ich przez kolejne commity. Lokalny pełny
pakiet `interface` po stabilizacji czasu obserwacji kamery i ponownym
przeliczeniu układu wstążki przeszedł 12/12. Budżet wydajności nie został
podniesiony; następny CI sprawdzi, czy przekroczenie na Windows się powtarza.

CI `36442074852` dla `52f4309` przeszło 23/23 zadań: wszystkie shardy
desktopowe Windows/macOS i pięć testów pakietów, łącznie z Windows Portable.
CodeQL `36442074932` również przeszedł. Odzyskanie korpusu 220 szkiców na
Windows trwało 6,765 s, więc poprzednie przekroczenie 46,837 s nie powtórzyło
się bez zmiany limitu. Ten przebieg nie obejmuje jeszcze faktycznej instalacji
NSIS dodanej w późniejszym commicie.

CI `36444152685` dla `0d08152` przeszło 23/23 zadań, a CodeQL
`36444152554` zakończył się sukcesem. Zadanie Windows uruchomiło
`MadCAD.exe` z katalogu utworzonego przez instalator NSIS (`packageSource:
nsis-installed`), załadowało `app.asar/dist/index.html` z izolowanym
profilem oraz ekran licencji bez hooków testowych, po czym wykonało
deinstalację. To potwierdza start po rzeczywistej instalacji na runnerze,
ale nie projektowanie po zalogowaniu kontem użytkownika.

CI `36448327496` dla `4a69cad` przeszło 23/23 zadań, w tym rozszerzony
desktopowy scenariusz szkicu na bocznej ścianie z wycięciem, Cofnij/Ponów,
zapisem/otwarciem `.madcad` i naprawą referencji. Wariant naprawy skośnej
ściany oraz nowa obsługa obrotu płaszczyzny źródłowej są późniejszymi
lokalnymi zmianami i wymagają kolejnego CI.

CI `36518052349` dla `45510ab` przeszło 23/23 zadań, a CodeQL
`36518052338` zakończył się sukcesem. Test Windows/macOS potwierdził
przesunięcie szkicu na bocznej ścianie po edycji szerokości źródła 50→60 mm,
ponowne przeliczenie zależnego wycięcia oraz zapis/otwarcie `.madcad`.
Późniejsza detekcja starych projektów z prawidłowym ID ściany, lecz nieaktualną
płaszczyzną referencji, wymaga jeszcze oddzielnego CI.

CI `35908613650` dla commitu `63d4a5e` potwierdził wszystkie trzy części modelowania na obu systemach i pięć instalatorów: 23/23 zadań zakończyło się powodzeniem. Główny shard Windows zakończył się po 9 min 36 s od startu zadania, zamiast 23 min 20 s poprzedniego wspólnego shardu (około 2,4× szybciej do końca modelowania). CodeQL `35908613712` również przeszedł.

CI `35910260871` dla commitu `126feba` po zmianie kontroli szybkich przejazdów CAM także przeszedł 23/23 zadań, w tym oba systemy i wszystkie instalatory; CodeQL `35910260767` przeszedł.

CI `35987429110` dla commitu `15e92a5` ujawniło w Windows `modeling-features` wyścig w `verify-extrude-after-sketch.cjs`: po wybraniu narzędzia Linia test zapamiętywał uchwyt weryfikacyjny już po kliknięciu, zanim React zdążył przypisać zamknięcie z nowym poleceniem. Warunek po pierwszym punkcie mógł wtedy potwierdzić jedynie zamknięcie z chwili startu linii, nie to po zapisaniu punktu; drugi punkt trafiał do starej funkcji, a test kończył się na stanie „gotowa linia” z pustym poleceniem. Poprawka zapamiętuje uchwyt przed kliknięciem narzędzia i osobno po jego aktywacji, a każdy następny punkt wymaga nowego uchwytu po aktualizacji dokumentu.

Windows `modeling-features` w CI `35988712001` dla `eb259e2` przeszedł po tej poprawce. Pełne CI zakończyło się powodzeniem: 23/23 zadań, w tym macierz desktopowa na macOS i Windows, Windows 3D/Pipe oraz pięć testów instalatorów. CodeQL `35988711981` także przeszedł. To potwierdza ten commit, nie późniejsze zmiany CAM ani całkowitą gotowość produktu do wydania.

CI `35990224163` dla `f590a72` przeszedł 23/23 zadań, a CodeQL `35990224177` również zakończył się powodzeniem. Potwierdza to kontrolę przejazdów między operacjami na tym commicie. Commit `1887f64` z własnymi frezami przeszedł CI `36276121596` 23/23 i CodeQL `36276121602`. Późniejszy commit `ae635d6` z węższą, zmierzoną oprawką freza czołowego przeszedł CI `36278864404` 23/23 i CodeQL `36278864403`. Te wcześniejsze przebiegi nie dotyczyły zmian kontroli siatki mocowania w `044b871` i `8ec1281`.

CI `36279789091` dla `8ec1281` potwierdził również nowszą kontrolę siatki: 23/23 zadań, łącznie z pełną macierzą desktopową i pięcioma instalatorami. CodeQL `36279789087` przeszedł. Zmiana profilu oprawki w schemacie v26 powstała później i wymaga własnego przebiegu; nie przypisuj jej tego wyniku.

CI `36280738840` dla `d3a3a2d` potwierdził schemat v26, wielostopniową oprawkę i poprawiony podgląd: 23/23 zadań. CodeQL `36280738826` także przeszedł. Późniejsza emisja `G43 Hn` po zmianie narzędzia wymaga osobnego przebiegu i nie jest potwierdzona tym CI.

CI `36293950269` dla `4ea37a8` przeszedł 23/23 zadań, w tym pełne scenariusze desktopowe macOS/Windows i pięć testów instalatorów; CodeQL `36293950200` również przeszedł. Ten przebieg obejmuje `G43 Hn` po `M6` i blokadę pełnego programu GRBL z wieloma narzędziami. Późniejsza poprawka wycofania noża tokarskiego wymaga osobnego CI; jej lokalne testy nie zastępują macierzy platform.

CI `36294780599` dla `7014c41` przeszedł 23/23 zadań, w tym pełną macierz desktopową i pięć testów instalatorów; CodeQL `36294780587` przeszedł. Potwierdza to poprawkę wycofania noża tokarskiego na tym commicie. Następne lokalne commity z kontraktem sondowania i zawężeniem kolizji skośnej szczęki nie są objęte tym przebiegiem; po wypchnięciu wymagają własnego CI.

CI `36295626938` dla `a8c44f9` potwierdził testy core/build i CodeQL `36295626865`, lecz Windows `analysis` przerwał się po poprawnym raporcie `verify-drawing-workspace.cjs`: po wszystkich asercjach i wypisaniu wyniku Electron zgłosił `PostQueuedCompletionStatus: (6) The handle is invalid` i kod 2147483651. Nie jest to dowód regresji rysunku ani zielona bramka. W `fa7caae` wyjście tego scenariusza czeka na callback opróżnienia strumienia przed `app.exit(0)`; lokalny test rysunku i lint przeszły, ale Windows musi potwierdzić poprawkę w następnym CI.

CI `36295981700` dla `c5dc724` potwierdził tę poprawkę na Windows: `analysis` i wszystkie pozostałe scenariusze desktopowe macOS/Windows oraz pięć instalatorów zakończyły się powodzeniem, 23/23 zadań. CodeQL `36295981689` przeszedł. To nie obejmuje późniejszej poprawki szwu triangulacji pochyłej szczęki; jej lokalne testy wymagają osobnego przebiegu CI po wypchnięciu.

CI `36296797583` dla `a10aeea` zakończył się niepowodzeniem w macOS `modeling-features`: `verify-extrude-after-sketch.cjs` po pierwszym przebiegu odświeżał tę samą kartę po `localStorage.clear()`, a drugi przebieg zobaczył stary szkic z ośmioma encjami i nie osiągnął stanu „gotowa linia”. Pozostałe zadania nie zastępują tej czerwonej bramki. Poprawka zatrzymuje stary renderer przez `about:blank`, czyści storage sesji dopiero po tym i wymaga pustego dokumentu przed drugim przebiegiem; dwa lokalne uruchomienia scenariusza i lint przeszły. Wynik Windows/macOS musi zostać potwierdzony ponownie w CI.

Przy ocenie budżetu dużych projektów porównuj etap i powtórzenie, nie sam czerwony wynik: Windows `modeling-features` w CI `35912028110` przekroczył 45 s przy odtworzeniu korpusu 220 szkiców (47,05 s; siatkowanie 33,14 s), lecz ten sam scenariusz w `35910260871` trwał 22,77 s, a w `35955122785` 17,25 s (siatkowanie 11,82 s). Nie podnoś progu na podstawie pojedynczego skoku obciążenia runnera; najpierw porównaj `initial`/`recovered`, `historyMs`, `meshMs` i ponowny niezależny przebieg. W `35955122785` sam shard `modeling-features` Windows był zielony, lecz shard `project` Windows przerwał kreator naprawy referencji. Jego skrypt musi czekać na ID ostatniej operacji **nowego** fixture także w wyniku silnika; samo `status === ready` mogło nadal oznaczać poprzedni model. Diagnostyka w `35956074757` pokazała drugi wyścig: panel znikał między `waitFor` a osobnym odczytem jego prostokąta w `executeJavaScript`. Odczyt panelu i kandydata musi być atomowy, z ponowieniem gdy panel jest chwilowo odmontowany; komunikat o błędzie nadal powinien wskazywać etap.

Szybka kontrola lokalna po zmianie manifestu:

```sh
npm run verify:product-completeness
node scripts/run-desktop-verification-suite.cjs modeling-features --list
CI=1 node scripts/run-desktop-verification-suite.cjs modeling-features
CI=1 node scripts/run-desktop-verification-suite.cjs modeling-3d
```

Wynik z `--list` musi zawierać 13 unikalnych scenariuszy, a raport kompletności nadal 55 testów desktopowych. Lokalnie po rozdziale przeszły `modeling-features` 13/13 i `modeling-3d` 1/1; główny `modeling` 1/1 przeszedł wcześniej w pełnej serii. Aby ocenić regresję CI, sprawdź oba systemy i wszystkie trzy części modelowania; zielona część nie zastępuje pozostałych. Następnie sprawdź instalatory uruchamiane dopiero po całej macierzy desktopowej.
