# Audyt technologii asystujących

Ostatnia weryfikacja: 2026-08-24, macOS arm64.

## Zakres automatyczny

Polecenie `npm run verify:assistive-tech` odczytuje pełne drzewo dostępności Chromium używane przez technologie asystujące, sprawdza nazwy interaktywnych kontrolek, role pasków narzędzi i kart oraz przechodzi klawiszem Tab przez pierwsze kontrolki aplikacji. Test kończy się błędem, gdy kontrolka nie ma nazwy, wymagany element nie trafia do drzewa albo fokus przechodzi na element niewidoczny.

Pełna regresja `npm run verify:modeling` dodatkowo uruchamia axe (WCAG 2 A/AA/2.1 AA), sprawdza kontrast, fokus klawiatury oraz układ przy powiększeniu 100%, 150% i 200%.

## Kontrola ręczna przed wydaniem

Na podpisanym kandydacie wydania należy jeszcze przejść podstawowy przepływ w VoiceOver: uruchomienie aplikacji, zamknięcie informacji licencyjnej, utworzenie szkicu, wybór płaszczyzny, uruchomienie linii, wpisanie długości, zakończenie szkicu i zapis projektu. Automatyczny test drzewa AX ogranicza ryzyko regresji, ale nie zastępuje odsłuchu kolejności i jakości komunikatów w systemowym czytniku ekranu.
