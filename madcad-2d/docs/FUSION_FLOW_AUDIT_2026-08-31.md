# Audyt przepływu Fusion — 2026-08-31

## Zakres

Sprawdzono krytyczny przepływ użytkownika: wybór płaszczyzny → szkic → wyciągnięcie → zaznaczenie bryły, ściany i krawędzi. Punktem odniesienia jest przewidywalność Autodesk Fusion, bez kopiowania marki ani zasobów Autodesk.

## Wynik

1. **Wybór płaszczyzny — zdrowy.** XY/XZ/YZ są widoczne i klikalne bezpośrednio na modelu. Mały panel przy lewej krawędzi podaje cel i skróty `1–3`; środek płótna pozostaje wolny. `Esc` bezpiecznie anuluje wybór.
2. **Wyciągnięcie — zdrowe.** Istniejący profil nie znika i nie wraca do wyboru płaszczyzny. Odległość można zmienić manipulatorem lub wpisać z klawiatury, a `Enter` zatwierdza operację.
3. **Kontekst bryły — zdrowy.** Najczęstsze akcje to Przesuń, Obróć i Szyk. W menu dodatkowym są właściwości masy, podział i bezpieczne usuwanie przez operację źródłową w historii.
4. **Kontekst ściany — zdrowy.** Zaznaczenie ściany oferuje Szkic na ścianie, Press Pull i Offset Face bez przełączania osobnego trybu wyboru.
5. **Kontekst krawędzi — zdrowy.** Zaznaczenie krawędzi oferuje Zaokrąglij i Fazuj bez wyłączania bieżącego wyboru.
6. **Snap — zdrowy.** Marker ma własną ikonę, typ punktu, tekst `SNAP`, obwódkę i prowadnice; jest widoczny przed kliknięciem i mieści się w płótnie.
7. **Widok i widoczność — zdrowe.** ViewCube podaje aktualną orientację oraz wszystkie kierunki. Ikony oka przy szkicach i bryłach sterują realnym renderowaniem, a zwinięcie folderu nie udaje już ukrywania geometrii.

## Korekty wizualne wykonane podczas audytu

- Panel wyboru płaszczyzny przeniesiono z centrum do lewego górnego narożnika i zmniejszono.
- Płaszczyzny origin otrzymały czytelne kolory, hover i bezpośrednie kliknięcie na płótnie.
- Panel akcji kontekstowych poszerzono do 220 px; tekst ma co najmniej 10–12,5 px i nie jest ucinany.
- Przycisk usunięcia bryły nie usuwa modelu natychmiast: pokazuje zakres zależności historii i wymaga potwierdzenia.

## Dowody i automatyczna weryfikacja

- `artifacts/fusion-flow-audit-2026-08-31/01-plane-selection.png`
- `artifacts/fusion-flow-audit-2026-08-31/02-extrude-enter.png`
- `artifacts/fusion-flow-audit-2026-08-31/03-body-context.png`
- `artifacts/fusion-flow-audit-2026-08-31/04-face-context.png`
- `artifacts/fusion-flow-audit-2026-08-31/05-edge-context.png`
- `artifacts/fusion-flow-audit-2026-08-31/06-installed-plane-selection.png` — wynik uruchomiony z `/Applications/MadCAD.app`.
- `artifacts/fusion-flow-audit-2026-08-31/07-visibility-viewcube.png`
- `artifacts/fusion-flow-audit-2026-08-31/08-snap-feedback.png`
- `scripts/verify-start-experience.cjs` wykonuje rzeczywiste kliknięcie płaszczyzny XY w scenie.
- `scripts/verify-extrude-after-sketch.cjs` wpisuje `12`, zatwierdza Enterem i sprawdza objętość 11520.
- `scripts/verify-interface-consistency.cjs` sprawdza akcje bryły, ściany i krawędzi oraz anulowanie usunięcia bez zmiany modelu.
- `scripts/verify-interface-consistency.cjs` ukrywa bryłę ikoną oka, sprawdza zniknięcie z renderu, pokazuje ją ponownie i weryfikuje opis ViewCube.
- `scripts/verify-snap-feedback.cjs` sprawdza marker, typ snapa i położenie w granicach płótna.
- Zainstalowany `app.asar` ma ten sam SHA-256 co finalny świeży build: `ca9916795ee46c130f9e38954fe7463ec77dff57ffb9b4185e609280a87f2624`.

## Następny pakiet

Następny pakiet dotyczy redukcji pozostałych równorzędnych wejść do obszarów, konsekwentnego podziału Projektuj/Arkusz 2D/Zarządzaj oraz wspólnej logiki tooltipów i stanów niedostępnych.
