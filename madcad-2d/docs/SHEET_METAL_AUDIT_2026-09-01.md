# MadCAD — moduł blach

## Ukończony zakres: baza, kołnierz, Hem i Rip

Osobne menu `Blacha` porządkuje narzędzia poza zwykłymi operacjami bryłowymi. `Blacha → Baza blachowa` rozpoczyna model blachowy z jednego zamkniętego profilu zakończonego szkicu. Operacja nie jest przemianowanym zwykłym wyciągnięciem: zapisuje jawny kontrakt technologiczny używany przez kolejne operacje:

- grubość materiału,
- domyślny promień gięcia,
- współczynnik K z zakresem `0–1`,
- położenie materiału po jednej stronie profilu albo symetrycznie,
- kierunek dla wariantu jednostronnego.

Silnik rozwiązuje profil i wszystkie trzy wartości przez wspólny system wyrażeń parametrycznych, a następnie buduje zamkniętą bryłę OpenCascade B-Rep. Metadane `sheetMetal` pozostają przypisane do wyniku i zawierają również profil źródłowy oraz listę przyszłych gięć. Przeglądarka pokazuje oddzielne oznaczenie `BLACHA · … mm`, dzięki czemu nie trzeba zgadywać, czy wskazana bryła należy do modułu blach.

Operacja współpracuje z istniejącym podglądem, historią, edycją parametrów oraz `Cofnij/Ponów`. Szkic źródłowy pozostaje w dokumencie i nie znika po utworzeniu bryły.

`Blacha → Kołnierz blachy` działa po zaznaczeniu dokładnie jednej prostej krawędzi takiej bryły. Polecenie tworzy w tej samej historii i na tej samej bryle dokładny panel B-Rep z parametryczną długością, kątem `0–180°`, promieniem gięcia oraz możliwością odwrócenia kierunku. W przekroju powstają współśrodkowe łuki o promieniu wewnętrznym `R` i zewnętrznym `R + grubość`, więc promień nie jest wyłącznie metadanymi. Grubość i współczynnik K są dziedziczone z bazy. Każde gięcie zapisuje także długość neutralną potrzebną później do rozwinięcia i tabeli gięć. Nie powstaje duplikat bryły, a zmiana parametrów przebudowuje bazę i kołnierz razem.

`Zawinięcie blachy` wykonuje pełny łuk `180°` na wskazanej prostej krawędzi. Użytkownik steruje długością równoległej zakładki, prześwitem między warstwami i kierunkiem; prześwit wyznacza fizyczny promień wewnętrzny zawinięcia. `Szczelina blachy` odejmuje dokładnym Boolean Cut pas o zadanej szerokości wzdłuż całej wskazanej krawędzi. Obie operacje pozostają częścią tej samej bryły, mają trwałe referencje topologii, podgląd, edycję historii i osobne Cofnij/Ponów.

## Walidacja

- test rdzenia sprawdza zapis i obliczenie grubości, promienia, współczynnika K, strony materiału oraz zależności od profilu;
- test desktopowy `verify:sheet-metal-base` tworzy szkic prostokąta przez rzeczywisty interfejs, kończy szkic, otwiera menu `Blacha`, ustawia regułę i zatwierdza bazę;
- wynik ma grubość `2 mm`, promień `3 mm`, współczynnik K `0,45`, tryb symetryczny i objętość `1920 mm³` dla profilu `40 × 24 mm`;
- ten sam test wybiera górną prostą krawędź, tworzy kołnierz `10 mm / 90° / R3`, sprawdza wzrost objętości, zasięg geometrii, zapis gięcia i niezależne `Cofnij/Ponów`;
- na wolnej krawędzi kołnierza test dodaje Hem `6 mm / 0,5 mm`, a na drugiej krawędzi szczelinę `1 mm`; sprawdza odpowiednio wzrost i spadek objętości, metadane oraz Cofnij/Ponów;
- dowód wizualny gotowej bryły jest zapisany w `artifacts/madcad-sheet-metal-hem-rip.png`.

## Dalsza kolejność

1. Unfold/Refold oraz flat pattern liczony z promienia, grubości i współczynnika K.
2. Skojarzona tabela gięć dla arkusza 2D.

Każdy etap ma zachować jedną parametryczną historię oraz współpracować z poprzednimi narzędziami; interfejs nie będzie wymagał ręcznego wyłączania jednej funkcji, aby uruchomić następną.

## Instalacja lokalna

Po przejściu pełnej walidacji build arm64 z ukończonym bieżącym pakietem zastępuje `/Applications/MadCAD.app`, otrzymuje lokalny podpis ad-hoc i przechodzi `codesign --verify --deep --strict`. GitHub pozostaje bez zmian do wyraźnego polecenia wydania.
