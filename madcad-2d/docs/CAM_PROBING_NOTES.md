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

Przed dodaniem eksportu sondowania trzeba jawnie rozwiązać: kalibrację długości
sondy i promienia kulki, bezpieczny punkt startowy bez zakładania poprawnego
jeszcze WCS, ograniczony zasięg i prędkość pomiaru, odsunięcie po styku,
geometrię mocowania, zachowanie po braku sygnału/styku oraz zgodność z
konkretnym sterowaniem. Nie należy emitować tych ruchów przez istniejący
ogólny postprocesor CAM ani uznawać testu na makiecie za walidację obrabiarki.

Źródła pierwotne:

- [Autodesk Fusion — Generate a Probe WCS operation](https://help.autodesk.com/cloudhelp/ENU/Fusion-CAM/files/MFG-PROBE-WCS.htm)
- [Autodesk Fusion — Probe WCS strategy](https://help.autodesk.com/cloudhelp/ENU/Fusion-CAM/files/MFG-PROBE-WCS-OVERVIEW.htm)
- [LinuxCNC — G-codes, G38.n i G10 L20](https://www.linuxcnc.org/docs/scratch/html/gcode/g-code.html)
- [LinuxCNC — Coordinate Systems](https://linuxcnc.org/docs/html/gcode/coordinates.html)
