# MES bryły 3D — etap P1.36r

Data: 2026-09-09  
Status: zweryfikowany solver liniowy, nie certyfikacja konstrukcji

## Zakres

Polecenie `Analiza → MES bryły 3D` pracuje na rzeczywistej zamkniętej siatce powierzchniowej bryły B-Rep albo poprawnego modelu siatkowego. Regularna siatka komórek jest przycinana testem wnętrza modelu, a każda zachowana komórka dzielona na sześć zgodnych czworościanów liniowych. Pełne płaszczyzny adaptacyjne zagęszczają siatkę przy krzywiźnie, otworach i karbach bez tworzenia wiszących węzłów.

Każdy węzeł ma trzy translacyjne stopnie swobody. Element składa pełną macierz sprężystości izotropowej z modułu Younga i współczynnika Poissona. Użytkownik wybiera materiał, płaszczyznę graniczną utwierdzenia, kierunek i stronę siły, jej całkowitą wartość oraz gęstość siatki. Może też zaznaczyć dwie planarne ściany B-Rep przed uruchomieniem polecenia: pierwsza staje się utwierdzeniem, druga powierzchnią obciążenia. Siła jest rozkładana według pól trójkątów granicznych, a nie jednakowo na narożniki. Solver PCG z preconditionerem diagonalnym zwraca przemieszczenia, reakcję podpory i naprężenie von Mises.

Każdy wynik jest automatycznie porównywany z drugą, sąsiednią gęstością siatki. Panel pokazuje osobno procentową zmianę maksymalnego przemieszczenia i naprężenia oraz zaleca zagęszczenie, gdy większa zmiana przekracza 10%.

## Uczciwe granice

Panel jest oznaczony `LINIOWY`. Wynik jawnie pokazuje błąd objętości siatki, błąd równowagi sił, liczbę iteracji, zmianę między siatkami, adaptację cech i trzy ograniczenia modelu. Bezpośrednie warunki brzegowe obsługują obecnie planarne ściany; etap nie obejmuje kontaktu, plastyczności, wyboczenia ani dużych przemieszczeń. Nie wolno go przedstawiać jako certyfikacji konstrukcji.

## Weryfikacja

- `src/cad-core/solid-fea.test.js`: zamknięty prostopadłościan, zgodna siatka, dodatnie przemieszczenie i von Mises, zerowe przemieszczenie podpory, objętość, równowaga sił, wybrane ściany oraz porównanie osiowego rozciągania z rozwiązaniem analitycznym.
- `src/modeling/SolidFeaPanel.test.jsx`: wynik, jakość siatki, błędy solvera i edycja gęstości.
- `npm run verify:solid-fea`: rzeczywiste okno Electron i bryła OpenCascade, bezpośredni wybór dwóch przeciwległych ścian, zmiana materiału na Aluminium 6061-T6, siła 750 N, 144 węzły, 408 elementów, błąd objętości 0,615%, błąd równowagi poniżej 0,000001%, porównanie z siatką 105-węzłową, widoczna zdeformowana siatka i brak przepełnienia panelu.
- Dowód wizualny: `artifacts/madcad-solid-fea.png`.

## Następny etap

P1.36t: niezależne benchmarki 3D, lokalna adaptacja siatki przy krzywiźnie i karbach oraz twarde kryteria wyjścia z wersji beta.
