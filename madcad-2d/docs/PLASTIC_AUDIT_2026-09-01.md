# MadCAD — moduł Plastic

## Ukończony etap: analiza grubości i pochylenia

Wspólny panel `Analiza geometrii` ma dwa jawne tryby. `Pochylenie` klasyfikuje ściany względem kierunku wyciągania formy jako dodatnie, zerowe, ujemne albo mieszane. `Grubość` szuka najbliższej przeciwległej powierzchni dla każdej ściany B-Rep:

- dla płaszczyzn porównuje przeciwne normalne i odległość między płaszczyznami;
- dla walców porównuje współosiowe powierzchnie i różnicę promieni;
- wynik odnosi do docelowej grubości i tolerancji użytkownika;
- mapa rozróżnia obszary za cienkie, zgodne, za grube i ściany bez wiarygodnej pary.

Analiza jest nieinwazyjna: nie dopisuje operacji do historii i nie zmienia geometrii. Ściany bez odpowiedniej pary są jawnie oznaczone zamiast otrzymywać zgadywaną wartość.

## Walidacja

- testy rdzenia obejmują parę płaszczyzn o grubości `2 mm`, współosiowe walce o grubości `1,6 mm`, klasyfikację względem tolerancji oraz brak deskryptora w siatce importowanej;
- test desktopowy `verify:draft-analysis` otwiera rzeczywisty panel, sprawdza mapę pochylenia, przełącza się na `Grubość`, potwierdza cztery klasy legendy i brak poziomego przepełnienia;
- dowód wizualny jest zapisywany w `artifacts/madcad-draft-analysis.png`.

## Dalsza kolejność

1. Parametryczny Boss na planarnej ścianie z trwałą referencją.
2. Snap-fit budowany na istniejącej bryle.
3. Grille z kontrolą liczby żeber, szerokości i prześwitu.

Każda operacja ma korzystać z tej samej historii, podglądu oraz mechanizmu trwałych referencji co pozostałe narzędzia MadCAD.
