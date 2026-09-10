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

## Profile materiałów

Ten sam panel udostępnia cztery jawne profile analityczne: PLA, PETG, ASA/ABS i TPU. Wybór ustawia materiał, dyszę, minimalną ściankę, minimalny otwór i próg nawisu, a obok pokazuje orientacyjne zakresy temperatur oraz najważniejsze zalecenie. Profil nie zmienia drukarki ani liczby kopii i nie jest przedstawiany jako gotowy profil slicera. `verify:panels` przełącza renderowany interfejs na PETG i potwierdza widoczność zakresu 225–255°C.

## Mapa technologiczna

Przełącznik `Pokaż mapę` tworzy nieinteraktywną nakładkę na każdej bryle: zielony oznacza geometrię bez wykrytego ryzyka, pomarańczowy trójkąty przekraczające aktualny próg nawisu, a czerwony trójkąty zdegenerowane albo o odwróconej normalnej. Nakładka obraca się i skaluje razem z układem druku, lecz nie trafia do listy obiektów wybieralnych. Test desktopowy potwierdza jej obecność, liczbę nakładek i legendę; wynik wizualny zapisuje ten sam zrzut `artifacts/madcad-print-auto-orientation.png`.
