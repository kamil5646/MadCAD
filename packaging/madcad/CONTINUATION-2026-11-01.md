# MadCAD 8 — przejęcie prac po Claude

## Stan zastany

Źródła aktywnej wersji Rust: `/Users/kamilkasprzak/Developer/MadCAD8`,
gałąź `madcad`, upstream `4c3d1484` (SolidCraft). Zmiany forka były niezacommitowane.
Stary katalog `Documents/ChatGPT/MADCAD/MadCAD` zawiera wersję 6.5.30 i nie jest
aktywnym źródłem najnowszych prac Claude'a.

Claude wcześniej przebudował interfejs Electron (linia 7.x), dodał polilinię,
wpisywanie długości, łączenie punktów, rysunki i poprawki zaznaczania. Te zmiany
wynikają z historii jego pracy; nie były ponownie testowane w tym przejęciu.
Następnie rozpoczął osobny fork SolidCraft w Rust na polecenie użytkownika.
Powstał pakiet Mac i instalacja `/Applications/MadCAD 8.app`, ale binarium nadal
zgłaszało 0.28.0, a ostatnie zmiany interfejsu nie były zbudowane.

## Dokończone w tym przejęciu

- Spójna wersja 8.0.0 w workspace i Cargo.lock; binarium GUI zgłasza MadCAD.
- Dokończenie przygotowanego przez Claude'a polskiego brandingu i znaku M.
- Cztery domyślne karty: Model, Wstaw, Sprawdź, Widok. Zaawansowane karty
  pozostają dostępne przez istniejące menu +. Jednorazowa migracja ustawień
  podglądu; późniejsze wybory użytkownika są zachowywane.
- Wyłączony asystent AI i automatyczne dodawanie wpisów do aplikacji AI.
- Dane odzyskiwania i diagnostyki w MadCAD8 zamiast SolidCraft; miniatury
  i cache również mają własne katalogi. Nie kopiujemy automatycznie autosave'ów
  z innego uruchomionego programu. Stare katalogi pozostają na dysku.
- Link informacji o wydaniu i źródło aktualizacji wskazują MadCAD.
- Pakowanie odrzuca wersję inną niż Cargo.toml i hosta Intel; używa lockfile,
  tworzy ZIP, DMG oraz SHA256SUMS.txt. Zachowane licencje i atrybucja upstream.

## Granice tego etapu

To lokalna kompilacja i instalacja macOS. Bez publikacji GitHub, wdrożenia strony,
wersji Windows/Linux ani pełnej macierzy testów upstream. Licencjonowanie kontem
MadCAD z Electron nie zostało przeniesione. Format projektu Rust pozostaje `.sc`;
nie potwierdzono migracji dawnych plików `.madcad`. Nazwy crate'ów, protokół,
identyfikatory formatów i zmienne SOLIDCRAFT_* pozostają zgodne z upstream.
CAM i integracje produkcyjne nie są rozwijane.

Wyniki kompilacji i krótkiej weryfikacji: `target/madcad-build.log` oraz
`target/madcad-verification/`. Pakiety: `dist/`.

## Potwierdzona krótka weryfikacja

Uruchomiony rzeczywisty pakiet Mac, osobne ustawienia i recovery, Metal / Apple M2.
Zrzut okna potwierdza MadCAD v8.0.0, cztery domyślne karty po polsku i brak
przycisku asystenta. Kanał sterowania potwierdza te same karty i wyłączone AI.

Prostokąt 40 × 30 mm → wyciągnięcie 10 mm: jedna zamknięta bryła,
12 000 mm³. Szkic na jej górnej ścianie → prostokąt 20 × 14 mm →
dołączenie wyciągnięcia 6 mm: jedna zamknięta bryła, 13 680 mm³.
Cofnij: 12 000 mm³; Ponów: 13 680 mm³. Zapis i ponowne otwarcie `.sc`
zachowują 13 680 mm³. To sprawdzenie produkcyjnego silnika przez kanał
sterowania, nie pełne przejście formularzy i rysowania myszą.

`cargo xtask assets` przeszedł (881 zasobów); `cargo xtask icons` przeszedł
(362 mastery, brak brakujących ikon, 17 kontroli narzędzi). Dla ikon użyto
zainstalowanego Pythona 3.14, bo systemowy Python 3.9 nie ma `tomllib`.
`git diff --check`, składnia skryptu Bash i katalog języka polskiego są poprawne.

Przed podmianą ponownie sprawdzono, że stara aplikacja Rust ma pusty projekt bez
niezapisanych zmian, po czym wysłano zwykłe żądanie zamknięcia. Kopia aplikacji
i jej ustawień: `/Users/kamilkasprzak/Developer/MadCAD8-backups/2026-11-01-182113`.

## Dalsza praca: paleta MadMag i codzienny CAD

Na prośbę użytkownika dodano dwa wbudowane motywy MadMag, jasny i ciemny.
Kolory firmowe #b3202a / #8f1720 pochodzą z bieżącego lokalnego arkusza
`MadMag-Magazyn/magazyn/magazyn.css`. Tło i panele są neutralne; czerwone są
akcenty, aktywne karty i ikony brył. Osie, szkic, więzy i ostrzeżenia zachowują
kolory techniczne. Logo interfejsu czyta paletę zamiast stałego niebieskiego.
Jednorazowa migracja zmienia zwykły dark/light na MadMag; własne motywy i
późniejsze wybory użytkownika są zachowane. Motywy są dostępne offline.

Usunięto polecenie wysyłania do slicera z Plik, menu brył/komponentów,
wstążki i wyszukiwarki. Eksport geometrii STL/3MF/STEP pozostaje dostępny.
Skrócono polskie etykiety podstawowych operacji do „Wyciągnij” i „Zaokrąglij”,
żeby nie były ucinane w podstawowym widoku.

## Szybka edycja bryły

Menu pojedynczej bryły w przeglądarce i widoku oferuje teraz Edytuj operację
oraz Edytuj szkic profilu (gdy operacja ma taki szkic). To te same edytory
co na osi czasu. Cel jest wyznaczany z klikniętej bryły, niezależnie od
poprzedniego zaznaczenia. Dla wielu brył nie wybieramy arbitralnie operacji;
przy zablokowanej bryle akcje modyfikacji są nieaktywne.

Usunięto duplikat Remove z menu bryły. Pozostawione Usuń korzysta z istniejącego
selection.delete, które dla bryły dodaje operację Remove do historii i zachowuje
Cofnij/Ponów. Nazwę Edit Feature poprawiono z Edytuj funkcję na Edytuj operację.
Menu Plik ma polskie etykiety importu/eksportu STEP, siatek, STL, 3MF, OBJ, URDF
i JSON; nowe komunikaty są w katalogu pending z tłumaczeniami.

Błędy wyrażeń w polach liczbowych są pokazywane jako wskazówki w języku interfejsu:
nieznany parametr, niepełne wyrażenie, dzielenie przez zero i ogólny błąd wartości.
Literówka nie oferuje już tworzenia zgłoszenia błędu aplikacji. Rozpoznawany jest
wyłącznie prefiks ewaluatora na znanych polach; błędy kernela zachowują zgłoszenia.
Surowe diagnostyki w stanie silnika i w dialogu pozostają dostępne dla logów.

## Rysowanie: Linia i Polilinia

Kolejny etap przywraca ustalony wcześniej podział: Linia po dwóch punktach
kończy odcinek i czeka na nowy początek. Polilinia kontynuuje od ostatniego końca.
Obie są w sekcji Tworzenie szkicu; skrót L pozostaje przy Linii. Zgodność
z wcześniejszym zachowaniem Linii jest dostępna w ustawieniach szkicu
(Kontynuuj linię od ostatniego punktu). Zmiana dotyczy także trybu szkicu 3D.

Polilinia używa wspólnego silnika geometrii, przyciągania i wpisywania wymiarów;
nie zmienia formatu projektu. Jej opcjonalne przejście w łuk styczny zachowuje
wspólne punkty i powrót do właściwego narzędzia. Programistyczne sketch.line
nadal przyjmuje wielopunktową listę, więc istniejące skrypty pozostają zgodne.
Nowe sketch.polyline ma kontrakt wejścia i wyjścia. Weryfikacja tego etapu
jest zapisywana osobno w target/sketch-workflow.

Przyjazne komunikaty błędów wyrażeń są również pokazywane przy wpisywaniu
rozmiaru w szkicu (np. Długość), w powiadomieniu na widoku. Oryginalny komunikat
pozostaje w historii diagnostycznej; zmieniana jest jego prezentacja.

Do tej pory w tym etapie przeszły 32 wybrane sprawdzenia UI/kontraktu
(każde uruchomione osobno) oraz 15 testów wpisywanych i automatycznych wymiarów.
Są wśród nich trzy istniejące scenariusze: profil z więzami, rura na polilinii
3D i narożne przyciski zatwierdzania. Scenariusz 3D wybiera przełącznik przez
stały identyfikator, dzięki czemu nie zależy od polskiego/angielskiego napisu.
Kontrola kompletności paska wykryła i usunęła pozostałą deklarację miejsca
komendy slicera na pasku; komenda nadal jest dostępna programistycznie.
