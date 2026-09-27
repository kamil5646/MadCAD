# Sondowanie bazy CAM — ograniczenia przed implementacją

Stan: 2026-09-23. MadCAD **nie generuje jeszcze ruchów sondy ani nie ustawia
automatycznie offsetu maszyny**. Raport kolejnych Setupów wymaga ręcznego
potwierdzenia zera WCS przez operatora.

Fusion `Probe WCS` wybiera powierzchnię modelu lub półfabrykatu, generuje
operację sondowania i aktualizuje WCS na sterowaniu. Może też używać osobnego
WCS do dojazdu sondy. Jest to punkt odniesienia dla brakującego P5.5, a nie
deklaracja zgodności MadCAD.

Dla LinuxCNC oficjalna dokumentacja określa `G38.2` jako ruch ku detalowi,
który zatrzymuje program z błędem, jeśli nie wykryje styku przed końcem
zadanego odcinka. Wymaga skonfigurowanego sygnału `motion.probe-input`.
`G10 L20 Pn` zmienia układ współrzędnych tak, aby aktualna pozycja otrzymała
zadane współrzędne; `G54`–`G59` odpowiadają układom `P1`–`P6`.

Ważna pułapka kolejności: po udanym `G38.2` LinuxCNC zapisuje pozycję styku w
parametrach `#5061`–`#5069` bieżącego układu roboczego, a `#5070` sygnalizuje
powodzenie. `G10 L20` odnosi podane współrzędne do **aktualnej pozycji w chwili
wykonania**, nie automatycznie do zapamiętanego punktu styku. Po odsunięciu
sondy bezpośrednie `G10 L20` ustawiłoby więc bazę względem pozycji odsuniętej.
Implementacja musi obliczyć przesunięcie z zapisanego punktu kontaktu i
pozycji bieżącej albo ustawić bazę w kontrolowanym momencie przed odsunięciem;
oba warianty wymagają testu na konkretnym sterowaniu. Wynik sondowania jest w
aktualnym WCS, nie wprost w współrzędnych maszynowych. Fusion pozwala także
wybrać osobny WCS do prowadzenia sondy, co trzeba rozróżnić od WCS, który
operacja ma ustawić.

Przed dodaniem eksportu sondowania trzeba jawnie rozwiązać: kalibrację długości
sondy i promienia kulki, bezpieczny punkt startowy bez zakładania poprawnego
jeszcze WCS, ograniczony zasięg i prędkość pomiaru, odsunięcie po styku,
geometrię mocowania, zachowanie po braku sygnału/styku oraz zgodność z
konkretnym sterowaniem. Nie należy emitować tych ruchów przez istniejący
ogólny postprocesor CAM ani uznawać testu na makiecie za walidację obrabiarki.

## Kontrakt pierwszego pionowego etapu

Pierwszą strategią ma być **pomiar górnej powierzchni Z na LinuxCNC**, jako
osobna operacja Setupu, a nie fragment zwykłego frezowania ani program GRBL.
Pozostałe osie, kulka sondy przy pomiarze bocznym i inne sterowniki pozostają
oddzielnymi etapami. Parametry zapisane w projekcie: docelowy `G54`–`G59`,
współrzędna Z mierzonej powierzchni względem modelu, dodatnia maksymalna droga
pomiaru, dodatni posuw pomiaru i odsunięcia oraz identyfikator skalibrowanej
sondy. Eksport musi odrzucać brak tych danych, nieprawidłową geometrię Setupu,
nieobsługiwany postprocesor i próbę umieszczenia sondowania w automatycznym
programie skrawania bez jawnie sprawdzonego przejścia między operacjami.

Program nie może zakładać, że bieżący WCS Z jest prawidłowy: operator ustawia
sondę ręcznie nad wskazaną powierzchnią, sprawdza wolny pionowy tor i aktywny
sygnał sondy, a generator **nie emituje pierwszego automatycznego dojazdu**.
Kandydat LinuxCNC ma pracować w `G90`, obliczyć dolny punkt `G38.2` jako
bieżące Z w układzie roboczym minus maksymalna droga (parametr `#5422`),
zatrzymać wykonanie przy braku styku, a po potwierdzonym styku wykonać
`G10 L20 Pn Z...` **przed** odsunięciem. Wtedy aktualna pozycja styku, nie
pozycja po odsunięciu, otrzymuje współrzędną powierzchni. Odsunięcie przy
posuwie `G1` ma korzystać z już ustawionego Z i kończyć w `G90`; nie wolno
zostawić maszyny w `G91` po błędzie sondowania. Nie wolno automatycznie
anulować ani zgadywać korekcji długości sondy, `G52` lub `G92`: ich stan musi
być znany, zgodny z kalibracją i sprawdzony na sterowniku. `G38.2` wymaga
`motion.probe-input`, a sygnał już aktywny na starcie jest błędem LinuxCNC.
To jest projekt sekwencji, **nie gotowy program do uruchomienia**.

Kryteria odbioru przed udostępnieniem eksportu:

1. Testy czystej logiki i NC sprawdzają granice drogi/posuwu, wybór `P1`–`P6`,
   brak wrzeciona i niezamierzonego `G0`, zapis WCS dopiero po pomiarze oraz
   powrót przy posuwie bez zmiany trybu na przyrostowy.
2. Migracja starszego `.madcad`, walidacja danych, Undo/Redo, zapis/otwarcie,
   błąd, anulowanie i desktop E2E obejmują całą operację i jej podgląd; szablon
   nie może zachowywać nietrwałej referencji do wybranej powierzchni.
3. Interpreter LinuxCNC/symulator sprawdza składnię i stan modalny. Próby na
   **konkretnym sterowaniu** obejmują styk, brak styku, sygnał aktywny przed
   ruchem, niekalibrowaną długość, limity osi, odsunięcie oraz odczyt trwałego
   offsetu po ponownym uruchomieniu. Bez tych prób nie wolno oznaczyć P5.5 ani
   wydania jako ukończonych.

Źródła pierwotne:

- [Autodesk Fusion — Generate a Probe WCS operation](https://help.autodesk.com/cloudhelp/ENU/Fusion-CAM/files/MFG-PROBE-WCS.htm)
- [Autodesk Fusion — Probe WCS strategy](https://help.autodesk.com/cloudhelp/ENU/Fusion-CAM/files/MFG-PROBE-WCS-OVERVIEW.htm)
- [LinuxCNC — G-codes, G38.n i G10 L20](https://linuxcnc.org/docs/html/gcode/g-code.html)
- [LinuxCNC — Coordinate Systems](https://linuxcnc.org/docs/html/gcode/coordinates.html)
