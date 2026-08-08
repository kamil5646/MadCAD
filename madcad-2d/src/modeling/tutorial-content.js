export const FIRST_PART_TUTORIAL = Object.freeze({
  pl: Object.freeze({
    title: 'Pierwsza część do druku',
    intro: 'Przejdź tę ścieżkę od pustego dokumentu do sprawdzonego pliku 3MF w skali 1:1.',
    steps: Object.freeze([
      ['1. Nowy projekt', 'Utwórz nowy projekt i nadaj mu rozpoznawalną nazwę.'],
      ['2. Szkic bazowy', 'Wybierz XY, narysuj zamknięty prostokąt i wpisz dokładne wymiary w milimetrach.'],
      ['3. Pełne związanie', 'Dodaj wymiary i więzy. Przed modelowaniem sprawdź stan „W pełni związany”.'],
      ['4. Bryła', 'Zakończ szkic, zaznacz profil i użyj Wyciągnij. Wpisz odległość oraz zatwierdź operację.'],
      ['5. Otwór', 'Zaznacz górną płaską ścianę i dwie prostopadłe krawędzie. Utwórz otwór z parametrycznymi odsunięciami.'],
      ['6. Kontrola', 'Użyj Zmierz, Masa i Analiza. Napraw błędy historii lub utracone referencje przed eksportem.'],
      ['7. Przygotowanie druku', 'Otwórz Druk 3D, wybierz profil drukarki, ustaw część płaską ścianą na stole i uruchom analizę drukowalności.'],
      ['8. Zapis i eksport', 'Zapisz projekt .madcad, otwórz go ponownie, a następnie wyeksportuj 3MF lub STL w skali 1:1.'],
    ]),
    limitationsTitle: 'Znane ograniczenia wersji alpha',
    limitations: Object.freeze([
      'Revolve, Sweep, Loft, Draft, Rib, Coil i Pipe pozostają poza zakresem P0.',
      'STEP zachowuje dokładną geometrię. STL i 3MF są siatkami, dlatego ich późniejsza edycja parametryczna jest ograniczona.',
      'Analiza drukowalności wskazuje ryzyko, ale nie gwarantuje poprawnego wydruku na konkretnej drukarce i materiale.',
      'Przekazanie do slicera wymaga zainstalowanego Bambu Studio, PrusaSlicer albo Cura.',
      'Bardzo złożona zmiana historii może wymagać ręcznego przypisania utraconej referencji B-Rep.',
      'Instalatory desktopowe są przygotowywane dla Windows i macOS; Linux ma testy core/build, ale nie ma instalatora P0.',
    ]),
    close: 'Zamknij samouczek',
  }),
  en: Object.freeze({
    title: 'Your first printable part',
    intro: 'Follow this path from an empty document to a checked, full-scale 3MF file.',
    steps: Object.freeze([
      ['1. New project', 'Create a new project and give it a recognizable name.'],
      ['2. Base sketch', 'Choose XY, draw a closed rectangle, and enter exact dimensions in millimeters.'],
      ['3. Fully constrain', 'Add dimensions and constraints. Confirm “Fully constrained” before modeling.'],
      ['4. Body', 'Finish the sketch, select the profile, and use Extrude. Enter the distance and confirm the operation.'],
      ['5. Hole', 'Select the top planar face and two perpendicular edges. Create a hole with parametric offsets.'],
      ['6. Inspect', 'Use Measure, Mass, and Analysis. Repair history errors or lost references before export.'],
      ['7. Prepare for printing', 'Open 3D Print, choose a printer profile, place a planar face on the bed, and run printability analysis.'],
      ['8. Save and export', 'Save the .madcad project, reopen it, then export 3MF or STL at 1:1 scale.'],
    ]),
    limitationsTitle: 'Known alpha limitations',
    limitations: Object.freeze([
      'Revolve, Sweep, Loft, Draft, Rib, Coil, and Pipe are outside the P0 scope.',
      'STEP preserves exact geometry. STL and 3MF are meshes, so later parametric editing is limited.',
      'Printability analysis identifies risk; it cannot guarantee a successful print for a specific printer and material.',
      'Slicer handoff requires Bambu Studio, PrusaSlicer, or Cura to be installed.',
      'A very complex history change may require manual reassignment of a lost B-Rep reference.',
      'Desktop installers target Windows and macOS; Linux has core/build coverage but no P0 installer.',
    ]),
    close: 'Close tutorial',
  }),
});

export function tutorialForLanguage(language) {
  return FIRST_PART_TUTORIAL[String(language || '').toLowerCase().startsWith('en') ? 'en' : 'pl'];
}
