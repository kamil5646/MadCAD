# Otwory i gwinty normowane

Stan implementacji: P1.32b.

MadCAD pozwala tworzyć otwory przejściowe oraz gwintowane z jednego wyboru rozmiaru. Dane normowane są odseparowane od interfejsu w `src/cad-core/hole-standards.js`, dzięki czemu ten sam zestaw wartości zasila formularz, walidację dokumentu, silnik B-Rep i dokumentację 2D.

## Obsługiwany zakres

- rozmiary metryczne od M1 do M56, ze skokiem zwykłym i wybranymi skokami drobnozwojnymi;
- otwory przejściowe ISO 273 w serii ciasnej, średniej i luźnej;
- gwinty wewnętrzne metryczne o skoku zwykłym oraz wybranych skokach drobnozwojnych;
- klasy tolerancji gwintu wewnętrznego 5H, 6H i 7H;
- gwint kosmetyczny albo modelowany;
- automatyczne oznaczenie, np. `M8×1.25 - 6H`, zachowywane po zapisie i ponownym otwarciu;
- skojarzony opis normy, klasy, średnicy wiertła i liczby otworów w tabeli otworów na rysunku.
- wewnętrzne gwinty stożkowe NPT od 1/16 do 3 cali oraz BSPT/Rc od 1/8 do 3 cali;
- rzeczywisty stożek średnicy 1:16 w przygotowaniu otworu i w modelowanym przebiegu gwintu;
- wybór przygotowania stożkowego albo walcowego, liczba zwojów na cal, oznaczenie oraz wymagana metoda kontroli sprawdzianem;
- opcjonalne, jawne odchyłki dolna/górna średnicy, zachowywane w projekcie i tabeli otworów.

Otwór przejściowy używa bezpośrednio wartości wybranej serii ISO 273. Dla gwintu metrycznego średnica wiertła jest praktyczną wartością startową obliczoną jako średnica nominalna minus skok. Dla NPT program podaje zalecenia walcowe i stożkowe, długość skrawania oraz minimalną głębokość dna z publicznej tabeli Gühring; dla BSPT/Rc podaje zalecane otwory pod gwint z publicznej tabeli Dormer Pramet. Wartości technologiczne nie zastępują decyzji technologa zależnej od materiału, narzędzia i wymaganej wysokości zwoju.

Odchyłki średnicy są danymi użytkownika, a nie kopiami tabel tolerancji z płatnych norm. Program wymaga podania kompletnej pary, sprawdza kolejność odchyłek i zapisuje ją w metadanych produkcyjnych. Dla gwintu rurowego kontrola gotowego gwintu pozostaje kontrolą właściwym sprawdzianem, a nie samym pomiarem otworu wstępnego.

## Źródła i granice zgodności

- [ISO 261](https://www.iso.org/standard/4165.html) — ogólny plan gwintów metrycznych;
- [ISO 273](https://www.iso.org/cms/live/live/es/sites/isoorg/contents/data/standard/00/41/4183.html?browse=tc) — serie otworów przejściowych;
- [ISO 724:2023](https://www.iso.org/cms/%20render/live/en/sites/isoorg/contents/data/standard/08/51/85104.html) — wymiary podstawowe gwintów metrycznych;
- [ISO 965-1:2026](https://www.iso.org/standard/87889.html) — system tolerancji gwintów metrycznych.
- [ASME B1.20.1](https://www.asme.org/codes-standards/find-codes-standards/b1201-pipe-threads-general-purpose-inch) — rodzina i oznaczenia NPT;
- [ISO 7-1](https://www.iso.org/standard/20819.html) oraz [ISO 7-2](https://www.iso.org/standard/20820.html) — rodzina Rc/BSPT i kontrola sprawdzianami;
- [Gühring — Tapping size holes for thread cutting](https://guhring.com/media/support/Tapping-Size-Holes-For-Thread-Cutting.pdf) — publiczne zalecenia przygotowania NPT oraz rozszerzona lista rozmiarów metrycznych;
- [Dormer Pramet — Výroba závitů](https://api.dormerpramet.com/medias/Technick-plak-t-V-ROBA-Z-VIT-.pdf?attachment=true) — publiczna tabela rozmiarów, TPI i otworów przygotowawczych Rc/BSPT.

MadCAD nie dołącza ani nie odtwarza płatnych tabel normatywnych ASME/ISO. Oznaczenie standardu wskazuje rodzinę geometrii, a wartości otworu przygotowawczego są jawnie opisanymi zaleceniami producentów narzędzi. Wymagania odbiorowe, zakres sprawdzianu i tolerancje gwintu trzeba potwierdzić w legalnie posiadanym wydaniu właściwej normy oraz w planie kontroli części.

## Weryfikacja

Uruchom:

```bash
npm test -- --run src/cad-core/hole-standards.test.js src/modeling/CommandDialog.test.jsx
npm run test:core
npm run verify:hole-standards
```

Ostatni scenariusz buduje model w prawdziwym oknie Electron, najpierw sprawdza M8×1.25–6H, a następnie zmienia ten sam otwór na NPT 1/8–27 ze stożkiem 1:16 i odchyłkami −0,05/+0,10 mm. Kontroluje gotowy stożkowy B-Rep, metadane produkcyjne, autozapis, ponowne otwarcie oraz brak poziomego przepełnienia panelu.
