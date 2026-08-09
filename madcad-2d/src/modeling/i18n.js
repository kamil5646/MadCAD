const ENGLISH_TEXT = Object.freeze({
  'PROJEKT': 'PROJECT',
  'SZKICUJ': 'SKETCH',
  'UTWÓRZ': 'CREATE',
  'EDYTUJ': 'EDIT',
  'SZKIC': 'SKETCH',
  'WIĘZY': 'CONSTRAINTS',
  'WYMIARY': 'DIMENSIONS',
  'PRZYGOTUJ': 'PREPARE',
  'EKSPORT': 'EXPORT',
  'ZMIANA': 'MODIFY',
  'KONSTRUKCJA': 'CONSTRUCTION',
  'WSTAW': 'INSERT',
  'WYBIERZ': 'SELECT',
  'PRZEGLĄDARKA': 'BROWSER',
  'PALETA SZKICU': 'SKETCH PALETTE',
  'MODEL': 'MODEL',
  'NARZĘDZIA': 'TOOLS',
  'DRUK 3D': '3D PRINT',
  'Dokumentacja': 'Documentation',
  'Samouczek': 'Tutorial',
  'Samouczek pierwszej części': 'First part tutorial',
  'Parametry modelu': 'Model parameters',
  'Początek': 'Origin',
  'Konstrukcja': 'Construction',
  'Szkice': 'Sketches',
  'Bryły': 'Bodies',
  'Bez nazwy': 'Untitled',
  'Linia': 'Line',
  'Polilinia': 'Polyline',
  'Łuk styczny': 'Tangent arc',
  'Łuk': 'Arc',
  'Prostokąt': 'Rectangle',
  'Okrąg': 'Circle',
  'Wielokąt': 'Polygon',
  'Elipsa': 'Ellipse',
  'Punkt': 'Point',
  'Wybierz': 'Select',
  'Fillet szkicu': 'Sketch fillet',
  'Faza szkicu': 'Sketch chamfer',
  'Transformuj': 'Transform',
  'Szyk szkicu': 'Sketch pattern',
  'Typ szyku': 'Pattern type',
  'Prostokątny': 'Rectangular',
  'Kołowy': 'Circular',
  'Po ścieżce': 'Along path',
  'Ścieżka': 'Path',
  'Orientacja': 'Orientation',
  'Zgodnie ze ścieżką': 'Follow path',
  'Stała': 'Fixed',
  'Kolumny': 'Columns',
  'Wiersze': 'Rows',
  'Wystąpienia': 'Occurrences',
  'Kąt całkowity': 'Total angle',
  'Pomiń wystąpienia': 'Skip occurrences',
  'Przesuń': 'Move',
  'Usuń': 'Delete',
  'Współliniowe': 'Collinear',
  'Symetria': 'Symmetry',
  'Krzywizna G2': 'G2 curvature',
  'Ordinate X': 'Ordinate X',
  'Ordinate Y': 'Ordinate Y',
  'Długość łuku': 'Arc length',
  'Wymiar ordinate X': 'Ordinate X dimension',
  'Wymiar ordinate Y': 'Ordinate Y dimension',
  'Wymiar długości łuku': 'Arc length dimension',
  'Dodaj wymiar': 'Add dimension',
  'Wymiar steruje geometrią i można go później zmienić bezpośrednio na szkicu.': 'The dimension drives geometry and can be changed later directly in the sketch.',
  'Zakończ szkic': 'Finish sketch',
  'Kontrola druku': 'Print check',
  'Utwórz szkic': 'Create sketch',
  'Wyciągnij': 'Extrude',
  'Prymityw': 'Primitive',
  'Tekst 3D': '3D text',
  'Otwór': 'Hole',
  'Zaokrąglij': 'Fillet',
  'Fazuj': 'Chamfer',
  'Przesuń bryłę': 'Move body',
  'Obróć bryłę': 'Rotate body',
  'Edytuj': 'Edit',
  'Płaszczyzna offset': 'Offset plane',
  'Plane angle': 'Angle plane',
  'Plane tangent': 'Tangent plane',
  'Plane path': 'Path plane',
  'Płaszczyzna pod kątem': 'Angle plane',
  'Płaszczyzna styczna': 'Tangent plane',
  'Płaszczyzna na ścieżce': 'Path plane',
  'Oś obrotu': 'Rotation axis',
  'Powierzchnia': 'Surface',
  'Sfera': 'Sphere',
  'Walec': 'Cylinder',
  'Plane 3 punkty': '3-point plane',
  'Oś z krawędzi': 'Axis from edge',
  'Oś walca': 'Cylinder axis',
  'Oś 2 punkty': '2-point axis',
  'Oś przecięcia': 'Intersection axis',
  'Oś normalna': 'Normal axis',
  'Oś normalna do płaszczyzny': 'Axis normal to plane',
  'Punkt wierzchołka': 'Vertex point',
  'Punkt centrum': 'Center point',
  'Punkt przecięcia': 'Intersection point',
  'Punkt środkowy': 'Midpoint',
  'Punkt na osi': 'Point on axis',
  'Punkt osi X': 'Axis point X',
  'Punkt osi Y': 'Axis point Y',
  'Punkt osi Z': 'Axis point Z',
  'Odległość na osi': 'Distance along axis',
  'Parametry': 'Parameters',
  'Zmierz': 'Measure',
  'Przekrój': 'Section',
  'Masa': 'Mass',
  'Analiza': 'Analysis',
  'Import 3D': 'Import 3D',
  'Import SVG/DXF': 'Import SVG/DXF',
  'Import geometrii szkicu': 'Import sketch geometry',
  'Import SVG lub DXF do szkicu': 'Import SVG or DXF into sketch',
  'Plik': 'File',
  'Format': 'Format',
  'Wykryta jednostka': 'Detected unit',
  'Jednostka źródłowa': 'Source unit',
  'Automatycznie / z pliku': 'Automatic / from file',
  'Milimetry (mm)': 'Millimeters (mm)',
  'Centymetry (cm)': 'Centimeters (cm)',
  'Cale (in)': 'Inches (in)',
  'Metry (m)': 'Meters (m)',
  'Mikrometry (µm)': 'Micrometers (µm)',
  'Importuj do szkicu': 'Import into sketch',
  'Linie, polilinie, prostokąty, okręgi i łuki zostaną dodane do aktywnego szkicu w milimetrach. Zamknięte pętle utworzą profile.': 'Lines, polylines, rectangles, circles, and arcs will be added to the active sketch in millimeters. Closed loops will create profiles.',
  'Druk 3D': '3D print',
  'Zacznij od szkicu': 'Start with a sketch',
  'Wybierz płaszczyznę, narysuj zamknięty profil i wyciągnij go w bryłę.': 'Choose a plane, draw a closed profile, and extrude it into a body.',
  'Wybierz płaszczyznę szkicu': 'Choose sketch plane',
  'Wskaż jedną z płaszczyzn początku.': 'Choose one of the origin planes.',
  'Góra (XY)': 'Top (XY)',
  'Przód (XZ)': 'Front (XZ)',
  'Prawo (YZ)': 'Right (YZ)',
  'GÓRA': 'TOP',
  'PRZÓD': 'FRONT',
  'PRAWO': 'RIGHT',
  'Bryła': 'Body',
  'Ściana': 'Face',
  'Krawędź': 'Edge',
  'Wierzchołek': 'Vertex',
  'Profil': 'Profile',
  'Nazwa': 'Name',
  'Wyrażenie': 'Expression',
  'Wartość': 'Value',
  'Odległość': 'Distance',
  'Odsunięcie początku': 'Start offset',
  'Długość': 'Length',
  'Szerokość': 'Width',
  'Wysokość': 'Height',
  'Głębokość': 'Depth',
  'Grubość': 'Thickness',
  'Promień': 'Radius',
  'Średnica': 'Diameter',
  'Kąt': 'Angle',
  'Położenie X': 'Position X',
  'Położenie Y': 'Position Y',
  'Położenie Z': 'Position Z',
  'Przesunięcie X': 'Offset X',
  'Przesunięcie Y': 'Offset Y',
  'Przesunięcie Z': 'Offset Z',
  'Obrót X': 'Rotation X',
  'Obrót Y': 'Rotation Y',
  'Obrót Z': 'Rotation Z',
  'Skala': 'Scale',
  'Kopie': 'Copies',
  'Odstęp': 'Spacing',
  'Własny': 'Custom',
  'Płaszczyzna': 'Plane',
  'Płaszczyzna A': 'Plane A',
  'Płaszczyzna B': 'Plane B',
  'Płaszczyzna bazowa': 'Base plane',
  'Obiekt docelowy': 'Target object',
  'Do obiektu': 'To Object',
  'Nowa bryła': 'New body',
  'Połącz': 'Join',
  'Odejmij': 'Cut',
  'Część wspólna': 'Intersect',
  'Objętość': 'Volume',
  'Pole': 'Area',
  'Środek masy': 'Center of mass',
  'Gęstość': 'Density',
  'Min. promień': 'Min. radius',
  'Min. ścianka': 'Min. wall',
  'Min. otwór': 'Min. hole',
  'Próg nawisu': 'Overhang threshold',
  'Układ części': 'Part layout',
  'Resetuj układ': 'Reset layout',
  'Połóż ścianą na stole': 'Place face on bed',
  'Analiza drukowalności': 'Printability analysis',
  'Program tnący': 'Slicer',
  'Otwórz STL w slicerze': 'Open STL in slicer',
  'Anuluj': 'Cancel',
  'Zastosuj': 'Apply',
  'Dodaj': 'Add',
  'Zamknij': 'Close',
  'Cofnij': 'Undo',
  'Ponów': 'Redo',
  'TYLKO ODCZYT': 'READ ONLY',
});

const ENGLISH_PHRASES = Object.freeze([
  [/Model gotowy/g, 'Model ready'],
  [/Podgląd gotowy/g, 'Preview ready'],
  [/Przeliczanie historii…/g, 'Recomputing history…'],
  [/Uruchamianie OpenCascade…/g, 'Starting OpenCascade…'],
  [/\b1 bryła\b/g, '1 body'],
  [/\b(\d+) brył\b/g, '$1 bodies'],
  [/Zaznacz płaską ścianę modelu, aby oprzeć ją na stole\./g, 'Select a planar model face to place it on the bed.'],
  [/Zaznaczona płaska ściana jest gotowa do orientacji\./g, 'The selected planar face is ready for orientation.'],
  [/Model mieści się na stole drukarki\./g, 'The model fits on the printer bed.'],
  [/Model przekracza obszar drukarki\./g, 'The model exceeds the printer bed.'],
  [/Nie wykryto problemów przy bieżących progach analizy\./g, 'No issues were detected with the current analysis thresholds.'],
  [/Nie wykryto wspólnej objętości pomiędzy bryłami\./g, 'No shared volume was detected between bodies.'],
  [/ błędów/g, ' errors'],
  [/ ostrzeżeń/g, ' warnings'],
]);

export function resolveModelingLanguage(documentLanguage, desktopLanguage) {
  const candidate = String(documentLanguage || desktopLanguage || '').toLowerCase();
  return candidate.startsWith('en') ? 'en' : 'pl';
}

export function translateModelingText(value, language = 'pl') {
  const source = String(value ?? '');
  if (language !== 'en' || !source.trim()) return source;
  const leading = source.match(/^\s*/)?.[0] || '';
  const trailing = source.match(/\s*$/)?.[0] || '';
  const normalized = source.trim();
  if (ENGLISH_TEXT[normalized]) return `${leading}${ENGLISH_TEXT[normalized]}${trailing}`;
  return ENGLISH_PHRASES.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), source);
}

function localizeElementAttributes(element, language) {
  if (!(element instanceof Element)) return;
  for (const attribute of ['aria-label', 'title', 'placeholder']) {
    const current = element.getAttribute(attribute);
    if (!current) continue;
    const translated = translateModelingText(current, language);
    if (translated !== current) element.setAttribute(attribute, translated);
  }
}

export function localizeModelingTree(root, language = 'pl') {
  if (!root || language !== 'en') return;
  localizeElementAttributes(root, language);
  root.querySelectorAll('*').forEach((element) => localizeElementAttributes(element, language));
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const translated = translateModelingText(node.nodeValue, language);
    if (translated !== node.nodeValue) node.nodeValue = translated;
    node = walker.nextNode();
  }
}

export function observeModelingLocalization(root, language = 'pl') {
  if (!root || language !== 'en' || typeof MutationObserver === 'undefined') return () => {};
  localizeModelingTree(root, language);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        const translated = translateModelingText(mutation.target.nodeValue, language);
        if (translated !== mutation.target.nodeValue) mutation.target.nodeValue = translated;
      } else {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const translated = translateModelingText(node.nodeValue, language);
            if (translated !== node.nodeValue) node.nodeValue = translated;
          } else if (node.nodeType === Node.ELEMENT_NODE) localizeModelingTree(node, language);
        });
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  return () => observer.disconnect();
}
