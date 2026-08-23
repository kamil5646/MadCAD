# Changelog

## Unreleased

- Uproszczono instalację bez certyfikatów: Windows otrzymuje instalator jednym kliknięciem bez uprawnień administratora i przenośny ZIP, a macOS polecany obraz DMG z przeciągnięciem aplikacji oraz awaryjny ZIP. Strona pobierania prowadzi bezpośrednio do właściwych paczek.
- Przebudowano wstążkę w stylu Worda i klasycznego AutoCAD-a: małe nazwy grup znajdują się na dole, sekcje rozdzielają lekkie pionowe linie, a druk 3D jest wyraźnie opisany jako dodatek.
- Usunięto kafelki nagłówków, panelowe gradienty oraz ciężkie ramki i cienie przycisków. Narzędzia mają płaski stan normalny, czytelne podświetlenie po najechaniu i bardziej warstwowe, kolorowe ikony.
- Odzyskany po awarii projekt jest teraz oznaczony stałym, czytelnym komunikatem z czasem autozapisu, informacją o użyciu kopii zapasowej i bezpośrednim przyciskiem zapisu projektu.
- Import 3D rozdziela teraz dokładny STEP od natywnych siatek STL/3MF. Siatki nie są już przepuszczane przez zawodną konwersję do B-Rep, dzięki czemu wczytują się szybciej, zachowują trójkąty i pozostają dostępne do pomiaru, transformacji oraz eksportu; otwarte i nie-manifoldowe STL mają bezpieczny tryb podglądu zamiast błędu importu.
- Przed importem sprawdzany jest format i rozmiar pliku, a okno pokazuje tryb geometrii, jednostkę, liczbę obiektów i trójkątów. Mieszane operacje B-Rep/siatka oraz niedostępny eksport STEP są blokowane z jasnym wyjaśnieniem.

## 6.3.0 (2026-08-15)

- Dodano lokalny import DWG do aktywnego szkicu przez wykryty GNU LibreDWG (`dwgread` lub `dwg2dxf`) albo ODA File Converter, bez wysyłania projektu do usługi sieciowej.
- Import DWG korzysta z bezpiecznego systemowego wyboru pliku, limitów 512 MB/64 MB, izolowanego katalogu tymczasowego i istniejącego importera DXF z kontrolą jednostek.

## 6.2.0 (2026-08-15)

- Dodano oficjalną paczkę Linux x64 w formacie AppImage, budowaną i sprawdzaną na Ubuntu razem z paczkami Windows i macOS.
- Rozszerzono aktualizator o wybór właściwego AppImage, obowiązkową weryfikację SHA-256, nadanie prawa uruchomienia i bezpieczne przekazanie pobranej paczki.
- Dodano test formatu ELF, minimalnego rozmiaru i sumy kontrolnej AppImage oraz smoke test instalatora Linux w CI.
- Usunięto brak instalatora Linux z listy ograniczeń i uzupełniono stronę projektu, README oraz plan wydania o trzecią oficjalną platformę.

## 6.1.9 (2026-08-15)

- Usunięto dolne paski z nazwami grup narzędzi, które zabierały wysokość obszaru roboczego i tworzyły zbędne wizualne podziały.
- Przyciski wstążki dopasowują teraz szerokość do pełnej nazwy polecenia; zwiększono minimalną szerokość, odstępy i czytelność etykiet bez pokazywania skrótów na powierzchni przycisków.

## 6.1.8 (2026-08-15)

- Usunięto wiersz poleceń z interfejsu; linia zachowuje bezpośredni przepływ `L` → klik początku → kierunek → długość → `Enter` z kompaktowym polem przy aktywnym narzędziu.
- Ograniczono skróty do podstawowego zestawu Autodesk Fusion (`L`, `R`, `C`, `T`, `O`, `P`, `M`, `I`, `E`, `Del`) i przeniesiono ich oznaczenia wyłącznie do podpowiedzi, bez etykiet na przyciskach.
- Przebudowano wstążkę zgodnie z hierarchią AutoCAD: najważniejsze polecenia mają duże przyciski, pozostałe mieszczą się w dwóch kompaktowych rzędach, a panele zachowują spokojne wspólne tło i kolorowe ikony bez ramek wokół symboli.
- Ikony narzędzi dostały techniczny styl duotone z wypełnieniem powierzchni, światłem i cieniem zamiast płaskiego jednoliniowego rysunku.
- Przeglądarka projektu jest domyślnie zwinięta, aby nowy dokument od razu oddawał więcej miejsca płótnu.
- Zmniejszono dolny obszar interfejsu po usunięciu wiersza poleceń i zachowano komunikaty jako małą nakładkę nad płótnem.
- Naprawiono pełne tłumaczenie angielskich etykiet dostępności po uproszczeniu podpowiedzi oraz rozszerzono automatyczny test przepływu szkicowania i skrótów.

## 6.1.7 (2026-08-15)

- Zablokowano przedwczesne zatwierdzanie operacji bryłowej do czasu ukończenia dokładnego podglądu B-Rep; przycisk pokazuje stan „Obliczanie…”, a test Rib/Web czeka na gotowy wynik zamiast zależeć od szybkości komputera.

## 6.1.6 (2026-08-15)

- Dodano stały, klikalny wiersz poleceń CAD: alias uruchamia polecenie po `Enter`, a po wskazaniu początku linii można wpisać jej długość i zatwierdzić ją `Enterem`.
- Zmniejszono paletę linii i polilinii; dokładne pola długości i kąta przeniesiono do zwijanej sekcji opcjonalnej, aby nie zasłaniała rysunku.
- Wzmocniono widoczną informację o snapie oraz zachowano kontekstowy przycisk **Usuń** i obsługę `Delete`/`Backspace` (`⌫` na macOS).
- Zmieniono mylący komunikat pustego szkicu z „W pełni związany” na „Pusty szkic · Dodaj geometrię”.
- Uporządkowano obszary **Projektuj / Narzędzia / Eksport**, skróty na wstążce, kompaktowe panele, samouczek CAD-first oraz nazewnictwo PL/EN.
- Naprawiono dobór paczki aktualizacji według platformy i architektury, w tym rozróżnienie macOS ARM64/x64, oraz odnajdywanie sumy SHA-256 w awaryjnym odczycie strony wydania.
- Aktualizator pokazuje prawidłowy komunikat, gdy istnieje nowsza wersja bez paczki dla bieżącej architektury, zamiast błędnie informować o aktualnej wersji.
- Rozszerzono testy aktualizatora i pełny test desktopowy o wiersz poleceń, wejście długości linii, widoczny snap, usuwanie, angielski interfejs, dostępność i eksporty STEP/STL/3MF.

## 6.1.5 (2026-08-15)

- Przebudowano płaską wstążkę na warstwowy interfejs CAD z osobnymi panelami narzędzi, subtelną głębią, czytelniejszymi granicami grup i mocniejszą hierarchią.
- Wyróżniono aktywny obszar roboczy oraz główne polecenia turkusowym akcentem, zachowując ciemną, techniczną stylistykę MadCAD.
- Dodano widoczne aliasy klawiaturowe bezpośrednio na przyciskach poleceń, niezależnie od pełnych opisów pokazywanych po najechaniu.
- Poprawiono stany aktywne, wciśnięte, najechane i wyłączone, nie zwiększając wysokości wstążki ani nie ograniczając pola roboczego.
- Sprawdzono układ w szerokim i wąskim oknie, przy powiększeniu 100–200% oraz w pełnym teście operacji CAD.

## 6.1.4 (2026-08-15)

- Poszerzono stronę startową, aby lepiej wykorzystywała szerokie okno i eksponowała podstawowe działania CAD.
- Przeniesiono logo MadCAD na sam koniec prawej strony górnego paska, z zachowaniem miejsca na systemowe przyciski okna.
- Naprawiono aktualizację wydań bez certyfikatu: aplikacja pobiera paczkę wyłącznie z zaufanego GitHub Release, sprawdza SHA-256, zapisuje ją w folderze Pobrane i otwiera do instalacji.
- Zachowano automatyczną podmianę podpisanej aplikacji macOS jako tryb dostępny po skonfigurowaniu Apple Team ID.
- Dodano test położenia logo, zwiększonej szerokości strony startowej i komunikatu przekazania zweryfikowanej paczki do instalatora systemu.

## 6.1.3 (2026-08-15)

- Dodano właściwą stronę startową prowadzącą najpierw do rysunku 2D albo otwarcia projektu, z czytelnym przepływem `Szkic 2D → model parametryczny → eksport`.
- Nowa instalacja otwiera pusty projekt zamiast przykładowej części, dzięki czemu strona startowa jest faktycznym pierwszym ekranem.
- Ujednolicono ikonę w aplikacji z oficjalną różową ikoną MadCAD używaną przez paczki macOS, Windows, stronę i favicon.
- Zmieniono hierarchię obszarów na **Projektuj / Narzędzia / Eksport**. STEP jest podstawową wymianą CAD, a STL, 3MF i kontrola druku pozostają dodatkami eksportowymi.
- Zaktualizowano komunikację produktu, stronę projektu, samouczek i plan rozwoju zgodnie z kierunkiem: klasyczne szkicowanie CAD uzupełnione parametrycznym modelowaniem 3D.
- Dodano test startowego doświadczenia obejmujący hierarchię treści, responsywność, dostępność, wspólną ikonę i przejście do szkicu.

## 6.1.2 (2026-08-13)

- Naprawiono widoczność snapu przed pierwszym kliknięciem i po zatwierdzeniu punktu; znacznik pokazuje teraz typ przyciągania, ma wyższy kontrast i pozostaje w granicach widoku.
- Dodano kontekstowy przycisk **Usuń** dla zaznaczonej geometrii szkicu.
- Dodano usuwanie zaznaczonych elementów klawiszami `Delete` oraz `Backspace`/`⌫` na macOS.
- Dodano automatyczny test widoczności snapu i usuwania linii z klawiatury.

## 6.1.1 (2026-08-13)

- Dodano wspólną ochronę niezapisanych zmian dla Nowy/Otwórz/Zamknij/Aktualizuj oraz prawdziwy stan `dirty` dokumentu.
- Połączono lokalny i plikowy autozapis z atomowym `primary`/`.bak`, odzyskiwaniem uszkodzonej sesji i czyszczeniem po poprawnym zapisie.
- Dodano widoczne sprawdzanie aktualizacji, pobieranie i instalację z kontrolą niezapisanych zmian.
- Paczki Windows i macOS są publikowane bez certyfikatu producenta na wyraźną decyzję właściciela; zachowano pełne testy platformowe i sumy SHA-256, a dokumentacja oraz aplikacja ostrzegają o komunikatach SmartScreen/Gatekeeper.
- Usunięto nieużywany instalator ODA, konwersję DWG i pięć zbędnych kanałów IPC, które pozwalały pobrać lub uruchomić zewnętrzny instalator.
- Naprawiono bezpieczne przejście z okna licencji do strony projektu oraz udostępniono pełną licencję lokalnie w aplikacji.
- Dodano wybór PL/EN zgodny z językiem systemu oraz test przełączenia najważniejszego przepływu.
- Przeniesiono dokładną analizę kolizji na żądanie i dodano szeroką fazę AABB.
- Podzielono duży bundle na ładowane na żądanie fragmenty widoku 3D, importu 3MF i eksportu STL; największy fragment JS ma mniej niż 500 kB.
- Rozszerzono desktop E2E o utratę danych, dostępność axe, responsywność 100–200%, licencję, tooltipy i zrzuty najważniejszych stanów.
- Dodano progi pokrycia rdzenia, CodeQL, Dependabot, CODEOWNERS, politykę bezpieczeństwa i przypięte wersje GitHub Actions.
- Poprawiono panel utraconych referencji i dostępność przewijanej wstążki na wąskim oknie.

## 6.1.0 (2026-08-11)

- Dodano wejście dynamiczne w stylu AutoCAD dla linii: kliknięcie ustala początek, kursor kierunek, a wpisana długość zatwierdzona Enterem tworzy dokładny odcinek.
- Dodano podpowiedzi funkcji po najechaniu lub ustawieniu fokusu: każda funkcja pokazuje opis działania i skrót, a aliasy CAD można wpisywać z klawiatury i zatwierdzać Enterem albo spacją.
- Wprowadzono MadCAD Personal and Commercial License 3.0: użytek prywatny jest bezpłatny bez limitu czasu, organizacje otrzymują 40 dni oceny, a późniejszy użytek komercyjny wymaga bezterminowej licencji na stanowisko.
- Dodano wyświetlane przy każdym uruchomieniu przypomnienie o licencji prywatnej i dobrowolnym wsparciu projektu.
- Rozszerzono szkicowanie bezpośrednio myszą: figury powstają z kolejnych wskazań na płótnie, a formularz pozostaje opcjonalnym wejściem dokładnym.
- Usunięto stary interfejs 2D oraz jego nieużywaną warstwę CSS i kod uruchomieniowy.
- Usunięto aktywację tokenem, identyfikator urządzenia i okno licencyjne wyświetlane przy starcie.
- Dodano proste okno informacji o licencji bez klucza oraz poprawiono integrację nowego interfejsu z menu desktopowym.
- Przebudowano stronę GitHub Pages, README, dokumentację prawną i opisy wydania dla stabilnej wersji 6.1.
- Usunięto nieużywany generator tokenów, panel administratora, rejestr licencji i worker Cloudflare.

## 6.0.1 (2026-08-11)

- Naprawiono tryb przypomnienia licencyjnego: kontrolki są aktywne, aplikacja pozostaje odblokowana,
  a test desktopowy potwierdza możliwość zamknięcia przypomnienia na macOS i Windows.
- Zaktualizowano Electron, electron-builder i Vite do wersji bez znanych podatności z bieżącego audytu npm.
- Ujednolicono bramki CI i wydania: lint, testy jednostkowe, audyt zależności, testy desktopowe,
  kontrola wersji tagu oraz kontrola pochodzenia tagu z gałęzi `main`.

## 6.0.0 (2026-08-10)

- Zmieniono model licencji na tryb przypomnienia licencyjnego: aplikacja pozostaje w pełni odblokowana,
  ale przy starcie pokazuje nieblokujące okno przypominające o wsparciu projektu i opcjonalnej aktywacji tokenu.
- Ujednolicono opisy/licencję w UI i dokumentacji do nowego modelu przypomnienia.
- Poprawiono responsywny układ interfejsu, aby elementy ribbonu i górnego paska nie nachodziły na siebie
  przy mniejszych szerokościach i wysokościach okna.

## 5.7.2 (2026-08-10)

- Tymczasowo wyłączono wymóg licencji: aplikacja startuje w pełni odblokowana,
  bez ekranu aktywacji tokenu (kod licencjonowania pozostaje w repo do
  ponownego włączenia w przyszłości).
- Naprawiono komunikat startowy i cykliczną walidację online, aby nie
  próbowały ponownie blokować sesji, gdy licencjonowanie jest wyłączone.

## 5.7.1 (2026-08-10)

- Naprawiono zduplikowany klucz tłumaczenia w silniku CAD (mogło nadpisywać poprawny komunikat).
- Dodano bramkę jakości w CI (lint + testy dla aplikacji i backendu rejestru licencji) przed wydaniem.
- Usunięto nieużywane pliki debugowe pozostawione w repozytorium.

## 5.7.0 (2026-08-04)

- Dodano dodatkowy widok przygotowania projektu do druku 3D bez usuwania narzędzi CAD 2D.
- Dodano wyciąganie prostokątów, okręgów i zamkniętych obszarów 2D do brył 3D.
- Dodano interaktywny podgląd modelu, kontrolę wymiarów stołu drukarki i eksport STL w milimetrach.
- Moduł 3D jest ładowany na żądanie, aby nie obciążać podstawowego trybu 2D.

## 5.6.4 (2026-05-04)

- Naprawiono przeciąganie okna aplikacji na Windowsie po ukryciu natywnego paska tytułu.
- Dodano widoczny górny obszar przeciągania z odstępem na systemowe przyciski okna.

## 3.1.5 (2026-03-08)

- Podbito wersję release po poprawkach instalatora aktualizacji na macOS.
- Zachowano wzmocniony mechanizm auto-update z logowaniem, retry i bezpiecznym restartem aplikacji.

## 3.1.4 (2026-03-07)

- Wzmocniono instalator aktualizacji na macOS.
- Dodano log plikowy aktualizatora, oczekiwanie na pełne zamknięcie procesu oraz ponawianie podmiany aplikacji.
- Usprawniono ponowne otwarcie aplikacji po udanej aktualizacji.

## 3.1.3 (2026-03-07)

- Usprawniono aktualizator aplikacji i dodano automatyczne sprawdzanie przy starcie.
- Dodano pytanie o instalację, gdy nowa wersja jest dostępna po uruchomieniu programu.
- Naprawiono czytelność komunikatów aktualizatora oraz usunięto fałszywy status `offline` przy starcie.
- Ujednolicono panel `Zapisz/Drukuj` z resztą interfejsu wstążki.

## 3.1.2 (2026-03-06)

### Dodano / zmieniono
- Ujednolicono zachowanie paska okna dla macOS i Windows (kontrolki natywne, bez zbędnego pustego pasa).
- Dopracowano układ górnej wstążki tak, aby nie kolidował z kontrolkami okna.
- Dodano autozapis awaryjny sesji (desktop) i automatyczne przywracanie po nieoczekiwanym zamknięciu.

### Poprawki
- Aplikacja nie pyta już o zapis przy wyjściu, gdy rysunek jest pusty.
- Poprawiono logikę podglądu i wydruku PDF: spójna skala między podglądem i finalnym PDF.
- Usunięto problem pustej drugiej strony przy wydruku.

### Artefakty release
- `MadCAD 2D-3.1.2-mac-arm64.zip`
- `MadCAD 2D-3.1.2-win-x64.exe`

## 3.1.1 (2026-03-04)

### Dodano / zmieniono
- Ujednolicono obsługę DWG w menu `Zapisz/Drukuj` dla importu i eksportu.
- Gdy ODA nie jest dostępne, pozycje DWG pokazują komunikat o braku dodatku i możliwość instalacji.
- Pozycje DWG przeniesiono na sam dół menu `Zapisz/Drukuj`.
- Dodano czytelniejszy przepływ instalacji ODA (status/komunikaty podczas akcji).

### Poprawki
- Usunięto pytanie onboardingowe o DWG przy starcie aplikacji.
- Usprawniono instalację ODA na macOS (lepsza walidacja i obsługa błędów).
- Dodano automatyczną instalację ODA także dla Windows (MSI) + fallback lokalny.
- Dodano fallback kompatybilności, gdy automatyczny bridge instalacji nie jest dostępny.

### Artefakty release
- `MadCAD 2D-3.1.1-mac-arm64.zip`
- `MadCAD 2D-3.1.1-win-x64.exe`
