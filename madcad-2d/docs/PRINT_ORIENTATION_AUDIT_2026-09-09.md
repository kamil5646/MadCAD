# Audyt automatycznej orientacji druku 3D — 2026-09-09

## Zakres

Panel `Druk 3D` potrafi automatycznie wybrać ułożenie bez wcześniejszego wskazywania ściany. Algorytm grupuje dominujące kierunki trójkątów rzeczywistej siatki, porównuje maksymalnie 24 reprezentatywne ułożenia i ocenia:

- dopasowanie całego układu kopii do objętości drukarki;
- pole powierzchni opartej na stole;
- pole nawisów przekraczających ustawiony próg;
- wysokość modelu po obrocie.

Wybrany wariant zeruje ręczne obroty, zachowuje skalę, liczbę kopii i odstęp, kładzie najniższy punkt na `Z = 0` oraz centruje cały układ na stole. Ręczne `Połóż ścianą na stole` i pola XYZ pozostają dostępne.

## Weryfikacja

- test rdzenia sprawdza prostopadłościan 30 × 20 × 10 mm w skali 0,5, wybór podstawy 150 mm², wysokość 5 mm i dokładne wycentrowanie;
- `verify:panels` tworzy rzeczywistą bryłę B-Rep, uruchamia przycisk w renderowanym interfejsie, sprawdza zapis skończonych parametrów, położenie na stole i brak poziomego przepełnienia;
- dowód wizualny: `artifacts/madcad-print-auto-orientation.png`.

Jest to rekomendacja przygotowawcza, nie obietnica poprawnego wydruku. Użytkownik nadal powinien zweryfikować podpory i ustawienia materiału w slicerze.
