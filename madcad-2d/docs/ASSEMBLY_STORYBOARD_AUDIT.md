# P1.35e — storyboard animacji złożenia

Storyboard rozwija istniejący, niedestrukcyjny `Exploded View`. Każda klatka zapisuje czas oraz stopień rozłożenia 0–100%, a odtwarzacz interpoluje je płynnie w aktualnym widoku Three.js. Transformacje projektowe wystąpień, jointy, kontakty, kolizje i historia modelu nie są modyfikowane.

## Zakres

- do 12 nazwanych storyboardów w projekcie i 120 klatek w każdym;
- czas trwania 0,1–300 s, przewijanie, Play/Stop oraz dodawanie i usuwanie klatek;
- trwały zapis w `.madcad`, zgodność starszych dokumentów bez pola `animationStoryboards`;
- Undo/Redo dla tworzenia, edycji i usuwania;
- PL/EN, dostępne nazwy kontrolek i zwarty panel wewnątrz istniejących narzędzi złożenia.
- niezależne przesunięcia XYZ wystąpień, zapis bieżącej kamery oraz opis kroku w każdej klatce;
- interpolacja położenia części, kamery i Exploded View pozostaje wyłącznie warstwą prezentacji.

## Granica

Ten etap animuje translację części oraz kamerę. Obrót części, animowane jointy, graficzne strzałki montażowe i eksport wideo pozostają kolejnymi rozszerzeniami i nie są przedstawiane jako gotowe.

## Weryfikacja

Test rdzenia sprawdza interpolację rozłożenia, przesunięć i kamery, limity, round-trip i operacje CRUD. Test komponentu sprawdza kontrolki, a `verify:components` tworzy dwie klatki, zapisuje ruch wybranej części, kamerę i opis, odtwarza rzeczywisty ruch wystąpień, wykonuje Undo/Redo i kontroluje panel oraz poziomy overflow.
