# MadCAD — aktywny plan projektowania 2D/3D

Aktualizacja: 2026-10-02
Wersja opublikowana: `6.5.28`

Zakres uzgodniony z użytkownikiem: prosty program CAD do szkicowania 2D,
modelowania 3D i dokumentacji technicznej. Frezowanie, CAM, G-code,
przygotowanie druku 3D, profile drukarek i integracje slicerów zostały wycofane
z produktu. Dalszych funkcji wytwarzania nie rozwijamy.

## Aktywne zadanie

- [>] Usunąć narzędzia produkcyjne i potwierdzić podstawowy przepływ CAD:
  nowy projekt → szkic → wymiary i więzy → bryła → edycja historii →
  Cofnij/Ponów → zapis `.madcad` → ponowne otwarcie.
- [ ] Potwierdzić migrację v26 → v27: zachować szkice, bryły, parametry i historię;
  dawne ustawienia produkcyjne przechować jako nieaktywne `legacyProduction`.
- [ ] Potwierdzić brak CAM/druku 3D w menu, panelach i interfejsie desktopowym.
- [ ] Przejść szkic na ścianie i zależne wycięcie, zmianę wymiarów oraz
  naprawę utraconej referencji.
- [ ] Potwierdzić czytelność podstawowych poleceń i wymiarów na typowym
  oraz małym oknie, również przy skali 150%.
- [ ] Zweryfikować wersję instalowaną na Windows i macOS przed wydaniem.

## Co jest podstawą produktu

1. Szkic 2D: linie, prostokąty, okręgi, łuki, snap, dokładne wymiary i więzy.
2. Model 3D: wyciągnięcie, obrót, wycięcie, otwory, fazy, zaokrąglenia,
   przenoszenie i podstawowe operacje na bryłach.
3. Historia: edycja szkicu i operacji, poprawna przebudowa, Cofnij/Ponów.
4. Projekt: nowy/otwórz/zapisz, odzyskiwanie i czytelne błędy.
5. Dokumentacja 2D: widoki, wymiary, arkusze, PDF/DXF.
6. Wymiana geometrii: STEP i siatki STL/3MF; te formaty nie uruchamiają
   przygotowania druku ani programowania obrabiarki.

## Dowody i ograniczenia

`verify:extrude-after-sketch` sprawdza wymiary przez interfejs, wyciągnięcie,
edycję szkicu/operacji, przebudowę, Cofnij/Ponów i zapis/otwarcie przez
produkcyjne handlery plików. Przypadki szkiców na płaskich ścianach końcowych,
bocznych i obróconych były sprawdzane osobno. Ogólne zmiany topologii nadal
wymagają walidacji; sam poprawny prosty przykład nie zamyka tej kwestii.

Test uruchomienia paczki potwierdza start aplikacji, nie pełną pracę po
zalogowaniu na każdym systemie. Nie przedstawiaj niepotwierdzonej weryfikacji
instalatora jako ukończonej.

## Zasady pracy

Jedno aktywne zadanie. Najpierw podstawy i błędy codziennej pracy, następnie
pozycje z [BACKLOG.md](./BACKLOG.md). Każda zmiana schematu ma migrację,
fixture i round-trip. Operacja kernela po błędzie zachowuje ostatni poprawny
model. Wydanie wymaga zielonego CI, paczek, SHA-256 i aktualnej strony.
