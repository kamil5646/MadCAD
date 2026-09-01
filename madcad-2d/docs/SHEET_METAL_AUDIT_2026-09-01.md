# MadCAD — moduł blach

## Ukończony zakres: baza, kołnierz, Hem, Rip, wzór płaski i tabela gięć

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

`Rozwiń blachę` nie jest zmianą kamery ani płaskim obrazem bryły. Operacja przebudowuje tę samą blachę jako ciągłą planarną bryłę B-Rep o zachowanej grubości. Dla każdego kołnierza i zawinięcia odkłada długość prostą oraz naddatek osi neutralnej `BA = (R + K × t) × kąt`; kolejne odcinki tej samej krawędzi są układane jeden za drugim, a Rip jest ponownie odjęty od wzoru płaskiego. `Zagnij ponownie` przywraca dokładny stan zagięty sprzed rozwinięcia. Oba stany należą do osi czasu, obsługują Cofnij/Ponów i blokują operacje w niewłaściwej kolejności.

`Arkusz 2D → Tabela gięć` dodaje skojarzone zestawienie dla wszystkich blach w dokumencie. Każdy kołnierz i Hem otrzymuje osobny wiersz z częścią, typem operacji, kątem, promieniem, długością krawędzi i obliczonym naddatkiem `BA`. Tabela aktualizuje się z modelem, pozostaje zapisana w dokumencie i jest uwzględniana w eksporcie PDF/DXF.

## Walidacja

- test rdzenia sprawdza zapis i obliczenie grubości, promienia, współczynnika K, strony materiału oraz zależności od profilu;
- test desktopowy `verify:sheet-metal-base` tworzy szkic prostokąta przez rzeczywisty interfejs, kończy szkic, otwiera menu `Blacha`, ustawia regułę i zatwierdza bazę;
- wynik ma grubość `2 mm`, promień `3 mm`, współczynnik K `0,45`, tryb symetryczny i objętość `1920 mm³` dla profilu `40 × 24 mm`;
- ten sam test wybiera górną prostą krawędź, tworzy kołnierz `10 mm / 90° / R3`, sprawdza wzrost objętości, zasięg geometrii, zapis gięcia i niezależne `Cofnij/Ponów`;
- na wolnej krawędzi kołnierza test dodaje Hem `6 mm / 0,5 mm`, a na drugiej krawędzi szczelinę `1 mm`; sprawdza odpowiednio wzrost i spadek objętości, metadane oraz Cofnij/Ponów;
- następnie test rozwija oba kolejne odcinki do jednego arkusza o grubości `2 mm`, sprawdza zasięg wynikający z obu naddatków, ponownie zagina blachę i potwierdza odzyskanie objętości oraz granic bryły sprzed rozwinięcia;
- dowód wizualny ciągłego wzoru płaskiego jest zapisany w `artifacts/madcad-sheet-metal-flat-pattern.png`.
- na końcu test przechodzi rzeczywistym interfejsem do `Arkusz 2D`, tworzy tabelę gięć, sprawdza jej faktyczną widoczność oraz wiersze `Kołnierz` i `Hem`; dowód jest zapisany w `artifacts/madcad-sheet-metal-bend-table.png`.

## Dalsza kolejność

Pakiet modelowania blach z bieżącej listy jest ukończony. Kolejny niezależny moduł z backlogu to Plastic: Boss, snap-fit, grille oraz analizy grubości i pochylenia.

Każdy etap ma zachować jedną parametryczną historię oraz współpracować z poprzednimi narzędziami; interfejs nie będzie wymagał ręcznego wyłączania jednej funkcji, aby uruchomić następną.

## Instalacja lokalna

Po przejściu pełnej walidacji build arm64 z ukończonym bieżącym pakietem zastępuje `/Applications/MadCAD.app`, otrzymuje lokalny podpis ad-hoc i przechodzi `codesign --verify --deep --strict`. GitHub pozostaje bez zmian do wyraźnego polecenia wydania.
