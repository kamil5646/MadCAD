# Niezależne benchmarki MES bryły 3D — 2026-09-09

## Zakres

Solver jest sprawdzany poza scenariuszem interfejsu przez osobną bramkę `npm run verify:solid-fea-benchmarks`. Zestaw nie porównuje solvera z nim samym: oczekiwane wartości rozciągania pręta i zginania wspornika wynikają z klasycznych rozwiązań analitycznych. Dodatkowo sprawdzane są liniowość obciążenia, zależność od modułu Younga, niezależność naprężenia osiowego od modułu, bilans reakcji, dokładne wyzerowanie utwierdzonych stopni swobody oraz klasyczna koncentracja naprężeń przy okrągłym otworze.

## Wyniki referencyjne

| Przypadek | Wielkość | Analitycznie | MES | Błąd | Limit |
| --- | ---: | ---: | ---: | ---: | ---: |
| Pręt 40×10×10 mm, 1000 N | przemieszczenie | 0,00190476 mm | 0,00191220 mm | 0,39% | 2% |
| Pręt 40×10×10 mm, 1000 N | naprężenie | 10,000 MPa | 10,332 MPa | 3,32% | 5% |
| Wspornik 40×10×10 mm, 1000 N | ugięcie końca | 0,121905 mm | 0,110022 mm | 9,75% | 12% |
| Wspornik 40×10×10 mm, 1000 N | naprężenie | 240,000 MPa | 197,468 MPa | 17,72% | 20% |

| Płyta 60×30×6 mm, otwór Ø10, 18 kN | koncentracja naprężeń | 300,000 MPa | 239,692 MPa | 20,10% | 25% |

Wszystkie 14 kryteriów przechodzi. Błąd zginania i lokalnego maksimum jest wyraźnie większy od błędu osiowego, dlatego panel zachowuje jawne kryteria kontroli wyniku. Liniowe czworościany wymagają odpowiedniej liczby elementów przez przekrój i zagęszczenia w rejonie cech.

## Zmiany wynikające z benchmarku

- dopuszczalna gęstość wzrosła z 8 do 16 komórek na najdłuższej osi;
- smukłe bryły dostają minimalną rozdzielczość 4–6 komórek przez przekrój przy wyższych poziomach gęstości;
- każdy wynik ma bramkę jakości obejmującą błąd objętości, bilans sił, resztę solvera i zbieżność dwóch siatek;
- panel nie nazywa wyniku zweryfikowanym, dopóki wszystkie cztery kontrole konkretnego przypadku nie przejdą.
- zgodna adaptacja dodaje pełne płaszczyzny w rejonie zmiany normalnych powierzchni, więc nie tworzy wiszących węzłów;
- dla płyty z otworem 11 dodatkowych płaszczyzn zmniejszyło błąd objętości z 4,15% do 0,17% i podniosło rozpoznane maksimum z 190,03 do 239,69 MPa.

## Decyzja o zakresie

Po dodaniu zgodnej adaptacji oraz przejściu benchmarku koncentracji naprężeń etykieta `BETA` została usunięta. Nazwa i panel mówią teraz wprost `LINIOWY`, a ograniczenia nadal wykluczają kontakt, plastyczność, wyboczenie, duże przemieszczenia i certyfikację obliczeń.
