# Audyt technologii asystujących

Ostatnia weryfikacja: 2026-08-25, macOS arm64, MadCAD 6.3.2.

## Zakres automatyczny

Polecenie `npm run verify:assistive-tech` odczytuje pełne drzewo dostępności Chromium używane przez technologie asystujące, sprawdza nazwy interaktywnych kontrolek, role pasków narzędzi i kart oraz przechodzi klawiszem Tab przez pierwsze kontrolki aplikacji. Otwiera też modal wyboru płaszczyzny, sprawdza jego nazwę, fokus na podstawowej płaszczyźnie XY, zapętlenie fokusu i powrót na przycisk „Utwórz szkic” po zamknięciu. Test kończy się błędem, gdy kontrolka nie ma nazwy, wymagany element nie trafia do drzewa albo fokus przechodzi na element niewidoczny.

Pełna regresja `npm run verify:modeling` dodatkowo uruchamia axe (WCAG 2 A/AA/2.1 AA), sprawdza kontrast, fokus klawiatury oraz układ przy powiększeniu 100%, 150% i 200%.

Kontrola macOS Accessibility API ujawniła, że modal wyboru płaszczyzny pozostawiał fokus na przycisku pod oknem. Wspólny mechanizm dialogów nadaje teraz rolę i nazwę, przenosi fokus do otwartego okna, zatrzymuje Tab wewnątrz oraz przywraca fokus po zamknięciu. Obejmuje wybór płaszczyzny, parametry, import modelu i szkicu, raport naprawy, wymiar szkicu, samouczek, licencję oraz aktualizacje. Regresja przechowuje element wywołujący jeszcze przed zamontowaniem kontrolki z `autoFocus`, dzięki czemu zamknięcie modalu rzeczywiście wraca do właściwego miejsca.

## Kontrola ręczna VoiceOver

Na lokalnym kandydacie macOS 6.3.2 włączono systemowy VoiceOver i sprawdzono strukturę oraz kolejność podstawowego przepływu: główne narzędzia, informację licencyjną, samouczek, polecenie Linia, aktywny snap, komunikaty stanu i aktualizator. Linia została rozpoczęta kliknięciem punktu siatki, następnie do nazwanego pola „Długość następnego odcinka mm Enter” wpisano `50` i zatwierdzono Enterem. Czytnik ma dostęp do komunikatów „Punkt początkowy ustawiony” i „Linia została dodana”, stanu snapu, pól długości/kąta oraz przycisków zakończenia i cofnięcia.

Przegląd wykrył błąd aktualizatora: fokus technologii asystującej pozostawał na przycisku pod modalem, wynik sprawdzania nie był regionem statusu, a Escape nie zamykał okna. Aktualizator otrzymał jawny fokus początkowy, `role="status"` z `aria-live="polite"`, obsługę Escape i prawidłowe przywracanie fokusu. Test komponentu oraz pełna kontrola drzewa AX przechodzą po poprawce.

Kandydat jest celowo niepodpisany zgodnie z aktualną ścieżką dystrybucji. Brak certyfikatu wpływa na ostrzeżenie Gatekeeper, ale nie zmienia wyniku audytu interfejsu i VoiceOver.
