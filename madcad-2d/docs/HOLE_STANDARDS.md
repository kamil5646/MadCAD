# Otwory i gwinty normowane

Stan implementacji: P1.32a.

MadCAD pozwala tworzyć otwory przejściowe oraz gwintowane z jednego wyboru rozmiaru. Dane normowane są odseparowane od interfejsu w `src/cad-core/hole-standards.js`, dzięki czemu ten sam zestaw wartości zasila formularz, walidację dokumentu, silnik B-Rep i dokumentację 2D.

## Obsługiwany zakres

- rozmiary metryczne od M2 do M24 z listy wspólnych rozmiarów używanych przez aplikację;
- otwory przejściowe ISO 273 w serii ciasnej, średniej i luźnej;
- gwinty wewnętrzne metryczne o skoku zwykłym oraz wybranych skokach drobnozwojnych;
- klasy tolerancji gwintu wewnętrznego 5H, 6H i 7H;
- gwint kosmetyczny albo modelowany;
- automatyczne oznaczenie, np. `M8×1.25 - 6H`, zachowywane po zapisie i ponownym otwarciu;
- skojarzony opis normy, klasy, średnicy wiertła i liczby otworów w tabeli otworów na rysunku.

Otwór przejściowy używa bezpośrednio wartości wybranej serii ISO 273. Dla otworu gwintowanego średnica wiertła jest praktyczną wartością startową obliczoną jako średnica nominalna minus skok. Nie zastępuje ona tabel producenta narzędzi ani decyzji technologa zależnej od materiału, wymaganej procentowej wysokości zwoju i procesu wykonania.

## Źródła i granice zgodności

- [ISO 261](https://www.iso.org/standard/4165.html) — ogólny plan gwintów metrycznych;
- [ISO 273](https://www.iso.org/cms/live/live/es/sites/isoorg/contents/data/standard/00/41/4183.html?browse=tc) — serie otworów przejściowych;
- [ISO 724:2023](https://www.iso.org/cms/%20render/live/en/sites/isoorg/contents/data/standard/08/51/85104.html) — wymiary podstawowe gwintów metrycznych;
- [ISO 965-1:2026](https://www.iso.org/standard/87889.html) — system tolerancji gwintów metrycznych.

Obecny etap nie obejmuje całych płatnych treści norm, wszystkich rozmiarów specjalnych, tolerancji wykonawczych średnicy wiertła ani gwintów stożkowych NPT/BSPT. Te elementy pozostają zakresem P1.32b. Użytkownik powinien potwierdzić wymagania wykonawcze w legalnie posiadanym wydaniu właściwej normy.

## Weryfikacja

Uruchom:

```bash
npm test -- --run src/cad-core/hole-standards.test.js src/modeling/CommandDialog.test.jsx
npm run test:core
npm run verify:hole-standards
```

Ostatni scenariusz buduje model w prawdziwym oknie Electron, zmienia istniejący otwór na M8×1.25–6H, sprawdza średnicę 6,75 mm, gotowy B-Rep, metadane produkcyjne, autozapis, ponowne otwarcie oraz brak poziomego przepełnienia panelu.
