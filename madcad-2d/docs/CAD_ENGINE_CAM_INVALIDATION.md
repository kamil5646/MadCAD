# Przeliczanie CAD po zmianach CAM

## Zasada

`useCadEngine` oblicza podpis dokumentu geometrii z pominięciem `manufacturing`
i `metadata`. Te pola nie wpływają na `prepareDocument` ani na modelowanie
w workerze CAD. Zmiana operacji, uchwytów lub innych ustawień CAM aktualizuje
dokument dostępny w interfejsie, ale nie uruchamia ponownie OpenCascade,
siatkowania i osi czasu modelu. Tak samo identyczna geometria po ponownym
otwarciu autozapisu korzysta z gotowego wyniku. Zmiana szkicu, cechy,
referencji lub innego pola geometrii nadal rozpoczyna nową rewizję workera.

Wynik trwającego przeliczenia jest wiązany z najnowszym dokumentem tylko wtedy,
gdy jego podpis geometrii nadal jest taki sam. Gdy geometria zmieniła się w
międzyczasie, stary wynik nie zastępuje nowszego modelu. Restart workera nadal
wymusza obliczenie niezależnie od podpisu.

## Kontrola regresji

- `npm run test:core` sprawdza, że CAM i metadane nie zmieniają podpisu,
  a edycja cechy go zmienia; testuje też blokadę eksportu NC przy kolizji
  obróconej szczęki.
- `npm run verify:manufacturing` sprawdza w aplikacji, że seria zmian CAM,
  cofnięcie i ponowienie nie podnoszą rewizji silnika CAD.
- `npm run verify:modeling` sprawdza, że edycje geometrii nadal przeliczają
  bryły, a ponowne otwarcie modelu zachowuje geometrię i identyfikatory.
- `npm run verify:large-project-corpus` sprawdza trzy projekty po 220 cech,
  w tym odzyskanie workera po awarii.

Podpis jest obecnie tworzony przez serializację dokumentu przy zmianie jego
obiektu. To koszt w wątku interfejsu; przy bardzo dużych projektach warto
zmierzyć go osobno przed zastąpieniem strukturalnym licznikiem rewizji. Nie
wolno wyłączyć przeliczania dla pola, które zacznie wpływać na `prepareDocument`
lub worker CAD — wtedy należy zaktualizować podpis i testy.

CI `35853142356` na macOS zgłosiło w teście modelowanego gwintu status
`ready` i nową rewizję, ale odczyt objętości w tej chwili odpowiadał jeszcze
otworowi bez rowków. Lokalny pełny scenariusz przechodził. Test czeka teraz
również na właściwą objętość bryły i przy przekroczeniu czasu zapisuje stan
silnika, osi czasu oraz diagnostykę. W CI `35854165469` pełny scenariusz
`verify-modeling` przeszedł na macOS i Windows, ale następny
`verify-large-projects` na obu systemach nadal oczekiwał zwiększenia rewizji
po otwarciu identycznego autozapisu. Oczekiwanie zmieniono na zachowanie tej
samej rewizji i objętości przy 220 operacjach; lokalny scenariusz przeszedł.
Pełny CI `35905193839` dla commitu `8dacfd3` potwierdził zmianę na macOS i
Windows: oba pełne shardy modelowania oraz wszystkie instalatory przeszły,
łącznie 19/19 zadań. CodeQL `35905193939` również przeszedł. Kolejny commit
zmienia podział shardów, więc jego macierz wymaga osobnego potwierdzenia.
