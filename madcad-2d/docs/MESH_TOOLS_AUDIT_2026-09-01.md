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

## Redukcja, wygładzanie, remesh i grupy ścian

Ten sam panel zawiera teraz cztery odwracalne operacje:

- redukcję przez deterministyczne grupowanie przestrzenne wierzchołków, sterowaną procentem pozostawionej siatki,
- iteracyjne wygładzanie Laplace'a z jawną siłą oraz ochroną wierzchołków otwartych i niemanifold brzegów,
- jednorodny remesh sterowany docelową długością krawędzi; zbyt krótkie krawędzie wewnętrzne są scalane, długie dzielone wspólnymi punktami, a otwarte brzegi pozostają chronione,
- grupowanie połączonych trójkątów według kąta między normalnymi; wynik i próg kąta są zapisywane w projekcie.

Każda zmiana geometrii zapisuje oddzielny wpis operacji, aktualizuje dane STL używane przez silnik i daje się wycofać standardowym `Cofnij`. Redukcja ani wygładzanie nie domykają otworów i nie udają rekonstrukcji skanu.

Test `verify:mesh-operations` importuje rzeczywisty binarny STL o 128 trójkątach, redukuje go do 72, wygładza, przebudowuje do 252 trójkątów i grupuje. Sprawdza wynik silnika, kolejność operacji, zapis grup, Cofnij/Ponów oraz pełne zmieszczenie panelu w faktycznym obszarze modelu bez przewijania i poziomego przepełnienia.

## Kontrolowana konwersja Mesh/B-Rep

Zamknięta i spójnie zorientowana siatka bez degeneracji, duplikatów oraz krawędzi niemanifold może zostać zamieniona na fasetową bryłę B-Rep. Każdy trójkąt tworzy dokładną planarną ścianę OpenCascade, ściany są zszywane, a zamknięty płaszcz staje się bryłą. To nie jest tylko zmiana etykiety reprezentacji: wynik udostępnia topologię ścian i krawędzi oraz dokładną objętość w silniku CAD.

Konwersja jest celowo zablokowana dla siatek otwartych, niespójnych albo większych niż 2500 trójkątów, aby nie zamrażać interfejsu tysiącami faset B-Rep. Panel pokazuje stan `Niedostępne`, a pełny powód jest dostępny w podpowiedzi. Fasetową bryłę można jawnie przywrócić do siatki poleceniem `Przywróć siatkę`; oba kierunki zapisują się w historii i współpracują z Cofnij/Ponów.

Test `verify:mesh-to-brep` importuje zamknięty sześcian STL z 12 trójkątów, uruchamia konwersję, czeka na rzeczywisty wynik B-Rep i potwierdza 12 ścian, 18 krawędzi oraz objętość 1000 mm³. Następnie sprawdza konwersję powrotną, Cofnij i Ponów.

## Naprawa skanów

Panel dzieli funkcje na dwie czytelne grupy `Naprawa` i `Obróbka`. `Kierunek ścian` przechodzi po spójnych komponentach, odwraca sąsiednie trójkąty mające jednakowy kierunek wspólnej krawędzi, a zamknięte komponenty ustawia normalnymi na zewnątrz według znaku objętości. Konflikt topologiczny zatrzymuje operację zamiast zgadywać wynik.

`Małe otwory` działa wyłącznie na prostych, zamkniętych pętlach brzegowych siatki manifold. Użytkownik podaje maksymalną średnicę, a pojedynczy otwór ma dodatkowy limit 64 krawędzi. Większe lub niejednoznaczne braki są pomijane i raportowane; każdy zaakceptowany otwór otrzymuje wspólny punkt oraz wachlarz spójnie skierowanych trójkątów. Operacja zapisuje liczbę wypełnionych i pominiętych otworów, nowe trójkąty oraz korektę orientacji i jest w pełni odwracalna.

Test `verify:mesh-scan-repair` importuje sześcian z odwróconą ścianą i otwartą górą. Interfejs wykrywa cztery otwarte krawędzie i niespójną orientację, porządkuje ściany, wypełnia jeden otwór czterema trójkątami, uzyskuje zamkniętą siatkę 14 trójkątów, a następnie tworzy B-Rep o objętości 1000 mm³. Test obejmuje Cofnij/Ponów, pełne zmieszczenie panelu w polu roboczym i brak przepełnienia.

## Instalacja lokalna

Build arm64 z pełnym remeshem, konwersją Mesh/B-Rep i kontrolowaną naprawą skanów zastąpił `/Applications/MadCAD.app`, otrzymał lokalny podpis ad-hoc i przeszedł `codesign --verify --deep --strict`. Źródłowy i zainstalowany `app.asar` mają SHA-256 `abe0cb70ffa7674b423f7785e5a4e7cd869c3522283403f9a72762545e299cf3`. Poprzednią aplikację zachowano odwracalnie w Koszu jako `MadCAD-before-scan-repair-20260901.app`; GitHub nie został zmieniony.
