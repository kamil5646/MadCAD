# MadCAD — audyt interfejsu

Aktualizacja: 2026-08-13
Zakres: główny przepływ desktopowy, okno licencji, szkic, modelowanie 3D,
utracone referencje, wąskie okno, klawiatura, skala 100–200% i PL/EN.

## Materiał porównawczy

Automatyczny test zapisuje aktualne zrzuty w ignorowanym katalogu `artifacts/`:

1. `madcad-qa-license.png` — komunikat startowy o licencji i darowiźnie.
2. `madcad-qa-empty.png` — pusty dokument i główne wezwanie do szkicu.
3. `madcad-qa-tooltip.png` — opis narzędzia wraz z aliasem klawiaturowym.
4. `madcad-qa-sketch.png` — szkic XY, osie, paleta i narzędzia kontekstowe.
5. `madcad-direct-extrude.png` — bezpośredni uchwyt oraz dokładny wymiar.
6. `modeling-checkpoint.png` — gotowa część i panel naprawy referencji.
7. `madcad-qa-narrow.png` — stan 1100 × 760.

Zrzuty są generowane przez `npm run verify:modeling` z rzeczywistego okna
Electron. Nie są atrapami ani statycznymi makietami.

## Przejście po interfejsie

| Krok | Stan | Ocena | Ustalenia |
|---:|---|---:|---|
| 1 | Start i licencja | dobry | Komunikat nie blokuje aplikacji, jasno oddziela użytek prywatny, 40-dniową ocenę firmy, licencję płatną i darowiznę. Nie ma klucza ani aktywacji. |
| 2 | Pusty dokument | dobry | Hierarchia jest czytelna, centralne „Utwórz szkic” prowadzi do podstawowego zadania, a drzewo i timeline nie dominują płótna. |
| 3 | Tooltip i alias | dobry | Narzędzia pokazują opis, alias oraz sposób użycia po najechaniu i fokusie. Aktywne przyciski mają rzeczywiste handlery. |
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
- Najważniejsze akcje, dialogi, tooltipy, aliasy, anulowanie i zakończenie
  szkicu są osiągalne z klawiatury.
- Przy skali 100%, 150% i 200% test nie wykrywa przepełnienia dokumentu.
- Test czytnikiem ekranu, sterowania głosowego i alternatywnych schematów
  wysokiego kontrastu pozostaje ręcznym zadaniem przed deklaracją zgodności.

## Świadome różnice względem AutoCAD/Fusion

- Zachowano klasyczne aliasy i dynamiczne wprowadzanie wymiaru, ale nie
  kopiowano znaków, ikon ani brandingu Autodesk.
- Fusion jest punktem odniesienia dla modelowania parametrycznego i układu 3D;
  szkicowanie pozostaje bezpośrednie i klawiaturowe jak w klasycznym CAD.
- Nie jest obiecywana obsługa DWG. Obsługiwany przepływ 2D obejmuje SVG/DXF,
  a 3D STEP/STL/3MF.

## Wynik

Główny przepływ nie ma znanego błędu wizualnego P0. Otwarte ryzyka to ręczna
ocena kontrastu, test technologii asystujących oraz dalsze ograniczanie
gęstości wstążki bez ukrywania funkcji CAD.
