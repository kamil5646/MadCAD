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

## Redukcja, wygładzanie i grupy ścian

Ten sam panel zawiera teraz trzy odwracalne operacje:

- redukcję przez deterministyczne grupowanie przestrzenne wierzchołków, sterowaną procentem pozostawionej siatki,
- iteracyjne wygładzanie Laplace'a z jawną siłą oraz ochroną wierzchołków otwartych i niemanifold brzegów,
- grupowanie połączonych trójkątów według kąta między normalnymi; wynik i próg kąta są zapisywane w projekcie.

Każda zmiana geometrii zapisuje oddzielny wpis operacji, aktualizuje dane STL używane przez silnik i daje się wycofać standardowym `Cofnij`. Redukcja ani wygładzanie nie domykają otworów i nie udają rekonstrukcji skanu.

Test `verify:mesh-operations` importuje rzeczywisty binarny STL o 128 trójkątach, redukuje go, wygładza i grupuje. Sprawdza wynik silnika, zapis operacji, zapis grup, pełne zmieszczenie panelu w oknie i brak poziomego przepełnienia. Jednorodny remesh oraz kontrolowana konwersja Mesh/B-Rep pozostają kolejnymi pozycjami tej samej paczki backlogu.

## Instalacja lokalna

Build arm64 z redukcją, wygładzaniem i grupami ścian zastąpił `/Applications/MadCAD.app`, otrzymał lokalny podpis ad-hoc i przeszedł `codesign --verify --deep --strict`. Źródłowy i zainstalowany `app.asar` mają SHA-256 `1e49d404af03b153d9c3009fd68680e07e75bf6ea216dca1a3e01da401b58417`. Poprzednią aplikację zachowano odwracalnie w Koszu jako `MadCAD-before-mesh-operations-20260901.app`; GitHub nie został zmieniony.
