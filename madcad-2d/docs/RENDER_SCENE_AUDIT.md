# P1.35c — scena i render lokalny

## Zakres ukończony

- ustawienia sceny są częścią dokumentu `.madcad`, autozapisu, odzyskiwania i historii Undo/Redo;
- cztery presety środowiska: Studio, Warsztat, Światło dzienne i Noc;
- ręczna regulacja tła, światła otoczenia, głównego i wypełniającego, ekspozycji oraz kierunku światła;
- tonemapping ACES, miękkie cienie i opcjonalne podłoże w rzeczywistym widoku Three.js;
- lokalny eksport PNG z aktualnej kamery i wyglądu komponentów, bez siatki edycyjnej;
- wejście przez `ZARZĄDZAJ → Scena i render`, bez dodawania kolejnej zakładki głównej.

## Dowody odbioru

- test core sprawdza wartości domyślne, ograniczenia, round-trip i uzupełnienie starszego dokumentu v15;
- `npm run verify:render-scene` zmienia preset w uruchomionej aplikacji, sprawdza stan renderera, Undo/Redo, układ panelu i zapisuje prawdziwy PNG;
- artefakty kontroli: `artifacts/madcad-render-scene.png` i `artifacts/madcad-render-scene-export.png`.

## Następny zakres

P1.35d powinien dodać decals jako skojarzone obrazy nakładane na wskazaną ścianę. Plik źródłowy, transformacja UV, krycie i utracona referencja muszą być zapisane w projekcie; obraz nie może być mylony z materiałem całego komponentu.
