# Audyt podziału obszarów i pomocy narzędzi — 2026-08-31

## Wynik

Stan pakietu: **zielony**. Główny przepływ ma trzy przewidywalne obszary, import i eksport są skupione w `Plik`, druk 3D pozostaje osobnym dodatkiem, a wstążka nie wymaga ręcznego przełączania do trybu wyboru.

## Co wykazał audyt przed zmianą

1. `Import 3D` był dostępny jednocześnie w `Plik` i w grupie `WSTAW` obszaru `PROJEKTUJ`.
2. Stała grupa `WYBIERZ` dublowała automatyczny powrót do zaznaczania po zakończeniu lub anulowaniu polecenia.
3. Grupa szkicu `WSTAW I ORGANIZUJ` mieszała transformacje, szyki, warstwy, bloki i tworzenie 3D.
4. Przyciski menu nie używały tego samego rozbudowanego tooltipu co przyciski bezpośrednie.
5. Domyślna personalizacja polecenia pokazywała alias `FE` zamiast prostego, kontekstowego skrótu `F` dla zaokrąglenia 3D.
6. Kontrola lokalnie zainstalowanej aplikacji ujawniła dodatkowo pustą wstążkę strony startowej po zamknięciu komunikatu licencyjnego. Kontrolki istniały w drzewie dostępności, ale nie zawsze były odmalowane w zwykłym oknie.

## Zmiany

1. `PROJEKTUJ` ma grupy `UTWÓRZ`, `ZMIEŃ`, `KONSTRUKCJA`, `SPRAWDŹ`.
2. `Import 3D` usunięto z wstążki; STEP, STL, 3MF, SVG, DXF, DWG, PDF i druk 3D są dostępne w jednym lewym menu `Plik`.
3. Usunięto przycisk `Wybierz`; `Esc` anuluje polecenie lub czyści zaznaczenie, a aplikacja samoczynnie wraca do wyboru.
4. Szkic ma grupy `UTWÓRZ`, `ZMIEŃ`, `WIĄZANIA`, `ORGANIZUJ`, `ZAKOŃCZ SZKIC`.
5. `Transformuj` i `Szyk szkicu` przeniesiono do `Modyfikuj`; `Warstwy` i `Bloki` są w menu `Warstwy i bloki`; operacje otwartego szkicu 3D są przy tworzeniu.
6. Podstawowe skróty są kontekstowe i zgodne z założeniami: `L`, `R`, `C`, `E`, `M`, `F`, `D`. Skrót jest w tooltipie, nie na kafelku.
7. Każdy przycisk wstążki i menu buduje pomoc z jednego mechanizmu: nazwa, opis, skrót, stan i powód niedostępności.
8. Wstążka strony startowej nie jest już celowo zwijana i jest ponownie montowana po zamknięciu komunikatu licencyjnego, dzięki czemu cztery grupy `PROJEKTUJ` są faktycznie widoczne bez ręcznego powiększania okna.

## Dowody wizualne

### Przed

- `artifacts/workspace-separation-audit-2026-08-31/01-design-before.png`
- `artifacts/workspace-separation-audit-2026-08-31/02-drawing-before.png`
- `artifacts/workspace-separation-audit-2026-08-31/03-manage-before.png`
- `artifacts/workspace-separation-audit-2026-08-31/04-file-menu-before.png`

### Po

- `artifacts/workspace-separation-audit-2026-08-31/05-design-after.png`
- `artifacts/workspace-separation-audit-2026-08-31/06-drawing-after.png`
- `artifacts/workspace-separation-audit-2026-08-31/07-manage-after.png`
- `artifacts/workspace-separation-audit-2026-08-31/08-file-menu-after.png`
- `artifacts/workspace-separation-audit-2026-08-31/09-disabled-tooltip-after.png`
- `artifacts/workspace-separation-audit-2026-08-31/10-installed-file-menu.png`
- `artifacts/workspace-separation-audit-2026-08-31/11-installed-design.png`
- `artifacts/workspace-separation-audit-2026-08-31/12-start-page-visible.png`

## Weryfikacja

- Vitest: 26 plików, 115 testów — zaliczone.
- Core: 186 testów — zaliczone.
- ESLint — zaliczony bez ostrzeżeń.
- Pełny scenariusz modelowania: szkic, wybór, operacje 2D/3D, historia, import/eksport, zapis i ponowne otwarcie — zaliczony.
- Dokumentacja techniczna: rzuty, przekrój, detal, adnotacje, BOM, PDF/DXF — zaliczona.
- Nawigacja kamery i snap — zaliczone.
- Techniki asystujące — 31 kontrolek interaktywnych, brak nienazwanych elementów i brak brakujących nazw wymaganych.
- WCAG/axe w pełnym scenariuszu: 0 naruszeń; pozostały wyłącznie wyniki `incomplete` wymagające ręcznej oceny nakładających się elementów canvas.
- Kontrola wstążki potwierdziła brak `Import 3D` i `Wybierz`, działanie `D`, tooltip `F` oraz brak poziomego przepełnienia.
- Kontrola strony startowej w oknie o szerokości 1351 px potwierdziła cztery widoczne grupy, wysokość wstążki 71 px, aktywne zdarzenia wskaźnika i 897 próbek kolorów w przechwyconym obszarze, co chroni przed regresją „kontrolki są w DOM, ale nic nie widać”.
- Lokalna instalacja `/Applications/MadCAD.app` została uruchomiona i przeklikana przez interfejs systemowy: `PROJEKTUJ`, `ARKUSZ 2D`, `ZARZĄDZAJ`, menu `Plik` oraz komunikat licencyjny działają w finalnej paczce.
- Build 6.4.6 ma poprawny podpis ad-hoc; źródłowy i zainstalowany `app.asar` mają identyczną sumę SHA-256 `cb6524f20fb9d008c24c6ee66665711339aa0c6e7f825e38179836d8157d2806`.

## Stan dostępności i ograniczenia audytu

- Drzewo dostępności finalnej aplikacji zawiera nazwane zakładki, grupy, przyciski i ich przyczyny niedostępności.
- Automatyczna kontrola nie zastępuje ręcznej oceny canvas, kontrastu na konkretnym monitorze ani pełnego testu VoiceOver; nie zgłaszam na tej podstawie pełnej zgodności WCAG.
- Narzędzia powierzchniowe zostały rozszerzone w kolejnej paczce: `Patch`, `Surface Extrude`, `Surface Revolve`, `Surface Sweep` i `Thicken`; szczegóły zawiera `SURFACE_MODELING_AUDIT_2026-08-31.md`.

## Zakres domknięty późniejszą paczką

Modelowanie powierzchniowe zostało następnie wdrożone i zweryfikowane jako rzeczywiste operacje OpenCascade. Główna checklista oznacza wykonany zakres na podstawie testów `Patch → Thicken`, `Surface Extrude → Thicken`, `Surface Revolve → Thicken` oraz `Surface Sweep → Thicken`.
