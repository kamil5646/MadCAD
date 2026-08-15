export const FIRST_PART_TUTORIAL = Object.freeze({
  pl: Object.freeze({
    title: 'Pierwszy projekt CAD',
    intro: 'Przejdź drogę od dokładnego szkicu 2D do parametrycznego modelu i pliku STEP. Druk 3D jest opcjonalnym dodatkiem.',
    steps: Object.freeze([
      ['1. Nowy projekt', 'Utwórz nowy projekt i nadaj mu rozpoznawalną nazwę.'],
      ['2. Szkic bazowy', 'Wybierz XY, narysuj zamknięty prostokąt i wpisz dokładne wymiary w milimetrach.'],
      ['3. Pełne związanie', 'Dodaj wymiary i więzy. Przed modelowaniem sprawdź stan „W pełni związany”.'],
      ['4. Bryła', 'Zakończ szkic, zaznacz profil i użyj Wyciągnij. Wpisz odległość oraz zatwierdź operację.'],
      ['5. Otwór', 'Zaznacz górną płaską ścianę i dwie prostopadłe krawędzie. Utwórz otwór z parametrycznymi odsunięciami.'],
      ['6. Kontrola', 'Użyj Zmierz, Masa i Analiza. Napraw błędy historii lub utracone referencje przed eksportem.'],
      ['7. Eksport CAD', 'Zapisz dokładną bryłę jako STEP do dalszej pracy i wymiany z innymi programami CAD.'],
      ['8. Opcjonalny druk 3D', 'Jeśli chcesz drukować model, otwórz Eksport, wybierz Kontrolę druku i dopiero wtedy wyeksportuj 3MF lub STL.'],
    ]),
    limitationsTitle: 'Znane ograniczenia',
    limitations: Object.freeze([
      'DWG jest konwertowany lokalnie do DXF przez zainstalowany GNU LibreDWG lub ODA File Converter; złożone obiekty niestandardowe mogą zostać pominięte przez wybrany konwerter.',
      'STEP zachowuje dokładną geometrię B-Rep. STL i 3MF wczytują się jako natywne siatki do pomiaru, transformacji i eksportu; operacje na ścianach i krawędziach wymagają B-Rep.',
      'Analiza drukowalności wskazuje ryzyko, ale nie gwarantuje poprawnego wydruku na konkretnej drukarce i materiale.',
      'Przekazanie do slicera wymaga zainstalowanego Bambu Studio, PrusaSlicer albo Cura.',
      'Bardzo złożona zmiana historii może wymagać ręcznego przypisania utraconej referencji B-Rep.',
    ]),
    close: 'Zamknij samouczek',
  }),
  en: Object.freeze({
    title: 'Your first CAD project',
    intro: 'Go from an exact 2D sketch to a parametric model and STEP file. 3D printing remains an optional extra.',
    steps: Object.freeze([
      ['1. New project', 'Create a new project and give it a recognizable name.'],
      ['2. Base sketch', 'Choose XY, draw a closed rectangle, and enter exact dimensions in millimeters.'],
      ['3. Fully constrain', 'Add dimensions and constraints. Confirm “Fully constrained” before modeling.'],
      ['4. Body', 'Finish the sketch, select the profile, and use Extrude. Enter the distance and confirm the operation.'],
      ['5. Hole', 'Select the top planar face and two perpendicular edges. Create a hole with parametric offsets.'],
      ['6. Inspect', 'Use Measure, Mass, and Analysis. Repair history errors or lost references before export.'],
      ['7. CAD export', 'Save the exact solid as STEP for continued work and exchange with other CAD applications.'],
      ['8. Optional 3D print', 'If you want to print the model, open Export, choose Print Check, and only then export 3MF or STL.'],
    ]),
    limitationsTitle: 'Known limitations',
    limitations: Object.freeze([
      'DWG is converted locally to DXF through an installed GNU LibreDWG or ODA File Converter; complex custom entities may be skipped by the selected converter.',
      'STEP preserves exact B-Rep geometry. STL and 3MF load as native meshes for measurement, transforms, and export; face and edge operations require B-Rep.',
      'Printability analysis identifies risk; it cannot guarantee a successful print for a specific printer and material.',
      'Slicer handoff requires Bambu Studio, PrusaSlicer, or Cura to be installed.',
      'A very complex history change may require manual reassignment of a lost B-Rep reference.',
    ]),
    close: 'Close tutorial',
  }),
});

export function tutorialForLanguage(language) {
  return FIRST_PART_TUTORIAL[String(language || '').toLowerCase().startsWith('en') ? 'en' : 'pl'];
}
