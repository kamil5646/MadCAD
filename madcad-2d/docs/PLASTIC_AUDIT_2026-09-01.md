# MadCAD — moduł Plastic

## Ukończony moduł: analiza geometrii, Boss, Snap-fit i Grille

Wspólny panel `Analiza geometrii` ma dwa jawne tryby. `Pochylenie` klasyfikuje ściany względem kierunku wyciągania formy jako dodatnie, zerowe, ujemne albo mieszane. `Grubość` szuka najbliższej przeciwległej powierzchni dla każdej ściany B-Rep:

- dla płaszczyzn porównuje przeciwne normalne i odległość między płaszczyznami;
- dla walców porównuje współosiowe powierzchnie i różnicę promieni;
- wynik odnosi do docelowej grubości i tolerancji użytkownika;
- mapa rozróżnia obszary za cienkie, zgodne, za grube i ściany bez wiarygodnej pary.

Analiza jest nieinwazyjna: nie dopisuje operacji do historii i nie zmienia geometrii. Ściany bez odpowiedniej pary są jawnie oznaczone zamiast otrzymywać zgadywaną wartość.

`Boss` jest operacją parametryczną osadzaną na jednej planarnej ścianie istniejącej bryły B-Rep. Użytkownik określa średnicę zewnętrzną, średnicę i głębokość otworu, wysokość, położenie lokalne X/Y oraz kierunek. Narzędzie:

- przechowuje trwałą referencję wybranej ściany i bierze jej środek oraz normalną jako układ lokalny;
- łączy słupek z tą samą bryłą zamiast tworzyć luźny korpus;
- wycina współosiowy otwór przez słupek i na zadaną głębokość w podporę;
- działa w podglądzie dokładnego B-Rep, historii parametrów oraz w Cofnij/Ponów.

`Snap-fit` tworzy na trwałej referencji ściany wspornik zatrzaskowy, a nie tylko dekoracyjny występ. Ma osobną stopę scaloną z korpusem, prześwit pozostawiający uginaną część ramienia oraz pogrubiony hak na wolnym końcu. Długość, szerokość, grubość, prześwit, wymiary zaczepu i pozycja X/Y pozostają parametryczne.

`Grille` wycina w planarnej ścianie równoległe szczeliny wentylacyjne, pozostawiając kontrolowane żebra w tej samej bryle. Parametry obejmują liczbę i szerokość żeber, prześwit, długość i głębokość szczelin, pozycję lokalną X/Y oraz kierunek cięcia. Operacja używa trwałej referencji ściany, dokładnego B-Rep oraz zachowuje się tak samo w historii jak Boss i Snap-fit.

## Walidacja

- testy rdzenia obejmują parę płaszczyzn o grubości `2 mm`, współosiowe walce o grubości `1,6 mm`, klasyfikację względem tolerancji oraz brak deskryptora w siatce importowanej;
- test desktopowy `verify:draft-analysis` otwiera rzeczywisty panel, sprawdza mapę pochylenia, przełącza się na `Grubość`, potwierdza cztery klasy legendy i brak poziomego przepełnienia;
- test rdzenia tworzy Boss na trwałej referencji, sprawdza parametry i graf zależności oraz odrzuca otwór nie mniejszy od średnicy zewnętrznej;
- test desktopowy `verify:plastic-boss` wybiera ścianę rzeczywistej bryły, uruchamia narzędzie z menu `Plastic`, zmienia sześć wymiarów, sprawdza dokładną operację fuse/cut oraz Cofnij/Ponów;
- test desktopowy `verify:plastic-snap-fit` uruchamia zatrzask na niezależnej bryle, zmienia siedem wymiarów, sprawdza wzrost objętości i obwiedni, jedną bryłę wynikową oraz Cofnij/Ponów;
- test desktopowy `verify:plastic-grille` wycina trzy szczeliny pozostawiające cztery żebra, potwierdza spadek objętości, trwałą referencję, podgląd, Cofnij/Ponów oraz ponowne otwarcie dokumentu;
- dowód wizualny jest zapisywany w `artifacts/madcad-draft-analysis.png`.
- dowód wizualny Bossa jest zapisywany w `artifacts/madcad-plastic-boss.png`.
- dowód wizualny zatrzasku jest zapisywany w `artifacts/madcad-plastic-snap-fit.png`.
- dowód wizualny grilla jest zapisywany w `artifacts/madcad-plastic-grille.png`.

## Dalsza kolejność

Pakiet Plastic z bieżącej listy jest ukończony. Kolejny niezależny moduł backlogu to Form: SubD/T-Spline z kontrolowaną konwersją do B-Rep.
