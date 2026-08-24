# Audyt technologii asystujących

Ostatnia weryfikacja: 2026-08-24, macOS arm64.

## Zakres automatyczny

Polecenie `npm run verify:assistive-tech` odczytuje pełne drzewo dostępności Chromium używane przez technologie asystujące, sprawdza nazwy interaktywnych kontrolek, role pasków narzędzi i kart oraz przechodzi klawiszem Tab przez pierwsze kontrolki aplikacji. Otwiera też modal wyboru płaszczyzny, sprawdza jego nazwę, fokus na podstawowej płaszczyźnie XY, zapętlenie fokusu i powrót na przycisk „Utwórz szkic” po zamknięciu. Test kończy się błędem, gdy kontrolka nie ma nazwy, wymagany element nie trafia do drzewa albo fokus przechodzi na element niewidoczny.

Pełna regresja `npm run verify:modeling` dodatkowo uruchamia axe (WCAG 2 A/AA/2.1 AA), sprawdza kontrast, fokus klawiatury oraz układ przy powiększeniu 100%, 150% i 200%.

Kontrola macOS Accessibility API ujawniła, że modal wyboru płaszczyzny pozostawiał fokus na przycisku pod oknem. Wspólny mechanizm dialogów nadaje teraz rolę i nazwę, przenosi fokus do otwartego okna, zatrzymuje Tab wewnątrz oraz przywraca fokus po zamknięciu. Obejmuje wybór płaszczyzny, parametry, import modelu i szkicu, raport naprawy, wymiar szkicu, samouczek, licencję oraz aktualizacje.

## Kontrola ręczna przed wydaniem

Na podpisanym kandydacie wydania należy jeszcze przejść podstawowy przepływ w VoiceOver: uruchomienie aplikacji, zamknięcie informacji licencyjnej, utworzenie szkicu, wybór płaszczyzny, uruchomienie linii, wpisanie długości, zakończenie szkicu i zapis projektu. Automatyczny test drzewa AX ogranicza ryzyko regresji, ale nie zastępuje odsłuchu kolejności i jakości komunikatów w systemowym czytniku ekranu.
