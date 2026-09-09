# Niezależne benchmarki MES bryły 3D — 2026-09-09

## Zakres

Solver jest sprawdzany poza scenariuszem interfejsu przez osobną bramkę `npm run verify:solid-fea-benchmarks`. Zestaw nie porównuje solvera z nim samym: oczekiwane wartości rozciągania pręta i zginania wspornika wynikają z klasycznych rozwiązań analitycznych. Dodatkowo sprawdzane są liniowość obciążenia, zależność od modułu Younga, niezależność naprężenia osiowego od modułu, bilans reakcji oraz dokładne wyzerowanie utwierdzonych stopni swobody.

## Wyniki referencyjne

| Przypadek | Wielkość | Analitycznie | MES | Błąd | Limit |
| --- | ---: | ---: | ---: | ---: | ---: |
| Pręt 40×10×10 mm, 1000 N | przemieszczenie | 0,00190476 mm | 0,00191220 mm | 0,39% | 2% |
| Pręt 40×10×10 mm, 1000 N | naprężenie | 10,000 MPa | 10,332 MPa | 3,32% | 5% |
| Wspornik 40×10×10 mm, 1000 N | ugięcie końca | 0,121905 mm | 0,110022 mm | 9,75% | 12% |
| Wspornik 40×10×10 mm, 1000 N | naprężenie | 240,000 MPa | 197,468 MPa | 17,72% | 20% |

Wszystkie 11 kryteriów przechodzi. Błąd zginania jest jednak wyraźnie większy od błędu osiowego, dlatego moduł pozostaje oznaczony jako beta. Liniowe czworościany są podatne na nadmierną sztywność w zginaniu przy zbyt małej liczbie elementów przez przekrój.

## Zmiany wynikające z benchmarku

- dopuszczalna gęstość wzrosła z 8 do 16 komórek na najdłuższej osi;
- smukłe bryły dostają minimalną rozdzielczość 4–6 komórek przez przekrój przy wyższych poziomach gęstości;
- każdy wynik ma bramkę jakości obejmującą błąd objętości, bilans sił, resztę solvera i zbieżność dwóch siatek;
- panel nie nazywa wyniku zweryfikowanym, dopóki wszystkie cztery kontrole konkretnego przypadku nie przejdą.

## Pozostałe kryterium wyjścia z beta

Przed zdjęciem etykiety beta należy dodać zgodne lokalne zagęszczanie siatki przy krzywiźnie, otworach i karbach, a następnie ponowić benchmark wspornika oraz osobny benchmark koncentracji naprężeń.
