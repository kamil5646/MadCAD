# MadCAD — moduł blach

## Ukończony zakres: baza blachowa

`Więcej brył → Baza blachowa` rozpoczyna model blachowy z jednego zamkniętego profilu zakończonego szkicu. Operacja nie jest przemianowanym zwykłym wyciągnięciem: zapisuje jawny kontrakt technologiczny używany przez kolejne operacje:

- grubość materiału,
- domyślny promień gięcia,
- współczynnik K z zakresem `0–1`,
- położenie materiału po jednej stronie profilu albo symetrycznie,
- kierunek dla wariantu jednostronnego.

Silnik rozwiązuje profil i wszystkie trzy wartości przez wspólny system wyrażeń parametrycznych, a następnie buduje zamkniętą bryłę OpenCascade B-Rep. Metadane `sheetMetal` pozostają przypisane do wyniku i zawierają również profil źródłowy oraz listę przyszłych gięć. Przeglądarka pokazuje oddzielne oznaczenie `BLACHA · … mm`, dzięki czemu nie trzeba zgadywać, czy wskazana bryła należy do modułu blach.

Operacja współpracuje z istniejącym podglądem, historią, edycją parametrów oraz `Cofnij/Ponów`. Szkic źródłowy pozostaje w dokumencie i nie znika po utworzeniu bryły.

## Walidacja

- test rdzenia sprawdza zapis i obliczenie grubości, promienia, współczynnika K, strony materiału oraz zależności od profilu;
- test desktopowy `verify:sheet-metal-base` tworzy szkic prostokąta przez rzeczywisty interfejs, kończy szkic, otwiera menu `Więcej brył`, ustawia regułę blachy i zatwierdza operację;
- wynik ma grubość `2 mm`, promień `3 mm`, współczynnik K `0,45`, tryb symetryczny i objętość `1920 mm³` dla profilu `40 × 24 mm`;
- ten sam test sprawdza oznaczenie w przeglądarce oraz pełne `Cofnij/Ponów` i zapisuje dowód wizualny w `artifacts/madcad-sheet-metal-base.png`.

## Dalsza kolejność

1. Kołnierz krawędziowy i gięcie, oparte wyłącznie na bryle posiadającej regułę blachy.
2. Hem i Rip z jawną szczeliną technologiczną.
3. Unfold/Refold oraz flat pattern liczony z promienia, grubości i współczynnika K.
4. Skojarzona tabela gięć dla arkusza 2D.

Każdy etap ma zachować jedną parametryczną historię oraz współpracować z poprzednimi narzędziami; interfejs nie będzie wymagał ręcznego wyłączania jednej funkcji, aby uruchomić następną.

## Instalacja lokalna

Build arm64 z bazą blachową zastąpił `/Applications/MadCAD.app`, otrzymał lokalny podpis ad-hoc i przeszedł `codesign --verify --deep --strict`. Źródłowy i zainstalowany `app.asar` mają SHA-256 `b53cd18d27e203c7722163d2157dd30f77ebde388053f61735d6404d36ae1420`. Poprzednią aplikację zachowano odwracalnie w Koszu jako `MadCAD-before-sheet-base-20260901.app`; GitHub nie został zmieniony.
