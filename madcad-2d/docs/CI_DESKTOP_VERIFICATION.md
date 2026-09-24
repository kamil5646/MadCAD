# Pełna bramka desktopowa

Źródłem listy scenariuszy jest `scripts/desktop-verification-manifest.cjs`. Każdy plik `scripts/verify-*.cjs` przeznaczony do aplikacji musi wystąpić w nim dokładnie raz; `npm run verify:product-completeness` sprawdza pokrycie listy, zgodność macierzy CI i brak pominiętych testów. Wydanie nadal uruchamia `npm run verify:desktop-suite -- all`, czyli wszystkie scenariusze kolejno.

W CI testy modelowania są rozdzielone na `modeling` (`verify-modeling.cjs`), `modeling-3d` (`verify-sketch-3d.cjs`) i `modeling-features` (pozostałe 13), uruchamiane równolegle na macOS i Windows. W przebiegu `35905193839` na macOS poprzedni wspólny shard 15 scenariuszy trwał około 602 s, z czego `verify-modeling.cjs` około 347 s. Na Windows cały shard trwał około 1400 s, z czego `verify-modeling.cjs` około 510 s, a `verify-sketch-3d.cjs` około 467 s. Rozdział skrócił ścieżkę krytyczną bez usuwania żadnego scenariusza.

CI `35908613650` dla commitu `63d4a5e` potwierdził wszystkie trzy części modelowania na obu systemach i pięć instalatorów: 23/23 zadań zakończyło się powodzeniem. Główny shard Windows zakończył się po 9 min 36 s od startu zadania, zamiast 23 min 20 s poprzedniego wspólnego shardu (około 2,4× szybciej do końca modelowania). CodeQL `35908613712` również przeszedł.

CI `35910260871` dla commitu `126feba` po zmianie kontroli szybkich przejazdów CAM także przeszedł 23/23 zadań, w tym oba systemy i wszystkie instalatory; CodeQL `35910260767` przeszedł.

Przy ocenie budżetu dużych projektów porównuj etap i powtórzenie, nie sam czerwony wynik: Windows `modeling-features` w CI `35912028110` przekroczył 45 s przy odtworzeniu korpusu 220 szkiców (47,05 s; siatkowanie 33,14 s), lecz ten sam scenariusz w `35910260871` trwał 22,77 s, a w `35955122785` 17,25 s (siatkowanie 11,82 s). Nie podnoś progu na podstawie pojedynczego skoku obciążenia runnera; najpierw porównaj `initial`/`recovered`, `historyMs`, `meshMs` i ponowny niezależny przebieg. W `35955122785` sam shard `modeling-features` Windows był zielony, lecz shard `project` Windows przerwał kreator naprawy referencji. Jego skrypt musi czekać na ID ostatniej operacji **nowego** fixture także w wyniku silnika; samo `status === ready` mogło nadal oznaczać poprzedni model. Błąd `executeJavaScript` ma teraz wskazywać etap, aby kolejny przebieg pozwalał odróżnić wyścig interfejsu od awarii renderera.

Szybka kontrola lokalna po zmianie manifestu:

```sh
npm run verify:product-completeness
node scripts/run-desktop-verification-suite.cjs modeling-features --list
CI=1 node scripts/run-desktop-verification-suite.cjs modeling-features
CI=1 node scripts/run-desktop-verification-suite.cjs modeling-3d
```

Wynik z `--list` musi zawierać 13 unikalnych scenariuszy, a raport kompletności nadal 55 testów desktopowych. Lokalnie po rozdziale przeszły `modeling-features` 13/13 i `modeling-3d` 1/1; główny `modeling` 1/1 przeszedł wcześniej w pełnej serii. Aby ocenić regresję CI, sprawdź oba systemy i wszystkie trzy części modelowania; zielona część nie zastępuje pozostałych. Następnie sprawdź instalatory uruchamiane dopiero po całej macierzy desktopowej.
