import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDotDashed,
  Copy,
  Cylinder,
  FileBox,
  FileDown,
  FilePlus2,
  FolderOpen,
  Frame,
  Grid2X2,
  HardDriveDownload,
  Hexagon,
  CircleHelp,
  Eye,
  EyeOff,
  Layers3,
  Maximize2,
  Minus,
  MoreHorizontal,
  MousePointer2,
  Move,
  Move3d,
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  Pencil,
  PencilRuler,
  Printer,
  Redo2,
  Rotate3d,
  RotateCw,
  Ruler,
  Save,
  ScanSearch,
  Scissors,
  Settings2,
  Shapes,
  SkipBack,
  Square,
  StepBack,
  StepForward,
  Triangle,
  Trash2,
  Type,
  Undo2,
  Variable,
  Upload,
  X,
} from 'lucide-react';
import madcadIconUrl from '../../assets/icons/madcad-512.png';
import {
  DOCUMENT_SCHEMA_VERSION,
  cloneDocument,
  createCircleProfile,
  createDocument,
  createFeature,
  createParameter,
  createRectangleProfile,
  createSketch,
  createStarterDocument,
  openDocument,
  touchDocument,
} from '../cad-core/document.js';
import {
  addDrivingSketchDimension,
  createSketchArc,
  createSketchConstraint,
  createSketchLine,
  createSketchPoint,
  createTangentArcContinuation,
  deleteSketchSelection,
  translateSketchSelection,
  upsertSketchProfile,
} from '../cad-core/sketch-model.js';
import {
  arcCenterStartEnd,
  arcThroughThreePoints,
  circleCenterRadius,
  circleThreePoints,
  circleTwoPoints,
  conicThroughControlPoint,
  ellipticalArcFromCenter,
  ellipseFromCenter,
  fitPointSpline,
  polygonFromEdge,
  rectangleFromCenter,
  rectangleThreePoints,
  rectangleTwoPoints,
  regularPolygon,
  controlPointSpline,
  slotCenterToCenter,
  slotArc,
  slotOverall,
  slotThreePoints,
} from '../cad-core/sketch-primitives.js';
import { refreshDetectedSketchProfiles } from '../cad-core/sketch-topology.js';
import { breakSketchEntity, chamferSketchLines, extendSketchEntity, filletSketchLines, offsetSketchEntities, offsetSketchProfile, trimSketchEntity } from '../cad-core/sketch-modifiers.js';
import { copySketchSelection, mirrorSketchSelection, rotateSketchSelection, scaleSketchSelection } from '../cad-core/sketch-transforms.js';
import { circularSketchPattern, pathSketchPattern, rectangularSketchPattern } from '../cad-core/sketch-patterns.js';
import { applySketchConstraintSolution, solveSketchConstraints, SKETCH_SOLVER_STATUS } from '../cad-core/sketch-solver.js';
import { evaluateExpression, resolveParameters } from '../cad-core/expressions.js';
import { useCadEngine } from '../cad-core/useCadEngine.js';
import { createTopologyReference, inspectTopologyReferences, reassignTopologyReference } from '../cad-core/topology-references.js';
import { createAnglePlane, createMidplane, createOffsetPlane, createPathPlane, createTangentPlane, createThreePointPlane, resolveConstructionPlane, resolveConstructionPlanes } from '../cad-core/construction-planes.js';
import { createCylinderAxis, createEdgeAxis, createPlaneIntersectionAxis, createPlaneNormalAxis, createTwoPointAxis, resolveConstructionAxis, resolveConstructionAxes } from '../cad-core/construction-axes.js';
import { createCenterPoint, createIntersectionPoint, createMidpointPoint, createPointOnAxis, createVertexPoint, resolveConstructionPoint, resolveConstructionPoints } from '../cad-core/construction-points.js';
import { projectTopologyToSketch, synchronizeProjectedGeometry } from '../cad-core/sketch-projection.js';
import { resolveFaceEdgeHolePlacement } from '../cad-core/face-edge-hole.js';
import { measureSelection } from '../cad-core/measure-selection.js';
import { calculateMassProperties } from '../cad-core/mass-properties.js';
import { summarizeGeometryInspection } from '../cad-core/geometry-inspection.js';
import { applyPrinterProfile, PRINTER_PROFILES } from '../cad-core/printer-profiles.js';
import { calculatePrintLayout, orientationForBedFace } from '../cad-core/print-layout.js';
import { inspectThreeMfArchive } from '../cad-core/three-mf.js';
import { formatModelFileSize, inspectModelImportBuffer, normalizeModelUnit } from '../cad-core/model-import.js';
import { analyzePrintability } from '../cad-core/print-analysis.js';
import { inspectSketchImport, parseSketchImport } from '../cad-core/sketch-import.js';
import {
  deleteTimelineFeatureCascade,
  dependentTimelineFeatureIds,
  moveTimelineFeature,
  renameTimelineFeature,
  setTimelineFeatureSuppressed,
} from '../cad-core/timeline-operations.js';
import { observeModelingLocalization, resolveModelingLanguage } from './i18n.js';
import { FirstPartTutorial, FullLicenseDialog, LicenseInfoDialog, UpdateDialog } from './AppDialogs.jsx';
import { CommandLine } from './CommandLine.jsx';
import { parseCommandLineInput } from './command-controller.js';
import { isDockableCommand, panelScreenKey, readPanelLayout, writePanelLayout } from './panel-layout.js';
import {
  AUTOSAVE_KEY,
  clearLocalAutosave,
  documentModifiedAt,
  hasUnsavedSession,
  loadInitialDocument,
  writeLocalAutosave,
} from './document-session.js';
import './modeling.css';

const ModelViewport = React.lazy(() => import('./ModelViewport.jsx'));
const DESKTOP_PLATFORM = ['darwin', 'win32', 'linux'].includes(window.desktopApp?.platform)
  ? window.desktopApp.platform
  : 'web';

const MAIN_TABS = [
  { id: 'solid', label: 'PROJEKTUJ' },
  { id: 'tools', label: 'NARZĘDZIA' },
  { id: 'print', label: 'EKSPORT' },
];
const LANGUAGE_KEY = 'madcad:interface-language';

function readStoredLanguage() {
  try {
    return window.localStorage.getItem(LANGUAGE_KEY);
  } catch (_error) {
    return null;
  }
}

const PLANE_LABELS = { XY: 'Góra (XY)', XZ: 'Przód (XZ)', YZ: 'Prawo (YZ)' };

const TOOL_DESCRIPTIONS = {
  'Utwórz szkic': 'Wybierz płaszczyznę i rozpocznij rysowanie profilu 2D.',
  'Prostokąt': 'Narysuj prostokątny profil, klikając środek i punkt rozmiaru.',
  'Okrąg': 'Narysuj okrąg, klikając środek i punkt promienia.',
  'Łuk': 'Utwórz dokładny łuk przez trzy punkty albo przez środek, początek i koniec.',
  'Wielokąt': 'Utwórz regularny wielokąt wpisany, opisany albo z zadanej krawędzi.',
  'Elipsa': 'Utwórz dokładną, obróconą elipsę z dwóch promieni.',
  'Slot': 'Utwórz zamknięty slot przez środki łuków albo długość całkowitą.',
  'Spline': 'Utwórz krzywą przez punkty dopasowania albo punkty kontrolne.',
  'Conic': 'Utwórz krzywą stożkową przez początek, punkt kontrolny i koniec.',
  'Punkt': 'Dodaj punkt referencyjny otworu albo punkt konstrukcyjny.',
  'Linia': 'Utwórz pojedynczy segment przez dwa punkty albo przez dokładną długość i kąt.',
  'Polilinia': 'Rysuj ciąg segmentów; kliknij punkt początkowy, aby zamknąć profil.',
  'Łuk styczny': 'Kontynuuj polilinię łukiem stycznym do poprzedniego segmentu.',
  'Thin Extrude': 'Wyciągnij otwarty łańcuch szkicu jako cienkościenną bryłę.',
  'Rib/Web': 'Utwórz żebro albo ściankę z otwartego profilu szkicu.',
  'Pipe': 'Utwórz pusty przewód wzdłuż zaznaczonej otwartej ścieżki.',
  'Import SVG/DXF': 'Wczytaj geometrię SVG lub DXF bezpośrednio do aktywnego szkicu.',
  'Import DWG': 'Wybierz plik DWG, przekształć go lokalnie do DXF i dodaj geometrię do aktywnego szkicu.',
  'Trim': 'Przytnij wskazany fragment krzywej do najbliższych przecięć.',
  'Extend': 'Przedłuż wskazany koniec krzywej do najbliższej geometrii.',
  'Break': 'Podziel wskazaną krzywą w wybranym punkcie.',
  'Przesuń': 'Przesuń zaznaczone punkty lub segmenty przeciągnięciem albo dokładnym ΔX i ΔY.',
  'Offset': 'Utwórz równoległą kopię zaznaczonej krzywej, łańcucha lub profilu; znak odległości wybiera stronę.',
  'Fillet szkicu': 'Zaokrąglij wspólny narożnik dokładnie dwóch zaznaczonych linii.',
  'Faza szkicu': 'Zetnij wspólny narożnik dokładnie dwóch zaznaczonych linii.',
  'Transformuj': 'Obróć, skopiuj, odbij lub przeskaluj zaznaczoną geometrię szkicu.',
  'Szyk szkicu': 'Powiel zaznaczoną geometrię w szyku prostokątnym, kołowym albo po ścieżce.',
  'Project': 'Przenieś wskazane wierzchołki i krawędzie modelu do szkicu jako trwale powiązaną geometrię.',
  'Usuń': 'Usuń zaznaczoną geometrię oraz bezpiecznie zależne profile i operacje.',
  'Zakończ szkic': 'Zamknij edycję szkicu i wróć do modelowania bryły.',
  'Współliniowe': 'Wymuś położenie dwóch wybranych linii na jednej prostej.',
  'Symetria': 'Utwórz więz symetrii dla wybranej geometrii względem osi.',
  'Krzywizna G2': 'Nadaj ciągłość krzywizny G2 pomiędzy zgodnymi krzywymi.',
  'Ordinate X': 'Dodaj wymiar współrzędnej X wybranego punktu.',
  'Ordinate Y': 'Dodaj wymiar współrzędnej Y wybranego punktu.',
  'Długość łuku': 'Dodaj sterujący wymiar długości wybranego łuku.',
  'Wyciągnij': 'Wyciągnij zaznaczony profil w bryłę; możesz też przeciągnąć niebieską strzałkę.',
  'Revolve': 'Obróć profil wokół wskazanej osi i utwórz bryłę obrotową.',
  'Sweep': 'Przeciągnij profil wzdłuż osobnej ścieżki szkicu.',
  'Loft': 'Połącz dwa profile płynną albo odcinkową bryłą przejściową.',
  'Coil': 'Utwórz parametryczną spiralę lub sprężynę wokół osi.',
  'Pattern': 'Powiel wybraną bryłę w szyku prostokątnym, kołowym albo po ścieżce.',
  'Press Pull': 'Wyciągnij lub wciśnij wybrany profil albo płaską ścianę.',
  'Prymityw': 'Utwórz dokładny box, walec, sferę albo torus.',
  'Tekst 3D': 'Utwórz tekst jako nową bryłę, wypukłość albo grawer.',
  'Boolean': 'Połącz, odejmij albo pozostaw część wspólną dwóch wskazanych brył.',
  'Otwór': 'Wytnij cylindryczny otwór z zaznaczonego profilu okręgu.',
  'Zaokrąglij': 'Zaokrąglij krawędzie zaznaczonej bryły podanym promieniem.',
  'Fazuj': 'Zetnij ostre krawędzie zaznaczonej bryły podaną odległością.',
  'Shell': 'Usuń wskazane ściany i nadaj bryle określoną grubość ścianki.',
  'Draft': 'Pochyl wskazane ściany względem płaszczyzny neutralnej.',
  'Split Body': 'Podziel wybraną bryłę wskazaną płaszczyzną.',
  'Split Face': 'Podziel ścianę geometrią wybranego profilu.',
  'Delete Face + Heal': 'Usuń wskazane ściany i automatycznie napraw sąsiednią geometrię.',
  'Replace Face': 'Zastąp jedną ścianę powierzchnią drugiej wskazanej ściany.',
  'Offset Face': 'Przesuń wskazaną ścianę o dokładną odległość.',
  'Przesuń bryłę': 'Przesuń wybraną bryłę o dokładny wektor.',
  'Obróć bryłę': 'Obróć wybraną bryłę o zadany kąt.',
  'Edytuj': 'Otwórz parametry zaznaczonego szkicu, profilu lub kroku historii.',
  'Parametry': 'Dodaj i zmień nazwane wymiary sterujące modelem.',
  'Płaszczyzna offset': 'Utwórz nazwaną płaszczyznę konstrukcyjną w parametrycznej odległości od XY, XZ albo YZ.',
  'Midplane': 'Utwórz płaszczyznę dokładnie pośrodku dwóch równoległych położeń.',
  'Plane 3 punkty': 'Utwórz płaszczyznę przechodzącą przez trzy niewspółliniowe punkty 3D.',
  'Plane angle': 'Utwórz płaszczyznę obróconą o zadany kąt wokół osi.',
  'Plane tangent': 'Utwórz płaszczyznę styczną do walca albo sfery.',
  'Plane path': 'Utwórz płaszczyznę prostopadłą do ścieżki w zadanym punkcie.',
  'Oś z krawędzi': 'Utwórz trwałą oś z wybranej prostej krawędzi albo jej końców.',
  'Oś walca': 'Utwórz oś walca lub cylindrycznej ściany ze środka i kierunku.',
  'Oś 2 punkty': 'Utwórz parametryczną oś przechodzącą przez dwa punkty 3D.',
  'Oś przecięcia': 'Utwórz oś na linii przecięcia dwóch nazwanych płaszczyzn konstrukcyjnych.',
  'Oś normalna': 'Utwórz oś prostopadłą do wybranej płaszczyzny.',
  'Punkt wierzchołka': 'Utwórz punkt śledzący trwały wierzchołek bryły albo dokładne współrzędne.',
  'Punkt centrum': 'Utwórz punkt w centrum wybranej krawędzi, ściany lub walca.',
  'Punkt przecięcia': 'Utwórz punkt w dokładnym przecięciu osi konstrukcyjnej z płaszczyzną.',
  'Punkt środkowy': 'Utwórz punkt dokładnie pośrodku dwóch zadanych punktów.',
  'Punkt na osi': 'Utwórz punkt w podanej odległości wzdłuż osi konstrukcyjnej.',
  'Otwórz': 'Wczytaj zapisany projekt MadCAD z dysku.',
  'Wybierz': 'Wyczyść zaznaczenie i wróć do trybu wyboru obiektów.',
  'STL': 'Eksportuj siatkę gotową do programu przygotowującego druk 3D.',
  'STEP': 'Eksportuj dokładną bryłę B-Rep do wymiany z innymi programami CAD.',
  '3MF': 'Eksportuj model i jego jednostki do archiwum 3MF.',
  'Import 3D': 'Wczytaj model STEP, STL albo 3MF do bieżącego projektu.',
  'Druk 3D': 'Otwórz kontrolę gabarytów i ustawień eksportu do druku 3D.',
  'Kontrola druku': 'Sprawdź, czy model mieści się na stole drukarki.',
  'Zmierz': 'Pokaż dokładne wymiary zaznaczonej bryły, ściany, krawędzi, wierzchołka albo pary elementów.',
  'Przekrój': 'Włącz interaktywną płaszczyznę przekroju bez zmiany historii modelu.',
  'Masa': 'Oblicz objętość, pole, masę i środek masy dla zadanej gęstości materiału.',
  'Analiza': 'Sprawdź minimalny promień oraz dokładne kolizje pomiędzy bryłami.',
};

const TOOL_SHORTCUTS = Object.freeze({
  'Linia': 'L',
  'Polilinia': 'PL',
  'Prostokąt': 'R',
  'Okrąg': 'C',
  'Trim': 'T',
  'Extend': 'EX',
  'Break': 'BR',
  'Offset': 'O',
  'Fillet szkicu': 'F',
  'Faza szkicu': 'CHA',
  'Zaokrąglij': 'F',
  'Fazuj': 'CHA',
  'Project': 'P',
  'Przesuń': 'M',
  'Przesuń bryłę': 'M',
  'Zmierz': 'I',
  'Usuń': 'DEL',
  'Wyciągnij': 'E',
});

const TOOL_COLOR_GROUPS = Object.freeze({
  sketch: new Set(['Utwórz szkic', 'Linia', 'Polilinia', 'Łuk styczny', 'Łuk', 'Prostokąt', 'Okrąg', 'Wielokąt', 'Elipsa', 'Slot', 'Spline', 'Conic', 'Punkt', 'Zakończ szkic']),
  solid: new Set(['Wyciągnij', 'Thin Extrude', 'Rib/Web', 'Pipe', 'Revolve', 'Sweep', 'Loft', 'Coil', 'Pattern', 'Press Pull', 'Prymityw', 'Tekst 3D', 'Boolean', 'Otwór']),
  edit: new Set(['Trim', 'Extend', 'Break', 'Offset', 'Fillet szkicu', 'Faza szkicu', 'Transformuj', 'Szyk szkicu', 'Przesuń', 'Zaokrąglij', 'Fazuj', 'Shell', 'Draft', 'Split Body', 'Split Face', 'Replace Face', 'Offset Face', 'Przesuń bryłę', 'Obróć bryłę', 'Edytuj']),
  reference: new Set(['Project', 'Współliniowe', 'Symetria', 'Krzywizna G2', 'Ordinate X', 'Ordinate Y', 'Długość łuku', 'Płaszczyzna offset', 'Midplane', 'Plane 3 punkty', 'Plane angle', 'Plane tangent', 'Plane path', 'Oś z krawędzi', 'Oś walca', 'Oś 2 punkty', 'Oś przecięcia', 'Oś normalna', 'Punkt wierzchołka', 'Punkt centrum', 'Punkt przecięcia', 'Punkt środkowy', 'Punkt na osi']),
  inspect: new Set(['Parametry', 'Zmierz', 'Przekrój', 'Masa', 'Analiza', 'Wybierz']),
  output: new Set(['Import SVG/DXF', 'Import DWG', 'Import 3D', 'STEP', 'STL', '3MF', 'Kontrola druku']),
  destructive: new Set(['Usuń', 'Delete Face + Heal']),
});

const TOOL_GROUP_HUES = Object.freeze({ sketch: 190, solid: 218, edit: 38, reference: 166, inspect: 274, output: 138, destructive: 356, neutral: 208 });
const FEATURED_TOOL_LABELS = new Set(['Utwórz szkic', 'Linia', 'Wyciągnij', 'Wybierz', 'Trim', 'Zakończ szkic', 'Parametry', 'STEP']);

function toolColorStyle(label) {
  const group = Object.entries(TOOL_COLOR_GROUPS).find(([, labels]) => labels.has(label))?.[0] || 'neutral';
  const hue = TOOL_GROUP_HUES[group];
  return {
    '--tool-accent': `hsl(${hue} 84% 68%)`,
  };
}

const ToolHelpContext = React.createContext(null);

function shortcutLabel(shortcut) {
  if (shortcut === 'ESC') return 'Esc';
  if (shortcut === 'DEL') return window.desktopApp?.platform === 'darwin' ? '⌫' : 'Del';
  if (shortcut === 'CTRL+ENTER') return window.desktopApp?.platform === 'darwin' ? '⌘ Enter' : 'Ctrl+Enter';
  return shortcut;
}

function useDocumentHistory(initialDocument) {
  const [history, setHistory] = useState({ past: [], present: initialDocument, future: [] });
  const commit = useCallback((mutator) => {
    setHistory((current) => {
      const next = cloneDocument(current.present);
      mutator(next);
      touchDocument(next);
      return { past: [...current.past.slice(-59), current.present], present: next, future: [] };
    });
  }, []);
  const replace = useCallback((document) => setHistory({ past: [], present: document, future: [] }), []);
  const synchronize = useCallback((mutator) => setHistory((current) => {
    const next = cloneDocument(current.present);
    mutator(next);
    touchDocument(next);
    return { ...current, present: next };
  }), []);
  const undo = useCallback(() => setHistory((current) => current.past.length ? {
    past: current.past.slice(0, -1),
    present: current.past.at(-1),
    future: [current.present, ...current.future],
  } : current), []);
  const redo = useCallback(() => setHistory((current) => current.future.length ? {
    past: [...current.past, current.present],
    present: current.future[0],
    future: current.future.slice(1),
  } : current), []);
  return useMemo(() => ({
    document: history.present,
    commit,
    replace,
    synchronize,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }), [commit, history.future.length, history.past.length, history.present, redo, replace, synchronize, undo]);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeName(value) {
  return value.trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'model';
}

function ToolGlyph({ icon: Icon, compact = false }) {
  const size = compact ? 18 : 25;
  return (
    <span className="ribbon-glyph">
      <Icon className="ribbon-glyph-depth" size={size} strokeWidth={2.7} fill="currentColor" fillOpacity={0.32} aria-hidden="true" />
      <Icon className="ribbon-glyph-face" size={size} strokeWidth={1.8} fill="currentColor" fillOpacity={0.24} aria-hidden="true" />
    </span>
  );
}

function ToolButton({ icon: Icon, label, onClick, disabled = false, primary = false, compact = false, title, description }) {
  const help = description || title || TOOL_DESCRIPTIONS[label] || label;
  const shortcut = TOOL_SHORTCUTS[label] || null;
  const featured = FEATURED_TOOL_LABELS.has(label);
  const toolHelp = React.useContext(ToolHelpContext);
  useEffect(() => {
    if (!shortcut || ['ESC', 'DEL', 'CTRL+ENTER'].includes(shortcut)) return undefined;
    return toolHelp?.registerShortcut(shortcut, { label, onClick, disabled });
  }, [disabled, label, onClick, shortcut, toolHelp]);
  const showHelp = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    toolHelp?.setToolHelp({
      label,
      help,
      shortcut: shortcut ? shortcutLabel(shortcut) : null,
      x: Math.min(window.innerWidth - 184, Math.max(184, rect.left + (rect.width / 2))),
      y: rect.bottom + 8,
    });
  };
  return (
    <span className={`ribbon-tool-wrap ${featured ? 'featured' : ''}`} onMouseEnter={showHelp} onMouseLeave={() => toolHelp?.setToolHelp(null)} onFocus={showHelp} onBlur={() => toolHelp?.setToolHelp(null)}>
      <button
        className={`ribbon-tool ${featured ? 'featured' : ''} ${primary ? 'primary' : ''} ${compact ? 'compact' : ''}`}
        style={toolColorStyle(label)}
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={`${help}${shortcut ? ` Skrót: ${shortcutLabel(shortcut)}.` : ''}`}
        aria-label={`${label}. ${help}${shortcut ? ` Skrót: ${shortcutLabel(shortcut)}.` : ''}`}
      >
        <span className="ribbon-icon" aria-hidden="true"><ToolGlyph icon={Icon} compact={compact} /></span>
        <span className="ribbon-label">{label}</span>
      </button>
    </span>
  );
}

const RibbonGroup = React.forwardRef(function RibbonGroup({ children, end = false, hidden = false, label }, ref) {
  return (
    <div ref={ref} className={`ribbon-group ${end ? 'ribbon-group-end' : ''}`} role="group" aria-label={label} hidden={hidden}>
      <div className="ribbon-group-heading">{label}</div>
      <div className="ribbon-tools">{children}</div>
    </div>
  );
});

function flattenRibbonGroups(children) {
  const groups = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) groups.push(...flattenRibbonGroups(child.props.children));
    else groups.push(child);
  });
  return groups;
}

export function calculateVisibleRibbonGroups(widths, availableWidth, stickyIndices = [], overflowWidth = 78) {
  const sticky = new Set(stickyIndices);
  const normalIndices = widths.map((_, index) => index).filter((index) => !sticky.has(index));
  const stickyWidth = stickyIndices.reduce((total, index) => total + (widths[index] || 0), 0);
  const fullWidth = widths.reduce((total, width) => total + width, 0);
  if (fullWidth <= availableWidth) return { visible: normalIndices, hidden: [] };

  const budget = Math.max(0, availableWidth - stickyWidth - overflowWidth);
  const visible = [];
  let used = 0;
  for (const index of normalIndices) {
    const width = widths[index] || 0;
    if (used + width > budget) break;
    visible.push(index);
    used += width;
  }
  return { visible, hidden: normalIndices.filter((index) => !visible.includes(index)) };
}

function RibbonOverflowTool({ tool, onSelect }) {
  if (!React.isValidElement(tool)) return null;
  const { disabled = false, icon: Icon, label, onClick, description, title } = tool.props;
  const help = description || title || TOOL_DESCRIPTIONS[label] || label;
  return (
    <button
      className="ribbon-overflow-tool"
      style={toolColorStyle(label)}
      type="button"
      role="menuitem"
      disabled={disabled}
      title={help}
      onClick={(event) => {
        onClick?.(event);
        onSelect();
      }}
    >
      {Icon && <span className="ribbon-overflow-icon" aria-hidden="true"><ToolGlyph icon={Icon} compact /></span>}
      <span>{label}</span>
    </button>
  );
}

function RibbonOverflow({ groups }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    const closeWithEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', closeWithEscape);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', closeWithEscape);
    };
  }, [open]);
  if (!groups.length) return null;
  return (
    <div className="ribbon-overflow" ref={menuRef}>
      <button
        className={`ribbon-overflow-trigger ${open ? 'active' : ''}`}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Pokaż pozostałe narzędzia"
        onClick={() => setOpen((current) => !current)}
      >
        <MoreHorizontal size={20} aria-hidden="true" />
        <span>Więcej</span>
      </button>
      {open && (
        <div className={`ribbon-overflow-menu ${groups.length === 1 ? 'single-group' : ''}`} role="menu" aria-label="Pozostałe narzędzia">
          {groups.map((group, groupIndex) => (
            <section className="ribbon-overflow-section" key={`${group.props.label}-${groupIndex}`} role="none">
              <strong>{group.props.label}</strong>
              <div>
                {React.Children.map(group.props.children, (tool) => (
                  <RibbonOverflowTool tool={tool} onSelect={() => setOpen(false)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function ResponsiveRibbon({ children }) {
  const groups = flattenRibbonGroups(children);
  const groupSignature = groups.map((group) => `${group.props.label}:${group.props.end ? '1' : '0'}`).join('|');
  const groupCount = groups.length;
  const stickyKey = groups.map((group, index) => (group.props.end ? index : -1)).filter((index) => index >= 0).join(',');
  const containerRef = useRef(null);
  const groupRefs = useRef([]);
  const measuredWidths = useRef([]);
  const [layout, setLayout] = useState({ visible: groups.map((_, index) => index), hidden: [] });

  useLayoutEffect(() => {
    measuredWidths.current = [];
    setLayout({ visible: Array.from({ length: groupCount }, (_, index) => index), hidden: [] });
  }, [groupCount, groupSignature]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const update = () => {
      groupRefs.current.forEach((node, index) => {
        if (!node) return;
        const width = Math.ceil(node.getBoundingClientRect().width);
        if (width > 0) measuredWidths.current[index] = width;
      });
      if (measuredWidths.current.length < groupCount || measuredWidths.current.some((width) => !width)) return;
      const stickyIndices = stickyKey ? stickyKey.split(',').map(Number) : [];
      const next = calculateVisibleRibbonGroups(measuredWidths.current, container.clientWidth, stickyIndices);
      setLayout((current) => (
        current.visible.join(',') === next.visible.join(',') && current.hidden.join(',') === next.hidden.join(',')
          ? current
          : next
      ));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    groupRefs.current.forEach((node) => { if (node) observer.observe(node); });
    return () => observer.disconnect();
  }, [groupCount, groupSignature, stickyKey]);

  const stickyIndices = new Set(stickyKey ? stickyKey.split(',').map(Number) : []);
  const visibleIndices = new Set(layout.visible);
  const hiddenGroups = layout.hidden.map((index) => groups[index]);
  return (
    <div ref={containerRef} className="modeling-ribbon" role="toolbar" aria-label="Narzędzia aktywnego obszaru roboczego" tabIndex="0">
      <div className="ribbon-visible-groups">
        {groups.map((group, index) => stickyIndices.has(index) ? null : React.cloneElement(group, {
          key: group.key || `${group.props.label}-${index}`,
          ref: (node) => { groupRefs.current[index] = node; },
          hidden: !visibleIndices.has(index),
        }))}
      </div>
      <RibbonOverflow groups={hiddenGroups} />
      <div className="ribbon-sticky-groups">
        {groups.map((group, index) => stickyIndices.has(index) ? React.cloneElement(group, {
          key: `sticky-${group.key || `${group.props.label}-${index}`}`,
          ref: (node) => { groupRefs.current[index] = node; },
        }) : null)}
      </div>
    </div>
  );
}

export function CrashRecoveryBanner({ info, onSave, onDismiss }) {
  if (!info) return null;
  const parsedTime = Date.parse(info.updatedAt || '');
  const savedAt = Number.isFinite(parsedTime)
    ? new Date(parsedTime).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' })
    : null;
  return (
    <section className="crash-recovery-banner" role="alert" aria-label="Odzyskiwanie projektu po awarii">
      <div>
        <strong>Odzyskano projekt po nieoczekiwanym zamknięciu MadCAD</strong>
        <span>{info.backup ? 'Użyto poprzedniej poprawnej kopii autozapisu' : 'Użyto ostatniego poprawnego autozapisu'}{savedAt ? ` · ${savedAt}` : ''}.</span>
      </div>
      <button type="button" onClick={onSave}>Zapisz odzyskany projekt</button>
      <button className="icon-only" type="button" aria-label="Zamknij komunikat odzyskiwania" title="Zamknij komunikat" onClick={onDismiss}><X size={15} /></button>
    </section>
  );
}

function ProjectBrowser({ document, bodies, selection, activeSketchId, onSelect, onToggleReference, onClose }) {
  const [expanded, setExpanded] = useState({ origin: true, construction: true, sketches: true, bodies: true });
  const toggle = (key) => setExpanded((current) => ({ ...current, [key]: !current[key] }));
  const constructionReferences = document.references.filter((reference) => ['construction-plane', 'construction-axis', 'construction-point'].includes(reference.kind));
  return (
    <aside className="model-browser" aria-label="Przeglądarka projektu">
      <div className="browser-heading"><strong>PRZEGLĄDARKA</strong><button type="button" title="Zwiń przeglądarkę" onClick={onClose}><PanelLeftClose size={14} /></button></div>
      <button className={`tree-row tree-root ${selection?.kind === 'document' ? 'selected' : ''}`} type="button" title="Zaznacz cały dokument projektu." onClick={() => onSelect({ kind: 'document', id: document.id })}>
        <ChevronDown size={13} /><FileBox size={14} /><strong>{document.name || 'Bez nazwy'}</strong>
      </button>
      <button className="tree-row tree-child" type="button" title="Otwórz nazwane parametry sterujące wymiarami modelu." onClick={() => onSelect({ kind: 'settings', id: document.id })}>
        <span /><Settings2 size={14} /><span>Parametry modelu</span><small>mm</small>
      </button>

      <button className="tree-row tree-child tree-folder" type="button" title="Pokaż lub ukryj płaszczyzny początku układu." onClick={() => toggle('origin')}>
        {expanded.origin ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<Layers3 size={14} /><span>Początek</span>
      </button>
      {expanded.origin && (
        <div className="tree-nested">
          {Object.entries(PLANE_LABELS).map(([plane, label]) => (
            <button key={plane} className="tree-row tree-grandchild" type="button" title={`Zaznacz płaszczyznę ${plane} jako bazę szkicu.`} onClick={() => onSelect({ kind: 'plane', id: plane })}>
              <span /><Frame size={13} /><span>{label}</span>
            </button>
          ))}
        </div>
      )}

      <button className="tree-row tree-child tree-folder" type="button" title="Pokaż lub ukryj geometrię konstrukcyjną." onClick={() => toggle('construction')}>
        {expanded.construction ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<Frame size={14} /><span>Konstrukcja</span><small>{constructionReferences.length}</small>
      </button>
      {expanded.construction && constructionReferences.map((reference) => (
        <div className="tree-reference-row" key={reference.id}>
          <button className={`tree-row tree-grandchild ${selection?.kind === (reference.kind === 'construction-axis' ? 'constructionAxis' : reference.kind === 'construction-point' ? 'constructionPoint' : 'constructionPlane') && selection.id === reference.id ? 'selected' : ''}`} type="button" title={`Zaznacz ${reference.name}.`} onClick={() => onSelect({ kind: reference.kind === 'construction-axis' ? 'constructionAxis' : reference.kind === 'construction-point' ? 'constructionPoint' : 'constructionPlane', id: reference.id })}>
            <span />{reference.kind === 'construction-axis' ? <Minus size={13} /> : reference.kind === 'construction-point' ? <CircleDotDashed size={13} /> : <Frame size={13} />}<span>{reference.name}</span><small>{reference.kind === 'construction-axis' ? 'OŚ' : reference.kind === 'construction-point' ? 'PKT' : (reference.basePlane || '3P')}</small>
          </button>
          <button className="tree-reference-visibility" type="button" title={reference.visible ? `Ukryj ${reference.name}` : `Pokaż ${reference.name}`} onClick={() => onToggleReference(reference.id)}>{reference.visible ? <Eye size={13} /> : <EyeOff size={13} />}</button>
        </div>
      ))}

      <button className="tree-row tree-child tree-folder" type="button" title="Pokaż lub ukryj szkice i ich profile." onClick={() => toggle('sketches')}>
        {expanded.sketches ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<FolderOpen size={14} /><span>Szkice</span><small>{document.sketches.length}</small>
      </button>
      {expanded.sketches && document.sketches.map((sketch) => (
        <React.Fragment key={sketch.id}>
          <button
            className={`tree-row tree-grandchild ${selection?.kind === 'sketch' && selection.id === sketch.id ? 'selected' : ''} ${activeSketchId === sketch.id ? 'editing' : ''}`}
            type="button"
            title={`Zaznacz ${sketch.name}; użyj Edytuj, aby wrócić do szkicu.`}
            onClick={() => onSelect({ kind: 'sketch', id: sketch.id })}
          >
            <span /><PencilRuler size={13} /><span>{sketch.name}</span><small>{sketch.plane}</small>
          </button>
          {sketch.profiles.map((profile) => (
            <button
              className={`tree-row tree-profile ${selection?.kind === 'profile' && selection.id === profile.id ? 'selected' : ''}`}
              key={profile.id}
              type="button"
              title={`Zaznacz ${profile.name}; przeciągnij strzałkę lub użyj Wyciągnij.`}
              onClick={() => onSelect({ kind: 'profile', id: profile.id, sketchId: sketch.id })}
            >
              <span />{profile.type === 'circle' ? <Circle size={12} /> : <Square size={12} />}<span>{profile.name}</span>
            </button>
          ))}
        </React.Fragment>
      ))}

      <button className="tree-row tree-child tree-folder" type="button" title="Pokaż lub ukryj utworzone bryły." onClick={() => toggle('bodies')}>
        {expanded.bodies ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<FolderOpen size={14} /><span>Bryły</span><small>{bodies.length}</small>
      </button>
      {expanded.bodies && bodies.map((body) => (
        <button
          className={`tree-row tree-grandchild ${selection?.kind === 'body' && selection.id === body.id ? 'selected' : ''}`}
          key={body.id}
          type="button"
          title={body.representation === 'mesh-import'
            ? `${body.name}: ${body.meshBooleanCapable === false ? 'otwarta siatka do pomiaru, transformacji i eksportu' : 'zamknięta siatka 3D'}.`
            : `Zaznacz dokładną bryłę B-Rep ${body.name} do dalszych operacji.`}
          onClick={() => onSelect({ kind: 'body', id: body.id })}
        >
          <span /><Box size={13} /><span>{body.name}</span><span className="body-kind"><small>{body.representation === 'mesh-import' ? (body.meshBooleanCapable === false ? 'SIATKA OTW.' : 'SIATKA') : 'B-REP'}</small><i className="body-color" style={{ background: body.color }} /></span>
        </button>
      ))}
    </aside>
  );
}

function StartPage({ onStartSketch, onOpenProject }) {
  return (
    <section className="empty-canvas start-page" aria-labelledby="start-page-title">
      <div className="start-page-shell">
        <div className="start-page-intro">
          <div className="start-page-brand">
            <img src={madcadIconUrl} alt="MadCAD" />
            <span>MadCAD · CAD 2D/3D</span>
          </div>
          <h1 id="start-page-title">Rysuj 2D. Modeluj parametrycznie w 3D.</h1>
          <p>Zacznij od precyzyjnego szkicu jak w klasycznym CAD. Narzędzia bryłowe rozwijają projekt, a druk 3D pozostaje opcjonalnym etapem eksportu.</p>
          <div className="start-page-actions">
            <button className="start-page-action primary" type="button" onClick={onStartSketch}>
              <PencilRuler size={22} />
              <span><strong>Nowy rysunek 2D</strong><small>Wybierz płaszczyznę, rysuj myszą i wpisuj dokładne wymiary.</small></span>
              <ArrowRight size={18} />
            </button>
            <button className="start-page-action" type="button" onClick={onOpenProject}>
              <FolderOpen size={22} />
              <span><strong>Otwórz istniejący projekt</strong><small>Wczytaj plik .madcad i kontynuuj historię modelu.</small></span>
              <ArrowRight size={18} />
            </button>
          </div>
          <div className="start-page-shortcuts" role="group" aria-label="Szybki start">
            <strong>Szybki start</strong>
            <span><kbd>L</kbd> Linia</span>
            <span><kbd>R</kbd> Prostokąt</span>
            <span><kbd>C</kbd> Okrąg</span>
          </div>
        </div>

        <aside className="start-page-flow" aria-label="Przepływ pracy">
          <strong>Przepływ pracy</strong>
          <ol>
            <li><span>1</span><div><PencilRuler size={18} /><strong>Szkic 2D</strong><small>Linie, łuki, snap, trim, offset, więzy i wymiary.</small></div></li>
            <li><span>2</span><div><Layers3 size={18} /><strong>Model parametryczny</strong><small>Wyciągnięcia, operacje bryłowe i edytowalna historia.</small></div></li>
            <li><span>3</span><div><FileBox size={18} /><strong>Eksport</strong><small>STEP do wymiany CAD; STL, 3MF i kontrola druku jako dodatki.</small></div></li>
          </ol>
        </aside>
      </div>
    </section>
  );
}

function TopologyReferenceRepairPanel({ items, selection, onReassign, onPreview }) {
  const [expanded, setExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    const collapseForCompactViewport = () => {
      if (window.innerWidth <= 1200) setExpanded(false);
    };
    collapseForCompactViewport();
    window.addEventListener('resize', collapseForCompactViewport);
    return () => window.removeEventListener('resize', collapseForCompactViewport);
  }, []);
  useEffect(() => {
    setActiveIndex((current) => Math.max(0, Math.min(current, items.length - 1)));
  }, [items.length]);
  if (!items.length) return null;
  const selectedItem = selection?.items?.at(-1) || selection;
  const item = items[activeIndex] || items[0];
  const canUseSelection = selectedItem && selectedItem.kind === item.reference.topologyKind && selectedItem.id;
  const topologyKindLabel = { face: 'ściana', edge: 'krawędź', vertex: 'wierzchołek' }[item.reference.topologyKind] || item.reference.topologyKind;
  const highConfidenceRepairs = items.map((entry) => ({ entry, candidate: entry.candidates.find((candidate) => candidate.confidence === 'high') })).filter(({ candidate }) => candidate);
  const formatDifference = (value, suffix, fallback = 'brak danych') => Number.isFinite(value) ? `${value.toFixed(value >= 10 ? 1 : 2)}${suffix}` : fallback;
  const confidenceLabel = { high: 'wysoka', medium: 'średnia', low: 'niska' };
  const autoRepair = () => highConfidenceRepairs.forEach(({ entry, candidate }) => onReassign(entry.reference.id, candidate, candidate.descriptor));
  return (
    <aside className={`reference-repair-panel ${expanded ? '' : 'collapsed'}`} role="region" aria-live="polite" aria-label="Kreator naprawy utraconych referencji">
      <header><AlertTriangle size={16} /><div><strong>Kreator naprawy referencji</strong><span>{items.length === 1 ? '1 element wymaga przypisania' : `${items.length} elementy wymagają przypisania`}</span></div><button className="reference-repair-toggle" type="button" aria-expanded={expanded} title={expanded ? 'Zwiń kreator naprawy' : 'Rozwiń kreator naprawy'} aria-label={expanded ? 'Zwiń kreator naprawy' : 'Rozwiń kreator naprawy'} onClick={() => setExpanded((value) => !value)}>{expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button></header>
      {expanded && <>
        <div className="reference-repair-progress"><span>Krok {activeIndex + 1} z {items.length}</span><progress max={items.length} value={activeIndex + 1} /></div>
        <section key={item.reference.id}>
          <div className="reference-repair-summary">
            <strong>{item.ownerFeature?.name || item.reference.label || 'Operacja zależna'}</strong>
            <span>Źródło: {item.sourceFeature?.name || item.reference.sourceFeatureId || 'nieznane'}</span>
            <small>{item.reason}</small>
            <small>Oczekiwany typ: <b>{topologyKindLabel}</b> · poprzednie ID: <code>{item.reference.topologyId}</code></small>
          </div>
          <div className="reference-repair-selection">
            <span>Wskaż {topologyKindLabel} w modelu albo wybierz dopasowanie poniżej.</span>
            <button type="button" disabled={!canUseSelection} onClick={() => onReassign(item.reference.id, selectedItem)}>Przypisz zaznaczenie</button>
          </div>
          <div className="reference-candidates" aria-label="Sugerowane dopasowania">
            {item.candidates.slice(0, 3).map((candidate, index) => (
              <article className={`reference-candidate confidence-${candidate.confidence}`} key={`${candidate.bodyId}:${candidate.id}`}>
                <div><strong>{confidenceLabel[candidate.confidence]} · {candidate.score}%</strong><span>{candidate.id}</span></div>
                <small>Odległość {formatDifference(candidate.distance, ' mm')} · rozmiar {formatDifference(candidate.sizeDifference, '%')} · orientacja {formatDifference(candidate.orientationDifference, '°')}</small>
                <div className="reference-candidate-actions">
                  <button className="secondary" type="button" onClick={() => onPreview(candidate)}>Pokaż</button>
                  <button type="button" data-reference-action={`candidate-${index + 1}`} onClick={() => onReassign(item.reference.id, candidate, candidate.descriptor)}>{`Kandydat ${index + 1}`}</button>
                </div>
              </article>
            ))}
            {!item.candidates.length && <p>Brak automatycznych kandydatów. Zaznacz zgodny element bezpośrednio w modelu.</p>}
          </div>
        </section>
        <footer>
          <button className="secondary" type="button" disabled={activeIndex === 0} onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}>Wstecz</button>
          <button className="secondary" type="button" disabled={activeIndex >= items.length - 1} onClick={() => setActiveIndex((index) => Math.min(items.length - 1, index + 1))}>Dalej</button>
          <button type="button" data-reference-action="repair-certain" disabled={!highConfidenceRepairs.length} onClick={autoRepair}>Napraw pewne ({highConfidenceRepairs.length})</button>
          <small>Każdą naprawę można cofnąć przez {shortcutLabel('CTRL+Z')}.</small>
        </footer>
      </>}
    </aside>
  );
}

function Field({ label, value, onChange, suffix = '', type = 'text', disabled = false, autoFocus = false }) {
  return (
    <label className="command-field">
      <span>{label}</span>
      <div className="command-input-wrap">
        <input autoFocus={autoFocus} type={type} value={value ?? ''} onChange={(event) => onChange?.(event.target.value)} disabled={disabled} />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

const MEASURE_NUMBER = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 4 });

function measureValue(value, unit = '') {
  return `${MEASURE_NUMBER.format(value)}${unit ? ` ${unit}` : ''}`;
}

function measureVector(vector, unit = 'mm') {
  return vector?.map((value) => MEASURE_NUMBER.format(value)).join('; ') + (unit ? ` ${unit}` : '');
}

function MeasurePanel({ measurement, onClose }) {
  const rows = [];
  if (measurement?.length !== undefined) rows.push(['Długość', measureValue(measurement.length, 'mm')]);
  if (measurement?.distance !== undefined) rows.push(['Odległość', measureValue(measurement.distance, 'mm')]);
  if (measurement?.angle !== null && measurement?.angle !== undefined) rows.push(['Kąt', measureValue(measurement.angle, '°')]);
  if (measurement?.radius !== undefined) rows.push(['Promień', measureValue(measurement.radius, 'mm')]);
  if (measurement?.diameter !== undefined) rows.push(['Średnica', measureValue(measurement.diameter, 'mm')]);
  if (measurement?.area !== undefined) rows.push(['Pole', measureValue(measurement.area, 'mm²')]);
  if (measurement?.volume !== undefined) rows.push(['Objętość', measureValue(measurement.volume, 'mm³')]);
  if (measurement?.position) rows.push(['Pozycja X; Y; Z', measureVector(measurement.position)]);
  if (measurement?.delta) rows.push(['ΔX; ΔY; ΔZ', measureVector(measurement.delta)]);
  if (measurement?.dimensions) rows.push(['Gabaryt X; Y; Z', measureVector(measurement.dimensions)]);
  return (
    <aside className="measure-panel" aria-label="Wynik pomiaru">
      <header><div><Ruler size={16} /><strong>Measure</strong></div><button type="button" title="Zamknij pomiar" onClick={onClose}><X size={15} /></button></header>
      <div className="measure-panel-body">
        {!measurement?.selectionCount && <p>Zaznacz bryłę, ścianę, krawędź lub wierzchołek. Ctrl/Shift wybiera drugi element.</p>}
        {rows.map(([label, value]) => <div className="measure-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
    </aside>
  );
}

function SectionPanel({ analysis, onChange, onClose }) {
  return (
    <aside className="measure-panel section-panel" aria-label="Section Analysis">
      <header><div><ScanSearch size={16} /><strong>Section Analysis</strong></div><button type="button" title="Zamknij przekrój" onClick={onClose}><X size={15} /></button></header>
      <div className="measure-panel-body">
        <label className="command-field"><span>Płaszczyzna</span><select value={analysis.plane} onChange={(event) => onChange({ plane: event.target.value })}><option value="XY">XY</option><option value="XZ">XZ</option><option value="YZ">YZ</option></select></label>
        <Field label="Przesunięcie" value={analysis.offset} onChange={(offset) => onChange({ offset })} suffix="mm" />
        <label className="section-toggle"><input type="checkbox" checked={analysis.flip} onChange={(event) => onChange({ flip: event.target.checked })} /><span>Odwróć stronę przekroju</span></label>
        <p>Widok jest przycinany wyłącznie analitycznie. Historia i geometria projektu pozostają bez zmian.</p>
      </div>
    </aside>
  );
}

function MassPropertiesPanel({ density, result, error, onDensityChange, onClose }) {
  return (
    <aside className="measure-panel mass-properties-panel" aria-label="Właściwości masowe">
      <header><div><Box size={16} /><strong>Właściwości masowe</strong></div><button type="button" title="Zamknij właściwości masowe" onClick={onClose}><X size={15} /></button></header>
      <div className="measure-panel-body">
        <Field label="Gęstość" value={density} onChange={onDensityChange} suffix="g/cm³" />
        {error && <p className="measure-error">{error}</p>}
        {result && <>
          <div className="measure-row"><span>Bryły</span><strong>{result.bodyCount}</strong></div>
          <div className="measure-row"><span>Objętość</span><strong>{measureValue(result.volume, 'mm³')}</strong></div>
          <div className="measure-row"><span>Pole</span><strong>{measureValue(result.area, 'mm²')}</strong></div>
          <div className="measure-row"><span>Masa</span><strong>{measureValue(result.mass, 'g')}</strong></div>
          <div className="measure-row"><span>Środek masy</span><strong>{measureVector(result.centerOfMass)}</strong></div>
        </>}
      </div>
    </aside>
  );
}

function GeometryInspectionPanel({ result, onClose }) {
  return (
    <aside className="measure-panel geometry-inspection-panel" aria-label="Analiza geometrii">
      <header><div><ScanSearch size={16} /><strong>Analiza geometrii</strong></div><button type="button" title="Zamknij analizę geometrii" onClick={onClose}><X size={15} /></button></header>
      <div className="measure-panel-body">
        <div className="measure-row"><span>Bryły</span><strong>{result.bodyCount}</strong></div>
        <div className="measure-row"><span>Min. promień</span><strong>{result.minimumRadius === null ? 'Brak powierzchni krzywoliniowych' : measureValue(result.minimumRadius, 'mm')}</strong></div>
        <div className="measure-row"><span>Kolizje</span><strong>{result.collisions.length}</strong></div>
        {result.skippedPairs > 0 && <div className="measure-row"><span>Pominięte pary</span><strong>{result.skippedPairs} · niezgodna/otwarta siatka</strong></div>}
        {result.collisions.map((collision) => <div className="collision-row" key={`${collision.firstBodyId}:${collision.secondBodyId}`}><span>{collision.firstBodyId} ↔ {collision.secondBodyId}</span><strong>{measureValue(collision.volume, 'mm³')}</strong></div>)}
        {!result.collisions.length && <p>{result.skippedPairs ? 'Nie wykryto kolizji w sprawdzonych parach; pominięte pary nie mają dokładnego wyniku.' : 'Nie wykryto wspólnej objętości pomiędzy bryłami.'}</p>}
      </div>
    </aside>
  );
}

const IMPORT_UNIT_OPTIONS = [
  ['auto', 'Automatycznie / z pliku'],
  ['millimeter', 'Milimetry (mm)'],
  ['centimeter', 'Centymetry (cm)'],
  ['inch', 'Cale (in)'],
  ['meter', 'Metry (m)'],
  ['micron', 'Mikrometry (µm)'],
  ['foot', 'Stopy (ft)'],
];

function ImportModelDialog({ draft, onChange, onConfirm, onCancel }) {
  if (!draft) return null;
  return (
    <section className="command-dialog import-model-dialog" aria-label="Import modelu 3D">
      <header><strong>Import modelu 3D</strong><button type="button" onClick={onCancel} title="Zamknij"><X size={15} /></button></header>
      <div className="command-dialog-body">
        <Field label="Plik" value={draft.fileName} disabled />
        <Field label="Format" value={draft.originalFormat.toUpperCase()} disabled />
        <Field label="Rozmiar" value={formatModelFileSize(draft.sourceBytes)} disabled />
        {draft.storedBytes !== draft.sourceBytes && <Field label="Dane projektu" value={formatModelFileSize(draft.storedBytes)} disabled />}
        <Field label="Tryb" value={draft.importMode === 'brep' ? 'Dokładna geometria B-Rep' : 'Natywna siatka trójkątów'} disabled />
        {Number.isFinite(draft.objectCount) && <Field label="Obiekty" value={String(draft.objectCount)} disabled />}
        {Number.isFinite(draft.triangleCount) && <Field label="Trójkąty" value={draft.triangleCount.toLocaleString('pl-PL')} disabled />}
        {draft.originalFormat === '3mf' && <Field label="Wykryta jedn." value={IMPORT_UNIT_OPTIONS.find(([value]) => value === draft.detectedUnit)?.[1] || draft.detectedUnit} disabled />}
        <label className="command-field"><span>Jednostka źródłowa</span><select value={draft.sourceUnit} onChange={(event) => onChange({ sourceUnit: event.target.value })}>{IMPORT_UNIT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="command-preview-note"><span className="preview-dot" />{draft.importMode === 'brep' ? 'STEP zachowa dokładne powierzchnie, krawędzie i operacje CAD.' : 'STL/3MF zostanie zachowany jako szybka siatka: można go oglądać, mierzyć, przesuwać i eksportować bez zawodnej konwersji do B-Rep.'}</div>
      </div>
      <footer><button className="secondary" type="button" onClick={onCancel}>Anuluj</button><button className="confirm" type="button" onClick={onConfirm}><Check size={14} /> Importuj</button></footer>
    </section>
  );
}

function ImportSketchDialog({ draft, onChange, onConfirm, onCancel }) {
  if (!draft) return null;
  return (
    <section className="command-dialog import-sketch-dialog" aria-label="Import SVG, DXF lub DWG do szkicu">
      <header><strong>Import geometrii szkicu</strong><button type="button" onClick={onCancel} title="Zamknij"><X size={15} /></button></header>
      <div className="command-dialog-body">
        <Field label="Plik" value={draft.fileName} disabled />
        <Field label="Format" value={(draft.sourceFormat || draft.format).toUpperCase()} disabled />
        <Field label="Wykryta jednostka" value={IMPORT_UNIT_OPTIONS.find(([value]) => value === draft.detectedUnit)?.[1] || draft.detectedUnit} disabled />
        <label className="command-field"><span>Jednostka źródłowa</span><select value={draft.sourceUnit} onChange={(event) => onChange({ sourceUnit: event.target.value })}>{IMPORT_UNIT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="command-preview-note"><span className="preview-dot" />Linie, polilinie, prostokąty, okręgi i łuki zostaną dodane do aktywnego szkicu w milimetrach. Zamknięte pętle utworzą profile.</div>
      </div>
      <footer><button className="secondary" type="button" onClick={onCancel}>Anuluj</button><button className="confirm" type="button" onClick={onConfirm}><Check size={14} /> Importuj do szkicu</button></footer>
    </section>
  );
}

function SketchDimensionDialog({ command, onChange, onConfirm, onCancel }) {
  if (command?.type !== 'sketchDimension') return null;
  const titles = {
    ordinateX: 'Wymiar ordinate X',
    ordinateY: 'Wymiar ordinate Y',
    arcLength: 'Wymiar długości łuku',
  };
  return (
    <section className="command-dialog sketch-dimension-dialog" aria-label={titles[command.dimensionType]}>
      <header><strong>{titles[command.dimensionType]}</strong><button type="button" onClick={onCancel} title="Zamknij"><X size={15} /></button></header>
      <div className="command-dialog-body">
        <Field label="Wartość" value={command.value} onChange={(value) => onChange({ value })} suffix="mm" autoFocus />
        <div className="command-preview-note"><span className="preview-dot" />Wymiar steruje geometrią i można go później zmienić bezpośrednio na szkicu.</div>
      </div>
      <footer><button className="secondary" type="button" onClick={onCancel}>Anuluj</button><button className="confirm" type="button" onClick={onConfirm}><Check size={14} /> Dodaj wymiar</button></footer>
    </section>
  );
}

function CommandDialog({ command, profileName, collapsed, dock, onChange, onConfirm, onConfirmDynamic, onCancel, onUndoSegment, onFinishPath, onToggleCollapsed, onToggleDock }) {
  if (!isDockableCommand(command)) return null;
  const isRectangle = command.type === 'rectangle';
  const isCircle = command.type === 'circle';
  const isArc = command.type === 'arc';
  const isPolygon = command.type === 'polygon';
  const isEllipse = command.type === 'ellipse';
  const isSlot = command.type === 'slot';
  const isSpline = command.type === 'spline';
  const isConic = command.type === 'conic';
  const isPoint = command.type === 'point';
  const isMechanicalShape = isRectangle || isCircle || isArc || isPolygon || isEllipse || isSlot || isSpline || isConic;
  const isExtrude = command.type === 'extrude';
  const isRevolve = command.type === 'revolve';
  const isSweep = command.type === 'sweep';
  const isLoft = command.type === 'loft';
  const isRib = command.type === 'rib';
  const isCoil = command.type === 'coil';
  const isPipe = command.type === 'pipe';
  const isPattern = command.type === 'pattern';
  const isBoolean = command.type === 'boolean';
  const isPrimitive = command.type === 'primitive';
  const isTransform = command.type === 'transform';
  const isOffsetFace = command.type === 'offsetFace';
  const isTextSolid = command.type === 'textSolid';
  const isHole = command.type === 'hole';
  const isFillet = command.type === 'fillet';
  const isShell = command.type === 'shell';
  const isDraftFeature = command.type === 'draft';
  const isSplitBody = command.type === 'splitBody';
  const isSplitFace = command.type === 'splitFace';
  const isDeleteFace = command.type === 'deleteFace';
  const isReplaceFace = command.type === 'replaceFace';
  const requiresFeaturePreview = isExtrude || isRevolve || isSweep || isLoft || isRib || isCoil || isPipe || isPattern || isBoolean || isPrimitive || isTransform || isOffsetFace || isTextSolid || isHole || isFillet || isShell || isDraftFeature || isSplitBody || isSplitFace || isDeleteFace || isReplaceFace;
  const featurePreviewPending = requiresFeaturePreview && !command.previewFeature;
  const isSketchPath = command.type === 'line' || command.type === 'polyline';
  const isSketchMove = command.type === 'moveSketch';
  const isSketchOffset = command.type === 'offsetSketch';
  const isSketchCorner = command.type === 'cornerSketch';
  const isSketchTransform = command.type === 'transformSketch';
  const isSketchPattern = command.type === 'patternSketch';
  const isOffsetPlane = command.type === 'offsetPlane';
  const isMidplane = command.type === 'midplanePlane';
  const isThreePointPlane = command.type === 'threePointPlane';
  const isAnglePlane = command.type === 'anglePlane';
  const isTangentPlane = command.type === 'tangentPlane';
  const isPathPlane = command.type === 'pathPlane';
  const isConstructionPlane = isOffsetPlane || isMidplane || isThreePointPlane || isAnglePlane || isTangentPlane || isPathPlane;
  const isConstructionAxis = command.type === 'constructionAxis';
  const axisTitles = { edge: 'Oś z krawędzi', cylinder: 'Oś walca', 'two-points': 'Oś przez dwa punkty', 'plane-intersection': 'Oś przecięcia płaszczyzn', 'plane-normal': 'Oś normalna do płaszczyzny' };
  const isConstructionPoint = command.type === 'constructionPoint';
  const pointTitles = { vertex: 'Punkt na wierzchołku', center: 'Punkt środka', intersection: 'Punkt przecięcia', midpoint: 'Punkt środkowy', 'on-axis': 'Punkt na osi' };
  const title = isRectangle ? 'Prostokąt' : isCircle ? 'Okrąg' : isArc ? 'Łuk' : isPolygon ? 'Wielokąt regularny' : isEllipse ? 'Elipsa' : isSlot ? 'Slot' : isSpline ? 'Spline' : isConic ? 'Krzywa conic' : isPoint ? 'Punkt szkicu' : isExtrude ? 'Wyciągnięcie' : isRevolve ? 'Revolve' : isSweep ? 'Sweep' : isLoft ? 'Loft' : isRib ? 'Rib/Web' : isCoil ? 'Coil' : isPipe ? 'Pipe' : isPattern ? 'Pattern' : isBoolean ? 'Boolean' : isPrimitive ? 'Prymityw 3D' : isTransform ? (command.mode === 'rotate' ? 'Obróć bryłę' : 'Przesuń bryłę') : isOffsetFace ? 'Offset Face' : isTextSolid ? 'Tekst 3D' : isHole ? 'Otwór' : isFillet ? 'Zaokrąglenie' : isShell ? 'Shell' : isDraftFeature ? 'Draft' : isSplitBody ? 'Split Body' : isSplitFace ? 'Split Face' : isDeleteFace ? 'Delete Face + Heal' : isReplaceFace ? 'Replace Face' : command.type === 'line' ? 'Linia' : command.type === 'polyline' ? 'Polilinia' : isSketchMove ? 'Przesuń geometrię' : isSketchOffset ? 'Offset szkicu' : isSketchCorner ? (command.mode === 'fillet' ? 'Fillet szkicu' : 'Chamfer szkicu') : isSketchTransform ? 'Transformuj szkic' : isSketchPattern ? 'Szyk szkicu' : isOffsetPlane ? 'Płaszczyzna odsunięta' : isMidplane ? 'Płaszczyzna środkowa' : isThreePointPlane ? 'Płaszczyzna przez trzy punkty' : isAnglePlane ? 'Płaszczyzna pod kątem' : isTangentPlane ? 'Płaszczyzna styczna' : isPathPlane ? 'Płaszczyzna na ścieżce' : isConstructionAxis ? axisTitles[command.axisType] : isConstructionPoint ? pointTitles[command.pointType] : 'Fazowanie';
  return (
    <section className={`command-dialog docked dock-${dock} ${collapsed ? 'collapsed' : ''} ${isSketchPath ? 'sketch-path-dialog' : ''}`} aria-label={`${title} — panel polecenia`}>
      <header>
        <strong>{title}</strong>
        <div className="dock-panel-actions">
          {!collapsed && <button type="button" data-panel-action="dock" onClick={onToggleDock} title={dock === 'right' ? 'Przenieś panel na lewą stronę' : 'Przenieś panel na prawą stronę'} aria-label={dock === 'right' ? 'Przenieś panel na lewą stronę' : 'Przenieś panel na prawą stronę'}>{dock === 'right' ? <PanelLeft size={15} /> : <PanelRight size={15} />}</button>}
          <button type="button" data-panel-action="collapse" onClick={onToggleCollapsed} title={collapsed ? 'Rozwiń panel polecenia' : 'Zwiń panel polecenia'} aria-label={collapsed ? 'Rozwiń panel polecenia' : 'Zwiń panel polecenia'} aria-expanded={!collapsed}>{collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}</button>
          {!collapsed && <button type="button" onClick={onCancel} title="Zamknij polecenie" aria-label="Zamknij polecenie"><X size={15} /></button>}
        </div>
      </header>
      {!collapsed && <>
      <div className="command-dialog-body">
        {isMechanicalShape && <Field label="Nazwa" value={command.name} onChange={(name) => onChange({ name })} />}
        {(isRectangle || isCircle || isArc || isPolygon || isEllipse || isSlot || isSpline) && (
          <label className="command-field">
            <span>Metoda</span>
            <select value={command.definition} onChange={(event) => onChange({ definition: event.target.value, gesturePoints: [] })} disabled={Boolean(command.editId)}>
              {isRectangle && <><option value="center">Środek i wymiary</option><option value="twoPoints">Dwa narożniki</option><option value="threePoints">Trzy punkty</option></>}
              {isCircle && <><option value="centerRadius">Środek i średnica</option><option value="twoPoints">Dwa punkty średnicy</option><option value="threePoints">Trzy punkty</option></>}
              {isArc && <><option value="threePoints">Trzy punkty</option><option value="centerStartEnd">Środek, początek, koniec</option></>}
              {isPolygon && <><option value="inscribed">Wpisany</option><option value="circumscribed">Opisany</option><option value="edge">Z krawędzi</option></>}
              {isEllipse && <><option value="full">Pełna elipsa</option><option value="arc">Łuk eliptyczny</option></>}
              {isSlot && <><option value="centerToCenter">Środek–środek</option><option value="overall">Długość całkowita</option><option value="threePoints">Trzy punkty</option><option value="arc">Po łuku</option></>}
              {isSpline && <><option value="fit">Punkty dopasowania</option><option value="control">Punkty kontrolne</option></>}
            </select>
          </label>
        )}
        {isRectangle && (
          <>
            {command.definition === 'center' ? <><Field label="Szerokość" value={command.width} onChange={(width) => onChange({ width })} suffix="mm" autoFocus /><Field label="Wysokość" value={command.height} onChange={(height) => onChange({ height })} suffix="mm" /><Field label="Środek X" value={command.x} onChange={(x) => onChange({ x })} suffix="mm" /><Field label="Środek Y" value={command.y} onChange={(y) => onChange({ y })} suffix="mm" /><Field label="Obrót" value={command.rotation} onChange={(rotation) => onChange({ rotation })} suffix="°" /></> : <><Field label="Punkt 1 X" value={command.x1} onChange={(x1) => onChange({ x1 })} suffix="mm" autoFocus /><Field label="Punkt 1 Y" value={command.y1} onChange={(y1) => onChange({ y1 })} suffix="mm" /><Field label="Punkt 2 X" value={command.x2} onChange={(x2) => onChange({ x2 })} suffix="mm" /><Field label="Punkt 2 Y" value={command.y2} onChange={(y2) => onChange({ y2 })} suffix="mm" />{command.definition === 'threePoints' && <><Field label="Punkt 3 X" value={command.x3} onChange={(x3) => onChange({ x3 })} suffix="mm" /><Field label="Punkt 3 Y" value={command.y3} onChange={(y3) => onChange({ y3 })} suffix="mm" /></>}</>}
          </>
        )}
        {isCircle && (
          <>
            {command.definition === 'centerRadius' ? <><Field label="Średnica" value={command.diameter} onChange={(diameter) => onChange({ diameter })} suffix="mm" autoFocus /><Field label="Środek X" value={command.x} onChange={(x) => onChange({ x })} suffix="mm" /><Field label="Środek Y" value={command.y} onChange={(y) => onChange({ y })} suffix="mm" /></> : <><Field label="Punkt 1 X" value={command.x1} onChange={(x1) => onChange({ x1 })} suffix="mm" autoFocus /><Field label="Punkt 1 Y" value={command.y1} onChange={(y1) => onChange({ y1 })} suffix="mm" /><Field label="Punkt 2 X" value={command.x2} onChange={(x2) => onChange({ x2 })} suffix="mm" /><Field label="Punkt 2 Y" value={command.y2} onChange={(y2) => onChange({ y2 })} suffix="mm" />{command.definition === 'threePoints' && <><Field label="Punkt 3 X" value={command.x3} onChange={(x3) => onChange({ x3 })} suffix="mm" /><Field label="Punkt 3 Y" value={command.y3} onChange={(y3) => onChange({ y3 })} suffix="mm" /></>}</>}
          </>
        )}
        {isArc && <><Field label={command.definition === 'centerStartEnd' ? 'Środek X' : 'Początek X'} value={command.x1} onChange={(x1) => onChange({ x1 })} suffix="mm" autoFocus /><Field label={command.definition === 'centerStartEnd' ? 'Środek Y' : 'Początek Y'} value={command.y1} onChange={(y1) => onChange({ y1 })} suffix="mm" /><Field label={command.definition === 'centerStartEnd' ? 'Początek X' : 'Punkt łuku X'} value={command.x2} onChange={(x2) => onChange({ x2 })} suffix="mm" /><Field label={command.definition === 'centerStartEnd' ? 'Początek Y' : 'Punkt łuku Y'} value={command.y2} onChange={(y2) => onChange({ y2 })} suffix="mm" /><Field label="Koniec X" value={command.x3} onChange={(x3) => onChange({ x3 })} suffix="mm" /><Field label="Koniec Y" value={command.y3} onChange={(y3) => onChange({ y3 })} suffix="mm" />{command.definition === 'centerStartEnd' && <label className="command-field"><span>Kierunek</span><select value={command.direction} onChange={(event) => onChange({ direction: event.target.value })}><option value="ccw">Przeciwnie do wskazówek</option><option value="cw">Zgodnie ze wskazówkami</option></select></label>}</>}
        {isPolygon && <>{command.definition === 'edge' ? <><Field label="Krawędź P1 X" value={command.x1} onChange={(x1) => onChange({ x1 })} suffix="mm" autoFocus /><Field label="Krawędź P1 Y" value={command.y1} onChange={(y1) => onChange({ y1 })} suffix="mm" /><Field label="Krawędź P2 X" value={command.x2} onChange={(x2) => onChange({ x2 })} suffix="mm" /><Field label="Krawędź P2 Y" value={command.y2} onChange={(y2) => onChange({ y2 })} suffix="mm" /></> : <><Field label="Promień" value={command.radius} onChange={(radius) => onChange({ radius })} suffix="mm" autoFocus /><Field label="Środek X" value={command.x} onChange={(x) => onChange({ x })} suffix="mm" /><Field label="Środek Y" value={command.y} onChange={(y) => onChange({ y })} suffix="mm" /><Field label="Obrót" value={command.rotation} onChange={(rotation) => onChange({ rotation })} suffix="°" /></>}<Field label="Liczba boków" value={command.sides} onChange={(sides) => onChange({ sides })} /></>}
        {isEllipse && <><Field label="Promień główny" value={command.majorRadius} onChange={(majorRadius) => onChange({ majorRadius })} suffix="mm" autoFocus /><Field label="Promień boczny" value={command.minorRadius} onChange={(minorRadius) => onChange({ minorRadius })} suffix="mm" /><Field label="Środek X" value={command.x} onChange={(x) => onChange({ x })} suffix="mm" /><Field label="Środek Y" value={command.y} onChange={(y) => onChange({ y })} suffix="mm" /><Field label="Obrót" value={command.rotation} onChange={(rotation) => onChange({ rotation })} suffix="°" />{command.definition === 'arc' && <><Field label="Kąt początku" value={command.startAngle} onChange={(startAngle) => onChange({ startAngle })} suffix="°" /><Field label="Kąt końca" value={command.endAngle} onChange={(endAngle) => onChange({ endAngle })} suffix="°" /><label className="command-field"><span>Kierunek</span><select value={command.direction} onChange={(event) => onChange({ direction: event.target.value })}><option value="ccw">Przeciwnie do wskazówek</option><option value="cw">Zgodnie ze wskazówkami</option></select></label></>}</>}
        {isSlot && <>{command.definition === 'arc' ? <><Field label="Środek X" value={command.x} onChange={(x) => onChange({ x })} suffix="mm" autoFocus /><Field label="Środek Y" value={command.y} onChange={(y) => onChange({ y })} suffix="mm" /><Field label="Promień osi" value={command.radius} onChange={(radius) => onChange({ radius })} suffix="mm" /><Field label="Kąt początku" value={command.startAngle} onChange={(startAngle) => onChange({ startAngle })} suffix="°" /><Field label="Kąt końca" value={command.endAngle} onChange={(endAngle) => onChange({ endAngle })} suffix="°" /><label className="command-field"><span>Kierunek</span><select value={command.direction} onChange={(event) => onChange({ direction: event.target.value })}><option value="ccw">Przeciwnie do wskazówek</option><option value="cw">Zgodnie ze wskazówkami</option></select></label></> : <><Field label="Punkt 1 X" value={command.x1} onChange={(x1) => onChange({ x1 })} suffix="mm" autoFocus /><Field label="Punkt 1 Y" value={command.y1} onChange={(y1) => onChange({ y1 })} suffix="mm" /><Field label="Punkt 2 X" value={command.x2} onChange={(x2) => onChange({ x2 })} suffix="mm" /><Field label="Punkt 2 Y" value={command.y2} onChange={(y2) => onChange({ y2 })} suffix="mm" />{command.definition === 'threePoints' && <><Field label="Punkt szerokości X" value={command.x3} onChange={(x3) => onChange({ x3 })} suffix="mm" /><Field label="Punkt szerokości Y" value={command.y3} onChange={(y3) => onChange({ y3 })} suffix="mm" /></>}</>}{command.definition !== 'threePoints' && <Field label="Szerokość" value={command.width} onChange={(width) => onChange({ width })} suffix="mm" />}</>}
        {isSpline && <Field label="Punkty X,Y" value={command.pointsText} onChange={(pointsText) => onChange({ pointsText })} autoFocus />}
        {isConic && <><Field label="Początek X" value={command.x1} onChange={(x1) => onChange({ x1 })} suffix="mm" autoFocus /><Field label="Początek Y" value={command.y1} onChange={(y1) => onChange({ y1 })} suffix="mm" /><Field label="Kontrola X" value={command.x2} onChange={(x2) => onChange({ x2 })} suffix="mm" /><Field label="Kontrola Y" value={command.y2} onChange={(y2) => onChange({ y2 })} suffix="mm" /><Field label="Koniec X" value={command.x3} onChange={(x3) => onChange({ x3 })} suffix="mm" /><Field label="Koniec Y" value={command.y3} onChange={(y3) => onChange({ y3 })} suffix="mm" /><Field label="Rho" value={command.rho} onChange={(rho) => onChange({ rho })} /><label className="command-field"><span>Ciągłość</span><select value={command.continuity} onChange={(event) => onChange({ continuity: event.target.value })}><option value="free">Swobodna (G0)</option><option value="tangent">Styczna (G1)</option><option value="curvature">Krzywizna (G2)</option></select></label></>}
        {isPoint && <><Field label="X" value={command.x} onChange={(x) => onChange({ x })} suffix="mm" autoFocus /><Field label="Y" value={command.y} onChange={(y) => onChange({ y })} suffix="mm" /><label className="command-field"><span>Rola</span><select value={command.role} onChange={(event) => onChange({ role: event.target.value })}><option value="standard">Referencja otworu</option><option value="construction">Konstrukcyjny</option></select></label></>}
        {(isExtrude || isRevolve || isSweep || isLoft || isRib || (isHole && command.placement !== 'face-edges')) && <Field label={isLoft ? 'Profil początkowy' : isRib ? 'Otwarty profil' : 'Profil'} value={profileName} disabled />}
        {isExtrude && (
          <>
            {!['through-all', 'to-object'].includes(command.extent) && <Field label={command.extent === 'symmetric' ? 'Długość całkowita' : 'Odległość'} value={command.distance} onChange={(distance) => onChange({ distance })} suffix="mm" autoFocus />}
            {command.extent === 'two-sides' && <Field label="Druga strona" value={command.secondDistance} onChange={(secondDistance) => onChange({ secondDistance })} suffix="mm" />}
            {command.extent === 'to-object' && <label className="command-field"><span>Obiekt docelowy</span><select value={command.targetReferenceId || ''} onChange={(event) => onChange({ targetReferenceId: event.target.value })}>{command.targetOptions.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label>}
            <Field label="Odsunięcie początku" value={command.startOffset} onChange={(startOffset) => onChange({ startOffset })} suffix="mm" />
            <label className="command-field"><span>Cienka ścianka</span><input type="checkbox" checked={Boolean(command.thin)} disabled={command.openChain} onChange={(event) => onChange({ thin: event.target.checked })} /></label>
            {command.thin && <><Field label="Grubość ścianki" value={command.wallThickness} onChange={(wallThickness) => onChange({ wallThickness })} suffix="mm" /><label className="command-field"><span>Strona ścianki</span><select value={command.wallSide} onChange={(event) => onChange({ wallSide: event.target.value })}><option value="inside">Do wewnątrz</option><option value="outside">Na zewnątrz</option><option value="symmetric">Symetrycznie</option></select></label>{command.openChain && <label className="command-field"><span>Zakończenie</span><select value={command.endCap} onChange={(event) => onChange({ endCap: event.target.value })}><option value="butt">Proste</option><option value="square">Wydłużone</option></select></label>}</>}
            <label className="command-field">
              <span>Operacja</span>
              <select value={command.operation} onChange={(event) => onChange({ operation: event.target.value })}>
                <option value="new">Nowa bryła</option>
                <option value="join">Połącz</option>
                <option value="cut">Wytnij</option>
                <option value="intersect">Część wspólna</option>
              </select>
            </label>
            <label className="command-field"><span>Kierunek</span><select value={command.extent} onChange={(event) => onChange({ extent: event.target.value })}><option value="one-side">Jedna strona</option><option value="two-sides">Dwie strony</option><option value="symmetric">Symetrycznie</option><option value="to-object" disabled={!command.targetOptions.length}>Do obiektu</option><option value="through-all" disabled={!['cut', 'intersect'].includes(command.operation)}>Through All</option></select></label>
          </>
        )}
        {isRevolve && <><label className="command-field"><span>Oś obrotu</span><select value={command.axisId} onChange={(event) => onChange({ axisId: event.target.value })}>{command.axisOptions.map((axis) => <option key={axis.id} value={axis.id}>{axis.name}</option>)}</select></label><Field label="Kąt Revolve" value={command.angle} onChange={(angle) => onChange({ angle })} suffix="°" autoFocus /><label className="command-field"><span>Operacja</span><select value={command.operation} onChange={(event) => onChange({ operation: event.target.value })}><option value="new">Nowa bryła</option><option value="join">Połącz</option><option value="cut">Wytnij</option><option value="intersect">Część wspólna</option></select></label></>}
        {isSweep && <><label className="command-field"><span>Ścieżka Sweep</span><select value={command.pathSketchId} onChange={(event) => onChange({ pathSketchId: event.target.value, pathEntityIds: command.pathOptions.find((path) => path.id === event.target.value)?.entityIds || [] })}>{command.pathOptions.map((path) => <option key={path.id} value={path.id}>{path.name}</option>)}</select></label><label className="command-field"><span>Operacja</span><select value={command.operation} onChange={(event) => onChange({ operation: event.target.value })}><option value="new">Nowa bryła</option><option value="join">Połącz</option><option value="cut">Wytnij</option><option value="intersect">Część wspólna</option></select></label></>}
        {isLoft && <><label className="command-field"><span>Profil końcowy</span><select value={command.endProfileId} onChange={(event) => { const target = command.profileOptions.find((profile) => profile.id === event.target.value); onChange({ endProfileId: target?.id || '', endSketchId: target?.sketchId || '' }); }}>{command.profileOptions.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label><label className="command-field"><span>Przejście</span><select value={command.loftMode} onChange={(event) => onChange({ loftMode: event.target.value })}><option value="smooth">Gładkie</option><option value="ruled">Odcinkowe</option></select></label><label className="command-field"><span>Operacja</span><select value={command.operation} onChange={(event) => onChange({ operation: event.target.value })}><option value="new">Nowa bryła</option><option value="join">Połącz</option><option value="cut">Wytnij</option><option value="intersect">Część wspólna</option></select></label></>}
        {isRib && <><label className="command-field"><span>Typ</span><select value={command.ribMode} onChange={(event) => onChange({ ribMode: event.target.value })}><option value="rib">Rib · wzrost w płaszczyźnie</option><option value="web">Web · wzrost prostopadły</option></select></label><Field label="Grubość" value={command.thickness} onChange={(thickness) => onChange({ thickness })} suffix="mm" autoFocus /><Field label="Zasięg" value={command.depth} onChange={(depth) => onChange({ depth })} suffix="mm" /><label className="command-field"><span>Strona</span><select value={command.wallSide} onChange={(event) => onChange({ wallSide: event.target.value })}><option value="inside">Lewa</option><option value="outside">Prawa</option><option value="symmetric">Symetrycznie</option></select></label><label className="command-field"><span>Odwróć kierunek</span><input type="checkbox" checked={Boolean(command.reverse)} onChange={(event) => onChange({ reverse: event.target.checked })} /></label></>}
        {isCoil && <><label className="command-field"><span>Oś Coil</span><select value={command.axisId} onChange={(event) => onChange({ axisId: event.target.value })}>{command.axisOptions.map((axis) => <option key={axis.id} value={axis.id}>{axis.name}</option>)}</select></label><Field label="Średnica Coil" value={command.coilDiameter} onChange={(coilDiameter) => onChange({ coilDiameter })} suffix="mm" autoFocus /><Field label="Średnica przekroju" value={command.wireDiameter} onChange={(wireDiameter) => onChange({ wireDiameter })} suffix="mm" /><Field label="Skok" value={command.pitch} onChange={(pitch) => onChange({ pitch })} suffix="mm" /><Field label="Liczba zwojów" value={command.turns} onChange={(turns) => onChange({ turns })} /><label className="command-field"><span>Kierunek zwoju</span><select value={command.handedness} onChange={(event) => onChange({ handedness: event.target.value })}><option value="right">Prawoskrętny</option><option value="left">Lewoskrętny</option></select></label><label className="command-field"><span>Operacja</span><select value={command.operation} onChange={(event) => onChange({ operation: event.target.value })}><option value="new">Nowa bryła</option><option value="join">Połącz</option><option value="cut">Wytnij</option><option value="intersect">Część wspólna</option></select></label></>}
        {isPipe && <><Field label="Ścieżka Pipe" value={profileName} disabled /><Field label="Średnica zewnętrzna" value={command.outsideDiameter} onChange={(outsideDiameter) => onChange({ outsideDiameter })} suffix="mm" autoFocus /><Field label="Grubość ścianki" value={command.wallThickness} onChange={(wallThickness) => onChange({ wallThickness })} suffix="mm" /><label className="command-field"><span>Operacja</span><select value={command.operation} onChange={(event) => onChange({ operation: event.target.value })}><option value="new">Nowa bryła</option><option value="join">Połącz</option><option value="cut">Wytnij</option><option value="intersect">Część wspólna</option></select></label></>}
        {isPattern && <><Field label="Bryła źródłowa" value={command.targetBodyId} disabled /><label className="command-field"><span>Typ szyku</span><select value={command.patternType} onChange={(event) => onChange({ patternType: event.target.value })}><option value="rectangular">Prostokątny</option><option value="circular">Kołowy</option><option value="path" disabled={!command.pathOptions.length}>Po ścieżce</option></select></label>{command.patternType === 'rectangular' && <><Field label="Kolumny" value={command.countX} onChange={(countX) => onChange({ countX })} /><Field label="Wiersze" value={command.countY} onChange={(countY) => onChange({ countY })} /><Field label="Odstęp X" value={command.spacingX} onChange={(spacingX) => onChange({ spacingX })} suffix="mm" /><Field label="Odstęp Y" value={command.spacingY} onChange={(spacingY) => onChange({ spacingY })} suffix="mm" /></>}{command.patternType === 'circular' && <><label className="command-field"><span>Oś szyku</span><select value={command.axisId} onChange={(event) => onChange({ axisId: event.target.value })}>{command.axisOptions.map((axis) => <option key={axis.id} value={axis.id}>{axis.name}</option>)}</select></label><Field label="Wystąpienia" value={command.occurrences} onChange={(occurrences) => onChange({ occurrences })} /><Field label="Kąt całkowity" value={command.totalAngle} onChange={(totalAngle) => onChange({ totalAngle })} suffix="°" /></>}{command.patternType === 'path' && <><label className="command-field"><span>Ścieżka</span><select value={command.pathSketchId} onChange={(event) => { const path = command.pathOptions.find((item) => item.id === event.target.value); onChange({ pathSketchId: path?.id, pathEntityIds: path?.entityIds || [] }); }}>{command.pathOptions.map((path) => <option key={path.id} value={path.id}>{path.name}</option>)}</select></label><Field label="Wystąpienia" value={command.occurrences} onChange={(occurrences) => onChange({ occurrences })} /></>}</>}
        {isBoolean && (
          <>
            <Field label="Bryła bazowa" value={command.targetName || command.targetBodyId} disabled />
            <Field label="Bryła narzędziowa" value={command.toolName || command.toolBodyId} disabled />
            <label className="command-field"><span>Operacja</span><select value={command.operation} onChange={(event) => onChange({ operation: event.target.value })}><option value="union">Union</option><option value="subtract">Subtract</option><option value="intersect">Intersect</option></select></label>
          </>
        )}
        {isPrimitive && (
          <>
            <Field label="Nazwa" value={command.name} onChange={(name) => onChange({ name })} />
            <label className="command-field"><span>Typ</span><select value={command.primitiveType} onChange={(event) => onChange({ primitiveType: event.target.value })}><option value="box">Box</option><option value="cylinder">Cylinder</option><option value="sphere">Sphere</option><option value="torus">Torus</option></select></label>
            {command.primitiveType === 'box' && <><Field label="Szerokość" value={command.width} onChange={(width) => onChange({ width })} suffix="mm" autoFocus /><Field label="Głębokość" value={command.depth} onChange={(depth) => onChange({ depth })} suffix="mm" /><Field label="Wysokość" value={command.height} onChange={(height) => onChange({ height })} suffix="mm" /></>}
            {command.primitiveType === 'cylinder' && <><Field label="Promień" value={command.radius} onChange={(radius) => onChange({ radius })} suffix="mm" autoFocus /><Field label="Wysokość" value={command.height} onChange={(height) => onChange({ height })} suffix="mm" /></>}
            {command.primitiveType === 'sphere' && <Field label="Promień" value={command.radius} onChange={(radius) => onChange({ radius })} suffix="mm" autoFocus />}
            {command.primitiveType === 'torus' && <><Field label="Promień główny" value={command.majorRadius} onChange={(majorRadius) => onChange({ majorRadius })} suffix="mm" autoFocus /><Field label="Promień przekroju" value={command.minorRadius} onChange={(minorRadius) => onChange({ minorRadius })} suffix="mm" /></>}
            <Field label="Położenie X" value={command.x} onChange={(x) => onChange({ x })} suffix="mm" />
            <Field label="Położenie Y" value={command.y} onChange={(y) => onChange({ y })} suffix="mm" />
            <Field label="Położenie Z" value={command.z} onChange={(z) => onChange({ z })} suffix="mm" />
          </>
        )}
        {isTransform && (command.mode === 'move' ? <><Field label="Przesunięcie X" value={command.x} onChange={(x) => onChange({ x })} suffix="mm" autoFocus /><Field label="Przesunięcie Y" value={command.y} onChange={(y) => onChange({ y })} suffix="mm" /><Field label="Przesunięcie Z" value={command.z} onChange={(z) => onChange({ z })} suffix="mm" /></> : <><Field label="Kąt Z" value={command.angle} onChange={(angle) => onChange({ angle })} suffix="°" autoFocus /><Field label="Środek X" value={command.originX} onChange={(originX) => onChange({ originX })} suffix="mm" /><Field label="Środek Y" value={command.originY} onChange={(originY) => onChange({ originY })} suffix="mm" /><Field label="Środek Z" value={command.originZ} onChange={(originZ) => onChange({ originZ })} suffix="mm" /></>)}
        {isOffsetFace && <><Field label="Ściana" value={command.faceLabel || '1 wskazana'} disabled /><Field label="Odległość" value={command.distance} onChange={(distance) => onChange({ distance })} suffix="mm" autoFocus /></>}
        {isTextSolid && <><Field label="Tekst" value={command.text} onChange={(text) => onChange({ text })} autoFocus /><Field label="Rozmiar" value={command.fontSize} onChange={(fontSize) => onChange({ fontSize })} suffix="mm" /><Field label="Głębokość" value={command.depth} onChange={(depth) => onChange({ depth })} suffix="mm" /><label className="command-field"><span>Operacja</span><select value={command.operation} onChange={(event) => onChange({ operation: event.target.value })}><option value="new">Nowa bryła</option><option value="emboss" disabled={!command.targetBodyId}>Emboss — wypukły</option><option value="deboss" disabled={!command.targetBodyId}>Deboss — wklęsły</option></select></label>{command.placement === 'face' && <Field label="Powierzchnia" value="Planarna ściana (trwała referencja)" disabled />}<Field label="Położenie X" value={command.x} onChange={(x) => onChange({ x })} suffix="mm" /><Field label="Położenie Y" value={command.y} onChange={(y) => onChange({ y })} suffix="mm" />{command.placement !== 'face' && <Field label={command.operation === 'new' ? 'Położenie Z' : 'Powierzchnia Z'} value={command.z} onChange={(z) => onChange({ z })} suffix="mm" />}</>}
        {isHole && (
          <>
            {command.placement === 'face-edges' && <><Field label="Pozycjonowanie" value="Ściana + 2 krawędzie" disabled /><Field label="Od krawędzi 1" value={command.firstOffset} onChange={(firstOffset) => onChange({ firstOffset })} suffix="mm" autoFocus /><Field label="Od krawędzi 2" value={command.secondOffset} onChange={(secondOffset) => onChange({ secondOffset })} suffix="mm" /></>}
            <label className="command-field"><span>Typ otworu</span><select value={command.holeType} onChange={(event) => onChange({ holeType: event.target.value })}><option value="simple">Prosty</option><option value="counterbore">Counterbore</option><option value="countersink">Countersink</option></select></label>
            <Field label="Średnica" value={command.diameter} onChange={(diameter) => onChange({ diameter })} suffix="mm" autoFocus />
            <label className="command-field"><span>Zakres</span><select value={command.extent} onChange={(event) => onChange({ extent: event.target.value })}><option value="distance">Distance</option><option value="through-all">Through All</option></select></label>
            {command.extent === 'distance' && <Field label="Głębokość" value={command.depth} onChange={(depth) => onChange({ depth })} suffix="mm" />}
            {command.holeType === 'counterbore' && <><Field label="Średnica Counterbore" value={command.counterboreDiameter} onChange={(counterboreDiameter) => onChange({ counterboreDiameter })} suffix="mm" /><Field label="Głębokość Counterbore" value={command.counterboreDepth} onChange={(counterboreDepth) => onChange({ counterboreDepth })} suffix="mm" /></>}
            {command.holeType === 'countersink' && <><Field label="Średnica Countersink" value={command.countersinkDiameter} onChange={(countersinkDiameter) => onChange({ countersinkDiameter })} suffix="mm" /><Field label="Kąt Countersink" value={command.countersinkAngle} onChange={(countersinkAngle) => onChange({ countersinkAngle })} suffix="°" /></>}
            <label className="command-field"><span>Gwint</span><select value={command.threadMode} onChange={(event) => onChange({ threadMode: event.target.value })}><option value="none">Brak</option><option value="cosmetic">Kosmetyczny</option><option value="modeled">Modelowany</option></select></label>
            {command.threadMode !== 'none' && <><Field label="Średnica gwintu" value={command.threadDiameter} onChange={(threadDiameter) => onChange({ threadDiameter })} suffix="mm" /><Field label="Skok gwintu" value={command.threadPitch} onChange={(threadPitch) => onChange({ threadPitch })} suffix="mm" /><Field label="Długość gwintu" value={command.threadLength} onChange={(threadLength) => onChange({ threadLength })} suffix="mm" /><label className="command-field"><span>Kierunek gwintu</span><select value={command.threadDirection} onChange={(event) => onChange({ threadDirection: event.target.value })}><option value="right">Prawy</option><option value="left">Lewy</option></select></label></>}
            <label className="command-field"><span>Profil luzu</span><select value={command.clearanceProfile} onChange={(event) => onChange({ clearanceProfile: event.target.value })}><option value="nominal">Nominalny</option><option value="fff">FFF</option></select></label>
            {command.clearanceProfile === 'fff' && <Field label="Luz promieniowy FFF" value={command.clearance} onChange={(clearance) => onChange({ clearance })} suffix="mm" />}
          </>
        )}
        {(isFillet || command.type === 'chamfer') && (
          <Field label={isFillet ? 'Promień' : 'Odległość'} value={command.size} onChange={(size) => onChange({ size })} suffix="mm" autoFocus />
        )}
        {isShell && <><Field label="Usuwane ściany" value={`${command.faceCount || 0}`} disabled /><Field label="Grubość" value={command.thickness} onChange={(thickness) => onChange({ thickness })} suffix="mm" autoFocus /></>}
        {isDraftFeature && <><Field label="Pochylane ściany" value={`${command.faceCount || 0}`} disabled /><label className="command-field"><span>Płaszczyzna neutralna</span><select value={command.neutralPlaneId} onChange={(event) => onChange({ neutralPlaneId: event.target.value })}>{command.neutralPlaneOptions.map((plane) => <option key={plane.id} value={plane.id}>{plane.name}</option>)}</select></label><Field label="Kąt Draft" value={command.angle} onChange={(angle) => onChange({ angle })} suffix="°" autoFocus /></>}
        {isSplitBody && <><Field label="Bryła dzielona" value={command.targetName || command.targetBodyId} disabled /><label className="command-field"><span>Płaszczyzna podziału</span><select value={command.planeId} onChange={(event) => onChange({ planeId: event.target.value })}>{command.planeOptions.map((plane) => <option key={plane.id} value={plane.id}>{plane.name}</option>)}</select></label></>}
        {isSplitFace && <><Field label="Profil podziału" value={command.profileName || command.profileId} disabled /><Field label="Ściana dzielona" value={command.faceName || 'Planarna ściana szkicu'} disabled /></>}
        {isDeleteFace && <><Field label="Usuwane regiony" value={`${command.faceCount || 0}`} disabled /><p className="command-hint">Operacja scala wskazane regiony z sąsiednimi ścianami leżącymi na tej samej powierzchni.</p></>}
        {isReplaceFace && <><Field label="Ściana zastępowana" value={command.sourceName || 'Pierwsza zaznaczona ściana'} disabled /><Field label="Powierzchnia docelowa" value={command.destinationName || 'Druga zaznaczona ściana'} disabled /><p className="command-hint">Planarne i równoległe ściany mogą należeć do dwóch różnych brył; bryła powierzchni docelowej pozostaje bez zmian.</p></>}
        {isConstructionPlane && (
          <>
            <Field label="Nazwa" value={command.name} onChange={(name) => onChange({ name })} autoFocus />
            {(isOffsetPlane || isMidplane || isAnglePlane) && <label className="command-field"><span>Płaszczyzna bazowa</span><select value={command.basePlane} onChange={(event) => onChange({ basePlane: event.target.value })}><option value="XY">Góra (XY)</option><option value="XZ">Przód (XZ)</option><option value="YZ">Prawo (YZ)</option></select></label>}
            {isOffsetPlane && <Field label="Odległość" value={command.offset} onChange={(offset) => onChange({ offset })} suffix="mm" />}
            {isMidplane && <><Field label="Położenie A" value={command.firstOffset} onChange={(firstOffset) => onChange({ firstOffset })} suffix="mm" /><Field label="Położenie B" value={command.secondOffset} onChange={(secondOffset) => onChange({ secondOffset })} suffix="mm" /></>}
            {isThreePointPlane && <>{[1, 2, 3].map((index) => <React.Fragment key={index}><Field label={`Punkt ${index} X`} value={command[`x${index}`]} onChange={(value) => onChange({ [`x${index}`]: value })} suffix="mm" /><Field label={`Punkt ${index} Y`} value={command[`y${index}`]} onChange={(value) => onChange({ [`y${index}`]: value })} suffix="mm" /><Field label={`Punkt ${index} Z`} value={command[`z${index}`]} onChange={(value) => onChange({ [`z${index}`]: value })} suffix="mm" /></React.Fragment>)}</>}
            {isAnglePlane && <><label className="command-field"><span>Oś obrotu</span><select value={command.rotationAxis} onChange={(event) => onChange({ rotationAxis: event.target.value })}><option value="u">Oś U</option><option value="v">Oś V</option></select></label><Field label="Kąt" value={command.angle} onChange={(angle) => onChange({ angle })} suffix="°" /><Field label="Odległość" value={command.offset} onChange={(offset) => onChange({ offset })} suffix="mm" /></>}
            {isTangentPlane && <><label className="command-field"><span>Powierzchnia</span><select value={command.surfaceType} onChange={(event) => onChange({ surfaceType: event.target.value })}><option value="sphere">Sfera</option><option value="cylinder">Walec</option></select></label>{['X', 'Y', 'Z'].map((axis, index) => <React.Fragment key={`tangent-${axis}`}><Field label={`Środek ${axis}`} value={command[`center${index}`]} onChange={(value) => onChange({ [`center${index}`]: value })} suffix="mm" /><Field label={`Styczność ${axis}`} value={command[`point${index}`]} onChange={(value) => onChange({ [`point${index}`]: value })} suffix="mm" />{command.surfaceType === 'cylinder' && <Field label={`Oś ${axis}`} value={command[`axis${index}`]} onChange={(value) => onChange({ [`axis${index}`]: value })} />}</React.Fragment>)}</>}
            {isPathPlane && <>{['X', 'Y', 'Z'].map((axis, index) => <React.Fragment key={`path-${axis}`}><Field label={`Punkt ścieżki ${axis}`} value={command[`point${index}`]} onChange={(value) => onChange({ [`point${index}`]: value })} suffix="mm" /><Field label={`Kierunek ścieżki ${axis}`} value={command[`direction${index}`]} onChange={(value) => onChange({ [`direction${index}`]: value })} /></React.Fragment>)}</>}
            <label className="command-field"><span>Widoczna</span><select value={command.visible ? 'yes' : 'no'} onChange={(event) => onChange({ visible: event.target.value === 'yes' })}><option value="yes">Tak</option><option value="no">Nie</option></select></label>
          </>
        )}
        {isConstructionAxis && (
          <>
            <Field label="Nazwa" value={command.name} onChange={(name) => onChange({ name })} autoFocus />
            {['edge', 'two-points'].includes(command.axisType) && <>{[1, 2].map((index) => <React.Fragment key={index}><Field label={`Punkt ${index} X`} value={command[`x${index}`]} onChange={(value) => onChange({ [`x${index}`]: value })} suffix="mm" /><Field label={`Punkt ${index} Y`} value={command[`y${index}`]} onChange={(value) => onChange({ [`y${index}`]: value })} suffix="mm" /><Field label={`Punkt ${index} Z`} value={command[`z${index}`]} onChange={(value) => onChange({ [`z${index}`]: value })} suffix="mm" /></React.Fragment>)}</>}
            {command.axisType === 'cylinder' && <>{['X', 'Y', 'Z'].map((axis, index) => <Field key={`origin-${axis}`} label={`Środek ${axis}`} value={command[`origin${index}`]} onChange={(value) => onChange({ [`origin${index}`]: value })} suffix="mm" />)}{['X', 'Y', 'Z'].map((axis, index) => <Field key={`direction-${axis}`} label={`Kierunek ${axis}`} value={command[`direction${index}`]} onChange={(value) => onChange({ [`direction${index}`]: value })} />)}</>}
            {command.axisType === 'plane-intersection' && <><label className="command-field"><span>Płaszczyzna A</span><select value={command.planeId1} onChange={(event) => onChange({ planeId1: event.target.value })}>{command.planeOptions.map((plane) => <option key={plane.id} value={plane.id}>{plane.name}</option>)}</select></label><label className="command-field"><span>Płaszczyzna B</span><select value={command.planeId2} onChange={(event) => onChange({ planeId2: event.target.value })}>{command.planeOptions.map((plane) => <option key={plane.id} value={plane.id}>{plane.name}</option>)}</select></label></>}
            {command.axisType === 'plane-normal' && <><label className="command-field"><span>Płaszczyzna</span><select value={command.planeId1} onChange={(event) => onChange({ planeId1: event.target.value })}>{command.planeOptions.map((plane) => <option key={plane.id} value={plane.id}>{plane.name}</option>)}</select></label>{['X', 'Y', 'Z'].map((axis, index) => <Field key={`normal-origin-${axis}`} label={`Punkt osi ${axis}`} value={command[`origin${index}`]} onChange={(value) => onChange({ [`origin${index}`]: value })} suffix="mm" />)}</>}
            <label className="command-field"><span>Widoczna</span><select value={command.visible ? 'yes' : 'no'} onChange={(event) => onChange({ visible: event.target.value === 'yes' })}><option value="yes">Tak</option><option value="no">Nie</option></select></label>
          </>
        )}
        {isConstructionPoint && (
          <>
            <Field label="Nazwa" value={command.name} onChange={(name) => onChange({ name })} autoFocus />
            {['vertex', 'center'].includes(command.pointType) && <>{['X', 'Y', 'Z'].map((axis, index) => <Field key={axis} label={axis} value={command[`position${index}`]} onChange={(value) => onChange({ [`position${index}`]: value })} suffix="mm" />)}</>}
            {command.pointType === 'intersection' && <><label className="command-field"><span>Oś</span><select value={command.axisId} onChange={(event) => onChange({ axisId: event.target.value })}>{command.axisOptions.map((axis) => <option key={axis.id} value={axis.id}>{axis.name}</option>)}</select></label><label className="command-field"><span>Płaszczyzna</span><select value={command.planeId} onChange={(event) => onChange({ planeId: event.target.value })}>{command.planeOptions.map((plane) => <option key={plane.id} value={plane.id}>{plane.name}</option>)}</select></label></>}
            {command.pointType === 'midpoint' && <>{[1, 2].map((index) => <React.Fragment key={index}>{['X', 'Y', 'Z'].map((axis) => <Field key={`${index}-${axis}`} label={`Punkt ${index} ${axis}`} value={command[`${axis.toLowerCase()}${index}`]} onChange={(value) => onChange({ [`${axis.toLowerCase()}${index}`]: value })} suffix="mm" />)}</React.Fragment>)}</>}
            {command.pointType === 'on-axis' && <><label className="command-field"><span>Oś</span><select value={command.axisId} onChange={(event) => onChange({ axisId: event.target.value })}>{command.axisOptions.map((axis) => <option key={axis.id} value={axis.id}>{axis.name}</option>)}</select></label><Field label="Odległość na osi" value={command.distance} onChange={(distance) => onChange({ distance })} suffix="mm" /></>}
            <label className="command-field"><span>Widoczny</span><select value={command.visible ? 'yes' : 'no'} onChange={(event) => onChange({ visible: event.target.value === 'yes' })}><option value="yes">Tak</option><option value="no">Nie</option></select></label>
          </>
        )}
        {isSketchPath && (
          <>
          {command.lastPoint && <label className="sketch-length-entry"><span>Długość następnego odcinka</span><div><input type="text" inputMode="decimal" value={command.dynamicLength || ''} placeholder="np. 25" onChange={(event) => { const value = event.target.value.replace(',', '.'); if (/^\d*(?:\.\d*)?$/.test(value)) onChange({ dynamicLength: value }); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); onConfirmDynamic?.(); } }} /><span>mm</span><kbd>Enter</kbd></div></label>}
          <details className="sketch-path-exact">
            <summary><span>Dokładna długość i kąt</span><small>opcjonalnie</small></summary>
            <div>
              <Field label="Długość" value={command.length} onChange={(length) => onChange({ length })} suffix="mm" />
              <Field label="Kąt" value={command.angle} onChange={(angle) => onChange({ angle })} suffix="°" />
              <label className="command-field">
                <span>Segment</span>
                <select value={command.segmentMode} onChange={(event) => onChange({ segmentMode: event.target.value })}>
                  <option value="line">Linia</option>
                  <option value="tangentArc" disabled={!command.segmentIds.length}>Łuk styczny</option>
                </select>
              </label>
            </div>
          </details>
          </>
        )}
        {isSketchMove && (
          <>
            <Field label="Przesunięcie X" value={command.dx} onChange={(dx) => onChange({ dx })} suffix="mm" autoFocus />
            <Field label="Przesunięcie Y" value={command.dy} onChange={(dy) => onChange({ dy })} suffix="mm" />
          </>
        )}
        {isSketchOffset && (
          <>
            <Field label="Odległość" value={command.distance} onChange={(distance) => onChange({ distance })} suffix="mm" autoFocus />
            <p className="command-hint">Wartość dodatnia przesuwa w lewo od kierunku krzywej, ujemna — na drugą stronę.</p>
          </>
        )}
        {isSketchCorner && <Field label={command.mode === 'fillet' ? 'Promień' : 'Odległość'} value={command.size} onChange={(size) => onChange({ size })} suffix="mm" autoFocus />}
        {isSketchTransform && (
          <>
            <label className="command-field"><span>Operacja</span><select value={command.operation} onChange={(event) => onChange({ operation: event.target.value })}><option value="rotate">Rotate</option><option value="copy">Copy</option><option value="mirror">Mirror</option><option value="scale">Scale</option></select></label>
            {command.operation === 'copy' ? <><Field label="Kopia ΔX" value={command.dx} onChange={(dx) => onChange({ dx })} suffix="mm" autoFocus /><Field label="Kopia ΔY" value={command.dy} onChange={(dy) => onChange({ dy })} suffix="mm" /></> : command.operation === 'mirror' ? <><label className="command-field"><span>Oś odbicia</span><select value={command.axis} onChange={(event) => onChange({ axis: event.target.value })}><option value="vertical">Pionowa X</option><option value="horizontal">Pozioma Y</option></select></label><Field label="Położenie osi" value={command.axisOffset} onChange={(axisOffset) => onChange({ axisOffset })} suffix="mm" autoFocus /></> : <><Field label="Środek X" value={command.centerX} onChange={(centerX) => onChange({ centerX })} suffix="mm" autoFocus /><Field label="Środek Y" value={command.centerY} onChange={(centerY) => onChange({ centerY })} suffix="mm" />{command.operation === 'rotate' ? <Field label="Kąt obrotu" value={command.angle} onChange={(angle) => onChange({ angle })} suffix="°" /> : <Field label="Skala" value={command.factor} onChange={(factor) => onChange({ factor })} />}</>}
          </>
        )}
        {isSketchPattern && (
          <>
            <label className="command-field"><span>Typ szyku</span><select value={command.mode} onChange={(event) => onChange({ mode: event.target.value })}><option value="rectangular">Prostokątny</option><option value="circular">Kołowy</option><option value="path">Po ścieżce</option></select></label>
            {command.mode === 'rectangular' ? <><Field label="Kolumny" value={command.columns} onChange={(columns) => onChange({ columns })} autoFocus /><Field label="Wiersze" value={command.rows} onChange={(rows) => onChange({ rows })} /><Field label="Odstęp X" value={command.spacingX} onChange={(spacingX) => onChange({ spacingX })} suffix="mm" /><Field label="Odstęp Y" value={command.spacingY} onChange={(spacingY) => onChange({ spacingY })} suffix="mm" /></> : command.mode === 'circular' ? <><Field label="Wystąpienia" value={command.count} onChange={(count) => onChange({ count })} autoFocus /><Field label="Środek X" value={command.centerX} onChange={(centerX) => onChange({ centerX })} suffix="mm" /><Field label="Środek Y" value={command.centerY} onChange={(centerY) => onChange({ centerY })} suffix="mm" /><Field label="Kąt całkowity" value={command.totalAngle} onChange={(totalAngle) => onChange({ totalAngle })} suffix="°" /></> : <><label className="command-field"><span>Ścieżka</span><select value={command.pathEntityId} onChange={(event) => onChange({ pathEntityId: event.target.value })}>{command.pathOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><Field label="Wystąpienia" value={command.count} onChange={(count) => onChange({ count })} autoFocus /><label className="command-field"><span>Orientacja</span><select value={command.orientToPath ? 'path' : 'fixed'} onChange={(event) => onChange({ orientToPath: event.target.value === 'path' })}><option value="path">Zgodnie ze ścieżką</option><option value="fixed">Stała</option></select></label></>}
            <Field label="Pomiń wystąpienia" value={command.skippedOccurrences} onChange={(skippedOccurrences) => onChange({ skippedOccurrences })} />
            <p className="command-hint">Numery oddziel przecinkami lub podaj zakres, np. 3, 5-7. Wystąpienie 1 jest źródłem.</p>
          </>
        )}
        {!isSketchPath && <div className="command-preview-note"><span className="preview-dot" />{isSketchMove ? 'Wpisz dokładne przesunięcie zaznaczenia w osiach szkicu.' : isSketchOffset ? 'Operacja powstanie dopiero po zatwierdzeniu; Anuluj nie zmienia szkicu.' : isSketchCorner ? 'Oryginalne linie zachowają ID; zerwane więzy zostaną jawnie usunięte.' : isSketchTransform ? 'Transformacja jest transakcyjna; Scale odrzuca geometrię z blokującym wymiarem.' : isSketchPattern ? 'Szyk powstanie transakcyjnie; pominięte kopie nie zostaną utworzone.' : isConstructionPlane ? 'Współrzędne i odległości mogą być liczbami albo wyrażeniami z parametrów modelu.' : isPoint ? 'Kliknij położenie na płótnie. Pola X/Y są opcjonalnym wejściem dokładnym.' : isMechanicalShape ? 'Klikaj punkty figury na płótnie. Pola pozostają opcjonalnym wejściem dokładnym.' : isExtrude ? 'Przeciągnij niebieską strzałkę na modelu albo wpisz dokładną odległość.' : 'Podgląd jest przeliczany na dokładnej bryle B-Rep.'}</div>}
      </div>
      {isSketchPath ? (
        <footer><button className="secondary" type="button" onClick={onUndoSegment} disabled={!command.pointIds.length}>Cofnij segment</button><button className="secondary" type="button" onClick={onFinishPath}>Zakończ</button><button className="confirm" type="button" onClick={onConfirm} disabled={!command.lastPoint}><Check size={14} /> Dodaj dokładnie</button></footer>
      ) : (
        <footer><button className="secondary" type="button" onClick={onCancel}>Anuluj</button><button className="confirm" type="button" onClick={onConfirm} disabled={featurePreviewPending} aria-busy={featurePreviewPending} title={featurePreviewPending ? 'Trwa obliczanie podglądu operacji' : undefined}><Check size={14} /> {featurePreviewPending ? 'Obliczanie…' : isMechanicalShape || isPoint ? 'Utwórz z danych' : 'OK'}</button></footer>
      )}
      </>}
    </section>
  );
}

function PlanePicker({ onPick, onCancel }) {
  return (
    <section className="plane-picker" aria-label="Wybierz płaszczyznę szkicu">
      <header><div><strong>Wybierz płaszczyznę szkicu</strong><span>Wskaż jedną z płaszczyzn początku.</span></div><button type="button" onClick={onCancel} title="Anuluj"><X size={17} /></button></header>
      <div className="plane-options">
        {Object.entries(PLANE_LABELS).map(([plane, label]) => (
          <button key={plane} type="button" onClick={() => onPick(plane)}>
            <Frame size={28} strokeWidth={1.25} /><strong>{plane}</strong><span>{label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ParametersDialog({ document, commit, onClose }) {
  const add = () => {
    let number = document.parameters.length + 1;
    while (document.parameters.some((item) => item.name === `parametr${number}`)) number += 1;
    commit((next) => next.parameters.push(createParameter(`parametr${number}`, 10, 'mm', `Parametr ${number}`)));
  };
  return (
    <section className="parameters-dialog" aria-label="Parametry użytkownika">
      <header><div><strong>Parametry</strong><span>Steruj wymiarami modelu z jednego miejsca.</span></div><button type="button" onClick={onClose} title="Zamknij"><X size={16} /></button></header>
      <div className="parameter-table">
        <div className="parameter-head"><span>Nazwa</span><span>Wyrażenie</span><span>Jednostka</span></div>
        {document.parameters.map((parameter) => (
          <div className="parameter-row" key={parameter.id}>
            <input value={parameter.label} aria-label="Etykieta parametru" onChange={(event) => commit((next) => { next.parameters.find((item) => item.id === parameter.id).label = event.target.value; })} />
            <input value={parameter.expression} aria-label={`Wyrażenie ${parameter.label}`} onChange={(event) => commit((next) => { next.parameters.find((item) => item.id === parameter.id).expression = event.target.value; })} />
            <span>{parameter.unit}</span>
          </div>
        ))}
        {!document.parameters.length && <p className="empty-parameters">Brak parametrów użytkownika.</p>}
      </div>
      <footer><button className="secondary" type="button" onClick={add}>Dodaj parametr</button><button className="confirm" type="button" onClick={onClose}><Check size={14} /> Gotowe</button></footer>
    </section>
  );
}

function SketchPalette({ options, onChange, onFinish }) {
  const [expanded, setExpanded] = useState(false);
  const basicItems = [
    ['grid', 'Siatka szkicu'],
    ['snap', 'Przyciąganie'],
    ['profiles', 'Profile'],
    ['points', 'Punkty'],
    ['dimensions', 'Wymiary'],
    ['constraints', 'Wiązania'],
  ];
  const advancedItems = [
    ['construction', 'Geometrie konstrukcyjne'],
    ['projected', 'Geometria Project'],
    ['slice', 'Slice modelu'],
    ['sketch3d', 'Szkic 3D'],
  ];
  return (
    <aside className={`sketch-palette ${expanded ? '' : 'collapsed'}`}>
      <header>
        <div className="sketch-palette-heading"><strong>PALETA SZKICU</strong><span className={options.snap ? 'active' : ''}>{options.snap ? `SNAP ${options.snapDistance}px` : 'SNAP WYŁ.'}</span></div>
        <button className="sketch-palette-toggle" type="button" title={expanded ? 'Zwiń paletę szkicu' : 'Rozwiń paletę szkicu'} aria-label={expanded ? 'Zwiń paletę szkicu' : 'Rozwiń paletę szkicu'} aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
      </header>
      {expanded && <div className="sketch-palette-body">
        <h3>Widok i snap</h3>
        {basicItems.map(([key, label]) => (
          <label key={key} data-sketch-option={key}><span>{label}</span><input type="checkbox" checked={Boolean(options[key])} onChange={(event) => onChange(key, event.target.checked)} /></label>
        ))}
        <label className="sketch-snap-threshold">
          <span>Próg snap <output>{options.snapDistance}px</output></span>
          <input type="range" min="4" max="24" step="1" value={options.snapDistance} disabled={!options.snap} onChange={(event) => onChange('snapDistance', Number(event.target.value))} />
        </label>
        <details className="sketch-advanced-options">
          <summary>Opcje zaawansowane</summary>
          {advancedItems.map(([key, label]) => (
            <label key={key} data-sketch-option={key}><span>{label}</span><input type="checkbox" checked={Boolean(options[key])} onChange={(event) => onChange(key, event.target.checked)} /></label>
          ))}
        </details>
        <div className="sketch-state-legend" aria-label="Legenda stanów geometrii szkicu">
          <h3>Stany geometrii</h3>
          <span><i className="under" /> Niedowiązana</span>
          <span><i className="fixed" /> W pełni związana</span>
          <span><i className="construction" /> Konstrukcyjna</span>
          <span><i className="projected" /> Rzutowana</span>
          <span><i className="selected" /> Zaznaczona</span>
          <span><i className="error" /> Błąd geometrii</span>
        </div>
      </div>}
      {expanded && <footer><button type="button" onClick={onFinish}>Zakończ szkic</button></footer>}
    </aside>
  );
}

function PrintPanel({ document, bodies, engine, selectedFace, commit, collapsed, onSelectIssue, onExport, onSendToSlicer, onClose, onToggleCollapsed, readOnly = false }) {
  const layoutResult = useMemo(() => calculatePrintLayout(bodies, document.print), [bodies, document.print]);
  const printAnalysis = useMemo(() => analyzePrintability(bodies, document.print), [bodies, document.print]);
  const bounds = layoutResult.dimensions;
  const fits = printAnalysis.fitsBed;
  const updateBed = (key, value) => commit((next) => { next.print[key] = Math.max(1, Number(value) || 1); next.print.profileId = 'custom'; });
  const updateLayout = (key, value) => commit((next) => {
    const parsed = Number(value);
    if (key === 'scale') next.print[key] = Math.max(0.01, Number.isFinite(parsed) ? parsed : 1);
    else if (key === 'copies') next.print[key] = Math.max(1, Math.min(100, Math.round(Number.isFinite(parsed) ? parsed : 1)));
    else if (key === 'copySpacing') next.print[key] = Math.max(0, Number.isFinite(parsed) ? parsed : 0);
    else next.print[key] = Number.isFinite(parsed) ? parsed : 0;
  });
  const updateAnalysis = (key, value) => commit((next) => {
    const parsed = Number(value);
    next.print[key] = key === 'overhangAngle'
      ? Math.max(0, Math.min(89, Number.isFinite(parsed) ? parsed : 45))
      : Math.max(0.05, Number.isFinite(parsed) ? parsed : 0.4);
  });
  const selectProfile = (profileId) => commit((next) => { next.print = applyPrinterProfile(next.print, profileId); });
  const orientToSelectedFace = () => commit((next) => {
    const orientation = orientationForBedFace(selectedFace.normal);
    const candidate = {
      ...next.print,
      rotationX: 0, rotationY: 0, rotationZ: 0,
      positionZ: 0,
      orientationAxis: orientation.axis,
      orientationAngle: orientation.angle,
    };
    const result = calculatePrintLayout(bodies, candidate);
    next.print = { ...candidate, positionZ: -result.min[2] };
  });
  const resetLayout = () => commit((next) => {
    Object.assign(next.print, {
      positionX: 0, positionY: 0, positionZ: 0,
      rotationX: 0, rotationY: 0, rotationZ: 0,
      scale: 1, copies: 1, copySpacing: 10,
      orientationAxis: [0, 0, 1], orientationAngle: 0,
    });
  });
  return (
    <aside className={`print-panel print-inspector ${collapsed ? 'collapsed' : ''}`}>
      <header>
        <div><strong>EKSPORT I DRUK 3D</strong>{!collapsed && <span>Wymiana CAD, eksport siatek i opcjonalna kontrola wydruku.</span>}</div>
        <div className="dock-panel-actions">
          <button type="button" data-panel-action="collapse" onClick={onToggleCollapsed} title={collapsed ? 'Rozwiń panel eksportu' : 'Zwiń panel eksportu'} aria-label={collapsed ? 'Rozwiń panel eksportu' : 'Zwiń panel eksportu'} aria-expanded={!collapsed}>{collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}</button>
          {!collapsed && <button type="button" onClick={onClose} title="Zamknij panel eksportu" aria-label="Zamknij panel eksportu"><X size={16} /></button>}
        </div>
      </header>
      {!collapsed && <>
      <div className="print-section">
        <h3>Objętość robocza</h3>
        <label className="command-field"><span>Profil drukarki</span><select value={document.print.profileId || 'custom'} onChange={(event) => selectProfile(event.target.value)} disabled={readOnly}>{PRINTER_PROFILES.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}<option value="custom">Własny</option></select></label>
        <Field type="number" label="Szerokość X" value={document.print.bedWidth} suffix="mm" onChange={(value) => updateBed('bedWidth', value)} disabled={readOnly} />
        <Field type="number" label="Głębokość Y" value={document.print.bedDepth} suffix="mm" onChange={(value) => updateBed('bedDepth', value)} disabled={readOnly} />
        <Field type="number" label="Wysokość Z" value={document.print.bedHeight} suffix="mm" onChange={(value) => updateBed('bedHeight', value)} disabled={readOnly} />
      </div>
      <div className="print-section">
        <h3>Układ części</h3>
        <div className="print-field-grid">
          <Field type="number" label="Pozycja X" value={document.print.positionX ?? 0} suffix="mm" onChange={(value) => updateLayout('positionX', value)} disabled={readOnly} />
          <Field type="number" label="Pozycja Y" value={document.print.positionY ?? 0} suffix="mm" onChange={(value) => updateLayout('positionY', value)} disabled={readOnly} />
          <Field type="number" label="Pozycja Z" value={document.print.positionZ ?? 0} suffix="mm" onChange={(value) => updateLayout('positionZ', value)} disabled={readOnly} />
          <Field type="number" label="Obrót X" value={document.print.rotationX ?? 0} suffix="°" onChange={(value) => updateLayout('rotationX', value)} disabled={readOnly} />
          <Field type="number" label="Obrót Y" value={document.print.rotationY ?? 0} suffix="°" onChange={(value) => updateLayout('rotationY', value)} disabled={readOnly} />
          <Field type="number" label="Obrót Z" value={document.print.rotationZ ?? 0} suffix="°" onChange={(value) => updateLayout('rotationZ', value)} disabled={readOnly} />
          <Field type="number" label="Skala" value={document.print.scale ?? 1} suffix="×" onChange={(value) => updateLayout('scale', value)} disabled={readOnly} />
          <Field type="number" label="Kopie" value={document.print.copies ?? 1} suffix="szt." onChange={(value) => updateLayout('copies', value)} disabled={readOnly} />
          <Field type="number" label="Odstęp" value={document.print.copySpacing ?? 10} suffix="mm" onChange={(value) => updateLayout('copySpacing', value)} disabled={readOnly} />
        </div>
        <div className="print-layout-actions">
          <button type="button" disabled={readOnly || !selectedFace} onClick={orientToSelectedFace}>Połóż ścianą na stole</button>
          <button type="button" disabled={readOnly} onClick={resetLayout}>Resetuj układ</button>
        </div>
        <small>{selectedFace ? 'Zaznaczona płaska ściana jest gotowa do orientacji.' : 'Zaznacz płaską ścianę modelu, aby oprzeć ją na stole.'}</small>
      </div>
      <div className="print-section print-summary">
        <h3>Kontrola modelu</h3>
        <dl><div><dt>Bryły</dt><dd>{bodies.length}</dd></div><div><dt>Kopie</dt><dd>{layoutResult.layout.copies}</dd></div><div><dt>Rozmiar układu</dt><dd>{bounds.map((value) => value.toFixed(1)).join(' × ')} mm</dd></div></dl>
        <p className={fits ? 'check-ok' : 'check-warning'}>{!bodies.length ? 'Najpierw utwórz bryłę.' : fits ? 'Model mieści się na stole drukarki.' : 'Model przekracza obszar drukarki.'}</p>
      </div>
      <div className="print-section print-analysis-section">
        <h3>Analiza drukowalności</h3>
        <div className="print-field-grid">
          <Field type="number" label="Dysza" value={document.print.nozzleDiameter ?? 0.4} suffix="mm" onChange={(value) => updateAnalysis('nozzleDiameter', value)} disabled={readOnly} />
          <Field type="number" label="Min. ścianka" value={document.print.minimumWallThickness ?? 0.8} suffix="mm" onChange={(value) => updateAnalysis('minimumWallThickness', value)} disabled={readOnly} />
          <Field type="number" label="Min. otwór" value={document.print.minimumHoleDiameter ?? 2} suffix="mm" onChange={(value) => updateAnalysis('minimumHoleDiameter', value)} disabled={readOnly} />
          <Field type="number" label="Próg nawisu" value={document.print.overhangAngle ?? 45} suffix="°" onChange={(value) => updateAnalysis('overhangAngle', value)} disabled={readOnly} />
        </div>
        <div className="print-analysis-summary"><strong>{printAnalysis.errorCount} błędów · {printAnalysis.warningCount} ostrzeżeń</strong><span>Wynik opisuje ryzyko technologiczne, nie gwarantuje udanego wydruku.</span></div>
        <div className="print-issues">
          {printAnalysis.issues.map((issue, index) => <button type="button" className={issue.severity} key={`${issue.code}-${issue.bodyId || 'layout'}-${index}`} onClick={() => onSelectIssue(issue.selection)}><AlertTriangle size={13} /><span><strong>{issue.message}</strong><small>{issue.risk}</small></span></button>)}
          {bodies.length > 0 && !printAnalysis.issues.length && <p className="check-ok">Nie wykryto problemów przy bieżących progach analizy.</p>}
        </div>
      </div>
      <div className="print-actions">
        <button type="button" onClick={() => onExport('stl')} disabled={!bodies.length || engine.status !== 'ready'}><HardDriveDownload size={16} /> Eksportuj STL</button>
        <button className="secondary" type="button" onClick={() => onExport('step')} disabled={!bodies.length || engine.status !== 'ready'}>Eksportuj STEP</button>
        <button className="secondary" type="button" onClick={() => onExport('3mf')} disabled={!bodies.length || engine.status !== 'ready'}>Eksportuj 3MF</button>
        <label className="command-field slicer-field"><span>Program tnący</span><select value={document.print.slicer || 'bambu'} onChange={(event) => commit((next) => { next.print.slicer = event.target.value; })} disabled={readOnly}><option value="bambu">Bambu Studio</option><option value="prusa">PrusaSlicer</option><option value="cura">UltiMaker Cura</option></select></label>
        <button className="send-slicer" type="button" onClick={() => onSendToSlicer(document.print.slicer || 'bambu')} disabled={!bodies.length || engine.status !== 'ready'}><Printer size={16} /> Otwórz STL w slicerze</button>
      </div>
      </>}
    </aside>
  );
}

function featureIcon(type, size = 16) {
  if (type === 'revolve') return <Rotate3d size={size} />;
  if (type === 'sweep') return <Move3d size={size} />;
  if (type === 'loft') return <Layers3 size={size} />;
  if (type === 'rib') return <Frame size={size} />;
  if (type === 'coil') return <RotateCw size={size} />;
  if (type === 'pipe') return <Cylinder size={size} />;
  if (type === 'pattern') return <Grid2X2 size={size} />;
  if (type === 'boolean') return <Shapes size={size} />;
  if (type === 'hole') return <Cylinder size={size} />;
  if (type === 'fillet') return <CircleDotDashed size={size} />;
  if (type === 'chamfer') return <Triangle size={size} />;
  if (type === 'shell') return <Layers3 size={size} />;
  if (type === 'draft') return <Triangle size={size} />;
  if (type === 'splitBody') return <Scissors size={size} />;
  if (type === 'splitFace') return <Scissors size={size} />;
  if (type === 'deleteFace') return <X size={size} />;
  if (type === 'replaceFace') return <Layers3 size={size} />;
  if (type === 'primitive') return <Box size={size} />;
  if (type === 'transform') return <Move3d size={size} />;
  if (type === 'offsetFace') return <Layers3 size={size} />;
  if (type === 'textSolid') return <Type size={size} />;
  if (type === 'importedModel') return <Upload size={size} />;
  return <Box size={size} />;
}

export default function ModelingWorkspace() {
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [licenseInfoOpen, setLicenseInfoOpen] = useState(true);
  const [fullLicenseOpen, setFullLicenseOpen] = useState(false);
  const [language] = useState(() => {
    const requestedLanguage = new URLSearchParams(window.location.search).get('verifyLanguage')
      || readStoredLanguage()
      || window.desktopApp?.appLanguage;
    return resolveModelingLanguage(requestedLanguage, window.navigator.language);
  });
  const [updateState, setUpdateState] = useState({ open: false, promptPending: false, status: 'idle', result: null, handoff: null, error: '' });
  const checkForUpdates = useCallback(async (silent = false) => {
    if (!window.desktopApp?.checkForUpdates) {
      if (!silent) setUpdateState({ open: true, promptPending: false, status: 'idle', result: null, error: 'Aktualizacje są dostępne w zainstalowanej aplikacji desktopowej.' });
      return null;
    }
    setUpdateState((current) => ({ ...current, open: !silent || current.open, status: 'checking', error: '' }));
    try {
      const result = await window.desktopApp.checkForUpdates();
      setUpdateState({
        open: !silent,
        promptPending: silent && Boolean(result?.available),
        status: 'idle',
        result,
        handoff: null,
        error: result?.ok === false ? result.error || 'Nie udało się sprawdzić aktualizacji.' : '',
      });
      return result;
    } catch (error) {
      setUpdateState({ open: !silent, promptPending: false, status: 'idle', result: null, error: error.message });
      return null;
    }
  }, []);
  useEffect(() => {
    const timeout = window.setTimeout(() => { void checkForUpdates(true); }, 1800);
    return () => window.clearTimeout(timeout);
  }, [checkForUpdates]);
  const updatePromptBlocked = tutorialOpen || licenseInfoOpen || fullLicenseOpen;
  useEffect(() => {
    if (updatePromptBlocked || !updateState.promptPending) return;
    setUpdateState((current) => ({ ...current, open: true, promptPending: false }));
  }, [updatePromptBlocked, updateState.promptPending]);
  useEffect(() => {
    const root = window.document.querySelector('.modeling-shell');
    window.document.documentElement.lang = language;
    return observeModelingLocalization(root, language);
  }, [language]);
  const [initialOpen] = useState(loadInitialDocument);
  const history = useDocumentHistory(initialOpen.document);
  const { document } = history;
  const replaceDocument = history.replace;
  const serializedDocument = useMemo(() => JSON.stringify(document), [document]);
  const initialDocumentTextRef = useRef(JSON.stringify(initialOpen.document));
  const documentRef = useRef(document);
  documentRef.current = document;
  const [documentAccess, setDocumentAccess] = useState({
    readOnly: Boolean(initialOpen.readOnly),
    sourceVersion: initialOpen.sourceVersion,
    originalDocument: initialOpen.originalDocument || null,
  });
  const [savedDocumentText, setSavedDocumentText] = useState(() => (
    initialOpen.recovered ? null : initialDocumentTextRef.current
  ));
  const [currentPath, setCurrentPath] = useState('');
  const [persistenceReady, setPersistenceReady] = useState(() => !window.desktopApp?.autosaveRead);
  const [workspace, setWorkspace] = useState('solid');
  const [selection, setSelection] = useState({ kind: 'document', id: document.id });
  const [activeSketchId, setActiveSketchId] = useState(null);
  const [command, setCommand] = useState(null);
  const [commandHistory, setCommandHistory] = useState([]);
  const [toolHelp, setToolHelp] = useState(null);
  const [sectionAnalysis, setSectionAnalysis] = useState(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [printPanelOpen, setPrintPanelOpen] = useState(false);
  const [timelineRename, setTimelineRename] = useState(null);
  const [timelineDeleteId, setTimelineDeleteId] = useState(null);
  const panelScreenKeyRef = useRef(panelScreenKey(window.screen));
  const [panelLayout, setPanelLayout] = useState(() => readPanelLayout(window.localStorage, window.screen));
  const [recoveryInfo, setRecoveryInfo] = useState(() => initialOpen.recovered ? {
    source: initialOpen.recoverySource || 'local-primary',
    backup: initialOpen.recoverySource === 'local-backup',
    updatedAt: initialOpen.document?.metadata?.modifiedAt || null,
  } : null);
  const [sketchOptions, setSketchOptions] = useState({ grid: true, snap: true, snapDistance: 12, profiles: true, points: true, dimensions: true, constraints: true, construction: true, projected: true, slice: false, sketch3d: false });
  const [notice, setNotice] = useState(initialOpen.warning || 'Gotowe. Zacznij od rysunku 2D albo otwórz projekt.');
  const fileInputRef = useRef(null);
  const importInputRef = useRef(null);
  const sketchImportInputRef = useRef(null);
  const sketchPointerRef = useRef(null);
  const sketchDynamicLengthRef = useRef('');
  const shortcutRegistryRef = useRef(new Map());
  const autosaveQueueRef = useRef(Promise.resolve());
  const autosaveSuspendedRef = useRef(false);
  const [importDraft, setImportDraft] = useState(null);
  const [modelImportBusy, setModelImportBusy] = useState(false);
  const [sketchImportDraft, setSketchImportDraft] = useState(null);
  useEffect(() => {
    writePanelLayout(panelLayout, window.localStorage, window.screen);
  }, [panelLayout]);
  useEffect(() => {
    const restoreLayoutForCurrentMonitor = () => {
      const nextKey = panelScreenKey(window.screen);
      if (nextKey === panelScreenKeyRef.current) return;
      panelScreenKeyRef.current = nextKey;
      setPanelLayout(readPanelLayout(window.localStorage, window.screen));
    };
    window.addEventListener('resize', restoreLayoutForCurrentMonitor);
    return () => window.removeEventListener('resize', restoreLayoutForCurrentMonitor);
  }, []);
  const registerShortcut = useCallback((shortcut, entry) => {
    const normalizedShortcut = shortcut.toUpperCase();
    shortcutRegistryRef.current.set(normalizedShortcut, entry);
    return () => {
      if (shortcutRegistryRef.current.get(normalizedShortcut) === entry) shortcutRegistryRef.current.delete(normalizedShortcut);
    };
  }, []);
  const appendCommandHistory = useCallback((input, message) => {
    setCommandHistory((current) => [{
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      input: String(input || '').trim(),
      message,
    }, ...current].slice(0, 30));
  }, []);
  const toolHelpContext = useMemo(() => ({ setToolHelp, registerShortcut }), [registerShortcut]);
  const readOnly = documentAccess.readOnly;
  const dirty = hasUnsavedSession({ readOnly, savedDocumentText, serializedDocument });
  const queueDesktopAutosave = useCallback((text) => {
    if (!window.desktopApp?.autosaveWrite) return Promise.resolve(false);
    const write = autosaveQueueRef.current.catch(() => {}).then(async () => {
      const result = await window.desktopApp.autosaveWrite({ text });
      if (result && result.ok === false) throw new Error(result.error || 'Nie udało się zapisać plikowego autozapisu.');
      return true;
    });
    autosaveQueueRef.current = write;
    return write;
  }, []);
  const persistAutosaveNow = useCallback(async (text) => {
    let localError = null;
    try {
      writeLocalAutosave(text);
    } catch (error) {
      localError = error;
    }
    let desktopSaved = false;
    try {
      desktopSaved = await queueDesktopAutosave(text);
    } catch (error) {
      if (localError) throw new Error(`Lokalny autozapis: ${localError.message}; plikowy autozapis: ${error.message}`);
      throw error;
    }
    if (localError && !desktopSaved) throw localError;
    if (localError) setNotice(`Pamięć lokalna jest pełna (${localError.message}). Projekt zabezpieczono w plikowym autozapisie.`);
    return { localSaved: !localError, desktopSaved };
  }, [queueDesktopAutosave]);
  const clearAutosaveSnapshots = useCallback(async () => {
    autosaveSuspendedRef.current = true;
    try {
      await autosaveQueueRef.current.catch(() => {});
      clearLocalAutosave();
      if (window.desktopApp?.autosaveClear) {
        const result = await window.desktopApp.autosaveClear();
        if (result && result.ok === false) throw new Error(result.error || 'Nie udało się usunąć plikowego autozapisu.');
      }
    } finally {
      autosaveSuspendedRef.current = false;
    }
  }, []);
  const changeAppLanguage = async (nextLanguage) => {
    const normalized = nextLanguage === 'en' ? 'en' : 'pl';
    if (normalized === language) return;
    if (dirty && !readOnly) {
      try {
        await persistAutosaveNow(serializedDocument);
      } catch (error) {
        setNotice(`Nie zmieniono języka, ponieważ nie udało się zabezpieczyć projektu: ${error.message}`);
        return;
      }
    }
    if (window.desktopApp?.setAppLanguage) {
      const result = await window.desktopApp.setAppLanguage({ language: normalized });
      if (result?.ok === false) {
        setNotice(`Nie udało się zapisać języka: ${result.error || 'nieznany błąd'}`);
        return;
      }
    }
    try {
      window.localStorage.setItem(LANGUAGE_KEY, normalized);
    } catch (error) {
      if (!window.desktopApp?.setAppLanguage) {
        setNotice(`Nie udało się zapisać języka: ${error.message}`);
        return;
      }
    }
    window.location.reload();
  };

  useEffect(() => {
    if (!window.desktopApp?.autosaveRead) return undefined;
    let active = true;
    void (async () => {
      try {
        const result = await window.desktopApp.autosaveRead();
        if (!active) return;
        if (result?.ok === false) {
          setNotice(`Nie udało się odczytać plikowego autozapisu: ${result.error || 'nieznany błąd'}`);
          return;
        }
        if (!result?.exists || !result.text) return;
        const opened = openDocument(JSON.parse(result.text));
        const initialDocumentUnchanged = JSON.stringify(documentRef.current) === initialDocumentTextRef.current;
        if (!initialDocumentUnchanged) {
          setNotice('Znaleziono plikowy autozapis, ale bieżący projekt został już zmieniony. Autozapis pozostawiono bez nadpisywania.');
          return;
        }
        const fileIsPreferred = !initialOpen.recovered
          || documentModifiedAt(opened.document) >= documentModifiedAt(initialOpen.document);
        if (fileIsPreferred && JSON.stringify(opened.document) !== initialDocumentTextRef.current) {
          replaceDocument(opened.document);
          setDocumentAccess({
            readOnly: opened.readOnly,
            sourceVersion: opened.sourceVersion,
            originalDocument: opened.originalDocument || null,
          });
          setSavedDocumentText(null);
          setSelection({ kind: 'document', id: opened.document.id });
          setRecoveryInfo({ source: result.recovered ? 'file-backup' : 'file-primary', backup: Boolean(result.recovered), updatedAt: result.updatedAt || opened.document?.metadata?.modifiedAt || null });
          setNotice(`${result.warning ? `${result.warning} ` : ''}Odzyskano projekt po nieoczekiwanym zamknięciu aplikacji.`);
        } else if (result.warning) {
          setNotice(result.warning);
        }
      } catch (error) {
        if (active) setNotice(`Nie udało się odtworzyć plikowego autozapisu: ${error.message}`);
      } finally {
        if (active) setPersistenceReady(true);
      }
    })();
    return () => { active = false; };
  }, [initialOpen, replaceDocument]);
  useEffect(() => {
    if (command?.type !== 'sectionAnalysis' && sectionAnalysis) setSectionAnalysis(null);
  }, [command?.type, sectionAnalysis]);
  const readOnlyNotice = () => setNotice(`Projekt v${documentAccess.sourceVersion} jest otwarty tylko do odczytu. Utwórz nowy projekt albo otwórz obsługiwaną wersję, aby edytować.`);
  const commit = (mutator) => {
    if (readOnly) {
      readOnlyNotice();
      return;
    }
    history.commit(mutator);
  };

  const selectedProfileMatch = document.sketches
    .flatMap((sketch) => sketch.profiles.map((profile) => ({ sketch, profile })))
    .find(({ profile }) => selection?.kind === 'profile' && profile.id === selection.id);
  const selectedProfile = selectedProfileMatch?.profile;
  const commandProfileName = selectedProfile?.name || document.sketches.flatMap((sketch) => sketch.profiles).find((profile) => profile.id === command?.previewFeature?.profileIds?.[0])?.name || '';
  const selectedProfileBoundaryEntity = selectedProfile?.entityIds?.length === 1
    ? selectedProfileMatch?.sketch.entities.find((entity) => entity.id === selectedProfile.entityIds[0])
    : null;
  const isCircularProfile = selectedProfile?.type === 'circle' || selectedProfileBoundaryEntity?.type === 'circle';
  const selectedCircleDiameter = selectedProfile?.geometry?.diameter
    || (selectedProfileBoundaryEntity?.type === 'circle'
      ? (Number.isFinite(Number(selectedProfileBoundaryEntity.geometry.radius)) ? String(Number(selectedProfileBoundaryEntity.geometry.radius) * 2) : `(${selectedProfileBoundaryEntity.geometry.radius}) * 2`)
      : '10');
  const selectedSketchPointMatch = selection?.kind === 'sketchPoint'
    ? document.sketches.map((sketch) => {
      const point = sketch.entities.find((entity) => entity.id === selection.id && entity.type === 'point');
      const isIndependent = point && !sketch.entities.some((entity) => entity.id !== point.id && entity.pointIds?.includes(point.id));
      return { sketch, point: isIndependent ? point : null };
    }).find((entry) => entry.point)
    : null;
  const hasHoleReference = isCircularProfile || Boolean(selectedSketchPointMatch);
  const selectedSketchEntityIds = selection?.kind === 'sketchEntities' && selection.sketchId === activeSketchId
    ? selection.ids
    : [];
  const selectedSketchConstraintId = selection?.kind === 'sketchConstraint' && selection.sketchId === activeSketchId
    ? selection.id
    : null;
  const selectedSketchEntities = (document.sketches.find((item) => item.id === activeSketchId)?.entities || [])
    .filter((entity) => selectedSketchEntityIds.includes(entity.id));
  const canExtrudeOpenChain = Boolean(activeSketchId && selectedSketchEntities.length && selectedSketchEntities.every((entity) => entity.type === 'line'));
  const canAddCollinear = selectedSketchEntities.length === 2 && selectedSketchEntities.every((entity) => entity.type === 'line');
  const canAddSymmetry = selectedSketchEntities.filter((entity) => entity.type === 'point').length === 2
    && selectedSketchEntities.filter((entity) => entity.type === 'line').length === 1
    && selectedSketchEntities.length === 3;
  const canAddCurvature = selectedSketchEntities.length === 2
    && selectedSketchEntities.every((entity) => entity.type === 'arc')
    && selectedSketchEntities[0].pointIds.slice(1).filter((pointId) => selectedSketchEntities[1].pointIds.slice(1).includes(pointId)).length === 1;
  const canAddOrdinate = selectedSketchEntities.length === 1 && selectedSketchEntities[0].type === 'point';
  const canAddArcLength = selectedSketchEntities.length === 1 && selectedSketchEntities[0].type === 'arc';
  const selectedTopologyIds = useMemo(() => (
    selection?.items || (['face', 'edge', 'vertex'].includes(selection?.kind) ? [selection] : [])
  ).filter((item) => ['face', 'edge', 'vertex'].includes(item.kind)).map((item) => item.id), [selection]);
  const selectedBodyIds = useMemo(() => (
    selection?.items || (selection?.kind === 'body' ? [selection] : [])
  ).filter((item) => item.kind === 'body').map((item) => item.id), [selection]);
  const selectedEdgeItems = useMemo(() => (
    selection?.items || (selection?.kind === 'edge' ? [selection] : [])
  ).filter((item) => item.kind === 'edge' && item.bodyId), [selection]);
  const selectedFaceItems = useMemo(() => (
    selection?.items || (selection?.kind === 'face' ? [selection] : [])
  ).filter((item) => item.kind === 'face' && item.bodyId), [selection]);
  const hasFaceEdgeHoleReference = selectedFaceItems.length === 1
    && selectedEdgeItems.length === 2
    && selectedEdgeItems.every((item) => item.bodyId === selectedFaceItems[0].bodyId);
  const constructionPlanes = useMemo(() => resolveConstructionPlanes(document.references, document.parameters), [document.references, document.parameters]);
  const firstBodyId = `body-${document.features.find((feature) => feature.type === 'extrude' && feature.operation === 'new')?.id || ''}`;

  const previewDocument = useMemo(() => {
    if (!command?.previewFeature) return document;
    const next = cloneDocument(document);
    for (const reference of command.topologyReferences || []) {
      if (!next.references.some((item) => item.id === reference.id)) next.references.push({ ...reference, ownerFeatureId: command.previewFeature.id });
    }
    if (command.editId) {
      const index = next.features.findIndex((feature) => feature.id === command.editId);
      if (index >= 0) next.features[index] = command.previewFeature;
    } else {
      next.features.push(command.previewFeature);
    }
    return next;
  }, [document, command]);
  const engine = useCadEngine(previewDocument, { quality: command?.previewFeature ? 'preview' : 'display' });
  const selectedBodies = selectedBodyIds.map((bodyId) => engine.bodies.find((body) => body.id === bodyId)).filter(Boolean);
  const selectedBodyRepresentations = selectedBodies.map((body) => body.representation);
  const canBooleanSelectedBodies = selectedBodyIds.length === 2
    && selectedBodyRepresentations.length === 2
    && new Set(selectedBodyRepresentations).size === 1
    && selectedBodies.every((body) => body.meshBooleanCapable !== false);
  const containsImportedMesh = engine.bodies.some((body) => body.representation === 'mesh-import');
  const canCreateRib = Boolean(canExtrudeOpenChain && engine.bodies.length);
  const pressPullFace = selectedFaceItems.length === 1
    ? engine.bodies.find((body) => body.id === selectedFaceItems[0].bodyId)?.topology?.faces?.find((face) => face.id === selectedFaceItems[0].id)
    : null;
  const canPressPull = Boolean((selectedProfile && !activeSketchId) || pressPullFace?.descriptor?.geometry === 'PLANE');
  const splitFaceSupport = selectedProfileMatch?.sketch.support?.kind === 'face'
    ? document.references.find((reference) => reference.id === selectedProfileMatch.sketch.support.referenceId)
    : null;
  const canSplitFace = Boolean(selectedProfile && !activeSketchId
    && splitFaceSupport?.kind === 'topology'
    && splitFaceSupport.topologyKind === 'face'
    && splitFaceSupport.descriptor?.geometry === 'PLANE'
    && engine.bodies.some((body) => body.id === splitFaceSupport.bodyId));
  const measurement = useMemo(() => measureSelection(engine.bodies, selection), [engine.bodies, selection]);
  const massBodies = useMemo(() => {
    const ids = new Set((selection?.items || [selection]).map((item) => item?.bodyId || (item?.kind === 'body' ? item.id : null)).filter(Boolean));
    return ids.size ? engine.bodies.filter((body) => ids.has(body.id)) : engine.bodies;
  }, [engine.bodies, selection]);
  const massProperties = useMemo(() => {
    if (command?.type !== 'massProperties') return null;
    try {
      return { result: calculateMassProperties(massBodies, command.density), error: '' };
    } catch (error) {
      return { result: null, error: error.message };
    }
  }, [command?.type, command?.density, massBodies]);
  const geometryInspection = useMemo(() => summarizeGeometryInspection(engine.bodies, engine.analysis), [engine.bodies, engine.analysis]);
  const selectedPrintFace = useMemo(() => {
    if (selectedFaceItems.length !== 1) return null;
    const selected = selectedFaceItems[0];
    const descriptor = engine.bodies.find((body) => body.id === selected.bodyId)?.topology?.faces?.find((face) => face.id === selected.id)?.descriptor;
    return descriptor?.geometry === 'PLANE' && Array.isArray(descriptor.normal) ? descriptor : null;
  }, [engine.bodies, selectedFaceItems]);
  const constructionAxes = useMemo(() => resolveConstructionAxes(document.references, document.parameters, engine.bodies), [document.references, document.parameters, engine.bodies]);
  const constructionPoints = useMemo(() => resolveConstructionPoints(document.references, document.parameters, engine.bodies), [document.references, document.parameters, engine.bodies]);
  const actualBodyIds = useMemo(() => new Set(document.features.filter((feature) => (['extrude', 'revolve', 'sweep', 'loft', 'coil', 'pipe'].includes(feature.type) && feature.operation === 'new') || feature.type === 'primitive' || feature.type === 'importedModel' || feature.type === 'splitBody' || (feature.type === 'textSolid' && feature.operation === 'new')).map((feature) => `body-${feature.id}`)), [document.features]);
  const actualBodies = command?.previewFeature ? engine.bodies.filter((body) => actualBodyIds.has(body.id)) : engine.bodies;
  const targetBodyId = selection?.kind === 'body' ? selection.id : (selection?.bodyId || engine.bodies[0]?.id || firstBodyId || null);
  const targetBodySupportsSolidOperations = engine.bodies.find((body) => body.id === targetBodyId)?.meshBooleanCapable !== false;
  const topologyReferenceStates = useMemo(() => inspectTopologyReferences(document, actualBodies), [document, actualBodies]);
  const lostTopologyReferences = useMemo(
    () => engine.status === 'ready' && !command?.previewFeature ? topologyReferenceStates.filter((item) => item.status === 'lost') : [],
    [engine.status, command?.previewFeature, topologyReferenceStates],
  );
  const lostReferenceOwnerIds = useMemo(() => new Set(lostTopologyReferences.map((item) => item.reference.ownerFeatureId).filter(Boolean)), [lostTopologyReferences]);
  const lostProjectedEntityIds = useMemo(() => {
    const lostIds = new Set(lostTopologyReferences.map((item) => item.reference.id));
    return document.sketches.flatMap((sketch) => sketch.entities
      .filter((entity) => entity.role === 'projected' && lostIds.has(entity.projectionReferenceId || entity.sourceReferenceId))
      .map((entity) => entity.id));
  }, [document.sketches, lostTopologyReferences]);

  useEffect(() => {
    if (readOnly || command?.previewFeature || engine.status !== 'ready' || engine.evaluatedDocument !== document) return;
    const probe = cloneDocument(document);
    const result = synchronizeProjectedGeometry(probe, actualBodies);
    if (!result.updatedEntityIds.length && !result.updatedReferenceIds.length) return;
    history.synchronize((next) => synchronizeProjectedGeometry(next, actualBodies));
    setNotice(`Project odświeżony automatycznie · ${result.updatedEntityIds.length} ${result.updatedEntityIds.length === 1 ? 'element' : 'elementów'}.`);
  }, [document, actualBodies, command?.previewFeature, engine.status, engine.evaluatedDocument, history, readOnly]);

  useEffect(() => {
    if (!persistenceReady || readOnly || !dirty) return undefined;
    let canceled = false;
    let timeout;
    const persistWhenReady = () => {
      if (canceled) return;
      if (autosaveSuspendedRef.current) {
        timeout = window.setTimeout(persistWhenReady, 100);
        return;
      }
      void persistAutosaveNow(serializedDocument).catch((error) => setNotice(`Błąd autozapisu: ${error.message}`));
    };
    timeout = window.setTimeout(persistWhenReady, 300);
    return () => {
      canceled = true;
      window.clearTimeout(timeout);
    };
  }, [dirty, persistenceReady, persistAutosaveNow, readOnly, serializedDocument]);

  useEffect(() => {
    window.__madcadGetSessionExport = () => JSON.stringify(readOnly && documentAccess.originalDocument ? documentAccess.originalDocument : document, null, 2);
    window.__madcadHasDrawableContent = () => Boolean(
      document.features.length
      || document.sketches.some((sketch) => sketch.entities.length || sketch.profiles.length)
      || document.imports?.length
    );
    window.__madcadHasUnsavedChanges = () => dirty;
    window.__madcadPersistenceReady = () => persistenceReady;
    window.__madcadClearRuntimeSession = () => clearLocalAutosave();
    return () => {
      delete window.__madcadGetSessionExport;
      delete window.__madcadHasDrawableContent;
      delete window.__madcadHasUnsavedChanges;
      delete window.__madcadPersistenceReady;
      delete window.__madcadClearRuntimeSession;
    };
  }, [dirty, document, documentAccess.originalDocument, persistenceReady, readOnly]);

  useEffect(() => {
    const verifyMode = new URLSearchParams(window.location.search).has('verify');
    if (!verifyMode) return undefined;
    window.__madcadVerifyExport = engine.exportModel;
    window.__madcadVerifyRestartWorker = engine.restartWorkerForTest;
    return () => {
      delete window.__madcadVerifyExport;
      delete window.__madcadVerifyRestartWorker;
    };
  }, [engine.exportModel, engine.restartWorkerForTest]);

  useEffect(() => {
    const verifyMode = new URLSearchParams(window.location.search).has('verify');
    if (!verifyMode) return undefined;
    window.__madcadVerifyEngineState = {
      status: engine.status,
      revision: engine.revision,
      cache: engine.cache,
      bodies: engine.bodies,
      timeline: engine.timeline,
      diagnostics: engine.diagnostics,
      performance: engine.performance,
    };
    return () => { delete window.__madcadVerifyEngineState; };
  }, [engine.status, engine.revision, engine.cache, engine.bodies, engine.timeline, engine.diagnostics, engine.performance]);

  const updateCommand = (patch) => {
    if (Object.hasOwn(patch, 'dynamicLength')) sketchDynamicLengthRef.current = patch.dynamicLength;
    setCommand((current) => {
      const next = { ...current, ...patch };
      if (next.type === 'extrude') {
        if (next.extent === 'through-all' && !['cut', 'intersect'].includes(next.operation)) next.extent = 'one-side';
        if (next.extent === 'to-object' && !next.targetReferenceId) next.targetReferenceId = next.targetOptions[0]?.id;
        const targetOption = next.targetOptions.find((option) => option.id === next.targetReferenceId);
        next.topologyReferences = next.extent === 'to-object' && targetOption?.reference ? [targetOption.reference] : [];
        next.previewFeature = createFeature('extrude', {
          name: current.previewFeature?.name || `Wyciągnięcie ${document.features.length + 1}`,
          sketchId: current.previewFeature?.sketchId || selectedProfileMatch?.sketch.id,
          profileIds: current.previewFeature?.profileIds || (selectedProfile ? [selectedProfile.id] : []),
          openEntityIds: current.previewFeature?.openEntityIds,
          distance: next.distance,
          secondDistance: next.secondDistance,
          startOffset: next.startOffset,
          extent: next.extent,
          targetReferenceId: next.extent === 'to-object' ? next.targetReferenceId : undefined,
          thin: Boolean(next.thin),
          wallThickness: next.wallThickness,
          wallSide: next.wallSide,
          endCap: next.endCap,
          operation: next.operation,
          targetBodyId: next.operation === 'new' ? null : targetBodyId,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'revolve') {
        next.previewFeature = createFeature('revolve', {
          name: current.previewFeature?.name || `Revolve ${document.features.length + 1}`,
          sketchId: current.previewFeature?.sketchId || selectedProfileMatch?.sketch.id,
          profileIds: current.previewFeature?.profileIds || (selectedProfile ? [selectedProfile.id] : []),
          axisId: next.axisId,
          angle: next.angle,
          operation: next.operation,
          targetBodyId: next.operation === 'new' ? null : targetBodyId,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'sweep') {
        next.previewFeature = createFeature('sweep', {
          name: current.previewFeature?.name || `Sweep ${document.features.length + 1}`,
          sketchId: current.previewFeature?.sketchId || selectedProfileMatch?.sketch.id,
          profileIds: current.previewFeature?.profileIds || (selectedProfile ? [selectedProfile.id] : []),
          pathSketchId: next.pathSketchId,
          pathEntityIds: next.pathEntityIds,
          operation: next.operation,
          targetBodyId: next.operation === 'new' ? null : targetBodyId,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'loft') {
        const sourceSketchId = current.previewFeature?.sketchIds?.[0] || selectedProfileMatch?.sketch.id;
        const sourceProfileId = current.previewFeature?.profileIds?.[0] || selectedProfile?.id;
        next.previewFeature = createFeature('loft', {
          name: current.previewFeature?.name || `Loft ${document.features.length + 1}`,
          sketchId: sourceSketchId,
          sketchIds: [sourceSketchId, next.endSketchId],
          profileIds: [sourceProfileId, next.endProfileId],
          loftMode: next.loftMode,
          operation: next.operation,
          targetBodyId: next.operation === 'new' ? null : targetBodyId,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'rib') {
        next.previewFeature = createFeature('rib', {
          name: current.previewFeature?.name || `Rib/Web ${document.features.length + 1}`,
          sketchId: current.previewFeature?.sketchId || next.sourceSketchId,
          openEntityIds: current.previewFeature?.openEntityIds || next.openEntityIds,
          targetBodyId: current.previewFeature?.targetBodyId || targetBodyId,
          ribMode: next.ribMode,
          thickness: next.thickness,
          depth: next.depth,
          wallSide: next.wallSide,
          reverse: Boolean(next.reverse),
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'coil') {
        next.previewFeature = createFeature('coil', {
          name: current.previewFeature?.name || `Coil ${document.features.length + 1}`,
          axisId: next.axisId,
          coilDiameter: next.coilDiameter,
          wireDiameter: next.wireDiameter,
          pitch: next.pitch,
          turns: next.turns,
          handedness: next.handedness,
          operation: next.operation,
          targetBodyId: next.operation === 'new' ? null : targetBodyId,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'pipe') {
        next.previewFeature = createFeature('pipe', {
          name: current.previewFeature?.name || `Pipe ${document.features.length + 1}`,
          pathSketchId: current.previewFeature?.pathSketchId || next.pathSketchId,
          pathEntityIds: current.previewFeature?.pathEntityIds || next.pathEntityIds,
          outsideDiameter: next.outsideDiameter,
          wallThickness: next.wallThickness,
          operation: next.operation,
          targetBodyId: next.operation === 'new' ? null : targetBodyId,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'pattern') {
        next.previewFeature = createFeature('pattern', { name: current.previewFeature?.name || `Pattern ${document.features.length + 1}`, targetBodyId: current.previewFeature?.targetBodyId || next.targetBodyId, patternType: next.patternType, countX: next.countX, countY: next.countY, spacingX: next.spacingX, spacingY: next.spacingY, axisId: next.axisId, occurrences: next.occurrences, totalAngle: next.totalAngle, pathSketchId: next.pathSketchId, pathEntityIds: next.pathEntityIds });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'hole') {
        next.previewFeature = next.placement === 'face-edges'
          ? createFeature('hole', {
            name: current.previewFeature?.name || `Otwór ${document.features.length + 1}`,
            placement: 'face-edges',
            targetBodyId: next.targetBodyId,
            referenceIds: current.previewFeature?.referenceIds || current.topologyReferences?.map((reference) => reference.id) || [],
            firstOffset: next.firstOffset,
            secondOffset: next.secondOffset,
            holeType: next.holeType, extent: next.extent, diameter: next.diameter, depth: next.depth,
            counterboreDiameter: next.counterboreDiameter, counterboreDepth: next.counterboreDepth,
            countersinkDiameter: next.countersinkDiameter, countersinkAngle: next.countersinkAngle,
            threadMode: next.threadMode, threadDiameter: next.threadDiameter, threadPitch: next.threadPitch, threadLength: next.threadLength, threadDirection: next.threadDirection,
            clearanceProfile: next.clearanceProfile, clearance: next.clearance,
          })
          : createFeature('hole', {
            name: current.previewFeature?.name || `Otwór ${document.features.length + 1}`,
            targetBodyId,
            sketchId: selectedSketchPointMatch?.sketch.id || selectedProfileMatch?.sketch.id,
            ...(selectedSketchPointMatch ? { pointId: selectedSketchPointMatch.point.id } : { profileId: selectedProfile.id }),
            holeType: next.holeType, extent: next.extent, diameter: next.diameter, depth: next.depth,
            counterboreDiameter: next.counterboreDiameter, counterboreDepth: next.counterboreDepth,
            countersinkDiameter: next.countersinkDiameter, countersinkAngle: next.countersinkAngle,
            threadMode: next.threadMode, threadDiameter: next.threadDiameter, threadPitch: next.threadPitch, threadLength: next.threadLength, threadDirection: next.threadDirection,
            clearanceProfile: next.clearanceProfile, clearance: next.clearance,
          });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'boolean') {
        next.previewFeature = createFeature('boolean', {
          name: current.previewFeature?.name || `Boolean ${document.features.length + 1}`,
          targetBodyId: next.targetBodyId,
          toolBodyId: next.toolBodyId,
          operation: next.operation,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'primitive') {
        next.previewFeature = createFeature('primitive', {
          name: next.name,
          primitiveType: next.primitiveType,
          x: next.x, y: next.y, z: next.z,
          width: next.width, depth: next.depth, height: next.height,
          radius: next.radius, majorRadius: next.majorRadius, minorRadius: next.minorRadius,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'textSolid') {
        next.previewFeature = createFeature('textSolid', {
          name: current.previewFeature?.name || `Tekst 3D ${document.features.length + 1}`,
          text: next.text,
          fontSize: next.fontSize,
          depth: next.depth,
          x: next.x, y: next.y, z: next.z,
          operation: next.operation,
          targetBodyId: next.operation === 'new' ? null : next.targetBodyId,
          placement: next.placement,
          referenceIds: current.previewFeature?.referenceIds || next.topologyReferences?.map((reference) => reference.id) || [],
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'transform') {
        next.previewFeature = createFeature('transform', {
          name: current.previewFeature?.name || `${next.mode === 'rotate' ? 'Obrót' : 'Przesunięcie'} ${document.features.length + 1}`,
          targetBodyId: next.targetBodyId || targetBodyId,
          mode: next.mode,
          x: next.x, y: next.y, z: next.z,
          angle: next.angle,
          originX: next.originX, originY: next.originY, originZ: next.originZ,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'offsetFace') {
        next.previewFeature = createFeature('offsetFace', {
          name: current.previewFeature?.name || `Offset Face ${document.features.length + 1}`,
          targetBodyId: next.targetBodyId || targetBodyId,
          referenceIds: current.previewFeature?.referenceIds || current.topologyReferences?.map((reference) => reference.id) || [],
          distance: next.distance,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'fillet' || next.type === 'chamfer') {
        next.previewFeature = createFeature(next.type, {
          name: current.previewFeature?.name || `${next.type === 'fillet' ? 'Zaokrąglenie' : 'Fazowanie'} ${document.features.length + 1}`,
          targetBodyId,
          referenceIds: current.previewFeature?.referenceIds || current.topologyReferences?.map((reference) => reference.id) || [],
          ...(next.type === 'fillet' ? { radius: next.size } : { distance: next.size }),
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'shell') {
        next.previewFeature = createFeature('shell', {
          name: current.previewFeature?.name || `Shell ${document.features.length + 1}`,
          targetBodyId,
          referenceIds: current.previewFeature?.referenceIds || current.topologyReferences?.map((reference) => reference.id) || [],
          thickness: next.thickness,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'draft') {
        next.previewFeature = createFeature('draft', {
          name: current.previewFeature?.name || `Draft ${document.features.length + 1}`,
          targetBodyId: next.targetBodyId || targetBodyId,
          referenceIds: current.previewFeature?.referenceIds || current.topologyReferences?.map((reference) => reference.id) || [],
          neutralPlaneId: next.neutralPlaneId,
          angle: next.angle,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'splitBody') {
        next.previewFeature = createFeature('splitBody', {
          name: current.previewFeature?.name || `Split Body ${document.features.length + 1}`,
          targetBodyId: next.targetBodyId || targetBodyId,
          planeId: next.planeId,
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'splitFace') {
        next.previewFeature = createFeature('splitFace', {
          name: current.previewFeature?.name || `Split Face ${document.features.length + 1}`,
          targetBodyId: next.targetBodyId,
          sketchId: next.sketchId,
          profileId: next.profileId,
          referenceIds: current.previewFeature?.referenceIds || [next.referenceId],
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'deleteFace') {
        next.previewFeature = createFeature('deleteFace', {
          name: current.previewFeature?.name || `Delete Face + Heal ${document.features.length + 1}`,
          targetBodyId: next.targetBodyId,
          referenceIds: current.previewFeature?.referenceIds || current.topologyReferences?.map((reference) => reference.id) || [],
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      if (next.type === 'replaceFace') {
        next.previewFeature = createFeature('replaceFace', {
          name: current.previewFeature?.name || `Replace Face ${document.features.length + 1}`,
          targetBodyId: next.targetBodyId,
          referenceIds: current.previewFeature?.referenceIds || current.topologyReferences?.map((reference) => reference.id) || [],
        });
        if (current.previewFeature?.id) next.previewFeature.id = current.previewFeature.id;
      }
      return next;
    });
  };

  const startSketch = () => {
    if (readOnly) return readOnlyNotice();
    if (selection?.kind === 'constructionPlane') {
      const supportPlane = constructionPlanes.find((plane) => plane.id === selection.id);
      if (!supportPlane || supportPlane.status !== 'ok') {
        setNotice('Wybrana płaszczyzna konstrukcyjna ma błąd i nie może być podporą szkicu.');
        return;
      }
      const normal = supportPlane.normal;
      const dominant = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
      if (normal.some((value, index) => index !== dominant && Math.abs(value) > 1e-6)) {
        setNotice('Obrócone płaszczyzny konstrukcyjne wymagają ramy UCS; wybierz obecnie płaszczyznę równoległą do XY, XZ albo YZ.');
        return;
      }
      const plane = dominant === 0 ? 'YZ' : dominant === 1 ? 'XZ' : 'XY';
      const planeOffset = dominant === 1 ? -supportPlane.origin[1] : supportPlane.origin[dominant];
      const sketch = createSketch({ name: `Szkic ${document.sketches.length + 1}`, plane, planeOffset, support: { kind: 'construction-plane', referenceId: supportPlane.id } });
      commit((next) => next.sketches.push(sketch));
      setActiveSketchId(sketch.id);
      setSelection({ kind: 'sketch', id: sketch.id });
      setCommand(null);
      setWorkspace('sketch');
      setNotice(`Edytujesz ${sketch.name} na płaszczyźnie ${supportPlane.name}.`);
      return;
    }
    const selectedFace = (selection?.items || (selection?.kind === 'face' ? [selection] : [])).find((item) => item.kind === 'face');
    if (selectedFace) {
      const body = engine.bodies.find((candidate) => candidate.id === selectedFace.bodyId);
      const face = body?.topology?.faces?.find((candidate) => candidate.id === selectedFace.id);
      if (face?.descriptor?.geometry !== 'PLANE') {
        setNotice('Szkic można założyć bezpośrednio tylko na płaskiej ścianie.');
        return;
      }
      const normal = face.descriptor.normal || [0, 0, 1];
      const dominant = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
      if (normal.some((value, index) => index !== dominant && Math.abs(value) > 1e-6)) {
        setNotice('Obrócone ściany planarne będą obsługiwane przez ramę UCS; ta ściana nie jest równoległa do XY, XZ ani YZ.');
        return;
      }
      const plane = dominant === 0 ? 'YZ' : dominant === 1 ? 'XZ' : 'XY';
      const center = face.descriptor.center || [0, 0, 0];
      const planeOffset = dominant === 1 ? -center[1] : center[dominant];
      const reference = createTopologyReference({ selection: selectedFace, descriptor: face.descriptor, label: `Podpora szkicu ${document.sketches.length + 1}` });
      const sketch = createSketch({ name: `Szkic ${document.sketches.length + 1}`, plane, planeOffset, support: { kind: 'face', referenceId: reference.id } });
      commit((next) => { next.references.push(reference); next.sketches.push(sketch); });
      setActiveSketchId(sketch.id);
      setSelection({ kind: 'sketch', id: sketch.id });
      setCommand(null);
      setWorkspace('sketch');
      setNotice(`Edytujesz ${sketch.name} bezpośrednio na ścianie modelu (${plane}, odsunięcie ${planeOffset.toFixed(3)} mm).`);
      return;
    }
    setWorkspace('sketch');
    setCommand({ type: 'plane' });
    setNotice('Wybierz płaszczyznę szkicu.');
  };

  const pickPlane = (plane) => {
    if (readOnly) return readOnlyNotice();
    const sketch = createSketch({ name: `Szkic ${document.sketches.length + 1}`, plane });
    commit((next) => next.sketches.push(sketch));
    setActiveSketchId(sketch.id);
    setSelection({ kind: 'sketch', id: sketch.id });
    setCommand(null);
    setWorkspace('sketch');
    setNotice(`Edytujesz ${sketch.name} na płaszczyźnie ${plane}.`);
  };

  const editSketch = (sketchId) => {
    const sketch = document.sketches.find((item) => item.id === sketchId);
    if (!sketch) return;
    setActiveSketchId(sketch.id);
    setSelection({ kind: 'sketch', id: sketch.id });
    setWorkspace('sketch');
    setCommand(null);
    setNotice(`Edytujesz ${sketch.name}.`);
  };

  const finishSketch = () => {
    const sketch = document.sketches.find((item) => item.id === activeSketchId);
    const lastProfile = sketch?.profiles.at(-1);
    const selectedPoint = selectedSketchEntityIds.length === 1
      ? sketch?.entities.find((entity) => entity.id === selectedSketchEntityIds[0]
        && entity.type === 'point'
        && entity.role === 'standard'
        && !sketch.entities.some((candidate) => candidate.id !== entity.id && candidate.pointIds?.includes(entity.id)))
      : null;
    setActiveSketchId(null);
    setWorkspace('solid');
    setCommand(null);
    if (selectedPoint) setSelection({ kind: 'sketchPoint', id: selectedPoint.id, sketchId: sketch.id });
    else if (lastProfile) setSelection({ kind: 'profile', id: lastProfile.id, sketchId: sketch.id });
    setNotice('Szkic zakończony. Wybierz profil i użyj operacji bryłowej.');
  };

  const openProfileCommand = (type, profile = null) => {
    if (readOnly) return readOnlyNotice();
    if (profile && !['rectangle', 'circle'].includes(type)) {
      setNotice('Profil z segmentów edytuje się przez jego punkty i krawędzie; zaznaczanie segmentów wchodzi w R1.3.');
      return;
    }
    if (!activeSketchId) {
      startSketch();
      return;
    }
    if (type === 'rectangle') {
      setCommand({ type, definition: 'center', gesturePoints: [], editId: profile?.id || null, name: profile?.name || `Prostokąt ${document.sketches.flatMap((item) => item.profiles).length + 1}`, width: profile?.geometry.width || '40', height: profile?.geometry.height || '30', x: profile?.geometry.x || '0', y: profile?.geometry.y || '0', rotation: '0', x1: '-20', y1: '-15', x2: '20', y2: '15', x3: '20', y3: '15' });
    } else {
      setCommand({ type, definition: 'centerRadius', gesturePoints: [], editId: profile?.id || null, name: profile?.name || `Okrąg ${document.sketches.flatMap((item) => item.profiles).length + 1}`, diameter: profile?.geometry.diameter || '10', x: profile?.geometry.x || '0', y: profile?.geometry.y || '0', x1: '-5', y1: '0', x2: '5', y2: '0', x3: '0', y3: '5' });
    }
    setNotice(profile ? 'Kliknij nowe punkty na płótnie albo wpisz dokładne dane.' : 'Wskaż punkty figury bezpośrednio na płótnie; pola służą do opcjonalnego wpisania dokładnych danych.');
  };

  const openMechanicalShape = (type) => {
    if (readOnly) return readOnlyNotice();
    if (!activeSketchId) {
      startSketch();
      return;
    }
    const number = document.sketches.flatMap((item) => item.profiles).length + 1;
    if (type === 'arc') setCommand({ type, definition: 'threePoints', gesturePoints: [], name: `Łuk ${number}`, x1: '-10', y1: '0', x2: '0', y2: '10', x3: '10', y3: '0', direction: 'ccw' });
    if (type === 'polygon') setCommand({ type, definition: 'inscribed', gesturePoints: [], name: `Wielokąt ${number}`, sides: '6', radius: '15', x: '0', y: '0', rotation: '0', x1: '-10', y1: '0', x2: '10', y2: '0' });
    if (type === 'ellipse') setCommand({ type, definition: 'full', gesturePoints: [], name: `Elipsa ${number}`, majorRadius: '20', minorRadius: '10', x: '0', y: '0', rotation: '0', startAngle: '0', endAngle: '180', direction: 'ccw' });
    if (type === 'slot') setCommand({ type, definition: 'centerToCenter', gesturePoints: [], name: `Slot ${number}`, x1: '-15', y1: '0', x2: '15', y2: '0', x3: '-15', y3: '5', x: '0', y: '0', radius: '25', startAngle: '0', endAngle: '90', direction: 'ccw', width: '10' });
    if (type === 'spline') setCommand({ type, definition: 'fit', gesturePoints: [], name: `Spline ${number}`, pointsText: '-20,0; -8,15; 8,-15; 20,0' });
    if (type === 'conic') setCommand({ type, gesturePoints: [], name: `Conic ${number}`, x1: '-20', y1: '0', x2: '0', y2: '20', x3: '20', y3: '0', rho: '0.7071067812', continuity: 'tangent' });
    if (type === 'point') setCommand({ type, gesturePoints: [], x: '0', y: '0', role: 'standard' });
    setNotice(type === 'spline' ? 'Klikaj punkty spline na płótnie; Enter lub prawy przycisk kończy.' : 'Wskaż kolejne punkty figury na płótnie albo wpisz dokładne dane w panelu.');
  };

  const openSketchPath = (type) => {
    if (readOnly) return readOnlyNotice();
    if (!activeSketchId) {
      startSketch();
      return;
    }
    sketchPointerRef.current = null;
    sketchDynamicLengthRef.current = '';
    setCommand({
      type,
      pointIds: [],
      segmentIds: [],
      auxiliaryPointIds: [],
      points: [],
      tangents: [],
      firstPoint: null,
      lastPoint: null,
      lastTangent: null,
      length: '20',
      angle: '0',
      dynamicLength: '',
      segmentMode: 'line',
    });
    setNotice(type === 'line' ? 'Wskaż punkt początkowy linii.' : 'Klikaj kolejne punkty polilinii; kliknij początek, aby zamknąć profil.');
  };

  const finishSketchPath = () => {
    if (command?.type !== 'line' && command?.type !== 'polyline') return;
    if (!command.segmentIds.length && command.pointIds.length === 1) {
      const pendingPointId = command.pointIds[0];
      commit((next) => {
        const sketch = next.sketches.find((item) => item.id === activeSketchId);
        sketch.entities = sketch.entities.filter((entity) => entity.id !== pendingPointId);
        refreshDetectedSketchProfiles(sketch, next.parameters);
      });
    }
    setCommand(null);
    setNotice(command.segmentIds.length ? 'Zakończono rysowanie ścieżki.' : 'Anulowano pustą ścieżkę.');
  };

  const appendSketchPoint = (coordinates) => {
    if (command?.type !== 'line' && command?.type !== 'polyline') return;
    const point = coordinates.map((value) => Number(value));
    if (point.some((value) => !Number.isFinite(value))) {
      setNotice('Punkt szkicu musi mieć prawidłowe współrzędne.');
      return;
    }
    const activeSketch = document.sketches.find((sketch) => sketch.id === activeSketchId);
    if (!activeSketch) return;

    if (!command.lastPoint) {
      const start = createSketchPoint({ x: point[0].toFixed(3), y: point[1].toFixed(3) });
      commit((next) => next.sketches.find((sketch) => sketch.id === activeSketchId).entities.push(start));
      sketchDynamicLengthRef.current = '';
      setCommand((current) => ({ ...current, pointIds: [start.id], points: [point], firstPoint: point, lastPoint: point, dynamicLength: '' }));
      setNotice('Punkt początkowy ustawiony. Ustaw kierunek kursorem, wpisz długość i naciśnij Enter albo kliknij koniec.');
      return;
    }

    const start = command.lastPoint;
    const distance = Math.hypot(point[0] - start[0], point[1] - start[1]);
    const closes = command.type === 'polyline'
      && command.segmentIds.length >= 2
      && Math.hypot(point[0] - command.firstPoint[0], point[1] - command.firstPoint[1]) <= 2;
    if (!closes && distance <= 1e-7) {
      setNotice('Koniec segmentu musi różnić się od początku.');
      return;
    }

    const targetPoint = closes ? null : createSketchPoint({ x: point[0].toFixed(3), y: point[1].toFixed(3) });
    const targetPointId = closes ? command.pointIds[0] : targetPoint.id;
    const end = closes ? command.firstPoint : point;
    let segment;
    let auxiliaryPoint = null;
    let endTangent;
    if (command.segmentMode === 'tangentArc' && command.lastTangent) {
      try {
        const continuation = createTangentArcContinuation({
          startPointId: command.pointIds.at(-1),
          endPointId: targetPointId,
          start,
          end,
          tangent: command.lastTangent,
        });
        auxiliaryPoint = continuation.centerPoint;
        segment = continuation.arc;
        endTangent = continuation.endTangent;
      } catch (error) {
        setNotice(`${error.message} Wybierz punkt poza kierunkiem stycznej.`);
        return;
      }
    } else {
      segment = createSketchLine({ startPointId: command.pointIds.at(-1), endPointId: targetPointId });
      const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
      endTangent = [(end[0] - start[0]) / length, (end[1] - start[1]) / length];
    }

    const detectionSketch = structuredClone(activeSketch);
    if (targetPoint) detectionSketch.entities.push(targetPoint);
    if (auxiliaryPoint) detectionSketch.entities.push(auxiliaryPoint);
    detectionSketch.entities.push(segment);
    const topology = refreshDetectedSketchProfiles(detectionSketch, document.parameters);
    const detectedProfile = topology.profiles.find((profile) => profile.entityIds.includes(segment.id)) || null;
    commit((next) => {
      const sketch = next.sketches.find((item) => item.id === activeSketchId);
      if (targetPoint) sketch.entities.push(targetPoint);
      if (auxiliaryPoint) sketch.entities.push(auxiliaryPoint);
      sketch.entities.push(segment);
      sketch.profiles = structuredClone(detectionSketch.profiles);
      sketch.diagnostics = structuredClone(detectionSketch.diagnostics || []);
    });

    if (closes) {
      setSelection(detectedProfile ? { kind: 'profile', id: detectedProfile.id, sketchId: activeSketchId } : { kind: 'sketch', id: activeSketchId });
      setCommand(null);
      setNotice(detectedProfile
        ? `Polilinia zamknięta. Utworzono profil${detectedProfile.innerLoops?.length ? ` z ${detectedProfile.innerLoops.length} otworem` : ''} gotowy do wyciągnięcia.`
        : topology.diagnostics[0]?.message || 'Obrys jest zamknięty, ale nie tworzy poprawnego profilu.');
      return;
    }
    if (command.type === 'line') {
      setCommand(null);
      if (detectedProfile) {
        setSelection({ kind: 'profile', id: detectedProfile.id, sketchId: activeSketchId });
        setNotice('Linia zamknęła obrys. Utworzono profil gotowy do wyciągnięcia.');
      } else setNotice('Linia została dodana.');
      return;
    }
    setCommand((current) => ({
      ...current,
      pointIds: [...current.pointIds, targetPoint.id],
      segmentIds: [...current.segmentIds, segment.id],
      auxiliaryPointIds: [...current.auxiliaryPointIds, auxiliaryPoint?.id || null],
      points: [...current.points, point],
      tangents: [...current.tangents, endTangent],
      lastPoint: point,
      lastTangent: endTangent,
      segmentMode: 'line',
      dynamicLength: '',
    }));
    sketchDynamicLengthRef.current = '';
    setNotice('Segment dodany. Kliknij kolejny punkt, wybierz łuk styczny albo zamknij profil.');
  };

  const confirmExactSketchSegment = () => {
    if (!command?.lastPoint) {
      setNotice('Najpierw wskaż punkt początkowy na szkicu.');
      return;
    }
    const length = Number(command.length);
    const angle = Number(command.angle);
    if (!(length > 0) || !Number.isFinite(angle)) {
      setNotice('Długość musi być dodatnia, a kąt musi być liczbą.');
      return;
    }
    const radians = angle * Math.PI / 180;
    appendSketchPoint([command.lastPoint[0] + (Math.cos(radians) * length), command.lastPoint[1] + (Math.sin(radians) * length)]);
  };

  const confirmDynamicSketchSegment = () => {
    if (!command?.lastPoint) return;
    const length = Number(sketchDynamicLengthRef.current.replace(',', '.'));
    if (!(length > 0)) {
      setNotice('Wpisz dodatnią długość linii.');
      return;
    }
    const pointer = sketchPointerRef.current;
    const deltaX = Number(pointer?.[0]) - command.lastPoint[0];
    const deltaY = Number(pointer?.[1]) - command.lastPoint[1];
    const pointerDistance = Math.hypot(deltaX, deltaY);
    const radians = pointerDistance > 1e-7
      ? Math.atan2(deltaY, deltaX)
      : Number(command.angle || 0) * Math.PI / 180;
    sketchDynamicLengthRef.current = '';
    appendSketchPoint([
      command.lastPoint[0] + (Math.cos(radians) * length),
      command.lastPoint[1] + (Math.sin(radians) * length),
    ]);
  };

  const undoSketchSegment = () => {
    if (command?.type !== 'polyline' && command?.type !== 'line') return;
    const segmentId = command.segmentIds.at(-1);
    const pointId = command.pointIds.at(-1);
    const auxiliaryPointId = command.auxiliaryPointIds.at(-1);
    if (!segmentId) {
      if (!pointId) return;
      commit((next) => {
        const sketch = next.sketches.find((item) => item.id === activeSketchId);
        sketch.entities = sketch.entities.filter((entity) => entity.id !== pointId);
        refreshDetectedSketchProfiles(sketch, next.parameters);
      });
      setCommand((current) => ({ ...current, pointIds: [], points: [], firstPoint: null, lastPoint: null }));
      return;
    }
    commit((next) => {
      const sketch = next.sketches.find((item) => item.id === activeSketchId);
      const removed = new Set([segmentId, pointId, auxiliaryPointId].filter(Boolean));
      sketch.entities = sketch.entities.filter((entity) => !removed.has(entity.id));
      refreshDetectedSketchProfiles(sketch, next.parameters);
    });
    setCommand((current) => ({
      ...current,
      pointIds: current.pointIds.slice(0, -1),
      segmentIds: current.segmentIds.slice(0, -1),
      auxiliaryPointIds: current.auxiliaryPointIds.slice(0, -1),
      points: current.points.slice(0, -1),
      tangents: current.tangents.slice(0, -1),
      lastPoint: current.points.at(-2) || current.firstPoint,
      lastTangent: current.tangents.at(-2) || null,
      segmentMode: 'line',
    }));
    setNotice('Cofnięto ostatni segment bez wychodzenia z polilinii.');
  };

  const handleSketchSelection = (ids, mode = 'replace', details = {}) => {
    const candidates = [...new Set(ids || [])];
    setSelection((current) => {
      const existing = current?.kind === 'sketchEntities' && current.sketchId === activeSketchId ? current.ids : [];
      let nextIds;
      if (mode === 'add') nextIds = [...new Set([...existing, ...candidates])];
      else if (mode === 'toggle') {
        const next = new Set(existing);
        candidates.forEach((id) => next.has(id) ? next.delete(id) : next.add(id));
        nextIds = [...next];
      } else nextIds = candidates;
      return nextIds.length
        ? { kind: 'sketchEntities', sketchId: activeSketchId, ids: nextIds }
        : { kind: 'sketch', id: activeSketchId };
    });
    if (candidates.length) {
      setNotice(`${details.crossing ? 'Wybór przecinający' : 'Zaznaczenie'}: ${candidates.length} ${candidates.length === 1 ? 'element' : 'elementy'}. Ctrl/Shift dodaje kolejne.`);
    } else setNotice('Wyczyszczono zaznaczenie szkicu.');
  };

  const handleTopologySelection = (topology, mode = 'replace') => {
    if (!topology) {
      setSelection({ kind: 'document', id: document.id });
      return;
    }
    const item = topology.kind === 'body'
      ? { kind: 'body', id: topology.bodyId, bodyId: topology.bodyId, sourceFeatureId: topology.sourceFeatureId }
      : { kind: topology.kind, id: topology.id, bodyId: topology.bodyId, sourceFeatureId: topology.sourceFeatureId };
    setSelection((current) => {
      if (mode === 'replace') return { ...item, items: [item] };
      const existing = current?.items || (['body', 'face', 'edge', 'vertex'].includes(current?.kind) ? [current] : []);
      const key = `${item.kind}:${item.id}`;
      const hasItem = existing.some((entry) => `${entry.kind}:${entry.id}` === key);
      const items = mode === 'toggle' && hasItem
        ? existing.filter((entry) => `${entry.kind}:${entry.id}` !== key)
        : hasItem ? existing : [...existing, item];
      if (!items.length) return { kind: 'document', id: document.id };
      return { ...items.at(-1), items };
    });
    const label = topology.kind === 'face' ? 'Ściana' : topology.kind === 'edge' ? 'Krawędź' : topology.kind === 'vertex' ? 'Wierzchołek' : 'Bryła';
    setNotice(`${label} zaznaczona przez trwałe ID: ${topology.id}.${mode === 'replace' ? '' : ' Ctrl/Shift utrzymuje wybór wielokrotny.'}`);
  };

  const repairTopologyReference = (referenceId, topology, descriptor = null) => {
    if (readOnly) return readOnlyNotice();
    try {
      commit((next) => {
        const index = next.references.findIndex((reference) => reference.id === referenceId);
        if (index < 0) throw new Error('Nie znaleziono referencji do naprawy.');
        next.references[index] = reassignTopologyReference(next.references[index], topology, descriptor);
        synchronizeProjectedGeometry(next, actualBodies);
      });
      setSelection({ kind: topology.kind, id: topology.id, bodyId: topology.bodyId, sourceFeatureId: topology.sourceFeatureId, items: [topology] });
      setNotice('Referencja została ponownie przypisana i historia modelu jest przeliczana.');
    } catch (error) {
      setNotice(`Nie udało się naprawić referencji: ${error.message}`);
    }
  };

  const toggleConstructionVisibility = (referenceId) => {
    if (readOnly) return readOnlyNotice();
    commit((next) => {
      const reference = next.references.find((item) => item.id === referenceId && ['construction-plane', 'construction-axis', 'construction-point'].includes(item.kind));
      if (reference) reference.visible = !reference.visible;
    });
  };

  const moveSketchEntities = ({ ids = selectedSketchEntityIds, dx = 0, dy = 0 } = {}) => {
    if (readOnly) return readOnlyNotice();
    if (!activeSketchId || !ids.length) {
      setNotice('Wybierz punkt lub segment szkicu do przesunięcia.');
      return false;
    }
    try {
      const checked = cloneDocument(document);
      translateSketchSelection(
        checked.sketches.find((item) => item.id === activeSketchId),
        ids,
        { dx, dy },
        checked.parameters,
      );
      refreshDetectedSketchProfiles(checked.sketches.find((item) => item.id === activeSketchId), checked.parameters);
      commit((next) => {
        const sketch = next.sketches.find((item) => item.id === activeSketchId);
        translateSketchSelection(sketch, ids, { dx, dy }, next.parameters);
        refreshDetectedSketchProfiles(sketch, next.parameters);
      });
      setNotice(`Przesunięto ${ids.length} ${ids.length === 1 ? 'element' : 'elementy'}: ΔX ${Number(dx).toFixed(1)} mm, ΔY ${Number(dy).toFixed(1)} mm.`);
      return true;
    } catch (error) {
      setNotice(error.message);
      return false;
    }
  };

  const addSelectedSketchConstraint = (type) => {
    if (readOnly) return readOnlyNotice();
    const valid = type === 'collinear' ? canAddCollinear : type === 'symmetry' ? canAddSymmetry : type === 'curvature' ? canAddCurvature : false;
    if (!activeSketchId || !valid) {
      setNotice(type === 'collinear' ? 'Współliniowość wymaga zaznaczenia dwóch linii.' : type === 'symmetry' ? 'Symetria wymaga zaznaczenia dwóch punktów i jednej linii osi.' : 'Krzywizna G2 wymaga dwóch łuków z jednym wspólnym końcem.');
      return;
    }
    const constraint = createSketchConstraint(type, selectedSketchEntityIds);
    const applyConstraint = (next) => {
      const sketch = next.sketches.find((item) => item.id === activeSketchId);
      sketch.constraints.push(constraint);
      const solution = solveSketchConstraints(sketch, next.parameters);
      if (!solution.converged || !solution.solved || solution.status === SKETCH_SOLVER_STATUS.CONFLICT) {
        throw new Error(solution.diagnostics?.[0]?.message || 'Solver nie znalazł poprawnego rozwiązania.');
      }
      applySketchConstraintSolution(sketch, solution);
      refreshDetectedSketchProfiles(sketch, next.parameters);
    };
    try {
      const checked = cloneDocument(document);
      applyConstraint(checked);
      commit(applyConstraint);
      setSelection({ kind: 'sketchConstraint', id: constraint.id, sketchId: activeSketchId });
      setNotice(type === 'collinear' ? 'Dodano więz współliniowości. Cofnij przywraca poprzednią geometrię.' : type === 'symmetry' ? 'Dodano więz symetrii względem wskazanej osi. Cofnij przywraca poprzednią geometrię.' : 'Dodano ciągłość krzywizny G2 między łukami. Cofnij przywraca poprzednią geometrię.');
    } catch (error) {
      setNotice(`Nie dodano więzu: ${error.message}`);
    }
  };

  const openSketchDimension = (dimensionType) => {
    if (readOnly) return readOnlyNotice();
    const sketch = document.sketches.find((item) => item.id === activeSketchId);
    const entity = selectedSketchEntities[0];
    if (!sketch || (dimensionType === 'arcLength' ? !canAddArcLength : !canAddOrdinate)) {
      setNotice(dimensionType === 'arcLength' ? 'Długość łuku wymaga zaznaczenia jednego łuku.' : 'Wymiar ordinate wymaga zaznaczenia jednego punktu.');
      return;
    }
    let value = dimensionType === 'ordinateX' ? entity.geometry.x : entity.geometry.y;
    if (dimensionType === 'arcLength') {
      const resolved = resolveParameters(document.parameters);
      if (!resolved.valid) {
        setNotice('Nie można odczytać długości łuku, dopóki parametry dokumentu zawierają błędy.');
        return;
      }
      const [center, start, end] = entity.pointIds.map((pointId) => sketch.entities.find((item) => item.id === pointId));
      const point = (item) => ({
        x: evaluateExpression(item?.geometry?.x, resolved.values),
        y: evaluateExpression(item?.geometry?.y, resolved.values),
      });
      const centerValue = point(center); const startValue = point(start); const endValue = point(end);
      if ([centerValue, startValue, endValue].some((item) => !Number.isFinite(item.x) || !Number.isFinite(item.y))) {
        setNotice('Nie można odczytać bieżącej długości łuku. Sprawdź współrzędne jego punktów.');
        return;
      }
      const radius = Math.hypot(startValue.x - centerValue.x, startValue.y - centerValue.y);
      let sweep = Math.atan2(endValue.y - centerValue.y, endValue.x - centerValue.x) - Math.atan2(startValue.y - centerValue.y, startValue.x - centerValue.x);
      if (entity.geometry.direction === 'cw') { while (sweep >= 0) sweep -= Math.PI * 2; }
      else { while (sweep <= 0) sweep += Math.PI * 2; }
      value = String(radius * Math.abs(sweep));
    }
    setCommand({ type: 'sketchDimension', dimensionType, entityIds: [...selectedSketchEntityIds], value: String(value) });
    setNotice('Podaj wartość sterującą wymiaru szkicu.');
  };

  const confirmSketchDimension = () => {
    if (command?.type !== 'sketchDimension' || readOnly) return;
    try {
      const checked = cloneDocument(document);
      const checkedSketch = checked.sketches.find((item) => item.id === activeSketchId);
      if (!checkedSketch) throw new Error('Nie znaleziono aktywnego szkicu.');
      const created = addDrivingSketchDimension(checkedSketch, command.dimensionType, command.entityIds, { expression: command.value });
      const checkedSolution = solveSketchConstraints(checkedSketch, checked.parameters);
      if (!checkedSolution.converged || !checkedSolution.solved || checkedSolution.status === SKETCH_SOLVER_STATUS.CONFLICT) {
        throw new Error(checkedSolution.diagnostics?.[0]?.message || 'Solver nie znalazł poprawnego rozwiązania.');
      }
      applySketchConstraintSolution(checkedSketch, checkedSolution);
      refreshDetectedSketchProfiles(checkedSketch, checked.parameters);
      commit((next) => {
        const sketch = next.sketches.find((item) => item.id === activeSketchId);
        sketch.constraints.push({ ...created.constraint, entityIds: [...created.constraint.entityIds] });
        sketch.dimensions.push({ ...created.dimension, entityIds: [...created.dimension.entityIds] });
        const solution = solveSketchConstraints(sketch, next.parameters);
        if (!solution.converged || !solution.solved || solution.status === SKETCH_SOLVER_STATUS.CONFLICT) throw new Error('Solver nie odtworzył wymiaru.');
        applySketchConstraintSolution(sketch, solution);
        refreshDetectedSketchProfiles(sketch, next.parameters);
      });
      setSelection({ kind: 'sketchConstraint', id: created.constraint.id, sketchId: activeSketchId });
      setCommand(null);
      setNotice('Dodano sterujący wymiar szkicu. Zaznacz jego znacznik, aby zmienić wartość.');
    } catch (error) {
      setNotice(`Nie dodano wymiaru: ${error.message}`);
    }
  };

  const openSketchMove = () => {
    if (!selectedSketchEntityIds.length) {
      setNotice('Najpierw zaznacz punkt lub segment szkicu.');
      return;
    }
    setCommand({ type: 'moveSketch', dx: '0', dy: '0' });
    setNotice('Wpisz dokładne przesunięcie w osiach aktywnego szkicu.');
  };

  const confirmSketchMove = () => {
    if (moveSketchEntities({ ids: selectedSketchEntityIds, dx: command.dx, dy: command.dy })) setCommand(null);
  };

  const activeOffsetProfile = selection?.kind === 'profile' && selectedProfileMatch?.sketch.id === activeSketchId
    ? selectedProfile
    : null;

  const openSketchOffset = () => {
    if (!selectedSketchEntityIds.length && !activeOffsetProfile) {
      setNotice('Najpierw zaznacz krzywą, ciągły łańcuch albo profil szkicu.');
      return;
    }
    setCommand({ type: 'offsetSketch', distance: '2' });
    setNotice('Wpisz odległość Offset. Zmień znak, aby wybrać przeciwną stronę.');
  };

  const confirmSketchOffset = () => {
    const applyOffset = (next) => activeOffsetProfile
      ? offsetSketchProfile(next, activeSketchId, activeOffsetProfile.id, command.distance)
      : offsetSketchEntities(next, activeSketchId, selectedSketchEntityIds, command.distance);
    try {
      const checked = cloneDocument(document);
      const result = applyOffset(checked);
      commit((next) => Object.assign(next, checked));
      setSelection({ kind: 'sketchEntities', sketchId: activeSketchId, ids: result.createdEntityIds });
      setCommand(null);
      setNotice(`Offset utworzył ${result.createdEntityIds.length} ${result.createdEntityIds.length === 1 ? 'krzywą' : 'krzywe'} w odległości ${result.distance} mm. Cofnij przywraca stan.`);
    } catch (error) {
      setNotice(`Offset nie został wykonany: ${error.message}`);
    }
  };

  const openSketchCorner = (mode) => {
    if (selectedSketchEntityIds.length !== 2) {
      setNotice(`${mode === 'fillet' ? 'Fillet' : 'Chamfer'} wymaga zaznaczenia dokładnie dwóch linii ze wspólnym narożnikiem.`);
      return;
    }
    setCommand({ type: 'cornerSketch', mode, size: '2' });
    setNotice(`Wpisz ${mode === 'fillet' ? 'promień zaokrąglenia' : 'odległość fazy'} narożnika.`);
  };

  const confirmSketchCorner = () => {
    const operation = command.mode === 'fillet' ? filletSketchLines : chamferSketchLines;
    const applyCorner = (next) => operation(next, activeSketchId, selectedSketchEntityIds, command.size);
    try {
      const checked = cloneDocument(document);
      const result = applyCorner(checked);
      commit((next) => Object.assign(next, checked));
      setSelection({ kind: 'sketchEntities', sketchId: activeSketchId, ids: [result.connectorEntityId] });
      setCommand(null);
      setNotice(`${command.mode === 'fillet' ? 'Fillet' : 'Chamfer'} szkicu wykonany${result.removedConstraintIds.length ? `; usunięto ${result.removedConstraintIds.length} zerwanych więzów` : ''}. Cofnij przywraca cały narożnik.`);
    } catch (error) {
      setNotice(`${command.mode === 'fillet' ? 'Fillet' : 'Chamfer'} szkicu nie został wykonany: ${error.message}`);
    }
  };

  const openSketchTransform = () => {
    if (!selectedSketchEntityIds.length) {
      setNotice('Najpierw zaznacz geometrię szkicu do transformacji.');
      return;
    }
    setCommand({ type: 'transformSketch', operation: 'rotate', centerX: '0', centerY: '0', angle: '90', dx: '10', dy: '0', axis: 'vertical', axisOffset: '0', factor: '2' });
    setNotice('Wybierz Rotate, Copy, Mirror albo Scale i wpisz dokładne wartości.');
  };

  const confirmSketchTransform = () => {
    const applyTransform = (next) => {
      if (command.operation === 'copy') return copySketchSelection(next, activeSketchId, selectedSketchEntityIds, { dx: command.dx, dy: command.dy });
      if (command.operation === 'mirror') return mirrorSketchSelection(next, activeSketchId, selectedSketchEntityIds, command.axis === 'vertical'
        ? { originX: command.axisOffset, originY: 0, angle: 90 }
        : { originX: 0, originY: command.axisOffset, angle: 0 });
      if (command.operation === 'scale') return scaleSketchSelection(next, activeSketchId, selectedSketchEntityIds, { centerX: command.centerX, centerY: command.centerY, factor: command.factor });
      return rotateSketchSelection(next, activeSketchId, selectedSketchEntityIds, { centerX: command.centerX, centerY: command.centerY, angle: command.angle });
    };
    try {
      const checked = cloneDocument(document);
      const result = applyTransform(checked);
      commit((next) => Object.assign(next, checked));
      const resultIds = result.createdEntityIds || result.transformedEntityIds;
      setSelection({ kind: 'sketchEntities', sketchId: activeSketchId, ids: resultIds });
      setCommand(null);
      const label = command.operation[0].toUpperCase() + command.operation.slice(1);
      setNotice(`${label} wykonany dla ${resultIds.length} ${resultIds.length === 1 ? 'elementu' : 'elementów'}${result.removedConstraintIds?.length ? `; usunięto ${result.removedConstraintIds.length} zerwanych więzów` : ''}. Cofnij przywraca stan.`);
    } catch (error) {
      setNotice(`Transformacja nie została wykonana: ${error.message}`);
    }
  };

  const openSketchPattern = () => {
    if (!selectedSketchEntityIds.length) {
      setNotice('Najpierw zaznacz geometrię źródłową szyku.');
      return;
    }
    const sketch = document.sketches.find((item) => item.id === activeSketchId);
    const pathOptions = (sketch?.entities || []).filter((entity) => ['line', 'arc'].includes(entity.type) && !selectedSketchEntityIds.includes(entity.id))
      .map((entity, index) => ({ id: entity.id, label: `${entity.type === 'line' ? 'Linia' : 'Łuk'} ścieżki ${index + 1}` }));
    setCommand({ type: 'patternSketch', mode: 'rectangular', columns: '3', rows: '2', spacingX: '15', spacingY: '15', count: '6', centerX: '0', centerY: '0', totalAngle: '360', pathEntityId: pathOptions[0]?.id || '', pathOptions, orientToPath: true, skippedOccurrences: '' });
    setNotice('Wybierz szyk prostokątny lub kołowy oraz opcjonalne wystąpienia do pominięcia.');
  };

  const confirmSketchPattern = () => {
    const applyPattern = (next) => command.mode === 'circular'
      ? circularSketchPattern(next, activeSketchId, selectedSketchEntityIds, { count: command.count, centerX: command.centerX, centerY: command.centerY, totalAngle: command.totalAngle, skippedOccurrences: command.skippedOccurrences })
      : command.mode === 'path'
        ? pathSketchPattern(next, activeSketchId, selectedSketchEntityIds, { pathEntityId: command.pathEntityId, count: command.count, orientToPath: command.orientToPath, skippedOccurrences: command.skippedOccurrences })
        : rectangularSketchPattern(next, activeSketchId, selectedSketchEntityIds, { columns: command.columns, rows: command.rows, spacingX: command.spacingX, spacingY: command.spacingY, skippedOccurrences: command.skippedOccurrences });
    try {
      const checked = cloneDocument(document);
      const result = applyPattern(checked);
      commit((next) => Object.assign(next, checked));
      setSelection({ kind: 'sketchEntities', sketchId: activeSketchId, ids: result.createdEntityIds });
      setCommand(null);
      setNotice(`${command.mode === 'circular' ? 'Szyk kołowy' : command.mode === 'path' ? 'Szyk po ścieżce' : 'Szyk prostokątny'} utworzył ${result.occurrences.length} ${result.occurrences.length === 1 ? 'kopię' : 'kopie'}${result.skippedOccurrences.length ? `; pominięto: ${result.skippedOccurrences.join(', ')}` : ''}. Cofnij przywraca stan.`);
    } catch (error) {
      setNotice(`Szyk nie został wykonany: ${error.message}`);
    }
  };

  const projectSelectedTopology = () => {
    if (readOnly) return readOnlyNotice();
    const selected = (selection?.items || (['edge', 'vertex'].includes(selection?.kind) ? [selection] : [])).filter((item) => ['edge', 'vertex'].includes(item.kind));
    if (command?.type !== 'projectSketch' || !selected.length) {
      setCommand({ type: 'projectSketch' });
      setNotice('Project: kliknij wierzchołek albo krawędź modelu. Ctrl/Shift dodaje kolejne; ponownie wybierz Project, aby zatwierdzić.');
      return;
    }
    try {
      const sources = selected.map((item) => {
        const body = engine.bodies.find((candidate) => candidate.id === item.bodyId);
        const records = item.kind === 'edge' ? body?.topology?.edges : body?.topology?.vertices;
        const record = records?.find((candidate) => candidate.id === item.id);
        if (!record) throw new Error(`Nie znaleziono źródła ${item.kind}.`);
        return { selection: { ...item, sourceFeatureId: item.sourceFeatureId || body.sourceFeatureId }, descriptor: record.descriptor };
      });
      const checked = cloneDocument(document);
      const result = projectTopologyToSketch(checked, activeSketchId, sources);
      commit((next) => Object.assign(next, checked));
      setSelection({ kind: 'sketchEntities', sketchId: activeSketchId, ids: result.createdEntityIds });
      setCommand(null);
      setNotice(`Project utworzył ${result.createdEntityIds.length} elementów z ${result.createdReferenceIds.length} trwałych referencji.`);
    } catch (error) {
      setNotice(`Project nie został wykonany: ${error.message}`);
    }
  };

  const deleteSelectedSketchEntities = () => {
    if (readOnly) return readOnlyNotice();
    if (activeSketchId && selectedSketchConstraintId) {
      commit((next) => {
        const sketch = next.sketches.find((item) => item.id === activeSketchId);
        sketch.constraints = (sketch.constraints || []).filter((constraint) => constraint.id !== selectedSketchConstraintId);
        sketch.dimensions = (sketch.dimensions || []).filter((dimension) => dimension.constraintId !== selectedSketchConstraintId);
      });
      setSelection({ kind: 'sketch', id: activeSketchId });
      setNotice('Usunięto więz i powiązany wymiar. Cofnij przywraca cały stan.');
      return;
    }
    if (!activeSketchId || !selectedSketchEntityIds.length) {
      setNotice('Wybierz geometrię albo badge więzu do usunięcia.');
      return;
    }
    const checked = cloneDocument(document);
    const result = deleteSketchSelection(checked, activeSketchId, selectedSketchEntityIds);
    commit((next) => {
      deleteSketchSelection(next, activeSketchId, selectedSketchEntityIds);
      refreshDetectedSketchProfiles(next.sketches.find((item) => item.id === activeSketchId), next.parameters);
    });
    setSelection({ kind: 'sketch', id: activeSketchId });
    setCommand(null);
    setNotice(`Usunięto ${result.entityIds.length} encji${result.profileIds.length ? `, ${result.profileIds.length} zależny profil` : ''}${result.featureIds.length ? ` i ${result.featureIds.length} zależną operację` : ''}. Cofnij przywraca cały stan.`);
  };

  const updateSketchConstraintValue = (constraintId, value) => {
    if (readOnly) return readOnlyNotice();
    const applyValue = (next) => {
      const sketch = next.sketches.find((item) => item.id === activeSketchId);
      const constraint = sketch?.constraints?.find((item) => item.id === constraintId);
      if (!constraint) throw new Error('Nie znaleziono wybranego więzu.');
      constraint.value = String(value);
      for (const dimension of sketch.dimensions || []) {
        if (dimension.constraintId === constraintId) dimension.expression = String(value);
      }
      const solution = solveSketchConstraints(sketch, next.parameters);
      if (!solution.converged || !solution.solved || solution.status === SKETCH_SOLVER_STATUS.CONFLICT) {
        throw new Error(solution.diagnostics?.[0]?.message || 'Solver nie znalazł poprawnego rozwiązania.');
      }
      applySketchConstraintSolution(sketch, solution);
      refreshDetectedSketchProfiles(sketch, next.parameters);
    };
    try {
      const checked = cloneDocument(document);
      applyValue(checked);
      commit(applyValue);
      setNotice(`Zmieniono wartość więzu na ${value}. Szkic i zależny model zostaną przeliczone.`);
    } catch (error) {
      setNotice(`Nie zmieniono więzu: ${error.message}`);
    }
  };

  const modifySketchAtPoint = ({ mode, entityId, point }) => {
    if (readOnly) return readOnlyNotice();
    try {
      const checked = cloneDocument(document);
      const operation = mode === 'extend' ? extendSketchEntity : mode === 'break' ? breakSketchEntity : trimSketchEntity;
      const result = operation(checked, activeSketchId, entityId, point);
      commit((next) => operation(next, activeSketchId, entityId, point));
      setSelection({ kind: 'sketch', id: activeSketchId });
      const label = mode === 'extend' ? 'Extend' : mode === 'break' ? 'Break' : 'Trim';
      setNotice(`${label} wykonany${result.removedConstraintIds.length ? `; usunięto ${result.removedConstraintIds.length} zerwanych więzów` : ''}${result.removedFeatureIds.length ? ` i ${result.removedFeatureIds.length} zależną operację` : ''}. Cofnij przywraca stan.`);
    } catch (error) {
      const label = mode === 'extend' ? 'Extend' : mode === 'break' ? 'Break' : 'Trim';
      setNotice(`${label} nie został wykonany: ${error.message}`);
    }
  };

  useEffect(() => {
    const verifyMode = new URLSearchParams(window.location.search).has('verify');
    if (!verifyMode) return undefined;
    window.__madcadVerifySketchPoint = appendSketchPoint;
    window.__madcadVerifyCanvasSketchPoint = handleSketchCanvasPoint;
    window.__madcadVerifyFinishCanvasSketchTool = finishCanvasSketchTool;
    window.__madcadVerifySketchSelection = handleSketchSelection;
    window.__madcadVerifyTopologySelection = handleTopologySelection;
    window.__madcadVerifyCreateLostTopologyReference = () => {
      const body = engine.bodies[0];
      const edge = body?.topology?.edges?.[0];
      if (!body || !edge) throw new Error('Brak topologii do testu utraconej referencji.');
      const ownerFeatureId = document.features.at(-1)?.id || body.sourceFeatureId;
      const reference = createTopologyReference({
        selection: { kind: 'edge', id: `${edge.id}-lost`, bodyId: body.id, sourceFeatureId: body.sourceFeatureId },
        ownerFeatureId,
        descriptor: edge.descriptor,
        label: 'Kontrolowana utracona krawędź',
      });
      history.commit((next) => { next.references.push(reference); });
      return reference.id;
    };
    window.__madcadVerifyBreakProjectedReference = () => {
      const projected = document.sketches.flatMap((sketch) => sketch.entities)
        .find((entity) => entity.type === 'line' && entity.role === 'projected' && entity.projectionReferenceId);
      if (!projected) throw new Error('Brak geometrii Project do testu utraconej referencji.');
      history.commit((next) => {
        const reference = next.references.find((item) => item.id === projected.projectionReferenceId);
        if (!reference) throw new Error('Brak źródła Project do kontrolowanego zerwania.');
        reference.topologyId = `${reference.topologyId}-lost`;
      });
      return { entityId: projected.id, referenceId: projected.projectionReferenceId };
    };
    window.__madcadVerifyMoveSketch = moveSketchEntities;
    window.__madcadVerifyDeleteSketch = deleteSelectedSketchEntities;
    window.__madcadVerifyLoadTopologyFixture = (plane = 'XY') => {
      const fixture = createDocument(`Topologia ${plane}`);
      const loopEntities = (coordinates) => {
        const points = coordinates.map(([x, y]) => createSketchPoint({ x, y }));
        const lines = points.map((point, index) => createSketchLine({ startPointId: point.id, endPointId: points[(index + 1) % points.length].id }));
        return [...points, ...lines];
      };
      const sketch = createSketch({
        name: `Profil z otworem ${plane}`,
        plane,
        entities: [
          ...loopEntities([[0, 0], [40, 0], [40, 30], [0, 30]]),
          ...loopEntities([[10, 8], [30, 8], [30, 22], [10, 22]]),
        ],
      });
      refreshDetectedSketchProfiles(sketch, fixture.parameters);
      fixture.sketches.push(sketch);
      fixture.features.push(createFeature('extrude', {
        name: `Wyciągnięcie z otworem ${plane}`,
        sketchId: sketch.id,
        profileIds: [sketch.profiles[0].id],
        distance: '6',
        operation: 'new',
      }));
      history.replace(fixture);
      setActiveSketchId(null);
      setWorkspace('solid');
      setSelection({ kind: 'document', id: fixture.id });
      setCommand(null);
    };
    window.__madcadVerifyLoadMechanicalFixture = (kind = 'ellipse') => {
      const fixture = createDocument(`Figura mechaniczna ${kind}`);
      let shape;
      if (kind === 'bracket') {
        const lowerLeft = createSketchPoint({ x: -40, y: -25 });
        const lowerArc = createSketchPoint({ x: 20, y: -25 });
        const arcCenter = createSketchPoint({ x: 20, y: 0 });
        const upperArc = createSketchPoint({ x: 20, y: 25 });
        const upperLeft = createSketchPoint({ x: -40, y: 25 });
        const outline = [
          createSketchLine({ startPointId: lowerLeft.id, endPointId: lowerArc.id }),
          createSketchArc({ centerPointId: arcCenter.id, startPointId: lowerArc.id, endPointId: upperArc.id, direction: 'ccw' }),
          createSketchLine({ startPointId: upperArc.id, endPointId: upperLeft.id }),
          createSketchLine({ startPointId: upperLeft.id, endPointId: lowerLeft.id }),
        ];
        const slot = slotCenterToCenter([-12, 0], [8, 0], 8);
        const firstHole = circleCenterRadius([-25, -12], 4);
        const secondHole = circleCenterRadius([-25, 12], 4);
        shape = { entities: [lowerLeft, lowerArc, arcCenter, upperArc, upperLeft, ...outline, ...slot.entities, ...firstHole.entities, ...secondHole.entities] };
      } else if (kind === 'ellipse') shape = ellipseFromCenter([0, 0], 20, 10, 25);
      else if (kind === 'spline') {
        shape = fitPointSpline([[0, 0], [8, 12], [16, 8], [24, 0]]);
        shape.entities.push(createSketchLine({ startPointId: shape.points.at(-1).id, endPointId: shape.points[0].id }));
      } else if (kind === 'conic') {
        shape = conicThroughControlPoint([-14, 0], [0, 18], [14, 0], Math.SQRT1_2, 'tangent');
        shape.entities.push(createSketchLine({ startPointId: shape.points[2].id, endPointId: shape.points[0].id }));
      } else if (kind === 'ellipticalArc') {
        shape = ellipticalArcFromCenter([0, 0], 20, 10, 0, 180, 0, 'ccw');
        shape.entities.push(createSketchLine({ startPointId: shape.points[2].id, endPointId: shape.points[1].id }));
      } else if (kind === 'slotArc') shape = slotArc({ center: [0, 0], radius: 25, width: 10, startAngle: 0, endAngle: 90, direction: 'ccw' });
      else shape = slotCenterToCenter([-15, 0], [15, 0], 10);
      const sketch = createSketch({ name: `Szkic ${kind}`, plane: 'XY', entities: shape.entities });
      refreshDetectedSketchProfiles(sketch, fixture.parameters);
      fixture.sketches.push(sketch);
      fixture.features.push(createFeature('extrude', { name: `Wyciągnięcie ${kind}`, sketchId: sketch.id, profileIds: [sketch.profiles[0].id], distance: '3', operation: 'new' }));
      history.replace(fixture);
      setActiveSketchId(null);
      setWorkspace('solid');
      setSelection({ kind: 'document', id: fixture.id });
      setCommand(null);
    };
    window.__madcadVerifyLoadParametricBracketFixture = () => {
      const fixture = createDocument('W pełni związany wspornik');
      const points = [
        createSketchPoint({ x: 0, y: 0, fixed: true }),
        createSketchPoint({ x: 40, y: 0 }),
        createSketchPoint({ x: 40, y: 30 }),
        createSketchPoint({ x: 0, y: 30 }),
      ];
      const lines = points.map((point, index) => createSketchLine({ startPointId: point.id, endPointId: points[(index + 1) % points.length].id }));
      const sketch = createSketch({ name: 'Szkic wspornika', plane: 'XY', entities: [...points, ...lines], constraints: [
        createSketchConstraint('horizontal', [lines[0].id]),
        createSketchConstraint('vertical', [lines[1].id]),
        createSketchConstraint('horizontal', [lines[2].id]),
        createSketchConstraint('vertical', [lines[3].id]),
      ] });
      const width = addDrivingSketchDimension(sketch, 'horizontal', [points[0].id, points[1].id], { expression: '40' });
      const height = addDrivingSketchDimension(sketch, 'vertical', [points[0].id, points[3].id], { expression: '30' });
      refreshDetectedSketchProfiles(sketch, fixture.parameters);
      const feature = createFeature('extrude', { name: 'Bryła wspornika', sketchId: sketch.id, profileIds: [sketch.profiles[0].id], distance: '5', operation: 'new' });
      fixture.sketches.push(sketch);
      fixture.features.push(feature);
      window.__madcadParametricBracketIds = {
        sketchId: sketch.id,
        entityIds: sketch.entities.map((entity) => entity.id),
        profileId: sketch.profiles[0].id,
        featureId: feature.id,
        widthConstraintId: width.constraint.id,
        heightConstraintId: height.constraint.id,
      };
      history.replace(fixture);
      setActiveSketchId(sketch.id);
      setWorkspace('solid');
      setSelection({ kind: 'sketch', id: sketch.id });
      setCommand(null);
    };
    window.__madcadVerifyLoadConstraintFixture = () => {
      const fixture = createDocument('Więzy P1');
      const sourcePoints = [createSketchPoint({ x: 0, y: 0 }), createSketchPoint({ x: 10, y: 0 })];
      const targetPoints = [createSketchPoint({ x: 2, y: 3 }), createSketchPoint({ x: 8, y: 5 })];
      const sourceLine = createSketchLine({ startPointId: sourcePoints[0].id, endPointId: sourcePoints[1].id, fixed: true });
      const targetLine = createSketchLine({ startPointId: targetPoints[0].id, endPointId: targetPoints[1].id });
      const axisPoints = [createSketchPoint({ x: 0, y: -10 }), createSketchPoint({ x: 0, y: 10 })];
      const axisLine = createSketchLine({ startPointId: axisPoints[0].id, endPointId: axisPoints[1].id, fixed: true });
      const symmetryPoints = [createSketchPoint({ x: -3, y: 2, fixed: true }), createSketchPoint({ x: 5, y: 4 })];
      const curvatureCenters = [createSketchPoint({ x: 20, y: 0, fixed: true }), createSketchPoint({ x: 22, y: 1 })];
      const curvaturePoints = [createSketchPoint({ x: 10, y: 0 }), createSketchPoint({ x: 30, y: 0 }), createSketchPoint({ x: 20, y: 10 })];
      const curvatureArcs = [
        createSketchArc({ centerPointId: curvatureCenters[0].id, startPointId: curvaturePoints[0].id, endPointId: curvaturePoints[1].id, direction: 'ccw' }),
        createSketchArc({ centerPointId: curvatureCenters[1].id, startPointId: curvaturePoints[1].id, endPointId: curvaturePoints[2].id, direction: 'ccw' }),
      ];
      const sketch = createSketch({ name: 'Szkic więzów P1', plane: 'XY', entities: [...sourcePoints, ...targetPoints, sourceLine, targetLine, ...axisPoints, axisLine, ...symmetryPoints, ...curvatureCenters, ...curvaturePoints, ...curvatureArcs] });
      fixture.sketches.push(sketch);
      window.__madcadConstraintFixtureIds = {
        collinear: [sourceLine.id, targetLine.id],
        symmetry: [symmetryPoints[0].id, symmetryPoints[1].id, axisLine.id],
        targetPointIds: targetPoints.map((point) => point.id),
        reflectedPointId: symmetryPoints[1].id,
        curvature: curvatureArcs.map((arc) => arc.id),
        curvatureCenterId: curvatureCenters[1].id,
      };
      history.replace(fixture);
      setActiveSketchId(sketch.id);
      setWorkspace('sketch');
      setSelection({ kind: 'sketch', id: sketch.id });
      setCommand(null);
    };
    window.__madcadVerifyLoadDimensionFixture = () => {
      const fixture = createDocument('Wymiary P1');
      const ordinatePoint = createSketchPoint({ x: 3, y: 4 });
      const center = createSketchPoint({ x: 0, y: 0, fixed: true });
      const start = createSketchPoint({ x: 10, y: 0 });
      const end = createSketchPoint({ x: 0, y: 10 });
      const arc = createSketchArc({ centerPointId: center.id, startPointId: start.id, endPointId: end.id, direction: 'ccw' });
      const sketch = createSketch({ name: 'Szkic wymiarów P1', plane: 'XY', entities: [ordinatePoint, center, start, end, arc] });
      fixture.sketches.push(sketch);
      window.__madcadDimensionFixtureIds = {
        pointId: ordinatePoint.id,
        arcId: arc.id,
        centerId: center.id,
        startId: start.id,
        endId: end.id,
      };
      history.replace(fixture);
      setActiveSketchId(sketch.id);
      setWorkspace('sketch');
      setSelection({ kind: 'sketch', id: sketch.id });
      setCommand(null);
    };
    window.__madcadVerifyLoadPatternFixture = (mode = 'rectangular') => {
      const fixture = createDocument(`Szyk ${mode}`);
      if (mode === 'path') {
        const source = createSketchPoint({ x: 0, y: 0 });
        const pathStart = createSketchPoint({ x: 0, y: 0, role: 'construction' });
        const pathEnd = createSketchPoint({ x: 30, y: 0, role: 'construction' });
        const pathLine = createSketchLine({ startPointId: pathStart.id, endPointId: pathEnd.id, role: 'construction' });
        const sketch = createSketch({ name: 'Szkic szyku po ścieżce', plane: 'XY', entities: [source, pathStart, pathEnd, pathLine] });
        fixture.sketches.push(sketch);
        window.__madcadPatternFixtureIds = { sourceIds: [source.id], pathId: pathLine.id };
        history.replace(fixture);
        setActiveSketchId(sketch.id);
        setWorkspace('sketch');
        setSelection({ kind: 'sketch', id: sketch.id });
        setCommand(null);
        return;
      }
      const points = [[10, -2], [14, -2], [14, 2], [10, 2]].map(([x, y]) => createSketchPoint({ x, y }));
      const lines = points.map((point, index) => createSketchLine({ startPointId: point.id, endPointId: points[(index + 1) % points.length].id }));
      const sketch = createSketch({ name: `Szkic szyku ${mode}`, plane: 'XY', entities: [...points, ...lines] });
      refreshDetectedSketchProfiles(sketch, fixture.parameters);
      fixture.sketches.push(sketch);
      window.__madcadPatternFixtureIds = { lineIds: lines.map((line) => line.id) };
      history.replace(fixture);
      setActiveSketchId(sketch.id);
      setWorkspace('sketch');
      setSelection({ kind: 'sketch', id: sketch.id });
      setCommand(null);
    };
    window.__madcadVerifyUpdateConstraint = updateSketchConstraintValue;
    window.__madcadVerifyReopenAutosave = () => {
      const raw = window.localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) throw new Error('Brak autozapisu do ponownego otwarcia.');
      const opened = openDocument(JSON.parse(raw));
      history.replace(opened.document);
      setActiveSketchId(null);
      setSelection({ kind: 'document', id: opened.document.id });
      setCommand(null);
    };
    window.__madcadVerifyLoadPointHoleFixture = () => {
      const fixture = createDocument('Otwór z punktu');
      const baseProfile = createRectangleProfile({ width: 40, height: 30, x: 0, y: 0 });
      const baseSketch = createSketch({ name: 'Baza punktu', plane: 'XY', profiles: [baseProfile] });
      const referencePoint = createSketchPoint({ x: 7, y: -4 });
      const pointSketch = createSketch({ name: 'Punkt otworu', plane: 'XY', entities: [referencePoint] });
      const extrusion = createFeature('extrude', { name: 'Baza', sketchId: baseSketch.id, profileIds: [baseSketch.profiles[0].id], distance: '10', operation: 'new' });
      const hole = createFeature('hole', { name: 'Otwór z punktu', targetBodyId: `body-${extrusion.id}`, sketchId: pointSketch.id, pointId: referencePoint.id, diameter: '6', depth: '10' });
      fixture.sketches.push(baseSketch, pointSketch);
      fixture.features.push(extrusion, hole);
      history.replace(fixture);
      setActiveSketchId(null);
      setWorkspace('solid');
      setSelection({ kind: 'sketchPoint', id: referencePoint.id, sketchId: pointSketch.id });
      setCommand(null);
    };
    window.__madcadVerifyLoadTimelineFixture = () => {
      const fixture = createStarterDocument();
      fixture.features.push(createFeature('primitive', {
        name: 'Niezależny korpus',
        primitiveType: 'box',
        x: '70', y: '0', z: '0',
        width: '12', depth: '12', height: '12',
      }));
      history.replace(fixture);
      setActiveSketchId(null);
      setWorkspace('solid');
      setSelection({ kind: 'document', id: fixture.id });
      setCommand(null);
    };
    window.__madcadVerifyDocumentState = {
      schemaVersion: document.schemaVersion,
      sketches: document.sketches.map((sketch) => ({
        id: sketch.id,
        plane: sketch.plane,
        planeOffset: sketch.planeOffset,
        support: sketch.support,
        entities: sketch.entities.length,
        entityData: sketch.entities.map((entity) => ({ id: entity.id, type: entity.type, role: entity.role, fixed: entity.fixed, projectionReferenceId: entity.projectionReferenceId, pointIds: entity.pointIds, geometry: entity.geometry })),
        profiles: sketch.profiles.length,
        profileIds: sketch.profiles.map((profile) => profile.id),
        constraints: sketch.constraints.map((constraint) => ({ id: constraint.id, type: constraint.type, value: constraint.value })),
        dimensions: sketch.dimensions.map((dimension) => ({ id: dimension.id, type: dimension.type, entityIds: dimension.entityIds, constraintId: dimension.constraintId, expression: dimension.expression })),
      })),
      features: document.features.length,
      featureIds: document.features.map((feature) => feature.id),
      featureData: document.features.map((feature) => ({ id: feature.id, name: feature.name, type: feature.type, suppressed: feature.suppressed, sketchId: feature.sketchId, sketchIds: feature.sketchIds, profileId: feature.profileId, profileIds: feature.profileIds, pathSketchId: feature.pathSketchId, pathEntityIds: feature.pathEntityIds, loftMode: feature.loftMode, ribMode: feature.ribMode, patternType: feature.patternType, countX: feature.countX, countY: feature.countY, spacingX: feature.spacingX, spacingY: feature.spacingY, occurrences: feature.occurrences, totalAngle: feature.totalAngle, thickness: feature.thickness, reverse: feature.reverse, operation: feature.operation, placement: feature.placement, holeType: feature.holeType, extent: feature.extent, distance: feature.distance, startOffset: feature.startOffset, targetReferenceId: feature.targetReferenceId, thin: feature.thin, wallThickness: feature.wallThickness, outsideDiameter: feature.outsideDiameter, wallSide: feature.wallSide, endCap: feature.endCap, openEntityIds: feature.openEntityIds, depth: feature.depth, diameter: feature.diameter, coilDiameter: feature.coilDiameter, wireDiameter: feature.wireDiameter, pitch: feature.pitch, turns: feature.turns, handedness: feature.handedness, clearanceProfile: feature.clearanceProfile, clearance: feature.clearance, secondDistance: feature.secondDistance, firstOffset: feature.firstOffset, secondOffset: feature.secondOffset, counterboreDiameter: feature.counterboreDiameter, counterboreDepth: feature.counterboreDepth, countersinkDiameter: feature.countersinkDiameter, countersinkAngle: feature.countersinkAngle, threadMode: feature.threadMode, threadDiameter: feature.threadDiameter, threadPitch: feature.threadPitch, threadLength: feature.threadLength, threadDirection: feature.threadDirection, referenceIds: feature.referenceIds, targetBodyId: feature.targetBodyId, toolBodyId: feature.toolBodyId, neutralPlaneId: feature.neutralPlaneId, planeId: feature.planeId, axisId: feature.axisId, mode: feature.mode, x: feature.x, y: feature.y, z: feature.z, angle: feature.angle })),
      references: document.references.map((reference) => ({ id: reference.id, kind: reference.kind, planeType: reference.planeType, axisType: reference.axisType, pointType: reference.pointType, name: reference.name, basePlane: reference.basePlane, offset: reference.offset, firstOffset: reference.firstOffset, secondOffset: reference.secondOffset, rotationAxis: reference.rotationAxis, angle: reference.angle, surfaceType: reference.surfaceType, center: reference.center, point: reference.point, axis: reference.axis, points: reference.points, position: reference.position, origin: reference.origin, direction: reference.direction, distance: reference.distance, planeIds: reference.planeIds, planeId: reference.planeId, axisId: reference.axisId, visible: reference.visible, topologyId: reference.topologyId, topologyKind: reference.topologyKind, bodyId: reference.bodyId, sourceFeatureId: reference.sourceFeatureId, ownerFeatureId: reference.ownerFeatureId, repairedAt: reference.repairedAt })),
      selection: selection?.kind === 'sketchEntities'
        ? { kind: selection.kind, ids: selection.ids }
        : { kind: selection?.kind, id: selection?.id, items: selection?.items?.map((item) => ({ kind: item.kind, id: item.id })) || [] },
      command: command ? {
        type: command.type,
        previewReady: Boolean(command.previewFeature),
        previewThreadMode: command.previewFeature?.threadMode,
        previewThreadDirection: command.previewFeature?.threadDirection,
        previewClearanceProfile: command.previewFeature?.clearanceProfile,
        points: command.points?.length || 0,
        segments: command.segmentIds?.length || 0,
        gesturePoints: command.gesturePoints?.length || 0,
        dynamicLength: command.dynamicLength || '',
        measurement: command.type === 'measure' ? measurement : null,
        sectionAnalysis: command.type === 'sectionAnalysis' ? sectionAnalysis : null,
        massProperties: command.type === 'massProperties' ? massProperties : null,
        geometryInspection: command.type === 'geometryInspection' ? geometryInspection : null,
      } : null,
    };
    return () => {
      delete window.__madcadVerifySketchPoint;
      delete window.__madcadVerifyCanvasSketchPoint;
      delete window.__madcadVerifyFinishCanvasSketchTool;
      delete window.__madcadVerifySketchSelection;
      delete window.__madcadVerifyTopologySelection;
      delete window.__madcadVerifyCreateLostTopologyReference;
      delete window.__madcadVerifyBreakProjectedReference;
      delete window.__madcadVerifyMoveSketch;
      delete window.__madcadVerifyDeleteSketch;
      delete window.__madcadVerifyLoadTopologyFixture;
      delete window.__madcadVerifyLoadMechanicalFixture;
      delete window.__madcadVerifyLoadParametricBracketFixture;
      delete window.__madcadVerifyLoadConstraintFixture;
      delete window.__madcadVerifyLoadDimensionFixture;
      delete window.__madcadVerifyLoadPatternFixture;
      delete window.__madcadVerifyUpdateConstraint;
      delete window.__madcadVerifyReopenAutosave;
      delete window.__madcadVerifyLoadPointHoleFixture;
      delete window.__madcadVerifyLoadTimelineFixture;
      delete window.__madcadVerifyDocumentState;
    };
  // Verification hooks refresh only when the state exposed to the desktop harness changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, command, selection, activeSketchId, engine.bodies, measurement, sectionAnalysis, massProperties, geometryInspection]);

  const confirmProfile = (sourceCommand = command) => {
    if (readOnly) return readOnlyNotice();
    if (!sourceCommand.editId) return confirmMechanicalShape(sourceCommand);
    const profile = sourceCommand.type === 'rectangle'
      ? createRectangleProfile({ name: sourceCommand.name, width: sourceCommand.width, height: sourceCommand.height, x: sourceCommand.x, y: sourceCommand.y })
      : createCircleProfile({ name: sourceCommand.name, diameter: sourceCommand.diameter, x: sourceCommand.x, y: sourceCommand.y });
    if (sourceCommand.editId) profile.id = sourceCommand.editId;
    commit((next) => {
      const sketch = next.sketches.find((item) => item.id === activeSketchId);
      upsertSketchProfile(sketch, profile);
    });
    setSelection({ kind: 'profile', id: profile.id, sketchId: activeSketchId });
    setCommand(null);
    setNotice(`${profile.name} dodany do szkicu.`);
  };

  const confirmMechanicalShape = (sourceCommand = command) => {
    if (readOnly) return readOnlyNotice();
    const coordinate = (x, y) => [Number(x), Number(y)];
    let shape;
    try {
      if (sourceCommand.type === 'rectangle') {
        if (sourceCommand.definition === 'twoPoints') shape = rectangleTwoPoints(coordinate(sourceCommand.x1, sourceCommand.y1), coordinate(sourceCommand.x2, sourceCommand.y2));
        else if (sourceCommand.definition === 'threePoints') shape = rectangleThreePoints(coordinate(sourceCommand.x1, sourceCommand.y1), coordinate(sourceCommand.x2, sourceCommand.y2), coordinate(sourceCommand.x3, sourceCommand.y3));
        else shape = rectangleFromCenter(coordinate(sourceCommand.x, sourceCommand.y), sourceCommand.width, sourceCommand.height, sourceCommand.rotation);
      } else if (sourceCommand.type === 'circle') {
        if (sourceCommand.definition === 'twoPoints') shape = circleTwoPoints(coordinate(sourceCommand.x1, sourceCommand.y1), coordinate(sourceCommand.x2, sourceCommand.y2));
        else if (sourceCommand.definition === 'threePoints') shape = circleThreePoints(coordinate(sourceCommand.x1, sourceCommand.y1), coordinate(sourceCommand.x2, sourceCommand.y2), coordinate(sourceCommand.x3, sourceCommand.y3));
        else shape = circleCenterRadius(coordinate(sourceCommand.x, sourceCommand.y), Number(sourceCommand.diameter) / 2);
      } else if (sourceCommand.type === 'arc') {
        shape = sourceCommand.definition === 'centerStartEnd'
          ? arcCenterStartEnd(coordinate(sourceCommand.x1, sourceCommand.y1), coordinate(sourceCommand.x2, sourceCommand.y2), coordinate(sourceCommand.x3, sourceCommand.y3), sourceCommand.direction)
          : arcThroughThreePoints(coordinate(sourceCommand.x1, sourceCommand.y1), coordinate(sourceCommand.x2, sourceCommand.y2), coordinate(sourceCommand.x3, sourceCommand.y3));
      } else if (sourceCommand.type === 'polygon') {
        shape = sourceCommand.definition === 'edge'
          ? polygonFromEdge(coordinate(sourceCommand.x1, sourceCommand.y1), coordinate(sourceCommand.x2, sourceCommand.y2), sourceCommand.sides)
          : regularPolygon({ center: coordinate(sourceCommand.x, sourceCommand.y), radius: sourceCommand.radius, sides: sourceCommand.sides, rotation: sourceCommand.rotation, circumscribed: sourceCommand.definition === 'circumscribed' });
      } else if (sourceCommand.type === 'ellipse') {
        shape = sourceCommand.definition === 'arc'
          ? ellipticalArcFromCenter(coordinate(sourceCommand.x, sourceCommand.y), sourceCommand.majorRadius, sourceCommand.minorRadius, sourceCommand.startAngle, sourceCommand.endAngle, sourceCommand.rotation, sourceCommand.direction)
          : ellipseFromCenter(coordinate(sourceCommand.x, sourceCommand.y), sourceCommand.majorRadius, sourceCommand.minorRadius, sourceCommand.rotation);
      } else if (sourceCommand.type === 'slot') {
        if (sourceCommand.definition === 'arc') shape = slotArc({ center: coordinate(sourceCommand.x, sourceCommand.y), radius: sourceCommand.radius, width: sourceCommand.width, startAngle: sourceCommand.startAngle, endAngle: sourceCommand.endAngle, direction: sourceCommand.direction });
        else if (sourceCommand.definition === 'threePoints') shape = slotThreePoints(coordinate(sourceCommand.x1, sourceCommand.y1), coordinate(sourceCommand.x2, sourceCommand.y2), coordinate(sourceCommand.x3, sourceCommand.y3));
        else shape = sourceCommand.definition === 'overall' ? slotOverall(coordinate(sourceCommand.x1, sourceCommand.y1), coordinate(sourceCommand.x2, sourceCommand.y2), sourceCommand.width) : slotCenterToCenter(coordinate(sourceCommand.x1, sourceCommand.y1), coordinate(sourceCommand.x2, sourceCommand.y2), sourceCommand.width);
      } else if (sourceCommand.type === 'spline') {
        const points = sourceCommand.pointsText.split(';').map((entry) => entry.split(',').map((value) => Number(value.trim())));
        if (points.some((entry) => entry.length !== 2 || entry.some((value) => !Number.isFinite(value)))) throw new Error('Punkty spline wpisz jako x,y; x,y; …');
        shape = sourceCommand.definition === 'control' ? controlPointSpline(points) : fitPointSpline(points);
      } else if (sourceCommand.type === 'conic') {
        shape = conicThroughControlPoint(coordinate(sourceCommand.x1, sourceCommand.y1), coordinate(sourceCommand.x2, sourceCommand.y2), coordinate(sourceCommand.x3, sourceCommand.y3), sourceCommand.rho, sourceCommand.continuity);
      }
      if (!shape || shape.entities.some((entity) => entity.type === 'point' && (!Number.isFinite(Number(entity.geometry.x)) || !Number.isFinite(Number(entity.geometry.y))))) throw new Error('Współrzędne figury muszą być liczbami.');
    } catch (error) {
      setNotice(`Nie można utworzyć figury: ${error.message}`);
      return;
    }
    const curveIds = shape.curves.map((entity) => entity.id);
    const curveIdSet = new Set(curveIds);
    const shapeName = sourceCommand.name?.trim() || 'Figura szkicu';
    commit((next) => {
      const sketch = next.sketches.find((item) => item.id === activeSketchId);
      sketch.entities.push(...shape.entities);
      const result = refreshDetectedSketchProfiles(sketch, next.parameters);
      const createdProfile = result.profiles.find((profile) => profile.entityIds.length === curveIds.length && profile.entityIds.every((id) => curveIdSet.has(id)));
      if (createdProfile) createdProfile.name = shapeName;
    });
    setSelection({ kind: 'sketchEntities', ids: curveIds, sketchId: activeSketchId });
    setCommand(null);
    setNotice(`${shapeName} utworzono jako dokładną geometrię szkicu.`);
  };

  const confirmSketchPoint = (sourceCommand = command) => {
    const x = Number(sourceCommand.x);
    const y = Number(sourceCommand.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      setNotice('Punkt wymaga prawidłowych współrzędnych X i Y.');
      return;
    }
    const point = createSketchPoint({ x: String(x), y: String(y), role: sourceCommand.role });
    commit((next) => next.sketches.find((item) => item.id === activeSketchId).entities.push(point));
    setSelection({ kind: 'sketchEntities', ids: [point.id], sketchId: activeSketchId });
    setCommand(null);
    setNotice(sourceCommand.role === 'construction' ? 'Dodano punkt konstrukcyjny.' : 'Dodano punkt referencyjny gotowy do utworzenia otworu.');
  };

  const directSketchTypes = ['rectangle', 'circle', 'arc', 'polygon', 'ellipse', 'slot', 'spline', 'conic', 'point'];
  const requiredGesturePoints = (sourceCommand) => {
    if (!sourceCommand) return 0;
    if (sourceCommand.type === 'point') return 1;
    if (sourceCommand.type === 'rectangle') return sourceCommand.definition === 'threePoints' ? 3 : 2;
    if (sourceCommand.type === 'circle') return sourceCommand.definition === 'threePoints' ? 3 : 2;
    if (['arc', 'conic', 'ellipse'].includes(sourceCommand.type)) return 3;
    if (sourceCommand.type === 'polygon') return 2;
    if (sourceCommand.type === 'slot') return sourceCommand.definition === 'arc' ? 4 : 3;
    return Number.POSITIVE_INFINITY;
  };
  const pointText = ([x, y]) => `${Number(x).toFixed(3)},${Number(y).toFixed(3)}`;
  const distanceBetween = (first, second) => Math.hypot(second[0] - first[0], second[1] - first[1]);
  const distanceFromAxis = (point, first, second) => {
    const length = distanceBetween(first, second);
    if (length <= 1e-9) return 0;
    return Math.abs(((second[0] - first[0]) * (first[1] - point[1])) - ((first[0] - point[0]) * (second[1] - first[1]))) / length;
  };
  const gesturePatch = (sourceCommand, points) => {
    const patch = { gesturePoints: points };
    const [first, second, third, fourth] = points;
    if (sourceCommand.type === 'rectangle') {
      if (sourceCommand.definition === 'center') {
        if (first) Object.assign(patch, { x: String(first[0]), y: String(first[1]) });
        if (second) Object.assign(patch, { width: String(Math.abs(second[0] - first[0]) * 2), height: String(Math.abs(second[1] - first[1]) * 2) });
      } else {
        if (first) Object.assign(patch, { x1: String(first[0]), y1: String(first[1]) });
        if (second) Object.assign(patch, { x2: String(second[0]), y2: String(second[1]) });
        if (third) Object.assign(patch, { x3: String(third[0]), y3: String(third[1]) });
      }
    } else if (sourceCommand.type === 'circle') {
      if (sourceCommand.definition === 'centerRadius') {
        if (first) Object.assign(patch, { x: String(first[0]), y: String(first[1]) });
        if (second) patch.diameter = String(distanceBetween(first, second) * 2);
      } else {
        if (first) Object.assign(patch, { x1: String(first[0]), y1: String(first[1]) });
        if (second) Object.assign(patch, { x2: String(second[0]), y2: String(second[1]) });
        if (third) Object.assign(patch, { x3: String(third[0]), y3: String(third[1]) });
      }
    } else if (['arc', 'conic'].includes(sourceCommand.type)) {
      if (first) Object.assign(patch, { x1: String(first[0]), y1: String(first[1]) });
      if (second) Object.assign(patch, { x2: String(second[0]), y2: String(second[1]) });
      if (third) Object.assign(patch, { x3: String(third[0]), y3: String(third[1]) });
    } else if (sourceCommand.type === 'polygon') {
      if (sourceCommand.definition === 'edge') {
        if (first) Object.assign(patch, { x1: String(first[0]), y1: String(first[1]) });
        if (second) Object.assign(patch, { x2: String(second[0]), y2: String(second[1]) });
      } else {
        if (first) Object.assign(patch, { x: String(first[0]), y: String(first[1]) });
        if (second) Object.assign(patch, {
          radius: String(distanceBetween(first, second)),
          rotation: String(Math.atan2(second[1] - first[1], second[0] - first[0]) * 180 / Math.PI),
        });
      }
    } else if (sourceCommand.type === 'ellipse') {
      if (first) Object.assign(patch, { x: String(first[0]), y: String(first[1]) });
      if (second) Object.assign(patch, {
        majorRadius: String(distanceBetween(first, second)),
        rotation: String(Math.atan2(second[1] - first[1], second[0] - first[0]) * 180 / Math.PI),
      });
      if (third) patch.minorRadius = String(distanceFromAxis(third, first, second));
    } else if (sourceCommand.type === 'slot') {
      if (sourceCommand.definition === 'arc') {
        if (first) Object.assign(patch, { x: String(first[0]), y: String(first[1]) });
        if (second) Object.assign(patch, { radius: String(distanceBetween(first, second)), startAngle: String(Math.atan2(second[1] - first[1], second[0] - first[0]) * 180 / Math.PI) });
        if (third) patch.endAngle = String(Math.atan2(third[1] - first[1], third[0] - first[0]) * 180 / Math.PI);
        if (fourth) patch.width = String(Math.abs(distanceBetween(first, fourth) - distanceBetween(first, second)) * 2);
      } else {
        if (first) Object.assign(patch, { x1: String(first[0]), y1: String(first[1]) });
        if (second) Object.assign(patch, { x2: String(second[0]), y2: String(second[1]) });
        if (third) Object.assign(patch, { x3: String(third[0]), y3: String(third[1]), width: String(distanceFromAxis(third, first, second) * 2) });
      }
    } else if (sourceCommand.type === 'spline') {
      patch.pointsText = points.map(pointText).join('; ');
    } else if (sourceCommand.type === 'point' && first) {
      Object.assign(patch, { x: String(first[0]), y: String(first[1]) });
    }
    return patch;
  };

  const handleSketchCanvasPoint = (coordinates) => {
    if (command?.type === 'line' || command?.type === 'polyline') return appendSketchPoint(coordinates);
    if (!directSketchTypes.includes(command?.type)) return;
    const point = coordinates.map((value) => Number(value));
    if (point.some((value) => !Number.isFinite(value))) return;
    const points = [...(command.gesturePoints || []), point];
    const patch = gesturePatch(command, points);
    const nextCommand = { ...command, ...patch };
    const required = requiredGesturePoints(nextCommand);
    if (points.length < required) {
      setCommand(nextCommand);
      setNotice(nextCommand.type === 'spline'
        ? `Dodano punkt ${points.length}. Klikaj dalej; Enter lub prawy przycisk zakończy spline.`
        : `Wskazano ${points.length} z ${required} punktów. Kliknij następny punkt na płótnie.`);
      return;
    }
    if (nextCommand.type === 'point') confirmSketchPoint(nextCommand);
    else if (nextCommand.type === 'rectangle' || nextCommand.type === 'circle') confirmProfile(nextCommand);
    else confirmMechanicalShape(nextCommand);
  };

  const finishCanvasSketchTool = () => {
    if (command?.type === 'line' || command?.type === 'polyline') return finishSketchPath();
    if (!directSketchTypes.includes(command?.type)) return;
    const points = command.gesturePoints || [];
    if (command.type === 'spline') {
      if (points.length < 3) {
        setNotice('Spline wymaga co najmniej trzech punktów. Kliknij kolejne punkty albo naciśnij Escape.');
        return;
      }
      confirmMechanicalShape(command);
      return;
    }
    if (points.length) {
      setNotice(`Figura wymaga ${requiredGesturePoints(command)} punktów. Dokończ wskazywanie albo naciśnij Escape.`);
      return;
    }
    if (command.type === 'point') confirmSketchPoint(command);
    else if (command.type === 'rectangle' || command.type === 'circle') confirmProfile(command);
    else confirmMechanicalShape(command);
  };

  const openExtrude = () => {
    if (readOnly) return readOnlyNotice();
    if (canExtrudeOpenChain) {
      const operation = engine.bodies.length ? 'join' : 'new';
      const targetOptions = createExtrudeTargetOptions();
      const previewFeature = createFeature('extrude', {
        name: `Wyciągnięcie ${document.features.length + 1}`,
        sketchId: activeSketchId,
        profileIds: [],
        openEntityIds: [...selectedSketchEntityIds],
        distance: '10',
        secondDistance: '10',
        startOffset: '0',
        extent: 'one-side',
        thin: true,
        wallThickness: '2',
        wallSide: 'symmetric',
        endCap: 'butt',
        operation,
        targetBodyId: operation === 'new' ? null : targetBodyId,
      });
      setCommand({ type: 'extrude', openChain: true, sourceSketchId: activeSketchId, distance: '10', secondDistance: '10', startOffset: '0', extent: 'one-side', thin: true, wallThickness: '2', wallSide: 'symmetric', endCap: 'butt', operation, targetOptions, targetReferenceId: targetOptions[0]?.id, previewFeature });
      setActiveSketchId(null);
      setWorkspace('solid');
      setNotice('Podgląd cienkościennego wyciągnięcia otwartego łańcucha jest aktywny.');
      return;
    }
    if (!selectedProfile || activeSketchId) {
      setNotice(activeSketchId ? 'Najpierw zakończ szkic.' : 'Wybierz zamknięty profil w przeglądarce.');
      return;
    }
    beginOrUpdateExtrude(10);
    setNotice('Podgląd wyciągnięcia jest aktywny. Potwierdź operację przyciskiem OK.');
  };

  const openRib = () => {
    if (readOnly) return readOnlyNotice();
    if (!canCreateRib) return setNotice(engine.bodies.length ? 'Wybierz ciągły otwarty łańcuch linii szkicu.' : 'Rib/Web wymaga istniejącej bryły docelowej.');
    const next = {
      type: 'rib',
      openChain: true,
      sourceSketchId: activeSketchId,
      openEntityIds: [...selectedSketchEntityIds],
      ribMode: 'web',
      thickness: '2',
      depth: '5',
      wallSide: 'symmetric',
      reverse: false,
      previewFeature: null,
    };
    setCommand(next);
    setActiveSketchId(null);
    setWorkspace('solid');
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Rib/Web tworzy cienkie wzmocnienie połączone z istniejącą bryłą.');
  };

  const openPipe = () => {
    if (readOnly) return readOnlyNotice();
    if (!canExtrudeOpenChain) return setNotice('Pipe wymaga zaznaczonego ciągłego otwartego łańcucha linii szkicu.');
    const next = { type: 'pipe', pathSketchId: activeSketchId, pathEntityIds: [...selectedSketchEntityIds], outsideDiameter: '4', wallThickness: '0.5', operation: 'new', previewFeature: null };
    setCommand(next);
    setActiveSketchId(null);
    setWorkspace('solid');
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Pipe prowadzi pusty przekrój rurowy po wskazanej ścieżce.');
  };

  const openRevolve = () => {
    if (readOnly) return readOnlyNotice();
    if (!selectedProfile || activeSketchId) {
      setNotice(activeSketchId ? 'Najpierw zakończ szkic.' : 'Wybierz jeden zamknięty profil dla Revolve.');
      return;
    }
    const axisOptions = [
      { id: 'X_AXIS', name: 'Oś bazowa X' },
      { id: 'Y_AXIS', name: 'Oś bazowa Y' },
      { id: 'Z_AXIS', name: 'Oś bazowa Z' },
      ...constructionAxes.filter((axis) => axis.status === 'ok').map((axis) => ({ id: axis.id, name: axis.name })),
    ];
    const defaultAxisId = selectedProfileMatch.sketch.plane === 'XZ' ? 'X_AXIS' : 'Y_AXIS';
    const operation = engine.bodies.length ? 'join' : 'new';
    const next = { type: 'revolve', axisId: defaultAxisId, axisOptions, angle: '360', operation, previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Revolve obraca wybrany profil wokół osi leżącej w płaszczyźnie szkicu.');
  };

  const sweepPathOptions = (profileSketchId = selectedProfileMatch?.sketch.id) => document.sketches
    .filter((sketch) => sketch.id !== profileSketchId)
    .map((sketch) => ({ id: sketch.id, name: sketch.name, entityIds: sketch.entities.filter((entity) => entity.type === 'line' && entity.role !== 'construction').map((entity) => entity.id) }))
    .filter((path) => path.entityIds.length);

  const openSweep = () => {
    if (readOnly) return readOnlyNotice();
    if (!selectedProfile || activeSketchId) return setNotice(activeSketchId ? 'Najpierw zakończ szkic.' : 'Wybierz zamknięty profil Sweep.');
    const pathOptions = sweepPathOptions();
    if (!pathOptions.length) return setNotice('Sweep wymaga osobnego szkicu z ciągłą otwartą ścieżką linii.');
    const operation = engine.bodies.length ? 'join' : 'new';
    const next = { type: 'sweep', pathOptions, pathSketchId: pathOptions[0].id, pathEntityIds: pathOptions[0].entityIds, operation, previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Sweep prowadzi profil po wskazanej ciągłej ścieżce szkicu.');
  };

  const loftProfileOptions = (sourceSketchId = selectedProfileMatch?.sketch.id) => document.sketches
    .filter((sketch) => sketch.id !== sourceSketchId)
    .flatMap((sketch) => sketch.profiles.map((profile) => ({ id: profile.id, sketchId: sketch.id, name: `${sketch.name} · ${profile.name}` })));

  const openLoft = () => {
    if (readOnly) return readOnlyNotice();
    if (!selectedProfile || activeSketchId) return setNotice(activeSketchId ? 'Najpierw zakończ szkic.' : 'Wybierz zamknięty profil początkowy Loft.');
    const profileOptions = loftProfileOptions();
    if (!profileOptions.length) return setNotice('Loft wymaga drugiego zamkniętego profilu w osobnym szkicu.');
    const target = profileOptions[0];
    const operation = engine.bodies.length ? 'join' : 'new';
    const next = { type: 'loft', profileOptions, endProfileId: target.id, endSketchId: target.sketchId, loftMode: 'smooth', operation, previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Loft łączy profile z osobnych, równoległych płaszczyzn szkicu.');
  };

  const openCoil = () => {
    if (readOnly) return readOnlyNotice();
    if (activeSketchId) return setNotice('Najpierw zakończ szkic.');
    const axisOptions = [
      { id: 'X_AXIS', name: 'Oś bazowa X' },
      { id: 'Y_AXIS', name: 'Oś bazowa Y' },
      { id: 'Z_AXIS', name: 'Oś bazowa Z' },
      ...constructionAxes.filter((axis) => axis.status === 'ok').map((axis) => ({ id: axis.id, name: axis.name })),
    ];
    const operation = engine.bodies.length ? 'join' : 'new';
    const next = { type: 'coil', axisId: 'Z_AXIS', axisOptions, coilDiameter: '10', wireDiameter: '2', pitch: '4', turns: '3', handedness: 'right', operation, previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Coil tworzy parametryczną spiralę bryłową wokół wskazanej osi.');
  };

  const openPattern = () => {
    if (readOnly) return readOnlyNotice();
    if (!targetBodyId || activeSketchId) return setNotice(activeSketchId ? 'Najpierw zakończ szkic.' : 'Pattern wymaga wskazanej bryły.');
    const axisOptions = [{ id: 'X_AXIS', name: 'Oś bazowa X' }, { id: 'Y_AXIS', name: 'Oś bazowa Y' }, { id: 'Z_AXIS', name: 'Oś bazowa Z' }, ...constructionAxes.filter((axis) => axis.status === 'ok').map((axis) => ({ id: axis.id, name: axis.name }))];
    const pathOptions = document.sketches.map((sketch) => ({ id: sketch.id, name: sketch.name, entityIds: sketch.entities.filter((entity) => entity.type === 'line' && entity.role !== 'construction').map((entity) => entity.id) })).filter((path) => path.entityIds.length);
    const next = { type: 'pattern', targetBodyId, patternType: 'rectangular', countX: '3', countY: '1', spacingX: '20', spacingY: '20', axisId: 'Z_AXIS', axisOptions, occurrences: '4', totalAngle: '360', pathOptions, pathSketchId: pathOptions[0]?.id, pathEntityIds: pathOptions[0]?.entityIds || [], previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Pattern powiela wskazaną bryłę prostokątnie, kołowo albo po ścieżce.');
  };

  const createExtrudeTargetOptions = (editingFeatureId = null) => {
    const options = constructionPlanes.filter((plane) => plane.status === 'ok').map((plane) => ({ id: plane.id, name: plane.name, kind: 'construction-plane' }));
    const existingFeature = document.features.find((feature) => feature.id === editingFeatureId);
    const existingReference = document.references.find((reference) => reference.id === existingFeature?.targetReferenceId && reference.kind === 'topology');
    if (existingReference) options.push({ id: existingReference.id, name: existingReference.label || 'Planarna ściana', kind: 'topology', reference: existingReference });
    if (editingFeatureId) return options;
    engine.bodies.forEach((body) => {
      body.topology?.faces?.filter((face) => face.descriptor?.geometry === 'PLANE').forEach((face, index) => {
        const normal = face.descriptor.normal || [0, 0, 1];
        const axis = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
        const axisName = ['X', 'Y', 'Z'][axis];
        const coordinate = Number(face.descriptor.center?.[axis] || 0).toFixed(3);
        const reference = createTopologyReference({
          selection: { kind: 'face', id: face.id, bodyId: body.id, sourceFeatureId: body.sourceFeatureId },
          descriptor: face.descriptor,
          label: `Ściana planarna ${index + 1} · ${axisName}=${coordinate} · ${body.name}`,
        });
        options.push({ id: reference.id, name: reference.label, kind: 'topology', reference });
      });
    });
    return options;
  };

  const beginOrUpdateExtrude = (distance) => {
    if (readOnly) return readOnlyNotice();
    if (!selectedProfile || activeSketchId) return;
    setCommand((current) => {
      const editing = current?.type === 'extrude' ? current : null;
      const operation = editing?.operation || (engine.bodies.length ? 'join' : 'new');
      const targetOptions = editing?.targetOptions || createExtrudeTargetOptions(editing?.editId);
      const next = {
        ...(editing || {}),
        type: 'extrude',
        distance: String(distance),
        secondDistance: editing?.secondDistance || '10',
        startOffset: editing?.startOffset || '0',
        thin: Boolean(editing?.thin),
        wallThickness: editing?.wallThickness || '2',
        wallSide: editing?.wallSide || 'inside',
        endCap: editing?.endCap || 'butt',
        extent: editing?.extent || 'one-side',
        operation,
        targetOptions,
        targetReferenceId: editing?.targetReferenceId || targetOptions[0]?.id,
      };
      next.previewFeature = createFeature('extrude', {
        name: editing?.previewFeature?.name || `Wyciągnięcie ${document.features.length + 1}`,
        sketchId: selectedProfileMatch?.sketch.id,
        profileIds: [selectedProfile.id],
        distance: next.distance,
        secondDistance: next.secondDistance,
        startOffset: next.startOffset,
        extent: next.extent,
        targetReferenceId: next.extent === 'to-object' ? next.targetReferenceId : undefined,
        thin: Boolean(next.thin),
        wallThickness: next.wallThickness,
        wallSide: next.wallSide,
        endCap: next.endCap,
        operation,
        targetBodyId: operation === 'new' ? null : targetBodyId,
      });
      if (editing?.previewFeature?.id) next.previewFeature.id = editing.previewFeature.id;
      if (editing?.editId) next.editId = editing.editId;
      const targetOption = targetOptions.find((option) => option.id === next.targetReferenceId);
      next.topologyReferences = next.extent === 'to-object' && targetOption?.reference ? [targetOption.reference] : [];
      return next;
    });
    setNotice(`Wyciągnięcie ustawione przeciągnięciem: ${Number(distance).toFixed(1)} mm. Kliknij OK, aby zapisać operację.`);
  };

  const openHole = () => {
    if (readOnly) return readOnlyNotice();
    if (hasFaceEdgeHoleReference && !activeSketchId) {
      const bodyId = selectedFaceItems[0].bodyId;
      const body = engine.bodies.find((candidate) => candidate.id === bodyId);
      const faceRecord = body?.topology?.faces?.find((record) => record.id === selectedFaceItems[0].id);
      const edgeRecords = selectedEdgeItems.map((item) => body?.topology?.edges?.find((record) => record.id === item.id));
      try {
        resolveFaceEdgeHolePlacement(faceRecord?.descriptor, edgeRecords[0]?.descriptor, edgeRecords[1]?.descriptor, 10, 10);
        const topologyReferences = [
          createTopologyReference({ selection: selectedFaceItems[0], descriptor: faceRecord.descriptor, label: 'Otwór — ściana' }),
          createTopologyReference({ selection: selectedEdgeItems[0], descriptor: edgeRecords[0].descriptor, label: 'Otwór — krawędź 1' }),
          createTopologyReference({ selection: selectedEdgeItems[1], descriptor: edgeRecords[1].descriptor, label: 'Otwór — krawędź 2' }),
        ].map((reference) => ({ ...reference, scope: 'feature-input' }));
        const next = { type: 'hole', placement: 'face-edges', targetBodyId: bodyId, firstOffset: '10', secondOffset: '10', holeType: 'simple', extent: 'distance', diameter: '5', depth: '10', counterboreDiameter: '9', counterboreDepth: '3', countersinkDiameter: '10', countersinkAngle: '90', threadMode: 'none', threadDiameter: '6', threadPitch: '1', threadLength: '8', threadDirection: 'right', clearanceProfile: 'nominal', clearance: '0.2', topologyReferences, previewFeature: null };
        setCommand(next);
        window.setTimeout(() => updateCommand(next), 0);
        setNotice('Otwór jest pozycjonowany parametrycznie od dwóch wskazanych krawędzi.');
      } catch (error) {
        setNotice(`Nie można pozycjonować otworu: ${error.message}`);
      }
      return;
    }
    if (!hasHoleReference || !targetBodyId || activeSketchId) {
      setNotice('Zakończ szkic i wybierz punkt/profil albo planarną ścianę z dwiema prostopadłymi krawędziami.');
      return;
    }
    const next = { type: 'hole', holeType: 'simple', extent: 'distance', diameter: selectedCircleDiameter, depth: '10', counterboreDiameter: '10', counterboreDepth: '3', countersinkDiameter: '10', countersinkAngle: '90', threadMode: 'none', threadDiameter: '10', threadPitch: '1.5', threadLength: '8', threadDirection: 'right', clearanceProfile: 'nominal', clearance: '0.2', previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
  };

  const openMeasure = () => {
    setCommand({ type: 'measure' });
    setNotice('Measure jest aktywny. Zaznacz element; Ctrl/Shift dodaje drugi do pomiaru odległości i kąta.');
  };

  const openSectionAnalysis = () => {
    const bounds = engine.bodies[0]?.metrics?.bounds;
    const offset = bounds ? (bounds[0][2] + bounds[1][2]) / 2 : 0;
    setSectionAnalysis({ enabled: true, plane: 'XY', offset: String(offset), flip: false });
    setCommand({ type: 'sectionAnalysis' });
    setNotice('Section Analysis jest aktywne. Wybierz płaszczyznę, położenie i stronę przekroju.');
  };

  const closeSectionAnalysis = () => {
    setSectionAnalysis(null);
    setCommand(null);
    setNotice('Section Analysis wyłączone; model nie został zmieniony.');
  };

  const openMassProperties = () => {
    setCommand({ type: 'massProperties', density: '1.24' });
    setNotice('Właściwości masowe liczą zaznaczone bryły albo cały model, gdy nic nie jest wskazane.');
  };

  const openGeometryInspection = async () => {
    setNotice('Analiza geometrii: szybki filtr granic i dokładne sprawdzanie możliwych kolizji…');
    try {
      const analysis = await engine.analyzeCollisions();
      setCommand({ type: 'geometryInspection' });
      setNotice(analysis.skippedPairs
        ? `Analiza częściowa · sprawdzono ${analysis.exactPairs}/${analysis.candidatePairs} par; pominięto ${analysis.skippedPairs} par mieszanych lub otwartych siatek.`
        : `Analiza zakończona · ${analysis.exactPairs}/${analysis.candidatePairs} par wymagało dokładnego przecięcia.`);
    } catch (error) {
      setNotice(`Nie udało się przeprowadzić analizy kolizji: ${error.message}`);
    }
  };

  const openBoolean = () => {
    if (readOnly) return readOnlyNotice();
    if (selectedBodyIds.length !== 2) {
      setNotice('Wybierz dokładnie dwie bryły, używając Ctrl lub Shift. Ostatnia wskazana będzie narzędziem.');
      return;
    }
    if (!canBooleanSelectedBodies) {
      setNotice('Boolean wymaga dwóch zgodnych brył B-Rep albo dwóch zamkniętych siatek. Otwarta lub mieszana geometria nie może zostać połączona bryłowo.');
      return;
    }
    const [targetBodyId, toolBodyId] = selectedBodyIds;
    const bodyName = (bodyId) => engine.bodies.find((body) => body.id === bodyId)?.name || bodyId;
    const previewFeature = createFeature('boolean', { name: `Boolean ${document.features.length + 1}`, targetBodyId, toolBodyId, operation: 'union' });
    setCommand({ type: 'boolean', operation: 'union', targetBodyId, toolBodyId, targetName: bodyName(targetBodyId), toolName: bodyName(toolBodyId), previewFeature });
    setNotice('Wybierz Union, Subtract albo Intersect i zatwierdź operację Boolean.');
  };

  const openPrimitive = () => {
    if (readOnly) return readOnlyNotice();
    const sequence = document.features.filter((feature) => feature.type === 'primitive').length + 1;
    const next = { type: 'primitive', name: `Box ${sequence}`, primitiveType: 'box', x: '0', y: '0', z: '0', width: '20', depth: '20', height: '20', radius: '10', majorRadius: '15', minorRadius: '4', previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
  };

  const openTextSolid = () => {
    if (readOnly) return readOnlyNotice();
    const selectedFace = selectedFaceItems.length === 1 ? selectedFaceItems[0] : null;
    const selectedBody = selectedFace ? engine.bodies.find((body) => body.id === selectedFace.bodyId) : null;
    const faceRecord = selectedBody?.topology?.faces?.find((face) => face.id === selectedFace?.id);
    const planarFace = faceRecord?.descriptor?.geometry === 'PLANE' ? faceRecord : null;
    const selectedTargetId = planarFace ? selectedFace.bodyId : selection?.kind === 'body' ? selection.id : null;
    const selectedTarget = engine.bodies.find((body) => body.id === selectedTargetId);
    const surfaceZ = selectedTarget?.metrics?.bounds?.[1]?.[2] ?? 0;
    const topologyReferences = planarFace ? [createTopologyReference({ selection: { kind: 'face', id: planarFace.id, bodyId: selectedBody.id, sourceFeatureId: selectedBody.sourceFeatureId }, descriptor: planarFace.descriptor, label: `Powierzchnia Emboss/Deboss · ${selectedBody.name}` })] : [];
    const next = { type: 'textSolid', text: 'MADCAD', fontSize: '10', depth: '2', x: '0', y: '0', z: String(surfaceZ), operation: selectedTargetId ? 'emboss' : 'new', targetBodyId: selectedTargetId, placement: planarFace ? 'face' : 'world', topologyReferences, previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice(planarFace ? 'Tekst jest trwale związany ze wskazaną planarną ścianą.' : selectedTargetId ? 'Tekst zostanie dodany do zaznaczonej bryły. Wybierz Emboss lub Deboss.' : 'Tekst zostanie wyciągnięty jako nowa bryła.');
  };

  const openTransform = (mode) => {
    if (readOnly) return readOnlyNotice();
    if (selection?.kind !== 'body' || !targetBodyId) {
      setNotice('Wybierz jedną bryłę do przesunięcia lub obrotu.');
      return;
    }
    const next = { type: 'transform', mode, targetBodyId, x: '0', y: '0', z: '0', angle: '0', originX: '0', originY: '0', originZ: '0', previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
  };

  const openOffsetFace = () => {
    if (readOnly) return readOnlyNotice();
    const selectedFace = selectedFaceItems.length === 1 ? selectedFaceItems[0] : null;
    const body = selectedFace && engine.bodies.find((candidate) => candidate.id === selectedFace.bodyId);
    const record = body?.topology?.faces?.find((face) => face.id === selectedFace.id);
    if (!selectedFace || record?.descriptor?.geometry !== 'PLANE') {
      setNotice('Wybierz dokładnie jedną planarną ścianę dla Offset Face.');
      return;
    }
    const reference = { ...createTopologyReference({ selection: selectedFace, descriptor: record.descriptor, label: 'Offset Face — ściana' }), scope: 'feature-input' };
    const next = { type: 'offsetFace', targetBodyId: selectedFace.bodyId, distance: '1', faceLabel: record.id, topologyReferences: [reference], previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
  };

  const openPressPull = () => {
    if (readOnly) return readOnlyNotice();
    if (selectedProfile && !activeSketchId) {
      openExtrude();
      setNotice('Press Pull profilu używa parametrycznego Extrude. Ustaw odległość i operację bryłową.');
      return;
    }
    if (pressPullFace?.descriptor?.geometry === 'PLANE') {
      openOffsetFace();
      setNotice('Press Pull planarnej ściany używa parametrycznego Offset Face. Znak odległości steruje kierunkiem.');
      return;
    }
    setNotice('Press Pull wymaga zamkniętego profilu albo dokładnie jednej planarnej ściany.');
  };

  const openEdgeCommand = (type) => {
    if (readOnly) return readOnlyNotice();
    if (!targetBodyId || activeSketchId) {
      setNotice('Wybierz bryłę docelową.');
      return;
    }
    const selectedEdges = selectedEdgeItems.filter((item) => item.bodyId === targetBodyId);
    if (!selectedEdges.length) {
      setNotice(`Wybierz co najmniej jedną krawędź bryły dla ${type === 'fillet' ? 'Fillet' : 'Chamfer'}.`);
      return;
    }
    const topologyReferences = selectedEdges.map((item, index) => {
      const body = engine.bodies.find((candidate) => candidate.id === item.bodyId);
      const descriptor = body?.topology?.edges?.find((edge) => edge.id === item.id)?.descriptor || null;
      return { ...createTopologyReference({ selection: item, descriptor, label: `${type === 'fillet' ? 'Zaokrąglenie' : 'Fazowanie'} — krawędź ${index + 1}` }), scope: 'feature-input' };
    });
    setCommand({ type, size: '1', previewFeature: null, topologyReferences });
    window.setTimeout(() => updateCommand({ size: '1' }), 0);
  };

  const openShell = () => {
    if (readOnly) return readOnlyNotice();
    if (!targetBodyId || activeSketchId) {
      setNotice('Wybierz ściany bryły, które mają zostać usunięte przez Shell.');
      return;
    }
    const selectedFaces = selectedFaceItems.filter((item) => item.bodyId === targetBodyId);
    if (!selectedFaces.length) {
      setNotice('Wybierz co najmniej jedną ścianę bryły do usunięcia.');
      return;
    }
    const topologyReferences = selectedFaces.map((item, index) => {
      const body = engine.bodies.find((candidate) => candidate.id === item.bodyId);
      const descriptor = body?.topology?.faces?.find((face) => face.id === item.id)?.descriptor || null;
      return { ...createTopologyReference({ selection: item, descriptor, label: `Shell — usuwana ściana ${index + 1}` }), scope: 'feature-input' };
    });
    setCommand({ type: 'shell', thickness: '1', faceCount: selectedFaces.length, previewFeature: null, topologyReferences });
    window.setTimeout(() => updateCommand({ thickness: '1' }), 0);
  };

  const draftNeutralPlaneOptions = () => [
    ...Object.entries(PLANE_LABELS).map(([id, name]) => ({ id, name })),
    ...constructionPlanes.filter((plane) => plane.status === 'ok').map((plane) => ({ id: plane.id, name: plane.name })),
  ];

  const openDraft = () => {
    if (readOnly) return readOnlyNotice();
    const selectedFaces = selectedFaceItems.filter((item) => item.bodyId === selectedFaceItems[0]?.bodyId);
    const body = engine.bodies.find((candidate) => candidate.id === selectedFaces[0]?.bodyId);
    const faceRecords = selectedFaces.map((item) => body?.topology?.faces?.find((face) => face.id === item.id));
    if (!selectedFaces.length || selectedFaces.length !== selectedFaceItems.length || faceRecords.some((face) => face?.descriptor?.geometry !== 'PLANE')) {
      setNotice('Draft wymaga planarnych ścian należących do jednej bryły.');
      return;
    }
    const topologyReferences = selectedFaces.map((item, index) => ({
      ...createTopologyReference({ selection: item, descriptor: faceRecords[index].descriptor, label: `Draft — ściana ${index + 1}` }),
      scope: 'feature-input',
    }));
    const neutralPlaneOptions = draftNeutralPlaneOptions();
    const next = { type: 'draft', targetBodyId: body.id, angle: '3', neutralPlaneId: 'XY', neutralPlaneOptions, faceCount: selectedFaces.length, topologyReferences, previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Ustaw kąt pochylenia i płaszczyznę neutralną Draft. Znak kąta odwraca kierunek.');
  };

  const openSplitBody = () => {
    if (readOnly) return readOnlyNotice();
    if (selection?.kind !== 'body' || !engine.bodies.some((body) => body.id === selection.id)) {
      setNotice('Wybierz dokładnie jedną bryłę do podziału.');
      return;
    }
    const planeOptions = draftNeutralPlaneOptions();
    const next = { type: 'splitBody', targetBodyId: selection.id, targetName: engine.bodies.find((body) => body.id === selection.id)?.name || selection.id, planeId: 'XY', planeOptions, previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Wybierz płaszczyznę przecinającą bryłę. Split Body zachowa obie wynikowe bryły.');
  };

  const openSplitFace = () => {
    if (readOnly) return readOnlyNotice();
    if (!canSplitFace) {
      setNotice('Split Face wymaga zamkniętego profilu szkicu założonego bezpośrednio na planarnej ścianie.');
      return;
    }
    const next = {
      type: 'splitFace',
      targetBodyId: splitFaceSupport.bodyId,
      sketchId: selectedProfileMatch.sketch.id,
      profileId: selectedProfile.id,
      profileName: selectedProfile.name,
      referenceId: splitFaceSupport.id,
      faceName: splitFaceSupport.label,
      previewFeature: null,
    };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Split Face utworzy trwały region B-Rep bez zmiany objętości bryły.');
  };

  const openDeleteFace = () => {
    if (readOnly) return readOnlyNotice();
    const selectedFaces = selectedFaceItems.filter((item) => item.bodyId === selectedFaceItems[0]?.bodyId);
    const body = engine.bodies.find((candidate) => candidate.id === selectedFaces[0]?.bodyId);
    if (!body || !selectedFaces.length || selectedFaces.length !== selectedFaceItems.length) {
      setNotice('Delete Face + Heal wymaga co najmniej jednej ściany należącej do tej samej bryły.');
      return;
    }
    const topologyReferences = selectedFaces.map((item, index) => {
      const descriptor = body.topology.faces.find((face) => face.id === item.id)?.descriptor;
      return { ...createTopologyReference({ selection: item, descriptor, label: `Delete Face + Heal — region ${index + 1}` }), scope: 'feature-input' };
    });
    const next = { type: 'deleteFace', targetBodyId: body.id, faceCount: selectedFaces.length, topologyReferences, previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Delete Face + Heal scali wskazane regiony ze zgodnymi sąsiednimi ścianami bez zmiany objętości.');
  };

  const openReplaceFace = () => {
    if (readOnly) return readOnlyNotice();
    if (selectedFaceItems.length !== 2 || selectedFaceItems[0].bodyId === selectedFaceItems[1].bodyId) {
      setNotice('Replace Face wymaga dwóch planarnych ścian z różnych brył: najpierw zastępowanej, potem docelowej.');
      return;
    }
    const [sourceSelection, destinationSelection] = selectedFaceItems;
    const sourceBody = engine.bodies.find((body) => body.id === sourceSelection.bodyId);
    const destinationBody = engine.bodies.find((body) => body.id === destinationSelection.bodyId);
    const sourceFace = sourceBody?.topology.faces.find((face) => face.id === sourceSelection.id);
    const destinationFace = destinationBody?.topology.faces.find((face) => face.id === destinationSelection.id);
    if (sourceFace?.descriptor?.geometry !== 'PLANE' || destinationFace?.descriptor?.geometry !== 'PLANE') {
      setNotice('Replace Face obsługuje obecnie dwie planarne powierzchnie.');
      return;
    }
    const topologyReferences = [
      { ...createTopologyReference({ selection: sourceSelection, descriptor: sourceFace.descriptor, label: 'Replace Face — ściana zastępowana' }), scope: 'feature-input' },
      { ...createTopologyReference({ selection: destinationSelection, descriptor: destinationFace.descriptor, label: 'Replace Face — powierzchnia docelowa' }), scope: 'feature-input' },
    ];
    const next = { type: 'replaceFace', targetBodyId: sourceBody.id, sourceName: sourceBody.name, destinationName: destinationBody.name, topologyReferences, previewFeature: null };
    setCommand(next);
    window.setTimeout(() => updateCommand(next), 0);
    setNotice('Replace Face dopasuje pierwszą planarną ścianę do płaszczyzny drugiej, bez modyfikowania bryły referencyjnej.');
  };

  const openConstructionPlane = (planeType = 'offset', plane = null) => {
    if (readOnly) return readOnlyNotice();
    const existing = plane;
    const mode = existing?.planeType || planeType;
    const commandTypes = { offset: 'offsetPlane', midplane: 'midplanePlane', 'three-points': 'threePointPlane', angle: 'anglePlane', tangent: 'tangentPlane', path: 'pathPlane' };
    const commandType = commandTypes[mode] || 'offsetPlane';
    const defaultNames = { offset: 'Płaszczyzna odsunięta', midplane: 'Płaszczyzna środkowa', 'three-points': 'Płaszczyzna przez trzy punkty', angle: 'Płaszczyzna pod kątem', tangent: 'Płaszczyzna styczna', path: 'Płaszczyzna na ścieżce' };
    const points = existing?.points || [['0', '0', '0'], ['10', '0', '0'], ['0', '10', '0']];
    setCommand({
      type: commandType,
      planeType: mode,
      editId: existing?.id || null,
      name: existing?.name || `${defaultNames[mode]} ${document.references.filter((reference) => reference.kind === 'construction-plane').length + 1}`,
      basePlane: existing?.basePlane || (selection?.kind === 'plane' && PLANE_LABELS[selection.id] ? selection.id : 'XY'),
      offset: existing?.offset || (mode === 'angle' ? '0' : '10'),
      firstOffset: existing?.firstOffset || '0',
      secondOffset: existing?.secondOffset || '10',
      rotationAxis: existing?.rotationAxis || 'u', angle: existing?.angle || '45',
      surfaceType: existing?.surfaceType || 'sphere',
      center0: existing?.center?.[0] || '0', center1: existing?.center?.[1] || '0', center2: existing?.center?.[2] || '0',
      point0: existing?.point?.[0] || '10', point1: existing?.point?.[1] || '0', point2: existing?.point?.[2] || '0',
      axis0: existing?.axis?.[0] || '0', axis1: existing?.axis?.[1] || '0', axis2: existing?.axis?.[2] || '1',
      direction0: existing?.direction?.[0] || '1', direction1: existing?.direction?.[1] || '0', direction2: existing?.direction?.[2] || '0',
      x1: points[0][0], y1: points[0][1], z1: points[0][2],
      x2: points[1][0], y2: points[1][1], z2: points[1][2],
      x3: points[2][0], y3: points[2][1], z3: points[2][2],
      visible: existing?.visible ?? true,
    });
    setNotice(existing ? `Edytujesz ${existing.name}.` : `Ustaw parametry: ${defaultNames[mode].toLowerCase()}.`);
  };

  const confirmConstructionPlane = () => {
    if (readOnly) return readOnlyNotice();
    try {
      const plane = command.planeType === 'midplane'
        ? createMidplane({ name: command.name, basePlane: command.basePlane, firstOffset: command.firstOffset, secondOffset: command.secondOffset, visible: command.visible })
        : command.planeType === 'three-points'
          ? createThreePointPlane({ name: command.name, points: [[command.x1, command.y1, command.z1], [command.x2, command.y2, command.z2], [command.x3, command.y3, command.z3]], visible: command.visible })
          : command.planeType === 'angle'
            ? createAnglePlane({ name: command.name, basePlane: command.basePlane, rotationAxis: command.rotationAxis, angle: command.angle, offset: command.offset, visible: command.visible })
            : command.planeType === 'tangent'
              ? createTangentPlane({ name: command.name, surfaceType: command.surfaceType, center: [command.center0, command.center1, command.center2], point: [command.point0, command.point1, command.point2], axis: [command.axis0, command.axis1, command.axis2], visible: command.visible })
              : command.planeType === 'path'
                ? createPathPlane({ name: command.name, point: [command.point0, command.point1, command.point2], direction: [command.direction0, command.direction1, command.direction2], visible: command.visible })
                : createOffsetPlane({ name: command.name, basePlane: command.basePlane, offset: command.offset, visible: command.visible });
      if (command.editId) plane.id = command.editId;
      resolveConstructionPlane(plane, document.parameters);
      commit((next) => {
        const index = next.references.findIndex((reference) => reference.id === plane.id);
        if (index >= 0) next.references[index] = plane;
        else next.references.push(plane);
      });
      setSelection({ kind: 'constructionPlane', id: plane.id });
      setCommand(null);
      setNotice(`${plane.name} została zapisana jako trwała geometria konstrukcyjna.`);
    } catch (error) {
      setNotice(`Nie udało się utworzyć płaszczyzny: ${error.message}`);
    }
  };

  const openConstructionAxis = (axisType = 'two-points', axis = null) => {
    if (readOnly) return readOnlyNotice();
    const selectedItem = selection?.items?.[0] || selection;
    const body = engine.bodies.find((candidate) => candidate.id === selectedItem?.bodyId);
    const topologyKey = selectedItem?.kind === 'edge' ? 'edges' : selectedItem?.kind === 'face' ? 'faces' : 'vertices';
    const topologyRecord = body?.topology?.[topologyKey]?.find((record) => record.id === selectedItem?.id);
    const points = axis?.points || (axisType === 'edge' ? topologyRecord?.descriptor?.endpoints : null) || [[0, 0, 0], axisType === 'edge' ? [10, 0, 0] : [0, 0, 10]];
    const origin = axis?.origin || topologyRecord?.descriptor?.axisOrigin || topologyRecord?.descriptor?.center || [0, 0, 0];
    const direction = axis?.direction || topologyRecord?.descriptor?.axisDirection || [0, 0, 1];
    const planeOptions = document.references.filter((reference) => reference.kind === 'construction-plane');
    const planeIds = axis?.planeIds || planeOptions.slice(0, 2).map((plane) => plane.id);
    const defaultNames = { edge: 'Oś z krawędzi', cylinder: 'Oś walca', 'two-points': 'Oś przez dwa punkty', 'plane-intersection': 'Oś przecięcia płaszczyzn', 'plane-normal': 'Oś normalna do płaszczyzny' };
    setCommand({
      type: 'constructionAxis', axisType, editId: axis?.id || null,
      name: axis?.name || `${defaultNames[axisType]} ${document.references.filter((reference) => reference.kind === 'construction-axis').length + 1}`,
      x1: String(points[0][0]), y1: String(points[0][1]), z1: String(points[0][2]),
      x2: String(points[1][0]), y2: String(points[1][1]), z2: String(points[1][2]),
      origin0: String(origin[0]), origin1: String(origin[1]), origin2: String(origin[2]),
      direction0: String(direction[0]), direction1: String(direction[1]), direction2: String(direction[2]),
      planeOptions, planeId1: axis?.planeId || planeIds[0] || '', planeId2: planeIds[1] || planeIds[0] || '',
      topologyId: axis?.topologyId || topologyRecord?.id || null, bodyId: axis?.bodyId || body?.id || null,
      visible: axis?.visible ?? true,
    });
    setNotice(axis ? `Edytujesz ${axis.name}.` : `Ustaw parametry: ${defaultNames[axisType].toLowerCase()}.`);
  };

  const confirmConstructionAxis = () => {
    if (readOnly) return readOnlyNotice();
    try {
      const common = { name: command.name, visible: command.visible };
      const points = [[command.x1, command.y1, command.z1], [command.x2, command.y2, command.z2]];
      const axis = command.axisType === 'edge'
        ? createEdgeAxis({ ...common, points, topologyId: command.topologyId, bodyId: command.bodyId })
        : command.axisType === 'cylinder'
          ? createCylinderAxis({ ...common, origin: [command.origin0, command.origin1, command.origin2], direction: [command.direction0, command.direction1, command.direction2], topologyId: command.topologyId, bodyId: command.bodyId })
          : command.axisType === 'plane-intersection'
            ? createPlaneIntersectionAxis({ ...common, planeIds: [command.planeId1, command.planeId2] })
            : command.axisType === 'plane-normal'
              ? createPlaneNormalAxis({ ...common, planeId: command.planeId1, origin: [command.origin0, command.origin1, command.origin2] })
              : createTwoPointAxis({ ...common, points });
      if (command.editId) axis.id = command.editId;
      resolveConstructionAxis(axis, document.references, document.parameters);
      commit((next) => {
        const index = next.references.findIndex((reference) => reference.id === axis.id);
        if (index >= 0) next.references[index] = axis;
        else next.references.push(axis);
      });
      setSelection({ kind: 'constructionAxis', id: axis.id });
      setCommand(null);
      setNotice(`${axis.name} została zapisana jako trwała oś konstrukcyjna.`);
    } catch (error) {
      setNotice(`Nie udało się utworzyć osi: ${error.message}`);
    }
  };

  const openConstructionPoint = (pointType = 'vertex', point = null) => {
    if (readOnly) return readOnlyNotice();
    const selectedItem = selection?.items?.[0] || selection;
    const body = engine.bodies.find((candidate) => candidate.id === selectedItem?.bodyId);
    const topologyKey = selectedItem?.kind === 'vertex' ? 'vertices' : selectedItem?.kind === 'edge' ? 'edges' : 'faces';
    const topologyRecord = body?.topology?.[topologyKey]?.find((record) => record.id === selectedItem?.id);
    const endpoints = topologyRecord?.descriptor?.endpoints;
    const selectedPosition = topologyRecord?.descriptor?.point
      || topologyRecord?.descriptor?.axisOrigin
      || topologyRecord?.descriptor?.center
      || (endpoints?.length === 2 ? endpoints[0].map((value, axis) => (value + endpoints[1][axis]) / 2) : null);
    const position = point?.position || selectedPosition || [0, 0, 0];
    const points = point?.points || [[0, 0, 0], [10, 0, 0]];
    const topologyCompatible = pointType === 'vertex' ? selectedItem?.kind === 'vertex' : pointType === 'center' && ['face', 'edge'].includes(selectedItem?.kind);
    const axisOptions = document.references.filter((reference) => reference.kind === 'construction-axis');
    const planeOptions = document.references.filter((reference) => reference.kind === 'construction-plane');
    const defaultNames = { vertex: 'Punkt na wierzchołku', center: 'Punkt środka', intersection: 'Punkt przecięcia', midpoint: 'Punkt środkowy', 'on-axis': 'Punkt na osi' };
    setCommand({
      type: 'constructionPoint', pointType, editId: point?.id || null,
      name: point?.name || `${defaultNames[pointType]} ${document.references.filter((reference) => reference.kind === 'construction-point').length + 1}`,
      position0: String(position[0]), position1: String(position[1]), position2: String(position[2]),
      x1: String(points[0][0]), y1: String(points[0][1]), z1: String(points[0][2]),
      x2: String(points[1][0]), y2: String(points[1][1]), z2: String(points[1][2]), distance: String(point?.distance ?? 0),
      axisOptions, planeOptions, axisId: point?.axisId || axisOptions[0]?.id || '', planeId: point?.planeId || planeOptions[0]?.id || '',
      topologyId: point?.topologyId || (topologyCompatible ? topologyRecord?.id : null) || null, bodyId: point?.bodyId || (topologyCompatible ? body?.id : null) || null,
      topologyKind: point?.topologyKind || (selectedItem?.kind === 'edge' ? 'edge' : selectedItem?.kind === 'face' ? 'face' : 'vertex'),
      visible: point?.visible ?? true,
    });
    setNotice(point ? `Edytujesz ${point.name}.` : `Ustaw parametry: ${defaultNames[pointType].toLowerCase()}.`);
  };

  const confirmConstructionPoint = () => {
    if (readOnly) return readOnlyNotice();
    try {
      const common = { name: command.name, visible: command.visible };
      const position = [command.position0, command.position1, command.position2];
      const point = command.pointType === 'center'
        ? createCenterPoint({ ...common, position, topologyId: command.topologyId, bodyId: command.bodyId, topologyKind: ['face', 'edge'].includes(command.topologyKind) ? command.topologyKind : 'face' })
        : command.pointType === 'intersection'
          ? createIntersectionPoint({ ...common, axisId: command.axisId, planeId: command.planeId })
          : command.pointType === 'midpoint'
            ? createMidpointPoint({ ...common, points: [[command.x1, command.y1, command.z1], [command.x2, command.y2, command.z2]] })
            : command.pointType === 'on-axis'
              ? createPointOnAxis({ ...common, axisId: command.axisId, distance: command.distance })
              : createVertexPoint({ ...common, position, topologyId: command.topologyId, bodyId: command.bodyId });
      if (command.editId) point.id = command.editId;
      resolveConstructionPoint(point, document.references, document.parameters, engine.bodies);
      commit((next) => {
        const index = next.references.findIndex((reference) => reference.id === point.id);
        if (index >= 0) next.references[index] = point;
        else next.references.push(point);
      });
      setSelection({ kind: 'constructionPoint', id: point.id });
      setCommand(null);
      setNotice(`${point.name} został zapisany jako trwały punkt konstrukcyjny.`);
    } catch (error) {
      setNotice(`Nie udało się utworzyć punktu: ${error.message}`);
    }
  };

  const confirmFeature = () => {
    if (readOnly) return readOnlyNotice();
    if (!command?.previewFeature) {
      setNotice('Podgląd operacji jest jeszcze obliczany. Poczekaj chwilę i spróbuj ponownie.');
      return;
    }
    commit((next) => {
      if (command.editId) {
        const index = next.features.findIndex((feature) => feature.id === command.editId);
        next.features[index] = command.previewFeature;
      } else {
        next.features.push(command.previewFeature);
      }
      for (const reference of command.topologyReferences || []) {
        if (next.references.some((item) => item.id === reference.id)) continue;
        next.references.push({ ...reference, ownerFeatureId: command.previewFeature.id });
      }
    });
    setSelection({ kind: 'feature', id: command.previewFeature.id });
    setWorkspace('solid');
    setCommand(null);
    setNotice('Operacja została dodana do parametrycznej osi czasu.');
  };

  const editSelection = () => {
    if (readOnly) return readOnlyNotice();
    if (selection?.kind === 'sketch') return editSketch(selection.id);
    if (selection?.kind === 'profile') return openProfileCommand(selectedProfile.type, selectedProfile);
    if (selection?.kind === 'constructionPlane') {
      const plane = document.references.find((reference) => reference.id === selection.id && reference.kind === 'construction-plane');
      return plane ? openConstructionPlane(plane.planeType, plane) : undefined;
    }
    if (selection?.kind === 'constructionAxis') {
      const axis = document.references.find((reference) => reference.id === selection.id && reference.kind === 'construction-axis');
      return axis ? openConstructionAxis(axis.axisType, axis) : undefined;
    }
    if (selection?.kind === 'constructionPoint') {
      const point = document.references.find((reference) => reference.id === selection.id && reference.kind === 'construction-point');
      return point ? openConstructionPoint(point.pointType, point) : undefined;
    }
    if (selection?.kind !== 'feature') return;
    const feature = document.features.find((item) => item.id === selection.id);
    if (!feature) return;
    const profile = document.sketches.flatMap((sketch) => sketch.profiles).find((item) => feature.profileIds?.includes(item.id) || feature.profileId === item.id);
    if (profile) setSelection({ kind: 'profile', id: profile.id });
    if (feature.type === 'extrude') {
      const targetOptions = createExtrudeTargetOptions(feature.id);
      setCommand({ type: 'extrude', openChain: Boolean(feature.openEntityIds?.length), editId: feature.id, distance: feature.distance, secondDistance: feature.secondDistance || feature.distance, startOffset: feature.startOffset || '0', thin: Boolean(feature.thin), wallThickness: feature.wallThickness || '2', wallSide: feature.wallSide || 'inside', endCap: feature.endCap || 'butt', extent: feature.extent || 'one-side', operation: feature.operation, targetOptions, targetReferenceId: feature.targetReferenceId || targetOptions[0]?.id, previewFeature: feature });
    }
    else if (feature.type === 'revolve') setCommand({ type: 'revolve', editId: feature.id, axisId: feature.axisId, axisOptions: [{ id: 'X_AXIS', name: 'Oś bazowa X' }, { id: 'Y_AXIS', name: 'Oś bazowa Y' }, { id: 'Z_AXIS', name: 'Oś bazowa Z' }, ...constructionAxes.filter((axis) => axis.status === 'ok').map((axis) => ({ id: axis.id, name: axis.name }))], angle: feature.angle, operation: feature.operation, previewFeature: feature });
    else if (feature.type === 'sweep') setCommand({ type: 'sweep', editId: feature.id, pathOptions: sweepPathOptions(feature.sketchId), pathSketchId: feature.pathSketchId, pathEntityIds: feature.pathEntityIds, operation: feature.operation, previewFeature: feature });
    else if (feature.type === 'loft') setCommand({ type: 'loft', editId: feature.id, profileOptions: loftProfileOptions(feature.sketchIds[0]), endProfileId: feature.profileIds[1], endSketchId: feature.sketchIds[1], loftMode: feature.loftMode || 'smooth', operation: feature.operation, previewFeature: feature });
    else if (feature.type === 'rib') setCommand({ type: 'rib', openChain: true, editId: feature.id, openEntityIds: feature.openEntityIds, ribMode: feature.ribMode || 'web', thickness: feature.thickness, depth: feature.depth, wallSide: feature.wallSide || 'symmetric', reverse: Boolean(feature.reverse), previewFeature: feature });
    else if (feature.type === 'coil') setCommand({ type: 'coil', editId: feature.id, axisId: feature.axisId, axisOptions: [{ id: 'X_AXIS', name: 'Oś bazowa X' }, { id: 'Y_AXIS', name: 'Oś bazowa Y' }, { id: 'Z_AXIS', name: 'Oś bazowa Z' }, ...constructionAxes.filter((axis) => axis.status === 'ok').map((axis) => ({ id: axis.id, name: axis.name }))], coilDiameter: feature.coilDiameter, wireDiameter: feature.wireDiameter, pitch: feature.pitch, turns: feature.turns, handedness: feature.handedness || 'right', operation: feature.operation, previewFeature: feature });
    else if (feature.type === 'pipe') setCommand({ type: 'pipe', editId: feature.id, pathSketchId: feature.pathSketchId, pathEntityIds: feature.pathEntityIds, outsideDiameter: feature.outsideDiameter, wallThickness: feature.wallThickness, operation: feature.operation, previewFeature: feature });
    else if (feature.type === 'pattern') {
      const pathOptions = document.sketches.map((sketch) => ({ id: sketch.id, name: sketch.name, entityIds: sketch.entities.filter((entity) => entity.type === 'line' && entity.role !== 'construction').map((entity) => entity.id) })).filter((path) => path.entityIds.length);
      setCommand({ type: 'pattern', editId: feature.id, targetBodyId: feature.targetBodyId, patternType: feature.patternType, countX: feature.countX || '3', countY: feature.countY || '1', spacingX: feature.spacingX || '20', spacingY: feature.spacingY || '20', axisId: feature.axisId || 'Z_AXIS', occurrences: feature.occurrences || '4', totalAngle: feature.totalAngle || '360', pathOptions, pathSketchId: feature.pathSketchId || pathOptions[0]?.id, pathEntityIds: feature.pathEntityIds || pathOptions[0]?.entityIds || [], axisOptions: [{ id: 'X_AXIS', name: 'Oś bazowa X' }, { id: 'Y_AXIS', name: 'Oś bazowa Y' }, { id: 'Z_AXIS', name: 'Oś bazowa Z' }, ...constructionAxes.filter((axis) => axis.status === 'ok').map((axis) => ({ id: axis.id, name: axis.name }))], previewFeature: feature });
    }
    else if (feature.type === 'boolean') setCommand({ type: 'boolean', editId: feature.id, operation: feature.operation, targetBodyId: feature.targetBodyId, toolBodyId: feature.toolBodyId, targetName: feature.targetBodyId, toolName: feature.toolBodyId, previewFeature: feature });
    else if (feature.type === 'primitive') setCommand({ type: 'primitive', editId: feature.id, name: feature.name, primitiveType: feature.primitiveType, x: feature.x, y: feature.y, z: feature.z, width: feature.width || '20', depth: feature.depth || '20', height: feature.height || '20', radius: feature.radius || '10', majorRadius: feature.majorRadius || '15', minorRadius: feature.minorRadius || '4', previewFeature: feature });
    else if (feature.type === 'transform') setCommand({ type: 'transform', editId: feature.id, targetBodyId: feature.targetBodyId, mode: feature.mode, x: feature.x || '0', y: feature.y || '0', z: feature.z || '0', angle: feature.angle || '0', originX: feature.originX || '0', originY: feature.originY || '0', originZ: feature.originZ || '0', previewFeature: feature });
    else if (feature.type === 'offsetFace') setCommand({ type: 'offsetFace', editId: feature.id, targetBodyId: feature.targetBodyId, distance: feature.distance, faceLabel: '1 wskazana', previewFeature: feature });
    else if (feature.type === 'textSolid') setCommand({ type: 'textSolid', editId: feature.id, text: feature.text, fontSize: feature.fontSize, depth: feature.depth, x: feature.x || '0', y: feature.y || '0', z: feature.z || '0', operation: feature.operation, targetBodyId: feature.targetBodyId || null, placement: feature.placement || 'world', topologyReferences: (feature.referenceIds || []).map((id) => document.references.find((reference) => reference.id === id)).filter(Boolean), previewFeature: feature });
    else if (feature.type === 'hole') {
      const holeOptions = { holeType: feature.holeType || 'simple', extent: feature.extent || 'distance', diameter: feature.diameter, depth: feature.depth || '10', counterboreDiameter: feature.counterboreDiameter || '10', counterboreDepth: feature.counterboreDepth || '3', countersinkDiameter: feature.countersinkDiameter || '10', countersinkAngle: feature.countersinkAngle || '90', threadMode: feature.threadMode || 'none', threadDiameter: feature.threadDiameter || '10', threadPitch: feature.threadPitch || '1.5', threadLength: feature.threadLength || feature.depth || '8', threadDirection: feature.threadDirection || 'right', clearanceProfile: feature.clearanceProfile || 'nominal', clearance: feature.clearance || '0.2' };
      setCommand(feature.placement === 'face-edges'
        ? { type: 'hole', placement: 'face-edges', editId: feature.id, targetBodyId: feature.targetBodyId, firstOffset: feature.firstOffset, secondOffset: feature.secondOffset, ...holeOptions, previewFeature: feature }
        : { type: 'hole', editId: feature.id, ...holeOptions, previewFeature: feature });
    }
    else if (feature.type === 'shell') setCommand({ type: 'shell', editId: feature.id, thickness: feature.thickness, faceCount: feature.referenceIds?.length || 0, previewFeature: feature });
    else if (feature.type === 'draft') setCommand({ type: 'draft', editId: feature.id, targetBodyId: feature.targetBodyId, angle: feature.angle, neutralPlaneId: feature.neutralPlaneId, neutralPlaneOptions: draftNeutralPlaneOptions(), faceCount: feature.referenceIds?.length || 0, previewFeature: feature });
    else if (feature.type === 'splitBody') setCommand({ type: 'splitBody', editId: feature.id, targetBodyId: feature.targetBodyId, targetName: feature.targetBodyId, planeId: feature.planeId, planeOptions: draftNeutralPlaneOptions(), previewFeature: feature });
    else if (feature.type === 'splitFace') {
      const reference = document.references.find((item) => item.id === feature.referenceIds?.[0]);
      setCommand({ type: 'splitFace', editId: feature.id, targetBodyId: feature.targetBodyId, sketchId: feature.sketchId, profileId: feature.profileId, profileName: profile?.name || feature.profileId, referenceId: reference?.id, faceName: reference?.label, previewFeature: feature });
    }
    else if (feature.type === 'deleteFace') setCommand({ type: 'deleteFace', editId: feature.id, targetBodyId: feature.targetBodyId, faceCount: feature.referenceIds?.length || 0, previewFeature: feature });
    else if (feature.type === 'replaceFace') setCommand({ type: 'replaceFace', editId: feature.id, targetBodyId: feature.targetBodyId, sourceName: 'Ściana z trwałej referencji', destinationName: 'Powierzchnia z trwałej referencji', previewFeature: feature });
    else setCommand({ type: feature.type, editId: feature.id, size: feature.type === 'fillet' ? feature.radius : feature.distance, previewFeature: feature });
  };

  const saveProject = async () => {
    if (readOnly) {
      readOnlyNotice();
      return false;
    }
    const payload = JSON.stringify(document, null, 2);
    if (window.desktopApp?.saveTextFile) {
      const result = await window.desktopApp.saveTextFile({
        defaultName: `${safeName(document.name)}.madcad`,
        text: payload,
        filters: [{ name: 'Projekt MadCAD', extensions: ['madcad'] }, { name: 'JSON', extensions: ['json'] }],
        atomic: true,
        createBackup: true,
      });
      if (!result?.ok) {
        setNotice(result?.canceled ? 'Anulowano zapis.' : `Nie udało się zapisać: ${result?.error || 'nieznany błąd'}`);
        return false;
      }
      setSavedDocumentText(JSON.stringify(document));
      setCurrentPath(result.filePath || '');
      try {
        await clearAutosaveSnapshots();
      } catch (error) {
        setNotice(`Projekt zapisano, ale nie udało się wyczyścić autozapisu: ${error.message}`);
        return true;
      }
      setRecoveryInfo(null);
      setNotice(`Zapisano projekt atomowo: ${result.filePath}${result.backupPath ? ' · poprzednia wersja: .bak' : ''}`);
      return true;
    }
    downloadBlob(new Blob([payload], { type: 'application/json' }), `${safeName(document.name)}.madcad`);
    setSavedDocumentText(JSON.stringify(document));
    clearLocalAutosave();
    setNotice('Zapisano projekt MadCAD.');
    return true;
  };

  const confirmUnsavedChanges = async (reason) => {
    if (!persistenceReady) {
      setNotice('Poczekaj na zakończenie odzyskiwania autozapisu przed zmianą projektu lub aktualizacją.');
      return false;
    }
    if (!dirty) return true;
    let decision = 'cancel';
    const verifyMode = new URLSearchParams(window.location.search).has('verify');
    if (verifyMode) {
      decision = ['save', 'discard', 'cancel'].includes(window.__madcadVerifyUnsavedDecision)
        ? window.__madcadVerifyUnsavedDecision
        : 'discard';
    } else if (window.desktopApp?.confirmUnsavedChanges) {
      const result = await window.desktopApp.confirmUnsavedChanges({ reason });
      decision = result?.decision || 'cancel';
    } else {
      decision = window.confirm('Projekt zawiera niezapisane zmiany. Odrzucić je i kontynuować?') ? 'discard' : 'cancel';
    }
    if (decision === 'save') return saveProject();
    return decision === 'discard';
  };

  const installAvailableUpdate = async () => {
    if (!window.desktopApp?.downloadAndInstallUpdate) {
      setUpdateState((current) => ({ ...current, error: 'Instalowanie aktualizacji jest dostępne tylko w aplikacji desktopowej.' }));
      return;
    }
    if (updateState.result?.installMode === 'automatic' && !(await confirmUnsavedChanges('update'))) return;
    try {
      setUpdateState((current) => ({ ...current, status: 'installing', error: '' }));
      const result = await window.desktopApp.downloadAndInstallUpdate();
      if (result?.ok && result.handoff) {
        setUpdateState((current) => ({ ...current, status: 'idle', handoff: result, error: '' }));
        return;
      }
      if (!result?.ok || !result.installing) {
        setUpdateState((current) => ({
          ...current,
          status: 'idle',
          error: result?.error || (result?.upToDate ? 'Masz już aktualną wersję.' : 'Nie udało się rozpocząć instalacji.'),
        }));
        return;
      }
    } catch (error) {
      setUpdateState((current) => ({ ...current, status: 'idle', error: error.message }));
    }
  };

  const createNew = async () => {
    if (!(await confirmUnsavedChanges('new'))) return;
    const blank = createDocument('Bez nazwy');
    await clearAutosaveSnapshots().catch((error) => setNotice(`Nie udało się wyczyścić poprzedniego autozapisu: ${error.message}`));
    history.replace(blank);
    setSavedDocumentText(JSON.stringify(blank));
    setCurrentPath('');
    setDocumentAccess({ readOnly: false, sourceVersion: DOCUMENT_SCHEMA_VERSION, originalDocument: null });
    setSelection({ kind: 'document', id: blank.id });
    setActiveSketchId(null);
    setCommand(null);
    setWorkspace('solid');
    setNotice('Nowy pusty projekt. Utwórz pierwszy szkic.');
  };

  const requestOpenProject = () => fileInputRef.current?.click();

  const openProject = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!(await confirmUnsavedChanges('open'))) return;
    try {
      const opened = openDocument(JSON.parse(await file.text()));
      await clearAutosaveSnapshots().catch((error) => setNotice(`Nie udało się wyczyścić poprzedniego autozapisu: ${error.message}`));
      history.replace(opened.document);
      setSavedDocumentText(JSON.stringify(opened.document));
      setCurrentPath(file.path || file.name || '');
      setDocumentAccess({ readOnly: opened.readOnly, sourceVersion: opened.sourceVersion, originalDocument: opened.originalDocument });
      setSelection({ kind: 'document', id: opened.document.id });
      setActiveSketchId(null);
      setCommand(null);
      setWorkspace('solid');
      setNotice(`${opened.warning ? `${opened.warning} ` : ''}Otwarto projekt ${opened.document.name}.`);
    } catch (error) {
      setNotice(`Nie udało się otworzyć projektu: ${error.message}`);
    }
  };

  const chooseModelImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const originalFormat = file.name.split('.').pop()?.toLowerCase();
    if (!['step', 'stp', 'stl', '3mf'].includes(originalFormat)) {
      setNotice('Import obsługuje pliki STEP, STL i 3MF.');
      return;
    }
    setModelImportBusy(true);
    setNotice(`Sprawdzanie i przygotowywanie pliku ${file.name}…`);
    try {
      const sourceBuffer = await file.arrayBuffer();
      const normalizedFormat = originalFormat === 'stp' ? 'step' : originalFormat;
      const inspection = inspectModelImportBuffer(sourceBuffer, normalizedFormat);
      let importFormat = originalFormat === 'step' || originalFormat === 'stp' ? 'step' : 'stl';
      let buffer = sourceBuffer;
      let detectedUnit = 'millimeter';
      let objectCount = null;
      let triangleCount = inspection.triangleCount;
      if (originalFormat === '3mf') {
        const [{ ThreeMFLoader }, { STLExporter }] = await Promise.all([
          import('three/examples/jsm/loaders/3MFLoader.js'),
          import('three/examples/jsm/exporters/STLExporter.js'),
        ]);
        const archiveInfo = inspectThreeMfArchive(sourceBuffer);
        detectedUnit = normalizeModelUnit(archiveInfo.unit);
        objectCount = archiveInfo.objectCount;
        triangleCount = archiveInfo.triangleCount;
        const group = new ThreeMFLoader().parse(sourceBuffer);
        group.updateMatrixWorld(true);
        const exported = new STLExporter().parse(group, { binary: true });
        buffer = exported.buffer.slice(exported.byteOffset, exported.byteOffset + exported.byteLength);
        inspectModelImportBuffer(buffer, 'stl');
      }
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      setImportDraft({
        fileName: file.name,
        name: file.name.replace(/\.(step|stp|stl|3mf)$/i, ''),
        originalFormat: originalFormat === 'stp' ? 'step' : originalFormat,
        importFormat,
        dataBase64: btoa(binary),
        sourceUnit: originalFormat === '3mf' ? detectedUnit : 'auto',
        detectedUnit,
        sourceBytes: inspection.bytes,
        storedBytes: buffer.byteLength,
        objectCount,
        triangleCount,
        importMode: inspection.importMode,
      });
      setNotice(`Wczytano ${file.name} · ${formatModelFileSize(inspection.bytes)}${Number.isFinite(triangleCount) ? ` · ${triangleCount.toLocaleString('pl-PL')} trójkątów` : ''}. Potwierdź jednostkę źródłową.`);
    } catch (error) {
      setNotice(`Nie udało się odczytać modelu: ${error.message}`);
    } finally {
      setModelImportBusy(false);
    }
  };

  const confirmModelImport = () => {
    if (!importDraft || readOnly) return;
    const unitScale = { auto: 1, millimeter: 1, centimeter: 10, inch: 25.4, meter: 1000, micron: 0.001, foot: 304.8 }[importDraft.sourceUnit] || 1;
    const feature = createFeature('importedModel', {
      name: importDraft.name || 'Model importowany',
      originalFormat: importDraft.originalFormat,
      importFormat: importDraft.importFormat,
      dataBase64: importDraft.dataBase64,
      sourceUnit: importDraft.sourceUnit,
      unitScale,
      sourceBytes: importDraft.sourceBytes,
      objectCount: importDraft.objectCount,
      triangleCount: importDraft.triangleCount,
    });
    commit((next) => next.features.push(feature));
    setSelection({ kind: 'feature', id: feature.id });
    setImportDraft(null);
    setWorkspace('solid');
    setNotice(`Importowanie ${importDraft.fileName} w silniku CAD… Model zostanie pokazany i dopasowany do widoku automatycznie.`);
  };

  const chooseSketchImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !activeSketchId || readOnly) return;
    const format = file.name.split('.').pop()?.toLowerCase();
    if (!['svg', 'dxf'].includes(format)) {
      setNotice('Import szkicu obsługuje pliki SVG i DXF.');
      return;
    }
    try {
      const text = await file.text();
      const inspected = inspectSketchImport(text, format);
      setSketchImportDraft({ fileName: file.name, format, text, detectedUnit: inspected.detectedUnit, sourceUnit: 'auto' });
      setNotice(`Wczytano ${file.name}. Potwierdź jednostkę przed dodaniem geometrii.`);
    } catch (error) {
      setNotice(`Nie udało się odczytać szkicu: ${error.message}`);
    }
  };

  const prepareDwgSketchImport = useCallback((result) => {
    if (result?.canceled) {
      setNotice('Anulowano import DWG.');
      return false;
    }
    if (result?.setupRequired) {
      setNotice('Otworzono stronę lokalnego konwertera DWG. Po instalacji ponownie wybierz Import DWG.');
      return false;
    }
    if (!result?.ok || !result.text) throw new Error(result?.error || 'Konwerter nie zwrócił danych DXF.');
    const inspected = inspectSketchImport(result.text, 'dxf');
    setSketchImportDraft({
      fileName: result.fileName || 'import.dwg',
      sourceFormat: 'dwg',
      format: 'dxf',
      text: result.text,
      detectedUnit: inspected.detectedUnit,
      sourceUnit: 'auto',
    });
    setNotice(`Przekonwertowano ${result.fileName || 'DWG'} lokalnie przez ${result.converter === 'libredwg' ? 'GNU LibreDWG' : 'ODA'}. Potwierdź jednostkę.`);
    return true;
  }, []);

  const chooseDwgSketchImport = async () => {
    if (!activeSketchId || readOnly) return;
    if (!window.desktopApp?.importDwgSketch) {
      setNotice('Import DWG jest dostępny w zainstalowanej aplikacji desktopowej.');
      return;
    }
    setNotice('Wybierz plik DWG. Konwersja zostanie wykonana lokalnie.');
    try {
      prepareDwgSketchImport(await window.desktopApp.importDwgSketch());
    } catch (error) {
      setNotice(`Import DWG nie powiódł się: ${error.message}`);
    }
  };

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('verify')) return undefined;
    window.__madcadVerifyDwgImport = prepareDwgSketchImport;
    return () => { delete window.__madcadVerifyDwgImport; };
  }, [prepareDwgSketchImport]);

  const confirmSketchImport = () => {
    if (!sketchImportDraft || !activeSketchId || readOnly) return;
    try {
      const imported = parseSketchImport(sketchImportDraft.text, sketchImportDraft.format, { sourceUnit: sketchImportDraft.sourceUnit });
      commit((next) => {
        const targetSketch = next.sketches.find((item) => item.id === activeSketchId);
        if (!targetSketch) throw new Error('Aktywny szkic nie istnieje.');
        targetSketch.entities.push(...imported.entities);
        refreshDetectedSketchProfiles(targetSketch, next.parameters);
      });
      setSketchImportDraft(null);
      setSelection({ kind: 'sketch', id: activeSketchId });
      setNotice(`Zaimportowano ${imported.curveCount} elementów z ${sketchImportDraft.fileName} · ${imported.profiles.length} profili · jednostka ${imported.sourceUnit}.`);
    } catch (error) {
      setNotice(`Import szkicu nie powiódł się: ${error.message}`);
    }
  };

  const exportModel = async (format) => {
    setNotice(`Przygotowywanie pliku ${format.toUpperCase()}…`);
    try {
      const buffers = await engine.exportModel(format);
      const extension = format === 'step' ? 'step' : format;
      const mime = format === 'stl' ? 'model/stl' : format === '3mf' ? 'model/3mf' : 'model/step';
      buffers.forEach((buffer, index) => downloadBlob(new Blob([buffer], { type: mime }), `${safeName(document.name)}${buffers.length > 1 ? `-${index + 1}` : ''}.${extension}`));
      setNotice(format === 'step'
        ? 'Wyeksportowano STEP z dokładnej bryły B-Rep.'
        : `Wyeksportowano ${format.toUpperCase()} jako siatkę 3D.`);
    } catch (error) {
      setNotice(`Eksport nie powiódł się: ${error.message}`);
    }
  };

  const sendToSlicer = async (slicer) => {
    const slicerNames = { bambu: 'Bambu Studio', prusa: 'PrusaSlicer', cura: 'UltiMaker Cura' };
    const name = slicerNames[slicer] || slicer;
    setNotice(`Przygotowywanie STL dla ${name}…`);
    try {
      const buffers = await engine.exportModel('stl');
      if (!window.desktopApp?.sendToSlicer) {
        buffers.forEach((buffer, index) => downloadBlob(new Blob([buffer], { type: 'model/stl' }), `${safeName(document.name)}${buffers.length > 1 ? `-${index + 1}` : ''}.stl`));
        setNotice(`Pobrano STL. Otwórz plik ręcznie w ${name}.`);
        return;
      }
      const result = await window.desktopApp.sendToSlicer({
        slicer,
        files: buffers.map((buffer, index) => ({ name: `${safeName(document.name)}${buffers.length > 1 ? `-${index + 1}` : ''}.stl`, data: new Uint8Array(buffer) })),
      });
      if (!result?.ok) throw new Error(result?.error || `Nie udało się uruchomić ${name}.`);
      setNotice(`Przekazano ${buffers.length} ${buffers.length === 1 ? 'plik' : 'pliki'} STL do ${name}.`);
    } catch (error) {
      setNotice(`Przekazanie do ${name} nie powiodło się: ${error.message}`);
    }
  };

  const switchWorkspace = (id) => {
    setCommand(null);
    setActiveSketchId(null);
    setWorkspace(id);
    setPrintPanelOpen(false);
    setNotice(id === 'print'
      ? 'Eksportuj dokładny model CAD albo otwórz opcjonalną kontrolę druku 3D.'
      : id === 'tools'
        ? 'Parametry, geometria konstrukcyjna, pomiary i analiza modelu.'
        : 'Obszar projektowania CAD.');
  };

  const selectTimelineStep = (direction) => {
    if (!document.features.length) return;
    const currentIndex = selection?.kind === 'feature'
      ? document.features.findIndex((feature) => feature.id === selection.id)
      : -1;
    const nextIndex = direction === 'start'
      ? 0
      : direction === 'previous'
        ? Math.max(0, currentIndex < 0 ? document.features.length - 1 : currentIndex - 1)
        : Math.min(document.features.length - 1, currentIndex + 1);
    const feature = document.features[nextIndex];
    setSelection({ kind: 'feature', id: feature.id });
    setTimelineRename(null);
    setTimelineDeleteId(null);
    setNotice(`${nextIndex + 1}. ${feature.name}`);
  };

  const selectTimelineFeature = (feature, index) => {
    setSelection({ kind: 'feature', id: feature.id });
    setTimelineRename(null);
    setTimelineDeleteId(null);
    setNotice(`${index + 1}. ${feature.name}`);
  };

  const moveSelectedTimelineFeature = (delta) => {
    if (readOnly || selection?.kind !== 'feature') return readOnly ? readOnlyNotice() : undefined;
    const result = moveTimelineFeature(document, selection.id, delta);
    if (!result.ok) {
      setNotice(`Nie można zmienić kolejności: ${result.reason}`);
      return;
    }
    commit((next) => { next.features = result.features; });
    setTimelineDeleteId(null);
    setNotice(`Przeniesiono operację na pozycję ${result.toIndex + 1}. Zależności modelu pozostały poprawne.`);
  };

  const toggleSelectedTimelineFeature = () => {
    if (readOnly || selection?.kind !== 'feature') return readOnly ? readOnlyNotice() : undefined;
    const feature = document.features.find((item) => item.id === selection.id);
    if (!feature) return;
    const suppressed = !feature.suppressed;
    commit((next) => { setTimelineFeatureSuppressed(next, feature.id, suppressed); });
    setTimelineDeleteId(null);
    setNotice(suppressed ? `Wyłączono „${feature.name}”. Operacje zależne zostaną oznaczone na osi czasu.` : `Włączono „${feature.name}” i uruchomiono ponowne przeliczenie historii.`);
  };

  const beginTimelineRename = () => {
    if (readOnly || selection?.kind !== 'feature') return readOnly ? readOnlyNotice() : undefined;
    const feature = document.features.find((item) => item.id === selection.id);
    if (!feature) return;
    setTimelineDeleteId(null);
    setTimelineRename({ id: feature.id, value: feature.name });
  };

  const confirmTimelineRename = () => {
    const nextName = String(timelineRename?.value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!timelineRename?.id || !nextName) {
      setNotice('Nazwa operacji nie może być pusta.');
      return;
    }
    commit((next) => { renameTimelineFeature(next, timelineRename.id, nextName); });
    setTimelineRename(null);
    setNotice(`Zmieniono nazwę operacji na „${nextName}”.`);
  };

  const requestTimelineDelete = () => {
    if (readOnly || selection?.kind !== 'feature') return readOnly ? readOnlyNotice() : undefined;
    setTimelineRename(null);
    setTimelineDeleteId(selection.id);
  };

  const confirmTimelineDelete = () => {
    if (!timelineDeleteId) return;
    const deletedIds = dependentTimelineFeatureIds(document, timelineDeleteId);
    const deletedSet = new Set(deletedIds);
    const deletedIndex = document.features.findIndex((feature) => feature.id === timelineDeleteId);
    const nextSelection = document.features.slice(deletedIndex + 1).find((feature) => !deletedSet.has(feature.id))
      || [...document.features.slice(0, deletedIndex)].reverse().find((feature) => !deletedSet.has(feature.id));
    commit((next) => { deleteTimelineFeatureCascade(next, timelineDeleteId); });
    setTimelineDeleteId(null);
    setTimelineRename(null);
    setCommand(null);
    setSelection(nextSelection ? { kind: 'feature', id: nextSelection.id } : { kind: 'document', id: document.id });
    setNotice(`Usunięto ${deletedIds.length} ${deletedIds.length === 1 ? 'operację' : 'operacje'} z osi czasu wraz z zależnościami.`);
  };

  const handleBrowserSelection = (nextSelection) => {
    if (nextSelection.kind === 'settings') {
      setCommand({ type: 'parameters' });
      setNotice('Parametry modelu sterują wymiarami szkiców i operacji.');
      return;
    }
    if (nextSelection.kind === 'plane') {
      if (readOnly) {
        setSelection(nextSelection);
        readOnlyNotice();
        return;
      }
      pickPlane(nextSelection.id);
      return;
    }
    setSelection(nextSelection);
  };

  const executeBasicShortcut = useCallback((rawShortcut) => {
    const shortcut = String(rawShortcut || '').trim().toUpperCase();
    if (!shortcut) return false;
    const entry = shortcutRegistryRef.current.get(shortcut);
    if (!entry) return false;
    setToolHelp(null);
    if (entry.disabled) {
      setNotice(`Narzędzie „${entry.label}” jest teraz niedostępne. Najpierw wybierz wymaganą geometrię.`);
      return { handled: true, disabled: true, label: entry.label };
    }
    entry.onClick?.();
    return { handled: true, disabled: false, label: entry.label };
  }, []);

  const cancelActiveCommand = () => {
    if (!command) return false;
    if (command.type === 'line' || command.type === 'polyline') finishSketchPath();
    else {
      if (command.openChain && command.sourceSketchId) {
        setActiveSketchId(command.sourceSketchId);
        setWorkspace('sketch');
      }
      setCommand(null);
      setNotice('Anulowano polecenie.');
    }
    return true;
  };

  const executeCommandEnter = ({ preferExact = false } = {}) => {
    if (!command) return false;
    if (command.type === 'line' || command.type === 'polyline') {
      if (preferExact && command.lastPoint) confirmExactSketchSegment();
      else if (command.lastPoint && sketchDynamicLengthRef.current) confirmDynamicSketchSegment();
      else finishSketchPath();
      return true;
    }
    if (directSketchTypes.includes(command.type)) finishCanvasSketchTool();
    else if (command.previewFeature) confirmFeature();
    else if (command.type === 'moveSketch') confirmSketchMove();
    else if (command.type === 'offsetSketch') confirmSketchOffset();
    else if (command.type === 'cornerSketch') confirmSketchCorner();
    else if (command.type === 'transformSketch') confirmSketchTransform();
    else if (command.type === 'patternSketch') confirmSketchPattern();
    else return false;
    return true;
  };

  const handleCommandLineCancel = () => {
    if (cancelActiveCommand()) {
      appendCommandHistory('ESC', 'Anulowano aktywne polecenie.');
      return;
    }
    if (activeSketchId) {
      handleSketchSelection([], 'replace');
      setNotice('Wyczyszczono zaznaczenie szkicu.');
    } else {
      setSelection({ kind: 'document', id: document.id });
      setNotice('Wyczyszczono zaznaczenie.');
    }
  };

  const handleCommandLineSubmit = (rawInput) => {
    const parsed = parseCommandLineInput(rawInput);
    if (parsed.type === 'cancel') {
      handleCommandLineCancel();
      return true;
    }
    if (parsed.type === 'empty') {
      const handled = executeCommandEnter();
      appendCommandHistory('', handled ? 'Zatwierdzono aktywne polecenie.' : 'Brak aktywnego polecenia.');
      if (!handled) setNotice('Wpisz polecenie albo uruchom narzędzie z wstążki.');
      return true;
    }
    if (parsed.type === 'number') {
      if ((command?.type === 'line' || command?.type === 'polyline') && command.lastPoint) {
        if (!(parsed.value > 0)) {
          setNotice('Długość linii musi być dodatnia.');
          appendCommandHistory(parsed.raw, 'Odrzucono: długość musi być dodatnia.');
          return true;
        }
        sketchDynamicLengthRef.current = String(parsed.value);
        setCommand((current) => ({ ...current, dynamicLength: String(parsed.value) }));
        appendCommandHistory(parsed.raw, `Długość segmentu: ${parsed.value} mm.`);
        confirmDynamicSketchSegment();
        return true;
      }
      setNotice('Wartość liczbowa działa po wskazaniu pierwszego punktu linii lub polilinii.');
      appendCommandHistory(parsed.raw, 'Brak polecenia oczekującego na długość.');
      return true;
    }
    if (parsed.type === 'command') {
      const result = executeBasicShortcut(parsed.command.shortcut);
      if (!result) {
        const message = `Polecenie „${parsed.command.label}” nie jest dostępne w bieżącym obszarze.`;
        setNotice(message);
        appendCommandHistory(parsed.raw, message);
        return true;
      }
      appendCommandHistory(parsed.raw, result.disabled
        ? `Narzędzie „${result.label}” jest teraz niedostępne.`
        : `Uruchomiono: ${result.label}.`);
      return true;
    }
    setNotice(`Nieznane polecenie „${parsed.raw}”. Wpisz np. LINE, PLINE, CIRCLE, OFFSET albo TRIM.`);
    appendCommandHistory(parsed.raw, 'Nieznane polecenie.');
    return true;
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      const textEntry = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName) || event.target?.isContentEditable;
      if (timelineRename && event.key === 'Escape') {
        event.preventDefault();
        setTimelineRename(null);
        return;
      }
      if (!textEntry && !command && selection?.kind === 'feature' && event.key === 'F2' && !readOnly) {
        event.preventDefault();
        beginTimelineRename();
        return;
      }
      if (!textEntry && !command && (event.ctrlKey || event.metaKey) && event.key === 'Enter' && activeSketchId) {
        event.preventDefault();
        finishSketch();
        return;
      }
      if (!textEntry && !command && event.key === 'Escape') {
        event.preventDefault();
        if (activeSketchId) {
          handleSketchSelection([], 'replace');
          setNotice('Wyczyszczono zaznaczenie szkicu.');
        } else {
          setSelection({ kind: 'document', id: document.id });
          setNotice('Wyczyszczono zaznaczenie.');
        }
        return;
      }
      if (!textEntry && !command && !event.ctrlKey && !event.metaKey && !event.altKey && /^[a-z0-9]$/i.test(event.key)) {
        if (executeBasicShortcut(event.key)) event.preventDefault();
        return;
      }
      if (event.key === 'Escape' && command) {
        event.preventDefault();
        cancelActiveCommand();
        return;
      }
      if (event.key === 'Enter' && command) {
        event.preventDefault();
        if (executeCommandEnter({ preferExact: textEntry })) return;
      }
      if (!textEntry && command?.lastPoint && (command.type === 'line' || command.type === 'polyline') && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const current = sketchDynamicLengthRef.current;
        if (/^[0-9]$/.test(event.key)) {
          event.preventDefault();
          const next = `${current}${event.key}`;
          sketchDynamicLengthRef.current = next;
          setCommand((value) => ({ ...value, dynamicLength: next }));
          return;
        }
        if ((event.key === '.' || event.key === ',') && !/[.,]/.test(current)) {
          event.preventDefault();
          const next = `${current || '0'}${event.key}`;
          sketchDynamicLengthRef.current = next;
          setCommand((value) => ({ ...value, dynamicLength: next }));
          return;
        }
        if (event.key === 'Backspace' && current) {
          event.preventDefault();
          const next = current.slice(0, -1);
          sketchDynamicLengthRef.current = next;
          setCommand((value) => ({ ...value, dynamicLength: next }));
          return;
        }
      }
      if (event.ctrlKey && command?.type === 'polyline' && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undoSketchSegment();
        return;
      }
      if (event.ctrlKey && !command && !readOnly && (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y')) {
        event.preventDefault();
        if (event.key.toLowerCase() === 'y' || event.shiftKey) history.redo();
        else history.undo();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && !textEntry && !command && activeSketchId && (selectedSketchEntityIds.length || selectedSketchConstraintId) && !readOnly) {
        event.preventDefault();
        deleteSelectedSketchEntities();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && !textEntry && !command && selection?.kind === 'feature' && !readOnly) {
        event.preventDefault();
        requestTimelineDelete();
        return;
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'e' && selectedProfile && !activeSketchId && !readOnly) {
        event.preventDefault();
        openExtrude();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  // Command state is the stable boundary for the keyboard handler; command helpers are render-local callbacks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command, selectedProfile, activeSketchId, selectedSketchEntityIds, selectedSketchConstraintId, readOnly, history, executeBasicShortcut]);

  const timelineStatus = new Map(engine.timeline?.map((item) => [item.id, item]));
  const selectedTimelineFeature = selection?.kind === 'feature'
    ? document.features.find((feature) => feature.id === selection.id)
    : null;
  const selectedTimelineIndex = selectedTimelineFeature
    ? document.features.findIndex((feature) => feature.id === selectedTimelineFeature.id)
    : -1;
  const timelineDeleteCount = timelineDeleteId
    ? dependentTimelineFeatureIds(document, timelineDeleteId).length
    : 0;
  let directManipulator = null;
  if (command?.type === 'transform') {
    const body = engine.bodies.find((item) => item.id === command.targetBodyId) || engine.bodies[0];
    const origin = body?.metrics?.centerOfMass || [0, 0, 0];
    if (command.mode === 'move') directManipulator = { kind: 'move', value: command.x, origin, axis: [1, 0, 0], min: -100000, max: 100000, label: 'Przesuń bryłę', hint: 'Przeciągnij wspólny uchwyt, aby przesunąć bryłę w osi X', onCommit: (value) => updateCommand({ x: String(value) }) };
    else directManipulator = { kind: 'rotate', value: command.angle, origin, axis: [0, 0, 1], min: -360, max: 360, label: 'Obróć bryłę', hint: 'Przeciągnij wspólny uchwyt, aby ustawić obrót wokół osi Z', onCommit: (value) => updateCommand({ angle: String(value) }) };
  } else if (command?.type === 'offsetFace') {
    const referenceId = command.previewFeature?.referenceIds?.[0];
    const reference = command.topologyReferences?.[0] || document.references.find((item) => item.id === referenceId);
    directManipulator = { kind: 'offsetFace', value: command.distance, origin: reference?.descriptor?.center || [0, 0, 0], axis: reference?.descriptor?.normal || [0, 0, 1], min: -100000, max: 100000, label: 'Offset Face', hint: 'Przeciągnij wspólny uchwyt, aby odsunąć wskazaną ścianę', onCommit: (value) => updateCommand({ distance: String(value) }) };
  }
  const draftProfile = command?.type === 'rectangle' && command.definition === 'center'
    ? { type: 'rectangle', geometry: { width: command.width, height: command.height, x: command.x, y: command.y } }
    : command?.type === 'circle' && command.definition === 'centerRadius'
      ? { type: 'circle', geometry: { diameter: command.diameter, x: command.x, y: command.y } }
      : null;

  return (
    <ToolHelpContext.Provider value={toolHelpContext}>
    <section className={`modeling-shell platform-${DESKTOP_PLATFORM} ${document.features.length ? '' : 'timeline-empty'}`} aria-label="Modelowanie parametryczne MadCAD">
      <header className="modeling-titlebar">
        <div className="app-menu"><button className={browserOpen ? 'active' : ''} type="button" title="Pokaż lub ukryj przeglądarkę" onClick={() => setBrowserOpen((open) => !open)}><Grid2X2 size={16} /></button><button id="newProjectBtn" type="button" title="Nowy projekt" onClick={createNew}><FilePlus2 size={16} /></button><button id="openProjectBtn" type="button" title="Otwórz projekt" onClick={requestOpenProject}><FolderOpen size={16} /></button><button id="saveProjectBtn" type="button" title={readOnly ? 'Zapis jest zablokowany dla projektu z nowszej wersji.' : dirty ? 'Zapisz zmiany' : 'Projekt jest zapisany'} disabled={readOnly} onClick={saveProject}><Save size={16} /></button></div>
        <input ref={fileInputRef} hidden type="file" accept=".madcad,.json,application/json" onChange={openProject} />
        <input ref={importInputRef} hidden type="file" accept=".step,.stp,.stl,.3mf,model/step,model/stl,model/3mf" onChange={chooseModelImport} />
        <input ref={sketchImportInputRef} hidden type="file" accept=".svg,.dxf,image/svg+xml,application/dxf" onChange={chooseSketchImport} />
        <div className="document-tab" title={currentPath || (dirty ? 'Projekt zawiera niezapisane zmiany' : 'Projekt zapisany')}><Box size={15} /><input value={document.name} aria-label="Nazwa projektu" disabled={readOnly} onChange={(event) => commit((next) => { next.name = event.target.value; })} />{readOnly ? <span className="read-only-badge">TYLKO ODCZYT · v{documentAccess.sourceVersion}</span> : dirty ? <span role="img" aria-label="Niezapisane zmiany">*</span> : null}</div>
        <div className="title-actions"><button id="undoProjectBtn" type="button" disabled={readOnly || !history.canUndo} onClick={history.undo} title="Cofnij"><Undo2 size={15} /></button><button id="redoProjectBtn" type="button" disabled={readOnly || !history.canRedo} onClick={history.redo} title="Ponów"><Redo2 size={15} /></button><label className="language-select" title="Język interfejsu"><span className="sr-only">Język interfejsu</span><select aria-label="Język interfejsu" value={language} onChange={(event) => { void changeAppLanguage(event.target.value); }}><option value="pl">PL</option><option value="en">EN</option></select></label><button type="button" title="Samouczek pierwszego projektu CAD" aria-label="Samouczek pierwszego projektu CAD" onClick={() => setTutorialOpen(true)}><CircleHelp size={15} /><span>Samouczek</span></button><button id="checkUpdatesBtn" type="button" title="Sprawdź aktualizacje" onClick={() => { void checkForUpdates(false); }}><HardDriveDownload size={15} /><span>Aktualizacje</span></button><button id="licenseInfoBtn" type="button" title="Licencja i informacje" onClick={() => setLicenseInfoOpen(true)}><CircleHelp size={15} /><span>Licencja</span></button><div className="brand-mark" title="MadCAD"><img src={madcadIconUrl} alt="MadCAD" /></div></div>
      </header>

      <section className="command-area">
        <div className="command-ribbon">
          <nav className="workspace-tabs" aria-label="Obszary robocze">
            {activeSketchId ? <button className="active" type="button" title="Aktywny obszar edycji szkicu 2D.">SZKICUJ</button> : MAIN_TABS.map((item) => <button id={item.id === 'print' ? 'printWorkspaceBtn' : undefined} key={item.id} className={workspace === item.id ? 'active' : ''} type="button" title={item.id === 'solid' ? 'Szkicowanie 2D i modelowanie parametryczne 3D.' : item.id === 'tools' ? 'Parametry i narzędzia dokumentu.' : 'Eksport CAD oraz opcjonalne przygotowanie druku 3D.'} onClick={() => switchWorkspace(item.id)}>{item.label}</button>)}
          </nav>
          <ResponsiveRibbon>
            {activeSketchId ? (
              <>
                <RibbonGroup label="RYSUJ 2D"><ToolButton icon={Minus} label="Linia" onClick={() => openSketchPath('line')} primary disabled={readOnly} /><ToolButton icon={Move} label="Polilinia" onClick={() => openSketchPath('polyline')} disabled={readOnly} /><ToolButton icon={RotateCw} label="Łuk styczny" onClick={() => setCommand((current) => current?.type === 'polyline' ? { ...current, segmentMode: 'tangentArc' } : current)} disabled={readOnly || command?.type !== 'polyline' || !command.segmentIds.length} /><ToolButton icon={Rotate3d} label="Łuk" onClick={() => openMechanicalShape('arc')} disabled={readOnly} /><ToolButton icon={Square} label="Prostokąt" onClick={() => openProfileCommand('rectangle')} disabled={readOnly} /><ToolButton icon={Circle} label="Okrąg" onClick={() => openProfileCommand('circle')} disabled={readOnly} /><ToolButton icon={Hexagon} label="Wielokąt" onClick={() => openMechanicalShape('polygon')} disabled={readOnly} /><ToolButton icon={Shapes} label="Elipsa" onClick={() => openMechanicalShape('ellipse')} disabled={readOnly} /><ToolButton icon={Frame} label="Slot" onClick={() => openMechanicalShape('slot')} disabled={readOnly} /><ToolButton icon={ScanSearch} label="Spline" onClick={() => openMechanicalShape('spline')} disabled={readOnly} /><ToolButton icon={ScanSearch} label="Conic" onClick={() => openMechanicalShape('conic')} disabled={readOnly} /><ToolButton icon={CircleDotDashed} label="Punkt" onClick={() => openMechanicalShape('point')} disabled={readOnly} /></RibbonGroup>
                <RibbonGroup label="UTWÓRZ 3D Z PROFILU"><ToolButton icon={Box} label="Thin Extrude" onClick={openExtrude} disabled={readOnly || !canExtrudeOpenChain} /><ToolButton icon={Frame} label="Rib/Web" onClick={openRib} disabled={readOnly || !canCreateRib} /><ToolButton icon={Cylinder} label="Pipe" onClick={openPipe} disabled={readOnly || !canExtrudeOpenChain} /></RibbonGroup>
                <RibbonGroup label="IMPORT SZKICU 2D"><ToolButton icon={Upload} label="Import SVG/DXF" onClick={() => sketchImportInputRef.current?.click()} disabled={readOnly} /><ToolButton icon={Upload} label="Import DWG" onClick={() => { void chooseDwgSketchImport(); }} disabled={readOnly} /></RibbonGroup>
                <RibbonGroup label="MODYFIKUJ 2D"><ToolButton icon={MousePointer2} label="Wybierz" onClick={() => { setCommand(null); handleSketchSelection([], 'replace'); }} /><ToolButton icon={Scissors} label="Trim" onClick={() => setCommand((current) => current?.type === 'trimSketch' ? null : { type: 'trimSketch' })} primary={command?.type === 'trimSketch'} disabled={readOnly} /><ToolButton icon={Maximize2} label="Extend" onClick={() => setCommand((current) => current?.type === 'extendSketch' ? null : { type: 'extendSketch' })} primary={command?.type === 'extendSketch'} disabled={readOnly} /><ToolButton icon={Minus} label="Break" onClick={() => setCommand((current) => current?.type === 'breakSketch' ? null : { type: 'breakSketch' })} primary={command?.type === 'breakSketch'} disabled={readOnly} /><ToolButton icon={ScanSearch} label="Project" onClick={projectSelectedTopology} primary={command?.type === 'projectSketch'} disabled={readOnly} /><ToolButton icon={Copy} label="Offset" onClick={openSketchOffset} disabled={readOnly || (!selectedSketchEntityIds.length && !activeOffsetProfile)} /><ToolButton icon={CircleDotDashed} label="Fillet szkicu" onClick={() => openSketchCorner('fillet')} disabled={readOnly || selectedSketchEntityIds.length !== 2} /><ToolButton icon={Triangle} label="Faza szkicu" onClick={() => openSketchCorner('chamfer')} disabled={readOnly || selectedSketchEntityIds.length !== 2} /><ToolButton icon={RotateCw} label="Transformuj" onClick={openSketchTransform} disabled={readOnly || !selectedSketchEntityIds.length} /><ToolButton icon={Grid2X2} label="Szyk szkicu" onClick={openSketchPattern} disabled={readOnly || !selectedSketchEntityIds.length} /><ToolButton icon={Move3d} label="Przesuń" onClick={openSketchMove} disabled={readOnly || !selectedSketchEntityIds.length} /><ToolButton icon={X} label="Usuń" onClick={deleteSelectedSketchEntities} disabled={readOnly || (!selectedSketchEntityIds.length && !selectedSketchConstraintId)} /></RibbonGroup>
                <RibbonGroup label="WIĘZY"><ToolButton icon={Minus} label="Współliniowe" onClick={() => addSelectedSketchConstraint('collinear')} disabled={readOnly || !canAddCollinear} /><ToolButton icon={Frame} label="Symetria" onClick={() => addSelectedSketchConstraint('symmetry')} disabled={readOnly || !canAddSymmetry} /><ToolButton icon={CircleDotDashed} label="Krzywizna G2" onClick={() => addSelectedSketchConstraint('curvature')} disabled={readOnly || !canAddCurvature} /></RibbonGroup>
                <RibbonGroup label="WYMIARY"><ToolButton icon={Ruler} label="Ordinate X" onClick={() => openSketchDimension('ordinateX')} disabled={readOnly || !canAddOrdinate} /><ToolButton icon={Ruler} label="Ordinate Y" onClick={() => openSketchDimension('ordinateY')} disabled={readOnly || !canAddOrdinate} /><ToolButton icon={RotateCw} label="Długość łuku" onClick={() => openSketchDimension('arcLength')} disabled={readOnly || !canAddArcLength} /></RibbonGroup>
                <RibbonGroup label="ZAKOŃCZ SZKIC" end><ToolButton icon={Check} label="Zakończ szkic" onClick={finishSketch} primary /></RibbonGroup>
              </>
            ) : workspace === 'tools' ? (
              <>
                <RibbonGroup label="PARAMETRY MODELU"><ToolButton icon={Variable} label="Parametry" onClick={() => setCommand({ type: 'parameters' })} disabled={readOnly} primary /></RibbonGroup>
                <RibbonGroup label="SPRAWDŹ MODEL"><ToolButton icon={Ruler} label="Zmierz" onClick={openMeasure} /><ToolButton icon={ScanSearch} label="Przekrój" onClick={openSectionAnalysis} disabled={!engine.bodies.length} /><ToolButton icon={Box} label="Masa" onClick={openMassProperties} disabled={!engine.bodies.length} /><ToolButton icon={AlertTriangle} label="Analiza" onClick={openGeometryInspection} disabled={!engine.bodies.length} /></RibbonGroup>
                <RibbonGroup label="PŁASZCZYZNY"><ToolButton icon={Frame} label="Płaszczyzna offset" onClick={() => openConstructionPlane('offset')} disabled={readOnly} /><ToolButton icon={Layers3} label="Midplane" onClick={() => openConstructionPlane('midplane')} disabled={readOnly} /><ToolButton icon={Triangle} label="Plane 3 punkty" onClick={() => openConstructionPlane('three-points')} disabled={readOnly} /><ToolButton icon={Rotate3d} label="Plane angle" onClick={() => openConstructionPlane('angle')} disabled={readOnly} /><ToolButton icon={CircleDotDashed} label="Plane tangent" onClick={() => openConstructionPlane('tangent')} disabled={readOnly} /><ToolButton icon={Move3d} label="Plane path" onClick={() => openConstructionPlane('path')} disabled={readOnly} /></RibbonGroup>
                <RibbonGroup label="OSIE"><ToolButton icon={Minus} label="Oś z krawędzi" onClick={() => openConstructionAxis('edge')} disabled={readOnly} /><ToolButton icon={Cylinder} label="Oś walca" onClick={() => openConstructionAxis('cylinder')} disabled={readOnly} /><ToolButton icon={Move3d} label="Oś 2 punkty" onClick={() => openConstructionAxis('two-points')} disabled={readOnly} /><ToolButton icon={Layers3} label="Oś przecięcia" onClick={() => openConstructionAxis('plane-intersection')} disabled={readOnly || document.references.filter((reference) => reference.kind === 'construction-plane').length < 2} /><ToolButton icon={Move3d} label="Oś normalna" onClick={() => openConstructionAxis('plane-normal')} disabled={readOnly || !document.references.some((reference) => reference.kind === 'construction-plane')} /></RibbonGroup>
                <RibbonGroup label="PUNKTY"><ToolButton icon={CircleDotDashed} label="Punkt wierzchołka" onClick={() => openConstructionPoint('vertex')} disabled={readOnly} /><ToolButton icon={CircleDotDashed} label="Punkt centrum" onClick={() => openConstructionPoint('center')} disabled={readOnly} /><ToolButton icon={CircleDotDashed} label="Punkt przecięcia" onClick={() => openConstructionPoint('intersection')} disabled={readOnly || !document.references.some((reference) => reference.kind === 'construction-axis') || !document.references.some((reference) => reference.kind === 'construction-plane')} /><ToolButton icon={CircleDotDashed} label="Punkt środkowy" onClick={() => openConstructionPoint('midpoint')} disabled={readOnly} /><ToolButton icon={CircleDotDashed} label="Punkt na osi" onClick={() => openConstructionPoint('on-axis')} disabled={readOnly || !document.references.some((reference) => reference.kind === 'construction-axis')} /></RibbonGroup>
                <RibbonGroup label="IMPORT MODELU 3D" end><ToolButton icon={Upload} label="Import 3D" onClick={() => importInputRef.current?.click()} disabled={readOnly || modelImportBusy} description={modelImportBusy ? 'Trwa przygotowywanie wybranego modelu.' : 'Importuj dokładny STEP albo siatkę STL/3MF.'} /></RibbonGroup>
              </>
            ) : workspace === 'print' ? (
              <>
                <RibbonGroup label="DOKŁADNY CAD"><ToolButton icon={FileBox} label="STEP" onClick={() => exportModel('step')} disabled={!engine.bodies.length || engine.status !== 'ready' || containsImportedMesh} description={containsImportedMesh ? 'STEP jest dostępny wyłącznie dla dokładnych brył B-Rep. Zaimportowaną siatkę zapisz jako STL lub 3MF.' : 'Eksportuj dokładną geometrię CAD do STEP.'} /></RibbonGroup>
                <RibbonGroup label="SIATKI 3D"><ToolButton icon={HardDriveDownload} label="STL" onClick={() => exportModel('stl')} disabled={!engine.bodies.length || engine.status !== 'ready'} /><ToolButton icon={FileDown} label="3MF" onClick={() => exportModel('3mf')} disabled={!engine.bodies.length || engine.status !== 'ready'} /></RibbonGroup>
                <RibbonGroup label="DRUK 3D · DODATEK"><ToolButton icon={Printer} label="Kontrola druku" onClick={() => setPrintPanelOpen(true)} /></RibbonGroup>
              </>
            ) : (
              <>
                <RibbonGroup label="SZKIC 2D"><ToolButton icon={PencilRuler} label="Utwórz szkic" onClick={startSketch} primary disabled={readOnly} /></RibbonGroup>
                <RibbonGroup label="UTWÓRZ BRYŁĘ 3D"><ToolButton icon={Box} label="Wyciągnij" onClick={openExtrude} disabled={readOnly || (!selectedProfile && !canExtrudeOpenChain)} /><ToolButton icon={Rotate3d} label="Revolve" onClick={openRevolve} disabled={readOnly || !selectedProfile || Boolean(activeSketchId)} /><ToolButton icon={Move3d} label="Sweep" onClick={openSweep} disabled={readOnly || !selectedProfile || Boolean(activeSketchId)} /><ToolButton icon={Layers3} label="Loft" onClick={openLoft} disabled={readOnly || !selectedProfile || Boolean(activeSketchId)} /><ToolButton icon={RotateCw} label="Coil" onClick={openCoil} disabled={readOnly || Boolean(activeSketchId)} /><ToolButton icon={Grid2X2} label="Pattern" onClick={openPattern} disabled={readOnly || !targetBodyId || !targetBodySupportsSolidOperations || Boolean(activeSketchId)} description={!targetBodySupportsSolidOperations ? 'Otwarta siatka nie obsługuje bryłowego szyku z łączeniem.' : undefined} /><ToolButton icon={Move3d} label="Press Pull" onClick={openPressPull} disabled={readOnly || !canPressPull} /><ToolButton icon={Box} label="Prymityw" onClick={openPrimitive} disabled={readOnly} /><ToolButton icon={Type} label="Tekst 3D" onClick={openTextSolid} disabled={readOnly} /><ToolButton icon={Shapes} label="Boolean" onClick={openBoolean} disabled={readOnly || !canBooleanSelectedBodies} description={!canBooleanSelectedBodies && selectedBodyIds.length === 2 ? 'Boolean wymaga zgodnych brył B-Rep albo dwóch zamkniętych siatek.' : undefined} /><ToolButton icon={Cylinder} label="Otwór" onClick={openHole} disabled={readOnly || (!hasHoleReference && !hasFaceEdgeHoleReference) || !engine.bodies.length} /></RibbonGroup>
                <RibbonGroup label="MODYFIKUJ BRYŁĘ 3D"><ToolButton icon={CircleDotDashed} label="Zaokrąglij" onClick={() => openEdgeCommand('fillet')} disabled={readOnly || !selectedEdgeItems.length} /><ToolButton icon={Triangle} label="Fazuj" onClick={() => openEdgeCommand('chamfer')} disabled={readOnly || !selectedEdgeItems.length} /><ToolButton icon={Layers3} label="Shell" onClick={openShell} disabled={readOnly || !selectedFaceItems.length} /><ToolButton icon={Triangle} label="Draft" onClick={openDraft} disabled={readOnly || !selectedFaceItems.length} /><ToolButton icon={Scissors} label="Split Body" onClick={openSplitBody} disabled={readOnly || selection?.kind !== 'body'} /><ToolButton icon={Scissors} label="Split Face" onClick={openSplitFace} disabled={readOnly || !canSplitFace} /><ToolButton icon={X} label="Delete Face + Heal" onClick={openDeleteFace} disabled={readOnly || !selectedFaceItems.length} /><ToolButton icon={Layers3} label="Replace Face" onClick={openReplaceFace} disabled={readOnly || selectedFaceItems.length !== 2} /><ToolButton icon={Layers3} label="Offset Face" onClick={openOffsetFace} disabled={readOnly || selectedFaceItems.length !== 1} /><ToolButton icon={Move3d} label="Przesuń bryłę" onClick={() => openTransform('move')} disabled={readOnly || selection?.kind !== 'body'} /><ToolButton icon={Rotate3d} label="Obróć bryłę" onClick={() => openTransform('rotate')} disabled={readOnly || selection?.kind !== 'body'} /><ToolButton icon={PencilRuler} label="Edytuj" onClick={editSelection} disabled={readOnly || !['sketch', 'profile', 'feature', 'constructionPlane', 'constructionAxis', 'constructionPoint'].includes(selection?.kind)} /></RibbonGroup>
                <RibbonGroup label="WYBÓR" end><ToolButton icon={MousePointer2} label="Wybierz" onClick={() => setSelection({ kind: 'document', id: document.id })} /></RibbonGroup>
              </>
            )}
          </ResponsiveRibbon>
        </div>
      </section>

      <div
        className={`modeling-content command-dock-${panelLayout.commandDock} ${browserOpen ? '' : 'without-browser'} ${workspace === 'print' && printPanelOpen ? 'with-print-panel' : ''}`}
        style={{
          '--browser-column': browserOpen ? '252px' : '0px',
          '--command-column': isDockableCommand(command) ? (panelLayout.commandCollapsed ? '38px' : '280px') : '0px',
          '--print-column': workspace === 'print' && printPanelOpen ? (panelLayout.printCollapsed ? '38px' : '286px') : '0px',
        }}
      >
        {browserOpen && <ProjectBrowser document={document} bodies={engine.bodies} selection={selection} activeSketchId={activeSketchId} onSelect={handleBrowserSelection} onToggleReference={toggleConstructionVisibility} onClose={() => setBrowserOpen(false)} />}
        <CommandDialog
          command={command}
          profileName={command?.type === 'pipe' ? `Otwarta ścieżka (${command.previewFeature?.pathEntityIds?.length || command.pathEntityIds?.length || 0})` : command?.openChain ? `Otwarty łańcuch (${command.previewFeature?.openEntityIds?.length || 0})` : commandProfileName}
          collapsed={panelLayout.commandCollapsed}
          dock={panelLayout.commandDock}
          onChange={updateCommand}
          onConfirm={command?.type === 'rectangle' || command?.type === 'circle' ? confirmProfile : command?.type === 'point' ? confirmSketchPoint : ['arc', 'polygon', 'ellipse', 'slot', 'spline', 'conic'].includes(command?.type) ? confirmMechanicalShape : command?.type === 'line' || command?.type === 'polyline' ? confirmExactSketchSegment : command?.type === 'moveSketch' ? confirmSketchMove : command?.type === 'offsetSketch' ? confirmSketchOffset : command?.type === 'cornerSketch' ? confirmSketchCorner : command?.type === 'transformSketch' ? confirmSketchTransform : command?.type === 'patternSketch' ? confirmSketchPattern : ['offsetPlane', 'midplanePlane', 'threePointPlane', 'anglePlane', 'tangentPlane', 'pathPlane'].includes(command?.type) ? confirmConstructionPlane : command?.type === 'constructionAxis' ? confirmConstructionAxis : command?.type === 'constructionPoint' ? confirmConstructionPoint : confirmFeature}
          onConfirmDynamic={confirmDynamicSketchSegment}
          onCancel={command?.type === 'line' || command?.type === 'polyline' ? finishSketchPath : () => { if (command?.openChain && command.sourceSketchId) { setActiveSketchId(command.sourceSketchId); setWorkspace('sketch'); } setCommand(null); setNotice('Anulowano polecenie.'); }}
          onUndoSegment={undoSketchSegment}
          onFinishPath={finishSketchPath}
          onToggleCollapsed={() => setPanelLayout((current) => ({ ...current, commandCollapsed: !current.commandCollapsed }))}
          onToggleDock={() => setPanelLayout((current) => ({ ...current, commandDock: current.commandDock === 'right' ? 'left' : 'right' }))}
        />
        <main className="modeling-stage">
          <React.Suspense fallback={<div className="viewport-loading" role="status">Uruchamianie widoku 3D…</div>}>
          <ModelViewport
            bodies={engine.bodies}
            sketches={document.sketches}
            activeSketchId={activeSketchId}
            draftProfile={draftProfile}
            draftType={null}
            onDraftChange={readOnly ? undefined : updateCommand}
            sketchTool={command?.type === 'line' || command?.type === 'polyline' || directSketchTypes.includes(command?.type) ? command.type : null}
            sketchToolPrompt={command?.type === 'rectangle' ? (command.gesturePoints?.length ? 'Wskaż przeciwległy narożnik' : 'Wskaż pierwszy narożnik') : command?.type === 'circle' ? (command.gesturePoints?.length ? 'Wskaż punkt promienia' : 'Wskaż środek') : command?.type === 'arc' ? 'Wskaż trzy punkty łuku' : command?.type === 'polygon' ? 'Wskaż środek i wierzchołek' : command?.type === 'ellipse' ? 'Wskaż środek, oś główną i szerokość' : command?.type === 'slot' ? 'Wskaż oś slotu i jego szerokość' : command?.type === 'spline' ? 'Klikaj punkty spline' : command?.type === 'conic' ? 'Wskaż początek, punkt kontrolny i koniec' : command?.type === 'point' ? 'Wskaż położenie punktu' : command?.type === 'line' ? (command.lastPoint ? 'Ustaw kierunek kursorem' : 'Wskaż punkt początkowy linii') : command?.type === 'polyline' ? 'Klikaj kolejne punkty; kliknij początek, aby zamknąć' : null}
            polylineDraft={command?.type === 'line' || command?.type === 'polyline' ? { lastPoint: command.lastPoint } : directSketchTypes.includes(command?.type) ? { lastPoint: command.gesturePoints?.at(-1) || null } : null}
            onSketchPoint={readOnly ? undefined : handleSketchCanvasPoint}
            onSketchPointerMove={(point) => { sketchPointerRef.current = point; }}
            onSketchFinish={readOnly ? undefined : finishCanvasSketchTool}
            sketchDynamicLength={command?.dynamicLength || ''}
            selectedSketchEntityIds={selectedSketchEntityIds}
            lostProjectedEntityIds={lostProjectedEntityIds}
            selectedSketchConstraintId={selectedSketchConstraintId}
            onSketchSelection={handleSketchSelection}
            onSketchConstraintSelection={(constraintId) => setSelection({ kind: 'sketchConstraint', id: constraintId, sketchId: activeSketchId })}
            onSketchConstraintValueChange={updateSketchConstraintValue}
            onDeleteSketchSelection={readOnly ? undefined : deleteSelectedSketchEntities}
            sketchModifierMode={command?.type === 'trimSketch' ? 'trim' : command?.type === 'extendSketch' ? 'extend' : command?.type === 'breakSketch' ? 'break' : command?.type === 'projectSketch' ? 'project' : null}
            onSketchModify={modifySketchAtPoint}
            onSketchProfileSelection={(profileId) => setSelection({ kind: 'profile', id: profileId, sketchId: activeSketchId })}
            onSketchMove={readOnly ? undefined : moveSketchEntities}
            showSketchPoints={sketchOptions.points}
            showSketchProfiles={sketchOptions.profiles}
            showSketchConstraints={sketchOptions.constraints}
            showSketchDimensions={sketchOptions.dimensions}
            showConstructionGeometry={sketchOptions.construction}
            showProjectedGeometry={sketchOptions.projected}
            sliceModel={sketchOptions.slice}
            sectionAnalysis={sectionAnalysis}
            parameters={document.parameters}
            showGrid={!activeSketchId || sketchOptions.grid}
            selectedBodyId={selection?.kind === 'body' ? selection.id : (selection?.bodyId || null)}
            selectedBodyIds={selectedBodyIds}
            onSelectBody={(id) => setSelection(id ? { kind: 'body', id } : { kind: 'document', id: document.id })}
            selectedTopologyIds={selectedTopologyIds}
            onSelectTopology={handleTopologySelection}
            constructionPlanes={constructionPlanes}
            constructionAxes={constructionAxes}
            constructionPoints={constructionPoints}
            selectedConstructionId={selection?.kind === 'constructionPlane' ? selection.id : null}
            selectedConstructionAxisId={selection?.kind === 'constructionAxis' ? selection.id : null}
            selectedConstructionPointId={selection?.kind === 'constructionPoint' ? selection.id : null}
            selectedProfile={selectedProfile}
            selectedProfilePlane={selectedProfileMatch?.sketch.plane || 'XY'}
            selectedProfilePlaneOffset={Number(selectedProfileMatch?.sketch.planeOffset || 0)}
            directExtrudeDistance={command?.type === 'extrude' ? command.distance : 0}
            onDirectExtrude={readOnly ? undefined : beginOrUpdateExtrude}
            directManipulator={readOnly ? null : directManipulator}
            snapEnabled={sketchOptions.snap}
            snapThresholdPx={sketchOptions.snapDistance}
            bed={document.print}
            showBed={workspace === 'print' && printPanelOpen}
            printLayout={document.print}
          />
          </React.Suspense>
          <div className={`engine-status ${engine.status}`}><span />{engine.status === 'ready' ? `${command?.previewFeature ? 'Podgląd' : 'Model'} gotowy · ${engine.bodies.length} ${engine.bodies.length === 1 ? 'bryła' : 'brył'}` : engine.status === 'computing' ? 'Przeliczanie historii…' : engine.status === 'loading' ? 'Uruchamianie OpenCascade…' : engine.error}</div>
          {notice && <div className="workspace-notice" role="status">{notice}</div>}
          <CrashRecoveryBanner
            info={recoveryInfo}
            onSave={() => { void saveProject(); }}
            onDismiss={() => setRecoveryInfo(null)}
          />
          <TopologyReferenceRepairPanel items={lostTopologyReferences} selection={selection} onReassign={repairTopologyReference} onPreview={(candidate) => handleTopologySelection(candidate)} />
          {command?.type === 'measure' && <MeasurePanel measurement={measurement} onClose={() => setCommand(null)} />}
          {command?.type === 'sectionAnalysis' && sectionAnalysis && <SectionPanel analysis={sectionAnalysis} onChange={(patch) => setSectionAnalysis((current) => ({ ...current, ...patch }))} onClose={closeSectionAnalysis} />}
          {command?.type === 'massProperties' && <MassPropertiesPanel density={command.density} result={massProperties?.result} error={massProperties?.error} onDensityChange={(density) => setCommand((current) => ({ ...current, density }))} onClose={() => setCommand(null)} />}
          {command?.type === 'geometryInspection' && <GeometryInspectionPanel result={geometryInspection} onClose={() => setCommand(null)} />}
          {!document.sketches.length && !engine.bodies.length && !command && !readOnly && <StartPage onStartSketch={startSketch} onOpenProject={requestOpenProject} />}
          {command?.type === 'plane' && <PlanePicker onPick={pickPlane} onCancel={() => { setCommand(null); setWorkspace('solid'); setNotice('Anulowano tworzenie szkicu.'); }} />}
          <ImportModelDialog draft={importDraft} onChange={(patch) => setImportDraft((current) => ({ ...current, ...patch }))} onConfirm={confirmModelImport} onCancel={() => setImportDraft(null)} />
          <ImportSketchDialog draft={sketchImportDraft} onChange={(patch) => setSketchImportDraft((current) => ({ ...current, ...patch }))} onConfirm={confirmSketchImport} onCancel={() => setSketchImportDraft(null)} />
          <SketchDimensionDialog command={command} onChange={updateCommand} onConfirm={confirmSketchDimension} onCancel={() => setCommand(null)} />
          {command?.type === 'parameters' && <ParametersDialog document={document} commit={commit} onClose={() => setCommand(null)} />}
          {activeSketchId && <SketchPalette options={sketchOptions} onChange={(key, value) => setSketchOptions((current) => ({ ...current, [key]: value }))} onFinish={finishSketch} />}
        </main>
        {workspace === 'print' && printPanelOpen && <PrintPanel document={document} bodies={engine.bodies} engine={engine} selectedFace={selectedPrintFace} commit={commit} collapsed={panelLayout.printCollapsed} onSelectIssue={(item) => setSelection(item?.kind === 'document' ? { kind: 'document', id: document.id } : item)} onExport={exportModel} onSendToSlicer={sendToSlicer} onClose={() => setPrintPanelOpen(false)} onToggleCollapsed={() => setPanelLayout((current) => ({ ...current, printCollapsed: !current.printCollapsed }))} readOnly={readOnly} />}
      </div>

      <footer className="modeling-footer">
        <CommandLine
          command={command}
          history={commandHistory}
          notice={notice}
          onCancel={handleCommandLineCancel}
          onSubmit={handleCommandLineSubmit}
        />
        <div className="timeline" role="region" aria-label="Parametryczna oś czasu">
          {document.features.length ? <><div className="timeline-controls"><button type="button" title="Zaznacz pierwszy krok parametrycznej historii." onClick={() => selectTimelineStep('start')}><SkipBack size={14} /></button><button type="button" title="Zaznacz poprzednią operację w historii." onClick={() => selectTimelineStep('previous')}><StepBack size={14} /></button><button type="button" title="Zaznacz następną operację w historii." onClick={() => selectTimelineStep('next')}><StepForward size={14} /></button></div>
          {selectedTimelineFeature && <div className="timeline-selection-tools" role="toolbar" aria-label={`Zarządzaj operacją ${selectedTimelineFeature.name}`}>
            {timelineRename?.id === selectedTimelineFeature.id ? (
              <div className="timeline-rename">
                <input autoFocus aria-label="Nowa nazwa operacji" maxLength={80} value={timelineRename.value} onChange={(event) => setTimelineRename((current) => ({ ...current, value: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); confirmTimelineRename(); } }} />
                <button type="button" data-timeline-action="confirm-rename" title="Zapisz nazwę" aria-label="Zapisz nazwę" onClick={confirmTimelineRename}><Check size={13} /></button>
                <button type="button" title="Anuluj zmianę nazwy" aria-label="Anuluj zmianę nazwy" onClick={() => setTimelineRename(null)}><X size={13} /></button>
              </div>
            ) : timelineDeleteId === selectedTimelineFeature.id ? (
              <div className="timeline-delete-confirm" role="alert">
                <span>Usunąć {timelineDeleteCount === 1 ? 'operację' : `${timelineDeleteCount} operacje`}?</span>
                <button className="danger" type="button" data-timeline-action="confirm-delete" onClick={confirmTimelineDelete}>Usuń</button>
                <button type="button" onClick={() => setTimelineDeleteId(null)}>Anuluj</button>
              </div>
            ) : <>
              <strong title={selectedTimelineFeature.name}>{selectedTimelineIndex + 1}. {selectedTimelineFeature.name}</strong>
              <button type="button" data-timeline-action="edit" title="Edytuj parametry operacji" aria-label="Edytuj parametry operacji" disabled={readOnly} onClick={editSelection}><PencilRuler size={13} /></button>
              <button type="button" data-timeline-action="rename" title="Zmień nazwę (F2)" aria-label="Zmień nazwę operacji" disabled={readOnly} onClick={beginTimelineRename}><Pencil size={13} /></button>
              <button type="button" data-timeline-action="move-left" title="Przenieś wcześniej" aria-label="Przenieś operację wcześniej" disabled={readOnly || selectedTimelineIndex === 0} onClick={() => moveSelectedTimelineFeature(-1)}><ArrowLeft size={13} /></button>
              <button type="button" data-timeline-action="move-right" title="Przenieś później" aria-label="Przenieś operację później" disabled={readOnly || selectedTimelineIndex === document.features.length - 1} onClick={() => moveSelectedTimelineFeature(1)}><ArrowRight size={13} /></button>
              <button type="button" data-timeline-action="suppress" title={selectedTimelineFeature.suppressed ? 'Włącz operację' : 'Wyłącz operację'} aria-label={selectedTimelineFeature.suppressed ? 'Włącz operację' : 'Wyłącz operację'} disabled={readOnly} onClick={toggleSelectedTimelineFeature}>{selectedTimelineFeature.suppressed ? <Eye size={13} /> : <EyeOff size={13} />}</button>
              <button className="danger" type="button" data-timeline-action="delete" title="Usuń operację i zależności" aria-label="Usuń operację i zależności" disabled={readOnly} onClick={requestTimelineDelete}><Trash2 size={13} /></button>
            </>}
          </div>}
          <span className="timeline-start" />
          {document.features.map((feature, index) => {
            const result = timelineStatus.get(feature.id);
            return (
              <button key={feature.id} className={`timeline-item ${selection?.kind === 'feature' && selection.id === feature.id ? 'selected' : ''} ${feature.suppressed ? 'suppressed' : ''} ${lostReferenceOwnerIds.has(feature.id) ? 'warning reference-lost' : result?.status || ''}`} type="button" aria-current={selection?.kind === 'feature' && selection.id === feature.id ? 'step' : undefined} aria-label={`${index + 1}. ${feature.name}${feature.suppressed ? ', operacja wyłączona' : ''}`} onClick={() => selectTimelineFeature(feature, index)} onDoubleClick={editSelection} title={`${index + 1}. ${feature.name}${feature.suppressed ? ' — wyłączona' : lostReferenceOwnerIds.has(feature.id) ? ' — utracona referencja topologii' : result?.error ? ` — ${result.error}` : ''}`}>
                {featureIcon(feature.type, 16)}<span>{index + 1}</span>
              </button>
            );
          })}
          <span className="timeline-end" /></> : <span className="timeline-empty-label">Historia operacji pojawi się po utworzeniu pierwszej bryły.</span>}
        </div>
      </footer>
      {tutorialOpen && <FirstPartTutorial onClose={() => setTutorialOpen(false)} />}
      {licenseInfoOpen && <LicenseInfoDialog onClose={() => setLicenseInfoOpen(false)} onShowFullLicense={() => { setLicenseInfoOpen(false); setFullLicenseOpen(true); }} />}
      {fullLicenseOpen && <FullLicenseDialog onClose={() => setFullLicenseOpen(false)} />}
      {updateState.open && !updatePromptBlocked && <UpdateDialog state={updateState} onCheck={checkForUpdates} onInstall={installAvailableUpdate} onClose={() => setUpdateState((current) => ({ ...current, open: false, promptPending: false }))} />}
      {toolHelp && (
        <div className="tool-help-tooltip" role="tooltip" style={{ left: toolHelp.x, top: toolHelp.y }}>
          <header><strong>{toolHelp.label}</strong>{toolHelp.shortcut && <kbd>{toolHelp.shortcut}</kbd>}</header>
          <p>{toolHelp.help}</p>
          <small>Podstawowe narzędzia uruchomisz jednym klawiszem; pozostałe wybierz przyciskiem.</small>
        </div>
      )}
    </section>
    </ToolHelpContext.Provider>
  );
}
