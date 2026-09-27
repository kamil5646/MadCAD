# Pełna bramka desktopowa

Źródłem listy scenariuszy jest `scripts/desktop-verification-manifest.cjs`. Każdy plik `scripts/verify-*.cjs` przeznaczony do aplikacji musi wystąpić w nim dokładnie raz; `npm run verify:product-completeness` sprawdza pokrycie listy, zgodność macierzy CI i brak pominiętych testów. Wydanie nadal uruchamia `npm run verify:desktop-suite -- all`, czyli wszystkie scenariusze kolejno.

W CI testy modelowania są rozdzielone na `modeling` (`verify-modeling.cjs`), `modeling-3d` (`verify-sketch-3d.cjs`) i `modeling-features` (pozostałe 13), uruchamiane równolegle na macOS i Windows. W przebiegu `35905193839` na macOS poprzedni wspólny shard 15 scenariuszy trwał około 602 s, z czego `verify-modeling.cjs` około 347 s. Na Windows cały shard trwał około 1400 s, z czego `verify-modeling.cjs` około 510 s, a `verify-sketch-3d.cjs` około 467 s. Rozdział skrócił ścieżkę krytyczną bez usuwania żadnego scenariusza.

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
