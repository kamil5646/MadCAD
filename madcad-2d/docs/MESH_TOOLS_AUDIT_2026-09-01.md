# MadCAD — narzędzia siatki

## Ukończony zakres

Zaznaczona siatka STL albo 3MF udostępnia w kontekście bryły i w menu `Więcej zmian` panel `Narzędzia siatki`. Panel raportuje liczbę wierzchołków i trójkątów, zduplikowane współrzędne, trójkąty zerowe i powtórzone, otwarte oraz niemanifold krawędzie i niespójną orientację.

`Wykonaj bezpieczną naprawę` wykonuje tylko operacje o jednoznacznym wyniku:

- scala wierzchołki w tolerancji 0,00001 mm,
- usuwa trójkąty z powtórzonym wierzchołkiem albo śladowym polem,
- usuwa dokładnie zdublowane trójkąty,
- usuwa nieużywane wierzchołki i zapisuje wynik ponownie jako binarny STL.

Naprawa nie zamyka otworów, nie tworzy nowych powierzchni i nie zgaduje brakującej części skanu. Zapis odbywa się jako transakcja dokumentu, dlatego `Cofnij` przywraca oryginalne dane importu.

## Weryfikacja

- `src/cad-core/mesh-tools.test.js` sprawdza diagnostykę, czyszczenie i round-trip binarnego STL.
- `scripts/verify-mesh-repair.cjs` importuje siatkę z powtórzonym i zdegenerowanym trójkątem, otwiera panel z kontekstu bryły, wykonuje naprawę i potwierdza wynik jednego poprawnego trójkąta.
- Test desktopowy sprawdza też położenie panelu i brak poziomego przepełnienia; dowód wizualny zapisuje w `artifacts/madcad-mesh-repair.png`.

## Dalszy zakres

Grupy powierzchni, kontrolowana redukcja, remesh, wygładzanie oraz konwersja Mesh/B-Rep pozostają kolejnymi pozycjami tej samej paczki backlogu.

## Instalacja lokalna

Build arm64 zastąpił `/Applications/MadCAD.app`, otrzymał lokalny podpis ad-hoc i przeszedł `codesign --verify --deep --strict`. Źródłowy i zainstalowany `app.asar` mają SHA-256 `228ac94cf701c9210e6afccdb580ca7078fe37ad5223e8d648fe8b103fbdf3d1`. Poprzednią aplikację zachowano odwracalnie w Koszu jako `MadCAD-before-mesh-repair-20260901.app`; GitHub nie został zmieniony.
