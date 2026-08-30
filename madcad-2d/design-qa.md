# MadCAD — audyt interfejsu

Aktualizacja: 2026-08-30
Zakres: główny przepływ desktopowy, okno licencji, szkic, modelowanie 3D,
utracone referencje, wąskie okno, klawiatura, skala 100–200% i PL/EN.

## Materiał porównawczy

Automatyczny test zapisuje aktualne zrzuty w ignorowanym katalogu `artifacts/`:

1. `madcad-qa-license.png` — komunikat startowy o licencji i darowiźnie.
2. `madcad-qa-empty.png` — pusty dokument i główne wezwanie do szkicu.
3. `madcad-qa-tooltip.png` — opis narzędzia wraz ze skrótem klawiaturowym.
4. `madcad-qa-sketch.png` — szkic XY, osie, paleta i narzędzia kontekstowe.
5. `madcad-direct-extrude.png` — bezpośredni uchwyt oraz dokładny wymiar.
6. `modeling-checkpoint.png` — gotowa część i panel naprawy referencji.
7. `madcad-qa-narrow.png` — stan 1100 × 760.

Zrzuty są generowane przez `npm run verify:modeling` z rzeczywistego okna
Electron. Nie są atrapami ani statycznymi makietami.

## Porównanie wstążki szkicu — 2026-08-30

- Źródło: `/var/folders/sf/jgwqqr_j0xzdg337ynw3fdkh0000gn/T/TemporaryItems/NSIRD_screencaptureui_h1Jh6A/Zrzut ekranu 2026-08-30 o 14.45.05.png`.
- Odrzucona implementacja: `artifacts/interface-recheck-2026-08-30/01-overloaded-sketch-ribbon.jpg`.
- Implementacja: `artifacts/full-interface-audit-2026-08-30/08-sketch-ribbon-expanded.png`.
- Wspólny kadr porównawczy: `artifacts/interface-recheck-2026-08-30/03-before-after-comparison.png`.
- Stan i viewport: pusty szkic XY, rzeczywiście zainstalowana aplikacja, okno 1351 × 768 px po obu stronach porównania.

W źródle podstawowe polecenia były schowane w menu mimo dużej pustej przestrzeni,
a grupa `3 · ZAKOŃCZ` była sztucznie odsunięta do prawej krawędzi. Pierwsza
implementacja przesadziła w drugą stronę: wystawiła także polecenia kontekstowe
i organizacyjne, przez co wstążka stała się ścianą ikon. W poprawionej wersji
na szerokiej wstążce bezpośrednio pojawia się tylko podstawowy `Łuk`.
`Odsuń` i `Przesuń` pozostają w `Modyfikuj`, a `Warstwy` i `Bloki` w
`Więcej narzędzi`. `Zakończ szkic` nadal znajduje się zaraz po narzędziach.

Kontrola powierzchni wizualnych:

- typografia i paleta pozostały zgodne z istniejącym systemem;
- odstępy wykorzystują szerokość, ale pozostawiają oddech pomiędzy narzędziami zamiast zapełniać każdy piksel;
- ikony zmniejszono o około 2 px, zachowując ich bibliotekę, kolory grup i czytelność;
- teksty poleceń nie są ucinane, grupy nie nachodzą na siebie, brak poziomego przepełnienia;
- pełny widok i skupiony kadr wstążki porównano razem, przy tym samym stanie i szerokości.

Historia ustaleń:

- P1: pierwsza poprawka wystawiła zbyt wiele poleceń i zniszczyła hierarchię — usunięto cztery kontekstowe przyciski z głównego szeregu;
- P1: podstawowy `Łuk` schowany mimo wolnego miejsca — pokazany bezpośrednio od 1260 px;
- P1: odłączona grupa zakończenia szkicu — naprawione przez usunięcie wymuszonego wyrównania do końca;
- P2: ikony zbyt duże względem dwurzędowego układu — zmniejszone do 21 px, a ikony wyróżnione do 32 × 29 px;
- kontrola po poprawce: brak otwartych problemów P0, P1 i P2 w tym stanie.

## Przejście po interfejsie

| Krok | Stan | Ocena | Ustalenia |
|---:|---|---:|---|
| 1 | Start i licencja | dobry | Komunikat nie blokuje aplikacji, jasno oddziela użytek prywatny, 40-dniową ocenę firmy, licencję płatną i darowiznę. Nie ma klucza ani aktywacji. |
| 2 | Pusty dokument | dobry | Hierarchia jest czytelna, centralne „Utwórz szkic” prowadzi do podstawowego zadania, a domyślnie zwinięta przeglądarka i timeline nie dominują płótna. |
| 3 | Tooltip i skrót | dobry | Narzędzia pokazują opis po najechaniu i fokusie. Tylko podstawowe narzędzia pokazują skrót w podpowiedzi; przyciski pozostają czyste. |
| 4 | Szkic | dobry z ryzykiem gęstości | Osie, profil, paleta i stan aktywnego narzędzia są czytelne. Linia działa jako klik początku → kierunek → długość → `Enter`. Duża liczba narzędzi i drobna typografia wymagają dalszego testu na słabszym wzroku. |
| 5 | Direct Extrude | dobry | Manipulator, podgląd bryły, jednostka i pole dokładnej wartości tworzą jeden spójny przepływ. |
| 6 | Utracone referencje | poprawiony | Panel pokazuje wszystkie problemy, ma własne przewijanie, przyklejony nagłówek i możliwość zwinięcia, więc nie zasłania trwale modelu. |
| 7 | Wąskie okno | dobry | Brak przepełnienia całego dokumentu. Wstążka ma jawne przewijanie poziome, fokus klawiatury i stabilny obszar suwaka. |

## Dostępność i responsywność

- `axe-core`: 0 automatycznie potwierdzonych naruszeń. Po naprawie ról ARIA
  jedyne pozycje `incomplete` dotyczą kontrastu, którego automat nie potrafił
  jednoznacznie ocenić przez nakładanie elementów, obrazy i krótkie etykiety;
  wymagają oceny ręcznej i nie są pełną certyfikacją WCAG.
- Każdy przycisk w testowanych stanach ma dostępną nazwę.
- Najważniejsze akcje, dialogi, tooltipy, podstawowe skróty, anulowanie i zakończenie
  szkicu są osiągalne z klawiatury.
- Przy skali 100%, 150% i 200% test nie wykrywa przepełnienia dokumentu.
- Test czytnikiem ekranu, sterowania głosowego i alternatywnych schematów
  wysokiego kontrastu pozostaje ręcznym zadaniem przed deklaracją zgodności.

## Świadome różnice względem AutoCAD/Fusion

- Zachowano skróty Autodesk Fusion i dynamiczne wprowadzanie wymiaru, ale nie
  kopiowano znaków, ikon ani brandingu Autodesk.
- Fusion jest punktem odniesienia dla modelowania parametrycznego i układu 3D;
  szkicowanie pozostaje bezpośrednie i klawiaturowe jak w klasycznym CAD.
- DWG jest importowany lokalnie przez GNU LibreDWG albo ODA do sprawdzonego
  przepływu DXF. Obsługiwany przepływ 2D obejmuje DWG/SVG/DXF, a 3D STEP/STL/3MF.

## Wynik

**passed** — porównanie przeciążonej i poprawionej implementacji przy identycznym
oknie potwierdza przywróconą hierarchię, mniejsze ikony, poprawną kolejność grup
i brak przepełnienia.
