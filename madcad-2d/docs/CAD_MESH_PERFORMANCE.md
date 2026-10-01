# Siatkowanie dużych projektów — diagnoza i kontrola

## Sygnał z CI

Na roboczym PR #87 przebieg `35827561178` przekroczył budżet pierwszego
przeliczenia korpusu 220 szkiców na Windows: `45 363 ms` wobec `45 000 ms`.
W tym wyniku `37 012,6 ms` zajęło siatkowanie, a `5 024,2 ms` historia.
Ponowne przeliczenie tego samego dokumentu po kontrolowanej awarii zajęło
`27 681,2 ms` (siatkowanie `19 216,9 ms`), więc pojedynczy wynik może być
wrażliwy na obciążenie maszyny CI. Budżet pozostaje bez zmian; sam ponowny
przebieg nie zastępuje poprawy kodu.

## Usunięty nadmiar pracy

- `faceDescriptor` korzysta ze środka masy już obliczonego przy pomiarze pola
  ściany; wcześniejsze `face.center` uruchamiało drugi pomiar powierzchni
  OpenCascade dla każdej ściany.
- `meshBody` przekazuje do metryk liczbę pobranych już ścian i krawędzi,
  zamiast ponownie tworzyć ich listy dla każdej bryły.
- Uchwyty ścian i krawędzi pobrane podczas siatkowania oraz pomocniczych
  pomiarów są zwalniane także przy błędzie. Nie zmienia to siatki, geometrii
  B-Rep ani identyfikatorów referencji.

Lokalny korpus na macOS po zmianie: 220 szkiców, pierwsza przebudowa
`1 606,7 ms`, z czego siatkowanie `1 101,7 ms`; odzyskanie po awarii
`1 593,8 ms`, siatkowanie `1 096,0 ms`, `failures: []`. Przed zmianą
w tym samym środowisku pierwszy pomiar siatkowania wynosił `1 226,1 ms`.
To obserwacja z dwóch uruchomień, nie stabilny benchmark ani gwarancja
takiego samego zysku na Windows.

CI na commicie `33b9180` (`35848711534`) przeszło 19/19 zadań, a CodeQL
`35848711836` zakończył się powodzeniem. Korpus ma `failures: []` na obu
systemach: najdłuższe pierwsze przeliczenie na Windows wyniosło `7 451,1 ms`
(220 brył), na macOS `5 749,1 ms` (220 brył). Poprzedni wynik Windows
`45 363 ms` był znacznie wolniejszy od tego przebiegu, dlatego nie wolno
przypisywać całej różnicy samej poprawce bez powtarzalnego pomiaru na
porównywalnym sprzęcie.

## Jak weryfikować

Uruchomić `npm run lint`, `npm run test:core` i
`npm run verify:large-project-corpus` w `madcad-2d`. Ostatni test porównuje
geometrię i trwałe identyfikatory przed awarią i po odzyskaniu projektu.
Po wysłaniu zmiany sprawdzić oba zadania `Desktop E2E modeling` w CI oraz
artefakt `madcad-large-project-corpus.json`: wszystkie scenariusze muszą mieć
`failures: []`. Porównywać osobno `historyMs`, `meshMs`, `totalMs` i pamięć;
czasy różnych systemów oraz maszyn nie są bezpośrednio porównywalne.
