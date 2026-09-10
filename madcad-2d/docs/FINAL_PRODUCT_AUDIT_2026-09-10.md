# MadCAD 6.5.0 — końcowy audyt produktu

Data: 2026-09-10
Zakres: start i konto, wybór szkicu, modelowanie 2D/3D, odzyskiwanie, arkusz 2D, wytwarzanie, bezpieczeństwo i pakiet wydania.

## Wynik

MadCAD 6.5.0 przeszedł lokalnie pełny manifest 53 scenariuszy Electron na macOS arm64, 184 testy interfejsu, 224 testy rdzenia oraz audyty repozytorium, bezpieczeństwa Electron, dostępności i zależności. Ten sam pełny manifest przeszedł następnie na macOS i Windows w GitHub Actions. Run wydania `34477547067` zakończył się powodzeniem, opublikował instalatory Windows/macOS i AppImage Linux wraz z sumami SHA-256: <https://github.com/kamil5646/MadCAD/releases/tag/v6.5.0>.

## Przebieg i stan

1. **Konto i warunki licencji — dobry.** Darmowy plan osobisty wymaga bezpłatnego konta MadCAD i okresowego potwierdzenia online. Bez aktywnej sesji użytkownik nie przejdzie do programu. Okno mieści się w obszarze ekranu, jego treść przewija się, a logowanie i odzyskanie hasła są dostępne bez szukania.
   - Zrzut: `artifacts/start-experience-audit/01-license.png`
2. **Strona startowa — dobry.** Jedna główna decyzja prowadzi do szkicu 2D, a alternatywa do istniejącego projektu. Drogi do arkusza 2D, modelu 3D i opcjonalnego druku 3D są rozdzielone.
   - Zrzuty: `artifacts/start-experience-audit/02-after-start.png`, `03-narrow-start.png`
3. **Wybór płaszczyzny i wejście do szkicu — dobry.** Płaszczyzny są widoczne w modelu i w krótkim panelu, a skróty 1–3 oraz Esc są jawne. Środek obszaru roboczego pozostaje wolny.
   - Zrzut: `artifacts/start-experience-audit/05-plane-picker.png`
4. **Modelowanie i historia — dobry funkcjonalnie, gęsty w trybie naprawy.** Operacje szkic–wyciągnięcie, bryły, powierzchnie, siatki i historia przeszły testy. Kreator naprawy referencji celowo zajmuje prawy panel; to najbardziej informacyjnie gęsty stan aplikacji, ale zachowuje widok modelu i jednoznaczne kolejne działanie.
   - Zrzut: `artifacts/modeling-checkpoint.png`
5. **Odzyskiwanie po awarii — dobry.** Przywrócony autozapis jest jasno oznaczony, można go natychmiast zapisać albo otworzyć punkty zapisu.
   - Zrzut: `artifacts/start-experience-audit/04-crash-recovery.png`
6. **Arkusz techniczny 2D — dobry.** Widoki, przekrój, detal, wymiary, tabele i właściwości arkusza są w osobnym środowisku od modelowania i druku 3D.
   - Zrzut: `artifacts/madcad-drawing-workspace.png`
7. **Wytwarzanie — dobry.** CAM ma własną zakładkę, setup, operacje, kontrolę kolizji i symulację. Nie miesza się z tworzeniem arkusza ani podstawowym projektowaniem.
   - Zrzut: `artifacts/madcad-manufacturing-setup.png`

## Dostępność i ograniczenia dowodu

- Automatyczny audyt startu nie wykazał naruszeń ani pozycji niejednoznacznych.
- Pełny audyt modelowania wykazał 23 zaliczone reguły i zero potwierdzonych naruszeń; część kontroli nakładania i kontrastu tła wymagała również ręcznej oceny zrzutów.
- Testy potwierdzają zachowanie zaprogramowanych przepływów, ale nie zastępują wielogodzinnej pracy projektanta na rzeczywistych, bardzo dużych projektach ani testu z czytnikiem ekranu przez osobę korzystającą z niego na co dzień.

## Bramka wydania

- [x] pełny desktop macOS: 53/53
- [x] UI: 184/184
- [x] rdzeń: 224/224
- [x] bezpieczeństwo Electron
- [x] `npm audit`: 0 podatności
- [x] dostępność strony startowej: 0 naruszeń
- [x] pełny desktop Windows w GitHub Actions: 53/53
- [x] pakiety i sumy SHA-256 opublikowane dla tagu `v6.5.0`
