# MadCAD — checklista przebudowy interfejsu według Autodesk Fusion

Aktualizacja: 2026-08-31  
Status: aktywna  
Punkt odniesienia: lokalnie zainstalowany Autodesk Fusion Personal na macOS

## Cel

MadCAD ma korzystać z czytelnego przepływu Autodesk Fusion: stały przegląd projektu po lewej, kontekstowy pasek narzędzi u góry, właściwości bieżącej operacji po prawej, płótno w centrum i historia modelu na dole. Nie kopiujemy marki ani zasobów Autodesk; odwzorowujemy hierarchię informacji, przewidywalność działania i kolejność pracy.

## Zweryfikowane wzorce Fusion

- [x] Zapisano rzeczywisty ekran startowy, pusty projekt, wybór płaszczyzny, tryb szkicu, gotowy profil i profil po zakończeniu szkicu w `artifacts/fusion-reference-2026-08-30/`.
- [x] Potwierdzono stały układ: przeglądarka po lewej, wstążka kontekstowa u góry, ViewCube po prawej, nawigacja pod płótnem i historia na dole.
- [x] Potwierdzono, że wejście do szkicu zmienia tylko zawartość wstążki, a nie cały układ aplikacji.
- [x] Potwierdzono, że wybór płaszczyzny odbywa się bez osobnego dużego okna zasłaniającego model.
- [x] Potwierdzono, że po zakończeniu szkicu profil pozostaje widoczny i gotowy do operacji 3D.
- [x] Potwierdzono grupy szkicu: `UTWÓRZ`, `ZMIEŃ`, `WIĄZANIA`, `SPRAWDŹ`, `WSTAW`, `WYBIERZ`, `ZAKOŃCZ SZKIC`.
- [x] Potwierdzono grupy modelowania: `UTWÓRZ`, `ZMIEŃ`, `KONSTRUKCJA`, `SPRAWDŹ`, `WSTAW`, `ZŁOŻENIE`, `WYBIERZ`.

## Zasady, których nie wolno łamać

- [x] Jedno narzędzie wyboru; po zakończeniu lub anulowaniu polecenia wybór ma działać automatycznie.
- [x] `Esc` anuluje bieżące polecenie, ale nie niszczy modelu ani szkicu.
- [x] Zakończenie szkicu nie ukrywa gotowego profilu i nie uruchamia ponownie wyboru płaszczyzny.
- [x] Narzędzia 2D, modelowanie 3D, dokumentacja 2D i druk 3D mają odrębne miejsca.
- [x] Aktywny przycisk wykonuje operację; brak atrap i dublujących się poleceń.
- [x] Każdy tryb zachowuje stałe położenie przeglądarki, płótna, właściwości i historii.
- [x] Ikona, tekst, stan aktywny, stan wyłączony i tooltip mają jednakową logikę w całej aplikacji.

## P0 — przepływ szkic → bryła

- [x] Ujednolicić stały szkielet ekranu zgodnie z Fusion: lewy browser, górna wstążka, środek, prawy panel polecenia, dolna historia.
- [x] Zastąpić osobny modal wyboru płaszczyzny wyborem bezpośrednio na płótnie z nieblokującą instrukcją.
- [x] Po `Zakończ szkic` zachować widoczność profilu i jego zaznaczenie lub jednoznacznie podświetlić profil gotowy do 3D.
- [x] Kliknięcie `Wyciągnij` ma użyć istniejącego profilu; nie może ponownie pytać o płaszczyznę szkicu.
- [x] Wyciągnięcie ma mieć jeden panel po prawej: profil, odległość, kierunek, zakres i operacja New/Join/Cut/Intersect.
- [x] Wartość odległości ma przyjmować wpis z klawiatury i zatwierdzenie Enterem oraz reagować na manipulator.
- [x] Po zatwierdzeniu bryła, szkic i operacja muszą pozostać widoczne w przeglądarce i historii.
- [x] Zaznaczenie ściany ma oferować kontekstowo: szkic na ścianie, Press Pull, Offset Face.
- [x] Zaznaczenie krawędzi ma oferować kontekstowo: Fillet i Chamfer.
- [x] Zaznaczenie bryły ma oferować kontekstowo: Move/Copy, Pattern, właściwości i usuń.

## P0 — kamera i zaznaczanie

- [x] Prawy przycisk myszy obraca kamerę zgodnie z decyzją użytkownika; `Esc` anuluje polecenie.
- [x] Środkowy przycisk lub gest panoramuje; kółko przybliża bez skoków i zachowuje punkt pod kursorem.
- [x] W aktywnym szkicu kamera pozostaje ortogonalna do płaszczyzny, dopóki użytkownik świadomie nie opuści lub nie zmieni widoku.
- [x] ViewCube ma jednoznaczne ściany, widoki przeciwne, nazwę aktualnej orientacji i widok izometryczny.
- [x] Pasek nawigacji ma stałe, niekolidujące miejsce pośrodku pod płótnem i czytelne tooltipy.
- [x] Snap ma zawsze widoczny marker, typ punktu i krótką informację tekstową przed kliknięciem.
- [x] Polecenie kończy się do stanu wyboru; użytkownik nie musi włączać osobnego `Wybierz` po każdym narzędziu.

## P1 — hierarchia interfejsu Fusion

- [x] Zmniejszyć liczbę równorzędnych zakładek na górze; główny przełącznik obszaru ma być jeden i przewidywalny.
- [x] W modelowaniu pokazywać tylko grupy adekwatne do aktualnego trybu i szerokości okna.
- [x] Najczęstsze narzędzia mają pełną ikonę i etykietę; rzadsze trafiają do menu grupy, bez chowania wolnego miejsca.
- [x] Wstążka nie może dociskać ikon do krawędzi ani nakładać ich na siebie przy szerokościach 1280, 1440 i 1920 px.
- [x] Ujednolicić proporcje: wysokość wstążki, rozmiar ikon, tekst narzędzi, nagłówki grup i odstępy.
- [x] Przeglądarka projektu ma strukturę Fusion: dokument, ustawienia, początek, szkice, bryły, komponenty i konstrukcja.
- [x] Widoczność szkiców i brył jest przełączana ikoną oka przy obiekcie, utrwalana w projekcie i zsynchronizowana z płótnem.
- [x] Prawy panel pokazuje tylko bieżące polecenie lub właściwości zaznaczenia; nie otwiera wielu nakładających się okien.
- [x] Dolna historia pokazuje operacje w kolejności, stan aktywny, suppressed i marker rollbacku.
- [x] Komunikaty stanu mają być krótkie i pomocnicze; nie mogą konkurować z narzędziem ani zasłaniać modelu.

## P1 — podział obszarów

- [x] `PROJEKTUJ` obejmuje szkic, bryłę, powierzchnię, konstrukcję, sprawdzanie i podstawowe złożenie.
- [x] `ARKUSZ 2D` obejmuje wyłącznie dokumentację techniczną, adnotacje i wydruk/eksport arkusza.
- [x] `ZARZĄDZAJ` obejmuje parametry, wersje, zależności, kondycję i komponenty projektu.
- [x] Import/eksport projektu i modelu pozostaje w menu `Plik`; nie dublować go w kilku wstążkach.
- [x] Druk 3D pozostaje osobnym dodatkiem uruchamianym z `Plik`, bez mieszania z dokumentacją 2D.
- [x] Usunąć zapisywane presety układu z głównego przepływu; zachować jeden dobry układ adaptacyjny.

## P1 — skróty, nazwy i pomoc

- [x] Zachować skróty inspirowane Autodesk dla podstaw: `L` linia, `R` prostokąt, `C` okrąg, `E` wyciągnij, `M` przesuń, `F` zaokrąglij, `D` wymiar.
- [x] Skrót nie jest drukowany na każdym przycisku; jest widoczny w tooltipie i menu narzędzia.
- [x] Nazwy są polskie i konsekwentne; angielska nazwa techniczna może być drugą linią tylko tam, gdzie pomaga w wymianie danych.
- [x] Tooltip wyjaśnia działanie, wymagany wybór, skrót i powód niedostępności.
- [x] Linia poleceń przyjmuje aliasy, ale pozostaje pomocnicza wobec bezpośredniej pracy myszą.

## Weryfikacja każdej paczki

- [x] Test komponentu i test przepływu UI.
- [x] Test pełnego scenariusza: pusty projekt → szkic → profil → wyciągnięcie → zapis → ponowne otwarcie.
- [x] Test anulowania `Esc`, cofania/ponawiania i powrotu do wyboru.
- [x] Test kamery myszą i trackpadem bez skoków.
- [x] Test wizualny macOS w 1280×800, 1440×900 i pełnym ekranie.
- [x] Porównanie z zapisanymi ekranami Fusion, bez kopiowania znaków towarowych i zasobów.
- [x] Lokalny build i podmiana `/Applications/MadCAD.app`; bez publikowania wydania na GitHub do czasu zgody użytkownika.

## Stan paczki 2026-08-31

- [x] Zainstalowano lokalnie MadCAD 6.4.6 z podpisem ad-hoc, bez certyfikatu producenta i bez notaryzacji.
- [x] Zweryfikowano po ponownym uruchomieniu aplikacji ekran startowy, widok modelowania, wybór płaszczyzny i obszar szkicu.
- [x] Zapisano zrzut zainstalowanego obszaru szkicu w `artifacts/fusion-ui-local-2026-08-30/01-sketch-workspace.jpeg`.
- [x] Poprzednią aplikację przeniesiono do Kosza jako `MadCAD-before-fusion-ui-20260830.app`, więc podmiana jest odwracalna.
- [x] Wybór XY/XZ/YZ działa bezpośrednio na kolorowych płaszczyznach modelu; panel instrukcji jest mały, nieblokujący i odsunięty od środka płótna.
- [x] Wyciągnięcie przyjmuje odległość z klawiatury, reaguje na manipulator i zatwierdza operację Enterem.
- [x] Ściana, krawędź i bryła pokazują właściwe akcje kontekstowe; usunięcie bryły prowadzi przez bezpieczne potwierdzenie zależności historii.
- [x] Audyt przepływu oraz dowody wizualne zapisano w `docs/FUSION_FLOW_AUDIT_2026-08-31.md` i `artifacts/fusion-flow-audit-2026-08-31/`.
- [x] Nowy build 6.4.6 podpisano ad-hoc, zainstalowano jako `/Applications/MadCAD.app` i sprawdzono w uruchomionej aplikacji; poprzedni build przeniesiono do Kosza jako `MadCAD-before-fusion-flow-20260831.app`.
- [x] Snap pokazuje duży marker, ikonę i typ; test wizualny potwierdza marker wewnątrz płótna.
- [x] ViewCube pokazuje aktualny widok i wszystkie podstawowe kierunki czytelnym tekstem.
- [x] Ikony oka przy szkicach i bryłach sterują rzeczywistą widocznością na płótnie; foldery służą wyłącznie do zwijania listy.
- [x] Finalny lokalny build z tym pakietem zastąpił `/Applications/MadCAD.app`; poprzedni build jest odwracalnie zachowany w Koszu jako `MadCAD-before-visibility-20260831.app`.
- [x] Uproszczono główny przełącznik obszarów, domknięto podział Projektuj/Arkusz 2D/Zarządzaj i ujednolicono tooltipy.
- [x] Usunięto z wstążki zdublowane `Import 3D` i ręczny `Wybierz`; import pozostaje w `Plik`, a wybór wraca automatycznie po zakończeniu lub anulowaniu polecenia.
- [x] Szkic ma logiczne grupy `UTWÓRZ`, `ZMIEŃ`, `WIĄZANIA`, `ORGANIZUJ` i `ZAKOŃCZ SZKIC`; transformacje i szyki są częścią modyfikacji, a warstwy i bloki częścią organizacji.
- [x] Tooltipy przycisków i menu pokazują opis, skrót, stan oraz dokładny lub bezpieczny domyślny powód niedostępności; `D` otwiera menu wymiarów.
- [x] Audyt pakietu i porównanie ekranów zapisano w `docs/WORKSPACE_SEPARATION_AUDIT_2026-08-31.md` oraz `artifacts/workspace-separation-audit-2026-08-31/`.
- [x] Usunięto błąd, przez który strona startowa mogła pozostawić pustą wstążkę po zamknięciu komunikatu licencyjnego; wstążka jest ponownie montowana po zamknięciu komunikatu i zawsze pokazuje cztery grupy `PROJEKTUJ`.
- [x] Kontrola obrazu w typowym oknie potwierdza rzeczywiste odmalowanie wstążki, nie tylko obecność niewidocznych kontrolek w drzewie dostępności.
- [x] Finalny build 6.4.6 zainstalowano w `/Applications/MadCAD.app`, podpisano ad-hoc i sprawdzono w uruchomionej aplikacji; suma SHA-256 `app.asar` źródła i instalacji jest identyczna: `cb6524f20fb9d008c24c6ee66665711339aa0c6e7f825e38179836d8157d2806`.
- [x] Odzyskany projekt użytkownika zabezpieczono jako `~/Documents/MadCAD-odzyskany-2026-08-31.madcad`; wcześniejszą aplikację zachowano odwracalnie w Koszu jako `MadCAD-before-license-ribbon-remount-20260831.app`.
- [x] Dodano prawdziwe modelowanie powierzchniowe B-Rep: `Patch`, `Surface Extrude` dla profilu zamkniętego i otwartego łańcucha oraz `Thicken` z kierunkiem jednostronnym lub symetrycznym.
- [x] Dodano `Surface Revolve` dla profilu zamkniętego i otwartego łańcucha; narzędzie jest dostępne także bezpośrednio w aktywnym szkicu i współpracuje z późniejszym `Thicken`.
- [x] Dodano `Surface Sweep` dla profilu zamkniętego i otwartego łańcucha prowadzonego po osobnym szkicu ścieżki; narzędzie jest dostępne w aktywnym szkicu, zachowuje zależności i współpracuje z `Thicken`.
- [x] Dodano `Surface Loft` jako gładką lub odcinkową otwartą powierzchnię między dwoma profilami z osobnych równoległych szkiców; zachowuje zależności i współpracuje z `Thicken`.
- [x] Dodano `Surface Offset` jako dokładne odsunięcie wybranej powierzchni B-Rep o dodatnią lub ujemną odległość; zachowuje historię i współpracuje z `Thicken`.
- [x] Dodano `Stitch` dla wielokrotnego wyboru powierzchni z parametryczną tolerancją; otwarte powierzchnie tworzą jeden płaszcz, a szczelny zestaw automatycznie staje się bryłą.
- [x] Dodano `Surface Trim`: wspólny wybór jednej powierzchni i jednej bryły proponuje przycięcie, bryłę tnącą można zachować, a wynik współpracuje z `Thicken`.
- [x] Dodano `Surface Extend`: wybranie prostej krawędzi planarnej powierzchni proponuje przedłużenie o dokładną odległość; wynik jest normalizowany do jednego płaszcza i współpracuje z `Thicken`.
- [x] Dodano wspólny panel `Analiza powierzchni` w grupie `SPRAWDŹ`: zebra zależna od kamery, mapa krzywizny z regulowanym zakresem, grzebień krzywizny krawędzi, izolinie XYZ oraz diagnostyka ciągłości ścian. Panel nie tworzy operacji historii i po zamknięciu przywraca zwykły wygląd modelu.
- [x] Test desktopowy przełącza wszystkie cztery tryby, kontroluje błędy shaderów, położenie panelu i przepełnienie oraz zapisuje osobne dowody wizualne w `artifacts/madcad-surface-analysis.png`, `artifacts/madcad-surface-curvature.png`, `artifacts/madcad-surface-comb.png` i `artifacts/madcad-surface-isocurves.png`.
- [x] Powierzchnie mają odrębny typ, półprzezroczysty wygląd i osobny folder w przeglądarce; operacje bryłowe i druk 3D nie traktują ich omyłkowo jako brył zamkniętych.
- [x] Automatyczny przepływ `Patch → Thicken` zweryfikował objętość 3072 mm³, a `Surface Extrude → Move 35 mm → Thicken` 2940,5307 mm³ i środek X = 35 mm; oba kończą się poprawną bryłą w historii.
- [x] Polecenia powierzchniowe mają aliasy `PA/PATCH`, `SE/SURFACEEXTRUDE`, `SR/SURFACEREVOLVE`, `SS/SURFACESWEEP`, `SLO/SURFACELOFT`, `SO/SURFACEOFFSET`, `STI/STITCH`, `STR/SURFACETRIM`, `SXT/SURFACEEXTEND` i `TH/THICKEN/POGRUB`, tooltipy oraz wspólny panel parametrów.
- [x] Dowód wizualny zapisano w `artifacts/madcad-surface-modeling.png`, a raport techniczny w `docs/SURFACE_MODELING_AUDIT_2026-08-31.md`.
- [x] Lokalny build arm64 z modelowaniem powierzchniowym zastąpił `/Applications/MadCAD.app`, przeszedł ścisłą kontrolę podpisu ad-hoc i ma identyczny `app.asar` SHA-256 `1e28ad1fed94900747f6881be251294f3d984018d3083b0269171a888fd8489d`; poprzedni build zachowano jako `MadCAD-before-surfaces-20260831.app`.
- [x] Lokalny build arm64 z `Surface Sweep` zastąpił `/Applications/MadCAD.app`, przeszedł `codesign --verify --deep --strict`, uruchomił się poprawnie i ma identyczny `app.asar` SHA-256 `0fe80c9a757b7f5a46c7e16c7a9b774408009c63f32d925878fdcb5befeab064`; poprzedni build zachowano jako `MadCAD-before-surface-sweep-20260831.app`.
- [x] Lokalny build arm64 z `Surface Loft` zastąpił `/Applications/MadCAD.app`, przeszedł `codesign --verify --deep --strict`, uruchomił się poprawnie i ma identyczny `app.asar` SHA-256 `51d2b98b22f03dcdfae29c2634bf7cf3eba2c4e09e6e042fc75731468b466cf4`; poprzedni build zachowano jako `MadCAD-before-surface-loft-20260831.app`.
- [x] Lokalny build arm64 z `Surface Offset` zastąpił `/Applications/MadCAD.app`, przeszedł `codesign --verify --deep --strict`, uruchomił się poprawnie i ma identyczny `app.asar` SHA-256 `7422f088b9920840ae0e94b41bfd06f5adaf3ee9fd8e0ef3d31ef3545a9ec890`; poprzedni build zachowano jako `MadCAD-before-surface-offset-20260831.app`.
- [x] Lokalny build arm64 ze `Stitch` zastąpił `/Applications/MadCAD.app`, przeszedł `codesign --verify --deep --strict`, uruchomił się poprawnie i ma identyczny `app.asar` SHA-256 `c1f71f8bd7111754b4c40d5c66c51745ad1289561b53198f650fa6bde130e207`; poprzedni build zachowano jako `MadCAD-before-surface-stitch-20260831.app`.
- [x] Lokalny build arm64 z `Surface Trim`, `Surface Extend` i ogólnym pogrubianiem otwartych płaszczy zastąpił `/Applications/MadCAD.app`, przeszedł `codesign --verify --deep --strict`, uruchomił się poprawnie i ma identyczny `app.asar` SHA-256 `d8048f8df71f430d11f8d17eba4ea3005dd8e5b165bad7c75f905980f7689afe`; poprzedni build zachowano jako `MadCAD-before-surface-trim-extend-20260901.app`.
- [x] Lokalny build arm64 z pełną analizą powierzchni zastąpił `/Applications/MadCAD.app`, przeszedł `codesign --verify --deep --strict`, uruchomił się jako świeży proces i ma identyczny `app.asar` SHA-256 `86ac369e0cad21aaf9fe9abe500ed68649a6c610478779586747b2d13dffcb2d`; poprzedni build zachowano jako `MadCAD-before-surface-analysis-20260901.app`.
- [x] Zaznaczona siatka STL/3MF ma kontekstowe `Narzędzia siatki`: raport topologii i odwracalne czyszczenie duplikatów oraz degeneracji. Test Electron naprawia fixture 3→1 trójkąt, a lokalny build ma zgodny `app.asar` SHA-256 `228ac94cf701c9210e6afccdb580ca7078fe37ad5223e8d648fe8b103fbdf3d1`.
- [x] `Narzędzia siatki` mają kontrolowaną redukcję, wygładzanie chroniące otwarte brzegi i trwałe grupy ścian według kąta cechy. Test Electron wykonuje cały przepływ na STL 128→72 trójkąty, sprawdza Cofnij/Ponów oraz zmieszczenie panelu; lokalny build ma zgodny `app.asar` SHA-256 `1e49d404af03b153d9c3009fd68680e07e75bf6ea216dca1a3e01da401b58417`.
- [x] Dodano jednorodny remesh i odwracalną konwersję zamkniętej siatki do fasetowej bryły B-Rep OpenCascade. Testy Electron potwierdzają przepływ Mesh↔B-Rep, Cofnij/Ponów, objętość sześcianu 1000 mm³ i panel mieszczący się nad paskiem poleceń; lokalny build ma zgodny `app.asar` SHA-256 `444f709b2209cd640a308b884563163063302fd2da90970af4f73ab445603f8e`.
- [x] Panel siatki podzielono na czytelne grupy `Naprawa` i `Obróbka`; dodano korektę orientacji komponentów oraz limitowane wypełnianie małych otworów. Test otwartego sześcianu potwierdza 4 nowe trójkąty, wynikowy B-Rep 1000 mm³, Cofnij/Ponów i pełne zmieszczenie panelu; lokalny build ma zgodny `app.asar` SHA-256 `abe0cb70ffa7674b423f7785e5a4e7cd869c3522283403f9a72762545e299cf3`.
- [x] Wspólny kontrakt wstążki automatycznie wyłącza każdy przycisk, element menu i polecenie w przepełnieniu bez przypisanej akcji; test komponentu celowo tworzy atrapę i potwierdza czytelny stan niedostępny.
- [x] Audyt rzeczywistego interfejsu potwierdza `enabledWithoutAction: []` w modelowaniu i szkicu, brak zdublowanych narzędzi, kompaktowy komunikat stanu oraz jego ukrycie po uruchomieniu polecenia Linia.
- [x] Build z ochroną aktywnych poleceń zastąpił `/Applications/MadCAD.app`, przeszedł `codesign --verify --deep --strict`, a źródłowy i zainstalowany `app.asar` mają SHA-256 `387018433134b6b659d8eb19dd57d03544522ef286fa79594468fa57be3a5001`; poprzedni build zachowano jako `MadCAD-before-ribbon-action-guard-20260831.app`.
- [x] Dodano odrębny `Szkic 3D`: ciągłe odcinki XYZ, Cofnij, zakończenie przez Esc lub przycisk, izometryczny widok, jawne oznaczenie `3D` w przeglądarce oraz brak przypadkowego scalania z geometrią 2D.
- [x] Pełny przepływ desktopowy prowadzi dokładny Pipe B-Rep po niepłaskiej ścieżce 3D, zapisuje i ponownie otwiera projekt bez zmiany objętości ani wymiarów; raport jest w `docs/SKETCH_3D_AUDIT_2026-09-02.md`.
- [x] Panel szkicu 3D przełącza linię, łuk przez trzy punkty i spline Béziera bez opuszczania polecenia; wszystkie krzywe są widoczne w przestrzeni i mogą wspólnie prowadzić Pipe/Sweep.
- [x] Regresja desktopowa prowadzi Pipe po jednej ścieżce `linia → linia → łuk → spline`, wymusza zakończenie przeliczenia parametrów przed zapisem i porównuje bryłę po ponownym otwarciu.
- [x] Spline 3D ma wybór G0/G1/G2: G1 przejmuje styczną poprzedniej linii, łuku lub spline, G2 dodatkowo przejmuje wektor krzywizny, a użytkownik steruje długością uchwytu. Warunek jest zapisany w geometrii i sprawdzany przez rdzeń oraz pełny test `Pipe` po ponownym otwarciu.
- [x] Lokalny build arm64 z ciągłością G1/G2 zastąpił `/Applications/MadCAD.app`, przeszedł podpis ad-hoc oraz `codesign --verify --deep --strict` i uruchomił się jako świeży proces PID `41312`. Źródłowy oraz zainstalowany `app.asar` mają SHA-256 `434cab86ff304ec2f33e2cd9b4e02969ed0fe8ecf13683420189b9dda7280d12`; poprzedni build zachowano jako `MadCAD-before-g1-g2-20260902-1907.app` w Koszu.
- [x] `Pobierz krawędzie` tworzy w szkicu 3D zablokowaną linię z prostej krawędzi B-Rep, zachowuje trwałą referencję oraz synchronizuje oba końce w XYZ. Panel ma jawne `Pobierz/Anuluj`, po operacji przywraca wcześniejsze polecenie szkicu, a test Electron potwierdza, że skojarzona linia jest od razu dostępna dla Pipe.
- [x] Lokalny build arm64 ze szkicem 3D zastąpił `/Applications/MadCAD.app`, został podpisany ad-hoc bez certyfikatu producenta, przeszedł `codesign --verify --deep --strict` i uruchomił się jako świeży proces. Źródłowy oraz zainstalowany `app.asar` mają SHA-256 `bd293b493ad0f657898dd50051208d99f0f4decd8219d50113deba8e4f5cf930`; poprzedni build zachowano jako `MadCAD-before-sketch-3d-20260902-1241.app` w Koszu.
- [x] Lokalny build arm64 z łukiem i spline 3D zastąpił `/Applications/MadCAD.app`, przeszedł podpis ad-hoc oraz `codesign --verify --deep --strict` i uruchomił się jako świeży proces. Źródłowy oraz zainstalowany `app.asar` mają SHA-256 `fd572e1588590315aa492c979668c01fe20ba023b95330846f0557967377ea0a`; poprzedni build zachowano jako `MadCAD-before-3d-curves-20260902-153522.app` w Koszu.
- [x] Kandydat wydania 6.4.7 arm64 ze skojarzonymi ścieżkami 3D zastąpił `/Applications/MadCAD.app`, przeszedł podpis ad-hoc oraz `codesign --verify --deep --strict` i uruchomił się jako świeży proces PID `45541`. Źródłowy oraz zainstalowany `app.asar` mają SHA-256 `e3d364bbfb6ff9ae7c4dc0f00d61b782bd6175c809e14903aab49b9514a3081d`; poprzednią wersję zachowano jako `MadCAD-before-6.4.7-20260903-0853.app` w Koszu.

### Weryfikacja 2026-09-05 — skojarzone B-spline 3D

- [x] Pobranie otwartej krawędzi B-spline zachowuje dokładne dane i referencję do bryły; próbki służą podglądowi.
- [x] Pipe korzysta z dokładnej krzywej. Test desktopowy pobiera krawędź istniejącej rury, tworzy kolejną i porównuje objętość po otwarciu projektu (20.578120917363194 mm³).
- [x] Naprawiono podwójne zwalnianie krzywej należącej do uchwytu OpenCascade; pełny scenariusz przechodzi bez awarii.
- [x] Walidacja odrzuca niepoprawne współrzędne, wagi, węzły i próbki podglądu.
- [x] Osobna weryfikacja przeciągania końca spline rzeczywistymi zdarzeniami myszy Electron i anulowania przez `pointercancel`; przerwanie ruchu nie zapisuje zmiany. Ukryte i zablokowane warstwy nie udostępniają uchwytów.

## Pliki główne

### Weryfikacja 2026-09-05 — przełączanie projektów

- [x] Zmiana identyfikatora dokumentu kończy poprzedni worker CAD i odrzuca oczekujące obliczenia. Nowy projekt nie wyświetla brył, analizy ani historii poprzedniego dokumentu.
- [x] Pełny lokalny scenariusz Electron przeszedł, w tym Coil → nowy projekt → Pipe, dalsze modelowanie i eksport STL/STEP/3MF.
- [x] Raport awarii testu zawiera teraz zrzut ekranu oraz stan dokumentu, obliczeń i odzyskiwania autozapisu.
- [x] CI run `33927651232`: pełny test modelowania/importu/bezpieczeństwa przeszedł na Windows (5m16s) i macOS (3m59s); jakość, audyt i core/build trzech systemów także przeszły. Testy instalatorów jeszcze trwały przy zapisie. Osobna integracja Cloudflare `madcadtoken` zgłosiła błąd; nie dotyczy to wyników desktopowego CI i nie oznaczono jej jako naprawionej.
- [x] Lokalny build 6.4.7 z poprawkami B-spline, uchwytów i przełączania projektów zainstalowano w `/Applications/MadCAD.app`. Sprawdzono 27 plików renderer/Electron względem źródeł, podpis ad-hoc i gotowy ekran aplikacji przez interfejs macOS. SHA-256 `app.asar`: `e1125a227ef59f47c520ab2e68d3b932b77325db8075cee1530a7f4390fabadc`. Kopia poprzedniej aplikacji: `~/.Trash/MadCAD-before-3d-bspline-20260905.app`.
- [x] Pakowanie lokalne korzystało ze stagingu zawierającego skompilowany renderer, moduły Electron i dokumentację, bez ponownego pakowania zależności renderera zawartych już w bundle. Standardowy lokalny builder blokował się podczas odczytu plików `node_modules`.

- `src/modeling/ModelingWorkspace.jsx` — szkielet obszarów, przepływ poleceń i wybór.
- `src/modeling/WorkspaceRibbon.jsx` — zachowanie wstążki i przepełnienia.
- `src/modeling/WorkspaceSketchUi.jsx` — wybór płaszczyzny, paleta szkicu i kontekstowe działania.
- `src/modeling/WorkspacePanels.jsx` — prawy panel polecenia i właściwości.
- `src/modeling/ModelViewport.jsx` — zaznaczanie, snap, kamera, manipulator i ViewCube.
- `src/modeling/modeling.css` — spójny układ, skala i responsywność.
- `scripts/verify-interface-consistency.cjs` — pomiary układu i scenariusz wizualny.
- `scripts/verify-modeling.cjs` — scenariusz od szkicu do bryły i ponownego otwarcia.
